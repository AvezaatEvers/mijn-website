// Planning en verzending van klantmails. Gedeeld door de interne omgeving
// (edge function) en de dagelijkse geplande functie (netlify/functions/geplande-mails.mjs).
import { mails } from "./functions/lib/mails.js";

export const BASE = "https://avezaatenevers.nl";

export const TYPES = {
  welkom: { label: "Welkomstmail", wanneer: "Handmatig, na het tekenen" },
  checkIn: { label: "Check-in na 2 weken", wanneer: "Automatisch, 14 dagen na de startdatum" },
  voorstelHerinnering: { label: "Herinnering voorstel", wanneer: "Automatisch 2 dagen na het voorstel, zolang de status Prospect is" },
  voorstel: { label: "Voorstel", wanneer: "Via de voorstelpagina" },
  kwartaal: { label: "Kwartaalherinnering btw", wanneer: "Automatisch, rond de 3e van januari, april, juli en oktober" },
  kwartaalTweede: { label: "Tweede herinnering btw", wanneer: "Automatisch rond de 8e, alleen als de stukken nog niet binnen zijn" },
  jaareinde: { label: "Jaareinde", wanneer: "Automatisch, 25 november" },
  inkomstenbelasting: { label: "Aangifte inkomstenbelasting", wanneer: "Automatisch, 2 maart" },
  review: { label: "Google-review vragen", wanneer: "Automatisch, 3 maanden na de startdatum" },
  aanbevelen: { label: "Aanbevelen", wanneer: "Automatisch, 2 weken na de eerste ingediende IB-aangifte, alleen bij tevreden klanten" },
  jubileum: { label: "Een jaar klant", wanneer: "Automatisch, 1 jaar na de startdatum" },
};
export const AUTOMATISCH = ["voorstelHerinnering", "checkIn", "kwartaal", "kwartaalTweede", "jaareinde", "inkomstenbelasting", "review", "aanbevelen", "jubileum"];
export const HANDMATIG = ["welkom", "voorstelHerinnering", "checkIn", "kwartaal", "kwartaalTweede", "jaareinde", "inkomstenbelasting", "review", "aanbevelen", "jubileum"];

const MAANDEN = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
const KW = ["1e", "2e", "3e", "4e"];

