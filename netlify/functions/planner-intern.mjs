// Dashboardkant van de eigen planner (alleen ingelogd; de edge function laat /intern/api/planner/* door naar deze functie):
//   GET  /intern/api/planner                    beschikbaarheid, afspraken, Google-status, aantal vrije momenten
//   POST /intern/api/planner/beschikbaarheid    { koen: { week, dicht }, daan: { week, dicht } }
//   POST /intern/api/planner/annuleer           { id, reden }  annuleren namens Koen of Daan (klant krijgt een mail)
//   GET  /intern/api/planner/google/start       naar Google om de eigen agenda te koppelen
//   GET  /intern/api/planner/google/terug       terugkomst van Google
//   POST /intern/api/planner/google/ontkoppel
//   POST /intern/api/planner/apple/koppel        { appleId, wachtwoord }  Apple Agenda (iCloud) koppelen
//   POST /intern/api/planner/apple/agendas       { aan: [href] }          welke agenda's meetellen
//   POST /intern/api/planner/apple/ontkoppel
import { getStore } from "@netlify/blobs";
import { createHmac } from "node:crypto";
import { ingelogd, COOKIE } from "../intern-logica.js";
import { log } from "../logboek.js";
import { leesBeschikbaarheid, bewaarBeschikbaarheid, schoneBeschikbaarheid, leesAfspraken, vrijeTijden, annuleer, NAMEN, MENSEN, DUUR, VOORUIT_DAGEN, MIN_UREN } from "./lib/planner.js";
import { naAfspraak, beheerLink } from "./lib/planner-acties.js";
import { googleIngesteld, leesGoogle, bewaarGoogle, googleAuthUrl, googleCode } from "./lib/google.js";
import { ontdek, herontdek, versleutel, leesApple, bewaarApple, bezetVoor, bezetStatus, wisBezet } from "./lib/apple.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const terug = (pad) => new Response(null, { status: 303, headers: { Location: pad } });
function cookie(request, naam) {
  const c = request.headers.get("cookie") || "";
  const m = c.split(/;\s*/).find((x) => x.startsWith(naam + "="));
  return m ? decodeURIComponent(m.slice(naam.length + 1)) : null;
}
const geheim = (env) => String(env("PLANNER_SECRET") || env("RESEND_API_KEY") || "avezaat-evers-planner");
const staat = (env, wie, tijd) => wie + "." + tijd + "." + createHmac("sha256", geheim(env)).update("google:" + wie + ":" + tijd).digest("hex").slice(0, 24);

