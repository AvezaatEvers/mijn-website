// Mailsjablonen Avezaat & Evers.
// Elke functie geeft { subject, html, text } terug.
// Gebruikt door de Netlify Functions (verzenden via Resend), de interne klantenomgeving
// en scripts/build-mail-previews.js (voorbeeldpagina in /intern/mails/).

// ---------- Huisstijl ----------
const ACCENT = '#26458F';
const ACCENT_DONKER = '#1C3570';
const TINT = '#EEF2F8';
const ACHTERGROND = '#F4F6FA';
const INKT = '#111827';
const TEKST = '#374151';
const ZACHT = '#6B7280';
const LIJN = '#E5E9F0';
const TEL = '085 060 4363';
const TEL_LINK = 'tel:+31850604363';
const WA_LINK = 'https://wa.me/31850604363';
const MAIL = 'info@avezaatenevers.nl';
const F = "font-family:Poppins,'Segoe UI',Helvetica,Arial,sans-serif;";

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const voornaam = (naam) => {
  const v = String(naam || '').trim().split(/\s+/)[0] || '';
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : '';
};
const hoi = (naam) => (voornaam(naam) ? `Hoi ${esc(voornaam(naam))},` : 'Hoi,');
const hoiTekst = (naam) => (voornaam(naam) ? `Hoi ${voornaam(naam)},` : 'Hoi,');
const wieNaam = (wie) => (wie === 'daan' ? 'Daan' : wie === 'koen' ? 'Koen' : 'Koen en Daan');
const wieVol = (wie) => (wie === 'daan' ? 'Daan Evers' : wie === 'koen' ? 'Koen Avezaat' : 'Koen en Daan');
const euro = (n) => { const heel = Math.round(n * 100) % 100 === 0; return '€' + Number(n).toLocaleString('nl-NL', { minimumFractionDigits: heel ? 0 : 2, maximumFractionDigits: 2 }); };
const akkoordLink = (d) => `mailto:${MAIL}?subject=${encodeURIComponent('Akkoord voorstel' + (d.bedrijf ? ' ' + d.bedrijf : ''))}&body=${encodeURIComponent(`Hoi ${wieNaam(d.wie)},\n\nIk ga akkoord met het voorstel en wil graag starten${d.start ? ' per ' + d.start : ''}.\n\nGroet,\n${voornaam(d.naam)}`)}`;

// ---------- Bouwstenen ----------
const p = (t, extra = '') => `<p style="margin:0 0 18px;${F}font-size:16px;line-height:1.7;color:${TEKST};${extra}">${t}</p>`;
const sterk = (t) => `<strong style="color:${INKT};font-weight:600">${t}</strong>`;
const link = (href, t) => `<a href="${href}" style="color:${ACCENT};font-weight:600;text-decoration:underline;text-underline-offset:2px">${t}</a>`;
const kop = (t) => `<h1 style="margin:0 0 22px;${F}font-size:27px;line-height:1.25;font-weight:700;letter-spacing:-0.4px;color:${INKT}">${t}</h1>`;
const tussenkop = (t) => `<p style="margin:26px 0 12px;${F}font-size:13px;line-height:1.4;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;color:${ACCENT}">${t}</p>`;

const knop = (href, label) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 26px"><tr>
<td bgcolor="${ACCENT}" style="border-radius:12px;background:${ACCENT}">
<a href="${href}" style="display:inline-block;padding:15px 28px;${F}font-size:16px;line-height:1.2;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px">${label}</a>
</td></tr></table>`;

// Vinkjeslijst zoals op de site: blauwe rondjes met een vinkje
const vinkjes = (items) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:2px 0 22px">
${items.map((t) => `<tr>
<td width="34" valign="top" style="padding:2px 0 12px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="22" height="22" align="center" valign="middle" bgcolor="${TINT}" style="width:22px;height:22px;border-radius:11px;background:${TINT};${F}font-size:12px;line-height:22px;font-weight:700;color:${ACCENT}">&#10003;</td></tr></table>
</td>
<td valign="top" style="padding:1px 0 12px;${F}font-size:16px;line-height:1.6;color:${TEKST}">${t}</td></tr>`).join('')}
</table>`;

// Genummerde stappen
const stappen = (items) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:2px 0 24px">
${items.map(([titel, uitleg], i) => `<tr>
<td width="44" valign="top" style="padding:0 0 16px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="30" height="30" align="center" valign="middle" bgcolor="${ACCENT}" style="width:30px;height:30px;border-radius:15px;background:${ACCENT};${F}font-size:14px;line-height:30px;font-weight:700;color:#ffffff">${i + 1}</td></tr></table>
</td>
<td valign="top" style="padding:3px 0 16px;${F}font-size:16px;line-height:1.55;color:${TEKST}">${sterk(titel)}<br>${uitleg}</td></tr>`).join('')}
</table>`;

const blok = (inhoud) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 26px"><tr>
<td bgcolor="${TINT}" style="background:${TINT};border-radius:14px;padding:22px 24px">${inhoud}</td></tr></table>`;
const blokTekst = (t) => `<p style="margin:0;${F}font-size:15px;line-height:1.65;color:${TEKST}">${t}</p>`;

const tabel = (rijen) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
${rijen.map(([l, r], i) => {
    const kort = String(r).replace(/<[^>]+>/g, '').length <= 18;
    const rand = i ? `border-top:1px solid #D9E0EC;` : '';
    return `<tr><td valign="top" style="padding:10px 0;${rand}${F}font-size:15px;line-height:1.45;color:${TEKST}">${l}</td><td align="right" valign="top" style="padding:10px 0 10px 16px;${rand}${F}font-size:15px;line-height:1.45;color:${INKT};font-weight:600;${kort ? 'white-space:nowrap' : 'word-break:break-word'}">${r}</td></tr>`;
  }).join('')}
</table>`;

function groet(base, wie) {
  const namen = wie === 'daan' ? ['daan'] : wie === 'koen' ? ['koen'] : ['koen', 'daan'];
  const fotos = namen.map((n, i) => `<img src="${base}/assets/img/mail/${n}.jpg" width="52" height="52" alt="${n === 'koen' ? 'Koen' : 'Daan'}" style="display:inline-block;width:52px;height:52px;border-radius:26px;border:3px solid #ffffff;${i ? 'margin-left:-14px;' : ''}vertical-align:middle">`).join('');
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0"><tr>
<td valign="middle" style="padding-right:14px;white-space:nowrap">${fotos}</td>
<td valign="middle" style="${F}font-size:15px;line-height:1.45;color:${TEKST}">
<span style="color:${INKT};font-weight:600">${wieVol(wie)}</span><br>
<span style="color:${ZACHT};font-size:14px">${namen.length > 1 ? 'Jouw vaste boekhouders' : 'Jouw vaste boekhouder'} bij Avezaat &amp; Evers</span>
</td></tr></table>`;
}

