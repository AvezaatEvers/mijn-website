// Afscherming van de website tot de lancering.
// Bezoekers zonder toegang zien /binnenkort.html.
// Met het juiste wachtwoord krijgt de bezoeker 30 dagen toegang (cookie).
//
// LANCERING: verwijder dit bestand (netlify/edge-functions/toegang.js),
// dan is de hele site direct voor iedereen open.
//
// Wachtwoord wijzigen? Vraag Claude om de twee hashes hieronder opnieuw te berekenen.

const PASSWORD_HASH = "2a5c5f2623024ce3de6fe7dc8f5e13ca55b7aadc13174254b40af574e37018c1";
const TOKEN_HASH = "2d42fb7ac4edcd7e2f7dc6288c5cd720f21c50d6b91fd332e41a2204d00876e6";
const SALT = "avezaat-evers:toegang:";
const COOKIE = "ae_toegang";

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default async (request, context) => {
  const url = new URL(request.url);

  // Wachtwoord controleren
  if (url.pathname === "/ontgrendel") {
    if (request.method !== "POST") return Response.redirect(new URL("/", url), 303);
    const form = await request.formData();
    const pw = String(form.get("wachtwoord") || "").trim();
    if ((await sha256(pw)) === PASSWORD_HASH) {
      const token = await sha256(SALT + pw);
      return new Response(null, {
        status: 303,
        headers: {
          Location: "/",
          "Set-Cookie": `${COOKIE}=${token}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`,
        },
      });
    }
    return new Response(null, { status: 303, headers: { Location: "/?fout=1" } });
  }

  // Al toegang? Dan gewoon de site tonen
  const cookie = context.cookies.get(COOKIE);
  if (cookie && (await sha256(cookie)) === TOKEN_HASH) {
    return context.next();
  }

  // Anders: de 'binnenkort'-pagina tonen, op elk adres
  const res = await fetch(new URL("/binnenkort.html", url));
  return new Response(res.body, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
};

export const config = {
  path: "/*",
  excludedPath: ["/assets/*", "/binnenkort.html", "/robots.txt"],
};
