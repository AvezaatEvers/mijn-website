// Zoeken in de kennis van de agent: eigen basiskennis + onze sitepagina's.
import { KENNIS_BASIS } from "./kennis-basis.js";
import { KENNIS_SITE } from "./kennis-site.js";

export const KENNIS = [...KENNIS_BASIS, ...KENNIS_SITE];

const STOP = new Set("de het een en of in op aan van voor met bij als dat die dit is zijn wordt worden je jij ik we wij mijn mij hoe wat wie waar wanneer waarom welke moet moeten kan kunnen mag mogen te om er ook nog niet wel dan maar naar over uit tot door zo heb hebben heeft had was u uw ze hij zij".split(" "));

export function tokens(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9%€ ]+/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => (w.length > 6 ? w.slice(0, 6) : w)); // grove stam: btw-aangifte/aangiftes/aangifte vallen samen
}

const INDEX = KENNIS.map((k) => {
  const tf = new Map();
  const add = (s, gewicht) => tokens(s).forEach((t) => tf.set(t, (tf.get(t) || 0) + gewicht));
  add(k.titel, 3); add(k.tags, 2.5); add(k.tekst, 1);
  return { k, tf, len: tokens(k.tekst).length + 20 };
});
const DF = new Map();
INDEX.forEach(({ tf }) => tf.forEach((_, t) => DF.set(t, (DF.get(t) || 0) + 1)));
const N = INDEX.length, GEM = INDEX.reduce((s, x) => s + x.len, 0) / N;

const SYN = [
  [/creditnota|crediteren/, " creditfactuur verrekenen"],
  [/duitsland|belgi|frankrijk|spanje|europ|buitenland/, " eu icp verlegd"],
  [/betaal\S* .*niet|niet .*betaald|wanbetal|achterstallige betaling/, " herinnering aanmaning oninbaar open posten incasso"],
  [/bonnetje|bon kwijt/, " bewijsstuk archief"],
  [/\bauto\b|lease/, " bijtelling kilometervergoeding privégebruik"],
  [/laptop|computer|telefoon/, " bedrijfsmiddel afschrijven kia"],
  [/te laat|boete/, " verzuimboete deadline"],
];

export function zoekKennis(vraag, n = 5) {
  const l = String(vraag || "").toLowerCase();
  for (const [re, extra] of SYN) if (re.test(l)) vraag += extra;
  const q = [...new Set(tokens(vraag))];
  if (!q.length) return [];
  const uit = INDEX.map(({ k, tf, len }) => {
    let s = 0;
    for (const t of q) {
      let f = tf.get(t) || 0;
      if (!f && t.length >= 4) for (const [w, v] of tf) if (w.startsWith(t) || t.startsWith(w) && w.length >= 4) f += v * 0.6;
      if (!f) continue;
      const idf = Math.log(1 + (N - (DF.get(t) || 1) + 0.5) / ((DF.get(t) || 1) + 0.5));
      s += idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * len / GEM));
    }
    if (k.groep !== "Kennisbank" && k.groep !== "Website") s *= 1.15; // basiskennis is compacter
    return { k, s };
  }).filter((x) => x.s > 0.5).sort((a, b) => b.s - a.s);
  // Niet drie stukjes van dezelfde pagina-sectie bovenaan
  const gezien = new Map(), res = [];
  for (const x of uit) {
    const sleutel = x.k.bron || x.k.id;
    if ((gezien.get(sleutel) || 0) >= 2) continue;
    gezien.set(sleutel, (gezien.get(sleutel) || 0) + 1);
    res.push({ id: x.k.id, titel: x.k.titel, groep: x.k.groep, bron: x.k.bron || null, tekst: x.k.tekst, score: Math.round(x.s * 10) / 10 });
    if (res.length >= n) break;
  }
  return res;
}
