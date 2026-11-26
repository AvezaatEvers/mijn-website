// Eigen planner voor kennismakingen: beschikbaarheid per persoon, vrije tijden en boeken zonder dubbele boekingen.
// Opslag (Blobs-store "intern"):
//   planner-beschikbaarheid  { koen: { week: { "1": [["09:00","12:00"]], ... }, dicht: ["2026-12-24"] }, daan: { ... } }
//                            week-sleutels: 0 = zondag, 1 = maandag ... 6 = zaterdag (tijden in Nederlandse tijd)
//   planner-afspraken        [ { id, start, eind, wie, naam, email, telefoon, situatie, bericht, status, op, seq, meet, googleEventId, googleWie } ]
import { createHmac, timingSafeEqual } from "node:crypto";

export const TZ = "Europe/Amsterdam";
export const MENSEN = ["koen", "daan"];
export const NAMEN = { koen: "Koen", daan: "Daan" };
export const DUUR = 20;          // minuten per kennismaking
export const STAP = 30;          // om de hoeveel minuten een tijd begint (20 min gesprek + 10 min ruimte)
export const BUFFER = 10;        // minuten ruimte tussen twee afspraken van dezelfde persoon
export const VOORUIT_DAGEN = 14; // zo ver vooruit kan een klant boeken
export const MIN_UREN = 24;      // zo kort van tevoren kan een klant nog boeken
const BESCHIKBAAR = "planner-beschikbaarheid";
const AFSPRAKEN = "planner-afspraken";