export default async (req) => {
  const wie = await ingelogd(cookie(req, COOKIE));
  if (!wie) return json({ fout: "Niet ingelogd" }, 401);
  const url = new URL(req.url);
  const pad = url.pathname.replace(/\/+$/, "");
  const env = (k) => process.env[k];
  const store = getStore({ name: "intern", consistency: "strong" });
  const redirect = url.origin + "/intern/api/planner/google/terug";

  if (pad === "/intern/api/planner" && req.method === "GET") {
    const [b, lijst, g, klanten, apple] = await Promise.all([leesBeschikbaarheid(store), leesAfspraken(store), leesGoogle(store), store.get("klanten", { type: "json" }), leesApple(store)]);
    const bezet = await bezetVoor(store, env);
    const status = await bezetStatus(store);
    const grens = new Date(Date.now() - 30 * 864e5).toISOString();
    const vrij = vrijeTijden(b, lijst, new Date(), { bezet });
    return json({
      wie, beschikbaarheid: b,
      regels: { duur: DUUR, vooruit: VOORUIT_DAGEN, minUren: MIN_UREN },
      vrij: { totaal: vrij.length, koen: vrij.filter((t) => t.wie.includes("koen")).length, daan: vrij.filter((t) => t.wie.includes("daan")).length },
      afspraken: lijst.filter((a) => a.start >= grens).sort((x, y) => x.start.localeCompare(y.start)).map((a) => {
        const k = (klanten || []).find((x) => x.email === a.email);
        return { id: a.id, start: a.start, eind: a.eind, wie: a.wie, naam: a.naam, bedrijf: a.bedrijf || "", email: a.email, telefoon: a.telefoon, situatie: a.situatie, bericht: a.bericht, status: a.status,
          reden: a.reden || "", meet: a.meet || "", klantId: k ? k.id : null, beheer: beheerLink(env, a) };
      }),
      google: { ingesteld: googleIngesteld(env), redirect, ...Object.fromEntries(MENSEN.map((m) => [m, g[m] && g[m].refresh ? { email: g[m].email || "", sinds: g[m].op } : null])) },
      apple: Object.fromEntries(MENSEN.map((m) => [m, apple[m] && apple[m].appleId ? { appleId: apple[m].appleId, agendas: apple[m].agendas, sinds: apple[m].op,
        gelezen: (status[m] || {}).laatstGoed || null, fout: (status[m] || {}).fout || null, perAgenda: (status[m] || {}).agendas || [],
        blokken: (bezet[m] || []).filter((x) => x[1] > Date.now() && x[0] < Date.now() + 14 * 864e5).length } : null])),
    });
  }

  if (pad === "/intern/api/planner/beschikbaarheid" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const oud = await leesBeschikbaarheid(store);
    const nieuw = schoneBeschikbaarheid({ ...oud, ...body });
    await bewaarBeschikbaarheid(store, nieuw);
    const anders = MENSEN.filter((m) => JSON.stringify(oud[m]) !== JSON.stringify(nieuw[m]));
    if (anders.length) await log(store, { wie, soort: "instelling", tekst: "Beschikbaarheid voor kennismakingen aangepast (" + anders.map((m) => NAMEN[m]).join(" en ") + ")" });
    return json({ ok: true, beschikbaarheid: nieuw });
  }

  if (pad === "/intern/api/planner/annuleer" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const reden = String(body.reden || "").replace(/[<>]/g, "").trim().slice(0, 300);
    const r = await annuleer(store, String(body.id || ""), reden, wie);
    if (r.fout) return json({ fout: r.fout }, 404);
    if (!r.al) await naAfspraak(store, env, r.afspraak, "geannuleerd", { door: wie, reden });
    return json({ ok: true });
  }

  if (pad === "/intern/api/planner/google/start" && req.method === "GET") {
    if (!googleIngesteld(env)) return terug("/intern/beschikbaarheid.html?google=niet-ingesteld");
    return terug(googleAuthUrl(env, redirect, staat(env, wie, Date.now())));
  }

  if (pad === "/intern/api/planner/google/terug" && req.method === "GET") {
    const [sWie, sTijd] = String(url.searchParams.get("state") || "").split(".");
    if (url.searchParams.get("error")) return terug("/intern/beschikbaarheid.html?google=geweigerd");
    if (sWie !== wie || url.searchParams.get("state") !== staat(env, sWie, sTijd) || Date.now() - Number(sTijd) > 15 * 60e3) return terug("/intern/beschikbaarheid.html?google=ongeldig");
    const r = await googleCode(env, String(url.searchParams.get("code") || ""), redirect);
    if (r.fout) { console.error("Google koppelen mislukt:", r.fout); return terug("/intern/beschikbaarheid.html?google=mislukt&uitleg=" + encodeURIComponent(r.fout)); }
    const g = await leesGoogle(store);
    g[wie] = { refresh: r.refresh, email: r.email, op: new Date().toISOString() };
    await bewaarGoogle(store, g);
    await log(store, { wie, soort: "instelling", tekst: "Google Agenda gekoppeld voor kennismakingen" + (r.email ? " (" + r.email + ")" : "") });
    return terug("/intern/beschikbaarheid.html?google=ok");
  }

  if (pad === "/intern/api/planner/apple/koppel" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const appleId = String(body.appleId || "").trim().toLowerCase(), ww = String(body.wachtwoord || "").replace(/\s+/g, "");
    if (!appleId || !ww) return json({ fout: "Vul je Apple ID en het app-specifieke wachtwoord in." }, 400);
    let r;
    try { r = await ontdek(appleId, ww); } catch (e) { return json({ fout: e.message }, 400); }
    const apple = await leesApple(store);
    apple[wie] = { appleId, wachtwoord: versleutel(env, ww), home: r.home, agendas: r.agendas, op: new Date().toISOString() };
    await bewaarApple(store, apple); await wisBezet(store, wie);
    await log(store, { wie, soort: "instelling", tekst: "Apple Agenda gekoppeld voor kennismakingen (" + r.agendas.filter((a) => a.aan).map((a) => a.naam).join(", ") + ")" });
    return json({ ok: true, agendas: r.agendas });
  }

  if (pad === "/intern/api/planner/apple/agendas" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const apple = await leesApple(store);
    if (!apple[wie]) return json({ fout: "Nog geen Apple Agenda gekoppeld" }, 400);
    const aan = new Set(Array.isArray(body.aan) ? body.aan : []);
    apple[wie].agendas = apple[wie].agendas.map((a) => ({ ...a, aan: aan.has(a.href) }));
    await bewaarApple(store, apple); await wisBezet(store, wie);
    await log(store, { wie, soort: "instelling", tekst: "Agenda's voor kennismakingen aangepast: " + (apple[wie].agendas.filter((a) => a.aan).map((a) => a.naam).join(", ") || "geen") });
    return json({ ok: true });
  }

  if (pad === "/intern/api/planner/apple/vernieuw" && req.method === "POST") {
    // Agenda's opnieuw opzoeken (nieuwe agenda's en abonnementen), dan direct uitlezen
    const apple = await leesApple(store);
    if (apple[wie]) { try { apple[wie] = await herontdek(env, apple[wie]); await bewaarApple(store, apple); } catch (e) { return json({ fout: e.message }, 400); } }
    await wisBezet(store, wie);
    await bezetVoor(store, env, 0);
    return json({ ok: true });
  }

  if (pad === "/intern/api/planner/apple/ontkoppel" && req.method === "POST") {
    const apple = await leesApple(store);
    if (apple[wie]) { delete apple[wie]; await bewaarApple(store, apple); await wisBezet(store, wie); await log(store, { wie, soort: "instelling", tekst: "Apple Agenda ontkoppeld" }); }
    return json({ ok: true });
  }

  if (pad === "/intern/api/planner/google/ontkoppel" && req.method === "POST") {
    const g = await leesGoogle(store);
    if (g[wie]) { delete g[wie]; await bewaarGoogle(store, g); await log(store, { wie, soort: "instelling", tekst: "Google Agenda ontkoppeld" }); }
    return json({ ok: true });
  }

  return json({ fout: "Onbekende route" }, 404);
};

export const config = { path: ["/intern/api/planner", "/intern/api/planner/*"] };
