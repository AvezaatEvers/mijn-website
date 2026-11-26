// Werkdagen om 8:30 (Nederlandse tijd): het ochtendoverzicht als pushmelding.
// Netlify plant in UTC, dus we draaien om 6:30 en 7:30 UTC en sturen alleen als het in Nederland 8 uur is.
import { getStore } from "@netlify/blobs";
import { agentHulp } from "../intern-logica.js";
import { agentApi } from "../agent/agent.js";
import { stuur, laadPush, voorkeurVan, nlTijd, MENSEN } from "../push.js";

const NAAM = { koen: "Koen", daan: "Daan" };
function duur(m) { return m >= 60 ? Math.floor(m / 60) + " uur" + (m % 60 >= 15 ? " en " + (m % 60) + " minuten" : "") : m + " minuten"; }

export async function ochtend(store, env, opties = {}) {
  if (!opties.altijd && nlTijd().uur !== 8) return { overgeslagen: "niet 8 uur in Nederland" };
  const d = await laadPush(store);
  const h = agentHulp(env);
  const uit = {};
  for (const wie of MENSEN) {
    if (!d.abonnementen.some((a) => a.wie === wie) || !voorkeurVan(d, wie).ochtend) continue;
    const url = new URL("https://intern.local/intern/api/dagplan");
    const r = await agentApi(new Request(url), url, url.pathname, wie, store, env, h);
    const p = await r.json().catch(() => null);
    if (!p || !p.missies) continue;
    const n = p.missies.length, eerste = p.missies[0];
    const body = n
      ? n + (n === 1 ? " taak" : " taken") + ", ongeveer " + duur(p.minuten) + "." + (eerste ? " Eerst: " + eerste.titel.charAt(0).toLowerCase() + eerste.titel.slice(1) + (eerste.klant ? " bij " + eerste.klant.naam : "") + "." : "")
      : "Niets dringends vandaag. Mooie dag om vooruit te werken.";
    uit[wie] = await stuur(store, [wie], "ochtend", { title: "Goedemorgen " + NAAM[wie], body, url: "/intern/" });
  }
  return uit;
}

export default async () => {
  const r = await ochtend(getStore({ name: "intern", consistency: "strong" }), (k) => process.env[k]);
  console.log("Ochtendoverzicht:", JSON.stringify(r));
  return new Response("ok");
};

export const config = { schedule: "30 6,7 * * 1-5" };
