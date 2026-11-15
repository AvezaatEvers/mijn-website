// De A&E-agent: een assistent die Koen en Daan door hun werk leidt.
// Gratis: denkt mee via Google Gemini (gratis tier, env GEMINI_API_KEY) met jullie data en het web.
// Zonder sleutel of bij een storing antwoordt de lokale agent (kennisbank, werkstromen, klanten, dagbriefing).
import { zoekKennis } from "./kennis.js";
import { PROCESSEN, GROEPEN, proces } from "./processen.js";
import { synchroniseer, dagplan, verwerkMissie, GIDS } from "./dagplan.js";
import { TYPES, HANDMATIG } from "../klant-mails.js";
import { KANALEN, ONDERWERPEN, SOORTEN, GEVOEL } from "../inzichten.js";

const WERK = "werkstromen";
const NAMEN = { koen: "Koen", daan: "Daan" };
const enc = new TextEncoder();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
function id() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function schoon(t, n = 200) { return String(t || "").replace(/[<>]/g, "").trim().slice(0, n); }
function datumOk(d) { return /^\d{4}-\d{2}-\d{2}$/.test(d || "") ? d : ""; }

async function leesRuns(store) { const r = await store.get(WERK, { type: "json" }); return Array.isArray(r) ? r : []; }

function voortgang(run) {
  const p = proces(run.proces); if (!p) return null;
  const klaar = p.stappen.filter((_, i) => (run.stappen || {})[i]).length;
  return { ...run, titel: p.titel, groep: p.groep, totaal: p.stappen.length, klaar };
}

// ---------- Werkstromen-API ----------
async function werkstromenApi(request, url, pad, wie, store, h) {
  const runs = await leesRuns(store);
  const klanten = await h.leesKlanten(store);
  if (synchroniseer(klanten, runs, h.vandaag())) await store.setJSON(WERK, runs);
  const naamVan = (kid) => { const k = klanten.find((x) => x.id === kid); return k ? (k.bedrijf || k.naam) : null; };
  const metNaam = (r) => ({ ...voortgang(r), klantNaam: r.klant ? naamVan(r.klant) : null });

  if (request.method === "GET") {
    return json({ groepen: GROEPEN, processen: PROCESSEN, lopend: runs.filter((r) => !r.klaarOp).map(metNaam).filter(Boolean),
      afgerond: runs.filter((r) => r.klaarOp).slice(-20).reverse().map(metNaam).filter(Boolean) });
  }
  const body = request.method === "DELETE" ? Object.fromEntries(url.searchParams) : await request.json().catch(() => ({}));
  if (request.method === "POST") {
    const r = startRun(runs, body.proces, body.klant, wie, klanten);
    if (r.fout) return json(r, 400);
    await store.setJSON(WERK, runs);
    return json(metNaam(r));
  }
  const run = runs.find((r) => r.id === body.id);
  if (!run) return json({ fout: "Werkstroom niet gevonden" }, 404);
  if (request.method === "PATCH") {
    const p = proces(run.proces);
    const i = Number(body.stap);
    if (Number.isInteger(i) && i >= 0 && i < p.stappen.length) {
      run.stappen = run.stappen || {};
      if (body.klaar) run.stappen[i] = { door: wie, op: new Date().toISOString() }; else delete run.stappen[i];
    }
    const alles = p.stappen.every((_, j) => run.stappen && run.stappen[j]);
    run.klaarOp = alles ? (run.klaarOp || new Date().toISOString()) : null;
    await store.setJSON(WERK, runs);
    return json(metNaam(run));
  }
  if (request.method === "DELETE") {
    runs.splice(runs.indexOf(run), 1);
    await store.setJSON(WERK, runs);
    return json({ ok: true });
  }
  return json({ fout: "Methode niet toegestaan" }, 405);
}

function startRun(runs, procesId, klantId, wie, klanten) {
  const p = proces(procesId);
  if (!p) return { fout: "Onbekende werkstroom" };
  const klant = klantId && klanten.find((k) => k.id === klantId) ? klantId : null;
  const dubbel = runs.find((r) => !r.klaarOp && r.proces === p.id && r.klant === klant && (klant || r.wie === wie));
  if (dubbel) return dubbel;
  const r = { id: id(), proces: p.id, klant, wie, gestart: new Date().toISOString(), stappen: {}, klaarOp: null };
  runs.push(r);
  return r;
}

// ---------- Context voor de agent ----------
function kortKlant(k) {
  return { id: k.id, naam: k.naam, bedrijf: k.bedrijf || null, status: k.status, boekhouder: NAMEN[k.boekhouder] || "nog niemand" };
}

function klantDetails(k, h, taken, runs) {
  const nps = (k.nps || []).slice(-3);
  return {
    ...kortKlant(k), email: k.email, telefoon: k.telefoon, start: k.start || null, klantSinds: k.klantOp || null,
    profiel: k.profiel || {}, tevreden: !!k.tevreden, notitie: schoon(k.notitie, 600),
    lead: k.status === "prospect" ? h.leadInfo(k) : null,
    voorstel: k.voorstel ? { op: k.voorstel.op, bedrag: k.voorstel.totaal || k.voorstel.bedrag || null } : null,
    contacten: (k.contacten || []).slice(0, 8).map((c) => ({ datum: c.op, kanaal: c.kanaal, richting: c.richting, onderwerp: c.onderwerp, soort: c.soort, opgelost: c.opgelost, gevoel: c.gevoel, notitie: schoon(c.notitie, 200) })),
    nps: nps.map((n) => ({ score: n.score, reden: schoon(n.reden, 200), op: n.op })),
    kwartalen: k.kwartalen || {},
    ibIngediend: k.ib || {},
    geplandeMails: (h.gepland(k) || []).filter((m) => m.aan).slice(0, 5).map((m) => ({ datum: m.datum, mail: m.label })),
    openTaken: taken.filter((t) => !t.klaar && t.klant === k.id).map((t) => ({ titel: t.titel, deadline: t.deadline })),
    lopendeWerkstromen: runs.filter((r) => !r.klaarOp && r.klant === k.id).map((r) => { const v = voortgang(r); return v && { titel: v.titel, klaar: v.klaar, totaal: v.totaal }; }).filter(Boolean),
    link: "/intern/klant.html?id=" + k.id,
  };
}

function dagSamenvatting(o) {
  return {
    datum: o.nu,
    cijfers: o.cijfers,
    leads: o.leads.slice(0, 8).map((l) => ({ id: l.id, naam: l.bedrijf || l.naam, score: l.score, label: l.label, fase: l.fase, actie: l.actie, urgent: l.urgent })),
    aandacht: o.aandacht.slice(0, 10).map((a) => ({ id: a.id, naam: a.naam, tekst: a.tekst, actie: a.actie, ernst: a.ernst })),
    taken: { teLaat: o.taken.teLaat.map((t) => t.titel), vandaag: o.taken.vandaag.map((t) => t.titel), dezeWeek: o.taken.dezeWeek.map((t) => t.titel + " (" + t.deadline + ")"), zonderDatum: o.taken.zonderDatum },
    mailsKomendeWeek: o.mailsDezeWeek.slice(0, 10).map((m) => m.datum + ": " + m.label + " naar " + m.naam),
  };
}

