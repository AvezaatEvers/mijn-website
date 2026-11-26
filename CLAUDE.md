# Werkafspraken voor deze repository

Website van Avezaat & Evers (statische HTML, gehost op Netlify).

## Altijd via de conceptversie werken

- Elke publicatie naar `main` kost op Netlify 15 credits (gratis plan: 300 per maand). Branch deploys kosten 0 credits.
- **Commit en push wijzigingen daarom altijd naar de branch `concept`**, nooit rechtstreeks naar `main`.
- Conceptversie: https://concept--preeminent-baklava-40debb.netlify.app
- Live site: https://avezaatenevers.nl (gekoppeld domein; www verwijst door naar zonder www). Ook bereikbaar via preeminent-baklava-40debb.netlify.app
- Pas als de gebruiker expliciet "zet live" (of iets gelijkwaardigs) zegt: `concept` mergen naar `main` en pushen. Bundel wijzigingen; zet niet na elke kleine aanpassing live.
- Na het live zetten `concept` weer gelijk houden met `main`.

## Overig

- Na wijzigingen aan `assets/style.css` of `assets/*.js`: het versienummer (`?v=N`) in alle HTML-bestanden ophogen, anders tonen browsers de oude opmaak.
- De site is sinds 27 oktober 2026 live en open. Alleen `/intern/`, `/voorstel(.html)` en `/handtekening(.html)` zijn afgeschermd (ook zonder .html, want Netlify serveert die adressen ook) via `netlify/edge-functions/intern.js`.

## Zoekmachines (IndexNow)

- Na elke geslaagde productiedeploy meldt `netlify/functions/deploy-succeeded.mjs` de gewijzigde pagina's bij Bing via IndexNow. Sleutelbestand: `/f42ea39f717d4a22b4a55ec378b1aa2e.txt` (niet verwijderen).
- Welke pagina's gewijzigd zijn, komt uit `<lastmod>` in `sitemap.xml`. **Werk bij elke wijziging aan een openbare pagina de `lastmod` van die pagina bij** (datum van vandaag), en voeg nieuwe pagina's toe aan de sitemap.

## Kennismakingen (eigen planner, vervangt Cal.com)

- Klanten boeken op /contact#plannen (`assets/planner.js`); verzetten en annuleren via /afspraak met een beveiligde link uit de mail. Regels: 20 minuten, tot 2 weken vooruit (instelbaar in het dashboard, 1 tot 8 weken), minstens 24 uur van tevoren, de afspraak gaat naar wie er vrij is (constanten in `netlify/functions/lib/planner.js`).
- Koen en Daan zetten hun beschikbaarheid in het dashboard: /intern/beschikbaarheid.html (menu: Kennismakingen; op mobiel tabbladen #afspraken, #tijden, #koppelingen). Daar ook de lijst met afspraken (verzetten en annuleren namens ons, de klant krijgt een mail) en het koppelen van Google Agenda. Verzetten door ons mag op elk toekomstig moment, ook buiten de vaste tijden en binnen 24 uur; alleen een andere kennismaking van dezelfde persoon blokkeert, iets in de Apple Agenda geeft een waarschuwing (`verzetDoorOns` in `lib/planner.js`).
- Server: `netlify/functions/planner.mjs` (openbaar, /api/planner/*) en `planner-intern.mjs` (dashboard, /intern/api/planner/*). Na boeken/verzetten/annuleren doet `lib/planner-acties.js` alles: Google-agenda-item met Meet-link (`lib/google.js`), lead en afspraak in het dashboard, mail met agenda-bijlage (sjablonen `afspraak*` in `lib/mails.js`), pushmelding en logboek.
- Google: in Netlify `GOOGLE_CLIENT_ID` en `GOOGLE_CLIENT_SECRET` (OAuth-client in Google Cloud, redirect-URI https://avezaatenevers.nl/intern/api/planner/google/terug). Elk koppelt zijn eigen Google-account in het dashboard (of één account voor allebei: wie niet gekoppeld is, gebruikt het account van de ander); de refresh tokens staan in Blobs (`planner-google`). De Meet wordt via de Meet-API aangemaakt met toegang **Open** (iedereen met de link kan direct meedoen, ook zonder Google-account); daarvoor moet in Google Cloud ook de **Google Meet REST API** aanstaan. Lukt dat niet, dan een gewone Meet via de agenda en staat er "Meet niet open" in het logboek. Lukt Google niet, dan gaat de boeking door en meldt de mail dat de link volgt.
- Apple Agenda (iCloud, CalDAV): elk koppelt in het dashboard zijn Apple ID met een app-specifiek wachtwoord (versleuteld in Blobs, `planner-apple`) en kiest welke agenda's meetellen. `lib/apple.js` leest de bezette tijden (ook herhalingen en hele dagen; afspraken op "vrij" en geannuleerde tellen niet) en bewaart ze 5 minuten in `planner-bezet`; bij boeken wordt opnieuw gekeken als dat meer dan een minuut oud is. Lukt iCloud niet, dan gelden de laatst bekende tijden (tot 24 uur). Afhankelijkheid: `ical.js`.
- `netlify/functions/afspraak-herinnering.mjs` draait elke 10 minuten (alleen live) en stuurt ongeveer 2 uur voor de kennismaking een herinnering (alleen "ander moment kiezen", geen annuleerlink), behalve als er minder dan 3 uur tussen boeken en de afspraak zit.
- `netlify/functions/push-agenda.mjs`: elke maandag om 9:00 (alleen live) een pushmelding per persoon om de beschikbaarheid te controleren, met vrije momenten en kennismakingen van die week (meldingssoort `agenda`, aan/uit onder Meldingen).
- `netlify/functions/cal-webhook.mjs` is alleen nog voor afspraken die nog via Cal.com zijn geboekt; kan weg zodra die voorbij zijn.

## Contactgegevens

- Telefoon en WhatsApp: 085 060 4363 (links `tel:+31850604363` en `wa.me/31850604363`).

## Linear

- Projectbeheer staat in Linear (team AVE). Klantwerk blijft in het interne dashboard, niet in Linear.
- Hoort een wijziging bij een issue, zet het nummer in de commit, bijvoorbeeld `Fixes AVE-26`. GitHub koppelt de commit dan aan het issue.
