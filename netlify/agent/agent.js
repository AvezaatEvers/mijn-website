// De A&E-agent: een assistent die Koen en Daan door hun werk leidt.
// Gratis: denkt mee via Google Gemini (gratis tier, env GEMINI_API_KEY) met jullie data en het web.
// Zonder sleutel of bij een storing antwoordt de lokale agent (kennisbank, werkstromen, klanten, dagbriefing).
import { zoekKennis } from "./kennis.js";
import { PROCESSEN, GROEPEN, proces } from "./processen.js";
import { synchroniseer, dagplan, verwerkMissie, GIDS } from "./dagplan.js";

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
];

const LABELS = {
  dagoverzicht: "Bekijkt je dag", zoek_klanten: "Zoekt klanten", klant_details: "Opent klantdossier", kennis_zoeken: "Zoekt in de kennisbank",
  werkstroom_info: "Pakt de werkstroom erbij", lopende_werkstromen: "Bekijkt lopende werkstromen", werkstroom_starten: "Start werkstroom",
  taak_toevoegen: "Zet taak klaar", contact_inzichten: "Analyseert klantcontact",
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
- Noem bij informatie van het web de bron als link. Spreken bronnen elkaar tegen of ben je niet zeker: zeg dat eerlijk en verwijs naar de officiële bron (Belastingdienst, KVK, Rijksoverheid).
- Je mag ook algemene vragen beantwoorden (een mail of WhatsApp opstellen, iets uitrekenen, een tekst verbeteren, een klantvraag beantwoorden).
- Vraagt hij wat hij moet doen of waar te beginnen: gebruik dagoverzicht en geef een geordende lijst van maximaal 5 acties, belangrijkste eerst, elk met de reden en een link.
- Bij een proces ("hoe pak ik X aan", "nieuwe klant", "btw-kwartaal"): gebruik werkstroom_info en vat de stappen samen. Werkstromen starten vanzelf en staan in het dagplan; start er alleen zelf een als hij daar expliciet om vraagt.
- Taken en werkstromen maak je alleen aan als hij dat vraagt of bevestigt.

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
const MODELLEN = ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-2.5-flash"];
const ZOEKMODELLEN = ["gemini-2.5-flash-lite", "gemini-2.5-flash"]; // Google Search-grounding is gratis op 2.5 (gedeeld daglimiet)

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
const WEBTOOL = { name: "web_zoeken", description: "Zoek actuele informatie op het web via Google: actuele belastingbedragen en -regels, deadlines, nieuws, KVK- en Belastingdienst-informatie, uitleg over MoneyMonk-functies, of alles wat niet in onze kennisbank staat. Geeft een samenvatting met bronnen.",
  input_schema: { type: "object", properties: { vraag: { type: "string", description: "De zoekvraag, zo specifiek mogelijk, in het Nederlands" } }, required: ["vraag"] } };
const GEMINI_TOOLS = [{ functionDeclarations: [...TOOLS, WEBTOOL].map((t) => {
  const par = schema(t.input_schema), d = { name: t.name, description: t.description };
  if (par && par.properties) d.parameters = par; // zonder parameters: veld weglaten
  return d;
}) }];
LABELS.web_zoeken = "Zoekt op het web";

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

async function webZoeken(env, vraag, stuur) {
  const { j } = await geminiMetTerugval(env, ZOEKMODELLEN, {
    contents: [{ role: "user", parts: [{ text: `Zoek dit op voor een Nederlands boekhoudkantoor voor zzp'ers en vat het antwoord feitelijk en kort samen in het Nederlands, met concrete bedragen, data en jaartallen. Geef de voorkeur aan officiële Nederlandse bronnen (belastingdienst.nl, kvk.nl, rijksoverheid.nl, ondernemersplein.kvk.nl) en voor MoneyMonk aan moneymonk.nl. Vraag: ${vraag}` }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 900 },
  });
  const cand = (j.candidates || [])[0] || {};
  const tekst = ((cand.content || {}).parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join("").trim();
  const gm = cand.groundingMetadata || {};
  const bronnen = (gm.groundingChunks || []).map((c) => c.web).filter(Boolean).slice(0, 6).map((w) => ({ titel: w.title || "Webbron", url: w.uri }));
  stuur({ t: "bronnen", v: bronnen.map((b) => ({ titel: b.titel, bron: b.url, groep: "Web" })) });
  return { samenvatting: tekst || "Geen resultaat gevonden.", bronnen };
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
  for (let ronde = 0; ronde < 5; ronde++) {
    if (Date.now() - start > 40000) break; // binnen de tijdslimiet van de functie blijven
    const res = await geminiStroom(env, model ? [model, ...voorkeur.filter((x) => x !== model)] : voorkeur, {
      systemInstruction: { parts: [{ text: sys }] }, contents, tools: GEMINI_TOOLS,
      generationConfig: { temperature: 0.5, maxOutputTokens: 3000 },
    }, (t) => { iets = true; stuur({ t: "tekst", v: t }); });
    model = res.model;
    if (!res.calls.length) { stuur({ t: "info", v: res.model.replace("gemini-", "Gemini ").replace(/-/g, " ") + ", " + ((Date.now() - start) / 1000).toFixed(1).replace(".", ",") + " s" }); return; }
    if (res.tekst) stuur({ t: "tekst", v: "\n\n" });
    contents.push({ role: "model", parts: res.parts }); // ongewijzigd terug, inclusief thought signatures
    // Alle tools van deze ronde tegelijk uitvoeren
    const antwoorden = await Promise.all(res.calls.map(async (p) => {
      const { name, args, id: callId } = p.functionCall;
      stuur({ t: "tool", naam: name, label: LABELS[name] || name });
      let uit;
      try { uit = name === "web_zoeken" ? await webZoeken(env, (args || {}).vraag || "", stuur) : await voerUit(name, args || {}, c); }
      catch (e) { uit = { fout: String(e.message || e) }; }
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

// ---------- Ingang ----------
export async function agentApi(request, url, pad, wie, store, env, h) {
  if (pad === "/intern/api/werkstromen" || pad === "/intern/api/werkstroom") return werkstromenApi(request, url, pad, wie, store, h);
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
  if (pad === "/intern/api/agent/status") return json({ slim: !!geminiSleutel(env), gratis: true, motor: geminiSleutel(env) ? "Gemini" : "lokaal" });
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