// ---------- Tools ----------
const TOOLS = [
  { name: "dagoverzicht", description: "Het werkoverzicht van vandaag: leads met warmtescore en volgende actie, klanten die aandacht nodig hebben, taken, mails die deze week automatisch gaan en de kerncijfers. Gebruik dit voor vragen over de dag, prioriteiten of planning.",
    input_schema: { type: "object", properties: { wie: { type: "string", enum: ["ik", "koen", "daan", "alle"], description: "Voor wie. Standaard 'ik'." } } } },
  { name: "zoek_klanten", description: "Zoek klanten en leads op naam, bedrijf of e-mail. Leeg zoeken geeft de hele lijst (max 25).",
    input_schema: { type: "object", properties: { zoek: { type: "string" }, status: { type: "string", enum: ["klant", "prospect", "gestopt", "verloren", "alle"] } } } },
  { name: "klant_details", description: "Alles over één klant of lead: profiel, contactmomenten, NPS, kwartaalstatus, geplande mails, taken en werkstromen.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "kennis_zoeken", description: "Zoek in onze kennisbank: boekhouden (boeken, open posten, memoriaal, bankimport), btw (aangifte, KOR, ICP, verlegd, factuureisen), inkomstenbelasting (ondernemersaftrek, KIA, afschrijven, auto), onze tarieven, voorwaarden en werkwijze met MoneyMonk. Gebruik dit ALTIJD bij een inhoudelijke boekhoud-, belasting- of klantvraag, desnoods meerdere keren met andere woorden.",
    input_schema: { type: "object", properties: { vraag: { type: "string" } }, required: ["vraag"] } },
  { name: "werkstroom_info", description: "Onze vaste werkstromen (processen) met stappen: dagstart, dagafsluiting, weekstart, nieuwe lead, kennismaking, voorstel opvolgen, onboarding, overstap, maandverwerking, btw-kwartaal, IB-aangifte, jaareinde, klantvraag, klacht, promoters, maandgesprek, offboarding, eigen facturatie, eigen administratie, kennisbankartikel. Zonder id: de lijst. Met id: alle stappen.",
    input_schema: { type: "object", properties: { id: { type: "string" } } } },
  { name: "lopende_werkstromen", description: "Werkstromen die nu lopen, met voortgang en (indien van toepassing) de klant.",
    input_schema: { type: "object", properties: {} } },
  { name: "werkstroom_starten", description: "Start een werkstroom, eventueel voor een klant. Alleen doen als de gebruiker daarom vraagt of er duidelijk mee instemt.",
    input_schema: { type: "object", properties: { proces: { type: "string" }, klant_id: { type: "string" } }, required: ["proces"] } },
  { name: "taak_toevoegen", description: "Zet een taak op de gedeelde takenlijst. Alleen doen als de gebruiker daarom vraagt of er duidelijk mee instemt.",
    input_schema: { type: "object", properties: { titel: { type: "string" }, deadline: { type: "string", description: "JJJJ-MM-DD" }, voor: { type: "string", enum: ["koen", "daan", "samen"] }, klant_id: { type: "string" } }, required: ["titel"] } },
  { name: "contact_inzichten", description: "Inzichten uit vastgelegd klantcontact en NPS: aantallen, % opgelost, % vermijdbaar, NPS, onderwerpen en automatische adviezen.",
    input_schema: { type: "object", properties: { dagen: { type: "number", enum: [30, 90, 365] } } } },
  // ---- Acties (wijzigingen) ----
  { name: "klant_toevoegen", description: "Stel voor een nieuwe klant of lead toe te voegen. Wordt pas opgeslagen als de gebruiker op Bevestigen klikt. Naam en e-mailadres zijn verplicht; vraag ze na als ze ontbreken.",
    input_schema: { type: "object", properties: { naam: { type: "string", description: "Naam contactpersoon" }, bedrijf: { type: "string" }, email: { type: "string" }, telefoon: { type: "string" },
      status: { type: "string", enum: ["klant", "prospect"], description: "prospect = lead" }, boekhouder: { type: "string", enum: ["koen", "daan"] }, start: { type: "string", description: "Startdatum JJJJ-MM-DD" },
      notitie: { type: "string" }, branche: { type: "string" }, kor: { type: "boolean" }, icp: { type: "boolean" }, partner: { type: "boolean" } }, required: ["naam", "email"] } },
  { name: "klant_bijwerken", description: "Stel een wijziging voor aan een bestaande klant of lead: status (klant, prospect, gestopt, verloren), contactgegevens, boekhouder, startdatum, notitie of fiscaal profiel. Wordt pas opgeslagen na Bevestigen.",
    input_schema: { type: "object", properties: { klant_id: { type: "string" }, naam: { type: "string" }, bedrijf: { type: "string" }, email: { type: "string" }, telefoon: { type: "string" },
      status: { type: "string", enum: ["klant", "prospect", "gestopt", "verloren"] }, boekhouder: { type: "string", enum: ["koen", "daan"] }, start: { type: "string", description: "JJJJ-MM-DD" },
      notitie: { type: "string", description: "Vervangt de vaste notitie" }, branche: { type: "string" }, kor: { type: "boolean" }, icp: { type: "boolean" }, partner: { type: "boolean" }, urencriterium: { type: "boolean" }, tevreden: { type: "boolean" } }, required: ["klant_id"] } },
  { name: "mail_versturen", description: "Stel voor een mail naar een klant te sturen: een vast sjabloon (welkom, checkIn, nps, kwartaal, kwartaalTweede, jaareinde, inkomstenbelasting, review, aanbevelen, jubileum, voorstelHerinnering) of type 'bericht' met een eigen onderwerp en tekst in onze huisstijl. De mail gaat pas na Bevestigen; de gebruiker kan eerst een voorbeeld zien. Schrijf bij 'bericht' in je-vorm, kort, zonder aanhef en zonder afsluiting (die voegt het sjabloon toe).",
    input_schema: { type: "object", properties: { klant_id: { type: "string" }, type: { type: "string", enum: [...HANDMATIG, "bericht"] }, onderwerp: { type: "string" }, tekst: { type: "string", description: "Alleen bij type bericht. Alinea's scheiden met een lege regel." } }, required: ["klant_id", "type"] } },
  { name: "contact_vastleggen", description: "Leg direct een contactmoment met een klant vast (telt mee voor de inzichten en NPS-adviezen).",
    input_schema: { type: "object", properties: { klant_id: { type: "string" }, kanaal: { type: "string", enum: Object.keys(KANALEN) }, richting: { type: "string", enum: ["klant", "wij"], description: "klant = de klant nam contact op" },
      onderwerp: { type: "string", enum: Object.keys(ONDERWERPEN) }, soort: { type: "string", enum: Object.keys(SOORTEN) }, opgelost: { type: "boolean" }, gevoel: { type: "string", enum: Object.keys(GEVOEL) },
      vermijdbaar: { type: "boolean" }, notitie: { type: "string" } }, required: ["klant_id"] } },
  { name: "notitie_toevoegen", description: "Zet direct een notitie op de tijdlijn van een klant.",
    input_schema: { type: "object", properties: { klant_id: { type: "string" }, tekst: { type: "string" }, soort: { type: "string", enum: ["notitie", "gebeld", "geappt", "gemaild", "gesprek"] } }, required: ["klant_id", "tekst"] } },
  { name: "taak_afvinken", description: "Vink direct een open taak af. Geef (een deel van) de titel.",
    input_schema: { type: "object", properties: { titel: { type: "string" } }, required: ["titel"] } },
  { name: "mail_ontwerpen", description: "Ontwerp zelf een complete mail in onze huisstijl en zet hem klaar om te versturen via Resend (na Bevestigen). Gebruik dit voor nieuwsbrieven, uitleg, aanbiedingen, herinneringen op maat of elke mail die meer nodig heeft dan een paar alinea's. Bouw de mail op uit blokken. Ontvanger: een bestaande klant (klant_id) of een los e-mailadres (aan_email + aan_naam).",
    input_schema: { type: "object", properties: {
      klant_id: { type: "string" }, aan_email: { type: "string" }, aan_naam: { type: "string" },
      onderwerp: { type: "string" }, preheader: { type: "string", description: "Korte voorbeeldtekst die mailprogramma's naast het onderwerp tonen" },
      aanhef: { type: "boolean", description: "Standaard true: begint met 'Hoi <voornaam>,'" },
      blokken: { type: "array", description: "De inhoud van boven naar beneden. Afsluiting met foto en het WhatsApp-blok worden automatisch toegevoegd.", items: { type: "object", properties: {
        type: { type: "string", enum: ["kop", "tussenkop", "alinea", "lijst", "stappen", "blok", "tabel", "knop"], description: "kop = grote titel; tussenkop = kleine kop; alinea = tekst (**vet** mag); lijst = vinkjeslijst; stappen = genummerde stappen ('Titel: uitleg'); blok = uitgelicht kader; tabel = regels 'Label: waarde'; knop = knop met link" },
        tekst: { type: "string" }, items: { type: "array", items: { type: "string" } }, label: { type: "string" }, url: { type: "string", description: "https://, mailto: of tel:" } }, required: ["type"] } } },
      required: ["onderwerp", "blokken"] } },
];

const LABELS = {
  dagoverzicht: "Bekijkt je dag", zoek_klanten: "Zoekt klanten", klant_details: "Opent klantdossier", kennis_zoeken: "Zoekt in de kennisbank",
  werkstroom_info: "Pakt de werkstroom erbij", lopende_werkstromen: "Bekijkt lopende werkstromen", werkstroom_starten: "Start werkstroom",
  taak_toevoegen: "Zet taak klaar", contact_inzichten: "Analyseert klantcontact",
  klant_toevoegen: "Bereidt nieuwe klant voor", klant_bijwerken: "Bereidt wijziging voor", mail_versturen: "Stelt mail op",
  contact_vastleggen: "Legt contact vast", mail_ontwerpen: "Ontwerpt mail", notitie_toevoegen: "Zet notitie op de tijdlijn", taak_afvinken: "Vinkt taak af",
};

