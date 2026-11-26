// Herinnering ongeveer 2 uur voor een kennismaking die via Cal.com is geboekt (zie cal-webhook.mjs).
// Draait elke 10 minuten, alleen op de live site (Netlify voert geplande functies niet uit op branch deploys).
// Geen herinnering als de afspraak minder dan 3 uur van tevoren is geboekt of verzet: dan is de bevestiging net binnen.
import { getStore } from "@netlify/blobs";
import { mails } from "./lib/mails.js";
import { verstuur, BASE } from "../klant-mails.js";
import { log } from "../logboek.js";
import { mailData } from "./lib/afspraak.js";

const VOORAF = 2 * 3600e3;   // 2 uur van tevoren
const MIN_GEBOEKT = 3 * 3600e3; // minstens 3 uur tussen boeken en de afspraak

export default async () => {
  const store = getStore({ name: "intern", consistency: "strong" });
  const klanten = (await store.get("klanten", { type: "json" })) || [];
  const nu = Date.now();
  const env = (x) => process.env[x];
  const regels = [], nieuweLog = new Map();
  let gewijzigd = false;

  for (const k of klanten) {
    const a = k.afspraak;
    // Per afspraak én tijdstip: na verzetten komt er opnieuw een herinnering voor het nieuwe tijdstip
    if (!a) continue;
    const merk = a.uid + "|" + a.start;
    if (a.status === "geannuleerd" || a.stil || a.herinnerd === merk || !k.email || (k.uit || []).includes("afspraakHerinnering")) continue;
    const start = new Date(a.start).getTime();
    if (!(start > nu && start - nu <= VOORAF)) continue;
    if (start - new Date(a.op).getTime() < MIN_GEBOEKT) { a.herinnerd = merk; gewijzigd = true; continue; }

    // Eerst vastleggen dat we deze afspraak oppakken, zodat een overlappende run hem niet nog eens stuurt
    const eerste = await store.setJSON(`cal/${a.uid}/herinnering/${a.start}`, new Date().toISOString(), { onlyIfNew: true });
    a.herinnerd = merk; gewijzigd = true;
    if (eerste && eerste.modified === false) continue;

    const m = mails.afspraakHerinnering(mailData({ naam: k.naam, wie: a.bron === "planner" ? "" : a.wie, start: a.start, eind: a.eind, tz: a.tz, video: a.video, videoVolgt: a.bron === "planner" && !a.video, telefoon: a.telefoon, verzet: a.verzet, annuleer: a.annuleer }), BASE);
    const r = await verstuur(env, { aan: k.email, mail: m });
    if (!r.ok) console.error("Herinnering niet verstuurd:", r.fout);
    nieuweLog.set(k.id, { type: "afspraak", onderwerp: m.subject, aan: k.email, op: new Date().toISOString(), door: "gepland", test: false, ok: r.ok, fout: r.fout || null });
    regels.push({ wie: "systeem", soort: "mail", klant: k, tekst: "Herinnering kennismaking " + (r.ok ? "verstuurd: " : "mislukt: ") + m.subject });
  }

  if (gewijzigd) {
    // Opnieuw lezen en alleen de herinnerd-markering overnemen: in de tussentijd kan iemand iets anders aan de klanten hebben gewijzigd
    const vers = (await store.get("klanten", { type: "json" })) || [];
    for (const k of klanten) {
      const v = vers.find((x) => x.id === k.id);
      if (!v || !v.afspraak || !k.afspraak || v.afspraak.uid !== k.afspraak.uid) continue;
      v.afspraak.herinnerd = k.afspraak.herinnerd;
      if (nieuweLog.has(k.id)) v.log = [nieuweLog.get(k.id), ...(v.log || [])].slice(0, 100);
    }
    await store.setJSON("klanten", vers);
  }
  await log(store, regels);
  return new Response(`${regels.length} herinnering(en)`);
};

export const config = { schedule: "*/10 * * * *" };
