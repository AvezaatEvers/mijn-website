// Draait automatisch bij elk verstuurd Netlify-formulier op de live site.
// Kennismaking en prijscheck: mail naar de bezoeker, melding naar jullie, en de lead als prospect in Klanten.
import { getStore } from "@netlify/blobs";
import { mails } from "./lib/mails.js";
import { verstuur, BASE } from "../klant-mails.js";

const SITUATIE_KENNISMAKING = { "Ik ben net gestart": "start", "Ik wil overstappen van boekhouder": "boekhouder", "Ik doe het nu zelf": "zelf" };
const schoon = (s, n = 200) => String(s || "").replace(/[<>]/g, "").trim().slice(0, n);
const mailadres = (e) => { const v = String(e || "").trim().toLowerCase(); return /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/.test(v) ? v : ""; };
const nieuweId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

export default async (req) => {
  const { payload } = await req.json().catch(() => ({}));
  if (!payload) return new Response("geen payload", { status: 400 });
  const formulier = payload.form_name;
  if (!["kennismaking", "prijscheck"].includes(formulier)) return new Response("overgeslagen");
  const d = payload.data || {};
  if (d["bot-field"]) return new Response("spam");

  const env = (k) => process.env[k];
  const email = mailadres(d.email);
  const lead = {
    bron: formulier, op: new Date().toISOString(),
    situatie: formulier === "prijscheck" ? schoon(d.situatie, 30) : (SITUATIE_KENNISMAKING[d.situatie] || ""),
    situatieTekst: schoon(d.situatie, 80), transacties: schoon(d.transacties, 30), branche: schoon(d.branche, 60),
    eu: schoon(d.eu, 10), partner: schoon(d.partner, 10), prijs: schoon(d.prijs, 40), bericht: schoon(d.bericht, 2000),
  };
  const gegevens = { naam: schoon(d.naam, 120), email, telefoon: schoon(d.telefoon, 30), ...lead, situatie: formulier === "prijscheck" ? lead.situatie : lead.situatieTekst };

  // 1. Mail naar de bezoeker
  if (email) {
    const m = formulier === "prijscheck" ? mails.prijscheck(gegevens, BASE) : mails.kennismaking(gegevens, BASE);
    const r = await verstuur(env, { aan: email, mail: m });
    if (!r.ok) console.error("Bevestiging niet verstuurd:", r.fout);
  }
  // 2. Melding naar jullie
  const ontvangers = String(env("MAIL_TO") || "info@avezaatenevers.nl").split(",").map((x) => x.trim()).filter(Boolean);
  const melding = mails.intern(gegevens, BASE, formulier);
  for (const aan of ontvangers) await verstuur(env, { aan, mail: melding });

  // 3. Lead in Klanten
  try {
    const store = getStore({ name: "intern", consistency: "strong" });
    const klanten = (await store.get("klanten", { type: "json" })) || [];
    let k = email ? klanten.find((x) => x.email === email) : null;
    const nu = new Date().toISOString();
    if (!k) {
      k = { id: nieuweId(), naam: gegevens.naam, bedrijf: "", email, telefoon: gegevens.telefoon, boekhouder: "", status: "prospect", start: "", voorstelLink: "", notitie: "", uit: [], verstuurd: {}, log: [], tijdlijn: [], door: "formulier", aangemaakt: nu };
      klanten.push(k);
    }
    if (k.status !== "klant") {
      if (k.status !== "prospect") k.status = "prospect";
      k.lead = lead;
      if (!k.telefoon && gegevens.telefoon) k.telefoon = gegevens.telefoon;
      if (!k.naam && gegevens.naam) k.naam = gegevens.naam;
    }
    k.tijdlijn = k.tijdlijn || [];
    k.tijdlijn.unshift({ id: nieuweId(), soort: "notitie", tekst: `Formulier ${formulier} ingevuld${lead.prijs ? ` (prijs ${lead.prijs})` : ""}${lead.bericht ? `: ${lead.bericht}` : ""}`.slice(0, 1000), op: nu, door: "formulier" });
    await store.setJSON("klanten", klanten);
  } catch (e) {
    console.error("Lead niet opgeslagen:", e.message);
  }
  return new Response("ok");
};