async function voerUit(naam, input, c) {
  const { store, wie, h, stuur } = c;
  const klanten = c.klanten || (c.klanten = await h.leesKlanten(store));
  const taken = c.taken || (c.taken = await h.leesTaken(store));
  const runs = c.runs || (c.runs = await leesRuns(store));
  input = input || {};
  switch (naam) {
    case "dagoverzicht": {
      const voor = input.wie && input.wie !== "ik" ? input.wie : wie;
      return dagSamenvatting(h.overzicht(klanten, taken, voor));
    }
    case "zoek_klanten": {
      const q = String(input.zoek || "").toLowerCase().trim();
      const st = input.status && input.status !== "alle" ? input.status : null;
      return klanten.filter((k) => (!st || k.status === st) && (!q || [k.naam, k.bedrijf, k.email].join(" ").toLowerCase().includes(q))).slice(0, 25).map(kortKlant);
    }
    case "klant_details": {
      const k = klanten.find((x) => x.id === input.id);
      if (!k) return { fout: "Klant niet gevonden. Gebruik eerst zoek_klanten." };
      stuur({ t: "klant", id: k.id, naam: k.bedrijf || k.naam });
      return klantDetails(k, h, taken, runs);
    }
    case "kennis_zoeken": {
      const r = zoekKennis(input.vraag, 5);
      stuur({ t: "bronnen", v: r.map((x) => ({ titel: x.titel, bron: x.bron, groep: x.groep })) });
      return r.length ? r.map((x) => ({ titel: x.titel, bron: x.bron, tekst: x.tekst.slice(0, 1100) })) : { resultaat: "Niets gevonden. Probeer andere woorden of zeg eerlijk dat het niet in de kennisbank staat." };
    }
    case "werkstroom_info": {
      if (!input.id) return PROCESSEN.map((p) => ({ id: p.id, titel: p.titel, groep: p.groep, wanneer: p.wanneer, perKlant: !!p.perKlant }));
      const p = proces(input.id);
      if (!p) return { fout: "Onbekende werkstroom", ids: PROCESSEN.map((x) => x.id) };
      stuur({ t: "werkstroom", id: p.id, titel: p.titel });
      return { ...p, link: "/intern/werkstromen.html?p=" + p.id };
    }
    case "lopende_werkstromen":
      return runs.filter((r) => !r.klaarOp).map((r) => { const v = voortgang(r); const k = klanten.find((x) => x.id === r.klant); return v && { id: r.id, titel: v.titel, klant: k ? (k.bedrijf || k.naam) : null, klaar: v.klaar, totaal: v.totaal, gestart: r.gestart.slice(0, 10), door: NAMEN[r.wie] }; }).filter(Boolean);
    case "werkstroom_starten": {
      const r = startRun(runs, input.proces, input.klant_id, wie, klanten);
      if (r.fout) return r;
      await store.setJSON(WERK, runs);
      const v = voortgang(r);
      stuur({ t: "actie", soort: "werkstroom", tekst: "Werkstroom gestart: " + v.titel, link: "/intern/werkstromen.html?run=" + r.id });
      return { ok: true, id: r.id, titel: v.titel, link: "/intern/werkstromen.html?run=" + r.id };
    }
    case "taak_toevoegen": {
      const titel = schoon(input.titel);
      if (!titel) return { fout: "Titel ontbreekt" };
      const klant = input.klant_id && klanten.find((k) => k.id === input.klant_id) ? input.klant_id : null;
      const t = { id: id(), titel, notitie: "", deadline: datumOk(input.deadline), voor: ["koen", "daan", "samen"].includes(input.voor) ? input.voor : wie,
        klaar: false, klaarDoor: null, klaarOp: null, door: wie, aangemaakt: new Date().toISOString(), klant, viaAgent: true };
      taken.push(t);
      await h.bewaarTaken(store, taken);
      stuur({ t: "actie", soort: "taak", tekst: "Taak toegevoegd: " + titel + (t.deadline ? " (" + t.deadline + ")" : ""), link: "/intern/" });
      return { ok: true, taak: t };
    }
    case "klant_toevoegen": {
      const email = String(input.email || "").trim().toLowerCase();
      if (!input.naam || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { fout: "Naam en een geldig e-mailadres zijn nodig. Vraag ze na." };
      const dubbel = klanten.find((k) => (k.email || "").toLowerCase() === email);
      if (dubbel) return { fout: "Er bestaat al een klant met dit e-mailadres", klant: kortKlant(dubbel) };
      const body = { naam: schoon(input.naam), bedrijf: schoon(input.bedrijf || ""), email, telefoon: schoon(input.telefoon || "", 30), status: input.status === "prospect" ? "prospect" : "klant",
        boekhouder: ["koen", "daan"].includes(input.boekhouder) ? input.boekhouder : wie, start: datumOk(input.start), notitie: schoon(input.notitie || "", 2000) };
      const pr = {}; ["kor", "icp", "partner"].forEach((x) => { if (typeof input[x] === "boolean") pr[x] = input[x]; }); if (input.branche) pr.branche = schoon(input.branche, 60);
      if (Object.keys(pr).length) body.profiel = pr;
      const regels = [["Naam", body.naam], ["Bedrijf", body.bedrijf], ["E-mail", body.email], ["Telefoon", body.telefoon], ["Status", body.status === "prospect" ? "Lead" : "Klant"], ["Boekhouder", NAMEN[body.boekhouder]], ["Start", body.start], ["Branche", pr.branche], ["Notitie", body.notitie]].filter((r) => r[1]);
      stuur({ t: "bevestig", id: id(), titel: body.status === "prospect" ? "Nieuwe lead toevoegen" : "Nieuwe klant toevoegen", regels, knop: "Toevoegen", klaar: "Toegevoegd",
        verzoek: { method: "POST", url: "/intern/api/klanten", body } });
      return { status: "Wacht op bevestiging van de gebruiker (knop Toevoegen in de kaart). Nog niet opgeslagen." };
    }
    case "klant_bijwerken": {
      const k = klanten.find((x) => x.id === input.klant_id);
      if (!k) return { fout: "Klant niet gevonden. Gebruik eerst zoek_klanten." };
      const body = { id: k.id }, regels = [];
      const LBL = { naam: "Naam", bedrijf: "Bedrijf", email: "E-mail", telefoon: "Telefoon", status: "Status", boekhouder: "Boekhouder", start: "Startdatum", notitie: "Notitie", tevreden: "Tevreden klant" };
      for (const v of Object.keys(LBL)) if (input[v] !== undefined && input[v] !== "") {
        body[v] = v === "start" ? datumOk(input[v]) : typeof input[v] === "boolean" ? input[v] : schoon(input[v], v === "notitie" ? 2000 : 200);
        const oud = k[v], nieuw = body[v];
        regels.push([LBL[v], (oud !== undefined && oud !== "" && oud !== nieuw ? String(oud === true ? "ja" : oud === false ? "nee" : oud) + " → " : "") + String(nieuw === true ? "ja" : nieuw === false ? "nee" : v === "boekhouder" ? NAMEN[nieuw] : nieuw)]);
      }
      const pr = {}; ["kor", "icp", "partner", "urencriterium"].forEach((x) => { if (typeof input[x] === "boolean") { pr[x] = input[x]; regels.push([x.toUpperCase() === "KOR" || x === "icp" ? x.toUpperCase() : x.charAt(0).toUpperCase() + x.slice(1), input[x] ? "ja" : "nee"]); } });
      if (input.branche) { pr.branche = schoon(input.branche, 60); regels.push(["Branche", pr.branche]); }
      if (Object.keys(pr).length) body.profiel = pr;
      if (regels.length === 0) return { fout: "Geen wijziging opgegeven" };
      stuur({ t: "bevestig", id: id(), titel: "Wijzigen: " + (k.bedrijf || k.naam), regels, knop: "Opslaan", klaar: "Opgeslagen", link: "/intern/klant.html?id=" + k.id,
        verzoek: { method: "PATCH", url: "/intern/api/klant", body } });
      return { status: "Wacht op bevestiging van de gebruiker (knop Opslaan). Nog niet opgeslagen." };
    }
    case "mail_versturen": {
      const k = klanten.find((x) => x.id === input.klant_id);
      if (!k) return { fout: "Klant niet gevonden. Gebruik eerst zoek_klanten." };
      if (!k.email) return { fout: "Deze klant heeft geen e-mailadres" };
      const type = input.type;
      if (!TYPES[type] || (type !== "bericht" && !HANDMATIG.includes(type))) return { fout: "Onbekend mailtype", types: [...HANDMATIG, "bericht"] };
      const body = { id: k.id, type };
      if (type === "bericht") {
        body.onderwerp = schoon(input.onderwerp || "", 140); body.tekst = String(input.tekst || "").replace(/[<>]/g, "").trim().slice(0, 4000);
        if (!body.onderwerp || !body.tekst) return { fout: "Bij een eigen bericht zijn onderwerp en tekst nodig" };
      }
      const al = (k.log || []).find((l) => l.type === type && l.ok && !l.test && type !== "bericht");
      const regels = [["Aan", (k.naam || "") + " <" + k.email + ">"], ["Mail", type === "bericht" ? "Eigen bericht" : TYPES[type].label]];
      if (type === "bericht") { regels.push(["Onderwerp", body.onderwerp]); regels.push(["Tekst", body.tekst]); }
      if (al) regels.push(["Let op", "Deze mail is al eens verstuurd op " + al.op.slice(0, 10)]);
      stuur({ t: "bevestig", id: id(), titel: "Mail versturen", regels, knop: "Versturen", klaar: "Verstuurd", link: "/intern/klant.html?id=" + k.id,
        verzoek: { method: "POST", url: "/intern/api/klant/stuur", body },
        test: { method: "POST", url: "/intern/api/klant/stuur", body: { ...body, test: true } },
        voorbeeld: "/intern/api/klant/voorbeeld?" + new URLSearchParams(type === "bericht" ? { id: k.id, type, onderwerp: body.onderwerp, tekst: body.tekst } : { id: k.id, type }) });
      return { status: "Mail staat klaar; de gebruiker kan een voorbeeld bekijken en moet op Versturen klikken. Nog niet verstuurd." };
    }
    case "mail_ontwerpen": {
      const k = input.klant_id ? klanten.find((x) => x.id === input.klant_id) : null;
      if (input.klant_id && !k) return { fout: "Klant niet gevonden. Gebruik eerst zoek_klanten." };
      const aan = k ? k.email : String(input.aan_email || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(aan || "")) return { fout: "Geen geldig e-mailadres voor de ontvanger. Vraag het na." };
      const blokken = (Array.isArray(input.blokken) ? input.blokken : []).slice(0, 30);
      if (!input.onderwerp || !blokken.length) return { fout: "Onderwerp en blokken zijn nodig" };
      const body = { klant: k ? k.id : null, aan, naam: k ? k.naam : schoon(input.aan_naam || ""), onderwerp: schoon(input.onderwerp, 140), preheader: schoon(input.preheader || "", 120), aanhef: input.aanhef !== false, blokken };
      const regels = [["Aan", (body.naam ? body.naam + " " : "") + "<" + aan + ">"], ["Onderwerp", body.onderwerp], ["Opbouw", blokken.map((b) => b.type).join(", ")]];
      stuur({ t: "bevestig", id: id(), titel: "Ontworpen mail versturen", regels, knop: "Versturen", klaar: "Verstuurd", link: k ? "/intern/klant.html?id=" + k.id : null,
        verzoek: { method: "POST", url: "/intern/api/mail/stuur", body }, test: { method: "POST", url: "/intern/api/mail/stuur", body: { ...body, test: true } },
        voorbeeld: { method: "POST", url: "/intern/api/mail/voorbeeld", body }, toonVoorbeeld: true });
      return { status: "Mail ontworpen en klaargezet. De gebruiker ziet een voorbeeld en klikt op Versturen. Nog niet verstuurd." };
    }
    case "contact_vastleggen": {
      const k = klanten.find((x) => x.id === input.klant_id);
      if (!k) return { fout: "Klant niet gevonden" };
      const r = await h.api("POST", "/intern/api/klant/contact", { id: k.id, kanaal: input.kanaal, richting: input.richting, onderwerp: input.onderwerp, soort: input.soort, opgelost: input.opgelost, gevoel: input.gevoel, vermijdbaar: input.vermijdbaar, notitie: input.notitie }, wie, store);
      if (r.fout) return r;
      c.klanten = null;
      stuur({ t: "actie", soort: "contact", tekst: "Contact vastgelegd bij " + (k.bedrijf || k.naam), link: "/intern/klant.html?id=" + k.id });
      return { ok: true };
    }
    case "notitie_toevoegen": {
      const k = klanten.find((x) => x.id === input.klant_id);
      if (!k) return { fout: "Klant niet gevonden" };
      const r = await h.api("POST", "/intern/api/klant/notitie", { id: k.id, tekst: input.tekst, soort: input.soort }, wie, store);
      if (r.fout) return r;
      c.klanten = null;
      stuur({ t: "actie", soort: "notitie", tekst: "Notitie gezet bij " + (k.bedrijf || k.naam), link: "/intern/klant.html?id=" + k.id });
      return { ok: true };
    }
    case "taak_afvinken": {
      const q = String(input.titel || "").toLowerCase().trim();
      const open = taken.filter((t) => !t.klaar && q && t.titel.toLowerCase().includes(q));
      if (!open.length) return { fout: "Geen open taak gevonden met die titel", open: taken.filter((t) => !t.klaar).map((t) => t.titel) };
      if (open.length > 1) return { fout: "Meerdere taken passen, wees specifieker", opties: open.map((t) => t.titel) };
      open[0].klaar = true; open[0].klaarDoor = wie; open[0].klaarOp = new Date().toISOString();
      await h.bewaarTaken(store, taken);
      stuur({ t: "actie", soort: "taak", tekst: "Taak afgevinkt: " + open[0].titel, link: "/intern/" });
      return { ok: true };
    }
    case "contact_inzichten": {
      const z = h.inzichten(klanten, wie, [30, 90, 365].includes(input.dagen) ? input.dagen : 90);
      return { cijfers: z.cijfers, onderwerpen: z.onderwerpen, kanalen: z.kanalen, adviezen: z.adviezen, npsReacties: (z.npsReacties || []).slice(0, 5) };
    }
  }
  return { fout: "Onbekende tool" };
}

function systeem(wie, ctx) {
  const naam = NAMEN[wie];
  const nu = new Date();
  const dag = nu.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" });
  return `Je bent de A&E-agent: de persoonlijke AI-collega van Koen Avezaat en Daan Evers, oprichters van Avezaat & Evers, een boekhoudkantoor voor zzp'ers en eenmanszaken dat met MoneyMonk werkt (€ 80 per maand, vaste boekhouder, kwartaalritme).
Je praat nu met ${naam}. Vandaag is het ${dag}.${ctx.pagina ? " Hij kijkt nu naar de pagina " + ctx.pagina + "." : ""}${ctx.klant ? " Hij heeft de klant met id " + ctx.klant + " open; gebruik klant_details als de vraag daarover gaat." : ""}

Je rol: hem door al het dagelijkse werk leiden. Sales, onboarding, boekhouding, aangiftes, klantrelatie en het eigen bedrijf. Je kent de werkstromen (werkstroom_info) en de kennisbank (kennis_zoeken), en je kijkt mee in de klanten, taken en het contact.

Werkwijze:
- Haal eerst feiten op met je tools, gok nooit over klanten of cijfers.
- Bij een inhoudelijke boekhoud- of belastingvraag: eerst kennis_zoeken (onze eigen kennisbank). Gaat het om actuele bedragen, percentages, grenzen, deadlines, nieuwe regels, of staat het antwoord niet (volledig) in de kennisbank: gebruik ook web_zoeken. Combineer beide en antwoord concreet, met stappen en het jaar waar het om gaat.
- Bij vragen over MoneyMonk (knoppen, menu's, functies): web_zoeken met 'MoneyMonk' in de vraag, in plaats van te gokken.
- Met pagina_lezen kun je een bron of een link van de gebruiker helemaal lezen. Doe dat bij twijfel of als de zoekresultaten te kort zijn.
- Noem bij informatie van het web de bron als link. Spreken bronnen elkaar tegen of ben je niet zeker: zeg dat eerlijk en verwijs naar de officiële bron (Belastingdienst, KVK, Rijksoverheid).
- Je mag ook algemene vragen beantwoorden (een mail of WhatsApp opstellen, iets uitrekenen, een tekst verbeteren, een klantvraag beantwoorden).
- Vraagt hij wat hij moet doen of waar te beginnen: gebruik dagoverzicht en geef een geordende lijst van maximaal 5 acties, belangrijkste eerst, elk met de reden en een link.
- Bij een proces ("hoe pak ik X aan", "nieuwe klant", "btw-kwartaal"): gebruik werkstroom_info en vat de stappen samen. Werkstromen starten vanzelf en staan in het dagplan; start er alleen zelf een als hij daar expliciet om vraagt.
- Taken en werkstromen maak je alleen aan als hij dat vraagt of bevestigt.
- Je kunt ook acties uitvoeren: klanten toevoegen of wijzigen, mails sturen (vaste sjablonen of een eigen bericht), contact vastleggen, notities zetten en taken afvinken. Klant toevoegen, klant wijzigen en mails sturen worden pas uitgevoerd als hij in de kaart op de knop klikt: zeg dat in één zin ('Staat klaar, klik op Versturen'). Vraag ontbrekende gegevens (zoals e-mailadres) na in plaats van te gokken. Zoek bij een klantnaam eerst het id op met zoek_klanten.
- Een eigen bericht schrijf je in onze toon: je-vorm, persoonlijk, kort, zonder aanhef of afsluiting (die zitten in het sjabloon).
- Voor een mail met meer opmaak (kopjes, lijstjes, stappen, een knop, een tabel) gebruik je mail_ontwerpen. Ontwerp als een goede marketeer: één duidelijke boodschap, een sterke kop, korte alinea's, hooguit één knop. Gebruik alleen echte links (zoals https://avezaatenevers.nl/... of wa.me/31850604363), verzin geen URL's.

Stijl:
- Nederlands, je-vorm, kort en direct, in steekzinnen waar dat kan. Geen inleiding of herhaling van de vraag.
- Nooit het woord 'dingen'. Geen emoji. Typografische apostrof (’).
- Markdown: **vet** spaarzaam, lijstjes met '-' of '1.', kopjes met '###' alleen bij langere antwoorden.
- Links: klanten als [Bedrijfsnaam](/intern/klant.html?id=ID), werkstromen als [Titel](/intern/werkstromen.html?p=ID), kennisbank-bronnen als [titel](bron) wanneer er een bron is. Andere pagina's: /intern/ (Vandaag), /intern/klanten.html, /intern/kwartaal.html, /intern/inzichten.html, /voorstel.html, /intern/tools.html, /intern/ib-werkblad.html.
- Sluit waar zinvol af met één concrete vervolgstap.`;
}

function sse(data) { return enc.encode("data: " + JSON.stringify(data) + "\n\n"); }

function berichtenVan(body) {
  const lijst = (Array.isArray(body.berichten) ? body.berichten : []).slice(-16)
    .map((b) => ({ role: b.rol === "agent" ? "assistant" : "user", content: String(b.tekst || "").slice(0, 6000) }))
    .filter((b) => b.content.trim());
  while (lijst.length && lijst[0].role !== "user") lijst.shift();
  // Opeenvolgende berichten van dezelfde rol samenvoegen
  const uit = [];
  for (const b of lijst) { const v = uit[uit.length - 1]; if (v && v.role === b.role) v.content += "\n\n" + b.content; else uit.push({ ...b }); }
  return uit;
}

// ---------- Slimme modus: Google Gemini (gratis tier) ----------
// Env: GEMINI_API_KEY (Google AI Studio, project zónder betaalgegevens = gratis tier).
// Optioneel GEMINI_MODEL. Binnen de EER gelden de dataregels van de betaalde dienst: prompts worden niet gebruikt om modellen te trainen.
const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models/";
const MODELLEN = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];

