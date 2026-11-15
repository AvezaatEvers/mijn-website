// De A&E-agent: een assistent die Koen en Daan door hun werk leidt.
// Slimme modus via de Claude API (env ANTHROPIC_API_KEY, optioneel AGENT_MODEL).
// Zonder sleutel antwoordt hij lokaal: kennisbank, werkstromen, klanten en de dagbriefing.
import { zoekKennis } from "./kennis.js";
import { PROCESSEN, GROEPEN, proces } from "./processen.js";

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
    contacten: (k.contacten || []).slice(-8).reverse().map((c) => ({ datum: c.datum, kanaal: c.kanaal, richting: c.richting, onderwerp: c.onderwerp, soort: c.soort, opgelost: c.opgelost, gevoel: c.gevoel, notitie: schoon(c.notitie, 200) })),
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
- Bij elke inhoudelijke boekhoud- of belastingvraag: eerst kennis_zoeken. Antwoord dan concreet, met stappen. Bedragen, percentages en grenzen veranderen jaarlijks: noem het jaar en zeg erbij dat hij het actuele bedrag even checkt bij de Belastingdienst als hij het aan een klant doorgeeft. Weet je iets niet zeker, zeg dat eerlijk.
- Over MoneyMonk weet je de grote lijnen (bankkoppeling, bonnetjes in de app, facturen, uren en ritten). Voor exacte knoppen of menu's: verwijs naar de helpomgeving van MoneyMonk in plaats van te gokken.
- Vraagt hij wat hij moet doen of waar te beginnen: gebruik dagoverzicht en geef een geordende lijst van maximaal 5 acties, belangrijkste eerst, elk met de reden en een link.
- Bij een proces ("hoe pak ik X aan", "nieuwe klant", "btw-kwartaal"): gebruik werkstroom_info, vat de stappen samen en bied aan de werkstroom te starten (voor een klant als dat past).
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

// Eén Claude-ronde, streamend. Geeft { blokken, stop } terug en stuurt tekst direct door.
async function claudeRonde(env, model, sys, berichten, stuur) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env("ANTHROPIC_API_KEY"), "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 2000, stream: true, system: [{ type: "text", text: sys, cache_control: { type: "ephemeral" } }], tools: TOOLS, messages: berichten }),
  });
  if (!r.ok || !r.body) {
    const t = await r.text().catch(() => "");
    throw new Error("Claude API " + r.status + ": " + t.slice(0, 200));
  }
  const reader = r.body.getReader(), dec = new TextDecoder();
  let buf = "", stop = null;
  const blokken = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const ev = buf.slice(0, i); buf = buf.slice(i + 2);
      const regel = ev.split("\n").find((l) => l.startsWith("data:"));
      if (!regel) continue;
      let d; try { d = JSON.parse(regel.slice(5)); } catch { continue; }
      if (d.type === "content_block_start") {
        const b = d.content_block;
        blokken[d.index] = b.type === "tool_use" ? { type: "tool_use", id: b.id, name: b.name, json: "" } : { type: "text", text: "" };
        if (b.type === "tool_use") stuur({ t: "tool", naam: b.name, label: LABELS[b.name] || b.name });
      } else if (d.type === "content_block_delta") {
        const b = blokken[d.index]; if (!b) continue;
        if (d.delta.type === "text_delta") { b.text += d.delta.text; stuur({ t: "tekst", v: d.delta.text }); }
        else if (d.delta.type === "input_json_delta") b.json += d.delta.partial_json;
      } else if (d.type === "message_delta") {
        stop = d.delta.stop_reason || stop;
      } else if (d.type === "error") {
        throw new Error((d.error && d.error.message) || "Claude API-fout");
      }
    }
  }
  return {
    stop,
    blokken: blokken.filter(Boolean).map((b) => b.type === "text" ? { type: "text", text: b.text } : { type: "tool_use", id: b.id, name: b.name, input: (() => { try { return b.json ? JSON.parse(b.json) : {}; } catch { return {}; } })() })
      .filter((b) => b.type !== "text" || b.text),
  };
}

