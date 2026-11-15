// Logica van de interne omgeving (inloggen per persoon, gedeelde takenlijst en klanten met hun mails).
import { BASE, TYPES, AUTOMATISCH, HANDMATIG, gepland, maakMail, handmatigeData, verstuur, vandaag, actueelKwartaal, kwartalenRond, kwartaalInfo } from "./klant-mails.js";
import { mails } from "./functions/lib/mails.js";
import { overzicht, leadInfo } from "./overzicht.js";
import { inzichten, KANALEN, ONDERWERPEN, SOORTEN, GEVOEL } from "./inzichten.js";
// Los van Netlify gehouden zodat het lokaal te testen is; intern.js koppelt de opslag.

export const GEBRUIKERS = {
  koen: { naam: "Koen", ww: "4d145e1be9338e703b4ef3439309c1901f53f3a6b3d4e8d78c7d4fcaee69384a", token: "6a183805e91b11ed14fe55d8d60f44ff6b62411bb477b7c239bb5e8ecd943cc0" },
  daan: { naam: "Daan", ww: "9c9beef291a55bc0ac3f76e5facac1ae1a532eaf01819a42d47594f8321ae0f0", token: "53725357bdf816ded6bf89b45f6185ce63f6af76649c03bd6474073400509bbf" },
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
<meta name="robots" content="noindex, nofollow"><title>Intern | Avezaat &amp; Evers</title><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<style>
@font-face{font-family:P;font-weight:500;src:url(/assets/fonts/poppins-500.woff2)}@font-face{font-family:P;font-weight:700;src:url(/assets/fonts/poppins-700.woff2)}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:P,system-ui,sans-serif;background:#EEF2F8;color:#111827;padding:24px}
form{width:100%;max-width:380px;background:#fff;border-radius:22px;padding:32px;box-shadow:0 20px 50px -24px rgba(17,24,39,.35);display:flex;flex-direction:column;gap:14px}
.logo{font-weight:700;font-size:20px;letter-spacing:-.02em}.logo span{color:#26458F}h1{font-size:22px;margin:6px 0 0}p{margin:0;color:#4B5563;font-size:15px}
.wie{display:grid;grid-template-columns:1fr 1fr;gap:8px}.wie label{display:block}.wie input{position:absolute;opacity:0}.wie span{display:block;text-align:center;padding:11px;border:1px solid #E5E7EB;border-radius:12px;cursor:pointer;font-weight:500}
.wie input:checked+span{border-color:#26458F;background:#EEF2F8;color:#26458F}.wie input:focus-visible+span{outline:2px solid #26458F}
input[type=password]{font:inherit;padding:12px 14px;border:1px solid #E5E7EB;border-radius:12px;font-size:16px}input[type=password]:focus{outline:2px solid #26458F;border-color:#26458F}
button{font:inherit;font-weight:500;padding:13px;border:0;border-radius:12px;background:#26458F;color:#fff;font-size:16px;cursor:pointer}.fout{color:#B91C1C;font-size:14px}
</style></head><body><form method="POST" action="/intern/login"><div class="logo">Avezaat <span>&amp;</span> Evers</div><h1>Intern</h1><p>Wie ben je?</p>
<div class="wie"><label><input type="radio" name="wie" value="koen" required><span>Koen</span></label><label><input type="radio" name="wie" value="daan"><span>Daan</span></label></div>
${fout ? '<p class="fout">Naam of wachtwoord klopt niet.</p>' : ''}<input type="password" name="wachtwoord" placeholder="Wachtwoord" autocomplete="current-password" required><button type="submit">Inloggen</button></form></body></html>`;
}

async function ingelogd(cookieWaarde) {
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

  if (pad === "/intern/logout") {
    return new Response(null, { status: 303, headers: { Location: "/intern/", "Set-Cookie": `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` } });
  }

  const wie = await ingelogd(cookies.get(COOKIE));
  if (!wie) {
    if (pad.startsWith("/intern/api/")) return json({ fout: "Niet ingelogd" }, 401);
    return html(inlogPagina(false), 401);
  }

  if (pad === "/intern/api/ik") return json({ wie, naam: GEBRUIKERS[wie].naam });

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

  if (pad.startsWith("/intern/api/klant") || pad.startsWith("/intern/api/voorstel") || pad === "/intern/api/kwartaalbord" || pad === "/intern/api/overzicht" || pad === "/intern/api/inzichten" || pad === "/intern/api/zoek") return klantenApi(request, url, pad, wie, maakStore(), env);

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

function velden(body, k) {
  if ("naam" in body) k.naam = schoon(body.naam);
  if ("bedrijf" in body) k.bedrijf = schoon(body.bedrijf);
  if ("email" in body) k.email = mailadres(body.email);
  if ("telefoon" in body) k.telefoon = schoon(body.telefoon).slice(0, 30);
  if ("boekhouder" in body) k.boekhouder = boekhouder(body.boekhouder);
  if ("status" in body && STATUS.includes(body.status)) {
    if (body.status === "klant" && k.status !== "klant") k.klantOp = new Date().toISOString();
    if (body.status === "verloren" && k.status !== "verloren") k.verlorenOp = new Date().toISOString();
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

function metPlanning(k, env) { return { ...k, gepland: gepland(k, vandaag(), 8, env), leadInfo: k.status === "prospect" ? leadInfo(k) : null }; }

async function klantenApi(request, url, pad, wie, store, env) {
  const klanten = await leesKlanten(store);
  const nu = new Date().toISOString();
  const body = ["POST", "PATCH"].includes(request.method) ? await request.json().catch(() => ({})) : Object.fromEntries(url.searchParams);
  const bewaar = () => store.setJSON(KLANTEN, klanten);
  const vind = (id) => klanten.find((x) => x.id === id);

  if (pad === "/intern/api/klanten") {
    if (request.method === "GET") return json({ klanten: klanten.map((k) => metPlanning(k, env)), types: TYPES, handmatig: HANDMATIG, reviewLink: !!env("REVIEW_LINK") });
    if (request.method === "POST") {
      const k = { id: nieuweId(), naam: "", bedrijf: "", email: "", telefoon: "", boekhouder: wie, status: "klant", start: "", voorstelLink: "", notitie: "", uit: [], verstuurd: {}, log: [], door: wie, aangemaakt: nu };
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
      k.gewijzigd = nu; k.gewijzigdDoor = wie;
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
    const data = body.sleutel ? (gepland(k).find((m) => m.sleutel === body.sleutel) || {}).data : handmatigeData(body.type);
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
    const data = handmatigeData(body.type);
    const m = maakMail(k, body.type, data, env);
    if (test) m.subject = "[TEST] " + m.subject;
    const r = await verstuur(env, { aan, mail: m });
    k.log = k.log || [];
    k.log.unshift({ type: body.type, onderwerp: m.subject, aan, op: nu, door: wie, test, ok: r.ok, fout: r.fout || null, handmatig: true });
    k.log = k.log.slice(0, 100);
    const sl = sleutelVoor(body.type, data, k);
    if (r.ok && !test && sl) k.verstuurd = { ...(k.verstuurd || {}), [sl]: nu };
    await bewaar();
    return json({ ...r, klant: metPlanning(k, env) }, r.ok ? 200 : 502);
  }

  // Kwartaalstatus: stukken binnen, aangifte ingediend, btw betaald
  if (pad === "/intern/api/klant/kwartaal" && request.method === "PATCH") {
    const k = vind(body.id);
    if (!k || !/^\d{4}-Q[1-4]$/.test(body.kw || "") || !["binnen", "ingediend", "betaald"].includes(body.veld)) return json({ fout: "Ongeldig" }, 400);
    k.kwartalen = k.kwartalen || {};
    const kw = (k.kwartalen[body.kw] = k.kwartalen[body.kw] || {});
    kw[body.veld] = body.aan ? nu : null;
    kw[body.veld + "Door"] = body.aan ? wie : null;
    await bewaar();
    return json({ klant: metPlanning(k, env) });
  }

  // IB-aangifte ingediend per jaar
  if (pad === "/intern/api/klant/ib" && request.method === "PATCH") {
    const k = vind(body.id);
    if (!k || !/^\d{4}$/.test(String(body.jaar || ""))) return json({ fout: "Ongeldig" }, 400);
    k.ibIngediend = k.ibIngediend || {};
    if (body.aan) k.ibIngediend[body.jaar] = nu; else delete k.ibIngediend[body.jaar];
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
      k.tijdlijn.unshift({ id: nieuweId(), tekst, soort, op: nu, door: wie });
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
        vermijdbaar: body.vermijdbaar === true, notitie: String(body.notitie || "").replace(/[<>]/g, "").trim().slice(0, 1000), door: wie,
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