function geminiSleutel(env) { return String(env("GEMINI_API_KEY") || "").trim().replace(/^["']|["']$/g, "").trim(); }

// Tools omzetten naar het formaat van Gemini (hoofdletter-types, enums alleen op strings)
function schema(x) {
  if (!x || typeof x !== "object") return x;
  const uit = {};
  for (const [k, v] of Object.entries(x)) {
    if (k === "type") uit.type = String(v).toUpperCase();
    else if (k === "properties") { uit.properties = {}; for (const [pk, pv] of Object.entries(v)) uit.properties[pk] = schema(pv); }
    else if (k === "items") uit.items = schema(v);
    else if (k === "enum") { if (v.every((e) => typeof e === "string")) uit.enum = v; }
    else uit[k] = v;
  }
  if (uit.type === "OBJECT" && uit.properties && !Object.keys(uit.properties).length) delete uit.properties;
  return uit;
}
const LEESTOOL = { name: "pagina_lezen", description: "Open een openbare webpagina (https) en lees de tekst. Gebruik na web_zoeken om een bron helemaal te lezen, of als de gebruiker een link geeft.",
  input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } };
const WEBTOOL = { name: "web_zoeken", description: "Zoek actuele informatie op het web: actuele belastingbedragen en -regels, deadlines, nieuws, KVK- en Belastingdienst-informatie, uitleg over MoneyMonk-functies, of alles wat niet in onze kennisbank staat. Geeft een samenvatting met bronnen.",
  input_schema: { type: "object", properties: { vraag: { type: "string", description: "De zoekvraag, zo specifiek mogelijk, in het Nederlands" } }, required: ["vraag"] } };
const GEMINI_TOOLS = [{ functionDeclarations: [...TOOLS, WEBTOOL, LEESTOOL].map((t) => {
  const par = schema(t.input_schema), d = { name: t.name, description: t.description };
  if (par && par.properties) d.parameters = par; // zonder parameters: veld weglaten
  return d;
}) }];
LABELS.web_zoeken = "Zoekt op het web";
LABELS.pagina_lezen = "Leest webpagina";

// Modellen die net een limiet of fout gaven, slaan we 10 minuten over (scheelt wachttijd bij elke vraag)
const KAPOT = new Map();
function bruikbaar(modellen) { const nu = Date.now(); const ok = modellen.filter((m) => !(KAPOT.get(m) > nu)); return ok.length ? ok : modellen; }
const GEEN_DENK = new Set(); // modellen die de denkinstelling niet accepteren
function denkConfig(model, body) {
  if (!body.generationConfig || GEEN_DENK.has(model)) return body;
  if (/^gemini-3/.test(model)) return { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: { thinkingLevel: "minimal" } } };
  if (/^gemini-2\.5-flash/.test(model)) return { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: { thinkingBudget: 0 } } };
  return body;
}

