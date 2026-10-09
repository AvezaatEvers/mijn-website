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

## Testgegevens die vóór livegang vervangen moeten worden

- Telefoonnummer en WhatsApp staan tijdelijk op het TESTNUMMER +31 6 12345678 (weergegeven als "06 1234 5678", links `tel:+31612345678` en `wa.me/31612345678`). Vóór het live zetten vervangen door het echte nummer, en de gebruiker hierop wijzen.
