// Pushmeldingen naar de telefoons en laptops van Koen en Daan (Web Push, gratis, geen externe dienst).
// De VAPID-sleutels maakt de site zelf aan bij het eerste gebruik en bewaart ze in Netlify Blobs.
// Alleen voor Node-functies: de edge function heeft geen web-push.
import webpush from "web-push";

const SLEUTEL = "push";
export const SOORTEN = {
  lead: { naam: "Nieuwe lead", uitleg: "Iemand vult de prijscheck of het kennismakingsformulier op de site in." },
  wacht: { naam: "Lead wacht te lang", uitleg: "Een nieuwe lead is na 2 uur nog niet opgepakt (geen contact vastgelegd)." },
  ochtend: { naam: "Ochtendoverzicht", uitleg: "Elke werkdag om 8:30: wat er vandaag te doen is." },
};
export const MENSEN = ["koen", "daan"];

export async function laadPush(store) {
  const d = (await store.get(SLEUTEL, { type: "json" })) || {};
  d.abonnementen = d.abonnementen || [];
  d.voorkeuren = d.voorkeuren || {};
  d.gemeld = d.gemeld || {};
  if (!d.vapid) {
    d.vapid = webpush.generateVAPIDKeys();
    await store.setJSON(SLEUTEL, d);
  }
  return d;
}
export const bewaarPush = (store, d) => store.setJSON(SLEUTEL, d);

export function voorkeurVan(d, wie) {
  const v = d.voorkeuren[wie] || {};
  return Object.fromEntries(Object.keys(SOORTEN).map((s) => [s, v[s] !== false]));
}

// Stuurt een melding naar alle apparaten van de genoemde mensen die deze soort aan hebben staan.
// Verlopen abonnementen (404/410) ruimen we meteen op.
export async function stuur(store, wie, soort, bericht) {
  const d = await laadPush(store);
  webpush.setVapidDetails("mailto:info@avezaatenevers.nl", d.vapid.publicKey, d.vapid.privateKey);
  const doel = d.abonnementen.filter((a) => wie.includes(a.wie) && (soort === "test" || voorkeurVan(d, a.wie)[soort]));
  const weg = [];
  let ok = 0;
  for (const a of doel) {
    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: a.keys }, JSON.stringify({ tag: soort, ...bericht }),
        { TTL: soort === "ochtend" ? 4 * 3600 : 12 * 3600, urgency: soort === "ochtend" ? "normal" : "high" });
      ok++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) weg.push(a.endpoint);
      else console.error("Push mislukt:", e.statusCode || "", String(e.body || e.message).slice(0, 200));
    }
  }
  if (weg.length) {
    const vers = await laadPush(store);
    vers.abonnementen = vers.abonnementen.filter((a) => !weg.includes(a.endpoint));
    await bewaarPush(store, vers);
  }
  return { ok, totaal: doel.length };
}

// Uur en minuut in Nederland (Netlify draait in UTC)
export function nlTijd(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return { uur: Number(p.hour), minuut: Number(p.minute), dag: p.weekday };
}
