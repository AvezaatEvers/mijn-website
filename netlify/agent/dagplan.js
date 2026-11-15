// Automatisch dagplan: werkstromen starten en sluiten zichzelf op basis van wat er speelt,
// en elke dag krijgt Koen of Daan een geordende lijst missies. De orb in het dashboard leidt erlangs.
import { PROCESSEN, proces } from "./processen.js";

const DAG = 86400000;
function plus(s, n) { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function dagenTussen(a, b) { return Math.round((Date.parse(b.slice(0, 10) + "T12:00:00Z") - Date.parse(a.slice(0, 10) + "T12:00:00Z")) / DAG); }
function id() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// Per werkstroom en stap: waar de orb naartoe wijst (p = pagina, d = element), of een stap vanzelf gaat (auto),
// na hoeveel dagen hij pas aan de beurt is (na), en welke knoppen de missiekaart toont (acties).
// Pagina's: klant, leads, klanten, kwartaal, home, inzichten, werkstromen; extern = nieuwe tab (voorstel, presentaties, werkbladen).
const G = {
  "nieuwe-lead": [
    { p: "klant", d: "[name=boekhouder]" }, { p: "klant", d: "#sub", acties: ["web"] }, { p: "klant", d: "#snel", acties: ["bel", "app"] },
    { p: "klant", d: "#lead-kaart" }, { p: "klant", d: "#tl-form", acties: ["bel", "app"] }, { p: "klant", d: "[data-contact]", acties: ["contact"] }],
  kennismaking: [
    { p: "extern", url: "/intern/kennismaking.html" }, { p: "klant", d: "#lead-kaart" }, { p: "extern", url: "/intern/kennismaking.html" },
    { p: "klant", d: "#lead-kaart" }, { p: "extern", url: "/voorstel.html?klant={k}" }, { p: "klant", d: "[data-contact]", acties: ["contact"] }],
  "voorstel-opvolgen": [
    { p: "klant", d: "#gepland", auto: true }, { p: "klant", d: "#snel", na: 5, acties: ["bel"] }, { p: "klant", d: "#snel", na: 5, acties: ["bel", "agent"] },
    { p: "klant", d: "#lead-kaart" }, { p: "klant", d: "#lead-kaart" }],
  onboarding: [
    { p: "klant", d: "#gegevens" }, { p: "klant", d: "#profiel" }, { p: "klant", d: "[data-bekijk=welkom]" }, { p: "extern-geen", acties: ["agent"] },
    { p: "extern-geen" }, { p: "extern", url: "/verwerkersovereenkomst" }, { p: "klant", d: "#tl-form" }, { p: "klant", d: "#snel", na: 14, acties: ["bel", "app"] }],
  overstap: [{ p: "klant", d: "#snel", acties: ["bel"] }, { p: "klant", d: "#tl-form" }, { p: "extern-geen", acties: ["agent"] }, { p: "extern-geen" }, { p: "klant", d: "#snel", acties: ["app"] }],
  maandverwerking: [{ p: "klant", d: "#sub" }],
  "btw-kwartaal": [{ p: "kwartaal", d: "#rijen", auto: true }, { p: "kwartaal", d: "#rijen" }, { p: "kwartaal", d: "#rijen", acties: ["agent"] }, { p: "kwartaal", d: "#rijen" }, { p: "kwartaal", d: "#rijen", acties: ["agent"] }, { p: "kwartaal", d: "#rijen" }],
  "ib-aangifte": [{ p: "klant", d: "#gepland", auto: true }, { p: "extern-geen", acties: ["agent"] }, { p: "klant", d: "#profiel", acties: ["agent"] }, { p: "extern", url: "/intern/ib-werkblad.html" }, { p: "klant", d: "#snel", acties: ["app"] }, { p: "klant", d: "#ib" }, { p: "extern-geen" }],
  jaareinde: [{ p: "home", d: "#mails", auto: true }, { p: "klanten", d: "#lijst", acties: ["agent"] }, { p: "klanten", d: "#lijst" }, { p: "extern-geen" }, { p: "klanten", d: "#lijst", acties: ["agent"] }, { p: "leads", d: "#lijst" }],
  klantvraag: [{ p: "klant", d: "#tijdlijn", auto: true }, { p: "klant", d: "#tijdlijn", acties: ["agent"] }, { p: "klant", d: "#snel", acties: ["app", "bel"] }, { p: "klant", d: "[data-contact]", acties: ["contact"] }],
  klacht: [{ p: "klant", d: "#snel", acties: ["bel"] }, { p: "klant", d: "#tijdlijn" }, { p: "klant", d: "#tl-form" }, { p: "klant", d: "[data-contact]", acties: ["contact"] }, { p: "klant", d: "#snel", na: 7, acties: ["app"] }, { p: "inzichten", d: "#adviezen" }],
  promoter: [{ p: "klant", d: "#snel", acties: ["app"] }, { p: "klant", d: "[data-bekijk=review]" }, { p: "klant", d: "#tevreden" }],
  maandgesprek: [{ p: "extern", url: "/intern/maandgesprek.html?voorbereiden=1" }, { p: "extern-geen" }, { p: "extern-geen" }, { p: "klant", d: "[data-contact]", acties: ["contact"] }],
  offboarding: [{ p: "klant", d: "#snel", acties: ["bel", "contact"] }, { p: "klant", d: "#tl-form" }, { p: "extern-geen" }, { p: "extern-geen" }, { p: "klant", d: "[name=status]" }],
  weekstart: [{ p: "leads", d: "#lijst" }, { p: "kwartaal", d: "#rijen" }, { p: "inzichten", d: "#adviezen" }, { p: "home", d: "#taken-kaart" }, { p: "extern-geen" }],
  dagafsluiting: [{ p: "home", d: "#taken-kaart" }, { p: "inzichten", d: "#recent" }, { p: "extern-geen" }, { p: "home", d: "#taken-kaart" }],
  "eigen-facturatie": [{ p: "extern-geen" }],
  "eigen-administratie": [{ p: "extern-geen" }],
  "kennisbank-artikel": [{ p: "inzichten", d: "#onderwerpen" }, { p: "extern-geen" }, { p: "extern-geen" }, { p: "extern-geen" }],
};
// Werkstromen die als één missie met checklist verschijnen in plaats van stap voor stap
const COMPACT = new Set(["maandverwerking", "eigen-facturatie", "eigen-administratie", "weekstart", "dagafsluiting", "kennisbank-artikel"]);
const PRIO = { klacht: 100, weekstart: 98, "nieuwe-lead": 95, klantvraag: 90, "voorstel-opvolgen": 80, kennismaking: 78, "btw-kwartaal": 72, onboarding: 68, "ib-aangifte": 60, overstap: 58, promoter: 50, jaareinde: 46, offboarding: 44, maandverwerking: 40, "eigen-facturatie": 36, "eigen-administratie": 32, "kennisbank-artikel": 20, dagafsluiting: 1 };
const MIN = { klacht: 15, "nieuwe-lead": 8, klantvraag: 8, "voorstel-opvolgen": 8, kennismaking: 15, "btw-kwartaal": 15, onboarding: 10, "ib-aangifte": 20, overstap: 10, promoter: 4, jaareinde: 10, offboarding: 8, maandverwerking: 35, "eigen-facturatie": 30, "eigen-administratie": 45, weekstart: 30, dagafsluiting: 10, "kennisbank-artikel": 60, maandgesprek: 30 };

function laatsteNps(k) { const n = (k.nps || []).filter((x) => x.score != null); return n[n.length - 1] || null; }
function contacten(k) { return k.contacten || []; }
function gesprekken(k) { return (k.tijdlijn || []).filter((t) => /gesprek|kennismak/i.test(t.soort + " " + t.tekst)).length + contacten(k).filter((c) => c.kanaal === "gesprek").length; }
function fase(k) { return k.voorstel ? "voorstel" : gesprekken(k) ? "gesprek" : (contacten(k).some((c) => c.richting === "wij") || (k.tijdlijn || []).some((t) => /gebeld|geappt|gemaild/.test(t.soort))) ? "contact" : "nieuw"; }
function gelogd(k, type) { return (k.log || []).some((l) => l.type === type && l.ok && !l.test); }

// ---------- Werkstromen automatisch starten en afsluiten ----------
export function synchroniseer(klanten, runs, nu) {
  let veranderd = false;
  const open = (sleutel) => runs.find((r) => r.sleutel === sleutel);
  function start(procesId, sleutel, { klant = null, wie = "samen", begin = nu } = {}) {
    if (open(sleutel)) return open(sleutel);
    const r = { id: id(), sleutel, proces: procesId, klant, wie, gestart: begin + "T08:00:00.000Z", stappen: {}, klaarOp: null, auto: true };
    runs.push(r); veranderd = true; return r;
  }
  function sluit(r, reden) { if (r && !r.klaarOp) { r.klaarOp = new Date().toISOString(); r.gesloten = reden; veranderd = true; } }
  function vink(r, i, als) { if (r && !r.klaarOp && als && !(r.stappen || {})[i]) { r.stappen[i] = { door: "auto", op: new Date().toISOString() }; veranderd = true; } }
  const salesVan = (k) => runs.filter((r) => r.klant === k.id && !r.klaarOp && ["nieuwe-lead", "kennismaking", "voorstel-opvolgen"].includes(r.proces));

  const md = nu.slice(5), maand = Number(nu.slice(5, 7)), jaar = nu.slice(0, 4), dagNr = Number(nu.slice(8, 10));
  const weekdag = new Date(nu + "T12:00:00Z").getUTCDay();

  for (const k of klanten) {
    const wie = k.boekhouder || "samen";
    if (k.status === "prospect") {
      const f = fase(k);
      const doel = f === "voorstel" ? "voorstel-opvolgen" : f === "nieuw" ? "nieuwe-lead" : "kennismaking";
      salesVan(k).filter((r) => r.proces !== doel).forEach((r) => sluit(r, "volgende fase"));
      const r = start(doel, doel + ":" + k.id + (doel === "voorstel-opvolgen" ? ":" + (k.voorstel.op || "").slice(0, 10) : ""), { klant: k.id, wie, begin: doel === "voorstel-opvolgen" ? (k.voorstel.op || nu).slice(0, 10) : nu });
      if (r.wie !== wie) { r.wie = wie; veranderd = true; }
      if (doel === "nieuwe-lead") vink(r, 0, !!k.boekhouder);
    } else {
      salesVan(k).forEach((r) => sluit(r, k.status === "klant" ? "klant geworden" : "lead afgesloten"));
    }

    if (k.status === "klant") {
      const sinds = (k.klantOp || k.start || k.aangemaakt || nu).slice(0, 10);
      if (dagenTussen(sinds, nu) <= 45 && dagenTussen(sinds, nu) >= -14) {
        const r = start("onboarding", "onboarding:" + k.id, { klant: k.id, wie, begin: sinds > nu ? nu : sinds });
        vink(r, 0, !!(k.start && k.email && k.telefoon && k.boekhouder));
        vink(r, 1, !!(k.profiel && k.profiel.branche));
        vink(r, 2, gelogd(k, "welkom"));
      }
      // Lage NPS of klacht
      const n = laatsteNps(k);
      if (n && n.score <= 6 && dagenTussen(n.op, nu) <= 30) start("klacht", "klacht:" + k.id + ":" + n.op.slice(0, 10), { klant: k.id, wie, begin: n.op.slice(0, 10) });
      const kl = contacten(k).find((c) => c.soort === "klacht" && dagenTussen(c.op, nu) <= 14);
      if (kl) { const r = start("klacht", "klacht:" + k.id + ":" + kl.op.slice(0, 10), { klant: k.id, wie, begin: kl.op.slice(0, 10) }); vink(r, 3, true); }
      if (n && n.score >= 9 && dagenTussen(n.op, nu) <= 30) {
        const r = start("promoter", "promoter:" + k.id + ":" + n.op.slice(0, 10), { klant: k.id, wie, begin: n.op.slice(0, 10) });
        vink(r, 1, gelogd(k, "review")); vink(r, 2, !!k.tevreden);
      }
      // Open klantvraag
      contacten(k).filter((c) => c.opgelost === false && dagenTussen(c.op, nu) <= 30).forEach((c) => {
        const r = start("klantvraag", "vraag:" + k.id + ":" + (c.id || c.op), { klant: k.id, wie, begin: c.op.slice(0, 10) });
        vink(r, 0, true);
      });
      // Maandverwerking vanaf de 1e, per klant
      if (dagNr >= 1) start("maandverwerking", "mv:" + k.id + ":" + nu.slice(0, 7), { klant: k.id, wie });
      // IB-aangifte maart tot en met mei
      const vorigJaar = String(Number(jaar) - 1);
      if (maand >= 3 && maand <= 5 && !(k.ib || {})[vorigJaar]) { const r = start("ib-aangifte", "ib:" + k.id + ":" + vorigJaar, { klant: k.id, wie, begin: jaar + "-03-01" }); vink(r, 0, true); }
    }
    if (k.status === "gestopt" && k.gestoptOp && dagenTussen(k.gestoptOp, nu) <= 30) start("offboarding", "stopt:" + k.id, { klant: k.id, wie });
  }

  // Ritme en periodiek
  if ([1, 4, 7, 10].includes(maand)) {
    const q = maand === 1 ? `${Number(jaar) - 1}-Q4` : `${jaar}-Q${(maand - 1) / 3}`;
    const r = start("btw-kwartaal", "btw:" + q, { begin: nu.slice(0, 8) + "01" });
    vink(r, 0, dagNr >= 3);
    if (dagNr <= 20) start("eigen-administratie", "eigenadmin:" + q);
  }
  if (md >= "11-15") { const r = start("jaareinde", "jaareinde:" + jaar, { begin: jaar + "-11-15" }); vink(r, 0, md >= "11-25"); }
  if (dagNr <= 7) start("eigen-facturatie", "facturatie:" + nu.slice(0, 7));
  if (weekdag === 1) start("weekstart", "weekstart:" + nu);
  if (weekdag >= 1 && weekdag <= 5) { start("dagafsluiting", "afsluiting:koen:" + nu, { wie: "koen" }); start("dagafsluiting", "afsluiting:daan:" + nu, { wie: "daan" }); }

  // Oude ritme-runs van eerdere dagen opruimen
  runs.forEach((r) => {
    if (!r.klaarOp && r.auto && ["weekstart", "dagafsluiting"].includes(r.proces) && r.gestart.slice(0, 10) < nu) sluit(r, "verlopen");
  });
  // Afgeronde runs ouder dan 120 dagen niet eindeloos bewaren
  const grens = plus(nu, -120);
  for (let i = runs.length - 1; i >= 0; i--) if (runs[i].klaarOp && runs[i].klaarOp.slice(0, 10) < grens) { runs.splice(i, 1); veranderd = true; }
  // Run is klaar als alle stappen af zijn
  runs.forEach((r) => { const p = proces(r.proces); if (p && !r.klaarOp && p.stappen.every((_, i) => r.stappen[i])) sluit(r, "alle stappen"); });
  return veranderd;
}

// ---------- Dagplan ----------
const PAGINA = { klant: (k) => "/intern/klant.html?id=" + encodeURIComponent(k), leads: () => "/intern/klanten.html?status=prospect", klanten: () => "/intern/klanten.html", kwartaal: () => "/intern/kwartaal.html", home: () => "/intern/", inzichten: () => "/intern/inzichten.html", werkstromen: () => "/intern/werkstromen.html" };

export function dagplan(klanten, taken, runs, wie, nu) {
  const kVan = (kid) => klanten.find((k) => k.id === kid);
  const missies = [];
  let klaarVandaag = 0;

  for (const r of runs) {
    const p = proces(r.proces); if (!p) continue;
    const vandaagGedaan = Object.values(r.stappen || {}).filter((s) => s.door === wie && (s.op || "").slice(0, 10) === nu).length;
    klaarVandaag += COMPACT.has(r.proces) ? (r.klaarOp && r.klaarOp.slice(0, 10) === nu && Object.values(r.stappen).some((s) => s.door === wie) ? 1 : 0) : vandaagGedaan;
    if (r.klaarOp) continue;
    if (r.wie !== wie && r.wie !== "samen") continue;
    if (r.later && r.later > nu) continue;
    const k = r.klant ? kVan(r.klant) : null;
    if (r.klant && !k) continue;
    const g = G[r.proces] || [];
    const sinds = dagenTussen(r.gestart, nu);
    const klant = k ? { id: k.id, naam: k.bedrijf || k.naam, contact: k.naam, telefoon: k.telefoon || "", email: k.email || "", website: (k.lead || {}).website || "" } : null;
    let prio = PRIO[r.proces] || 30;
    if (r.proces === "nieuwe-lead" && k) { const uren = (Date.now() - Date.parse((k.lead || {}).op || k.aangemaakt || nu)) / 36e5; if (uren < 24) prio += 4; }
    if (r.proces === "btw-kwartaal") { const deadline = nu.slice(0, 8) + (nu.slice(5, 7) === "04" ? "30" : "31"); const rest = dagenTussen(nu, deadline); prio += rest <= 7 ? 25 : rest <= 14 ? 10 : 0; }
    if (r.proces === "weekstart" && new Date().getUTCHours() >= 11) prio = 60;

    if (COMPACT.has(r.proces)) {
      const gi = g[0] || {};
      missies.push({ id: "r:" + r.id + ":*", soort: "checklist", proces: { id: p.id, titel: p.titel }, titel: p.titel + (klant ? ": " + klant.naam : ""), uitleg: p.doel,
        checklist: p.stappen.map((s, i) => ({ i, t: s.t, u: s.u, klaar: !!r.stappen[i] })), klant, prio, minuten: MIN[r.proces] || 15,
        url: gi.p && PAGINA[gi.p] ? PAGINA[gi.p](r.klant) : (gi.url || null), doel: gi.d || null, extern: gi.p === "extern", acties: klant ? ["bel", "app"] : [] });
      continue;
    }
    // Eerste openstaande stap die nu aan de beurt is
    let i = p.stappen.findIndex((_, j) => !r.stappen[j] && !(g[j] && g[j].auto));
    if (i < 0) continue;
    const gi = g[i] || {};
    if (gi.na && sinds < gi.na) continue;
    const s = p.stappen[i];
    let url = null, extern = false;
    if (gi.p === "extern") { url = (gi.url || "").replace("{k}", encodeURIComponent(r.klant || "")); extern = true; }
    else if (gi.p && PAGINA[gi.p]) url = PAGINA[gi.p](r.klant);
    missies.push({ id: "r:" + r.id + ":" + i, soort: "stap", proces: { id: p.id, titel: p.titel }, titel: s.t, uitleg: s.u, vraag: s.vraag || null,
      stap: { nr: i + 1, totaal: p.stappen.length }, klant, prio: prio - i * 0.1, minuten: Math.max(3, Math.round((MIN[r.proces] || 10) / 2)),
      url, doel: gi.d || (s.actie === "contact" ? "[data-contact]" : null), extern, acties: (gi.acties || []).concat(s.actie === "contact" && !(gi.acties || []).includes("contact") ? ["contact"] : []) });
  }

  // Taken met een deadline van vandaag of eerder
  for (const t of taken || []) {
    if (t.klaar) { if ((t.klaarOp || "").slice(0, 10) === nu && t.klaarDoor === wie) klaarVandaag++; continue; }
    if (!(t.voor === wie || t.voor === "samen")) continue;
    if (!t.deadline || t.deadline > nu) continue;
    const k = t.klant ? kVan(t.klant) : null;
    missies.push({ id: "t:" + t.id, soort: "taak", proces: { id: "taak", titel: t.deadline < nu ? "Taak, te laat" : "Taak voor vandaag" }, titel: t.titel, uitleg: t.notitie || (t.deadline < nu ? "Deze taak stond voor " + t.deadline + "." : "Staat voor vandaag op de takenlijst."),
      klant: k ? { id: k.id, naam: k.bedrijf || k.naam, contact: k.naam, telefoon: k.telefoon || "", email: k.email || "" } : null,
      prio: t.deadline < nu ? 85 : 62, minuten: 10, url: k ? PAGINA.klant(k.id) : "/intern/", doel: k ? "#taken" : "#taken-kaart", extern: false, acties: k ? ["bel", "app"] : [] });
  }

  missies.sort((a, b) => b.prio - a.prio);
  // Maximaal 3 maandverwerkingen per dag, zodat de dag behapbaar blijft; de rest schuift door
  let mv = 0;
  const plan = missies.filter((m) => m.proces.id !== "maandverwerking" || ++mv <= 3);
  const afsl = plan.findIndex((m) => m.proces.id === "dagafsluiting");
  if (afsl >= 0) plan.push(plan.splice(afsl, 1)[0]);
  return { datum: nu, wie, missies: plan, klaarVandaag, minuten: plan.reduce((s, m) => s + m.minuten, 0), doorgeschoven: Math.max(0, mv - 3) };
}

// Een missie afvinken of uitstellen
export function verwerkMissie(runs, taken, missieId, wie, nu, actie = "klaar") {
  const [soort, rid, stap] = String(missieId).split(":");
  if (soort === "t") {
    const t = (taken || []).find((x) => x.id === rid); if (!t) return { fout: "Taak niet gevonden" };
    if (actie === "later") t.deadline = plus(nu, 1);
    else { t.klaar = true; t.klaarDoor = wie; t.klaarOp = new Date().toISOString(); }
    return { ok: true, taken: true };
  }
  const r = runs.find((x) => x.id === rid); if (!r) return { fout: "Werkstroom niet gevonden" };
  const p = proces(r.proces);
  if (actie === "later") { r.later = plus(nu, 1); return { ok: true }; }
  const op = new Date().toISOString();
  if (stap === "*") p.stappen.forEach((_, i) => { if (!r.stappen[i]) r.stappen[i] = { door: wie, op }; });
  else r.stappen[Number(stap)] = { door: wie, op };
  if (p.stappen.every((_, i) => r.stappen[i])) r.klaarOp = op;
  return { ok: true };
}

export { G as GIDS, COMPACT };
