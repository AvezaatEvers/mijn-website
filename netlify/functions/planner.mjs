// Openbare kant van de eigen planner (gebruikt door /assets/planner.js op /contact en door /afspraak):
//   GET  /api/planner/tijden                 vrije tijden per dag (zonder te laten zien wie er vrij is)
//   POST /api/planner/boek                   { start, naam, email, telefoon, situatie, bericht, website (honeypot) }
//   GET  /api/planner/afspraak?id=&t=        afspraak bekijken (met de beveiligde link uit de mail)
//   POST /api/planner/verzet                 { id, t, start }
//   POST /api/planner/annuleer               { id, t, reden }
import { getStore } from "@netlify/blobs";
import { leesBeschikbaarheid, leesAfspraken, vrijeTijden, tijdenPerDag, boek, verzet, annuleer, tokenKlopt, TZ } from "./lib/planner.js";
import { naAfspraak } from "./lib/planner-acties.js";
import { wanneer } from "./lib/afspraak.js";
import { bezetVoor } from "./lib/bezet.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const schoon = (s, n = 200) => String(s || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const mailadres = (e) => { const v = String(e || "").trim().toLowerCase(); return /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/.test(v) ? v : ""; };
const SITUATIES = ["start", "boekhouder", "zelf", "anders"];

const BEZET = "Dit moment is net door iemand anders gekozen. Kies een ander moment.";

export default async (req) => {
  const url = new URL(req.url);
  const pad = url.pathname.replace(/\/+$/, "");
  const env = (k) => process.env[k];
  const store = getStore({ name: "intern", consistency: "strong" });

  if (pad === "/api/planner/tijden" && req.method === "GET") {
    const [b, lijst, bezet] = await Promise.all([leesBeschikbaarheid(store), leesAfspraken(store), bezetVoor(store, env)]);
    const negeer = url.searchParams.get("id") && tokenKlopt(env, url.searchParams.get("id"), url.searchParams.get("t")) ? url.searchParams.get("id") : undefined;
    return json({ dagen: tijdenPerDag(vrijeTijden(b, lijst, new Date(), { negeer, bezet })) });
  }

  if (pad === "/api/planner/boek" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    if (body.website) return json({ ok: true, start: body.start }); // honeypot: bots krijgen een nep-succes
    const g = { start: String(body.start || ""), naam: schoon(body.naam, 120), bedrijf: schoon(body.bedrijf, 120), email: mailadres(body.email), telefoon: schoon(body.telefoon, 30),
      situatie: SITUATIES.includes(body.situatie) ? body.situatie : "", bericht: String(body.bericht || "").replace(/[<>]/g, "").trim().slice(0, 1000) };
    if (!g.naam || !g.email) return json({ fout: "Vul je naam en een geldig e-mailadres in." }, 400);
    if (!body.privacy) return json({ fout: "Ga akkoord met de privacyverklaring." }, 400);
    // Bij boeken de agenda opnieuw bekijken als die meer dan een minuut oud is
    const r = await boek(store, await leesBeschikbaarheid(store), g, new Date(), await bezetVoor(store, env, 60e3));
    if (r.fout === "bezet") return json({ fout: BEZET, bezet: true }, 409);
    if (r.fout === "dubbel") return json({ fout: `Je hebt al een kennismaking op ${wanneer(r.afspraak.start)}. Wil je een ander moment? Gebruik de link in je bevestigingsmail.` }, 409);
    if (r.fout) return json({ fout: r.fout }, 503);
    const na = await naAfspraak(store, env, r.afspraak, "gepland");
    if (na.problemen.length) console.error("Planner: boeking gelukt met problemen:", na.problemen.join(" | "));
    return json({ ok: true, id: r.afspraak.id, start: r.afspraak.start, eind: r.afspraak.eind, meet: na.meet || "" });
  }

  // Beheer met de beveiligde link uit de mail
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : Object.fromEntries(url.searchParams);
  if (!["/api/planner/afspraak", "/api/planner/verzet", "/api/planner/annuleer"].includes(pad)) return json({ fout: "Onbekend" }, 404);
  if (!tokenKlopt(env, body.id, body.t)) return json({ fout: "Deze link klopt niet (meer). Bel of app ons, dan regelen we het." }, 403);
  const lijst = await leesAfspraken(store);
  const a = lijst.find((x) => x.id === body.id);
  if (!a) return json({ fout: "Afspraak niet gevonden." }, 404);

  if (pad === "/api/planner/afspraak" && req.method === "GET") {
    return json({ status: a.status, start: a.start, eind: a.eind, wanneer: wanneer(a.start), voornaam: String(a.naam || "").split(" ")[0], voorbij: new Date(a.start) <= new Date(), meet: a.status !== "geannuleerd" ? a.meet || "" : "" });
  }
  if (pad === "/api/planner/verzet" && req.method === "POST") {
    const r = await verzet(store, await leesBeschikbaarheid(store), a.id, String(body.start || ""), new Date(), await bezetVoor(store, env, 60e3));
    if (r.fout === "bezet") return json({ fout: BEZET, bezet: true }, 409);
    if (r.fout === "voorbij") return json({ fout: "Deze afspraak is al geweest." }, 409);
    if (r.fout) return json({ fout: r.fout === "niet gevonden" ? "Deze afspraak is geannuleerd." : r.fout }, 409);
    await naAfspraak(store, env, r.afspraak, "verzet");
    return json({ ok: true, start: r.afspraak.start, eind: r.afspraak.eind, wanneer: wanneer(r.afspraak.start) });
  }
  if (pad === "/api/planner/annuleer" && req.method === "POST") {
    const reden = schoon(body.reden, 300);
    const r = await annuleer(store, a.id, reden, "klant");
    if (r.fout) return json({ fout: r.fout }, 409);
    if (!r.al) await naAfspraak(store, env, r.afspraak, "geannuleerd", { reden });
    return json({ ok: true });
  }
  return json({ fout: "Methode niet toegestaan" }, 405);
};

export const config = { path: ["/api/planner/*"] };
