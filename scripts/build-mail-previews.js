// Bouwt /intern/mails/index.html: voorbeelden van alle mailsjablonen.
// Draaien: node scripts/build-mail-previews.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mails } from '../netlify/functions/lib/mails.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const voorbeelden = [
  ['kennismaking', 'Bevestiging kennismaking', 'Automatisch, naar de bezoeker, direct na het kennismakingsformulier.',
    mails.kennismaking({ naam: 'Sanne de Vries' })],
  ['prijscheck', 'Uitkomst prijscheck', 'Automatisch, naar de bezoeker, direct na de prijscheck.',
    mails.prijscheck({ naam: 'Mark Jansen', situatie: 'boekhouder', branche: 'Installatie', transacties: '50-150', eu: 'ja', partner: 'ja', prijs: '€95 p/m' })],
  ['intern', 'Melding nieuwe aanvraag', 'Automatisch, naar jullie (MAIL_TO), bij elk formulier.',
    mails.intern({ naam: 'Mark Jansen', email: 'mark@voorbeeld.nl', telefoon: '06 12345678', situatie: 'boekhouder', branche: 'Installatie', transacties: '50-150', eu: 'ja', partner: 'ja', prijs: '€95 p/m' }, '', 'prijscheck')],
  ['voorstelmail', 'Voorstel', 'Handmatig, via de voorstelpagina, na de kennismaking.',
    mails.voorstel({ naam: 'Sanne', bedrijf: 'Studio Sanne', wie: 'daan', pakket: 80, icp: true, partner: false, overstap: 'gratis', achterstand: 0, start: '1 januari 2027', geldig: '29 november 2026', situatie: 'je net gestart bent als grafisch ontwerper en je je administratie vanaf het begin goed wilt regelen' })],
  ['voorstel', 'Herinnering voorstel', 'Automatisch, 2 dagen na het voorstel, zolang de status Prospect is.',
    mails.voorstelHerinnering({ naam: 'Sanne de Vries', wie: 'koen' })],
  ['welkom', 'Welkom nieuwe klant', 'Later: direct na het tekenen.',
    mails.welkom({ naam: 'Sanne de Vries', wie: 'koen' })],
  ['checkin', 'Check-in na 2 weken', 'Later: 2 weken na het tekenen.',
    mails.checkIn({ naam: 'Sanne de Vries', wie: 'koen' })],
  ['kwartaal', 'Kwartaalherinnering btw', 'Later: begin januari, april, juli en oktober, naar alle klanten.',
    mails.kwartaal({ naam: 'Sanne de Vries', wie: 'koen', kwartaal: '4e kwartaal van 2026', aanleverdatum: '10 januari', deadline: '31 januari' })],
  ['jaareinde', 'Jaareinde', 'Later: eind november, naar alle klanten.',
    mails.jaareinde({ naam: 'Sanne de Vries', wie: 'koen' })],
  ['ib', 'Aangifte inkomstenbelasting', 'Later: begin maart, naar alle klanten.',
    mails.inkomstenbelasting({ naam: 'Sanne de Vries', wie: 'koen', jaar: '2026', aanleverdatum: '1 april' })],
  ['kwartaal2', 'Tweede herinnering btw', 'Automatisch rond de 8e, alleen als de stukken nog niet binnen zijn.',
    mails.kwartaalTweede({ naam: 'Sanne de Vries', wie: 'koen', kwartaal: '4e kwartaal van 2026', aanleverdatum: '10 januari', deadline: '31 januari' })],
  ['review', 'Google-review vragen', 'Automatisch, 3 maanden na de start (zodra REVIEW_LINK in Netlify staat).',
    mails.review({ naam: 'Sanne de Vries', wie: 'koen', reviewLink: 'https://g.page/r/voorbeeld/review' })],
  ['aanbevelen', 'Aanbevelen', 'Automatisch, 2 weken na de eerste ingediende IB-aangifte, alleen bij tevreden klanten.',
    mails.aanbevelen({ naam: 'Sanne de Vries', wie: 'koen' })],
  ['jubileum', 'Een jaar klant', 'Automatisch, 1 jaar na de start.',
    mails.jubileum({ naam: 'Sanne de Vries', wie: 'koen', btwAantal: 4, ib: true })],
  ['nps', 'Tevredenheid meten (NPS)', 'Automatisch na 3 maanden, een week na de IB-aangifte, en op 10 juni en 10 november.',
    mails.nps({ naam: 'Sanne de Vries', wie: 'koen', npsBasis: '#' })],
  ['afspraak', 'Kennismaking gepland (planner)', 'Automatisch, naar de bezoeker, direct na het boeken via Cal.com. Met agenda-bijlage.',
    mails.afspraak({ naam: 'Sanne de Vries', wie: '', wanneer: 'donderdag 3 december om 14:00', datum: 'donderdag 3 december', tijd: '14:00', eindtijd: '14:20', duur: 20, video: 'https://app.cal.com/video/voorbeeld', verzet: 'https://cal.com/reschedule/voorbeeld', annuleer: 'https://cal.com/booking/voorbeeld?cancel=true' })],
  ['afspraakVerzet', 'Kennismaking verzet (planner)', 'Automatisch, naar de bezoeker, na het verzetten via Cal.com. Werkt het agenda-item bij.',
    mails.afspraakVerzet({ naam: 'Sanne de Vries', wie: '', wanneer: 'vrijdag 4 december om 10:30', datum: 'vrijdag 4 december', tijd: '10:30', eindtijd: '10:50', duur: 20, video: 'https://app.cal.com/video/voorbeeld', verzet: 'https://cal.com/reschedule/voorbeeld', annuleer: 'https://cal.com/booking/voorbeeld?cancel=true' })],
  ['afspraakHerinnering', 'Herinnering kennismaking (planner)', 'Automatisch, naar de bezoeker, ongeveer 2 uur voor de kennismaking. Niet als er minder dan 3 uur tussen boeken en de afspraak zit.',
    mails.afspraakHerinnering({ naam: 'Sanne de Vries', wie: '', wanneer: 'donderdag 3 december om 14:00', datum: 'donderdag 3 december', tijd: '14:00', eindtijd: '14:20', duur: 20, video: 'https://app.cal.com/video/voorbeeld', verzet: 'https://cal.com/reschedule/voorbeeld', annuleer: 'https://cal.com/booking/voorbeeld?cancel=true' })],
  ['afspraakIntern', 'Melding kennismaking (naar jullie)', 'Automatisch, naar Koen en Daan (MAIL_TO), bij boeken, verzetten en annuleren via de planner. Met agenda-bijlage.',
    mails.afspraakIntern({ soort: 'gepland', naam: 'Sanne de Vries', email: 'sanne@voorbeeld.nl', telefoon: '06 12345678', situatie: 'Wil overstappen van boekhouder', bericht: 'Ik wil per 1 januari overstappen.', wanneer: 'donderdag 3 december om 10:00', wie: 'koen', video: 'https://meet.google.com/abc-defg-hij', klantLink: '#' })],
  ['afspraakGeannuleerd', 'Kennismaking geannuleerd (planner)', 'Automatisch, naar de bezoeker, na het annuleren via Cal.com. Haalt het agenda-item weg.',
    mails.afspraakGeannuleerd({ naam: 'Sanne de Vries', wie: '', wanneer: 'vrijdag 4 december om 10:30', datum: 'vrijdag 4 december', tijd: '10:30', eindtijd: '10:50', duur: 20, video: 'https://app.cal.com/video/voorbeeld', reden: '' })],
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const html = `<!DOCTYPE html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Mailsjablonen | Avezaat &amp; Evers</title>
<link rel="icon" href="/favicon.ico">
<style>
body{margin:0;background:#F6F7F9;font-family:Poppins,'Segoe UI',Helvetica,Arial,sans-serif;color:#111827}
.wrap{max-width:1180px;margin:0 auto;padding:32px 16px 80px}
h1{font-size:28px;margin:0 0 6px}.sub{color:#4B5563;margin:0 0 24px;line-height:1.6}
nav{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 32px}
nav a{font-size:14px;padding:8px 12px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;color:#111827;text-decoration:none}
nav a:hover{border-color:#26458F}
section{background:#fff;border:1px solid #E5E7EB;border-radius:16px;padding:24px;margin:0 0 28px;scroll-margin-top:16px}
section h2{font-size:20px;margin:0 0 4px}.wanneer{color:#4B5563;font-size:14px;margin:0 0 16px}
.meta{font-size:14px;color:#4B5563;background:#F6F7F9;border-radius:10px;padding:12px 14px;margin:0 0 16px;line-height:1.6}
.meta b{color:#111827}
.views{display:grid;grid-template-columns:1fr 390px;gap:20px;align-items:start}
.views figure{margin:0}.views figcaption{font-size:13px;color:#6B7280;margin:0 0 6px}
iframe{width:100%;border:1px solid #E5E7EB;border-radius:12px;background:#EEF2F8}
@media (max-width:900px){.views{grid-template-columns:1fr}.mob{display:none}}
</style></head><body><div class="wrap">
<h1>Mailsjablonen</h1>
<p class="sub">Voorbeelden van alle automatische mails, met voorbeeldgegevens. De eerste drie gaan naar websitebezoekers. De rest staat per klant in het dashboard onder Klanten.</p>
<nav>${voorbeelden.map(([id, titel]) => `<a href="#${id}">${titel}</a>`).join('')}</nav>
${voorbeelden.map(([id, titel, wanneer, m]) => `<section id="${id}">
<h2>${titel}</h2><p class="wanneer">${wanneer}</p>
<div class="meta"><b>Onderwerp:</b> ${esc(m.subject)}<br><b>Van:</b> Avezaat &amp; Evers &lt;info@avezaatenevers.nl&gt;</div>
<div class="views">
<figure><figcaption>Desktop</figcaption><iframe title="${esc(titel)} desktop" srcdoc="${esc(m.html)}" loading="lazy" onload="this.style.height=this.contentDocument.body.scrollHeight+'px'"></iframe></figure>
<figure class="mob"><figcaption>Mobiel</figcaption><iframe title="${esc(titel)} mobiel" srcdoc="${esc(m.html)}" loading="lazy" onload="this.style.height=this.contentDocument.body.scrollHeight+'px'"></iframe></figure>
</div></section>`).join('\n')}
</div></body></html>`;

const uit = path.join(__dirname, '..', 'intern', 'mails');
fs.mkdirSync(uit, { recursive: true });
fs.writeFileSync(path.join(uit, 'index.html'), html);
console.log('geschreven:', path.join(uit, 'index.html'), voorbeelden.length, 'mails');
