// Eigen planner voor kennismakingen: beschikbaarheid per persoon, vrije tijden en boeken zonder dubbele boekingen.
// Opslag (Blobs-store "intern"):
//   planner-beschikbaarheid  { koen: { week: { "1": [["09:00","12:00"]], ... }, dicht: ["2026-12-24"] }, daan: { ... }, instellingen: { vooruitWeken: 2 } }
//                            week-sleutels: 0 = zondag, 1 = maandag ... 6 = zaterdag (tijden in Nederlandse tijd)
//   planner-afspraken        [ { id, start, eind, wie, naam, email, telefoon, situatie, bericht, status, op, seq, meet, googleEventId, googleWie } ]
import { createHmac, timingSafeEqual } from "node:crypto";

export const TZ = "Europe/Amsterdam";
export const MENSEN = ["koen", "daan"];
export const NAMEN = { koen: "Koen", daan: "Daan" };
export const DUUR = 20;          // minuten per kennismaking
export const STAP = 30;          // om de hoeveel minuten een tijd begint (20 min gesprek + 10 min ruimte)
export const BUFFER = 10;        // minuten ruimte tussen twee afspraken van dezelfde persoon
export const VOORUIT_WEKEN = 2;  // standaard: zo ver vooruit kan een klant boeken (instelbaar in het dashboard, 1 tot 8 weken)
export const MAX_WEKEN = 8;
export const vooruitDagen = (b) => 7 * ((b && b.instellingen && b.instellingen.vooruitWeken) || VOORUIT_WEKEN);
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

// ---------- Feestdagen (standaard automatisch dicht, uit te zetten in het dashboard) ----------
const twee = (n) => String(n).padStart(2, "0");
function pasen(j) { // Gregoriaanse paasdatum (Meeus/Jones/Butcher)
  const a = j % 19, b = Math.floor(j / 100), c = j % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return `${j}-${twee(Math.floor(n / 31))}-${twee((n % 31) + 1)}`;
}
// Nederlandse feestdagen waarop vrijwel iedereen vrij is; Bevrijdingsdag alleen in lustrumjaren (2030, 2035, …)
export function feestdagen(jaar) {
  const p = pasen(jaar), koning = weekdag(`${jaar}-04-27`) === 0 ? `${jaar}-04-26` : `${jaar}-04-27`;
  return [
    [`${jaar}-01-01`, "Nieuwjaarsdag"], [p, "Eerste Paasdag"], [plusDagen(p, 1), "Tweede Paasdag"], [koning, "Koningsdag"],
    ...(jaar % 5 === 0 ? [[`${jaar}-05-05`, "Bevrijdingsdag"]] : []),
    [plusDagen(p, 39), "Hemelvaartsdag"], [plusDagen(p, 49), "Eerste Pinksterdag"], [plusDagen(p, 50), "Tweede Pinksterdag"],
    [`${jaar}-12-25`, "Eerste Kerstdag"], [`${jaar}-12-26`, "Tweede Kerstdag"],
  ].map(([datum, naam]) => ({ datum, naam })).sort((x, y) => x.datum.localeCompare(y.datum));
}
const feestCache = new Map();
export function feestdag(datum) {
  const j = +datum.slice(0, 4);
  if (!feestCache.has(j)) feestCache.set(j, new Map(feestdagen(j).map((f) => [f.datum, f.naam])));
  return feestCache.get(j).get(datum) || "";
}
export const feestdagenDicht = (b) => !(b && b.instellingen && b.instellingen.feestdagen === false);

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
  const w = Number(ruw && ruw.instellingen && ruw.instellingen.vooruitWeken);
  uit.instellingen = { vooruitWeken: Number.isInteger(w) && w >= 1 && w <= MAX_WEKEN ? w : VOORUIT_WEKEN, feestdagen: !(ruw && ruw.instellingen && ruw.instellingen.feestdagen === false) };
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
export function vrijeTijden(beschikbaar, afspraken, nu = new Date(), { negeer, bezet = {}, minUren = MIN_UREN } = {}) {
  const vanaf = nu.getTime() + minUren * 3600e3, vandaag = lokaleDatum(nu), uit = new Map(), feest = feestdagenDicht(beschikbaar);
  for (let i = 0, n = vooruitDagen(beschikbaar); i <= n; i++) {
    const datum = plusDagen(vandaag, i), wd = weekdag(datum);
    if (feest && feestdag(datum)) continue;
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

// Verzetten vanuit het dashboard: Koen of Daan kiest zelf datum, tijd en wie het gesprek doet, ook buiten de vaste tijden.
// Alleen een andere kennismaking van dezelfde persoon blokkeert; iets in de Apple Agenda geeft een waarschuwing (toch = doorzetten).
// Zelf inplannen vanuit het dashboard (bijvoorbeeld na een telefoontje): zelfde regels als verzetten door ons.
// E-mail mag leeg zijn; mailKlant = false stuurt de klant niets (ook geen herinnering).
export async function planDoorOns(store, g, datum, tijd, wie, door, { nu = new Date(), bezet = {}, toch = false } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(datum)) || !/^\d{2}:\d{2}$/.test(String(tijd))) return { fout: "Kies een datum en tijd." };
  if (!MENSEN.includes(wie)) return { fout: "Kies wie het gesprek doet." };
  if (!g.naam) return { fout: "Vul een naam in." };
  const s = lokaalNaarUtc(datum, tijd).getTime(), e = s + DUUR * 60e3;
  if (!Number.isFinite(s)) return { fout: "Kies een datum en tijd." };
  if (s <= nu.getTime()) return { fout: "Dat moment is al voorbij." };
  if (!toch && (bezet[wie] || []).some((b) => b[0] < e && b[1] > s)) return { fout: "agenda", waarschuwing: `${NAMEN[wie]} heeft op dat moment iets in de agenda staan.` };
  let gemaakt = null;
  const r = await wijzigAfspraken(store, (lijst) => {
    if (bezetDoorAfspraak(lijst, wie, s, e)) return { fout: `${NAMEN[wie]} heeft dan al een kennismaking.` };
    gemaakt = { id: nieuweId(), start: new Date(s).toISOString(), eind: new Date(e).toISOString(), wie, naam: g.naam, bedrijf: g.bedrijf || "", email: g.email || "",
      telefoon: g.telefoon || "", situatie: "", bericht: g.bericht || "", status: "gepland", op: nu.toISOString(), seq: 0, meet: "", googleEventId: "", googleWie: "",
      ingeplandDoor: door, stil: !g.mailKlant || !g.email };
    lijst.push(gemaakt);
    return { ok: true };
  });
  return r.fout ? r : { ok: true, afspraak: gemaakt };
}