// Gewone aanroep (voor webzoeken)
async function geminiPost(env, model, body) {
  const stop = new AbortController(), klok = setTimeout(() => stop.abort(), 20000);
  let r;
  try {
    r = await fetch(GEMINI + model + ":generateContent", {
      method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": geminiSleutel(env) }, body: JSON.stringify(denkConfig(model, body)), signal: stop.signal,
    });
  } catch (e) { const f = new Error(e.name === "AbortError" ? "Gemini reageerde te traag" : "Gemini niet bereikbaar"); f.status = 504; throw f; }
  finally { clearTimeout(klok); }
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  if (!r.ok) { const e = new Error((j && j.error && j.error.message) || ("Gemini " + r.status)); e.status = r.status; throw e; }
  return j;
}
async function geminiMetTerugval(env, modellen, body) {
  let laatste;
  for (const m of bruikbaar(modellen)) {
    try { return { j: await geminiPost(env, m, body), model: m }; }
    catch (e) {
      laatste = e;
      if (e.status === 400 && /think/i.test(e.message) && !GEEN_DENK.has(m)) { GEEN_DENK.add(m); try { return { j: await geminiPost(env, m, body), model: m }; } catch (e2) { laatste = e2; } }
      if (![429, 500, 502, 503, 504, 404].includes(laatste.status)) throw laatste; KAPOT.set(m, Date.now() + 600000);
    }
  }
  throw laatste;
}

// Streamende aanroep: tekst gaat direct door naar de browser, functieaanroepen verzamelen we
async function geminiStroom(env, modellen, body, opTekst) {
  let laatste;
  const lijst = bruikbaar(modellen);
  for (let mi = 0; mi < lijst.length; mi++) {
    const model = lijst[mi];
    const stop = new AbortController(), klok = setTimeout(() => stop.abort(), 25000);
    try {
      const r = await fetch(GEMINI + model + ":streamGenerateContent?alt=sse", {
        method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": geminiSleutel(env) }, body: JSON.stringify(denkConfig(model, body)), signal: stop.signal,
      });
      if (!r.ok || !r.body) {
        const t = await r.text().catch(() => ""); let j = null; try { j = JSON.parse(t); } catch {}
        const e = new Error((j && j.error && j.error.message) || ("Gemini " + r.status)); e.status = r.status; throw e;
      }
      const reader = r.body.getReader(), dec = new TextDecoder();
      let buf = "", tekst = "", tekstSig = null, geblokkeerd = null;
      const calls = [];
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const regel = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!regel.startsWith("data:")) continue;
          let d; try { d = JSON.parse(regel.slice(5)); } catch { continue; }
          if (d.promptFeedback && d.promptFeedback.blockReason) geblokkeerd = d.promptFeedback.blockReason;
          const parts = (((d.candidates || [])[0] || {}).content || {}).parts || [];
          for (const p of parts) {
            if (p.functionCall) calls.push(p);
            else if (p.text && !p.thought) { tekst += p.text; if (p.thoughtSignature) tekstSig = p.thoughtSignature; opTekst(p.text); }
          }
        }
      }
      clearTimeout(klok);
      if (!tekst && !calls.length) throw Object.assign(new Error(geblokkeerd ? "Vraag geblokkeerd door Gemini" : "Leeg antwoord van Gemini"), { status: geblokkeerd ? 400 : 503 });
      const parts = [];
      if (tekst) parts.push(tekstSig ? { text: tekst, thoughtSignature: tekstSig } : { text: tekst });
      parts.push(...calls);
      return { model, parts, calls, tekst };
    } catch (e) {
      clearTimeout(klok);
      laatste = e.name === "AbortError" ? Object.assign(new Error("Gemini reageerde te traag"), { status: 504 }) : e;
      if (laatste.status === undefined) laatste.status = 503;
      if (laatste.status === 400 && /think/i.test(laatste.message) && !GEEN_DENK.has(model)) { GEEN_DENK.add(model); mi--; continue; }
      if (![429, 500, 502, 503, 504, 404].includes(laatste.status)) throw laatste;
      KAPOT.set(model, Date.now() + 600000);
    }
  }
  throw laatste;
}