function omhulsel(base, { preheader, inhoud, wie, appBlok = true }) {
  const app = appBlok ? `
<tr><td style="padding:16px 0 0">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td bgcolor="${ACCENT}" style="background:${ACCENT};border-radius:16px;padding:22px 26px">
<p style="margin:0 0 4px;${F}font-size:16px;line-height:1.4;font-weight:600;color:#ffffff">Een vraag tussendoor?</p>
<p style="margin:0 0 14px;${F}font-size:14px;line-height:1.6;color:#D6DEEF">App ${wie === 'daan' ? 'Daan' : wie === 'koen' ? 'Koen' : 'ons'} gewoon. Binnen 2 uur heb je antwoord.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td bgcolor="#ffffff" style="background:#ffffff;border-radius:10px"><a href="${WA_LINK}" style="display:inline-block;padding:10px 18px;${F}font-size:14px;font-weight:600;color:${ACCENT};text-decoration:none;border-radius:10px">WhatsApp ons</a></td>
<td style="padding-left:16px;${F}font-size:14px;color:#D6DEEF">of bel <a href="${TEL_LINK}" style="color:#ffffff;font-weight:600;text-decoration:none;white-space:nowrap">${TEL}</a></td>
</tr></table>
</td></tr></table>
</td></tr>` : '';
  return `<!DOCTYPE html>
<html lang="nl" xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
<title>Avezaat &amp; Evers</title>
<style>
@media (max-width:520px){.kaart{padding:30px 22px!important}.buiten{padding:18px 10px 28px!important}h1{font-size:24px!important}}
a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
</style></head>
<body style="margin:0;padding:0;background:${ACHTERGROND};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${ACHTERGROND}" style="background:${ACHTERGROND}"><tr><td class="buiten" align="center" style="padding:36px 16px 44px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px">
<tr><td style="padding:0 6px 22px">
<a href="${base}/" style="${F}font-size:21px;font-weight:700;letter-spacing:-0.3px;color:${INKT};text-decoration:none">Avezaat <span style="color:${ACCENT}">&amp;</span> Evers</a>
</td></tr>
<tr><td class="kaart" bgcolor="#ffffff" style="background:#ffffff;border-radius:18px;padding:40px 38px;border:1px solid ${LIJN}">${inhoud}</td></tr>
${app}
<tr><td style="padding:24px 8px 0;${F}font-size:12.5px;line-height:1.7;color:${ZACHT}">
Avezaat &amp; Evers, jouw vaste boekhouder voor zzp’ers en eenmanszaken<br>
Rotterdamseweg 26, 2921 AP Krimpen aan den IJssel &nbsp;|&nbsp; <a href="mailto:${MAIL}" style="color:${ZACHT}">${MAIL}</a> &nbsp;|&nbsp; <a href="${base}/" style="color:${ZACHT}">avezaatenevers.nl</a>
</td></tr>
</table></td></tr></table></body></html>`;
}

const voet = (wie) => `\n\n${wieVol(wie)}\nAvezaat & Evers\n\nEen vraag tussendoor? App of bel ${TEL}. Binnen 2 uur antwoord.\n${MAIL}`;

// ---------- Prijscheck ----------
const SITUATIE = { start: 'Net gestart', zelf: 'Doet het nu zelf', boekhouder: 'Heeft al een boekhouder', achter: 'Administratie loopt achter' };
const TRANS = { '<50': 'Minder dan 50', '50-150': '50 tot 150', '>150': 'Meer dan 150', '50-100': '50 tot 100', '>100': 'Meer dan 100', '?': 'Weet ik niet' };
const JNW = { ja: 'Ja', nee: 'Nee', '?': 'Weet ik niet', geen: 'Geen fiscaal partner' };

function prijsRegels(d) {
  const r = [['Vast pakket, alles inbegrepen', '€80 p/m']];
  if (d.transacties === '>150') r.push(['Structureel meer dan 150 transacties', '+€15 per 50 extra']);
  r.push(['Btw- en IB-aangifte, app en software', 'inbegrepen']);
  if (d.eu === 'ja') r.push(['ICP-aangifte (klanten in de EU)', '€15 p/m']);
  if (d.eu === '?') r.push(['Klanten in de EU? Zoeken we samen uit', 'evt. €15 p/m']);
  if (d.partner === 'ja') r.push(['Aangifte fiscaal partner', '€150 per jaar']);
  if (d.situatie === 'boekhouder') r.push(['Overstappen, wij regelen de overdracht', '€149 eenmalig']);
  if (d.situatie === 'achter') r.push(['Achterstand inhalen, prijs vooraf afgesproken', '€60 per uur']);
  return r;
}

