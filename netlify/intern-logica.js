// Logica van de interne omgeving (inloggen per persoon, gedeelde takenlijst en klanten met hun mails).
import { BASE, TYPES, AUTOMATISCH, HANDMATIG, gepland, maakMail, handmatigeData, verstuur, vandaag, actueelKwartaal, kwartalenRond, kwartaalInfo } from "./klant-mails.js";
import { mails } from "./functions/lib/mails.js";
import { overzicht, leadInfo, aandachtVoor } from "./overzicht.js";
import { agentApi } from "./agent/agent.js";
import { inzichten, KANALEN, ONDERWERPEN, SOORTEN, GEVOEL } from "./inzichten.js";
// Los van Netlify gehouden zodat het lokaal te testen is; intern.js koppelt de opslag.

export const GEBRUIKERS = {
  koen: { naam: "Koen", ww: "4d145e1be9338e703b4ef3439309c1901f53f3a6b3d4e8d78c7d4fcaee69384a", token: "6a183805e91b11ed14fe55d8d60f44ff6b62411bb477b7c239bb5e8ecd943cc0" },
  daan: { naam: "Daan", ww: "794f4990b31f8cf80e5d5a80f014f2d80a7676d869ffee302f716f458c75fba1", token: "f9fc79a217101230eed3b1fa6f0d5c9ae774a69d93e4373067c0f1aee1e60375" },
};
const SALT = "avezaat-evers:intern:v2:";
const COOKIE = "ae_intern";
const SLEUTEL = "taken";

export async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Startlijst, alleen gebruikt als er nog niets is opgeslagen
const START = [
  ["Foto en achtergrond van Daan", "Homepage, Wie wij zijn", "2026-11-15", "daan"],
  ["Netlify: formulierdetectie en e-mailmeldingen", "", "2026-10-31", "koen"],
  ["Cal.com instellen", "Nederlands, 24-uurs, maandag eerst, Voor- en achternaam, herinnering", "2026-10-31", "koen"],
  ["Beroepsaansprakelijkheidsverzekering", "", "2026-12-01", "samen"],
  ["Salarispartner voor klanten met personeel", "", "2026-12-01", "samen"],
  ["Fiscale teksten nalezen", "Zelfstandigenaftrek, calculator, welkomstpagina", "2026-11-15", "daan"],
  ["Google Search Console koppelen en sitemap indienen", "", "2026-11-30", "koen"],
  ["Google Bedrijfsprofiel aanmaken", "", "2026-11-30", "koen"],
  ["Vermelding in de lijst Erkend Adviseurs van MoneyMonk", "", "2026-11-30", "samen"],
  ["Umami: eigen bezoeken uitsluiten", "", "", "samen"],
  ["Bedragen 2027 bijwerken na stemming Belastingplan", "", "2026-12-15", "daan"],
  ["Wachtwoordpagina weghalen: lancering", "", "2026-12-01", "samen"],
];

function nieuweId() { return crypto.randomUUID(); }

function startTaken() {
  const nu = new Date().toISOString();
  return START.map(([titel, notitie, deadline, voor]) => ({
    id: nieuweId(), titel, notitie, deadline, voor, klaar: false, klaarDoor: null, klaarOp: null, door: "koen", aangemaakt: nu,
  }));
}

