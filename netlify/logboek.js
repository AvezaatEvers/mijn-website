// Logboek: één regel voor elke wijziging in het dashboard, door Koen, Daan, de agent, Claude of het systeem.
// Bewaard per dag (logboek/JJJJ-MM-DD) in de Blobs-store "intern". Schrijven gebeurt met een ETag-controle,
// zodat twee gelijktijdige acties elkaars regels niet overschrijven.
// Een fout in het logboek mag een actie nooit laten mislukken: alles staat in try/catch.
const PREFIX = "logboek/";
const SINDS = "logboek-sinds"; // tijdstip van de allereerste regel; daarvoor bouwt activiteit() de lijst nog op uit de dossiers

export const dagVan = (iso) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" });

// regel: { wie, via, soort, tekst, klant }  wie: koen | daan | systeem   klant: klantobject of { id, naam }
export async function log(store, regels) {
  try {
    const lijst = (Array.isArray(regels) ? regels : [regels]).filter((r) => r && r.tekst);
    if (!store || !lijst.length) return;
    const nu = new Date().toISOString();
    const nieuw = lijst.map((r) => ({
      id: crypto.randomUUID(), op: nu, wie: r.wie || "systeem", via: r.via || null, soort: r.soort || "overig",
      tekst: String(r.tekst).replace(/\s+/g, " ").trim().slice(0, 300),
      klant: r.klant && r.klant.id ? { id: r.klant.id, naam: r.klant.bedrijf || r.klant.naam || "" } : null,
    }));
    const sleutel = PREFIX + dagVan(nu);

    // Zonder ETag-ondersteuning (bijv. een nepopslag in een test): gewoon lezen en schrijven
    if (typeof store.getWithMetadata !== "function") {
      const oud = (await store.get(sleutel, { type: "json" })) || [];
      await store.setJSON(sleutel, oud.concat(nieuw));
      if (!(await store.get(SINDS))) await store.setJSON(SINDS, nu);
      return;
    }
    for (let poging = 0; poging < 6; poging++) {
      if (poging) await new Promise((r) => setTimeout(r, 10 + Math.random() * 30 * poging));
      const oud = await store.getWithMetadata(sleutel, { type: "json" });
      const data = oud && Array.isArray(oud.data) ? oud.data : [];
      const r = await store.setJSON(sleutel, data.concat(nieuw), oud ? { onlyIfMatch: oud.etag } : { onlyIfNew: true });
      if (!r || r.modified !== false) {
        if (!oud) await store.setJSON(SINDS, nu, { onlyIfNew: true });
        return;
      }
    }
    // Vangnet bij veel gelijktijdige acties: de regels onder een eigen sleutel, die altijd nieuw is
    await store.setJSON(sleutel + "/" + nieuw[0].id, nieuw);
    await store.setJSON(SINDS, nu, { onlyIfNew: true });
  } catch (e) {
    console.error("Logboek:", e.message);
  }
}

// Leest de regels van de afgelopen dagen. sinds = tijdstip van de eerste logboekregel ooit (null als er nog geen is).
export async function leesLogboek(store, dagen) {
  try {
    const sinds = await store.get(SINDS, { type: "json" });
    if (!sinds) return { sinds: null, items: [] };
    const eerste = dagVan(sinds), sleutels = new Set();
    for (let i = 0; i <= dagen + 1; i++) {
      const d = dagVan(new Date(Date.now() - i * 864e5).toISOString());
      if (d < eerste) break;
      sleutels.add(PREFIX + d);
    }
    // Ook de losse vangnetsleutels (logboek/JJJJ-MM-DD/<id>) meenemen
    if (typeof store.list === "function") {
      const losse = await Promise.all([...sleutels].map((s) => store.list({ prefix: s + "/" }).catch(() => ({ blobs: [] }))));
      for (const l of losse) for (const b of l.blobs || []) sleutels.add(b.key);
    }
    const delen = await Promise.all([...sleutels].map((s) => store.get(s, { type: "json" }).catch(() => null)));
    const items = delen.flatMap((d) => (Array.isArray(d) ? d : []));
    const gezien = new Set();
    return { sinds, items: items.filter((x) => !gezien.has(x.id) && gezien.add(x.id)) };
  } catch (e) {
    console.error("Logboek lezen:", e.message);
    return { sinds: null, items: [] };
  }
}

// Korte omschrijving van wat er aan een klant veranderde, voor "Gegevens bijgewerkt: ..."
const STATUS = { prospect: "lead", klant: "klant", gestopt: "gestopt", verloren: "verloren" };
const NAAM = { koen: "Koen", daan: "Daan", "": "niemand" };
const HERKOMST = { moneymonk: "MoneyMonk", trustoo: "Trustoo", netwerk: "eigen netwerk", google: "Google", website: "website", anders: "anders", "": "geen" };
const jn = (b) => (b ? "ja" : "nee");
export function klantVerschil(oud, nieuw) {
  const uit = [];
  const pijl = (lbl, a, b) => uit.push(lbl + " " + a + " → " + b);
  if (oud.status !== nieuw.status) pijl("status", STATUS[oud.status] || oud.status, STATUS[nieuw.status] || nieuw.status);
  if ((oud.boekhouder || "") !== (nieuw.boekhouder || "")) pijl("boekhouder", NAAM[oud.boekhouder || ""], NAAM[nieuw.boekhouder || ""]);
  if ((oud.herkomst || "") !== (nieuw.herkomst || "")) pijl("bron", HERKOMST[oud.herkomst || ""] || oud.herkomst, HERKOMST[nieuw.herkomst || ""] || nieuw.herkomst);
  if ((oud.start || "") !== (nieuw.start || "")) pijl("startdatum", oud.start || "geen", nieuw.start || "geen");
  if (!!oud.pastNiet !== !!nieuw.pastNiet) pijl("past niet", jn(oud.pastNiet), jn(nieuw.pastNiet));
  if (oud.tevreden !== nieuw.tevreden && nieuw.tevreden !== undefined) pijl("tevreden", oud.tevreden === undefined ? "onbekend" : jn(oud.tevreden), jn(nieuw.tevreden));
  for (const [v, lbl] of [["naam", "naam"], ["bedrijf", "bedrijf"], ["email", "e-mailadres"], ["telefoon", "telefoon"], ["voorstelLink", "voorstellink"], ["notitie", "notitie"]])
    if ((oud[v] || "") !== (nieuw[v] || "")) uit.push(lbl);
  if (JSON.stringify(oud.uit || []) !== JSON.stringify(nieuw.uit || [])) uit.push("automatische mails");
  const po = oud.profiel || {}, pn = nieuw.profiel || {};
  for (const [v, lbl] of [["kor", "KOR"], ["icp", "ICP"], ["partner", "partner"], ["urencriterium", "urencriterium"]])
    if (!!po[v] !== !!pn[v]) pijl(lbl, jn(po[v]), jn(pn[v]));
  if ((po.branche || "") !== (pn.branche || "")) pijl("branche", po.branche || "geen", pn.branche || "geen");
  return uit;
}
