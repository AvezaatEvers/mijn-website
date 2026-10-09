# Werkafspraken voor deze repository

Website van Avezaat & Evers (statische HTML, gehost op Netlify).

## Altijd via de conceptversie werken

- Elke publicatie naar `main` kost op Netlify 15 credits (gratis plan: 300 per maand). Branch deploys kosten 0 credits.
- **Commit en push wijzigingen daarom altijd naar de branch `concept`**, nooit rechtstreeks naar `main`.
- Conceptversie: https://concept--preeminent-baklava-40debb.netlify.app
- Live site: https://preeminent-baklava-40debb.netlify.app
- Pas als de gebruiker expliciet "zet live" (of iets gelijkwaardigs) zegt: `concept` mergen naar `main` en pushen. Bundel wijzigingen; zet niet na elke kleine aanpassing live.
- Na het live zetten `concept` weer gelijk houden met `main`.

## Overig

- Na wijzigingen aan `assets/style.css` of `assets/*.js`: het versienummer (`?v=N`) in alle HTML-bestanden ophogen, anders tonen browsers de oude opmaak.
- De site is afgeschermd met `netlify/edge-functions/toegang.js` tot de lancering (wachtwoord bekend bij de gebruiker).