// Webzoeken via Tavily (gratis: 1.000 zoekopdrachten per maand, env TAVILY_API_KEY).
// Google Search via Gemini zit niet (meer) in de gratis versie.
async function webZoeken(env, vraag, stuur) {
  const sleutel = String(env("TAVILY_API_KEY") || "").trim();
  if (!sleutel) { const e = new Error("webzoeken staat uit: zet een gratis TAVILY_API_KEY in Netlify"); e.status = 503; throw e; }
  const stop = new AbortController(), klok = setTimeout(() => stop.abort(), 15000);
  let r;
  try {
    r = await fetch("https://api.tavily.com/search", {
      method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + sleutel }, signal: stop.signal,
      body: JSON.stringify({ query: vraag, search_depth: "basic", max_results: 6, chunks_per_source: 3, topic: "general", include_answer: false }),
    });
  } catch (e) { throw Object.assign(new Error(e.name === "AbortError" ? "zoekmachine reageerde te traag" : "zoekmachine niet bereikbaar"), { status: 504 }); }
  finally { clearTimeout(klok); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const uitleg = { 401: "ongeldige Tavily-sleutel", 429: "te veel zoekopdrachten tegelijk", 432: "gratis maandlimiet van Tavily bereikt" }[r.status];
    throw Object.assign(new Error(uitleg || (j.detail && (j.detail.error || j.detail)) || ("Tavily " + r.status)), { status: r.status });
  }
  const res = (j.results || []).slice(0, 6).map((x) => ({ titel: x.title || x.url, url: x.url, tekst: String(x.content || "").slice(0, 1400), datum: x.published_date || null }));
  stuur({ t: "bronnen", v: res.map((b) => ({ titel: b.titel, bron: b.url, groep: "Web" })) });
  return res.length ? { resultaten: res, tip: "Lees een bron in zijn geheel met pagina_lezen als de samenvatting niet genoeg is." } : { resultaten: [], melding: "Niets gevonden. Probeer andere zoekwoorden." };
}

