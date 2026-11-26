// Wat er gebeurt na boeken, verzetten of annuleren in de eigen planner:
// Google-agenda-item met Meet-link, lead en afspraak in het dashboard, mail met agenda-bijlage, pushmelding en logboek.
// Gebruikt door netlify/functions/planner.mjs (de site) en planner-intern.mjs (het dashboard).
import { mails } from "./mails.js";
import { verstuur, BASE } from "../../klant-mails.js";
import { stuur, MENSEN } from "../../push.js";
import { log } from "../../logboek.js";
import { TZ, wanneer, mailData, ics } from "./afspraak.js";
import { NAMEN, token, zetGoogle } from "./planner.js";
import { googleIngesteld, leesGoogle, accountVoor, maakAfspraak, verzetAfspraak, verwijderAfspraak } from "./google.js";

const nieuweId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);
export const beheerLink = (env, a, actie) => `${BASE}/afspraak?id=${a.id}&t=${token(env, a.id)}${actie ? "&actie=" + actie : ""}`;
const SITUATIE = { start: "Net gestart", boekhouder: "Wil overstappen van boekhouder", zelf: "Doet het nu zelf", anders: "Anders" };

// soort: "gepland" | "verzet" | "geannuleerd"; door: "systeem" (klant via de site) of "koen"/"daan" (vanuit het dashboard)
export async function naAfspraak(store, env, a, soort, { door = "systeem", reden = "" } = {}) {
  const problemen = [];

  // 1. Google Agenda en Meet
  let meet = a.meet || "", eventId = a.googleEventId || "", account = a.googleWie || "";
  if (googleIngesteld(env)) {
    try {
      const g = await leesGoogle(store);
      const titel = `Kennismaking: ${a.naam} (${NAMEN[a.wie]})`;
      const beschrijving = [`Kennismaking van 20 minuten via avezaatenevers.nl.`, `Naam: ${a.naam}`, `E-mail: ${a.email}`, a.telefoon ? `Telefoon: ${a.telefoon}` : "",
        a.situatie ? `Situatie: ${SITUATIE[a.situatie] || a.situatie}` : "", a.bericht ? `Bericht: ${a.bericht}` : ""].filter(Boolean).join("\n");
      if (soort === "geannuleerd") {
        if (eventId && account) await verwijderAfspraak(env, g, account, eventId);
      } else if (soort === "verzet" && eventId && account && account === accountVoor(g, a.wie)) {
        await verzetAfspraak(env, g, account, eventId, a);
      } else {
        // Nieuw, of verzet naar de ander: oud item weghalen en een nieuw item (met nieuwe Meet-link) maken
        if (eventId && account) await verwijderAfspraak(env, g, account, eventId).catch(() => {});
        const r = await maakAfspraak(env, g, a, { titel, beschrijving });
        meet = r.meet; eventId = r.eventId; account = r.account;
        if (!r.open) problemen.push("Google Meet staat niet op Open (zet de Meet-API aan en koppel Google opnieuw)");
      }
      await zetGoogle(store, a.id, { meet: soort === "geannuleerd" ? a.meet : meet, googleEventId: soort === "geannuleerd" ? "" : eventId, googleWie: soort === "geannuleerd" ? "" : account });
    } catch (e) {
      console.error("Planner: Google mislukt:", e.message);
      problemen.push("Google Agenda: " + e.message);
    }
  } else if (soort !== "geannuleerd") {
    problemen.push("Google is nog niet ingesteld (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET)");
  }

  // 2. Lead en afspraak in het dashboard
  const klanten = (await store.get("klanten", { type: "json" })) || [];
  const nu = new Date().toISOString();
  let k = klanten.find((x) => x.email === a.email), nieuw = false;
  if (!k && soort !== "geannuleerd") {
    k = { id: nieuweId(), naam: a.naam, bedrijf: "", email: a.email, telefoon: a.telefoon, boekhouder: a.wie, status: "prospect", start: "", voorstelLink: "", notitie: "", uit: [], verstuurd: {}, log: [], tijdlijn: [],
      door: "formulier", aangemaakt: nu, herkomst: "website", lead: { bron: "afspraak", op: nu, situatie: a.situatie, situatieTekst: SITUATIE[a.situatie] || "", bericht: a.bericht } };
    klanten.push(k); nieuw = true;
  }
  const verzetLink = beheerLink(env, a), annuleerLink = beheerLink(env, a, "annuleer");
  if (k) {
    if (soort !== "geannuleerd" && k.status !== "klant") { if (k.status !== "prospect") k.status = "prospect"; if (!k.lead) k.lead = { bron: "afspraak", op: nu }; }
    if (!k.telefoon && a.telefoon) k.telefoon = a.telefoon;
    if (!k.boekhouder) k.boekhouder = a.wie;
    k.afspraak = { uid: a.id, icsUid: a.id, seq: a.seq || 0, start: a.start, eind: a.eind, status: soort, video: meet, telefoon: "", tz: TZ, verzet: verzetLink, annuleer: annuleerLink, wie: a.wie, op: nu, herinnerd: null, bron: "planner" };
    const w = wanneer(a.start);
    k.tijdlijn = k.tijdlijn || [];
    k.tijdlijn.unshift({ id: nieuweId(), soort: "notitie", door: door === "systeem" ? "formulier" : door, op: nu,
      tekst: soort === "gepland" ? `Kennismaking gepland met ${NAMEN[a.wie]}: ${w}${a.bericht ? ". Bericht: " + a.bericht : ""}`
        : soort === "verzet" ? `Kennismaking verzet naar ${w} (met ${NAMEN[a.wie]})`
        : `Kennismaking van ${w} geannuleerd${door !== "systeem" ? " door " + NAMEN[door] : ""}${reden ? ". Reden: " + reden : ""}` });
  }

  // 3. Mail naar de klant
  const d = mailData({ naam: a.naam, wie: "", start: a.start, eind: a.eind, tz: TZ, video: meet, videoVolgt: !meet, verzet: verzetLink, annuleer: annuleerLink, reden });
  const m = soort === "gepland" ? mails.afspraak(d, BASE) : soort === "verzet" ? mails.afspraakVerzet(d, BASE) : mails.afspraakGeannuleerd(d, BASE);
  const agenda = ics({ uid: a.id, seq: a.seq || 0, start: a.start, eind: a.eind, geannuleerd: soort === "geannuleerd", locatie: meet,
    titel: "Kennismaking Avezaat & Evers",
    beschrijving: `${meet ? "Deelnemen: " + meet + "\n" : ""}Ander moment kiezen: ${verzetLink}\nAnnuleren: ${annuleerLink}\n\nVragen? App of bel 085 060 4363.` });
  const r = await verstuur(env, { aan: a.email, mail: m,
    bijlagen: [{ filename: soort === "geannuleerd" ? "kennismaking-geannuleerd.ics" : "kennismaking.ics", content: Buffer.from(agenda).toString("base64"), content_type: `text/calendar; method=${soort === "geannuleerd" ? "CANCEL" : "PUBLISH"}; charset=UTF-8` }] });
  if (!r.ok) { console.error("Planner: mail mislukt:", r.fout); problemen.push("Mail aan klant: " + r.fout); }
  if (k) {
    k.log = k.log || [];
    k.log.unshift({ type: "afspraak", onderwerp: m.subject, aan: a.email, op: nu, door: "gepland", test: false, ok: r.ok, fout: r.fout || null });
    k.log = k.log.slice(0, 100);
  }
  await store.setJSON("klanten", klanten);

  // 4. Mail aan Koen en Daan (zelfde adres als de formuliermeldingen), met agenda-bijlage voor de eigen agenda
  try {
    const mi = mails.afspraakIntern({ soort, naam: a.naam, email: a.email, telefoon: a.telefoon, situatie: SITUATIE[a.situatie] || "", bericht: a.bericht, wanneer: wanneer(a.start),
      wie: a.wie, video: meet, reden, klantLink: k ? `${BASE}/intern/klant.html?id=${encodeURIComponent(k.id)}` : "" }, BASE);
    const eigen = ics({ uid: a.id + "-intern", seq: a.seq || 0, start: a.start, eind: a.eind, geannuleerd: soort === "geannuleerd", locatie: meet,
      titel: `Kennismaking: ${a.naam} (${NAMEN[a.wie]})`,
      beschrijving: `${meet ? "Meet: " + meet + "\n" : ""}${a.email}${a.telefoon ? "\n" + a.telefoon : ""}${a.bericht ? "\n\n" + a.bericht : ""}${k ? "\n\n" + BASE + "/intern/klant.html?id=" + k.id : ""}` });
    const aan = String(env("MAIL_TO") || "info@avezaatenevers.nl").split(",").map((x) => x.trim()).filter(Boolean);
    for (const adres of aan) {
      const ri = await verstuur(env, { aan: adres, mail: mi,
        bijlagen: [{ filename: soort === "geannuleerd" ? "kennismaking-geannuleerd.ics" : "kennismaking.ics", content: Buffer.from(eigen).toString("base64"), content_type: `text/calendar; method=${soort === "geannuleerd" ? "CANCEL" : "PUBLISH"}; charset=UTF-8` }] });
      if (!ri.ok) { console.error("Planner: interne mail mislukt:", ri.fout); problemen.push("Interne mail: " + ri.fout); }
    }
  } catch (e) {
    console.error("Planner: interne mail mislukt:", e.message);
  }

  // 5. Logboek en pushmelding
  const w = wanneer(a.start);
  await log(store, { wie: door, soort: "klant", klant: k,
    tekst: `Kennismaking ${soort} (${w}, ${NAMEN[a.wie]})${nieuw ? ", lead aangemaakt" : ""}${r.ok ? ", klant gemaild" : ", mail mislukt"}${problemen.some((p) => p.startsWith("Google Agenda")) ? ", zonder Meet-link" : problemen.some((p) => p.startsWith("Google Meet")) ? ", Meet niet open" : ""}` });
  try {
    const kort = new Date(a.start).toLocaleString("nl-NL", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const aan = door === "systeem" ? [a.wie] : MENSEN.filter((x) => x !== door);
    await stuur(store, aan, "lead", {
      title: `Kennismaking ${soort}: ${a.naam}`,
      body: soort === "geannuleerd" ? `Was ${kort}.${reden ? " Reden: " + reden.slice(0, 100) : ""}` : `${kort} met ${NAMEN[a.wie]}.${meet ? "" : " Let op: nog geen Meet-link."}`,
      url: k ? "/intern/klant.html?id=" + encodeURIComponent(k.id) : "/intern/beschikbaarheid.html", tag: "afspraak-" + a.id,
    });
  } catch (e) {
    console.error("Planner: push mislukt:", e.message);
  }
  return { meet, problemen, klantId: k ? k.id : null };
}