function html(body, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

export function inlogPagina(fout) {
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><meta name="theme-color" content="#EEF2F8"><title>Intern | Avezaat &amp; Evers</title><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="manifest" href="/intern/app.webmanifest"><link rel="apple-touch-icon" href="/assets/img/app/intern-apple-180.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="A&amp;E">
<style>
@font-face{font-family:P;font-weight:400;src:url(/assets/fonts/poppins-400.woff2)}@font-face{font-family:P;font-weight:500;src:url(/assets/fonts/poppins-500.woff2)}@font-face{font-family:P;font-weight:600;src:url(/assets/fonts/poppins-600.woff2)}@font-face{font-family:P;font-weight:700;src:url(/assets/fonts/poppins-700.woff2)}
*{box-sizing:border-box}html,body{height:100%}
body{margin:0;min-height:100vh;display:grid;place-items:center;grid-template-columns:minmax(0,380px);justify-content:center;font-family:P,system-ui,sans-serif;color:#111827;padding:24px;overflow:hidden;background:#EEF2F8;position:relative}
.amp{position:fixed;left:0;right:0;top:50%;transform:translateY(-54%);text-align:center;white-space:nowrap;font-weight:700;font-size:min(110vh,150vw);line-height:1;color:#26458F;opacity:.06;pointer-events:none;user-select:none;letter-spacing:-.05em}
form{position:relative;z-index:1;width:100%;max-width:380px;border-radius:20px;padding:32px 28px 28px;display:flex;flex-direction:column;gap:14px;background:#fff;border:1px solid #E5E7EB;box-shadow:0 24px 60px -28px rgba(38,69,143,.35)}
form.schud{animation:schud .4s}@keyframes schud{20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
.logo{font-weight:700;font-size:22px;letter-spacing:-.02em;color:#111827}.logo span{color:#26458F}
.label{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#26458F;background:#EEF2F8;border-radius:999px;padding:4px 10px;align-self:flex-start}
p{margin:6px 0 0;color:#4B5563;font-size:15px}
.wie{display:grid;grid-template-columns:1fr 1fr;gap:10px}.wie label{display:block;position:relative}.wie input{position:absolute;opacity:0}
.wie span{display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid #E5E7EB;border-radius:12px;cursor:pointer;font-weight:500;color:#111827;background:#fff;transition:border-color .15s,background .15s}
.wie img{width:32px;height:32px;border-radius:50%;object-fit:cover}
.wie span:hover{border-color:#CAD4E8}
.wie input:checked+span{border-color:#26458F;background:#EEF2F8;box-shadow:0 0 0 1px #26458F}
.wie input:focus-visible+span{outline:2px solid #26458F;outline-offset:2px}
input[type=password]{font:inherit;padding:12px 14px;border:1px solid #E5E7EB;border-radius:12px;font-size:16px;background:#fff;color:#111827}
input[type=password]::placeholder{color:#9CA3AF}input[type=password]:focus{outline:2px solid #26458F;outline-offset:-1px;border-color:transparent}
button{font:inherit;font-weight:600;padding:13px;border:0;border-radius:12px;color:#fff;font-size:16px;cursor:pointer;background:#26458F;transition:background .15s}
button:hover{background:#1B336F}button:disabled{opacity:.7;cursor:default}
.fout{color:#B91C1C;font-size:14px;margin:0}
</style></head><body><div class="amp" aria-hidden="true">&amp;</div>
<form method="POST" action="/intern/login" id="form"><span class="label">Intern</span><div class="logo">Avezaat <span>&amp;</span> Evers</div><p>Wie ben je?</p>
<div class="wie"><label><input type="radio" name="wie" value="koen" required><span><img src="/assets/img/mail/koen.jpg" alt="">Koen</span></label><label><input type="radio" name="wie" value="daan"><span><img src="/assets/img/mail/daan.jpg" alt="">Daan</span></label></div>
<p class="fout" id="fout"${fout ? "" : " hidden"}>Naam of wachtwoord klopt niet.</p><input type="password" name="wachtwoord" placeholder="Wachtwoord" autocomplete="current-password" required><button type="submit" id="knop">Inloggen</button></form>
<script>
(function(){
var form=document.getElementById('form');
try{var vorig=localStorage.getItem('ae-wie');if(vorig){var r=form.querySelector('input[value="'+vorig+'"]');if(r){r.checked=true;form.wachtwoord.focus()}}}catch(e){}
form.addEventListener('change',function(e){if(e.target.name==='wie'){try{localStorage.setItem('ae-wie',e.target.value)}catch(x){}form.wachtwoord.focus()}});
form.addEventListener('submit',function(e){
  if(!window.fetch)return;e.preventDefault();
  var knop=document.getElementById('knop'),fout=document.getElementById('fout');knop.disabled=true;
  fetch('/intern/login',{method:'POST',body:new URLSearchParams(new FormData(form)),credentials:'same-origin',redirect:'follow'}).then(function(r){
    if(r.ok&&!/\\/login/.test(r.url)){location.href='/intern/';}
    else{knop.disabled=false;fout.hidden=false;form.classList.remove('schud');void form.offsetWidth;form.classList.add('schud');form.wachtwoord.select();}
  }).catch(function(){form.submit()});
});
})();
</script></body></html>`;
}

export function agentHulp(env) {
  return {
    api: async (method, pad, body, wie, store, via) => {
      const u = new URL("https://intern.local" + pad + (method === "GET" || method === "DELETE" ? "?" + new URLSearchParams(body || {}) : ""));
      const req = new Request(u, { method, headers: { "Content-Type": "application/json", "x-via": via || "" }, body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify(body || {}) });
      const r = await klantenApi(req, u, pad, wie, store, env);
      const j = await r.json().catch(() => ({}));
      return r.ok ? j : { fout: j.fout || "Mislukt (" + r.status + ")" };
    },
    leesKlanten, leesTaken, bewaarTaken: (st, t) => st.setJSON(SLEUTEL, t),
    overzicht: (k, t, v) => overzicht(k, t, v, vandaag(), env), inzichten: (k, v, d) => inzichten(k, v, d),
    leadInfo: (k) => leadInfo(k), gepland: (k) => gepland(k, vandaag(), 8, env), vandaag,
  };
}
export { COOKIE };

export async function ingelogd(cookieWaarde) {
  if (!cookieWaarde || cookieWaarde.indexOf(".") < 1) return null;
  const [wie, token] = cookieWaarde.split(".");
  const g = GEBRUIKERS[wie];
  if (!g || !token) return null;
  return (await sha256(token)) === g.token ? wie : null;
}

async function leesTaken(store) {
  const taken = await store.get(SLEUTEL, { type: "json" });
  if (Array.isArray(taken)) return taken;
  const start = startTaken();
  await store.setJSON(SLEUTEL, start);
  return start;
}

function schoon(t) { return String(t || "").replace(/[<>]/g, "").trim().slice(0, 200); }
function datum(d) { return /^\d{4}-\d{2}-\d{2}$/.test(d || "") ? d : ""; }
function voor(v) { return ["koen", "daan", "samen"].includes(v) ? v : "samen"; }

// request: Request, cookies: { get(naam) }, next: () => Response, store: Blobs-store
export async function verwerk(request, cookies, next, maakStore, env = () => undefined) {
  const url = new URL(request.url);
  const pad = url.pathname;

  if (pad === "/intern/login") {
    if (request.method !== "POST") return Response.redirect(new URL("/intern/", url), 303);
    const form = await request.formData();
    const wie = String(form.get("wie") || "");
    const pw = String(form.get("wachtwoord") || "").trim();
    const g = GEBRUIKERS[wie];
    if (g && (await sha256(wie + ":" + pw)) === g.ww) {
      const token = await sha256(SALT + wie + ":" + pw);
      return new Response(null, { status: 303, headers: {
        Location: "/intern/",
        "Set-Cookie": `${COOKIE}=${wie}.${token}; Path=/; Max-Age=7776000; HttpOnly; Secure; SameSite=Lax`,
      } });
    }
    return html(inlogPagina(true), 401);
  }

  // Service worker en manifest van de webapp bevatten geen gegevens en moeten ook zonder inlog laden
  if (pad === "/intern/sw.js" || pad === "/intern/app.webmanifest") return next();

  if (pad === "/intern/logout") {
    return new Response(null, { status: 303, headers: { Location: "/intern/", "Set-Cookie": `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` } });
  }

  const wie = await ingelogd(cookies.get(COOKIE));
  if (!wie) {
    if (pad.startsWith("/intern/api/")) return json({ fout: "Niet ingelogd" }, 401);
    return html(inlogPagina(false), 401);
  }

  if (pad === "/intern/api/ik") return json({ wie, naam: GEBRUIKERS[wie].naam });

  // Pushmeldingen draaien in een Node-functie (netlify/functions/push.mjs), die de inlog zelf ook controleert
  if (pad === "/intern/api/push" || pad.startsWith("/intern/api/push/")) return next();

  if (pad === "/intern/api/taken") {
    const store = maakStore();
    if (request.method === "GET") return json(await leesTaken(store));
    const body = request.method === "DELETE" ? Object.fromEntries(url.searchParams) : await request.json().catch(() => ({}));
    const taken = await leesTaken(store);
    const nu = new Date().toISOString();

    if (request.method === "POST") {
      const titel = schoon(body.titel);
      if (!titel) return json({ fout: "Titel ontbreekt" }, 400);
      taken.push({ id: nieuweId(), titel, notitie: schoon(body.notitie), deadline: datum(body.deadline), voor: voor(body.voor),
        klaar: false, klaarDoor: null, klaarOp: null, door: wie, aangemaakt: nu, klant: schoon(body.klant).slice(0, 60) || null });
    } else if (request.method === "PATCH") {
      const t = taken.find((x) => x.id === body.id);
      if (!t) return json({ fout: "Taak niet gevonden" }, 404);
      if (typeof body.klaar === "boolean") { t.klaar = body.klaar; t.klaarDoor = body.klaar ? wie : null; t.klaarOp = body.klaar ? nu : null; }
      if ("titel" in body && schoon(body.titel)) t.titel = schoon(body.titel);
      if ("notitie" in body) t.notitie = schoon(body.notitie);
      if ("deadline" in body) t.deadline = datum(body.deadline);
      if ("voor" in body) t.voor = voor(body.voor);
    } else if (request.method === "DELETE") {
      const i = taken.findIndex((x) => x.id === body.id);
      if (i < 0) return json({ fout: "Taak niet gevonden" }, 404);
      taken.splice(i, 1);
    } else {
      return json({ fout: "Methode niet toegestaan" }, 405);
    }
    await store.setJSON(SLEUTEL, taken);
    return json(taken);
  }

  if (pad.startsWith("/intern/api/agent") || pad.startsWith("/intern/api/werkstro") || pad === "/intern/api/kennis" || pad === "/intern/api/dagplan" || pad.startsWith("/intern/api/gesprek") || pad.startsWith("/intern/api/geheugen") || pad === "/intern/api/activiteit" || pad === "/intern/api/claude-sleutel") {
    // Het agentgesprek zelf draait in een gewone Netlify Function (netlify/functions/agent.mjs):
    // edge functions mogen maar 50 ms rekenen, te weinig voor een AI-gesprek met tools.
    if (pad === "/intern/api/agent" && request.method === "POST") return next();
    return agentApi(request, url, pad, wie, maakStore(), env, agentHulp(env));
  }

  if (pad.startsWith("/intern/api/klant") || pad.startsWith("/intern/api/voorstel") || pad === "/intern/api/kwartaalbord" || pad === "/intern/api/overzicht" || pad === "/intern/api/inzichten" || pad === "/intern/api/zoek" || pad.startsWith("/intern/api/mail/")) return klantenApi(request, url, pad, wie, maakStore(), env);

  return next();
}

// ---------- Klanten ----------
const KLANTEN = "klanten";
const STATUS = ["prospect", "klant", "gestopt", "verloren"];

async function leesKlanten(store) {
  const k = await store.get(KLANTEN, { type: "json" });
  return Array.isArray(k) ? k : [];
}
function mailadres(e) { const v = String(e || "").trim().toLowerCase(); return /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/.test(v) ? v : ""; }
function link(l) { const v = String(l || "").trim(); return /^https:\/\/[^\s<>"]+$/.test(v) ? v.slice(0, 500) : ""; }
function boekhouder(b) { return b === "daan" ? "daan" : b === "koen" ? "koen" : ""; }

// Waar een lead of klant vandaan kwam, om de conversie per bron te meten
export const HERKOMST = { moneymonk: "MoneyMonk", trustoo: "Trustoo", netwerk: "Eigen netwerk", google: "Google", website: "Website (formulier)", anders: "Anders" };

function velden(body, k) {
  if ("herkomst" in body && (body.herkomst === "" || Object.hasOwn(HERKOMST, body.herkomst))) k.herkomst = body.herkomst;
  if ("naam" in body) k.naam = schoon(body.naam);
  if ("bedrijf" in body) k.bedrijf = schoon(body.bedrijf);
  if ("email" in body) k.email = mailadres(body.email);
  if ("telefoon" in body) k.telefoon = schoon(body.telefoon).slice(0, 30);
  if ("boekhouder" in body) k.boekhouder = boekhouder(body.boekhouder);
  if ("status" in body && STATUS.includes(body.status)) {
    if (body.status === "klant" && k.status !== "klant") k.klantOp = new Date().toISOString();
    if (body.status === "verloren" && k.status !== "verloren") k.verlorenOp = new Date().toISOString();
    if (body.status === "gestopt" && k.status !== "gestopt") k.gestoptOp = new Date().toISOString();
    k.status = body.status;
  }
  if ("start" in body) k.start = datum(body.start);
  if ("voorstelLink" in body) k.voorstelLink = link(body.voorstelLink);
  if ("notitie" in body) k.notitie = String(body.notitie || "").replace(/[<>]/g, "").trim().slice(0, 2000);
  if (Array.isArray(body.uit)) k.uit = body.uit.filter((t) => AUTOMATISCH.includes(t));
  if (body.profiel && typeof body.profiel === "object") {
    const pr = body.profiel, oud = k.profiel || {};
    k.profiel = {
      kor: "kor" in pr ? !!pr.kor : !!oud.kor, icp: "icp" in pr ? !!pr.icp : !!oud.icp,
      partner: "partner" in pr ? !!pr.partner : !!oud.partner, urencriterium: "urencriterium" in pr ? !!pr.urencriterium : !!oud.urencriterium,
      branche: "branche" in pr ? schoon(pr.branche).slice(0, 60) : (oud.branche || ""),
    };
  }
  if ("tevreden" in body) k.tevreden = !!body.tevreden;
}

// Welke planningssleutel hoort bij een handmatig verstuurde mail (zodat hij niet nog eens automatisch gaat)
function sleutelVoor(type, data, k = {}) {
  if (type === "voorstelHerinnering") return k.voorstel && k.voorstel.op ? "voorstelHerinnering-" + k.voorstel.op.slice(0, 10) : null;
  if (type === "kwartaal") return "kwartaal-" + data.sleutel;
  if (type === "kwartaalTweede") return "kwartaal2-" + data.sleutel;
  if (type === "jaareinde") return "jaareinde-" + vandaag().slice(0, 4);
  if (type === "inkomstenbelasting") return "ib-" + data.jaar;
  if (type === "jubileum") return "jubileum-1";
  if (["checkIn", "review", "aanbevelen"].includes(type)) return type;
  return null;
}

function berichtData(body) {
  return { onderwerp: String(body.onderwerp || "").replace(/[<>]/g, "").trim().slice(0, 140), tekst: String(body.tekst || "").replace(/[<>]/g, "").trim().slice(0, 4000) };
}

function metPlanning(k, env) {
  const li = k.status === "prospect" ? leadInfo(k) : null;
  // Open meldingen: dezelfde punten als "Aandacht nodig" op het dashboard, plus een lead die nu actie vraagt.
  const meldingen = aandachtVoor(k, vandaag(), env).length + (li && li.urgent ? 1 : 0);
  return { ...k, gepland: gepland(k, vandaag(), 8, env), leadInfo: li, meldingen };
}

async function klantenApi(request, url, pad, wie, store, env) {
  const klanten = await leesKlanten(store);
  const nu = new Date().toISOString();
  const body = ["POST", "PATCH"].includes(request.method) ? await request.json().catch(() => ({})) : Object.fromEntries(url.searchParams);
  const bewaar = () => store.setJSON(KLANTEN, klanten);
  const vind = (id) => klanten.find((x) => x.id === id);
  // Via welke weg de wijziging kwam (Claude-koppeling of de agent op de site). Alleen een label voor de activiteitenlijst.
  const viaKop = request.headers.get("x-via");
  const via = viaKop === "claude" || viaKop === "agent" ? viaKop : undefined;

  if (pad === "/intern/api/klanten") {
    if (request.method === "GET") return json({ klanten: klanten.map((k) => metPlanning(k, env)), types: TYPES, handmatig: HANDMATIG, reviewLink: !!env("REVIEW_LINK") });
    if (request.method === "POST") {
      const k = { id: nieuweId(), naam: "", bedrijf: "", email: "", telefoon: "", boekhouder: wie, status: "klant", start: "", voorstelLink: "", notitie: "", uit: [], verstuurd: {}, log: [], door: wie, aangemaakt: nu, via };
      velden(body, k);
      if (k.status === "prospect") k.lead = { bron: "handmatig", op: nu };
      if (k.status === "klant") k.klantOp = nu;
      if (!k.naam) return json({ fout: "Naam ontbreekt" }, 400);
      if (!k.email) return json({ fout: "Geen geldig e-mailadres" }, 400);
      klanten.push(k);
      await bewaar();
      return json(metPlanning(k, env));
    }
    return json({ fout: "Methode niet toegestaan" }, 405);
  }

  if (pad === "/intern/api/klant") {
    const k = vind(body.id);
    if (!k) return json({ fout: "Klant niet gevonden" }, 404);
    if (request.method === "GET") return json({ klant: metPlanning(k, env), types: TYPES, handmatig: HANDMATIG, reviewLink: !!env("REVIEW_LINK"), kwartalen: kwartalenRond().slice(0, 4).map(kwartaalInfo) });
    if (request.method === "PATCH") {
      velden(body, k);
      if (!k.naam || !k.email) return json({ fout: "Naam en e-mailadres zijn verplicht" }, 400);
      k.gewijzigd = nu; k.gewijzigdDoor = wie; k.gewijzigdVia = via;
      await bewaar();
      return json({ klant: metPlanning(k, env), types: TYPES, handmatig: HANDMATIG, reviewLink: !!env("REVIEW_LINK"), kwartalen: kwartalenRond().slice(0, 4).map(kwartaalInfo) });
    }
    if (request.method === "DELETE") {
      klanten.splice(klanten.indexOf(k), 1);
      await bewaar();
      return json({ ok: true });
    }
    return json({ fout: "Methode niet toegestaan" }, 405);
  }

  if (pad === "/intern/api/klant/voorbeeld") {
    const k = vind(body.id);
    if (!k || !TYPES[body.type]) return json({ fout: "Niet gevonden" }, 404);
    const data = body.type === "bericht" ? berichtData(body) : body.sleutel ? (gepland(k).find((m) => m.sleutel === body.sleutel) || {}).data : handmatigeData(body.type);
    const m = maakMail(k, body.type, data || {}, env);
    // In het voorbeeld de afbeeldingen van deze site laden (ook als ze nog niet live staan)
    const html = m.html.split("https://avezaatenevers.nl/assets/").join(url.origin + "/assets/");
    return json({ onderwerp: m.subject, html, aan: k.email });
  }

  if (pad === "/intern/api/klant/stuur" && request.method === "POST") {
    const k = vind(body.id);
    if (!k || !TYPES[body.type]) return json({ fout: "Niet gevonden" }, 404);
    const test = body.test === true;
    const aan = test ? (String(env("MAIL_TO") || "info@avezaatenevers.nl").split(",")[0].trim()) : k.email;
    if (body.type === "bericht" && !String(body.tekst || "").trim()) return json({ fout: "Het bericht is leeg" }, 400);
    const data = body.type === "bericht" ? berichtData(body) : handmatigeData(body.type);
    const m = maakMail(k, body.type, data, env);
    if (test) m.subject = "[TEST] " + m.subject;
    const r = await verstuur(env, { aan, mail: m });
    k.log = k.log || [];
    k.log.unshift({ type: body.type, onderwerp: m.subject, aan, op: nu, door: wie, via, test, ok: r.ok, fout: r.fout || null, handmatig: true });
    k.log = k.log.slice(0, 100);
    const sl = sleutelVoor(body.type, data, k);
    if (r.ok && !test && sl) k.verstuurd = { ...(k.verstuurd || {}), [sl]: nu };
    await bewaar();
    return json({ ...r, klant: metPlanning(k, env) }, r.ok ? 200 : 502);
  }

  // Door de agent ontworpen mail: voorbeeld en versturen (aan een klant of een los e-mailadres)
  if ((pad === "/intern/api/mail/voorbeeld" || pad === "/intern/api/mail/stuur") && request.method === "POST") {
    const k = body.klant ? vind(body.klant) : klanten.find((x) => x.email && x.email === mailadres(body.aan));
    const aanEcht = k ? k.email : mailadres(body.aan);
    if (!aanEcht) return json({ fout: "Geen geldig e-mailadres" }, 400);
    const d = { naam: k ? k.naam : schoon(body.naam), wie: boekhouder(body.wie) || (k && k.boekhouder) || wie, onderwerp: schoon(body.onderwerp).slice(0, 140), preheader: schoon(body.preheader).slice(0, 120),
      aanhef: body.aanhef !== false, blokken: Array.isArray(body.blokken) ? body.blokken : [] };
    if (!d.onderwerp || !d.blokken.length) return json({ fout: "Onderwerp en inhoud zijn nodig" }, 400);
    const m = mails.ontwerp(d, BASE);
    if (pad === "/intern/api/mail/voorbeeld") return json({ onderwerp: m.subject, html: m.html.split(BASE + "/assets/").join(url.origin + "/assets/"), aan: aanEcht });
    const test = body.test === true;
    const aan = test ? String(env("MAIL_TO") || "info@avezaatenevers.nl").split(",")[0].trim() : aanEcht;
    if (test) m.subject = "[TEST] " + m.subject;
    const r = await verstuur(env, { aan, mail: m });
    if (k) {
      k.log = k.log || [];
      k.log.unshift({ type: "ontwerp", onderwerp: m.subject, aan, op: nu, door: wie, via, test, ok: r.ok, fout: r.fout || null, handmatig: true });
      k.log = k.log.slice(0, 100);
      await bewaar();
    }
    return json({ ...r, id: k ? k.id : null }, r.ok ? 200 : 502);
  }

  // Kwartaalstatus: stukken binnen, aangifte ingediend, btw betaald
  if (pad === "/intern/api/klant/kwartaal" && request.method === "PATCH") {
    const k = vind(body.id);
    if (!k || !/^\d{4}-Q[1-4]$/.test(body.kw || "") || !["binnen", "ingediend", "betaald"].includes(body.veld)) return json({ fout: "Ongeldig" }, 400);
    k.kwartalen = k.kwartalen || {};
    const kw = (k.kwartalen[body.kw] = k.kwartalen[body.kw] || {});
    kw[body.veld] = body.aan ? nu : null;
    kw[body.veld + "Door"] = body.aan ? wie : null;
    kw[body.veld + "Via"] = body.aan ? via || null : null;
    await bewaar();
    return json({ klant: metPlanning(k, env) });
  }

  // IB-aangifte ingediend per jaar
  if (pad === "/intern/api/klant/ib" && request.method === "PATCH") {
    const k = vind(body.id);
    if (!k || !/^\d{4}$/.test(String(body.jaar || ""))) return json({ fout: "Ongeldig" }, 400);
    k.ibIngediend = k.ibIngediend || {};
    if (body.aan) { k.ibIngediend[body.jaar] = nu; k.ibDoor = { ...(k.ibDoor || {}), [body.jaar]: wie }; } else delete k.ibIngediend[body.jaar];
    await bewaar();
    return json({ klant: metPlanning(k, env) });
  }

  // Tijdlijn
  if (pad === "/intern/api/klant/notitie") {
    const k = vind(body.id);
    if (!k) return json({ fout: "Klant niet gevonden" }, 404);
    k.tijdlijn = k.tijdlijn || [];
    if (request.method === "POST") {
      const tekst = String(body.tekst || "").replace(/[<>]/g, "").trim().slice(0, 1000);
      if (!tekst) return json({ fout: "Leeg" }, 400);
      const soort = ["notitie", "gebeld", "geappt", "gemaild", "gesprek"].includes(body.soort) ? body.soort : "notitie";
      k.tijdlijn.unshift({ id: nieuweId(), tekst, soort, op: nu, door: wie, via });
      k.tijdlijn = k.tijdlijn.slice(0, 300);
    } else if (request.method === "DELETE") {
      k.tijdlijn = k.tijdlijn.filter((x) => x.id !== body.nid);
    } else return json({ fout: "Methode niet toegestaan" }, 405);
    await bewaar();
    return json({ klant: metPlanning(k, env) });
  }

  // Voorstel: voorbeeld en versturen
  if (pad.startsWith("/intern/api/voorstel") && request.method === "POST") {
    const v = body.voorstel || {};
    const data = {
      naam: schoon(v.voornaam).slice(0, 80), bedrijf: schoon(v.bedrijf).slice(0, 120), situatie: schoon(v.situatie).slice(0, 600),
      start: schoon(v.start).slice(0, 60), wie: boekhouder(String(v.boekhouder || "").toLowerCase()), pakket: Math.min(10000, Math.max(0, Number(v.pakket) || 80)),
      icp: !!v.icp, partner: !!v.partner, overstap: ["nee", "gratis", "betaald"].includes(v.overstap) ? v.overstap : "nee",
      achterstand: Math.min(500, Math.max(0, parseInt(v.achterstand, 10) || 0)), noot: String(v.noot || "").replace(/[<>]/g, "").trim().slice(0, 1000), geldig: schoon(v.geldig).slice(0, 60),
    };
    const m = mails.voorstel(data, BASE);
    if (pad === "/intern/api/voorstel/voorbeeld") {
      return json({ onderwerp: m.subject, html: m.html.split(BASE + "/assets/").join(url.origin + "/assets/") });
    }
    if (pad === "/intern/api/voorstel/stuur") {
      const test = body.test === true;
      const email = mailadres(body.email);
      if (!test && !email) return json({ fout: "Vul een geldig e-mailadres van de klant in" }, 400);
      const aan = test ? String(env("MAIL_TO") || "info@avezaatenevers.nl").split(",")[0].trim() : email;
      const mail = test ? { ...m, subject: "[TEST] " + m.subject } : m;
      const r = await verstuur(env, { aan, mail });
      if (!r.ok) return json(r, 502);
      if (test) return json({ ok: true, test: true });
      let k = klanten.find((x) => x.email === email);
      if (!k) {
        k = { id: nieuweId(), naam: data.naam, bedrijf: data.bedrijf, email, telefoon: schoon(body.telefoon).slice(0, 30), boekhouder: data.wie, status: "prospect", start: "", voorstelLink: "", notitie: "", uit: [], verstuurd: {}, log: [], door: wie, aangemaakt: nu };
        klanten.push(k);
      }
      if (!k.bedrijf && data.bedrijf) k.bedrijf = data.bedrijf;
      k.boekhouder = data.wie;
      k.voorstel = { op: nu, door: wie, data };
      k.log = k.log || [];
      k.log.unshift({ type: "voorstel", onderwerp: m.subject, aan: email, op: nu, door: wie, test: false, ok: true, fout: null, handmatig: true });
      k.log = k.log.slice(0, 100);
      await bewaar();
      return json({ ok: true, klantId: k.id, status: k.status });
    }
  }

  // Contactmoment vastleggen
  if (pad === "/intern/api/klant/contact") {
    const k = vind(body.id);
    if (!k) return json({ fout: "Klant niet gevonden" }, 404);
    k.contacten = k.contacten || [];
    if (request.method === "POST") {
      const c = {
        id: nieuweId(), op: /^\d{4}-\d{2}-\d{2}$/.test(body.datum || "") && body.datum !== vandaag() ? body.datum + "T12:00:00.000Z" : nu,
        kanaal: KANALEN[body.kanaal] ? body.kanaal : "whatsapp", richting: body.richting === "wij" ? "wij" : "klant",
        onderwerp: ONDERWERPEN[body.onderwerp] ? body.onderwerp : "overig", soort: SOORTEN[body.soort] ? body.soort : "vraag",
        opgelost: body.opgelost === true ? true : body.opgelost === false ? false : null, gevoel: GEVOEL[body.gevoel] ? body.gevoel : null,
        vermijdbaar: body.vermijdbaar === true, notitie: String(body.notitie || "").replace(/[<>]/g, "").trim().slice(0, 1000), door: wie, via,
      };
      k.contacten.unshift(c);
      k.contacten = k.contacten.slice(0, 1000);
    } else if (request.method === "DELETE") {
      k.contacten = k.contacten.filter((c) => c.id !== body.cid);
    } else return json({ fout: "Methode niet toegestaan" }, 405);
    await bewaar();
    return json({ klant: metPlanning(k, env) });
  }

  // Inzichten
  if (pad === "/intern/api/inzichten") {
    const voor = ["koen", "daan", "alle"].includes(body.wie) ? body.wie : wie;
    const dagen = [30, 90, 365].includes(Number(body.dagen)) ? Number(body.dagen) : 90;
    return json(inzichten(klanten, voor, dagen));
  }

  // Zoeken (opdrachtbalk)
  if (pad === "/intern/api/zoek") {
    return json(klanten.map((k) => ({ id: k.id, naam: k.naam, bedrijf: k.bedrijf, email: k.email, telefoon: k.telefoon, status: k.status, boekhouder: k.boekhouder })));
  }

  // Werkoverzicht
  if (pad === "/intern/api/overzicht") {
    const taken = await leesTaken(store);
    const voor = ["koen", "daan", "alle"].includes(body.wie) ? body.wie : wie;
    return json(overzicht(klanten, taken, voor, vandaag(), env));
  }

  // Kwartaalbord
  if (pad === "/intern/api/kwartaalbord") {
    const kwartalen = kwartalenRond(vandaag(), 6).map(kwartaalInfo);
    const kw = /^\d{4}-Q[1-4]$/.test(body.kw || "") ? body.kw : actueelKwartaal();
    const lijst = klanten.filter((k) => k.status === "klant").map((k) => ({
      id: k.id, naam: k.naam, bedrijf: k.bedrijf, boekhouder: k.boekhouder, telefoon: k.telefoon, kor: !!(k.profiel || {}).kor,
      status: (k.kwartalen || {})[kw] || {}, start: k.start,
    }));
    return json({ kw, info: kwartaalInfo(kw), kwartalen, klanten: lijst });
  }

  return json({ fout: "Onbekende route" }, 404);
}

export { vandaag };
