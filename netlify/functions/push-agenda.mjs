// Elke maandag om 9:00 (Nederlandse tijd): een pushmelding om de beschikbaarheid voor kennismakingen te controleren,
// met per persoon het aantal vrije momenten en de kennismakingen van deze week.
// Netlify plant in UTC, dus we draaien om 7:00 en 8:00 UTC en sturen alleen als het in Nederland 9 uur is.
import { getStore } from "@netlify/blobs";
import { stuur, laadPush, voorkeurVan, nlTijd, MENSEN } from "../push.js";
import { leesBeschikbaarheid, leesAfspraken, vrijeTijden, vooruitDagen } from "./lib/planner.js";
import { bezetVoor, leesApple, bezetStatus } from "./lib/apple.js";

const NAAM = { koen: "Koen", daan: "Daan" };

export async function agendaCheck(store, env, opties = {}) {
  if (!opties.altijd && nlTijd().uur !== 9) return { overgeslagen: "niet 9 uur in Nederland" };
  const d = await laadPush(store);
  const [b, lijst, bezet, apple, status] = await Promise.all([leesBeschikbaarheid(store), leesAfspraken(store), bezetVoor(store, env), leesApple(store), bezetStatus(store)]);
  const vrij = vrijeTijden(b, lijst, new Date(), { bezet });
  const weken = vooruitDagen(b) / 7, nu = Date.now(), weekEind = nu + 7 * 864e5;
  const uit = {};
  for (const wie of MENSEN) {
    if (!d.abonnementen.some((a) => a.wie === wie) || !voorkeurVan(d, wie).agenda) continue;
    const mijnVrij = vrij.filter((t) => t.wie.includes(wie)).length;
    const dezeWeek = lijst.filter((a) => a.wie === wie && a.status !== "geannuleerd" && new Date(a.start).getTime() > nu && new Date(a.start).getTime() < weekEind).length;
    const zonderTijden = !Object.keys((b[wie] || {}).week || {}).length;
    const appleFout = apple[wie] && (status[wie] || {}).fout;
    const delen = [];
    if (zonderTijden) delen.push("Je hebt nog geen vaste tijden ingesteld, dus klanten kunnen niet bij jou boeken.");
    else if (!mijnVrij) delen.push(`Je hebt geen vrije momenten in de komende ${weken} ${weken === 1 ? "week" : "weken"}, dus klanten kunnen niet bij jou boeken.`);
    else delen.push(`${mijnVrij} vrije ${mijnVrij === 1 ? "moment" : "momenten"} in de komende ${weken} ${weken === 1 ? "week" : "weken"}.`);
    if (dezeWeek) delen.push(`${dezeWeek} ${dezeWeek === 1 ? "kennismaking" : "kennismakingen"} deze week.`);
    if (appleFout) delen.push("Let op: je Apple Agenda kon niet worden gelezen.");
    delen.push("Kloppen je tijden en dichte dagen nog?");
    uit[wie] = await stuur(store, [wie], "agenda", { title: "Check je agenda, " + NAAM[wie], body: delen.join(" "), url: "/intern/beschikbaarheid.html#tijden" });
  }
  return uit;
}

export default async () => {
  const r = await agendaCheck(getStore({ name: "intern", consistency: "strong" }), (k) => process.env[k]);
  console.log("Agenda controleren:", JSON.stringify(r));
  return new Response("ok");
};

export const config = { schedule: "0 7,8 * * 1" };
