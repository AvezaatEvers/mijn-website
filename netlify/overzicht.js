// Berekent het werkoverzicht: leads op warmte, wat aandacht nodig heeft, taken, geplande mails en kerncijfers.
// Alles wordt automatisch bepaald uit de klantgegevens; er wordt niets opgeslagen.
import { gepland, vandaag, plusDagen, actueelKwartaal, kwartaalInfo } from "./klant-mails.js";

const CONTACT = ["gebeld", "geappt", "gemaild", "gesprek"];
const DAG = 864e5;

function dagenSinds(iso, nu) { return iso ? Math.floor((Date.parse(nu + "T12:00:00Z") - Date.parse(iso.slice(0, 10) + "T12:00:00Z")) / DAG) : null; }
function urenSinds(iso) { return iso ? (Date.now() - Date.parse(iso)) / 36e5 : null; }

export function maandbedrag(k) {
  const d = (k.voorstel && k.voorstel.data) || {};
  const pr = k.profiel || {};
  return (Number(d.pakket) || 80) + (d.icp || pr.icp ? 15 : 0);
}

function laatsteContact(k) {
  const a = (k.tijdlijn || []).filter((t) => CONTACT.includes(t.soort)).map((t) => t.op);
  const b = (k.contacten || []).map((c) => c.op);
  return a.concat(b).sort().pop() || null;
}
function gesprekken(k) {
  return (k.tijdlijn || []).filter((t) => t.soort === "gesprek").map((t) => t.op)
    .concat((k.contacten || []).filter((c) => c.kanaal === "gesprek").map((c) => c.op)).sort();
}

// ---------- Leads ----------
export function leadInfo(k, nu = vandaag()) {
  const lead = k.lead || {};
  const tl = k.tijdlijn || [];
  const contact = laatsteContact(k);
  const gesprek = gesprekken(k).length > 0;
  const fase = k.voorstel ? "voorstel" : gesprek ? "gesprek" : contact ? "contact" : "nieuw";
  const sinds = lead.op || k.aangemaakt;
  const leeftijd = dagenSinds(sinds, nu) ?? 0;
  const uren = urenSinds(sinds) ?? 0;
  const redenen = [];
  let score = { nieuw: 30, contact: 40, gesprek: 55, voorstel: 60 }[fase];

  if (lead.bron === "kennismaking") { score += 15; redenen.push("Vroeg zelf om contact"); }
  if (lead.bron === "prijscheck") { score += 5; redenen.push(`Prijscheck${lead.prijs ? " " + lead.prijs : ""}`); }
  const sit = lead.situatie || "";
  const md = nu.slice(5);
  if (sit === "boekhouder") {
    score += 10; redenen.push("Wil overstappen");
    if (md >= "11-15" && md <= "12-15") { score += 10; redenen.push("Overstap per 1 januari"); }
  }
  if (sit === "achter") { score += 8; redenen.push("Administratie loopt achter"); }
  if (sit === "start") { score += 5; redenen.push("Net gestart"); }
  if (/€\s?(9\d|1\d\d)/.test(lead.prijs || "")) score += 5;
  // Zelf een kennismaking ingepland via Cal.com (netlify/functions/cal-webhook.mjs)
  const afspraak = k.afspraak && k.afspraak.status !== "geannuleerd" && k.afspraak.start ? k.afspraak : null;
  if (afspraak && (fase === "nieuw" || fase === "contact")) { score += 15; redenen.push("Plande zelf een kennismaking"); }

  if (leeftijd < 1) { score += 15; redenen.push("Vandaag binnen"); }
  else if (leeftijd < 3) score += 8;
  else if (leeftijd >= 14 && fase !== "voorstel") { score -= leeftijd >= 30 ? 25 : 10; redenen.push(`${leeftijd} dagen oud`); }

  let voorstelDagen = null;
  if (k.voorstel) {
    voorstelDagen = dagenSinds(k.voorstel.op, nu);
    if (voorstelDagen <= 3) score += 10;
    else if (voorstelDagen <= 7) score += 3;
    else if (voorstelDagen <= 14) score -= 10;
    else score -= 25;
    redenen.push(voorstelDagen === 0 ? "Voorstel vandaag verstuurd" : `Voorstel ${voorstelDagen} ${voorstelDagen === 1 ? "dag" : "dagen"} open`);
  }
  const contactDagen = dagenSinds(contact, nu);
  if (contact && contactDagen <= 3) score += 5;
  if (!contact && leeftijd > 7) score -= 10;

  score = Math.max(0, Math.min(100, Math.round(score)));
  const label = score >= 70 ? "Heet" : score >= 50 ? "Warm" : score >= 30 ? "Lauw" : "Koud";

  // Volgende stap
  let actie = "", urgent = false;
  if (afspraak && (fase === "nieuw" || fase === "contact")) {
    const wanneer = new Date(afspraak.start).toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    actie = afspraak.start > new Date().toISOString() ? "Kennismaking gepland: " + wanneer : "Kennismaking geweest? Leg het gesprek vast";
  } else if (fase === "nieuw") {
    if (leeftijd > 7) actie = "Nog één poging, of op verloren zetten";
    else if (uren > 2) { actie = "Reactie te laat: bel of app nu"; urgent = true; }
    else { actie = "Bel of app binnen 2 uur"; urgent = true; }
  } else if (fase === "contact") actie = "Plan de kennismaking";
  else if (fase === "gesprek") {
    const g = gesprekken(k).pop();
    const d = dagenSinds(g, nu);
    actie = "Stuur het voorstel"; urgent = d >= 2;
  } else if (fase === "voorstel") {
    if (voorstelDagen < 2) actie = "Herinnering gaat automatisch over " + (2 - voorstelDagen) + (2 - voorstelDagen === 1 ? " dag" : " dagen");
    else if (voorstelDagen <= 7) { actie = "Bel even na over het voorstel"; urgent = voorstelDagen >= 4; }
    else if (voorstelDagen <= 14) actie = "Laatste poging, of op verloren zetten";
    else actie = "Op verloren zetten?";
  }
  return { fase, score, label, redenen: redenen.slice(0, 4), actie, urgent, leeftijd };
}