async function slim(c, body) {
  const { env, wie, stuur } = c;
  const model = env("AGENT_MODEL") || "claude-sonnet-5-5";
  const sys = systeem(wie, { pagina: schoon(body.pagina, 80), klant: schoon(body.klant, 40) });
  const berichten = berichtenVan(body);
  if (!berichten.length) throw new Error("Geen vraag");
  for (let ronde = 0; ronde < 8; ronde++) {
    const { blokken, stop } = await claudeRonde(env, model, sys, berichten, stuur);
    if (stop !== "tool_use") return;
    berichten.push({ role: "assistant", content: blokken });
    const resultaten = [];
    for (const b of blokken.filter((x) => x.type === "tool_use")) {
      let uit;
      try { uit = await voerUit(b.name, b.input, c); } catch (e) { uit = { fout: String(e.message || e) }; }
      resultaten.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(uit).slice(0, 14000) });
    }
    berichten.push({ role: "user", content: resultaten });
    stuur({ t: "tekst", v: "" });
  }
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

  const p = PROCESSEN.find((x) => l.includes(x.titel.toLowerCase()) || l.includes(x.id.replace("-", " ")))
    || (/werkstroom|proces|stappenplan|hoe pak ik/.test(l) && PROCESSEN.map((x) => ({ x, s: x.titel.toLowerCase().split(/\s+/).filter((w) => w.length > 3 && l.includes(w)).length })).sort((a, b) => b.s - a.s).filter((y) => y.s)[0]?.x);
  const k = klanten.find((x) => [x.bedrijf, x.naam].some((n) => n && n.length > 3 && l.includes(n.toLowerCase())));

  if (/\b(dag|vandaag|briefing|beginnen|begin ik|eerst|prioriteit|planning|wat moet ik)\b/.test(l) && !p) {
    stuur({ t: "tool", naam: "dagoverzicht", label: LABELS.dagoverzicht });
    const o = await voerUit("dagoverzicht", {}, c);
    const acties = [
      ...o.aandacht.filter((a) => a.ernst >= 3).map((a) => `**${a.naam}**: ${a.tekst}. ${a.actie}${a.id ? ` ([open](/intern/klant.html?id=${a.id}))` : ""}`),
      ...o.leads.filter((x) => x.urgent).map((x) => `**${x.naam}** (warmte ${x.score}): ${x.actie} ([open](/intern/klant.html?id=${x.id}))`),
      ...o.taken.teLaat.map((t) => `Taak te laat: ${t}`),
      ...o.taken.vandaag.map((t) => `Taak voor vandaag: ${t}`),
      ...o.aandacht.filter((a) => a.ernst < 3).map((a) => `**${a.naam}**: ${a.tekst}. ${a.actie}`),
    ].slice(0, 5);
    tekst = `### Zo ziet je dag eruit\n${acties.length ? acties.map((a, i) => `${i + 1}. ${a}`).join("\n") : "Niets urgents. Mooi moment voor de [maandverwerking](/intern/werkstromen.html?p=maandverwerking)."}\n\n${o.cijfers.klanten} actieve klanten, ${o.cijfers.prospects} open leads, ${o.mailsKomendeWeek.length} automatische mails deze week.`;
  } else if (p) {
    stuur({ t: "tool", naam: "werkstroom_info", label: LABELS.werkstroom_info });
    stuur({ t: "werkstroom", id: p.id, titel: p.titel });
    tekst = `### ${p.titel}\n${p.doel}\n\n${p.stappen.map((s, i) => `${i + 1}. **${s.t}**: ${s.u}`).join("\n")}\n\n[Open de werkstroom](/intern/werkstromen.html?p=${p.id})${p.perKlant ? " om hem voor een klant te starten." : "."}`;
  } else if (k) {
    stuur({ t: "tool", naam: "klant_details", label: LABELS.klant_details });
    const d = await voerUit("klant_details", { id: k.id }, c);
    const lc = d.contacten[0];
    tekst = `### [${d.bedrijf || d.naam}](${d.link})\n- Status: ${d.status}, boekhouder ${d.boekhouder}\n${d.lead ? `- Warmte ${d.lead.score} (${d.lead.label}): ${d.lead.actie}\n` : ""}- Laatste contact: ${lc ? `${lc.datum.slice(0, 10)} via ${lc.kanaal}, ${lc.onderwerp}` : "nog niets vastgelegd"}\n${d.nps.length ? `- Laatste NPS: ${d.nps[d.nps.length - 1].score}\n` : ""}${d.geplandeMails[0] ? `- Volgende mail: ${d.geplandeMails[0].mail} op ${d.geplandeMails[0].datum}\n` : ""}${d.openTaken.length ? `- Open taken: ${d.openTaken.map((t) => t.titel).join(", ")}\n` : ""}`;
  } else {
    stuur({ t: "tool", naam: "kennis_zoeken", label: LABELS.kennis_zoeken });
    const r = zoekKennis(vraag, 3);
    stuur({ t: "bronnen", v: r.map((x) => ({ titel: x.titel, bron: x.bron, groep: x.groep })) });
    tekst = r.length
      ? `Dit vond ik in de kennisbank:\n\n${r.map((x) => `### ${x.bron ? `[${x.titel}](${x.bron})` : x.titel}\n${x.tekst.length > 700 ? x.tekst.slice(0, x.tekst.lastIndexOf(". ", 700) + 1) + " …" : x.tekst}`).join("\n\n")}`
      : "Daar vond ik niets over in de kennisbank. Probeer het met andere woorden, of vraag het aan " + (wie === "koen" ? "Daan" : "Koen") + ".";
  }
  tekst += "\n\n_Lokale modus: de agent zoekt nu zelf in kennisbank, klanten en werkstromen. Met een Claude API-sleutel in Netlify (ANTHROPIC_API_KEY) denkt hij echt mee._";
  await pauze(350);
  const delen = tekst.match(/\S+\s*/g) || [];
  for (let i = 0; i < delen.length; i += 3) { stuur({ t: "tekst", v: delen.slice(i, i + 3).join("") }); await pauze(14); }
}

// ---------- Ingang ----------
export async function agentApi(request, url, pad, wie, store, env, h) {
  if (pad === "/intern/api/werkstromen" || pad === "/intern/api/werkstroom") return werkstromenApi(request, url, pad, wie, store, h);
  if (pad === "/intern/api/agent/status") return json({ slim: !!env("ANTHROPIC_API_KEY"), model: env("AGENT_MODEL") || "claude-sonnet-5-5" });
  if (pad === "/intern/api/kennis") return json({ resultaten: zoekKennis(url.searchParams.get("q") || "", 8) });
  if (pad !== "/intern/api/agent" || request.method !== "POST") return json({ fout: "Onbekende route" }, 404);

  const body = await request.json().catch(() => ({}));
  const { readable, writable } = new TransformStream();
  const w = writable.getWriter();
  let open = true;
  const stuur = (d) => { if (open) w.write(sse(d)).catch(() => { open = false; }); };
  const c = { store, wie, env, h, stuur };
  (async () => {
    try {
      if (env("ANTHROPIC_API_KEY")) await slim(c, body); else await lokaal(c, body);
      stuur({ t: "klaar" });
    } catch (e) {
      stuur({ t: "fout", v: String(e.message || e).slice(0, 300) });
    } finally { open = false; w.close().catch(() => {}); }
  })();
  return new Response(readable, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
