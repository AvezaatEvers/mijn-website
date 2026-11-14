// Mailsjablonen Avezaat & Evers.
// Elke functie geeft { subject, html, text } terug.
// Gebruikt door de Netlify Functions (verzenden via Resend) en door
// scripts/build-mail-previews.js (voorbeeldpagina's in /intern/mails/).

const KLEUR = '#26458F';
const TINT = '#EEF2F8';
const INKT = '#111827';
const GRIJS = '#4B5563';
const RAND = '#E5E7EB';
const TEL = '085 060 4363';
const TEL_LINK = 'tel:+31850604363';
const WA_LINK = 'https://wa.me/31850604363';
const MAIL = 'info@avezaatenevers.nl';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const voornaam = (naam) => {
  const v = String(naam || '').trim().split(/\s+/)[0] || '';
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : '';
};
const aanhef = (naam) => (voornaam(naam) ? `Hoi ${esc(voornaam(naam))},` : 'Hoi,');

const font = "font-family:Poppins,'Segoe UI',Helvetica,Arial,sans-serif;";

const p = (t) => `<p style="margin:0 0 16px;${font}font-size:16px;line-height:1.6;color:${GRIJS}">${t}</p>`;
const h1 = (t) => `<h1 style="margin:0 0 20px;${font}font-size:26px;line-height:1.25;font-weight:700;color:${INKT}">${t}</h1>`;
const knop = (href, label) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px"><tr>
<td style="border-radius:10px;background:${KLEUR}">
<a href="${href}" style="display:inline-block;padding:14px 26px;${font}font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px">${label}</a>
</td></tr></table>`;
const lijst = (items) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px">
${items.map((t) => `<tr><td width="28" valign="top" style="padding:3px 0 9px;${font}font-size:16px;line-height:1.5;color:${KLEUR};font-weight:700">&#10003;</td><td style="padding:3px 0 9px;${font}font-size:16px;line-height:1.5;color:${GRIJS}">${t}</td></tr>`).join('')}
</table>`;
const kader = (inhoud) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 24px;background:${TINT};border-radius:12px"><tr><td style="padding:20px 22px">${inhoud}</td></tr></table>`;
const tabel = (rijen) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
${rijen.map(([l, r], i) => `<tr><td style="padding:9px 0;${i ? `border-top:1px solid ${RAND};` : ''}${font}font-size:15px;line-height:1.45;color:${GRIJS}">${l}</td><td align="right" valign="top" style="padding:9px 0 9px 16px;${i ? `border-top:1px solid ${RAND};` : ''}${font}font-size:15px;line-height:1.45;color:${INKT};font-weight:600;${String(r).replace(/<[^>]+>/g, '').length > 18 ? 'word-break:break-word' : 'white-space:nowrap'}">${r}</td></tr>`).join('')}
</table>`;

function ondertekening(base, wie) {
  const naam = wie === 'koen' ? 'Koen' : wie === 'daan' ? 'Daan' : 'Koen en Daan';
  const fotos = (wie === 'daan' ? ['daan'] : wie === 'koen' ? ['koen'] : ['koen', 'daan'])
    .map((n, i) => `<img src="${base}/assets/img/mail/${n}.jpg" width="48" height="48" alt="" style="display:inline-block;width:48px;height:48px;border-radius:50%;border:2px solid #ffffff;${i ? 'margin-left:-12px;' : ''}vertical-align:middle">`).join('');
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0"><tr>
<td valign="middle" style="padding-right:14px;white-space:nowrap">${fotos}</td>
<td valign="middle" style="${font}font-size:15px;line-height:1.45;color:${GRIJS}">Groet,<br><strong style="color:${INKT}">${naam}</strong><br>Avezaat &amp; Evers</td>
</tr></table>`;
}

