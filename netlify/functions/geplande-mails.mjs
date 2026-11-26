// Verstuurt elke ochtend de geplande klantmails (check-in, kwartaal, jaareinde, IB).
// Draait alleen op de live site (Netlify voert geplande functies niet uit op branch deploys).
import { getStore } from "@netlify/blobs";
import { teVersturen, maakMail, verstuur, vandaag, TYPES } from "../klant-mails.js";
import { log } from "../logboek.js";

export default async () => {
  const store = getStore({ name: "intern", consistency: "strong" });
  const klanten = (await store.get("klanten", { type: "json" })) || [];
  const env = (k) => process.env[k];
  const nu = vandaag();
  let verstuurd = 0, mislukt = 0;
  const regels = [];

  for (const k of klanten) {
    if (!k.email) continue;
    for (const moment of teVersturen(k, nu, env)) {
      const mail = maakMail(k, moment.type, moment.data, env);
      const r = await verstuur(env, { aan: k.email, mail });
      k.log = k.log || [];
      k.log.unshift({ type: moment.type, onderwerp: mail.subject, aan: k.email, op: new Date().toISOString(), door: "gepland", test: false, ok: r.ok, fout: r.fout || null, sleutel: moment.sleutel });
      k.log = k.log.slice(0, 100);
      if (r.ok) { k.verstuurd = { ...(k.verstuurd || {}), [moment.sleutel]: new Date().toISOString() }; verstuurd++; }
      else mislukt++;
      regels.push({ wie: "systeem", soort: "mail", tekst: "Automatische mail " + (r.ok ? "verstuurd: " : "mislukt: ") + mail.subject, klant: k });
    }
  }
  await store.setJSON("klanten", klanten);
  await log(store, regels);
  console.log(`Geplande mails ${nu}: ${verstuurd} verstuurd, ${mislukt} mislukt (${Object.keys(TYPES).length} types)`);
  return new Response("ok");
};

// Elke dag om 07:00 UTC (08:00 in de winter, 09:00 in de zomer)
export const config = { schedule: "0 7 * * *" };