export async function verzetDoorOns(store, id, datum, tijd, wie, door, { nu = new Date(), bezet = {}, toch = false } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(datum)) || !/^\d{2}:\d{2}$/.test(String(tijd))) return { fout: "Kies een datum en tijd." };
  if (!MENSEN.includes(wie)) return { fout: "Kies wie het gesprek doet." };
  const s = lokaalNaarUtc(datum, tijd).getTime(), e = s + DUUR * 60e3;
  if (!Number.isFinite(s)) return { fout: "Kies een datum en tijd." };
  if (s <= nu.getTime()) return { fout: "Dat moment is al voorbij." };
  if (!toch && (bezet[wie] || []).some((b) => b[0] < e && b[1] > s)) return { fout: "agenda", waarschuwing: `${NAMEN[wie]} heeft op dat moment iets in de agenda staan.` };
  let uit = null;
  const r = await wijzigAfspraken(store, (lijst) => {
    const a = lijst.find((x) => x.id === id);
    if (!a || !actief(a)) return { fout: "Deze kennismaking bestaat niet meer of is geannuleerd." };
    if (bezetDoorAfspraak(lijst, wie, s, e, id)) return { fout: `${NAMEN[wie]} heeft dan al een kennismaking.` };
    const start = new Date(s).toISOString();
    if (start === a.start && wie === a.wie) return { fout: "Dat is hetzelfde moment als nu." };
    const vorige = { start: a.start, wie: a.wie };
    a.wie = wie; a.start = start; a.eind = new Date(e).toISOString(); a.status = "verzet"; a.verzetDoor = door; a.op = nu.toISOString(); a.seq = (a.seq || 0) + 1;
    uit = { ...a, vorige };
    return { ok: true };
  });
  return r.fout ? r : { ok: true, afspraak: uit };
}

// Uitkomst na afloop: "gehouden", "noshow" of "" (wissen)
export async function zetUitkomst(store, id, uitkomst, door, nu = new Date()) {
  if (!["gehouden", "noshow", ""].includes(uitkomst)) return { fout: "Onbekende uitkomst" };
  let uit = null;
  const r = await wijzigAfspraken(store, (lijst) => {
    const a = lijst.find((x) => x.id === id);
    if (!a || !actief(a)) return { fout: "Deze kennismaking bestaat niet of is geannuleerd." };
    if (new Date(a.start) > nu) return { fout: "Deze kennismaking moet nog beginnen." };
    if (uitkomst) { a.uitkomst = uitkomst; a.uitkomstDoor = door; a.uitkomstOp = nu.toISOString(); } else { delete a.uitkomst; delete a.uitkomstDoor; delete a.uitkomstOp; }
    uit = { ...a };
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
