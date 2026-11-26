// IndexNow: meldt na elke geslaagde productiedeploy de gewijzigde pagina's bij Bing (en de andere
// IndexNow-zoekmachines). Netlify voert een functie met deze naam vanzelf uit na elke geslaagde deploy.
// Welke pagina's gewijzigd zijn, halen we uit <lastmod> in sitemap.xml: houd die dus bij.
// De sleutel is niet geheim; hij staat ook openbaar in /<sleutel>.txt in de root van de site.
import { getStore } from "@netlify/blobs";

const SITE = "https://avezaatenevers.nl";
const SLEUTEL = "f42ea39f717d4a22b4a55ec378b1aa2e";
const BLOB = "indexnow-laatste-melding"; // datum (JJJJ-MM-DD) van de laatste geslaagde melding

export default async (request) => {
  const body = await request.json().catch(() => ({}));
  const deploy = body.payload || {};

  // Alleen de live site; branch deploys (zoals concept) en previews niet melden
  if (deploy.context !== "production") {
    console.log(`IndexNow: overgeslagen (context ${deploy.context || "onbekend"}, branch ${deploy.branch || "onbekend"})`);
    return new Response("overgeslagen");
  }

  const store = getStore({ name: "intern", consistency: "strong" });
  const vorige = await store.get(BLOB); // null bij de eerste keer: dan alles melden

  const res = await fetch(`${SITE}/sitemap.xml`, { headers: { "Cache-Control": "no-cache" } });
  if (!res.ok) {
    console.log(`IndexNow: sitemap niet opgehaald (${res.status})`);
    return new Response("sitemap niet opgehaald", { status: 500 });
  }
  const xml = await res.text();

  const urls = [];
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = (m[1].match(/<loc>\s*([^<\s]+)\s*<\/loc>/) || [])[1];
    const lastmod = ((m[1].match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/) || [])[1] || "").slice(0, 10);
    if (!loc || !loc.startsWith(SITE + "/")) continue;
    // Ook gelijk aan de vorige datum meesturen: een tweede publicatie op dezelfde dag kan nieuwe wijzigingen hebben
    if (!vorige || !lastmod || lastmod >= vorige) urls.push(loc);
  }

  const vandaag = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" }); // JJJJ-MM-DD

  if (!urls.length) {
    console.log(`IndexNow: niets gewijzigd sinds ${vorige}`);
    return new Response("niets te melden");
  }

  const melding = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: new URL(SITE).host, key: SLEUTEL, keyLocation: `${SITE}/${SLEUTEL}.txt`, urlList: urls }),
  });
  const tekst = await melding.text().catch(() => "");
  console.log(`IndexNow: ${urls.length} URL's gemeld, antwoord ${melding.status} ${tekst.slice(0, 200)}\n${urls.join("\n")}`);

  // 200 = ontvangen, 202 = ontvangen, sleutel wordt nog gecontroleerd
  if (melding.status === 200 || melding.status === 202) await store.set(BLOB, vandaag);
  return new Response(`IndexNow ${melding.status}`);
};
