// Klantcontact en tevredenheid: cijfers, trends en automatische adviezen.
import { vandaag, plusDagen } from "./klant-mails.js";

export const KANALEN = { whatsapp: "WhatsApp", gebeld: "Gebeld", mail: "Mail", gesprek: "Gesprek" };
export const ONDERWERPEN = { app: "App en MoneyMonk", bonnetjes: "Bonnetjes", facturen: "Facturen", btw: "Btw", ib: "IB-aangifte", belastingdienst: "Belastingdienst", prijs: "Prijs en factuur", overig: "Overig" };
export const SOORTEN = { vraag: "Vraag", probleem: "Probleem", klacht: "Klacht", compliment: "Compliment", verzoek: "Verzoek" };
export const GEVOEL = { blij: "Tevreden", neutraal: "Neutraal", boos: "Ontevreden" };

const TIPS = {
  app: "Maak een korte uitlegvideo van de app en zet die in de welkomstmail en de check-in.",
  bonnetjes: "Leg in de welkomstmail en op de welkomstpagina stap voor stap uit hoe je een bonnetje fotografeert en wat er wel en niet op moet staan.",
  facturen: "Zet een factuurvoorbeeld en de verplichte gegevens in de kennisbank, en link ernaar in de check-in.",
  btw: "Maak de kwartaalmail duidelijker: wat moet er precies in de app staan en wanneer.",
  ib: "Stuur bij de IB-mail een complete lijst met voorbeelden van jaaropgaven mee.",
  belastingdienst: "Maak een kennisbankartikel over brieven van de Belastingdienst: wat ze betekenen en wanneer je moet reageren.",
  prijs: "Zet in de opdrachtbevestiging nog duidelijker wat inbegrepen is en wat extra kost.",
  overig: "Kijk welke vragen onder Overig vallen en of er een nieuw onderwerp nodig is.",
};

const DAG = 864e5;
function dagenTussen(a, b) { return Math.round((Date.parse(b.slice(0, 10) + "T12:00:00Z") - Date.parse(a.slice(0, 10) + "T12:00:00Z")) / DAG); }
function week(iso) { const d = new Date(iso.slice(0, 10) + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }
const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);

export function npsScore(lijst) {
  if (!lijst.length) return { score: null, n: 0, promotors: 0, passief: 0, criticasters: 0 };
  const p = lijst.filter((x) => x.score >= 9).length, c = lijst.filter((x) => x.score <= 6).length;
  return { score: Math.round(((p - c) / lijst.length) * 100), n: lijst.length, promotors: p, passief: lijst.length - p - c, criticasters: c };
}

