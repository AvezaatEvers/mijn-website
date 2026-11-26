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

## Afspraken (Cal.com)

- Boeken gaat via https://cal.com/avezaatenevers/kennismaking. De standaardmails van Cal.com staan uit; `netlify/functions/cal-webhook.mjs` (https://avezaatenevers.nl/api/cal-webhook) stuurt de bevestiging, verzet- en annuleringsmail in huisstijl (sjablonen `afspraak*` in `netlify/functions/lib/mails.js`), zet de afspraak bij de lead in het dashboard en stuurt een pushmelding.
- Vereist in Netlify de omgevingsvariabele `CAL_WEBHOOK_SECRET`, gelijk aan de secret van de webhook in Cal.com.

## Contactgegevens

- Telefoon en WhatsApp: 085 060 4363 (links `tel:+31850604363` en `wa.me/31850604363`).

## Linear

- Projectbeheer staat in Linear (team AVE). Klantwerk blijft in het interne dashboard, niet in Linear.
- Hoort een wijziging bij een issue, zet het nummer in de commit, bijvoorbeeld `Fixes AVE-26`. GitHub koppelt de commit dan aan het issue.