// ---------- Tijd in Nederland ----------
function delen(d) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(d).map((x) => [x.type, x.value]));
}
// "2026-12-03" + "09:30" (Nederlandse tijd) → Date (UTC), ook rond de wisseling van zomer- en wintertijd
export function lokaalNaarUtc(datum, tijd) {
  const [y, m, d] = datum.split("-").map(Number), [h, mi] = tijd.split(":").map(Number);
  const doel = Date.UTC(y, m - 1, d, h, mi);
  let t = doel;
  for (let i = 0; i < 3; i++) { const p = delen(new Date(t)); t += doel - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute); }
  return new Date(t);
}
export function lokaleDatum(d = new Date()) { const p = delen(d); return `${p.year}-${p.month}-${p.day}`; }
export function lokaleTijd(d) { const p = delen(d); return `${p.hour}:${p.minute}`; }
export function plusDagen(datum, n) { const d = new Date(datum + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const weekdag = (datum) => new Date(datum + "T12:00:00Z").getUTCDay();
const tijdOk = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

// ---------- Opslag ----------
export function schoneBeschikbaarheid(ruw) {
  const uit = {};
  for (const wie of MENSEN) {
    const p = (ruw && ruw[wie]) || {}, week = {};
    for (let wd = 0; wd < 7; wd++) {
      const vensters = (Array.isArray((p.week || {})[wd]) ? p.week[wd] : [])
        .filter((v) => Array.isArray(v) && tijdOk(v[0]) && tijdOk(v[1]) && v[0] < v[1]).map((v) => [v[0], v[1]]).slice(0, 6);
      if (vensters.length) week[wd] = vensters.sort((a, b) => a[0].localeCompare(b[0]));
    }
    const dicht = [...new Set((Array.isArray(p.dicht) ? p.dicht : []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort().slice(-200);
    uit[wie] = { week, dicht };
  }
  return uit;
}
export async function leesBeschikbaarheid(store) { return schoneBeschikbaarheid(await store.get(BESCHIKBAAR, { type: "json" })); }
export async function bewaarBeschikbaarheid(store, b) { await store.setJSON(BESCHIKBAAR, schoneBeschikbaarheid(b)); }
export async function leesAfspraken(store) { const l = await store.get(AFSPRAKEN, { type: "json" }); return Array.isArray(l) ? l : []; }

// Wijzig de afsprakenlijst met een ETag-controle: lukt het schrijven niet omdat iemand anders net iets wijzigde,
// dan lezen we opnieuw en voeren we fn nog eens uit (fn bekijkt dus altijd de nieuwste lijst).
export async function wijzigAfspraken(store, fn) {
  for (let poging = 0; poging < 8; poging++) {
    if (poging) await new Promise((r) => setTimeout(r, 20 + Math.random() * 60 * poging));
    const oud = await store.getWithMetadata(AFSPRAKEN, { type: "json" });
    const lijst = oud && Array.isArray(oud.data) ? oud.data : [];
    const r = await fn(lijst);
    if (!r || r.fout || r.niets) return r || {};
    const w = await store.setJSON(AFSPRAKEN, lijst, oud ? { onlyIfMatch: oud.etag } : { onlyIfNew: true });
    if (!w || w.modified !== false) return r;
  }
  return { fout: "Het is even druk. Probeer het nog een keer." };
}

// ---------- Vrije tijden ----------
const actief = (a) => a.status !== "geannuleerd";
function bezetDoorAfspraak(lijst, wie, s, e, negeer) {
  return lijst.some((a) => actief(a) && a.wie === wie && a.id !== negeer && new Date(a.start).getTime() < e + BUFFER * 60e3 && new Date(a.eind).getTime() + BUFFER * 60e3 > s);
}

// Alle tijden waarop minstens één van beiden vrij is: [{ start, eind, wie: ["koen", "daan"] }]
// bezet: { koen: [[startMs, eindMs]], daan: [...] } uit de eigen agenda (Apple Agenda), zie lib/apple.js
export function vrijeTijden(beschikbaar, afspraken, nu = new Date(), { negeer, bezet = {} } = {}) {
  const vanaf = nu.getTime() + MIN_UREN * 3600e3, vandaag = lokaleDatum(nu), uit = new Map();
  for (let i = 0; i <= VOORUIT_DAGEN; i++) {
    const datum = plusDagen(vandaag, i), wd = weekdag(datum);
    for (const wie of MENSEN) {
      const p = beschikbaar[wie] || { week: {}, dicht: [] };
      if (p.dicht.includes(datum)) continue;
      for (const [van, tot] of p.week[wd] || []) {
        const einde = lokaalNaarUtc(datum, tot).getTime();
        for (let s = lokaalNaarUtc(datum, van).getTime(); s + DUUR * 60e3 <= einde; s += STAP * 60e3) {
          const e = s + DUUR * 60e3;
          if (s < vanaf || bezetDoorAfspraak(afspraken, wie, s, e, negeer) || (bezet[wie] || []).some((b) => b[0] < e && b[1] > s)) continue;
          const k = new Date(s).toISOString();
          if (!uit.has(k)) uit.set(k, { start: k, eind: new Date(e).toISOString(), wie: [] });
          if (!uit.get(k).wie.includes(wie)) uit.get(k).wie.push(wie);
        }
      }
    }
  }
  return [...uit.values()].sort((a, b) => a.start.localeCompare(b.start));
}

// Per dag gegroepeerd voor de planner op de site (zonder te laten zien wie er vrij is)
export function tijdenPerDag(tijden) {
  const dagen = new Map();
  for (const t of tijden) {
    const d = new Date(t.start), datum = lokaleDatum(d);
    if (!dagen.has(datum)) dagen.set(datum, { datum, label: d.toLocaleDateString("nl-NL", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }), tijden: [] });
    dagen.get(datum).tijden.push({ tijd: lokaleTijd(d), start: t.start });
  }
  return [...dagen.values()];
}

// Wie krijgt de afspraak: van de vrije mensen degene met de minste afspraken in die week; bij gelijkspel willekeurig
function kiesWie(kandidaten, lijst, start) {
  if (kandidaten.length === 1) return kandidaten[0];
  const s = new Date(start).getTime();
  const tel = (wie) => lijst.filter((a) => actief(a) && a.wie === wie && Math.abs(new Date(a.start).getTime() - s) < 3.5 * 864e5).length;
  const min = Math.min(...kandidaten.map(tel));
  const beste = kandidaten.filter((w) => tel(w) === min);
  return beste[Math.floor(Math.random() * beste.length)];
}

// ---------- Boeken, verzetten, annuleren ----------
const nieuweId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 20);

export async function boek(store, beschikbaar, gegevens, nu = new Date(), bezet = {}) {
  let gemaakt = null;
  const r = await wijzigAfspraken(store, (lijst) => {
    const al = lijst.find((a) => actief(a) && a.email === gegevens.email && new Date(a.start) > nu);
    if (al) return { fout: "dubbel", afspraak: al };
    const slot = vrijeTijden(beschikbaar, lijst, nu, { bezet }).find((t) => t.start === gegevens.start);
    if (!slot) return { fout: "bezet" };
    gemaakt = { id: nieuweId(), start: slot.start, eind: slot.eind, wie: kiesWie(slot.wie, lijst, slot.start), naam: gegevens.naam, bedrijf: gegevens.bedrijf || "", email: gegevens.email,
      telefoon: gegevens.telefoon || "", situatie: gegevens.situatie || "", bericht: gegevens.bericht || "", status: "gepland", op: nu.toISOString(), seq: 0, meet: "", googleEventId: "", googleWie: "" };
    lijst.push(gemaakt);
    return { ok: true };
  });
  return r.fout ? r : { ok: true, afspraak: gemaakt };
}

export async function verzet(store, beschikbaar, id, start, nu = new Date(), bezet = {}) {
  let uit = null;
  const r = await wijzigAfspraken(store, (lijst) => {
    const a = lijst.find((x) => x.id === id);
    if (!a || !actief(a)) return { fout: "niet gevonden" };
    if (new Date(a.start) <= nu) return { fout: "voorbij" };
    const slot = vrijeTijden(beschikbaar, lijst, nu, { negeer: id, bezet }).find((t) => t.start === start);
    if (!slot) return { fout: "bezet" };
    const vorige = { start: a.start, wie: a.wie };
    a.wie = slot.wie.includes(a.wie) ? a.wie : kiesWie(slot.wie, lijst.filter((x) => x.id !== id), slot.start);
    a.start = slot.start; a.eind = slot.eind; a.status = "verzet"; a.op = nu.toISOString(); a.seq = (a.seq || 0) + 1;
    uit = { ...a, vorige };
    return { ok: true };
  });
  return r.fout ? r : { ok: true, afspraak: uit };
}

export async function annuleer(store, id, reden = "", door = "klant", nu = new Date()) {
  let uit = null;
  const r = await wijzigAfspraken(store, (lijst) => {
    const a = lijst.find((x) => x.id === id);
    if (!a) return { fout: "niet gevonden" };
    if (!actief(a)) { uit = { ...a }; return { niets: true }; }
    a.status = "geannuleerd"; a.reden = String(reden || "").slice(0, 300); a.geannuleerdDoor = door; a.op = nu.toISOString(); a.seq = (a.seq || 0) + 1;
    uit = { ...a };
    return { ok: true };
  });
  if (r.fout) return r;
  return { ok: true, afspraak: uit, al: !!r.niets };
}

// Gegevens van Google (Meet-link, agenda-item) bij een afspraak opslaan
export async function zetGoogle(store, id, g) {
  return wijzigAfspraken(store, (lijst) => {
    const a = lijst.find((x) => x.id === id);
    if (!a) return { niets: true };
    Object.assign(a, g);
    return { ok: true };
  });
}

// ---------- Beveiligde link voor verzetten en annuleren ----------
const geheim = (env) => String(env("PLANNER_SECRET") || env("RESEND_API_KEY") || "avezaat-evers-planner");
export function token(env, id) { return createHmac("sha256", geheim(env)).update("afspraak:" + id).digest("hex").slice(0, 32); }
export function tokenKlopt(env, id, t) {
  const a = Buffer.from(token(env, String(id || ""))), b = Buffer.from(String(t || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}