export function inzichten(klanten, wie, dagen = 90, nu = vandaag()) {
  const van = (k) => wie === "alle" || k.boekhouder === wie;
  const mijn = klanten.filter(van);
  const vanaf = plusDagen(nu, -dagen);
  const vorigeVanaf = plusDagen(nu, -2 * dagen);

  const alle = mijn.flatMap((k) => (k.contacten || []).map((c) => ({ ...c, klantId: k.id, klant: k.bedrijf || k.naam, boekhouder: k.boekhouder })));
  const contacten = alle.filter((c) => c.op.slice(0, 10) >= vanaf);
  const vorige = alle.filter((c) => c.op.slice(0, 10) >= vorigeVanaf && c.op.slice(0, 10) < vanaf);
  const n = contacten.length;
  const telBij = (lijst, veld, labels) => Object.keys(labels).map((s) => ({ sleutel: s, label: labels[s], aantal: lijst.filter((c) => c[veld] === s).length })).sort((a, b) => b.aantal - a.aantal);

  const inkomend = contacten.filter((c) => c.richting === "klant");
  const onderwerpen = Object.keys(ONDERWERPEN).map((s) => {
    const l = contacten.filter((c) => c.onderwerp === s);
    return { sleutel: s, label: ONDERWERPEN[s], aantal: l.length, vermijdbaar: l.filter((c) => c.vermijdbaar).length, nietOpgelost: l.filter((c) => c.opgelost === false).length };
  }).filter((o) => o.aantal).sort((a, b) => b.aantal - a.aantal);

  // Contact per week, laatste 12 weken
  const weken = [];
  for (let i = 11; i >= 0; i--) {
    const w = week(plusDagen(nu, -7 * i));
    weken.push({ week: w, aantal: alle.filter((c) => week(c.op) === w).length, inkomend: alle.filter((c) => week(c.op) === w && c.richting === "klant").length });
  }

  // NPS
  const npsAlle = mijn.flatMap((k) => (k.nps || []).map((x) => ({ ...x, klantId: k.id, klant: k.bedrijf || k.naam })));
  const npsPeriode = npsAlle.filter((x) => x.op.slice(0, 10) >= plusDagen(nu, -365));
  // Per klant telt alleen het laatste cijfer
  const laatstePerKlant = Object.values(npsPeriode.reduce((acc, x) => { if (!acc[x.klantId] || acc[x.klantId].op < x.op) acc[x.klantId] = x; return acc; }, {}));
  const npsMaanden = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(nu + "T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() - i);
    const m = d.toISOString().slice(0, 7);
    npsMaanden.push({ maand: m, ...npsScore(npsAlle.filter((x) => x.op.slice(0, 7) === m)) });
  }
  const verstuurdNps = mijn.reduce((s, k) => s + Object.entries(k.verstuurd || {}).filter(([sl, op]) => sl.startsWith("nps-") && op.slice(0, 10) >= plusDagen(nu, -365)).length, 0);
  const reacties = npsAlle.filter((x) => x.op.slice(0, 10) >= plusDagen(nu, -365)).length;

  // Per klant
  const perKlant = mijn.filter((k) => k.status === "klant").map((k) => {
    const c = (k.contacten || []).filter((x) => x.op.slice(0, 10) >= vanaf);
    const laatst = (k.contacten || []).map((x) => x.op).concat((k.tijdlijn || []).map((t) => t.op)).sort().pop();
    const nps = (k.nps || [])[0];
    return { id: k.id, naam: k.bedrijf || k.naam, boekhouder: k.boekhouder, aantal: c.length, problemen: c.filter((x) => ["probleem", "klacht"].includes(x.soort)).length,
      ontevreden: c.filter((x) => x.gevoel === "boos").length, laatst, stil: laatst ? dagenTussen(laatst, nu) : null, nps: nps ? nps.score : null };
  });

  const cijfers = {
    contacten: n, vorige: vorige.length, inkomend: inkomend.length,
    opgelost: pct(contacten.filter((c) => c.opgelost).length, contacten.filter((c) => c.opgelost != null).length),
    vermijdbaar: pct(contacten.filter((c) => c.vermijdbaar).length, n),
    tevreden: pct(contacten.filter((c) => c.gevoel === "blij").length, contacten.filter((c) => c.gevoel).length),
    ontevreden: contacten.filter((c) => c.gevoel === "boos").length,
    perKlant: perKlant.length ? Math.round((n / perKlant.length) * 10) / 10 : 0,
    nps: npsScore(laatstePerKlant), responsratio: pct(reacties, verstuurdNps),
  };

  // ---------- Adviezen ----------
  const adviezen = [];
  onderwerpen.forEach((o) => {
    if (o.aantal >= 3 && o.vermijdbaar / o.aantal >= 0.3) {
      adviezen.push({ prioriteit: 2 + (o.vermijdbaar >= 5 ? 1 : 0), titel: `${o.vermijdbaar} van de ${o.aantal} contacten over ${o.label.toLowerCase()} waren te voorkomen`, tekst: TIPS[o.sleutel], soort: "voorkomen" });
    }
  });
  if (onderwerpen[0] && n >= 6 && onderwerpen[0].aantal / n >= 0.35) {
    adviezen.push({ prioriteit: 2, titel: `${pct(onderwerpen[0].aantal, n)}% van al het contact gaat over ${onderwerpen[0].label.toLowerCase()}`, tekst: TIPS[onderwerpen[0].sleutel], soort: "patroon" });
  }
  if (cijfers.opgelost != null && n >= 6 && cijfers.opgelost < 75) {
    adviezen.push({ prioriteit: 2, titel: `Maar ${cijfers.opgelost}% wordt bij het eerste contact opgelost`, tekst: "Kijk welke onderwerpen vaak terugkomen zonder oplossing. Vaak helpt een vaste aanpak of een standaardantwoord om het in één keer af te handelen.", soort: "kwaliteit" });
  }
  perKlant.filter((k) => k.problemen >= 3).forEach((k) => adviezen.push({ prioriteit: 3, titel: `${k.naam} had ${k.problemen} problemen of klachten`, tekst: "Bel proactief en vraag wat er beter kan, voordat de klant zelf afhaakt.", soort: "klant", id: k.id }));
  perKlant.filter((k) => k.nps != null && k.nps <= 6).forEach((k) => adviezen.push({ prioriteit: 3, titel: `${k.naam} gaf een ${k.nps} voor tevredenheid`, tekst: "Criticasters die je snel belt, worden vaak juist trouwe klanten. Bel binnen 48 uur.", soort: "klant", id: k.id }));
  const stil = perKlant.filter((k) => k.stil != null && k.stil > 90);
  if (stil.length) adviezen.push({ prioriteit: 1, titel: `${stil.length} ${stil.length === 1 ? "klant is" : "klanten zijn"} al 3 maanden stil`, tekst: `Stil is niet altijd tevreden. Stuur een kort appje: ${stil.slice(0, 3).map((k) => k.naam).join(", ")}${stil.length > 3 ? " en meer" : ""}.`, soort: "klant" });
  const complimenten = mijn.filter((k) => (k.contacten || []).some((c) => c.soort === "compliment" && c.op.slice(0, 10) >= vanaf) && !(k.nps || []).length);
  if (complimenten.length) adviezen.push({ prioriteit: 1, titel: `${complimenten.length} ${complimenten.length === 1 ? "klant gaf" : "klanten gaven"} een compliment`, tekst: `Het perfecte moment om om een Google-review te vragen: ${complimenten.slice(0, 3).map((k) => k.bedrijf || k.naam).join(", ")}.`, soort: "kans" });
  if (verstuurdNps >= 5 && cijfers.responsratio != null && cijfers.responsratio < 30) {
    adviezen.push({ prioriteit: 1, titel: `Maar ${cijfers.responsratio}% reageert op de NPS-mail`, tekst: "Vraag het in een gesprek of appje direct na een goed geholpen vraag. Dan krijg je meer en eerlijkere antwoorden.", soort: "meten" });
  }
  const btwPiek = contacten.filter((c) => c.onderwerp === "btw" && [1, 4, 7, 10].includes(Number(c.op.slice(5, 7))) && Number(c.op.slice(8, 10)) <= 10).length;
  if (btwPiek >= 3) adviezen.push({ prioriteit: 1, titel: `${btwPiek} btw-vragen in de aanleverweek`, tekst: TIPS.btw, soort: "patroon" });
  if (n >= 4 && vorige.length >= 4 && n > vorige.length * 1.4) adviezen.push({ prioriteit: 1, titel: `${Math.round((n / vorige.length - 1) * 100)}% meer contact dan de periode ervoor`, tekst: "Kijk of dat komt door nieuwe klanten of door een terugkerend probleem.", soort: "patroon" });
  if (!n) adviezen.push({ prioriteit: 0, titel: "Nog geen contactmomenten vastgelegd", tekst: "Leg elk contact vast met de knop Contact vastleggen. Na een paar weken verschijnen hier de eerste patronen en adviezen.", soort: "start" });

  return {
    nu, wie, dagen, cijfers, weken,
    kanalen: telBij(contacten, "kanaal", KANALEN), soorten: telBij(contacten, "soort", SOORTEN), gevoel: telBij(contacten, "gevoel", GEVOEL),
    onderwerpen, npsMaanden, npsReacties: npsAlle.sort((a, b) => b.op.localeCompare(a.op)).slice(0, 12),
    klanten: perKlant.sort((a, b) => b.aantal - a.aantal).slice(0, 8),
    recent: contacten.sort((a, b) => b.op.localeCompare(a.op)).slice(0, 15),
    adviezen: adviezen.sort((a, b) => b.prioriteit - a.prioriteit),
  };
}