function omhulsel(base, { preheader, inhoud }) {
  return `<!DOCTYPE html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
<title>Avezaat &amp; Evers</title>
<style>@media (max-width:480px){.kaart{padding:28px 20px!important}.buiten{padding:20px 10px!important}}</style></head>
<body style="margin:0;padding:0;background:${TINT}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${TINT}"><tr><td class="buiten" align="center" style="padding:32px 16px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px">
<tr><td style="padding:0 4px 20px;${font}font-size:22px;font-weight:700;color:${INKT};letter-spacing:-0.3px">
<a href="${base}/" style="color:${INKT};text-decoration:none">Avezaat <span style="color:${KLEUR}">&amp;</span> Evers</a></td></tr>
<tr><td class="kaart" style="background:#ffffff;border-radius:16px;padding:36px 32px">${inhoud}</td></tr>
<tr><td style="padding:22px 8px 0;${font}font-size:13px;line-height:1.6;color:#6B7280">
Bellen of appen: <a href="${TEL_LINK}" style="color:#6B7280">${TEL}</a> &nbsp;|&nbsp; <a href="mailto:${MAIL}" style="color:#6B7280">${MAIL}</a><br>
Avezaat &amp; Evers VOF, Rotterdamseweg 26, 2921 AP Krimpen aan den IJssel
</td></tr>
</table></td></tr></table></body></html>`;
}

const tekstVoet = `\n\nBellen of appen: ${TEL}\n${MAIL}\nAvezaat & Evers VOF, Rotterdamseweg 26, 2921 AP Krimpen aan den IJssel`;

// Labels prijscheck
const SITUATIE = { start: 'Net gestart', zelf: 'Doet het nu zelf', boekhouder: 'Heeft al een boekhouder', achter: 'Administratie loopt achter' };
const TRANS = { '<50': 'Minder dan 50', '50-100': '50 tot 100', '>100': 'Meer dan 100', '?': 'Weet ik niet' };
const JNW = { ja: 'Ja', nee: 'Nee', '?': 'Weet ik niet', geen: 'Geen fiscaal partner' };

function prijsRegels(d) {
  const r = [['Vast pakket, alles inbegrepen', '€80 p/m'], ['Uren- en rittenregistratie in de app', 'inbegrepen']];
  if (d.transacties === '>100') r[0] = ['Vast pakket, bij meer dan 100 transacties', 'prijs op maat'];
  if (d.eu === 'ja') r.push(['ICP-aangifte (klanten in de EU)', '€15 p/m']);
  if (d.eu === '?') r.push(['Klanten in de EU? Dat zoeken we samen uit', 'eventueel €15 p/m']);
  if (d.partner === 'ja') r.push(['Aangifte fiscaal partner', '€150 per jaar']);
  if (d.situatie === 'boekhouder') r.push(['Overstappen, wij regelen de overdracht', '€149 eenmalig']);
  if (d.situatie === 'achter') r.push(['Achterstand inhalen, met vooraf een prijsafspraak', '€60 per uur']);
  if (d.transacties === '?') r.push(['Aantal transacties checken we samen', 'tot 100 inbegrepen']);
  return r;
}