// Een webpagina zelf openen en als tekst teruggeven (gratis, geen sleutel nodig)
async function paginaLezen(url, stuur) {
  let u; try { u = new URL(String(url || "")); } catch { throw Object.assign(new Error("ongeldige link"), { status: 400 }); }
  if (u.protocol !== "https:" || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(u.hostname) || u.hostname.endsWith(".local") || u.hostname.endsWith(".internal")) throw Object.assign(new Error("alleen openbare https-pagina's"), { status: 400 });
  const stop = new AbortController(), klok = setTimeout(() => stop.abort(), 12000);
  let r;
  try { r = await fetch(u.href, { headers: { "User-Agent": "Mozilla/5.0 (AE-agent; +https://avezaatenevers.nl)", Accept: "text/html,application/xhtml+xml" }, redirect: "follow", signal: stop.signal }); }
  catch (e) { throw Object.assign(new Error(e.name === "AbortError" ? "pagina laadde te traag" : "pagina niet bereikbaar"), { status: 504 }); }
  finally { clearTimeout(klok); }
  if (!r.ok) throw Object.assign(new Error("pagina gaf " + r.status), { status: r.status });
  const html = (await r.text()).slice(0, 600000);
  const titel = ((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || u.hostname).replace(/\s+/g, " ").trim();
  const hoofd = (html.match(/<main[\s\S]*?<\/main>/i) || html.match(/<article[\s\S]*?<\/article>/i) || html.match(/<body[\s\S]*<\/body>/i) || [html])[0];
  const tekst = hoofd.replace(/<(script|style|nav|footer|header|noscript|svg|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|br|section)>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&euro;/g, "€").replace(/&#39;|&rsquo;/g, "’").replace(/&quot;/g, '"').replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim().slice(0, 9000);
  stuur({ t: "bronnen", v: [{ titel, bron: u.href, groep: "Web" }] });
  return { titel, url: u.href, tekst };
}

// Context vooraf meegeven, zodat het model voor veelgestelde vragen geen extra rondes nodig heeft
async function vooraf(c, body) {
  try {
    const uit = { dag: await voerUit("dagoverzicht", {}, c) };
    if (body.klant) { const k = (c.klanten || []).find((x) => x.id === body.klant); if (k) uit.openKlant = klantDetails(k, c.h, c.taken || [], c.runs || []); }
    return JSON.stringify(uit).slice(0, 9000);
  } catch { return ""; }
}

async function slim(c, body) {
  const { env, wie, stuur } = c;
  const start = Date.now();
  const context = await vooraf(c, body);
  const sys = systeem(wie, { pagina: schoon(body.pagina, 80), klant: schoon(body.klant, 40) }) +
    (context ? "\n\nActuele gegevens (al opgehaald, je hoeft hiervoor geen tool aan te roepen; gebruik tools alleen voor wat hier niet staat):\n" + context : "");
  const lijst = berichtenVan(body);
  if (!lijst.length) throw new Error("Geen vraag");
  const contents = lijst.map((b) => ({ role: b.role === "assistant" ? "model" : "user", parts: [{ text: b.content }] }));
  const voorkeur = env("GEMINI_MODEL") ? [env("GEMINI_MODEL"), ...MODELLEN] : MODELLEN;
  let model = null, iets = false;
  const gebruikt = new Set();
  for (let ronde = 0; ronde < 5; ronde++) {
    if (Date.now() - start > 40000) break; // binnen de tijdslimiet van de functie blijven
    const res = await geminiStroom(env, model ? [model, ...voorkeur.filter((x) => x !== model)] : voorkeur, {
      systemInstruction: { parts: [{ text: sys }] }, contents, tools: GEMINI_TOOLS,
      generationConfig: { temperature: 0.5, maxOutputTokens: 3000 },
    }, (t) => { iets = true; stuur({ t: "tekst", v: t }); });
    model = res.model;
    if (!res.calls.length) {
      const bron = gebruikt.size ? "met " + [...gebruikt].join(" en ") : "uit eigen kennis, zonder op te zoeken";
      stuur({ t: "info", v: "Beantwoord door " + res.model.replace("gemini-", "Gemini ").replace(/-/g, " ") + ", " + bron + ", " + ((Date.now() - start) / 1000).toFixed(1).replace(".", ",") + " s" });
      return;
    }
    if (res.tekst) stuur({ t: "tekst", v: "\n\n" });
    contents.push({ role: "model", parts: res.parts }); // ongewijzigd terug, inclusief thought signatures
    // Alle tools van deze ronde tegelijk uitvoeren
    const antwoorden = await Promise.all(res.calls.map(async (p) => {
      const { name, args, id: callId } = p.functionCall;
      stuur({ t: "tool", naam: name, label: LABELS[name] || name });
      let uit;
      gebruikt.add(name === "web_zoeken" ? "web" : name === "kennis_zoeken" ? "kennisbank" : "jullie gegevens");
      if (name === "pagina_lezen") gebruikt.add("web");
      try { uit = name === "web_zoeken" ? await webZoeken(env, (args || {}).vraag || "", stuur) : name === "pagina_lezen" ? await paginaLezen((args || {}).url, stuur) : await voerUit(name, args || {}, c); }
      catch (e) {
        uit = { fout: String(e.message || e) };
        console.log("Tool-fout", name, e.status, e.message);
        stuur({ t: "waarschuwing", v: (name === "web_zoeken" ? "Webzoeken mislukt" : name === "pagina_lezen" ? "Pagina lezen mislukt" : (LABELS[name] || name) + " mislukt") + ": " + String(e.message || e).slice(0, 200) });
        if (name === "web_zoeken") gebruikt.delete("web");
      }
      const fr = { name, response: { resultaat: JSON.parse(JSON.stringify(uit ?? null)) } };
      if (callId) fr.id = callId;
      return { functionResponse: fr };
    }));
    contents.push({ role: "user", parts: antwoorden });
  }
  if (!iets) stuur({ t: "tekst", v: "Ik kwam er niet helemaal uit binnen de tijd. Stel je vraag iets specifieker?" });
}

// ---------- Lokale modus (zonder API-sleutel) ----------
const pauze = (ms) => new Promise((r) => setTimeout(r, ms));

async function lokaal(c, body) {
  const { stuur, wie } = c;
  const lijst = berichtenVan(body);
  const vraag = (lijst.filter((b) => b.role === "user").pop() || {}).content || "";
  const l = vraag.toLowerCase();
  let tekst = "";
  const klanten = await c.h.leesKlanten(c.store);

  const vorige = (lijst.filter((b) => b.role === "user").slice(-2, -1)[0] || {}).content || "";
  const p = PROCESSEN.find((x) => l.includes(x.titel.toLowerCase()) || l.includes(x.id.replace("-", " ")))
    || (/klacht|ontevreden|lage (nps|score)|gaf een [0-6]\b/.test(l) && proces("klacht")) || (/btw.?kwartaal|kwartaalaangifte/.test(l) && proces("btw-kwartaal"))
    || (/nieuwe klant|onboard/.test(l) && proces("onboarding")) || (/nieuwe lead|aanvraag binnen/.test(l) && proces("nieuwe-lead"))
    || (/stopt|opzeg/.test(l) && proces("offboarding")) || (/overstap/.test(l) && /stappen|hoe|regelen/.test(l) && proces("overstap"))
    || (/werkstroom|proces|stappenplan|hoe pak ik|wat moet ik allemaal|stappen/.test(l) && PROCESSEN.map((x) => ({ x, s: x.titel.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 4 && l.includes(w)).length })).sort((a, b) => b.s - a.s).filter((y) => y.s)[0]?.x);
  const k = klanten.find((x) => [x.bedrijf, x.naam].some((n) => n && n.length > 3 && l.includes(n.toLowerCase())))
    || (body.klant && /deze klant|deze lead|hem|haar|samen|volgende stap|bericht|whatsapp|klant/.test(l) && klanten.find((x) => x.id === body.klant));
  const lijstje = (a) => a.map((x, i) => `${i + 1}. ${x}`).join("\n");

  if (k && /bericht|whatsapp|app(je)?|mail/.test(l)) {
    stuur({ t: "tool", naam: "klant_details", label: LABELS.klant_details });
    const d = await voerUit("klant_details", { id: k.id }, c);
    const voornaam = (d.naam || "").split(" ")[0] || "daar", ik = NAMEN[wie];
    const lc = d.contacten[0];
    const kern = d.lead ? (d.voorstel ? "Ik ben benieuwd wat je van het voorstel vond. Heb je nog vragen, of zal ik je even bellen?" : "Je had interesse in onze boekhouding. Zullen we even 20 minuten kennismaken? Zeg maar wanneer het je uitkomt.")
      : d.nps.length && d.nps[d.nps.length - 1].score <= 6 ? "Bedankt voor je eerlijke cijfer. Ik wil graag horen wat er beter kan. Kan ik je vandaag of morgen even bellen?"
      : lc && lc.opgelost === false ? `Ik kom nog even terug op je vraag over ${lc.onderwerp.toLowerCase()}. Ik pak het nu op en laat je vandaag weten hoe het zit.`
      : "Even een check-in: gaat alles goed met de app en je administratie? Laat het weten als ik ergens mee kan helpen.";
    tekst = `### Voorstel voor ${d.bedrijf || d.naam}\nHoi ${voornaam},\n\n${kern}\n\nGroet, ${ik}\n\n_Pas het gerust aan; ik baseer het op de laatste stand in het dossier._`;
  } else if (/\blead(s)?\b|bellen|warm/.test(l) && !p && !k) {
    stuur({ t: "tool", naam: "dagoverzicht", label: LABELS.dagoverzicht });
    const o = await voerUit("dagoverzicht", {}, c);
    tekst = o.leads.length ? `### Leads op warmte\n${lijstje(o.leads.slice(0, 6).map((x) => `**[${x.naam}](/intern/klant.html?id=${x.id})**, warmte ${x.score} (${x.label}): ${x.actie}`))}\n\nTip bij bellen: vraag eerst wat hem nu tijd of zorgen kost, en plan meteen een kennismaking van 20 minuten. Geen gehoor? Direct een WhatsApp met twee voorstellen voor een moment.`
      : "Er staan geen open leads. Mooi moment voor een [kennisbankartikel](/intern/werkstromen.html?p=kennisbank-artikel) dat nieuwe leads oplevert.";
  } else if (/nps|tevreden|verbeter|voorkomen|klantcontact|inzicht/.test(l) && !p && !k) {
    stuur({ t: "tool", naam: "contact_inzichten", label: LABELS.contact_inzichten });
    const z = await voerUit("contact_inzichten", { dagen: 90 }, c);
    const ci = z.cijfers || {};
    tekst = `### Contact en NPS, laatste 90 dagen\n- ${ci.contacten ?? 0} contactmomenten, ${ci.opgelost ?? "–"}% meteen opgelost, ${ci.vermijdbaar ?? "–"}% was te voorkomen\n- NPS: ${ci.nps && ci.nps.score != null ? ci.nps.score : "nog te weinig antwoorden"}\n\n### Adviezen\n${(z.adviezen || []).length ? lijstje(z.adviezen.slice(0, 5).map((a) => `**${a.titel}**: ${a.tekst}`)) : "Nog geen adviezen. Leg meer contact vast, dan worden ze scherper."}\n\n[Bekijk Contact en NPS](/intern/inzichten.html)`;
  } else if (/lopen|lopende/.test(l) && /werkstro/.test(l)) {
    stuur({ t: "tool", naam: "lopende_werkstromen", label: LABELS.lopende_werkstromen });
    const r = await voerUit("lopende_werkstromen", {}, c);
    tekst = r.length ? `### Lopende werkstromen\n${lijstje(r.map((w) => `[${w.titel}](/intern/werkstromen.html?run=${w.id})${w.klant ? " voor " + w.klant : ""}: ${w.klaar} van ${w.totaal} stappen`))}` : "Er lopen nu geen werkstromen. [Kies er een](/intern/werkstromen.html).";
  } else if (/\b(dag|vandaag|briefing|beginnen|begin ik|eerst|prioriteit|planning|plan|week|wat moet ik)\b/.test(l) && !p && !k) {
    stuur({ t: "tool", naam: "dagoverzicht", label: LABELS.dagoverzicht });
    const o = await voerUit("dagoverzicht", {}, c);
    const acties = [
      ...o.aandacht.filter((a) => a.ernst >= 3).map((a) => `**${a.naam}**: ${a.tekst}. ${a.actie}${a.id ? ` ([open](/intern/klant.html?id=${a.id}))` : ""}`),
      ...o.leads.filter((x) => x.urgent).map((x) => `**${x.naam}** (warmte ${x.score}): ${x.actie} ([open](/intern/klant.html?id=${x.id}))`),
      ...o.taken.teLaat.map((t) => `Taak te laat: ${t}`),
      ...o.taken.vandaag.map((t) => `Taak voor vandaag: ${t}`),
      ...o.aandacht.filter((a) => a.ernst < 3).map((a) => `**${a.naam}**: ${a.tekst}. ${a.actie}`),
    ].slice(0, 5);
    const week = /week|plan/.test(l);
    tekst = `### ${week ? "Je week" : "Zo ziet je dag eruit"}\n${acties.length ? lijstje(acties) : "Niets urgents. Mooi moment voor de [maandverwerking](/intern/werkstromen.html?p=maandverwerking)."}` +
      (week && o.taken.dezeWeek.length ? `\n\n**Later deze week**\n${o.taken.dezeWeek.map((t) => "- " + t).join("\n")}` : "") +
      (week && o.mailsKomendeWeek.length ? `\n\n**Gaat vanzelf**\n${o.mailsKomendeWeek.slice(0, 5).map((m) => "- " + m).join("\n")}` : "") +
      `\n\n${o.cijfers.klanten} actieve klanten, ${o.cijfers.prospects} open leads. Start met de [dagstart](/intern/werkstromen.html?p=dagstart).`;
  } else if (p) {
    stuur({ t: "tool", naam: "werkstroom_info", label: LABELS.werkstroom_info });
    stuur({ t: "werkstroom", id: p.id, titel: p.titel });
    const extra = p.stappen.filter((s) => s.vraag).slice(0, 1).map((s) => zoekKennis(s.vraag, 1)[0]).filter(Boolean)[0];
    tekst = `### ${p.titel}\n${p.doel}\n\n${p.stappen.map((s, i) => `${i + 1}. **${s.t}**: ${s.u}`).join("\n")}` +
      (extra ? `\n\n**Achtergrond: ${extra.titel}**\n${extra.tekst.length > 400 ? extra.tekst.slice(0, extra.tekst.lastIndexOf(". ", 400) + 1) : extra.tekst}` : "") +
      `\n\n[Open de werkstroom](/intern/werkstromen.html?p=${p.id}${k ? "&klant=" + k.id : ""})${p.perKlant ? " om hem voor een klant te starten en af te vinken." : " om af te vinken."}`;
  } else if (k) {
    stuur({ t: "tool", naam: "klant_details", label: LABELS.klant_details });
    const d = await voerUit("klant_details", { id: k.id }, c);
    const lc = d.contacten[0];
    const volgende = d.lead ? d.lead.actie
      : d.nps.length && d.nps[d.nps.length - 1].score <= 6 ? "Bel binnen 48 uur over de lage NPS ([werkstroom](/intern/werkstromen.html?p=klacht))"
      : d.contacten.some((x) => x.opgelost === false) ? "Er staat nog een open vraag: rond die eerst af"
      : d.openTaken.length ? "Open taak: " + d.openTaken[0].titel
      : d.geplandeMails[0] ? `Niets urgents. Volgende mail gaat vanzelf op ${d.geplandeMails[0].datum}` : "Niets urgents";
    tekst = `### [${d.bedrijf || d.naam}](${d.link})\n- Status: ${d.status}, boekhouder ${d.boekhouder}\n${d.lead ? `- Warmte ${d.lead.score} (${d.lead.label})\n` : ""}- Laatste contact: ${lc ? `${lc.datum.slice(0, 10)} via ${lc.kanaal}, ${lc.onderwerp}${lc.opgelost === false ? " (nog niet opgelost)" : ""}` : "nog niets vastgelegd"}\n${d.nps.length ? `- Laatste NPS: ${d.nps[d.nps.length - 1].score}${d.nps[d.nps.length - 1].reden ? `, "${d.nps[d.nps.length - 1].reden}"` : ""}\n` : ""}${d.geplandeMails[0] ? `- Volgende mail: ${d.geplandeMails[0].mail} op ${d.geplandeMails[0].datum}\n` : ""}${d.openTaken.length ? `- Open taken: ${d.openTaken.map((t) => t.titel).join(", ")}\n` : ""}${d.lopendeWerkstromen.length ? `- Werkstroom: ${d.lopendeWerkstromen.map((w) => `${w.titel} (${w.klaar}/${w.totaal})`).join(", ")}\n` : ""}\n**Volgende stap:** ${volgende}.`;
  } else {
    stuur({ t: "tool", naam: "kennis_zoeken", label: LABELS.kennis_zoeken });
    let r = zoekKennis(vraag, 3);
    if (!r.length && vorige) r = zoekKennis(vorige + " " + vraag, 3); // vervolgvraag
    stuur({ t: "bronnen", v: r.map((x) => ({ titel: x.titel, bron: x.bron, groep: x.groep })) });
    const kort = (t, n) => (t.length > n ? t.slice(0, t.lastIndexOf(". ", n) + 1) + " …" : t);
    tekst = r.length
      ? `### ${r[0].bron ? `[${r[0].titel}](${r[0].bron})` : r[0].titel}\n${kort(r[0].tekst, 900)}` +
        (r.length > 1 ? `\n\n**Ook relevant**\n${r.slice(1).map((x) => `- ${x.bron ? `[${x.titel}](${x.bron})` : `**${x.titel}**`}: ${kort(x.tekst, 220)}`).join("\n")}` : "") +
        (/[0-9]{3,}|%|€/.test(r[0].tekst) ? "\n\n_Bedragen en percentages veranderen jaarlijks: check het actuele bedrag voordat je het aan een klant doorgeeft._" : "")
      : "Daar vond ik niets over in de kennisbank. Probeer het met andere woorden (bijvoorbeeld creditfactuur, KOR, ICP, urencriterium), of vraag het aan " + (wie === "koen" ? "Daan" : "Koen") + ".";
  }
  await pauze(350);
  const delen = tekst.match(/\S+\s*/g) || [];
  for (let i = 0; i < delen.length; i += 3) { stuur({ t: "tekst", v: delen.slice(i, i + 3).join("") }); await pauze(14); }
}

// ---------- Gesprekken (per persoon bewaard, zichtbaar op elk apparaat) ----------
async function gesprekkenApi(request, url, pad, wie, store) {
  const sleutel = "gesprekken-" + wie;
  const lijst = (await store.get(sleutel, { type: "json" })) || [];
  const meta = (g) => ({ id: g.id, titel: g.titel, bijgewerkt: g.bijgewerkt, aantal: (g.berichten || []).length });
  if (pad === "/intern/api/gesprekken") return json(lijst.map(meta).sort((a, b) => b.bijgewerkt.localeCompare(a.bijgewerkt)));
  if (request.method === "GET") { const g = lijst.find((x) => x.id === url.searchParams.get("id")); return g ? json(g) : json({ fout: "Gesprek niet gevonden" }, 404); }
  if (request.method === "DELETE") { const i = lijst.findIndex((x) => x.id === url.searchParams.get("id")); if (i >= 0) { lijst.splice(i, 1); await store.setJSON(sleutel, lijst); } return json({ ok: true }); }
  if (request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const berichten = (Array.isArray(body.berichten) ? body.berichten : []).slice(-60).map((b) => ({
      rol: b.rol === "agent" ? "agent" : "gebruiker", tekst: String(b.tekst || "").slice(0, 12000),
      stappen: Array.isArray(b.stappen) ? b.stappen.slice(0, 12).map((x) => String(x).slice(0, 80)) : undefined, extra: b.extra ? String(b.extra).slice(0, 30000) : undefined,
    }));
    let g = body.id && lijst.find((x) => x.id === body.id);
    if (!g) { g = { id: id(), aangemaakt: new Date().toISOString() }; lijst.push(g); }
    if (body.titel) g.titel = schoon(body.titel, 80);
    if (!g.titel) { const eerste = berichten.find((b) => b.rol === "gebruiker"); g.titel = eerste ? schoon(eerste.tekst.replace(/\s+/g, " "), 60) : "Nieuw gesprek"; }
    g.berichten = berichten; g.bijgewerkt = new Date().toISOString();
    lijst.sort((a, b) => b.bijgewerkt.localeCompare(a.bijgewerkt));
    await store.setJSON(sleutel, lijst.slice(0, 80));
    return json(meta(g));
  }
  return json({ fout: "Methode niet toegestaan" }, 405);
}

// ---------- Ingang ----------
export async function agentApi(request, url, pad, wie, store, env, h) {
  if (pad === "/intern/api/werkstromen" || pad === "/intern/api/werkstroom") return werkstromenApi(request, url, pad, wie, store, h);
  if (pad === "/intern/api/gesprekken" || pad === "/intern/api/gesprek") return gesprekkenApi(request, url, pad, wie, store);
  if (pad === "/intern/api/dagplan") {
    const nu = h.vandaag();
    const [klanten, taken, runs] = await Promise.all([h.leesKlanten(store), h.leesTaken(store), leesRuns(store)]);
    let runsVeranderd = synchroniseer(klanten, runs, nu), takenVeranderd = false;
    const voor = ["koen", "daan"].includes(url.searchParams.get("wie")) ? url.searchParams.get("wie") : wie;
    if (request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const r = verwerkMissie(runs, taken, body.missie, wie, nu, ["later", "terug"].includes(body.actie) ? body.actie : "klaar");
      if (r.fout) return json(r, 404);
      if (r.taken) takenVeranderd = true; else runsVeranderd = true;
    }
    if (runsVeranderd) await store.setJSON(WERK, runs);
    if (takenVeranderd) await h.bewaarTaken(store, taken);
    return json(dagplan(klanten, taken, runs, voor, nu));
  }
  if (pad === "/intern/api/agent/status") return json({ slim: !!geminiSleutel(env), web: !!String(env("TAVILY_API_KEY") || "").trim(), gratis: true, motor: geminiSleutel(env) ? "Gemini" : "lokaal" });
  if (pad === "/intern/api/kennis") return json({ resultaten: zoekKennis(url.searchParams.get("q") || "", 8) });
  if (pad !== "/intern/api/agent" || request.method !== "POST") return json({ fout: "Onbekende route" }, 404);
  return agentGesprek(request, wie, store, env, h);
}

// Het gesprek zelf, als SSE-stroom. Wordt aangeroepen vanuit netlify/functions/agent.mjs.
export async function agentGesprek(request, wie, store, env, h) {
  const body = await request.json().catch(() => ({}));
  const { readable, writable } = new TransformStream();
  const w = writable.getWriter();
  let open = true;
  let getoond = false;
  const stuur = (d) => { if (d.t === "tekst" && d.v) getoond = true; if (open) w.write(sse(d)).catch(() => { open = false; }); };
  const c = { store, wie, env, h, stuur };
  (async () => {
    try {
      // Gratis: Gemini (gratis tier) als er een sleutel is, anders of bij een storing de lokale agent
      if (geminiSleutel(env)) {
        let gelukt = false;
        try { await slim(c, body); gelukt = true; }
        catch (e) {
          console.log("Gemini-fout:", e.status, e.message);
          if (getoond) { stuur({ t: "fout", v: "Gemini viel halverwege weg: " + String(e.message || e).slice(0, 160) }); gelukt = true; }
          else stuur({ t: "tool", naam: "lokaal", label: "Gemini even niet bereikbaar (" + String(e.message || e).slice(0, 80) + "), ik zoek het zelf op" });
        }
        if (!gelukt) await lokaal(c, body);
      } else await lokaal(c, body);
      stuur({ t: "klaar" });
    } catch (e) {
      stuur({ t: "fout", v: String(e.message || e).slice(0, 300) });
    } finally { open = false; w.close().catch(() => {}); }
  })();
  return new Response(readable, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
