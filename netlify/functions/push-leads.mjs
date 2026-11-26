// Elk half uur: staat er een nieuwe lead die na 2 uur nog door niemand is opgepakt? Dan een pushmelding.
// We beloven op de site reactie binnen 2 uur. Eén melding per lead, alleen tussen 8:00 en 21:00.
// Draait alleen op de live site (Netlify voert geplande functies niet uit op branch deploys).
import { getStore } from "@netlify/blobs";
import { leadInfo } from "../overzicht.js";
import { laadPush, bewaarPush, stuur, nlTijd, MENSEN } from "../push.js";

export async function controleerLeads(store, nu = new Date()) {
  const { uur } = nlTijd(nu);
  if (uur < 8 || uur >= 21) return { overgeslagen: "buiten werktijd" };
  const klanten = (await store.get("klanten", { type: "json" })) || [];
  const d = await laadPush(store);
  const grens = nu.getTime() - 30 * 864e5;
  for (const [id, op] of Object.entries(d.gemeld)) if (Date.parse(op) < grens) delete d.gemeld[id];

  const wachtend = klanten.filter((k) => k.status === "prospect" && k.lead && k.lead.op && !d.gemeld["wacht:" + k.id]
    && (nu.getTime() - Date.parse(k.lead.op)) / 36e5 >= 2 && (nu.getTime() - Date.parse(k.lead.op)) / 864e5 < 3
    && leadInfo(k).fase === "nieuw");
  let gestuurd = 0;
  for (const k of wachtend) {
    const uren = Math.floor((nu.getTime() - Date.parse(k.lead.op)) / 36e5);
    const wie = MENSEN.includes(k.boekhouder) ? [k.boekhouder] : MENSEN;
    const r = await stuur(store, wie, "wacht", {
      title: (k.bedrijf || k.naam || "Een lead") + " wacht al " + uren + " uur",
      body: "Nog geen contact vastgelegd. Bel of app nu, we beloven reactie binnen 2 uur.",
      url: "/intern/klant.html?id=" + encodeURIComponent(k.id), tag: "wacht-" + k.id,
    });
    gestuurd += r.ok;
    d.gemeld["wacht:" + k.id] = nu.toISOString();
  }
  const vers = await laadPush(store);
  vers.gemeld = { ...vers.gemeld, ...d.gemeld };
  for (const id of Object.keys(vers.gemeld)) if (!(id in d.gemeld)) delete vers.gemeld[id];
  await bewaarPush(store, vers);
  return { wachtend: wachtend.length, gestuurd };
}

export default async () => {
  const r = await controleerLeads(getStore({ name: "intern", consistency: "strong" }));
  console.log("Lead-controle:", JSON.stringify(r));
  return new Response("ok");
};

export const config = { schedule: "*/30 * * * *" };