const mails = {
  // 1. Bevestiging kennismakingsformulier (naar bezoeker)
  kennismaking(d, base = '') {
    const inhoud = h1('Bedankt, we nemen snel contact op') +
      p(aanhef(d.naam)) +
      p('Leuk dat je kennis wilt maken. Je aanvraag is binnen. Binnen 2 uur (op werkdagen) bellen of appen we je om een moment te plannen.') +
      p('Liever meteen zelf een tijd kiezen? Dat kan ook:') +
      knop(`${base}/contact.html#plannen`, 'Kies een moment') +
      kader(`<p style="margin:0 0 6px;${font}font-size:15px;font-weight:600;color:${INKT}">Zo gaat de kennismaking</p>
<p style="margin:0;${font}font-size:15px;line-height:1.6;color:${GRIJS}">20 minuten, telefonisch of via video. We vragen naar je bedrijf en je administratie, en je hoort precies wat het kost. Vrijblijvend.</p>`) +
      p(`Vraag tussendoor? App ons op <a href="${WA_LINK}" style="color:${KLEUR};white-space:nowrap">${TEL}</a>.`) +
      ondertekening(base);
    return {
      subject: 'We hebben je aanvraag ontvangen',
      html: omhulsel(base, { preheader: 'Binnen 2 uur nemen we contact met je op.', inhoud }),
      text: `${aanhef(d.naam)}\n\nLeuk dat je kennis wilt maken. Je aanvraag is binnen. Binnen 2 uur (op werkdagen) bellen of appen we je om een moment te plannen.\n\nZelf een moment kiezen: ${base}/contact.html#plannen\n\nDe kennismaking duurt 20 minuten, telefonisch of via video, en is vrijblijvend.\n\nGroet,\nKoen en Daan${tekstVoet}`,
    };
  },

  // 2. Prijscheck-resultaat (naar bezoeker)
  prijscheck(d, base = '') {
    const regels = prijsRegels(d);
    const opMaat = d.transacties === '>100';
    const bedrag = esc(d.prijs || (opMaat ? 'op maat vanaf €80 p/m' : '€80 p/m'));
    const inhoud = h1('Je prijs bij Avezaat &amp; Evers') +
      p(aanhef(d.naam)) +
      p('Hier is de uitkomst van je prijscheck, zodat je hem rustig terug kunt lezen.') +
      kader(`<p style="margin:0 0 2px;${font}font-size:14px;color:${GRIJS}">Jouw prijs</p>
<p style="margin:0 0 14px;${font}font-size:30px;line-height:1.2;font-weight:700;color:${KLEUR}">${bedrag}</p>
${tabel(regels)}
<p style="margin:12px 0 0;${font}font-size:13px;color:${GRIJS}">Prijzen excl. btw. Maandelijks opzegbaar.</p>`) +
      (d.situatie === 'boekhouder' ? p('<strong style="color:' + INKT + '">Overstappen per 1 januari?</strong> Meld je aan vóór 15 december, dan is de overstap gratis.') : '') +
      p('In een kennismaking van 20 minuten lopen we je situatie door en hoor je of dit klopt. Vrijblijvend.') +
      knop(`${base}/contact.html#plannen`, 'Plan een kennismaking') +
      ondertekening(base);
    return {
      subject: 'Je prijscheck: zo ziet je prijs eruit',
      html: omhulsel(base, { preheader: `Jouw prijs: ${d.prijs || '€80 p/m'}. Rustig terug te lezen.`, inhoud }),
      text: `${aanhef(d.naam)}\n\nDe uitkomst van je prijscheck: ${d.prijs || '€80 p/m'}\n\n${regels.map((r) => `${r[0]}: ${r[1]}`).join('\n')}\n\nPrijzen excl. btw. Maandelijks opzegbaar.\n\nPlan een kennismaking: ${base}/contact.html#plannen\n\nGroet,\nKoen en Daan${tekstVoet}`,
    };
  },

  // 3. Interne melding nieuwe aanvraag (naar MAIL_TO)
  intern(d, base = '', formulier = 'kennismaking') {
    const tel = d.telefoon ? `<a href="tel:${esc(String(d.telefoon).replace(/[^\d+]/g, ''))}" style="color:${KLEUR}">${esc(d.telefoon)}</a>` : 'niet ingevuld';
    const wa = d.telefoon ? String(d.telefoon).replace(/\D/g, '').replace(/^0/, '31') : '';
    const rijen = [['Naam', esc(d.naam)], ['E-mail', `<a href="mailto:${esc(d.email)}" style="color:${KLEUR}">${esc(d.email)}</a>`], ['Telefoon', tel]];
    if (formulier === 'prijscheck') {
      rijen.push(['Situatie', esc(SITUATIE[d.situatie] || d.situatie || '')], ['Branche', esc(d.branche)], ['Transacties p/m', esc(TRANS[d.transacties] || d.transacties || '')],
        ['Klanten in EU', esc(JNW[d.eu] || d.eu || '')], ['Fiscaal partner', esc(JNW[d.partner] || d.partner || '')], ['Berekende prijs', esc(d.prijs)]);
    } else {
      rijen.push(['Situatie', esc(d.situatie)], ['Transacties p/m', esc(d.transacties)]);
    }
    const inhoud = h1(`Nieuwe aanvraag: ${esc(d.naam)}`) +
      p(`Via het formulier <strong style="color:${INKT}">${formulier === 'prijscheck' ? 'prijscheck' : 'kennismaking'}</strong>. Reageer binnen 2 uur, dat beloven we op de site.`) +
      kader(tabel(rijen.map(([l, r]) => [l, r || '-']))) +
      (d.bericht ? p(`<strong style="color:${INKT}">Bericht</strong><br>${esc(d.bericht).replace(/\n/g, '<br>')}`) : '') +
      (wa ? knop(`https://wa.me/${wa}`, 'Stuur een WhatsApp') : '');
    return {
      subject: `Nieuwe aanvraag (${formulier}): ${d.naam || 'onbekend'}`,
      html: omhulsel(base, { preheader: `${d.naam || ''} ${d.telefoon || ''}`, inhoud }),
      text: `Nieuwe aanvraag via ${formulier}\n\nNaam: ${d.naam}\nE-mail: ${d.email}\nTelefoon: ${d.telefoon || '-'}\nSituatie: ${d.situatie || '-'}\nTransacties: ${d.transacties || '-'}${formulier === 'prijscheck' ? `\nBranche: ${d.branche || '-'}\nEU: ${d.eu || '-'}\nPartner: ${d.partner || '-'}\nPrijs: ${d.prijs || '-'}` : ''}\n\n${d.bericht || ''}`,
    };
  },

  // 4. Herinnering voorstel (2 dagen na versturen, nog niet getekend)
  voorstelHerinnering(d, base = '') {
    const inhoud = h1('Nog vragen over het voorstel?') +
      p(aanhef(d.naam)) +
      p('Twee dagen geleden stuurden we je ons voorstel. Misschien is het erbij ingeschoten, of heb je nog een vraag. Beide prima.') +
      p('Akkoord? Dan teken je het voorstel online, in een minuut:') +
      knop(d.link || `${base}/voorstel.html`, 'Bekijk het voorstel') +
      p(`Liever eerst even overleggen? Bel of app ${d.wie === 'daan' ? 'Daan' : d.wie === 'koen' ? 'Koen' : 'ons'} op <a href="${WA_LINK}" style="color:${KLEUR};white-space:nowrap">${TEL}</a>.`) +
      ondertekening(base, d.wie);
    return {
      subject: 'Nog vragen over het voorstel?',
      html: omhulsel(base, { preheader: 'Akkoord? Dan teken je het voorstel online in een minuut.', inhoud }),
      text: `${aanhef(d.naam)}\n\nTwee dagen geleden stuurden we je ons voorstel. Nog een vraag? Bel of app ${TEL}.\n\nBekijk het voorstel: ${d.link || base + '/voorstel.html'}\n\nGroet,\n${d.wie === 'daan' ? 'Daan' : d.wie === 'koen' ? 'Koen' : 'Koen en Daan'}${tekstVoet}`,
    };
  },

  // 5. Welkom (na tekenen)
  welkom(d, base = '') {
    const inhoud = h1('Welkom bij Avezaat &amp; Evers') +
      p(aanhef(d.naam)) +
      p(`Fijn dat je voor ons kiest. Vanaf nu is ${d.wie === 'daan' ? 'Daan' : 'Koen'} je vaste boekhouder. Dit zijn de eerste stappen:`) +
      lijst([
        'Activeer je MoneyMonk-account via de uitnodiging in je mail.',
        'Download de app en koppel je bank. Duurt 20 minuten.',
        'Maak een foto van je eerste bonnetje. Dan weet je meteen hoe het werkt.',
      ]) +
      knop(`${base}/welkom.html`, 'Open je welkomstpagina') +
      p(`Liever stap voor stap? Lees de <a href="${base}/kennisbank/starten-met-moneymonk.html" style="color:${KLEUR}">handleiding Van start met MoneyMonk</a>. Onze afspraken over je gegevens staan in de <a href="${base}/verwerkersovereenkomst.html" style="color:${KLEUR}">verwerkersovereenkomst</a>.`) +
      p(`Loop je ergens tegenaan? App gerust op <a href="${WA_LINK}" style="color:${KLEUR};white-space:nowrap">${TEL}</a>.`) +
      ondertekening(base, d.wie);
    return {
      subject: 'Welkom! Zo ga je van start',
      html: omhulsel(base, { preheader: 'In 3 stappen klaar: account activeren, bank koppelen, eerste bonnetje.', inhoud }),
      text: `${aanhef(d.naam)}\n\nFijn dat je voor ons kiest. De eerste stappen:\n1. Activeer je MoneyMonk-account via de uitnodiging in je mail.\n2. Download de app en koppel je bank.\n3. Maak een foto van je eerste bonnetje.\n\nWelkomstpagina: ${base}/welkom.html\nHandleiding: ${base}/kennisbank/starten-met-moneymonk.html\n\nGroet,\n${d.wie === 'daan' ? 'Daan' : 'Koen'}${tekstVoet}`,
    };
  },

  // 6. Check-in na 2 weken
  checkIn(d, base = '') {
    const inhoud = h1('Hoe gaat het met de app?') +
      p(aanhef(d.naam)) +
      p('Je bent nu twee weken klant. Even checken of alles goed loopt:') +
      lijst(['Is je bank gekoppeld?', 'Lukt het om bonnetjes te fotograferen?', 'Kun je facturen maken in de app?']) +
      p(`Ergens nee op? Geen probleem. Stuur een appje naar <a href="${WA_LINK}" style="color:${KLEUR};white-space:nowrap">${TEL}</a>, dan lopen we het samen door. Tien minuten werk.`) +
      p('Gaat alles goed? Dan hoef je niets te doen.') +
      ondertekening(base, d.wie);
    return {
      subject: 'Hoe gaat het met de app?',
      html: omhulsel(base, { preheader: 'Bank gekoppeld, bonnetjes in de app? Even checken.', inhoud }),
      text: `${aanhef(d.naam)}\n\nJe bent nu twee weken klant. Is je bank gekoppeld, lukt het met bonnetjes en facturen? Ergens nee op? App ons op ${TEL}.\n\nGroet,\n${d.wie === 'daan' ? 'Daan' : 'Koen'}${tekstVoet}`,
    };
  },

  // 7. Kwartaalherinnering stukken aanleveren
  kwartaal(d, base = '') {
    const inhoud = h1(`Lever je stukken aan vóór ${esc(d.aanleverdatum)}`) +
      p(aanhef(d.naam)) +
      p(`Het ${esc(d.kwartaal)} zit erop. Wij doen je btw-aangifte, jij levert alleen de laatste stukken aan.`) +
      lijst(['Bonnetjes en inkoopfacturen in de app', 'Alle verkoopfacturen verstuurd of geüpload', 'Contante uitgaven? Even een foto van het bonnetje']) +
      kader(`<p style="margin:0;${font}font-size:15px;line-height:1.6;color:${GRIJS}"><strong style="color:${INKT}">Uiterlijk ${esc(d.aanleverdatum)}</strong>, dan dienen wij de aangifte op tijd in (deadline ${esc(d.deadline)}). Later aanleveren kan, maar dan rekenen we €50 spoedtoeslag.</p>`) +
      p('Alles al in de app? Dan hoef je niets te doen.') +
      ondertekening(base, d.wie);
    return {
      subject: `Btw ${d.kwartaal}: lever aan vóór ${d.aanleverdatum}`,
      html: omhulsel(base, { preheader: `Bonnetjes en facturen in de app vóór ${d.aanleverdatum}.`, inhoud }),
      text: `${aanhef(d.naam)}\n\nHet ${d.kwartaal} zit erop. Lever je bonnetjes en facturen aan vóór ${d.aanleverdatum}, dan dienen wij de btw-aangifte op tijd in (deadline ${d.deadline}). Later aanleveren: €50 spoedtoeslag.\n\nGroet,\n${d.wie === 'daan' ? 'Daan' : 'Koen'}${tekstVoet}`,
    };
  },

  // 8. Jaareinde (begin december)
  jaareinde(d, base = '') {
    const inhoud = h1('Nog een paar weken tot 31 december') +
      p(aanhef(d.naam)) +
      p('Deze punten regel je vóór de jaarwisseling, anders ben je te laat voor dit belastingjaar:') +
      lijst(['Investeringen die je toch al van plan was? Vóór 31 december kan het schelen.', 'Haal je het urencriterium van 1.225 uur? Check je urenregistratie.', 'Facturen die niet meer betaald worden: laat het ons weten.', 'Overweeg je de KOR voor volgend jaar? Aanmelden kan tot begin december.']) +
      knop(`${base}/kennisbank/jaareinde-checklist-zzp.html`, 'Bekijk de jaareinde-checklist') +
      p('Twijfel je ergens over? App ons, dan kijken we samen of het voor jou iets oplevert.') +
      ondertekening(base, d.wie);
    return {
      subject: 'Jaareinde: dit regel je vóór 31 december',
      html: omhulsel(base, { preheader: 'Investeringen, urencriterium en KOR: check het vóór 31 december.', inhoud }),
      text: `${aanhef(d.naam)}\n\nVóór 31 december: investeringen, urencriterium (1.225 uur), oninbare facturen en de KOR.\n\nChecklist: ${base}/kennisbank/jaareinde-checklist-zzp.html\n\nGroet,\n${d.wie === 'daan' ? 'Daan' : 'Koen'}${tekstVoet}`,
    };
  },

  // 9. Inkomstenbelasting (maart)
  inkomstenbelasting(d, base = '') {
    const inhoud = h1(`Aangifte ${esc(d.jaar)}: dit hebben we van je nodig`) +
      p(aanhef(d.naam)) +
      p(`We gaan aan de slag met je aangifte inkomstenbelasting over ${esc(d.jaar)}. Je bedrijfscijfers hebben we al. Voor de rest hebben we deze stukken nodig:`) +
      lijst(['Jaaropgaven van je bankrekeningen en spaarrekeningen', 'Jaaropgave van je hypotheek en de WOZ-waarde van je huis', 'Loonstroken of jaaropgaven als je ook in loondienst werkte', 'Gegevens van je fiscaal partner, als wij die aangifte ook doen']) +
      kader(`<p style="margin:0;${font}font-size:15px;line-height:1.6;color:${GRIJS}">Mail ze naar <a href="mailto:${MAIL}" style="color:${KLEUR}">${MAIL}</a>. <strong style="color:${INKT}">Graag vóór ${esc(d.aanleverdatum)}</strong>, dan heb je ruim voor 1 mei duidelijkheid.</p>`) +
      ondertekening(base, d.wie);
    return {
      subject: `Aangifte inkomstenbelasting ${d.jaar}: lever aan vóór ${d.aanleverdatum}`,
      html: omhulsel(base, { preheader: 'Jaaropgaven van bank, hypotheek en eventueel loondienst.', inhoud }),
      text: `${aanhef(d.naam)}\n\nVoor je aangifte inkomstenbelasting over ${d.jaar} hebben we nodig: jaaropgaven bank en sparen, hypotheek en WOZ, loondienst, en gegevens van je fiscaal partner. Mail ze naar ${MAIL}, graag vóór ${d.aanleverdatum}.\n\nGroet,\n${d.wie === 'daan' ? 'Daan' : 'Koen'}${tekstVoet}`,
    };
  },
};

export { mails, voornaam };
