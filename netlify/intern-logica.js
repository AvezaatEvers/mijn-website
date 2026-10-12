// Logica van de interne omgeving (inloggen per persoon en de gedeelde takenlijst).
// Los van Netlify gehouden zodat het lokaal te testen is; intern.js koppelt de opslag.

export const GEBRUIKERS = {
  koen: { naam: "Koen", ww: "cdb513e66ec9f28dd349f7e10dd5548ed2700ef5e9d2fe0171223333bfc95559", token: "f22c1dbdc05db90390925e23ee897ae57de848e00172be81f1a2718c099c3bf9" },
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
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:P,system-ui,sans-serif;background:#EEF2FB;color:#111827;padding:24px}
form{width:100%;max-width:380px;background:#fff;border-radius:22px;padding:32px;box-shadow:0 20px 50px -24px rgba(17,24,39,.35);display:flex;flex-direction:column;gap:14px}
.logo{font-weight:700;font-size:20px;letter-spacing:-.02em}.logo span{color:#1E40AF}h1{font-size:22px;margin:6px 0 0}p{margin:0;color:#4B5563;font-size:15px}
.wie{display:grid;grid-template-columns:1fr 1fr;gap:8px}.wie label{display:block}.wie input{position:absolute;opacity:0}.wie span{display:block;text-align:center;padding:11px;border:1px solid #E5E7EB;border-radius:12px;cursor:pointer;font-weight:500}
.wie input:checked+span{border-color:#1E40AF;background:#EEF2FB;color:#1E40AF}.wie input:focus-visible+span{outline:2px solid #1E40AF}
input[type=password]{font:inherit;padding:12px 14px;border:1px solid #E5E7EB;border-radius:12px;font-size:16px}input[type=password]:focus{outline:2px solid #1E40AF;border-color:#1E40AF}
button{font:inherit;font-weight:500;padding:13px;border:0;border-radius:12px;background:#1E40AF;color:#fff;font-size:16px;cursor:pointer}.fout{color:#B91C1C;font-size:14px}
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
export async function verwerk(request, cookies, next, maakStore) {
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
        klaar: false, klaarDoor: null, klaarOp: null, door: wie, aangemaakt: nu });
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

  return next();
}
