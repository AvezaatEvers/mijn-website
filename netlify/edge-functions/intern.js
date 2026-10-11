// Afscherming van de interne pagina's voor Koen en Daan (dashboard, voorstel-mail, handtekening).
// Dit blijft ook na de lancering actief, los van de wachtwoordpagina van de hele site.
// Wachtwoord wijzigen? Vraag Claude om de twee hashes hieronder opnieuw te berekenen.

const PASSWORD_HASH = "3d0e9b81ac60872ed13662c4aec2e0235cb13fa7c2ca70f3199fc92af5d67ba4";
const TOKEN_HASH = "8d3f0f0f4000e0daed9d6acf85d87e1b6134027252cd8f5deaef62e1c96f4d3f";
const SALT = "avezaat-evers:intern:";
const COOKIE = "ae_intern";

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function inlogPagina(fout) {
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Intern | Avezaat &amp; Evers</title><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<style>
@font-face{font-family:P;font-weight:500;src:url(/assets/fonts/poppins-500.woff2)}@font-face{font-family:P;font-weight:700;src:url(/assets/fonts/poppins-700.woff2)}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:P,system-ui,sans-serif;background:#EEF2FB;color:#111827;padding:24px}
form{width:100%;max-width:380px;background:#fff;border-radius:22px;padding:32px;box-shadow:0 20px 50px -24px rgba(17,24,39,.35);display:flex;flex-direction:column;gap:14px}
.logo{font-weight:700;font-size:20px;letter-spacing:-.02em}.logo span{color:#1E40AF}h1{font-size:22px;margin:6px 0 0}p{margin:0;color:#4B5563;font-size:15px}
input{font:inherit;padding:12px 14px;border:1px solid #E5E7EB;border-radius:12px;font-size:16px}input:focus{outline:2px solid #1E40AF;border-color:#1E40AF}
button{font:inherit;font-weight:500;padding:13px;border:0;border-radius:12px;background:#1E40AF;color:#fff;font-size:16px;cursor:pointer}.fout{color:#B91C1C;font-size:14px}
</style></head><body><form method="POST" action="/intern/login"><div class="logo">Avezaat <span>&amp;</span> Evers</div><h1>Intern</h1><p>Alleen voor Koen en Daan.</p>
${fout ? '<p class="fout">Dat wachtwoord klopt niet.</p>' : ''}<input type="password" name="wachtwoord" placeholder="Wachtwoord" autocomplete="current-password" autofocus required><button type="submit">Inloggen</button></form></body></html>`;
}

export default async (request, context) => {
  const url = new URL(request.url);

  if (url.pathname === "/intern/login") {
    if (request.method !== "POST") return Response.redirect(new URL("/intern/", url), 303);
    const form = await request.formData();
    const pw = String(form.get("wachtwoord") || "").trim();
    if ((await sha256(pw)) === PASSWORD_HASH) {
      const token = await sha256(SALT + pw);
      return new Response(null, {
        status: 303,
        headers: {
          Location: "/intern/",
          "Set-Cookie": `${COOKIE}=${token}; Path=/; Max-Age=7776000; HttpOnly; Secure; SameSite=Lax`,
        },
      });
    }
    return new Response(inlogPagina(true), { status: 401, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }

  const cookie = context.cookies.get(COOKIE);
  if (cookie && (await sha256(cookie)) === TOKEN_HASH) return context.next();

  return new Response(inlogPagina(false), { status: 401, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
};

export const config = {
  path: ["/intern", "/intern/*", "/handtekening.html", "/voorstel.html"],
};
