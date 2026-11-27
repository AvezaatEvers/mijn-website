// Werkdagen om 8:30 (Nederlandse tijd): een korte dagstart-melding (geen takenlijst, gewoon even afstemmen).
// Netlify plant in UTC, dus we draaien om 6:30 en 7:30 UTC en sturen alleen als het in Nederland 8 uur is.
import { getStore } from "@netlify/blobs";
import { stuur, laadPush, voorkeurVan, nlTijd, MENSEN } from "../push.js";

const NAAM = { koen: "Koen", daan: "Daan" };

export async function ochtend(store, env, opties = {}) {
  if (!opties.altijd && nlTijd().uur !== 8) return { overgeslagen: "niet 8 uur in Nederland" };
  const d = await laadPush(store);
  const uit = {};
  for (const wie of MENSEN) {
    if (!d.abonnementen.some((a) => a.wie === wie) || !voorkeurVan(d, wie).ochtend) continue;
    const ander = NAAM[wie === "koen" ? "daan" : "koen"];
    uit[wie] = await stuur(store, [wie], "ochtend", { title: "Dagstart", body: `Goedemorgen ${NAAM[wie]}. Bespreek even met ${ander} wat jullie vandaag gaan doen.`, url: "/intern/" });
  }
  return uit;
}

export default async () => {
  const r = await ochtend(getStore({ name: "intern", consistency: "strong" }), (k) => process.env[k]);
  console.log("Dagstart:", JSON.stringify(r));
  return new Response("ok");
};

export const config = { schedule: "30 6,7 * * 1-5" };
