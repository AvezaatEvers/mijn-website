// Planning en verzending van klantmails. Gedeeld door de interne omgeving
// (edge function) en de dagelijkse geplande functie (netlify/functions/geplande-mails.mjs).
import { mails } from "./functions/lib/mails.js";

export const BASE = "https://avezaatenevers.nl";

export const TYPES = {
  welkom: { label: "Welkomstmail", wanneer: "Handmatig, na het tekenen" },
  checkIn: { label: "Check-in na 2 weken", wanneer: "Automatisch, 14 dagen na de startdatum" },
  voorstelHerinnering: { label: "Herinnering voorstel", wanneer: "Handmatig, als het voorstel nog niet getekend is" },
  kwartaal: { label: "Kwartaalherinnering btw", wanneer: "Automatisch, rond de 3e van januari, april, juli en oktober" },
  jaareinde: { label: "Jaareinde", wanneer: "Automatisch, 25 november" },
  inkomstenbelasting: { label: "Aangifte inkomstenbelasting", wanneer: "Automatisch, 2 maart" },
};
export const AUTOMATISCH = ["checkIn", "kwartaal", "jaareinde", "inkomstenbelasting"];

const MAANDEN = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
const KW = ["1e", "2e", "3e", "4e"];

export function vandaag() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date());
}
function iso(d) { return d.toISOString().slice(0, 10); }
function dag(s) { return new Date(s + "T12:00:00Z"); }
function plusDagen(s, n) { const d = dag(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
// Valt een datum in het weekend, dan de maandag erna
function werkdag(s) { const d = dag(s); const w = d.getUTCDay(); if (w === 6) d.setUTCDate(d.getUTCDate() + 2); if (w === 0) d.setUTCDate(d.getUTCDate() + 1); return iso(d); }
export function mooieDatum(s) { const d = dag(s); return `${d.getUTCDate()} ${MAANDEN[d.getUTCMonth()]} ${d.getUTCFullYear()}`; }

// Alle momenten van een klant tussen twee jaren
function momenten(k, vanJaar, totJaar) {
  const uit = [];
  if (k.status !== "klant") return uit;
  const start = k.start || (k.aangemaakt || "").slice(0, 10);
  if (start) uit.push({ type: "checkIn", sleutel: "checkIn", datum: werkdag(plusDagen(start, 14)), data: {} });
  for (let j = vanJaar; j <= totJaar; j++) {
    // Kwartaal: mail begin van het kwartaal over het vorige kwartaal
    [[0, 3, 31], [3, 0, 30], [6, 1, 31], [9, 2, 31]].forEach(([maand, vorigeKw, deadlineDag]) => {
      const datum = werkdag(`${j}-${String(maand + 1).padStart(2, "0")}-03`);
      const kwJaar = maand === 0 ? j - 1 : j;
      const kwartaalEind = maand === 0 ? `${j - 1}-12-31` : `${j}-${String(maand).padStart(2, "0")}-28`;
      if (start && start > kwartaalEind) return; // nog geen klant in dat kwartaal
      uit.push({ type: "kwartaal", sleutel: `kwartaal-${kwJaar}-Q${vorigeKw + 1}`, datum, data: {
        kwartaal: `${KW[vorigeKw]} kwartaal van ${kwJaar}`, aanleverdatum: `10 ${MAANDEN[maand]}`, deadline: `${deadlineDag} ${MAANDEN[maand]}`,
      } });
    });
    const jaareinde = werkdag(`${j}-11-25`);
    if (!start || start < jaareinde) uit.push({ type: "jaareinde", sleutel: `jaareinde-${j}`, datum: jaareinde, data: {} });
    const ib = werkdag(`${j}-03-02`);
    if (!start || start < `${j}-01-01`) uit.push({ type: "inkomstenbelasting", sleutel: `ib-${j - 1}`, datum: ib, data: { jaar: String(j - 1), aanleverdatum: "1 april" } });
  }
  return uit;
}

// Komende mails (niet verstuurd, niet uitgezet), oplopend
export function gepland(k, nu = vandaag(), aantal = 6) {
  const j = Number(nu.slice(0, 4));
  const verstuurd = k.verstuurd || {};
  const uitgezet = k.uit || [];
  return momenten(k, j, j + 1)
    .filter((m) => m.datum >= nu && !verstuurd[m.sleutel])
    .sort((a, b) => a.datum.localeCompare(b.datum))
    .slice(0, aantal)
    .map((m) => ({ ...m, label: TYPES[m.type].label, aan: !uitgezet.includes(m.type) }));
}

// Mails die vandaag (of de afgelopen 7 dagen, als een run is gemist) weg moeten
export function teVersturen(k, nu = vandaag()) {
  const j = Number(nu.slice(0, 4));
  const verstuurd = k.verstuurd || {};
  const uitgezet = k.uit || [];
  const ondergrens = plusDagen(nu, -7);
  return momenten(k, j - 1, j).filter((m) => m.datum <= nu && m.datum >= ondergrens && !verstuurd[m.sleutel] && !uitgezet.includes(m.type));
}

// Gegevens voor een handmatige mail van een bepaald type
export function handmatigeData(type, nu = vandaag()) {
  const d = dag(nu);
  const m = d.getUTCMonth(), j = d.getUTCFullYear();
  if (type === "kwartaal") {
    // Tot de 10e van de eerste maand van een kwartaal: het vorige kwartaal.
    // Daarna: het lopende kwartaal, aan te leveren begin volgend kwartaal.
    const huidigKw = Math.floor(m / 3);
    const vorige = m % 3 === 0 && d.getUTCDate() <= 10;
    const kw = vorige ? (huidigKw + 3) % 4 : huidigKw;
    const kwJaar = vorige && huidigKw === 0 ? j - 1 : j;
    const aanMaand = ((kw + 1) % 4) * 3;
    const deadlineDag = aanMaand === 3 ? 30 : 31;
    return { kwartaal: `${KW[kw]} kwartaal van ${kwJaar}`, aanleverdatum: `10 ${MAANDEN[aanMaand]}`, deadline: `${deadlineDag} ${MAANDEN[aanMaand]}` };
  }
  if (type === "inkomstenbelasting") return { jaar: String(m < 6 ? j - 1 : j), aanleverdatum: "1 april" };
  return {};
}

export function maakMail(k, type, data = {}) {
  const fn = mails[type];
  if (!fn) throw new Error("Onbekend mailtype");
  return fn({ naam: k.naam, wie: k.boekhouder, link: k.voorstelLink, ...data }, BASE);
}

// Versturen via Resend. env: (naam) => waarde
export async function verstuur(env, { aan, mail }) {
  const sleutel = env("RESEND_API_KEY");
  if (!sleutel) return { ok: false, fout: "RESEND_API_KEY ontbreekt in Netlify" };
  const van = env("MAIL_FROM") || "Avezaat & Evers <info@avezaatenevers.nl>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${sleutel}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: van, to: [aan], reply_to: "info@avezaatenevers.nl", subject: mail.subject, html: mail.html, text: mail.text }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, fout: body.message || `Resend gaf fout ${res.status}` };
  return { ok: true, id: body.id };
}