// ---------- Mails ----------
const mails = {
  // 1. Bevestiging kennismaking (naar bezoeker)
  kennismaking(d, base = '') {
    const inhoud = kop('Leuk dat je kennis wilt maken') +
      p(hoi(d.naam)) +
      p(`Je aanvraag is binnen. ${sterk('Binnen 2 uur')} bellen of appen we je om een moment te prikken. Op werkdagen, en meestal sneller.`) +
      p('Liever zelf meteen een tijd kiezen? Dat kan ook:') +
      knop(`${base}/contact.html#plannen`, 'Kies een moment') +
      tussenkop('Zo gaat de kennismaking') +
      vinkjes([
        '20 minuten, telefonisch of via video. Wat jij het fijnst vindt.',
        'We vragen naar je bedrijf en hoe je administratie nu loopt.',
        'Je hoort precies wat het kost. Vrijblijvend, geen verkooppraatje.',
      ]) +
      p('Tot snel!', 'margin-bottom:22px') +
      groet(base);
    return {
      subject: 'Leuk dat je kennis wilt maken',
      html: omhulsel(base, { preheader: 'Binnen 2 uur bellen of appen we je om een moment te prikken.', inhoud }),
      text: `${hoiTekst(d.naam)}\n\nJe aanvraag is binnen. Binnen 2 uur bellen of appen we je om een moment te prikken.\n\nZelf een tijd kiezen: ${base}/contact.html#plannen\n\nDe kennismaking duurt 20 minuten, telefonisch of via video. Je hoort precies wat het kost. Vrijblijvend.\n\nTot snel!${voet()}`,
    };
  },

  // 2. Uitkomst prijscheck (naar bezoeker)
  prijscheck(d, base = '') {
    const regels = prijsRegels(d);
    const bedrag = esc(d.prijs || (d.transacties === '>150' ? 'vanaf €80 p/m' : '€80 p/m'));
    const inhoud = kop('Dit kost je boekhouding bij ons') +
      p(hoi(d.naam)) +
      p('Je deed net onze prijscheck. Hieronder staat de uitkomst, zodat je hem rustig terug kunt lezen.') +
      blok(`<p style="margin:0 0 2px;${F}font-size:13px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;color:${ACCENT}">Jouw prijs</p>
<p style="margin:0 0 16px;${F}font-size:34px;line-height:1.15;font-weight:700;letter-spacing:-0.6px;color:${INKT}">${bedrag}</p>
${tabel(regels)}
<p style="margin:14px 0 0;${F}font-size:13px;line-height:1.5;color:${ZACHT}">Prijzen excl. btw. Maandelijks opzegbaar. Niet tevreden na de eerste maand? Geld terug.</p>`) +
      (d.situatie === 'boekhouder' ? p(`${sterk('Overstappen per 1 januari?')} Meld je uiterlijk 15 december aan, dan is de overstap gratis. Wij regelen alles met je oude boekhouder.`) : '') +
      p('Klopt dit met jouw situatie? In een kennismaking van 20 minuten lopen we het samen door. Dan weet je het zeker.') +
      knop(`${base}/contact.html#plannen`, 'Plan een gratis kennismaking') +
      groet(base);
    return {
      subject: `Jouw prijs: ${d.prijs || '€80 per maand'}`,
      html: omhulsel(base, { preheader: `Jouw prijs: ${d.prijs || '€80 p/m'}. Alles inbegrepen, maandelijks opzegbaar.`, inhoud }),
      text: `${hoiTekst(d.naam)}\n\nDe uitkomst van je prijscheck: ${d.prijs || '€80 p/m'}\n\n${regels.map((r) => `${r[0]}: ${r[1]}`).join('\n')}\n\nPrijzen excl. btw. Maandelijks opzegbaar.\n\nPlan een gratis kennismaking: ${base}/contact.html#plannen${voet()}`,
    };
  },

  // 3. Melding nieuwe aanvraag (naar jullie)
  intern(d, base = '', formulier = 'kennismaking') {
    const tel = d.telefoon ? `<a href="tel:${esc(String(d.telefoon).replace(/[^\d+]/g, ''))}" style="color:${ACCENT}">${esc(d.telefoon)}</a>` : '-';
    const wa = d.telefoon ? String(d.telefoon).replace(/\D/g, '').replace(/^0/, '31') : '';
    const rijen = [['Naam', esc(d.naam) || '-'], ['E-mail', d.email ? `<a href="mailto:${esc(d.email)}" style="color:${ACCENT}">${esc(d.email)}</a>` : '-'], ['Telefoon', tel]];
    if (formulier === 'prijscheck') {
      rijen.push(['Situatie', esc(SITUATIE[d.situatie] || d.situatie || '-')], ['Branche', esc(d.branche || '-')], ['Transacties p/m', esc(TRANS[d.transacties] || d.transacties || '-')],
        ['Klanten in EU', esc(JNW[d.eu] || d.eu || '-')], ['Fiscaal partner', esc(JNW[d.partner] || d.partner || '-')], ['Berekende prijs', esc(d.prijs || '-')]);
    } else {
      rijen.push(['Situatie', esc(d.situatie || '-')], ['Transacties p/m', esc(d.transacties || '-')]);
    }
    const inhoud = kop(`Nieuwe aanvraag van ${esc(voornaam(d.naam) || 'een bezoeker')}`) +
      p(`Binnen via de ${sterk(formulier === 'prijscheck' ? 'prijscheck' : 'kennismaking')}. We beloven reactie binnen 2 uur, dus de klok loopt.`) +
      blok(tabel(rijen)) +
      (d.bericht ? p(`${sterk('Bericht')}<br>${esc(d.bericht).replace(/\n/g, '<br>')}`) : '') +
      (wa ? knop(`https://wa.me/${wa}`, `App ${esc(voornaam(d.naam) || 'de klant')}`) : '') +
      p(`Staat ook als prospect in ${link(`${base}/intern/klanten.html`, 'Klanten')}.`, `font-size:14px;color:${ZACHT}`);
    return {
      subject: `Nieuwe aanvraag (${formulier}): ${d.naam || 'onbekend'}`,
      html: omhulsel(base, { preheader: `${d.naam || ''}, ${d.telefoon || d.email || ''}`, inhoud, appBlok: false }),
      text: `Nieuwe aanvraag via ${formulier}\n\nNaam: ${d.naam || '-'}\nE-mail: ${d.email || '-'}\nTelefoon: ${d.telefoon || '-'}\nSituatie: ${d.situatie || '-'}\nTransacties: ${d.transacties || '-'}${formulier === 'prijscheck' ? `\nBranche: ${d.branche || '-'}\nEU: ${d.eu || '-'}\nPartner: ${d.partner || '-'}\nPrijs: ${d.prijs || '-'}` : ''}\n\n${d.bericht || ''}`,
    };
  },

  // 4. Herinnering voorstel
  voorstelHerinnering(d, base = '') {
    const akkoord = akkoordLink(d);
    const datum = d.voorstelDatum ? ` van ${esc(d.voorstelDatum)}` : '';
    const inhoud = kop('Heb je ons voorstel nog kunnen bekijken?') +
      p(hoi(d.naam)) +
      p(`Een paar dagen geleden stuurde ik je ons voorstel. Misschien is het erbij ingeschoten, of zit je nog met een vraag. Allebei prima.`) +
      p(`Ben je eruit? Klik dan op de knop hieronder. Dan sturen wij je de opdrachtbevestiging en ${sterk('zetten we alles voor je klaar')}.`) +
      knop(akkoord, 'Ja, ik wil starten') +
      p(`Het voorstel zelf vind je in mijn mail${datum}, met als onderwerp "Je voorstel van Avezaat &amp; Evers".`, `font-size:14px;color:${ZACHT}`) +
      p('Twijfel je nog ergens over? Bel of app me even. Dan lopen we het samen door, zonder verplichtingen.', 'margin-bottom:22px') +
      groet(base, d.wie);
    return {
      subject: 'Heb je ons voorstel nog kunnen bekijken?',
      html: omhulsel(base, { preheader: 'Ben je eruit? Met één klik geef je akkoord en zetten wij alles klaar.', inhoud, wie: d.wie }),
      text: `${hoiTekst(d.naam)}\n\nEen paar dagen geleden stuurde ik je ons voorstel. Ben je eruit? Reageer dan op deze mail, dan sturen wij je de opdrachtbevestiging.\n\nTwijfel je nog? Bel of app me even.${voet(d.wie)}`,
    };
  },

  // 4b. Voorstel (na de kennismaking)
  voorstel(d, base = '') {
    const wie = d.wie === 'daan' ? 'daan' : 'koen';
    const wieKort = wieNaam(wie);
    const pakket = Math.max(0, Number(d.pakket) || 80);
    let maand = pakket, jaar = 0, eenmalig = 0;
    const regels = [['Boekhouding volledig uit handen', `${euro(pakket)} p/m`]];
    if (d.icp) { maand += 15; regels.push(['ICP-aangifte (klanten in de EU)', '€15 p/m']); }
    if (d.partner) { jaar += 150; regels.push(['IB-aangifte fiscaal partner', '€150 per jaar']); }
    if (d.overstap === 'gratis') regels.push(['Overstappen, wij regelen de overdracht', 'gratis']);
    if (d.overstap === 'betaald') { eenmalig += 149; regels.push(['Overstappen, wij regelen de overdracht', '€149 eenmalig']); }
    const uren = Math.max(0, parseInt(d.achterstand, 10) || 0);
    if (uren) { eenmalig += uren * 60; regels.push([`Achterstand inhalen (± ${uren} uur à €60)`, `${euro(uren * 60)} eenmalig`]); }
    const bedrijf = esc(d.bedrijf || '');
    const situatie = esc(d.situatie || '').trim();
    const noot = esc(d.noot || '').trim().replace(/\n/g, '<br>');
    const extraPrijs = [jaar ? `plus ${euro(jaar)} per jaar` : '', eenmalig ? `eenmalig ${euro(eenmalig)}` : ''].filter(Boolean).join(', ');

    const inhoud = kop(`Je voorstel${bedrijf ? ` voor ${bedrijf}` : ''}`) +
      p(hoi(d.naam)) +
      p(`Leuk je gesproken te hebben!${situatie ? ` Je vertelde dat ${situatie}.` : ''} Zoals beloofd zet ik hieronder op een rij wat we voor je gaan doen en wat het kost. Geen kleine lettertjes, en je zit nergens aan vast.`) +
      blok(`<p style="margin:0 0 2px;${F}font-size:13px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;color:${ACCENT}">Jouw vaste prijs</p>
<p style="margin:0 0 4px;${F}font-size:34px;line-height:1.15;font-weight:700;letter-spacing:-0.6px;color:${INKT}">${euro(maand)} <span style="font-size:17px;font-weight:600;letter-spacing:0">per maand</span></p>
<p style="margin:0 0 16px;${F}font-size:14px;line-height:1.5;color:${ZACHT}">excl. btw (${euro(maand * 1.21)} incl. btw)${extraPrijs ? `, ${extraPrijs}` : ''}. Maandelijks opzegbaar.</p>
${tabel(regels)}`) +
      tussenkop('Altijd inbegrepen') +
      vinkjes([
        `Eén vaste boekhouder: ${sterk(wieKort)}, die jouw bedrijf kent`,
        'Je complete boekhouding, tot 150 banktransacties per maand',
        '4 btw-aangiftes per jaar, vooraf met je besproken',
        'Je aangifte inkomstenbelasting en je jaarcijfers',
        'MoneyMonk: software en app om je bonnetjes aan te leveren',
        'Elke maand een 1-op-1 gesprek, en vragen stellen wanneer je wilt',
      ]) +
      tussenkop('Zo starten we') +
      stappen([
        ['Jij geeft akkoord', 'Met de knop hieronder, of gewoon door op deze mail te reageren.'],
        ['Wij sturen de opdrachtbevestiging', 'En we vragen je identiteitsbewijs. Dat zijn we wettelijk verplicht.'],
        ['We zetten alles klaar', `Je MoneyMonk-account, de machtiging voor je aangiftes${d.overstap && d.overstap !== 'nee' ? ' en de overdracht met je oude boekhouder' : ''}.`],
        ['Je eerste 1-op-1', 'In je eerste maand lopen we samen alles door.'],
      ]) +
      knop(akkoordLink(d), 'Ja, ik wil starten') +
      blok(blokTekst(`${sterk('Startdatum:')} ${esc(d.start || 'in overleg')}. ${sterk('Geldig tot:')} ${esc(d.geldig || '')}.<br>Je zegt maandelijks op. Stop je binnen 12 maanden nadat we je aangifte inkomstenbelasting hebben gedaan, dan rekenen we die aangifte apart af (€250).`)) +
      (noot ? p(noot) : '') +
      p(`Nog vragen? Bel of app me gerust. Ik denk graag met je mee.`, 'margin-bottom:22px') +
      groet(base, wie) +
      `<p style="margin:26px 0 0;padding-top:18px;border-top:1px solid ${LIJN};${F}font-size:12.5px;line-height:1.6;color:${ZACHT}">Alle bedragen excl. 21% btw, tenzij anders vermeld. Op onze diensten zijn onze ${link(`${base}/voorwaarden.html`, 'algemene voorwaarden')}, ${link(`${base}/verwerkersovereenkomst.html`, 'verwerkersovereenkomst')} en ${link(`${base}/privacy.html`, 'privacyverklaring')} van toepassing.</p>`;
    const onderwerp = `Je voorstel van Avezaat & Evers${d.bedrijf ? ` voor ${d.bedrijf}` : ''}`;
    return {
      subject: onderwerp,
      html: omhulsel(base, { preheader: `Jouw vaste prijs: ${euro(maand)} per maand, alles inbegrepen. Maandelijks opzegbaar.`, inhoud, wie }),
      text: `${hoiTekst(d.naam)}\n\nLeuk je gesproken te hebben! Hieronder ons voorstel.\n\nJouw vaste prijs: ${euro(maand)} per maand excl. btw${extraPrijs ? `, ${extraPrijs}` : ''}.\n${regels.map((r) => `- ${r[0]}: ${r[1]}`).join('\n')}\n\nVaste boekhouder: ${wieKort}\nStartdatum: ${d.start || 'in overleg'}\nGeldig tot: ${d.geldig || ''}\n\nAkkoord? Reageer op deze mail, dan sturen wij de opdrachtbevestiging.${voet(wie)}`,
    };
  },

  // 5. Welkom
  welkom(d, base = '') {
    // Welkomstpagina persoonlijk maken: zelfde voornaam en vaste boekhouder als in deze mail
    const welkomUrl = `${base}/welkom.html` + (d.wie === 'koen' || d.wie === 'daan' || voornaam(d.naam) ? '?' + [voornaam(d.naam) ? 'naam=' + encodeURIComponent(voornaam(d.naam)) : '', d.wie === 'koen' || d.wie === 'daan' ? 'boekhouder=' + wieNaam(d.wie) : ''].filter(Boolean).join('&') : '');
    const inhoud = kop(`Welkom, ${esc(voornaam(d.naam) || 'fijn dat je er bent')}!`) +
      p(voornaam(d.naam) ? `Fijn dat je voor ons kiest. Vanaf nu ben ik je vaste boekhouder. Je hebt dus altijd hetzelfde aanspreekpunt, dat jouw bedrijf kent.` : 'Fijn dat je voor ons kiest. Vanaf nu heb je één vaste boekhouder, die jouw bedrijf kent.') +
      p('Om te beginnen zijn er maar drie stappen:') +
      stappen([
        ['Activeer je MoneyMonk-account', 'Je krijgt een uitnodiging per mail. Klik op de link en kies een wachtwoord.'],
        ['Download de app en koppel je bank', 'Duurt een kwartiertje. Daarna komen je transacties vanzelf binnen.'],
        ['Fotografeer je eerste bonnetje', 'Dan weet je meteen hoe het werkt. Meer hoef je eigenlijk niet te doen.'],
      ]) +
      knop(welkomUrl, 'Open je welkomstpagina') +
      p(`Liever stap voor stap met plaatjes? Lees ${link(`${base}/kennisbank/starten-met-moneymonk.html`, 'Van start met MoneyMonk')}. Hoe we met je gegevens omgaan, staat in de ${link(`${base}/verwerkersovereenkomst.html`, 'verwerkersovereenkomst')}.`) +
      p('Loop je ergens tegenaan? App me gewoon. Daar ben ik voor.', 'margin-bottom:22px') +
      groet(base, d.wie);
    return {
      subject: 'Welkom! Zo ga je van start',
      html: omhulsel(base, { preheader: 'Drie stappen en je bent klaar: account activeren, bank koppelen, eerste bonnetje.', inhoud, wie: d.wie }),
      text: `${hoiTekst(d.naam)}\n\nFijn dat je voor ons kiest. Vanaf nu ben ik je vaste boekhouder.\n\nOm te beginnen:\n1. Activeer je MoneyMonk-account via de uitnodiging in je mail.\n2. Download de app en koppel je bank.\n3. Fotografeer je eerste bonnetje.\n\nWelkomstpagina: ${welkomUrl}\nHandleiding: ${base}/kennisbank/starten-met-moneymonk.html\n\nLoop je ergens tegenaan? App me gewoon.${voet(d.wie)}`,
    };
  },

  // 6. Check-in na 2 weken
  checkIn(d, base = '') {
    const inhoud = kop('Hoe bevalt de app?') +
      p(hoi(d.naam)) +
      p('Je bent nu twee weken klant. Tijd voor een korte check. Lukt dit allemaal?') +
      vinkjes(['Je bank is gekoppeld en je transacties komen binnen', 'Je fotografeert je bonnetjes in de app', 'Je maakt je facturen in MoneyMonk']) +
      p(`Ergens nee op? Geen probleem, dat hebben de meeste mensen in het begin. ${sterk('App me even')}, dan lopen we het samen door. Tien minuten werk.`) +
      p('Gaat alles goed? Dan hoef je niets te doen. Wij houden de rest in de gaten.', 'margin-bottom:22px') +
      groet(base, d.wie);
    return {
      subject: 'Hoe bevalt de app?',
      html: omhulsel(base, { preheader: 'Twee weken klant. Bank gekoppeld, bonnetjes in de app? Even checken.', inhoud, wie: d.wie }),
      text: `${hoiTekst(d.naam)}\n\nJe bent nu twee weken klant. Is je bank gekoppeld, lukt het met bonnetjes en facturen? Ergens nee op? App me even, dan lopen we het samen door.${voet(d.wie)}`,
    };
  },

  // 7. Kwartaalherinnering btw
  kwartaal(d, base = '') {
    const items = ['Bonnetjes en inkoopfacturen in de app', 'Alle verkoopfacturen verstuurd of geüpload', 'Contant betaald? Maak even een foto van het bonnetje'];
    if (d.icp) items.push('Facturen aan klanten in de EU, voor je ICP-opgaaf');
    const inhoud = kop(`Het ${esc(d.kwartaal)} zit erop`) +
      p(hoi(d.naam)) +
      p('Tijd voor je btw-aangifte. Die doen wij. Jij zorgt alleen dat alles in de app staat:') +
      vinkjes(items) +
      blok(blokTekst(`${sterk(`Graag uiterlijk ${esc(d.aanleverdatum)}.`)} Dan dienen wij je aangifte ruim op tijd in, vóór de deadline van ${esc(d.deadline)}. Lever je later aan, dan rekenen we €50 spoedtoeslag.`)) +
      p('Staat alles er al in? Top, dan hoef je niets te doen.', 'margin-bottom:22px') +
      groet(base, d.wie);
    return {
      subject: `Btw ${d.kwartaal}: lever aan vóór ${d.aanleverdatum}`,
      html: omhulsel(base, { preheader: `Zet je bonnetjes en facturen vóór ${d.aanleverdatum} in de app. De aangifte doen wij.`, inhoud, wie: d.wie }),
      text: `${hoiTekst(d.naam)}\n\nHet ${d.kwartaal} zit erop. Zet je bonnetjes en facturen vóór ${d.aanleverdatum} in de app, dan dienen wij je btw-aangifte op tijd in (deadline ${d.deadline}). Later aanleveren: €50 spoedtoeslag.${voet(d.wie)}`,
    };
  },

  // 8. Tweede kwartaalherinnering (alleen als stukken nog niet binnen zijn)
  kwartaalTweede(d, base = '') {
    const inhoud = kop(`Nog even: je btw-stukken`) +
      p(hoi(d.naam)) +
      p(`Voor je btw-aangifte over het ${esc(d.kwartaal)} missen we nog stukken. Kun je ze deze week in de app zetten? Dan regelen wij de rest.`) +
      blok(blokTekst(`${sterk(`Uiterlijk ${esc(d.aanleverdatum)}.`)} Daarna rekenen we €50 spoedtoeslag, zodat we de aangifte toch op tijd kunnen indienen, vóór ${esc(d.deadline)}.`)) +
      p('Heb je alles net aangeleverd? Dan kruisen onze berichten elkaar. Laat het even weten, dan kijk ik het na.', 'margin-bottom:22px') +
      groet(base, d.wie);
    return {
      subject: `Herinnering: btw-stukken vóór ${d.aanleverdatum}`,
      html: omhulsel(base, { preheader: `We missen nog stukken voor je btw-aangifte. Uiterlijk ${d.aanleverdatum}.`, inhoud, wie: d.wie }),
      text: `${hoiTekst(d.naam)}\n\nVoor je btw-aangifte over het ${d.kwartaal} missen we nog stukken. Uiterlijk ${d.aanleverdatum}; daarna rekenen we €50 spoedtoeslag (deadline ${d.deadline}).${voet(d.wie)}`,
    };
  },

  // 9. Jaareinde
  jaareinde(d, base = '') {
    const inhoud = kop('Nog een paar weken tot 31 december') +
      p(hoi(d.naam)) +
      p('Het jaar is bijna om. Een paar punten kun je nu nog regelen. Na 31 december is het te laat voor dit belastingjaar.') +
      vinkjes([
        `${sterk('Investeringen')}: een bus, gereedschap of laptop die je toch al wilde kopen? Vóór 31 december kan dat belasting schelen.`,
        `${sterk('Urencriterium')}: kom je aan 1.225 uur? Check je urenregistratie in de app.`,
        `${sterk('Onbetaalde facturen')}: klanten die echt niet meer betalen? Laat het ons weten.`,
        `${sterk('KOR')}: volgend jaar in of uit de kleineondernemersregeling? Dat moet begin december geregeld zijn.`,
      ]) +
      knop(`${base}/kennisbank/jaareinde-checklist-zzp.html`, 'Bekijk de jaareinde-checklist') +
      p('Twijfel je ergens over? App me. Dan rekenen we samen uit of het iets oplevert.', 'margin-bottom:22px') +
      groet(base, d.wie);
    return {
      subject: 'Dit regel je nog vóór 31 december',
      html: omhulsel(base, { preheader: 'Investeringen, urencriterium en KOR: nu nog te regelen voor dit jaar.', inhoud, wie: d.wie }),
      text: `${hoiTekst(d.naam)}\n\nVóór 31 december nog te regelen: investeringen, urencriterium (1.225 uur), onbetaalde facturen en de KOR.\n\nChecklist: ${base}/kennisbank/jaareinde-checklist-zzp.html${voet(d.wie)}`,
    };
  },

  // 10. Aangifte inkomstenbelasting
  inkomstenbelasting(d, base = '') {
    const items = ['Jaaropgaven van je bank- en spaarrekeningen', 'Jaaropgave van je hypotheek en de WOZ-waarde van je huis', 'Werkte je ook in loondienst? Dan je jaaropgave'];
    if (d.partner !== false) items.push('Heb je een fiscaal partner? Dan ook die stukken van je partner');
    const inhoud = kop(`Tijd voor je aangifte over ${esc(d.jaar)}`) +
      p(hoi(d.naam)) +
      p(`We gaan aan de slag met je aangifte inkomstenbelasting. Je bedrijfscijfers hebben we al. Voor de rest hebben we nog dit van je nodig:`) +
      vinkjes(items) +
      blok(blokTekst(`${sterk('Mail ze naar')} ${link(`mailto:${MAIL}`, MAIL)}, ${sterk(`graag vóór ${esc(d.aanleverdatum)}`)}. Een foto met je telefoon is ook prima, als alles maar leesbaar is.`)) +
      p('Dan heb je ruim voor 1 mei duidelijkheid over wat je terugkrijgt of moet betalen.', 'margin-bottom:22px') +
      groet(base, d.wie);
    return {
      subject: `Je aangifte over ${d.jaar}: dit hebben we nodig`,
      html: omhulsel(base, { preheader: `Jaaropgaven van bank, hypotheek en loondienst. Graag vóór ${d.aanleverdatum}.`, inhoud, wie: d.wie }),
      text: `${hoiTekst(d.naam)}\n\nVoor je aangifte inkomstenbelasting over ${d.jaar} hebben we nodig:\n- ${items.join('\n- ')}\n\nMail ze naar ${MAIL}, graag vóór ${d.aanleverdatum}.${voet(d.wie)}`,
    };
  },

  // 11. Review vragen
  review(d, base = '') {
    const href = d.reviewLink || `${base}/`;
    const inhoud = kop('Mag ik je iets vragen?') +
      p(hoi(d.naam)) +
      p('Je bent nu drie maanden klant. Ik hoop dat je administratie je minder tijd en kopzorgen kost dan eerst.') +
      p(`Als dat zo is: wil je dat in een paar zinnen op Google zetten? Ondernemers kiezen hun boekhouder vaak op basis van reviews. ${sterk('Voor ons maakt het echt verschil.')}`) +
      knop(href, 'Schrijf een review') +
      p('Kan er juist iets beter? Dan hoor ik het liever direct van je. Dan lossen we het op.', 'margin-bottom:22px') +
      groet(base, d.wie);
    return {
      subject: 'Mag ik je iets vragen?',
      html: omhulsel(base, { preheader: 'Drie maanden klant. Wil je in een paar zinnen een review op Google zetten?', inhoud, wie: d.wie }),
      text: `${hoiTekst(d.naam)}\n\nJe bent nu drie maanden klant. Wil je in een paar zinnen een review op Google zetten? Voor ons maakt het echt verschil.\n\n${href}\n\nKan er iets beter? Laat het me direct weten.${voet(d.wie)}`,
    };
  },

  // 12. Aanbevelen
  aanbevelen(d, base = '') {
    const inhoud = kop('Ken jij iemand die hier ook mee worstelt?') +
      p(hoi(d.naam)) +
      p('Je aangifte inkomstenbelasting is ingediend. Weer een zorg minder.') +
      p('Ken je een collega, vriend of familielid die nog zelf met bonnetjes en aangiftes stoeit? Stuur hem of haar onze kant op.') +
      blok(blokTekst(`${sterk('Allebei een maand gratis.')} Noemt diegene jouw naam bij de kennismaking en wordt het klant? Dan krijgen jullie allebei een maand boekhouding cadeau.`)) +
      knop(`${base}/aanbevelen.html`, 'Stuur de link door') +
      p('Geen tijd of niemand in gedachten? Helemaal prima. Dan hoef je niets te doen.', 'margin-bottom:22px') +
      groet(base, d.wie);
    return {
      subject: 'Je aangifte is ingediend. Nog één ding...',
      html: omhulsel(base, { preheader: 'Ken je iemand? Dan krijgen jullie allebei een maand gratis.', inhoud, wie: d.wie }),
      text: `${hoiTekst(d.naam)}\n\nJe aangifte inkomstenbelasting is ingediend. Ken je iemand die nog zelf met zijn administratie stoeit? Noemt diegene jouw naam en wordt het klant, dan krijgen jullie allebei een maand gratis.\n\n${base}/aanbevelen.html${voet(d.wie)}`,
    };
  },

  // 13. Een jaar klant
  jubileum(d, base = '') {
    const n = Number(d.btwAantal) || 0;
    const items = [];
    if (n) items.push(`${sterk(`${n} btw-aangifte${n === 1 ? '' : 's'}`)} op tijd ingediend`);
    if (d.ib) items.push(`Je ${sterk('aangifte inkomstenbelasting')} geregeld`);
    items.push(`Je bonnetjes en facturen verwerkt, ${sterk('zonder dat jij erover hoefde in te zitten')}`);
    const inhoud = kop('Vandaag precies een jaar') +
      p(hoi(d.naam)) +
      p('Een jaar geleden werd je klant. Even een korte terugblik op wat we samen deden:') +
      vinkjes(items) +
      p('Dank je wel voor het vertrouwen. Heb je wensen voor het komende jaar, of wil je eens rustig door je cijfers lopen? App me, dan plannen we een moment.', 'margin-bottom:22px') +
      groet(base, d.wie);
    return {
      subject: 'Vandaag precies een jaar',
      html: omhulsel(base, { preheader: 'Een korte terugblik op je eerste jaar bij Avezaat & Evers.', inhoud, wie: d.wie }),
      text: `${hoiTekst(d.naam)}\n\nEen jaar geleden werd je klant. Dank je wel voor het vertrouwen. Wil je eens rustig door je cijfers lopen? App me, dan plannen we een moment.${voet(d.wie)}`,
    };
  },
  // 14. NPS: hoe tevreden ben je?
  nps(d, base = '') {
    const basis = d.npsBasis || `${base}/nps?`;
    const cel = (n) => {
      const kleur = n <= 6 ? '#FDECEA' : n <= 8 ? '#FEF3E2' : '#E6F4EA';
      return `<td align="center" style="padding:0 2px"><a href="${basis}&s=${n}" style="display:block;width:38px;line-height:40px;border-radius:10px;background:${kleur};${F}font-size:16px;font-weight:700;color:${INKT};text-decoration:none">${n}</a></td>`;
    };
    const rij = (van, tot) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 6px"><tr>${Array.from({ length: tot - van + 1 }, (_, i) => cel(van + i)).join('')}</tr></table>`;
    const inhoud = kop('Hoe doen we het?') +
      p(hoi(d.naam)) +
      p('Eén korte vraag. Je antwoord helpt ons écht om het voor jou en andere ondernemers beter te maken.') +
      blok(`<p style="margin:0 0 16px;${F}font-size:16px;line-height:1.5;font-weight:600;color:${INKT};text-align:center">Hoe waarschijnlijk is het dat je Avezaat &amp; Evers aanbeveelt aan een andere ondernemer?</p>
${rij(0, 5)}${rij(6, 10)}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:6px"><tr>
<td style="${F}font-size:12.5px;color:${ZACHT}">0 = zeker niet</td><td align="right" style="${F}font-size:12.5px;color:${ZACHT}">10 = zeker wel</td></tr></table>`) +
      p('Klik op een cijfer. Daarna kun je nog kort vertellen waarom, als je wilt. Kost je 20 seconden.', `font-size:14px;color:${ZACHT}`) +
      groet(base, d.wie);
    return {
      subject: 'Eén vraag: hoe doen we het?',
      html: omhulsel(base, { preheader: 'Eén klik op een cijfer van 0 tot 10. Kost je 20 seconden.', inhoud, wie: d.wie }),
      text: `${hoiTekst(d.naam)}\n\nHoe waarschijnlijk is het dat je Avezaat & Evers aanbeveelt aan een andere ondernemer? Kies een cijfer van 0 tot 10:\n\n${Array.from({ length: 11 }, (_, n) => `${n}: ${basis}&s=${n}`).join('\n')}${voet(d.wie)}`,
    };
  },

  // Door de agent ontworpen mail, opgebouwd uit blokken in onze huisstijl (altijd mailveilig)
  ontwerp(d, base = '') {
    const veiligUrl = (u) => (/^(https:\/\/|mailto:|tel:)[^\s"<>]+$/i.test(String(u || '').trim()) ? String(u).trim() : '');
    const opmaak = (t) => esc(t).replace(/\*\*([^*]+)\*\*/g, (m, x) => sterk(x)).replace(/\n/g, '<br>');
    const delen = [], tekstDelen = [];
    if (d.aanhef !== false) { delen.push(p(hoi(d.naam))); tekstDelen.push(hoiTekst(d.naam)); }
    for (const b of (Array.isArray(d.blokken) ? d.blokken : []).slice(0, 30)) {
      const t = String(b.tekst || '').slice(0, 3000), items = (Array.isArray(b.items) ? b.items : []).map((x) => String(x).slice(0, 400)).slice(0, 12);
      if (b.type === 'kop' && t) { delen.push(kop(opmaak(t))); tekstDelen.push(t.toUpperCase()); }
      else if (b.type === 'tussenkop' && t) { delen.push(tussenkop(opmaak(t))); tekstDelen.push(t); }
      else if (b.type === 'alinea' && t) { delen.push(p(opmaak(t))); tekstDelen.push(t); }
      else if (b.type === 'lijst' && items.length) { delen.push(vinkjes(items.map(opmaak))); tekstDelen.push(items.map((x) => '- ' + x).join('\n')); }
      else if (b.type === 'stappen' && items.length) {
        const st = items.map((x) => { const i = x.indexOf(':'); return i > 0 ? [opmaak(x.slice(0, i).trim()), opmaak(x.slice(i + 1).trim())] : [opmaak(x), '']; });
        delen.push(stappen(st)); tekstDelen.push(items.map((x, i) => (i + 1) + '. ' + x).join('\n'));
      }
      else if (b.type === 'blok' && t) { delen.push(blok(blokTekst(opmaak(t)))); tekstDelen.push(t); }
      else if (b.type === 'tabel' && items.length) {
        const rijen = items.map((x) => { const i = x.indexOf(':'); return i > 0 ? [opmaak(x.slice(0, i).trim()), opmaak(x.slice(i + 1).trim())] : [opmaak(x), '']; });
        delen.push(blok(tabel(rijen))); tekstDelen.push(items.join('\n'));
      }
      else if (b.type === 'knop' && b.label && veiligUrl(b.url)) { delen.push(knop(veiligUrl(b.url), esc(String(b.label).slice(0, 60)))); tekstDelen.push(b.label + ': ' + veiligUrl(b.url)); }
    }
    delen.push(groet(base, d.wie));
    return {
      subject: String(d.onderwerp || 'Bericht van Avezaat & Evers').slice(0, 140),
      html: omhulsel(base, { preheader: String(d.preheader || tekstDelen[1] || '').slice(0, 120), inhoud: delen.join(''), wie: d.wie }),
      text: tekstDelen.join('\n\n') + voet(d.wie),
    };
  },

  // Eigen bericht in huisstijl (opgesteld door Koen of Daan, bijvoorbeeld via de agent)
  bericht(d, base = '') {
    const alineas = String(d.tekst || '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
    const inhoud = p(hoi(d.naam)) +
      alineas.map((a, i) => p(esc(a).replace(/\n/g, '<br>'), i === alineas.length - 1 ? 'margin-bottom:22px' : '')).join('') +
      groet(base, d.wie);
    return {
      subject: String(d.onderwerp || 'Bericht van Avezaat & Evers').slice(0, 140),
      html: omhulsel(base, { preheader: String(alineas[0] || '').slice(0, 110), inhoud, wie: d.wie }),
      text: `${hoiTekst(d.naam)}\n\n${alineas.join('\n\n')}${voet(d.wie)}`,
    };
  },

  // Afspraak via Cal.com: bevestiging, verzet en geannuleerd (naar de bezoeker, vanuit netlify/functions/cal-webhook.mjs)
  // d: { naam, wie, wanneer, duur, video, telefoon, verzet, annuleer, reden }
  afspraak(d, base = '') {
    const inhoud = kop('Je kennismaking staat gepland') +
      p(hoi(d.naam)) +
      p(`Fijn dat je een moment hebt gekozen. We spreken elkaar ${sterk(esc(d.wanneer))}.`) +
      afspraakBlok(d) +
      (d.video ? knop(esc(d.video), 'Deelnemen aan het gesprek') +
        p('Bewaar deze mail, dan heb je de link straks bij de hand. De afspraak staat ook in de bijlage, voor in je agenda.', `font-size:14px;color:${ZACHT}`) :
        p('De afspraak staat in de bijlage, voor in je agenda.', `font-size:14px;color:${ZACHT}`)) +
      tussenkop('Zo gaat de kennismaking') +
      vinkjes([
        'We vragen naar je bedrijf en hoe je administratie nu loopt.',
        'Je hoort precies wat het kost. Vrijblijvend, geen verkooppraatje.',
        'Handig om bij de hand te hebben: een idee van hoeveel bonnetjes en facturen je per maand hebt.',
      ]) +
      afspraakWijzigen(d) +
      p('Tot dan!', 'margin-bottom:22px') +
      groet(base, d.wie);
    return {
      subject: `Je kennismaking staat gepland: ${d.wanneer}`,
      html: omhulsel(base, { preheader: `We spreken elkaar ${d.wanneer}.${d.video ? ' De link om deel te nemen staat in deze mail.' : ''}`, inhoud, wie: d.wie }),
      text: `${hoiTekst(d.naam)}\n\nFijn dat je een moment hebt gekozen. We spreken elkaar ${d.wanneer} (${d.duur} minuten) met ${wieVol(d.wie)}.\n\n${d.video ? `Deelnemen aan het gesprek: ${d.video}\n\n` : d.telefoon ? `We bellen je op ${d.telefoon}.\n\n` : ''}Komt het toch niet uit?\nAnder moment kiezen: ${d.verzet}\nAnnuleren: ${d.annuleer}\n\nTot dan!${voet(d.wie)}`,
    };
  },

  afspraakVerzet(d, base = '') {
    const inhoud = kop('Je kennismaking is verzet') +
      p(hoi(d.naam)) +
      p(`Gelukt. Je nieuwe moment is ${sterk(esc(d.wanneer))}.`) +
      afspraakBlok(d) +
      (d.video ? knop(esc(d.video), 'Deelnemen aan het gesprek') : '') +
      p('In de bijlage staat de nieuwe tijd voor in je agenda. Stond de oude afspraak er al in, dan wordt die meestal vanzelf bijgewerkt.', `font-size:14px;color:${ZACHT}`) +
      afspraakWijzigen(d) +
      p('Tot dan!', 'margin-bottom:22px') +
      groet(base, d.wie);
    return {
      subject: `Je kennismaking is verzet naar ${d.wanneer}`,
      html: omhulsel(base, { preheader: `Je nieuwe moment: ${d.wanneer}.`, inhoud, wie: d.wie }),
      text: `${hoiTekst(d.naam)}\n\nJe kennismaking is verzet. Je nieuwe moment is ${d.wanneer} (${d.duur} minuten) met ${wieVol(d.wie)}.\n\n${d.video ? `Deelnemen aan het gesprek: ${d.video}\n\n` : ''}Ander moment kiezen: ${d.verzet}\nAnnuleren: ${d.annuleer}\n\nTot dan!${voet(d.wie)}`,
    };
  },

  afspraakGeannuleerd(d, base = '') {
    const inhoud = kop('Je kennismaking is geannuleerd') +
      p(hoi(d.naam)) +
      p(`Je afspraak van ${sterk(esc(d.wanneer))} gaat niet door. Je hoeft verder niets te doen.`) +
      (d.reden ? blok(blokTekst(`${sterk('Reden')}<br>${esc(d.reden)}`)) : '') +
      p('Wil je toch kennismaken? Kies gerust een nieuw moment. Of app of bel ons, dan prikken we samen een tijd.') +
      knop(`${base}/contact#plannen`, 'Kies een nieuw moment') +
      groet(base, d.wie);
    return {
      subject: 'Je kennismaking is geannuleerd',
      html: omhulsel(base, { preheader: `Je afspraak van ${d.wanneer} gaat niet door. Een nieuw moment kiezen kan altijd.`, inhoud, wie: d.wie }),
      text: `${hoiTekst(d.naam)}\n\nJe afspraak van ${d.wanneer} gaat niet door.${d.reden ? `\nReden: ${d.reden}` : ''}\n\nWil je toch kennismaken? Kies een nieuw moment: ${base}/contact#plannen${voet(d.wie)}`,
    };
  },

};

function afspraakBlok(d) {
  return blok(tabel([
    ['Wanneer', esc(d.wanneer)],
    ['Duur', `${esc(d.duur)} minuten`],
    ['Met', wieVol(d.wie)],
    ['Hoe', d.video ? 'Videogesprek' : d.telefoon ? `We bellen je op ${esc(d.telefoon)}` : 'Online'],
  ]));
}
function afspraakWijzigen(d) {
  return p(`Komt het toch niet uit? ${link(esc(d.verzet), 'Kies een ander moment')} of ${link(esc(d.annuleer), 'annuleer de afspraak')}.`);
}

export { mails, voornaam };
