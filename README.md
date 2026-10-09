# Website Avezaat & Evers

Statische website (HTML + CSS), gehost op Netlify vanuit GitHub. Geen build-stap nodig.

## Pagina's

| Bestand | Pagina |
|---|---|
| `index.html` | Homepage |
| `tarieven.html` | Tarieven met vergelijkingstabel en extra's |
| `starters.html` | Landingspagina voor startende zzp'ers |
| `overstappen.html` | Landingspagina voor overstappers |
| `contact.html` | Kennismakingsformulier |
| `bedankt.html` | Bedankpagina na formulier |
| `kennisbank/` | Overzicht + 3 artikelen |
| `voorwaarden.html` | Algemene voorwaarden (CONCEPT) |
| `privacy.html` | Privacyverklaring (CONCEPT) |
| `404.html` | Foutpagina |

Huisstijl: `assets/style.css` (kleuren bovenaan als variabelen). Menu en formulier-hulp: `assets/main.js`.

## Afscherming tot de lancering

Zolang `netlify/edge-functions/toegang.js` bestaat, ziet elke bezoeker `binnenkort.html`. Met het wachtwoord (via "Toegang" rechtsonder) krijg je 30 dagen toegang tot de echte site.

**Lancering:** verwijder `netlify/edge-functions/toegang.js` – dan is de site direct open.

## Vóór livegang invullen

Zoek in alle bestanden op `[` om de placeholders te vinden:

- `[TELEFOON]`, `[WHATSAPP-NUMMER]` (formaat 316xxxxxxxx, zonder + of spaties)
- `[OPLEIDING/ERVARING DAAN]`
- `[BETAALWIJZE…]` op de tarievenpagina
- Privacy en voorwaarden: rechtsvorm, adres, datum, termijnen – en laat ze controleren
- Domein: overal staat `https://www.avezaatenevers.nl` – aanpassen als het domein anders wordt

## Foto's

Zet foto's in `assets/img/` en vervang de placeholderblokken (zie het commentaar `<!-- FOTO: ... -->` in `index.html`):

- `koen-daan.jpg` – hero, staand formaat (4:5), ± 1200 px breed
- `koen.jpg` en `daan.jpg` – vierkant, ± 800 px

## Kennismaking plannen (Cal.com)

Alle knoppen "Plan een kennismaking" openen de Cal.com-agenda als pop-up; op `contact.html` staat de agenda in de pagina. De link staat in `assets/cal.js` (`CAL_LINK`). Laadt Cal.com niet, dan gaan de knoppen gewoon naar de contactpagina.

## Formulier

Werkt via **Netlify Forms** (`data-netlify="true"`). Aanvragen verschijnen in Netlify onder *Forms*. Stel daar een e-mailmelding in (*Forms → Form notifications*).

## Wijzigen

Vraag Claude: "werk aan de Avezaat & Evers-site in GitHub" en beschrijf de wijziging. Header en footer staan op elke pagina; een wijziging daarin moet op alle pagina's.
