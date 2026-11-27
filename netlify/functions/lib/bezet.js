// Bezette tijden per persoon uit de eigen agenda's: Apple Agenda (lib/apple.js) én Google Agenda (lib/google.js).
// Gebruikt door de planner: op die momenten kan een klant niet boeken.
// Google: alleen voor wie zijn eigen Google-account heeft gekoppeld (gebruikt Daan het account van Koen, dan telt
// Koens agenda niet voor Daan). De kennismakingen die de planner zelf in Google zet, tellen niet mee.
import { bezetVoor as appleBezet, bezetStatus } from "./apple.js";
import { leesGoogle, googleIngesteld, bezetUitGoogle } from "./google.js";
import { MENSEN, leesAfspraken } from "./planner.js";

const CACHE = "planner-bezet-google";
const VOORUIT_MS = (8 * 7 + 2) * 864e5;

// { koen: [[s, e]], daan: [...] }; ververst wat ouder is dan maxOud (ms). Lukt Google even niet, dan de laatste bekende tijden (tot 24 uur).
export async function googleBezetVoor(store, env, maxOud = 5 * 60e3) {
  const uit = Object.fromEntries(MENSEN.map((m) => [m, []]));
  if (!googleIngesteld(env)) return uit;
  const [g, cache, lijst] = await Promise.all([leesGoogle(store), store.get(CACHE, { type: "json" }).then((x) => x || {}), leesAfspraken(store)]);
  const eigen = new Set(lijst.map((a) => a.googleEventId).filter(Boolean));
  const nu = Date.now();
  let gewijzigd = false;
  await Promise.all(MENSEN.map(async (wie) => {
    if (!g[wie] || !g[wie].refresh) { if (cache[wie]) { delete cache[wie]; gewijzigd = true; } return; }
    const oud = cache[wie], leeftijd = (x) => (x ? nu - new Date(x).getTime() : Infinity);
    const bruikbaar = oud && oud.blokken && leeftijd(oud.laatstGoed) < 24 * 3600e3 ? oud.blokken : [];
    let blokken = bruikbaar;
    if (oud && !oud.fout && leeftijd(oud.op) < maxOud) blokken = oud.blokken;
    else if (!(oud && oud.fout && leeftijd(oud.op) < 2 * 60e3)) {
      try {
        blokken = await bezetUitGoogle(env, g, wie, nu - 864e5, nu + VOORUIT_MS);
        const op = new Date().toISOString();
        cache[wie] = { op, laatstGoed: op, blokken, fout: null };
      } catch (e) {
        console.error(`Google Agenda (${wie}) niet gelezen:`, e.message);
        cache[wie] = { blokken: bruikbaar, laatstGoed: (oud && oud.laatstGoed) || null, fout: e.message, op: new Date().toISOString() };
      }
      gewijzigd = true;
    }
    uit[wie] = blokken.filter((b) => !eigen.has(b[2]));
  }));
  if (gewijzigd) await store.setJSON(CACHE, cache);
  return uit;
}

export async function googleBezetStatus(store) { return (await store.get(CACHE, { type: "json" })) || {}; }
export async function wisGoogleBezet(store, wie) { const c = (await store.get(CACHE, { type: "json" })) || {}; delete c[wie]; await store.setJSON(CACHE, c); }

// Snel voor de planner op de site: toon meteen de laatst bekende bezette tijden (tot 6 uur oud) en ververs ze op de
// achtergrond als ze ouder zijn dan 5 minuten. Zo wacht een bezoeker niet op iCloud of Google. Bij boeken wordt
// altijd opnieuw gekeken (bezetVoor met 1 minuut), dus een dubbele afspraak kan hierdoor niet ontstaan.
export async function bezetSnel(store, env, achtergrond) {
  const bezet = await bezetVoor(store, env, 6 * 3600e3);
  if (achtergrond) {
    const [a, g] = await Promise.all([bezetStatus(store), googleBezetStatus(store)]);
    const oud = [...Object.values(a), ...Object.values(g)].some((c) => c && c.op && Date.now() - Date.parse(c.op) > 5 * 60e3);
    if (oud) achtergrond(bezetVoor(store, env).catch((e) => console.error("Bezette tijden verversen mislukt:", e.message)));
  }
  return bezet;
}

// Apple en Google samen
export async function bezetVoor(store, env, maxOud = 5 * 60e3) {
  const [a, g] = await Promise.all([appleBezet(store, env, maxOud), googleBezetVoor(store, env, maxOud)]);
  return Object.fromEntries(MENSEN.map((m) => [m, [...(a[m] || []), ...(g[m] || [])]]));
}