// ---------- Aandacht bij klanten ----------
function iso(j, m, d) { return `${j}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }
function btwData(sleutel) {
  const [j, q] = sleutel.split("-Q").map(Number);
  const jaar = q === 4 ? j + 1 : j, maand = (q % 4) * 3 + 1;
  return { start: iso(jaar, maand, 1), aanlever: iso(jaar, maand, 10), deadline: iso(jaar, maand, maand === 4 ? 30 : 31) };
}

export function aandachtVoor(k, nu = vandaag(), env) {
  const uit = [];
  const log = k.log || [];
  const naam = k.bedrijf || k.naam;
  if (k.status === "klant") {
    if (!log.some((l) => l.type === "welkom" && l.ok && !l.test)) uit.push({ ernst: 2, tekst: "Welkomstmail nog niet verstuurd", actie: "Versturen" });
    if (!k.start) uit.push({ ernst: 1, tekst: "Startdatum ontbreekt, dus geen check-in en jubileum", actie: "Invullen" });
    if (!(k.profiel || {}).kor) {
      const kw = actueelKwartaal(nu), d = btwData(kw), st = (k.kwartalen || {})[kw] || {}, info = kwartaalInfo(kw);
      if (nu >= d.start && (!k.start || k.start <= d.start)) {
        if (!st.binnen && nu > d.aanlever) uit.push({ ernst: 3, tekst: `Btw ${info.kort}: stukken nog niet binnen (deadline ${info.deadline})`, actie: "Spoedtoeslag? Bel even" });
        else if (!st.binnen && nu >= plusDagen(d.aanlever, -4)) uit.push({ ernst: 1, tekst: `Btw ${info.kort}: stukken nog niet binnen (uiterlijk ${info.aanleverdatum})`, actie: "Afwachten" });
        if (st.binnen && !st.ingediend && nu >= plusDagen(d.deadline, -7)) uit.push({ ernst: 3, tekst: `Btw ${info.kort}: aangifte nog niet ingediend, deadline ${info.deadline}`, actie: "Indienen" });
      }
    }
    const laatst = laatsteContact(k) || k.start || k.aangemaakt;
    const stil = dagenSinds(laatst, nu);
    if (stil != null && stil > 60) uit.push({ ernst: 1, tekst: `${stil} dagen geen contact genoteerd`, actie: "Plan een maandgesprek" });
  }
  const laatsteNps = (k.nps || [])[0];
  if (laatsteNps && laatsteNps.score <= 6 && dagenSinds(laatsteNps.op, nu) <= 30 && !((laatsteContact(k) || "") > laatsteNps.op)) {
    uit.push({ ernst: 3, tekst: `Gaf een ${laatsteNps.score} voor tevredenheid${laatsteNps.reden ? `: "${laatsteNps.reden.slice(0, 80)}"` : ""}`, actie: "Bel binnen 48 uur" });
  }
  const klachten = (k.contacten || []).filter((c) => ["klacht", "probleem"].includes(c.soort) && dagenSinds(c.op, nu) <= 30).length;
  if (klachten >= 3) uit.push({ ernst: 2, tekst: `${klachten} problemen of klachten in 30 dagen`, actie: "Bel proactief" });
  const fout = log.find((l) => !l.ok && !l.test);
  if (fout && dagenSinds(fout.op, nu) <= 7) uit.push({ ernst: 3, tekst: `Mail niet verstuurd: ${fout.onderwerp}`, actie: "Bekijk de fout" });
  return uit.map((a) => ({ ...a, id: k.id, naam, boekhouder: k.boekhouder }));
}

// ---------- Totaal ----------
export function overzicht(klanten, taken, wie, nu = vandaag(), env = () => undefined) {
  const van = (k) => wie === "alle" || k.boekhouder === wie || !k.boekhouder;
  const mijn = klanten.filter(van);

  const leads = mijn.filter((k) => k.status === "prospect").map((k) => ({
    id: k.id, naam: k.naam, bedrijf: k.bedrijf, telefoon: k.telefoon, email: k.email, boekhouder: k.boekhouder,
    bron: (k.lead || {}).bron || (k.voorstel ? "voorstel" : "handmatig"), ...leadInfo(k, nu),
  })).sort((a, b) => (b.urgent - a.urgent) || (b.score - a.score));

  const aandacht = mijn.flatMap((k) => aandachtVoor(k, nu, env)).sort((a, b) => b.ernst - a.ernst);
  if (!env("REVIEW_LINK") && mijn.some((k) => gepland(k, nu, 8, env).some((m) => m.type === "review" && m.vervalt))) {
    aandacht.push({ ernst: 1, tekst: "Reviewmails wachten op REVIEW_LINK in Netlify", actie: "Link toevoegen", id: null, naam: "Instelling" });
  }

  const week = plusDagen(nu, 7);
  const mailsDezeWeek = mijn.flatMap((k) => gepland(k, nu, 8, env)
    .filter((m) => m.datum <= week && m.aan && !m.vervalt)
    .map((m) => ({ id: k.id, naam: k.bedrijf || k.naam, datum: m.datum, label: m.label, type: m.type })))
    .sort((a, b) => a.datum.localeCompare(b.datum));

  const open = (taken || []).filter((t) => !t.klaar && (wie === "alle" || t.voor === wie || t.voor === "samen"));
  const takenLijst = {
    teLaat: open.filter((t) => t.deadline && t.deadline < nu),
    vandaag: open.filter((t) => t.deadline === nu),
    dezeWeek: open.filter((t) => t.deadline && t.deadline > nu && t.deadline <= week),
    zonderDatum: open.filter((t) => !t.deadline).length,
  };

  const actief = mijn.filter((k) => k.status === "klant");
  const dertig = plusDagen(nu, -30), negentig = plusDagen(nu, -90);
  const nieuweLeads = mijn.filter((k) => ((k.lead || {}).op || k.aangemaakt || "").slice(0, 10) >= dertig && (k.lead || k.status === "prospect" || k.klantOp)).length;
  const cohort = mijn.filter((k) => (k.lead || k.voorstel) && ((k.lead || {}).op || (k.voorstel || {}).op || k.aangemaakt || "").slice(0, 10) >= negentig);
  const gewonnen = cohort.filter((k) => k.status === "klant").length;
  const cijfers = {
    klanten: actief.length,
    mrr: actief.reduce((s, k) => s + maandbedrag(k), 0),
    prospects: leads.length,
    pijplijn: mijn.filter((k) => k.status === "prospect" && k.voorstel).reduce((s, k) => s + maandbedrag(k), 0),
    nieuweLeads,
    conversie: cohort.length ? Math.round((gewonnen / cohort.length) * 100) : null,
    cohort: cohort.length,
    perBoekhouder: { koen: klanten.filter((k) => k.status === "klant" && k.boekhouder === "koen").length, daan: klanten.filter((k) => k.status === "klant" && k.boekhouder === "daan").length },
  };

  return { nu, wie, leads, aandacht, mailsDezeWeek, taken: takenLijst, cijfers };
}
