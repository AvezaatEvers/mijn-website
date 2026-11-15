// Zet onze eigen kennisbank- en informatiepagina's om naar zoekbare stukjes voor de agent.
// Draai na het aanpassen van een kennisbankpagina: node scripts/build-kennis.js
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const paginas = [
  ...readdirSync(join(root, "kennisbank")).filter((f) => f.endsWith(".html") && f !== "index.html").map((f) => "kennisbank/" + f),
  "tarieven.html", "veelgestelde-vragen.html", "overstappen.html", "starters.html", "voorwaarden.html",
];

const ent = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ", "&shy;": "", "&euro;": "€", "&rsquo;": "’", "&lsquo;": "‘", "&hellip;": "…", "&ndash;": "–", "&mdash;": "—" };
const tekst = (h) => h.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, (m) => ent[m] ?? " ").replace(/­/g, "").replace(/\s+/g, " ").trim();

const stukken = [];
for (const p of paginas) {
  let h = readFileSync(join(root, p), "utf8");
  const titel = tekst((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [, p])[1]);
  h = (h.match(/<main[\s\S]*?<\/main>/) || [h])[0]
    .replace(/<(script|style|nav|footer|form|svg|figure)[\s\S]*?<\/\1>/g, "")
    .replace(/<(aside)[^>]*class="[^"]*(cta|delen)[^"]*"[\s\S]*?<\/aside>/g, "");
  const delen = h.split(/<h[23][^>]*>/);
  let kop = titel;
  delen.forEach((d, i) => {
    let t = d;
    if (i > 0) { const m = d.match(/^([\s\S]*?)<\/h[23]>/); if (m) { kop = tekst(m[1]); t = d.slice(m[0].length); } }
    t = tekst(t);
    if (i === 0) t = t.replace(titel, "").trim();
    if (t.length < 80 || /^Lees ook/i.test(kop)) return;
    // Lange secties in stukken van ~900 tekens, op zinsgrens
    while (t.length) {
      let snee = t.length > 1100 ? t.lastIndexOf(". ", 900) + 1 || 900 : t.length;
      stukken.push({ id: p.replace(/\.html$/, "") + "#" + stukken.length, groep: p.startsWith("kennisbank") ? "Kennisbank" : "Website", titel: kop === titel ? titel : titel + ": " + kop, bron: "/" + p.replace(/index\.html$/, "").replace(/\.html$/, ""), tags: "", tekst: t.slice(0, snee).trim() });
      t = t.slice(snee).trim();
    }
  });
}

writeFileSync(join(root, "netlify/agent/kennis-site.js"),
  "// Automatisch gemaakt door scripts/build-kennis.js uit onze eigen sitepagina's. Niet met de hand aanpassen.\nexport const KENNIS_SITE = " + JSON.stringify(stukken, null, 0).replace(/},{/g, "},\n{") + ";\n");
console.log("kennis-site.js:", stukken.length, "stukken uit", paginas.length, "pagina's");
