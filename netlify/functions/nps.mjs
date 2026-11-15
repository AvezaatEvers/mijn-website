// Openbare pagina /nps: de klant klikt in de mail op een cijfer, wij slaan het op en vragen kort waarom.
import { getStore } from "@netlify/blobs";
import { npsToken } from "../klant-mails.js";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function pagina(titel, inhoud) {
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${esc(titel)} | Avezaat &amp; Evers</title>
<link rel="icon" href="/favicon.ico"><link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#F4F6FA;font-family:Poppins,'Segoe UI',Helvetica,Arial,sans-serif;color:#374151;display:flex;flex-direction:column;align-items:center;padding:40px 16px}
.logo{font-weight:700;font-size:21px;color:#111827;text-decoration:none;margin-bottom:24px}.logo span{color:#26458F}
.kaart{background:#fff;border:1px solid #E5E9F0;border-radius:18px;padding:36px 32px;max-width:560px;width:100%;box-shadow:0 20px 50px -30px rgba(38,69,143,.35)}
h1{font-size:26px;line-height:1.25;color:#111827;margin:0 0 14px;letter-spacing:-.3px}p{font-size:16px;line-height:1.7;margin:0 0 18px}
.cijfer{display:inline-grid;place-items:center;width:64px;height:64px;border-radius:18px;font-size:28px;font-weight:700;margin-bottom:18px}
textarea{width:100%;min-height:120px;font:inherit;font-size:15px;padding:12px 14px;border:1px solid #D9E0EC;border-radius:12px;resize:vertical}
textarea:focus{outline:2px solid #26458F;border-color:#26458F}
.knop{display:inline-block;font:inherit;font-size:16px;font-weight:600;padding:14px 24px;border-radius:12px;border:0;background:#26458F;color:#fff;text-decoration:none;cursor:pointer;margin-top:14px}
.knop.licht{background:#EEF2F8;color:#26458F;margin-left:6px}
.klein{font-size:13px;color:#6B7280}
</style></head><body><a class="logo" href="/">Avezaat <span>&amp;</span> Evers</a><main class="kaart">${inhoud}</main></body></html>`;
}
const antwoord = (html, status = 200) => new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

export default async (req) => {
  const url = new URL(req.url);
  const env = (k) => process.env[k];
  let params = Object.fromEntries(url.searchParams);
  if (req.method === "POST") params = { ...params, ...Object.fromEntries(new URLSearchParams(await req.text())) };
  const { k: id, r: ronde, t: token } = params;
  const score = Number(params.s);
  if (!id || !ronde || token !== npsToken(env, id, ronde) || !(score >= 0 && score <= 10) || !Number.isInteger(score)) {
    return antwoord(pagina("Link verlopen", `<h1>Deze link werkt niet (meer)</h1><p>Wil je ons toch laten weten hoe we het doen? Mail of app ons gerust: <strong>085 060 4363</strong>.</p>`), 400);
  }

  const store = getStore({ name: "intern", consistency: "strong" });
  const klanten = (await store.get("klanten", { type: "json" })) || [];
  const k = klanten.find((x) => x.id === id);
  if (!k) return antwoord(pagina("Bedankt", `<h1>Bedankt!</h1><p>We hebben je antwoord ontvangen.</p>`));

  const nu = new Date().toISOString();
  k.nps = k.nps || [];
  let n = k.nps.find((x) => x.ronde === ronde);
  if (!n) { n = { ronde, score, reden: "", op: nu }; k.nps.unshift(n); }
  n.score = score; n.op = nu;
  if (req.method === "POST") n.reden = String(params.reden || "").replace(/[<>]/g, "").trim().slice(0, 2000);
  if (score >= 9) k.tevreden = true;
  if (score <= 6) k.tevreden = false;
  await store.setJSON("klanten", klanten);

  const voornaam = String(k.naam || "").split(" ")[0];
  const kleur = score <= 6 ? "#FDECEA;color:#B42318" : score <= 8 ? "#FEF3E2;color:#9A5B13" : "#E6F4EA;color:#15803D";
  const review = env("REVIEW_LINK");

  if (req.method === "POST") {
    const promotor = score >= 9;
    return antwoord(pagina("Bedankt", `<div class="cijfer" style="background:${kleur}">${score}</div>
<h1>Dank je wel${voornaam ? ", " + esc(voornaam) : ""}!</h1>
<p>${promotor ? "Wat fijn om te horen. Daar doen we het voor." : score >= 7 ? "We gaan ermee aan de slag. Heb je een idee hoe het beter kan? We horen het graag." : "Dank je voor je eerlijkheid. Je boekhouder neemt binnenkort contact met je op om te horen wat er beter moet."}</p>
${promotor && review ? `<p>Wil je dat ook op Google zetten? Andere ondernemers kiezen hun boekhouder vaak op basis van reviews. Voor ons maakt het echt verschil.</p><a class="knop" href="${esc(review)}" target="_blank" rel="noopener">Schrijf een review</a><a class="knop licht" href="/aanbevelen.html">Iemand aanbevelen</a>` : ""}
${promotor && !review ? `<a class="knop" href="/aanbevelen.html">Ken je iemand? Allebei een maand gratis</a>` : ""}`));
  }

  return antwoord(pagina("Bedankt", `<div class="cijfer" style="background:${kleur}">${score}</div>
<h1>Bedankt${voornaam ? ", " + esc(voornaam) : ""}! Je cijfer is opgeslagen.</h1>
<p>${score >= 9 ? "Wat maakt dat je ons zo'n hoog cijfer geeft?" : score >= 7 ? "Wat zou er moeten veranderen voor een 9 of 10?" : "Wat moet er beter? We nemen het serieus."}</p>
<form method="post" action="/nps?k=${encodeURIComponent(id)}&r=${encodeURIComponent(ronde)}&t=${encodeURIComponent(token)}&s=${score}">
<textarea name="reden" maxlength="2000" placeholder="Typ hier je antwoord (mag kort)"></textarea>
<button class="knop" type="submit">Versturen</button>
</form>
<p class="klein" style="margin-top:16px">Verkeerd cijfer gekozen? Klik in de mail gewoon op een ander cijfer.</p>`));
};

export const config = { path: "/nps" };