export function vandaag() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date());
}
function iso(d) { return d.toISOString().slice(0, 10); }
function dag(s) { return new Date(s + "T12:00:00Z"); }
export function plusDagen(s, n) { const d = dag(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
function plusMaanden(s, n) { const d = dag(s); d.setUTCMonth(d.getUTCMonth() + n); return iso(d); }
// Valt een datum in het weekend, dan de maandag erna
function mooieDatumKort(s) { const d = dag(s); return `${d.getUTCDate()} ${MAANDEN[d.getUTCMonth()]}`; }
function werkdag(s) { const d = dag(s); const w = d.getUTCDay(); if (w === 6) d.setUTCDate(d.getUTCDate() + 2); if (w === 0) d.setUTCDate(d.getUTCDate() + 1); return iso(d); }

// Kwartaal-sleutel ("2026-Q4") en gegevens voor de mails over dat kwartaal
export function kwartaalInfo(sleutel) {
  const [j, q] = sleutel.split("-Q").map(Number);
  const aanMaand = (q % 4) * 3; // maand waarin aangeleverd wordt (0 = januari)
  return { sleutel, kwartaal: `${KW[q - 1]} kwartaal van ${j}`, kort: `Q${q} ${j}`, aanleverdatum: `10 ${MAANDEN[aanMaand]}`, deadline: `${aanMaand === 3 ? 30 : 31} ${MAANDEN[aanMaand]}` };
}
// Het kwartaal waar nu aan gewerkt wordt: het vorige tot en met de deadline, daarna het lopende
export function actueelKwartaal(nu = vandaag()) {
  const j = Number(nu.slice(0, 4)), m = Number(nu.slice(5, 7)) - 1;
  const huidig = Math.floor(m / 3) + 1;
  const eersteMaand = m % 3 === 0;
  if (eersteMaand) return huidig === 1 ? `${j - 1}-Q4` : `${j}-Q${huidig - 1}`;
  return `${j}-Q${huidig}`;
}
export function kwartalenRond(nu = vandaag(), aantal = 6) {
  const lijst = [];
  let [j, q] = actueelKwartaal(nu).split("-Q").map(Number);
  q += 1; if (q > 4) { q = 1; j++; }
  for (let i = 0; i < aantal; i++) { q -= 1; if (q < 1) { q = 4; j--; } lijst.push(`${j}-Q${q}`); }
  return lijst;
}

// Alle momenten van een klant tussen twee jaren
function momenten(k, vanJaar, totJaar) {
  const uit = [];
  if (k.status === "prospect" && k.voorstel && k.voorstel.op) {
    const op = k.voorstel.op.slice(0, 10);
    uit.push({ type: "voorstelHerinnering", sleutel: `voorstelHerinnering-${op}`, datum: werkdag(plusDagen(op, 2)), data: { voorstelDatum: mooieDatumKort(op), start: (k.voorstel.data || {}).start || "" } });
  }
  if (k.status !== "klant") return uit;
  const pr = k.profiel || {};
  const start = k.start || (k.aangemaakt || "").slice(0, 10);
  if (start) {
    uit.push({ type: "checkIn", sleutel: "checkIn", datum: werkdag(plusDagen(start, 14)), data: {} });
    uit.push({ type: "review", sleutel: "review", datum: werkdag(plusMaanden(start, 3)), data: {} });
    uit.push({ type: "jubileum", sleutel: "jubileum-1", datum: werkdag(plusMaanden(start, 12)), data: {} });
  }
  // Aanbevelen: 2 weken na de eerste ingediende IB-aangifte, alleen tevreden klanten
  const ib = Object.values(k.ibIngediend || {}).sort()[0];
  if (ib && k.tevreden) uit.push({ type: "aanbevelen", sleutel: "aanbevelen", datum: werkdag(plusDagen(ib.slice(0, 10), 14)), data: {} });

  for (let j = vanJaar; j <= totJaar; j++) {
    if (!pr.kor) {
      [1, 4, 7, 10].forEach((maand) => {
        const q = maand === 1 ? 4 : (maand - 1) / 3;
        const kwJaar = maand === 1 ? j - 1 : j;
        const sleutel = `${kwJaar}-Q${q}`;
        const kwartaalEind = q === 4 ? `${kwJaar}-12-31` : `${kwJaar}-${String(q * 3).padStart(2, "0")}-28`;
        if (start && start > kwartaalEind) return; // nog geen klant in dat kwartaal
        const info = kwartaalInfo(sleutel);
        const mm = String(maand).padStart(2, "0");
        uit.push({ type: "kwartaal", sleutel: `kwartaal-${sleutel}`, datum: werkdag(`${j}-${mm}-03`), data: info, kw: sleutel });
        uit.push({ type: "kwartaalTweede", sleutel: `kwartaal2-${sleutel}`, datum: werkdag(`${j}-${mm}-08`), data: info, kw: sleutel });
      });
    }
    const jaareinde = werkdag(`${j}-11-25`);
    if (!start || start < jaareinde) uit.push({ type: "jaareinde", sleutel: `jaareinde-${j}`, datum: jaareinde, data: {} });
    const ibDatum = werkdag(`${j}-03-02`);
    if (!start || start < `${j}-01-01`) uit.push({ type: "inkomstenbelasting", sleutel: `ib-${j - 1}`, datum: ibDatum, data: { jaar: String(j - 1), aanleverdatum: "1 april" } });
  }
  return uit;
}

// Een tweede herinnering vervalt als de stukken van dat kwartaal binnen zijn
function vervalt(k, m, env) {
  if (m.type === "kwartaalTweede") return !!((k.kwartalen || {})[m.kw] || {}).binnen;
  if (m.type === "review") return env ? !env("REVIEW_LINK") : false;
  return false;
}

// Komende mails (niet verstuurd), oplopend
export function gepland(k, nu = vandaag(), aantal = 8, env) {
  const j = Number(nu.slice(0, 4));
  const verstuurd = k.verstuurd || {};
  const uitgezet = k.uit || [];
  return momenten(k, j, j + 1)
    .filter((m) => m.datum >= nu && !verstuurd[m.sleutel])
    .sort((a, b) => a.datum.localeCompare(b.datum))
    .slice(0, aantal)
    .map((m) => ({ ...m, label: TYPES[m.type].label, aan: !uitgezet.includes(m.type), vervalt: vervalt(k, m, env) }));
}

// Mails die vandaag (of de afgelopen 7 dagen, als een run is gemist) weg moeten
export function teVersturen(k, nu = vandaag(), env) {
  const j = Number(nu.slice(0, 4));
  const verstuurd = k.verstuurd || {};
  const uitgezet = k.uit || [];
  const ondergrens = plusDagen(nu, -7);
  return momenten(k, j - 1, j).filter((m) => m.datum <= nu && m.datum >= ondergrens && !verstuurd[m.sleutel] && !uitgezet.includes(m.type) && !vervalt(k, m, env));
}

// Gegevens voor een handmatige mail van een bepaald type
export function handmatigeData(type, nu = vandaag()) {
  if (type === "kwartaal" || type === "kwartaalTweede") return kwartaalInfo(actueelKwartaal(nu));
  const j = Number(nu.slice(0, 4)), m = Number(nu.slice(5, 7)) - 1;
  if (type === "inkomstenbelasting") return { jaar: String(m < 6 ? j - 1 : j), aanleverdatum: "1 april" };
  return {};
}

export function maakMail(k, type, data = {}, env = () => undefined) {
  const fn = mails[type];
  if (!fn) throw new Error("Onbekend mailtype");
  const pr = k.profiel || {};
  const vs = (k.voorstel && k.voorstel.op) ? { voorstelDatum: mooieDatumKort(k.voorstel.op.slice(0, 10)), start: (k.voorstel.data || {}).start || "" } : {};
  const extra = { ...(type === "voorstelHerinnering" ? vs : {}), icp: !!pr.icp, partner: pr.partner === false ? false : undefined, reviewLink: env("REVIEW_LINK") || "" };
  if (type === "jubileum") {
    const jaarGeleden = plusMaanden(vandaag(), -12);
    extra.btwAantal = Object.values(k.kwartalen || {}).filter((x) => x.ingediend && x.ingediend.slice(0, 10) >= jaarGeleden).length;
    extra.ib = Object.values(k.ibIngediend || {}).some((x) => x.slice(0, 10) >= jaarGeleden);
  }
  return fn({ naam: k.naam, wie: k.boekhouder, bedrijf: k.bedrijf, link: k.voorstelLink, ...extra, ...data }, BASE);
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
