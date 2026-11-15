// App-schil interne omgeving: zijbalk, opdrachtbalk (Ctrl/Cmd+K), contact vastleggen, meldingen.
(function () {
  var I = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    leads: '<path d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 2 1 3 3 3 5"/>',
    klanten: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    kwartaal: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18M8 15l2 2 4-4"/>',
    inzicht: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    voorstel: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 14h6M9 18h4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    tools: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
    zoek: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    site: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'
  };
  function svg(n) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[n] + '</svg>'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var pad = location.pathname.replace(/index\.html$/, '');
  var NAV = [
    ['Werk', [['/intern/', 'Vandaag', 'home'], ['/intern/klanten.html', 'Klanten en leads', 'klanten', 'tel-leads'], ['/intern/kwartaal.html', 'Kwartaalbord', 'kwartaal'], ['/intern/inzichten.html', 'Contact en NPS', 'inzicht']]],
    ['Maken', [['/voorstel.html', 'Voorstel', 'voorstel'], ['/intern/mails/', 'Mailsjablonen', 'mail'], ['/intern/tools.html', 'Presenteren en tools', 'tools']]]
  ];

  document.body.classList.add('app');
  var zij = document.createElement('aside'); zij.className = 'zij'; zij.setAttribute('aria-label', 'Navigatie');
  zij.innerHTML = '<a class="zij-logo" href="/intern/"><b>A&amp;E</b><span>Avezaat <span>&amp;</span> Evers</span></a>' +
    '<button class="zij-zoek" type="button" data-ob>' + svg('zoek') + '<span>Zoek of doe iets…</span><kbd>' + (/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K') + '</kbd></button>' +
    '<button class="ai-knop" type="button" data-contact style="justify-content:center;margin-bottom:6px">' + svg('plus') + 'Contact vastleggen</button>' +
    NAV.map(function (g) {
      return '<div class="zij-groep">' + g[0] + '</div>' + g[1].map(function (n) {
        var aan = pad === n[0] || (n[0] === '/intern/klanten.html' && /\/intern\/klant\.html/.test(pad)) || (n[0] === '/intern/' && /overzicht/.test(pad));
        return '<a class="zn' + (aan ? ' is-aan' : '') + '" href="' + n[0] + '"' + (aan ? ' aria-current="page"' : '') + '>' + svg(n[2]) + '<span>' + n[1] + '</span>' + (n[3] ? '<span class="tel" id="' + n[3] + '" hidden></span>' : '') + '</a>';
      }).join('');
    }).join('') +
    '<div class="zij-groep">Snel</div><a class="zn" href="/" target="_blank" rel="noopener">' + svg('site') + '<span>Website</span></a>' +
    '<div class="zij-voet"><img id="zij-foto" src="/assets/img/mail/koen.jpg" alt="" width="36" height="36"><div><strong id="zij-naam">Ingelogd</strong><a href="/intern/logout">Uitloggen</a></div></div>';
  document.body.insertBefore(zij, document.body.firstChild);

  var mob = document.createElement('div'); mob.className = 'mob-balk';
  mob.innerHTML = '<button type="button" id="mob-menu" aria-label="Menu">' + svg('menu').replace('<svg', '<svg width="20" height="20"') + '</button><strong>Avezaat <span>&amp;</span> Evers</strong><div class="rechts"><button type="button" data-ob aria-label="Zoeken">' + svg('zoek').replace('<svg', '<svg width="18" height="18"') + '</button></div>';
  document.body.insertBefore(mob, document.body.firstChild);
  document.getElementById('mob-menu').addEventListener('click', function () { document.body.classList.toggle('zij-open'); });
  document.addEventListener('click', function (e) { if (document.body.classList.contains('zij-open') && !e.target.closest('.zij') && !e.target.closest('#mob-menu')) document.body.classList.remove('zij-open'); });
  var fab = document.createElement('button'); fab.className = 'fab'; fab.type = 'button'; fab.setAttribute('data-contact', ''); fab.setAttribute('aria-label', 'Contact vastleggen'); fab.innerHTML = svg('plus');
  document.body.appendChild(fab);

  // ---------- API ----------
  function api(url, opt) {
    return fetch(url, Object.assign({ credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }, opt || {}))
      .then(function (r) { if (r.status === 401) { location.reload(); throw new Error('uitgelogd'); } return r.json().then(function (j) { if (!r.ok) throw new Error(j.fout || 'Er ging iets mis'); return j; }); });
  }
  var IK = null, KLANTEN = null;
  var ikBelofte = api('/intern/api/ik').then(function (r) {
    IK = r;
    document.getElementById('zij-naam').textContent = r.naam;
    document.getElementById('zij-foto').src = '/assets/img/mail/' + r.wie + '.jpg';
    return r;
  });
  function laadKlanten() { if (!KLANTEN) KLANTEN = api('/intern/api/zoek'); return KLANTEN; }
  laadKlanten().then(function (lijst) {
    var n = lijst.filter(function (k) { return k.status === 'prospect'; }).length, t = document.getElementById('tel-leads');
    if (t && n) { t.hidden = false; t.textContent = n; }
  }).catch(function () {});

  // ---------- Melding ----------
  var toast = document.createElement('div'); toast.className = 'toast'; toast.setAttribute('role', 'status'); document.body.appendChild(toast);
  var tt;
  function meld(tekst) { toast.innerHTML = '<i>✓</i>' + esc(tekst); toast.classList.add('zicht'); clearTimeout(tt); tt = setTimeout(function () { toast.classList.remove('zicht'); }, 2800); }

  // ---------- Opdrachtbalk ----------
  var ob = document.createElement('div'); ob.className = 'ob'; ob.setAttribute('role', 'dialog'); ob.setAttribute('aria-modal', 'true'); ob.setAttribute('aria-label', 'Zoeken');
  ob.innerHTML = '<div class="ob-doos"><div class="ob-invoer">' + svg('zoek') + '<input id="ob-in" type="text" placeholder="Zoek een klant, lead of actie…" autocomplete="off" aria-label="Zoeken"></div><div class="ob-lijst" id="ob-lijst"></div>' +
    '<div class="ob-voet"><span><kbd>↑↓</kbd>kiezen</span><span><kbd>↵</kbd>openen</span><span><kbd>esc</kbd>sluiten</span></div></div>';
  document.body.appendChild(ob);
  var ACTIES = [
    { t: 'Contact vastleggen', s: 'Actie', doe: function () { openContact(); } },
    { t: 'Nieuwe klant of lead toevoegen', s: 'Actie', url: '/intern/klanten.html#nieuw' },
    { t: 'Voorstel maken', s: 'Actie', url: '/voorstel.html' },
    { t: 'Nieuwe taak', s: 'Actie', url: '/intern/#taken' },
    { t: 'Kennismaking presenteren', s: 'Tool', url: '/intern/kennismaking.html' },
    { t: 'Maandgesprek voorbereiden', s: 'Tool', url: '/intern/maandgesprek.html?voorbereiden=1' },
    { t: 'IB-werkblad', s: 'Tool', url: '/intern/ib-werkblad.html' },
    { t: 'Vandaag', s: 'Pagina', url: '/intern/' }, { t: 'Klanten en leads', s: 'Pagina', url: '/intern/klanten.html' },
    { t: 'Kwartaalbord', s: 'Pagina', url: '/intern/kwartaal.html' }, { t: 'Contact en NPS', s: 'Pagina', url: '/intern/inzichten.html' },
    { t: 'Mailsjablonen', s: 'Pagina', url: '/intern/mails/' }, { t: 'Presenteren en tools', s: 'Pagina', url: '/intern/tools.html' }
  ];
  var obItems = [], obIdx = 0;
  function score(tekst, q) {
    tekst = tekst.toLowerCase(); if (!q) return 1;
    if (tekst.indexOf(q) === 0) return 3; if (tekst.indexOf(' ' + q) > -1) return 2.5; if (tekst.indexOf(q) > -1) return 2;
    var i = 0; for (var j = 0; j < tekst.length && i < q.length; j++) if (tekst[j] === q[i]) i++; return i === q.length ? 1 : 0;
  }
  function tekenOb() {
    var q = document.getElementById('ob-in').value.trim().toLowerCase();
    laadKlanten().then(function (kl) {
      var kItems = kl.map(function (k) { return { t: k.bedrijf || k.naam, sub: k.bedrijf ? k.naam : k.email, s: k.status === 'prospect' ? 'Lead' : k.status === 'klant' ? 'Klant' : 'Oud', url: '/intern/klant.html?id=' + encodeURIComponent(k.id), k: k, sc: Math.max(score(k.naam || '', q), score(k.bedrijf || '', q), score(k.email || '', q)) }; })
        .filter(function (x) { return x.sc > 0; }).sort(function (a, b) { return b.sc - a.sc; }).slice(0, q ? 8 : 5);
      var aItems = ACTIES.map(function (a) { return Object.assign({ sc: score(a.t, q) }, a); }).filter(function (a) { return a.sc > 0; }).sort(function (a, b) { return b.sc - a.sc; }).slice(0, q ? 6 : 8);
      obItems = (q ? kItems.concat(aItems) : aItems.slice(0, 4).concat(kItems));
      obIdx = Math.min(obIdx, Math.max(0, obItems.length - 1));
      var html = '', groep = '';
      obItems.forEach(function (x, i) {
        var g = x.k ? 'Klanten en leads' : 'Acties en pagina\'s';
        if (g !== groep) { html += '<div class="ob-kop">' + g + '</div>'; groep = g; }
        html += '<a class="ob-item' + (i === obIdx ? ' is-actief' : '') + '" data-i="' + i + '" href="' + (x.url || '#') + '"><i>' + esc((x.t || '?').slice(0, 1).toUpperCase()) + '</i><span>' + esc(x.t) + (x.sub ? ' <small style="margin-left:6px">' + esc(x.sub) + '</small>' : '') + '</span><small>' + esc(x.s) + '</small></a>';
      });
      document.getElementById('ob-lijst').innerHTML = html || '<div class="ob-kop">Niets gevonden</div>';
    });
  }
  function openOb() { ob.classList.add('open'); var i = document.getElementById('ob-in'); i.value = ''; obIdx = 0; tekenOb(); setTimeout(function () { i.focus(); }, 30); }
  function sluitOb() { ob.classList.remove('open'); }
  function kiesOb(i) { var x = obItems[i]; if (!x) return; sluitOb(); if (x.doe) x.doe(); else location.href = x.url; }
  document.getElementById('ob-in').addEventListener('input', function () { obIdx = 0; tekenOb(); });
  ob.addEventListener('click', function (e) { var a = e.target.closest('.ob-item'); if (a) { e.preventDefault(); kiesOb(+a.dataset.i); } else if (e.target === ob) sluitOb(); });
  ob.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { obIdx = Math.min(obItems.length - 1, obIdx + 1); tekenOb(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { obIdx = Math.max(0, obIdx - 1); tekenOb(); e.preventDefault(); }
    if (e.key === 'Enter') { kiesOb(obIdx); e.preventDefault(); }
  });

  // ---------- Contact vastleggen ----------
  var OPTIES = {
    kanaal: [['whatsapp', 'WhatsApp'], ['gebeld', 'Gebeld'], ['mail', 'Mail'], ['gesprek', 'Gesprek']],
    richting: [['klant', 'Klant nam contact op'], ['wij', 'Wij namen contact op']],
    onderwerp: [['app', 'App en MoneyMonk'], ['bonnetjes', 'Bonnetjes'], ['facturen', 'Facturen'], ['btw', 'Btw'], ['ib', 'IB-aangifte'], ['belastingdienst', 'Belastingdienst'], ['prijs', 'Prijs en factuur'], ['overig', 'Overig']],
    soort: [['vraag', 'Vraag'], ['probleem', 'Probleem'], ['klacht', 'Klacht'], ['compliment', 'Compliment'], ['verzoek', 'Verzoek']],
    opgelost: [['ja', 'Ja'], ['nee', 'Nog niet']],
    gevoel: [['blij', 'Tevreden'], ['neutraal', 'Neutraal'], ['boos', 'Ontevreden']]
  };
  var cm = document.createElement('div'); cm.className = 'cm'; cm.setAttribute('role', 'dialog'); cm.setAttribute('aria-modal', 'true'); cm.setAttribute('aria-labelledby', 'cm-titel');
  function chips(naam, extra) { return '<div class="chips-kies' + (extra || '') + '" data-veld="' + naam + '">' + OPTIES[naam].map(function (o) { return '<button type="button" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>'; }
  cm.innerHTML = '<div class="cm-doos"><div class="cm-kop"><div><h2 id="cm-titel">Contact vastleggen</h2><p>10 seconden. Hiermee zien we waar het beter kan.</p></div><button type="button" id="cm-sluit" aria-label="Sluiten">&times;</button></div>' +
    '<div class="cm-body"><div class="cm-veld cm-klant"><span>Klant of lead</span><input id="cm-zoek" type="text" placeholder="Typ een naam of bedrijf…" autocomplete="off"><div class="cm-sug" id="cm-sug" hidden></div></div>' +
    '<div class="cm-rij"><div class="cm-veld"><span>Kanaal</span>' + chips('kanaal') + '</div><div class="cm-veld"><span>Wie begon</span>' + chips('richting') + '</div></div>' +
    '<div class="cm-veld"><span>Onderwerp</span>' + chips('onderwerp') + '</div>' +
    '<div class="cm-veld"><span>Soort</span>' + chips('soort') + '</div>' +
    '<div class="cm-rij"><div class="cm-veld"><span>Meteen opgelost?</span>' + chips('opgelost') + '</div><div class="cm-veld"><span>Gevoel van de klant</span>' + chips('gevoel') + '</div></div>' +
    '<label class="schuif"><input type="checkbox" id="cm-vermijd">Had niet nodig hoeven zijn, met betere uitleg vooraf</label>' +
    '<div class="cm-rij"><div class="cm-veld"><span>Notitie (optioneel)</span><textarea id="cm-notitie" rows="2" maxlength="1000" placeholder="Kort, voor jezelf en je collega"></textarea></div><div class="cm-veld"><span>Datum</span><input type="date" id="cm-datum"></div></div></div>' +
    '<div class="cm-voet"><span class="fout" id="cm-fout"></span><button class="ai-knop licht" type="button" id="cm-annuleer">Annuleren</button><button class="ai-knop" type="button" id="cm-bewaar">Opslaan</button></div></div>';
  document.body.appendChild(cm);
  var keuze = {}, klantKeuze = null, sugIdx = 0, sugLijst = [];
  cm.querySelectorAll('.chips-kies').forEach(function (g) {
    g.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var v = g.dataset.veld, aan = !b.classList.contains('is-aan');
      g.querySelectorAll('button').forEach(function (x) { x.classList.remove('is-aan'); });
      if (aan) { b.classList.add('is-aan'); keuze[v] = b.dataset.v; } else delete keuze[v];
    });
  });
  function zetChip(v, w) { keuze[v] = w; cm.querySelectorAll('[data-veld="' + v + '"] button').forEach(function (b) { b.classList.toggle('is-aan', b.dataset.v === w); }); }
  function tekenSug() {
    var q = document.getElementById('cm-zoek').value.trim().toLowerCase(), box = document.getElementById('cm-sug');
    laadKlanten().then(function (kl) {
      sugLijst = kl.filter(function (k) { return k.status !== 'verloren' && (!q || ((k.naam || '') + ' ' + (k.bedrijf || '') + ' ' + (k.email || '')).toLowerCase().indexOf(q) > -1); }).slice(0, 7);
      sugIdx = Math.min(sugIdx, Math.max(0, sugLijst.length - 1));
      box.innerHTML = sugLijst.map(function (k, i) { return '<button type="button" data-i="' + i + '" class="' + (i === sugIdx ? 'is-actief' : '') + '">' + esc(k.bedrijf || k.naam) + '<small>' + esc(k.bedrijf ? k.naam : k.email) + (k.status === 'prospect' ? ', lead' : '') + '</small></button>'; }).join('') || '<button type="button" disabled>Geen klant gevonden</button>';
      box.hidden = false;
    });
  }
  function kiesKlant(k) { klantKeuze = k; document.getElementById('cm-zoek').value = k.bedrijf ? k.bedrijf + ' (' + k.naam + ')' : k.naam; document.getElementById('cm-sug').hidden = true; }
  var zoekIn = document.getElementById('cm-zoek');
  zoekIn.addEventListener('input', function () { klantKeuze = null; sugIdx = 0; tekenSug(); });
  zoekIn.addEventListener('focus', function () { if (!klantKeuze) tekenSug(); });
  zoekIn.addEventListener('keydown', function (e) {
    var box = document.getElementById('cm-sug'); if (box.hidden) return;
    if (e.key === 'ArrowDown') { sugIdx = Math.min(sugLijst.length - 1, sugIdx + 1); tekenSug(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { sugIdx = Math.max(0, sugIdx - 1); tekenSug(); e.preventDefault(); }
    if (e.key === 'Enter' && sugLijst[sugIdx]) { kiesKlant(sugLijst[sugIdx]); e.preventDefault(); }
  });
  document.getElementById('cm-sug').addEventListener('mousedown', function (e) { var b = e.target.closest('[data-i]'); if (b) { e.preventDefault(); kiesKlant(sugLijst[+b.dataset.i]); } });
  function openContact(id) {
    keuze = {}; klantKeuze = null; document.getElementById('cm-fout').textContent = '';
    cm.querySelectorAll('.chips-kies button').forEach(function (b) { b.classList.remove('is-aan'); });
    zetChip('kanaal', 'whatsapp'); zetChip('richting', 'klant'); zetChip('soort', 'vraag'); zetChip('opgelost', 'ja');
    document.getElementById('cm-vermijd').checked = false; document.getElementById('cm-notitie').value = '';
    document.getElementById('cm-datum').value = new Date().toISOString().slice(0, 10);
    zoekIn.value = ''; document.getElementById('cm-sug').hidden = true;
    cm.classList.add('open');
    if (id) laadKlanten().then(function (kl) { var k = kl.filter(function (x) { return x.id === id; })[0]; if (k) kiesKlant(k); });
    setTimeout(function () { (id ? cm.querySelector('[data-veld="onderwerp"] button') : zoekIn).focus(); }, 40);
  }
  function sluitContact() { cm.classList.remove('open'); }
  document.getElementById('cm-sluit').addEventListener('click', sluitContact);
  document.getElementById('cm-annuleer').addEventListener('click', sluitContact);
  cm.addEventListener('click', function (e) { if (e.target === cm) sluitContact(); });
  document.getElementById('cm-bewaar').addEventListener('click', function () {
    var fout = document.getElementById('cm-fout');
    if (!klantKeuze) { fout.textContent = 'Kies eerst een klant of lead.'; zoekIn.focus(); return; }
    if (!keuze.onderwerp) { fout.textContent = 'Kies een onderwerp.'; return; }
    var b = this; b.disabled = true;
    api('/intern/api/klant/contact', { method: 'POST', body: JSON.stringify({
      id: klantKeuze.id, kanaal: keuze.kanaal, richting: keuze.richting, onderwerp: keuze.onderwerp, soort: keuze.soort,
      opgelost: keuze.opgelost === 'ja' ? true : keuze.opgelost === 'nee' ? false : null, gevoel: keuze.gevoel || null,
      vermijdbaar: document.getElementById('cm-vermijd').checked, notitie: document.getElementById('cm-notitie').value, datum: document.getElementById('cm-datum').value
    }) }).then(function (r) {
      sluitContact(); meld('Contact met ' + (klantKeuze.bedrijf || klantKeuze.naam) + ' vastgelegd');
      document.dispatchEvent(new CustomEvent('ae:contact', { detail: r }));
    }).catch(function (e) { fout.textContent = e.message; }).then(function () { b.disabled = false; });
  });

  // ---------- Toetsen en knoppen ----------
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-ob]')) { e.preventDefault(); openOb(); }
    var c = e.target.closest('[data-contact]'); if (c) { e.preventDefault(); openContact(c.getAttribute('data-contact') || (window.AE_KLANT || '')); }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ob.classList.contains('open') ? sluitOb() : openOb(); }
    if (e.key === 'Escape') { sluitOb(); sluitContact(); document.body.classList.remove('zij-open'); }
  });

  window.AE = { api: api, ik: function () { return ikBelofte; }, meld: meld, openContact: openContact, esc: esc, svg: svg, herlaadKlanten: function () { KLANTEN = null; return laadKlanten(); } };
})();
