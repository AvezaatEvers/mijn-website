// A&E Agent: de chat (volledige pagina /intern/agent.html).
(function () {
  var AE = window.AE; if (!AE) return;
  var esc = AE.esc, pad = location.pathname.replace(/index\.html$/, '');
  var PIJL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  var GROOT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
  var NIEUW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  var DUIM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10v11H4V10zM7 10l4-8a2.5 2.5 0 0 1 3 2.5V9h5.2a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 17.8 21H7"/></svg>';
  var DUIM_NEER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 14V3h3v11zM17 14l-4 8a2.5 2.5 0 0 1-3-2.5V15H4.8a2 2 0 0 1-2-2.3l1.4-8A2 2 0 0 1 6.2 3H17"/></svg>';
  // Snel of slim (per persoon onthouden)
  function modusKeuze(v) { try { if (v) localStorage.setItem('ae-agent-modus', v); return localStorage.getItem('ae-agent-modus') || 'slim'; } catch (e) { return 'slim'; } }
  var opgewarmd = 0;
  function opwarmen() { if (Date.now() - opgewarmd < 240000) return; opgewarmd = Date.now(); fetch('/agent-api', { credentials: 'same-origin' }).catch(function () {}); }
  // Rustig icoon in huisstijl (de klasse orb blijft voor de maatvoering)
  function orb(kl) { return '<div class="orb ag-ico ' + (kl || '') + '" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"/></svg></div>'; }
  var STATUS = AE.api('/intern/api/agent/status').catch(function () { return { slim: false }; });

  // ---------- Markdown (beperkt en veilig) ----------
  function inline(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[\s(])_([^_]+)_(?=[\s.,)!?]|$)/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]]+)\]\(((?:\/|https:\/\/)[^)\s]*)\)/g, function (m, t, u) {
      var extern = /^https:/.test(u);
      return '<a href="' + u.replace(/"/g, '%22') + '"' + (extern ? ' target="_blank" rel="noopener"' : '') + '>' + t + '</a>';
    });
    return s;
  }
  function md(tekst) {
    var regels = String(tekst || '').split('\n'), uit = [], lijst = null, para = [];
    function sluitPara() { if (para.length) { uit.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } }
    function sluitLijst() { if (lijst) { uit.push('</' + lijst + '>'); lijst = null; } }
    regels.forEach(function (r) {
      var m;
      if (/^\s*$/.test(r)) { sluitPara(); sluitLijst(); return; }
      if ((m = r.match(/^#{1,4}\s+(.*)$/))) { sluitPara(); sluitLijst(); uit.push('<h3>' + inline(m[1]) + '</h3>'); return; }
      if ((m = r.match(/^\s*[-*•]\s+(.*)$/))) { sluitPara(); if (lijst !== 'ul') { sluitLijst(); uit.push('<ul>'); lijst = 'ul'; } uit.push('<li>' + inline(m[1]) + '</li>'); return; }
      if ((m = r.match(/^\s*(\d+)[.)]\s+(.*)$/))) { sluitPara(); if (lijst !== 'ol') { sluitLijst(); uit.push('<ol start="' + m[1] + '">'); lijst = 'ol'; } uit.push('<li>' + inline(m[2]) + '</li>'); return; }
      sluitLijst(); para.push(r);
    });
    sluitPara(); sluitLijst();
    return uit.join('');
  }

  // ---------- Suggesties per context ----------
  function suggesties(modus) {
    var k = window.AE_KLANT;
    var S = {
      dag: [['Dagcoach', 'Waar moet ik vandaag mee beginnen?'], ['Leads', 'Welke leads moet ik als eerste bellen, en wat zeg ik?'], ['Klanten', 'Welke klanten hebben nu aandacht nodig?'], ['Planning', 'Maak een planning voor mijn week.']],
      boek: [['Boekhouden', 'Hoe boek ik een creditfactuur en verreken ik die?'], ['Btw', 'Mijn klant levert diensten aan een bedrijf in Duitsland. Hoe zit het met de btw?'], ['IB', 'Hoe zit het met de zelfstandigenaftrek en het urencriterium?'], ['Jaareinde', 'Wanneer is investeren vóór de jaarwisseling slim?']],
      werk: [['Werkstroom', 'Loop de werkstroom voor het btw-kwartaal met me door.'], ['Onboarding', 'Ik heb een nieuwe klant. Wat moet ik allemaal doen?'], ['Klacht', 'Een klant gaf een 5 voor tevredenheid. Hoe pak ik dat aan?'], ['Overzicht', 'Welke werkstromen lopen er nu?']],
      klant: [['Klant', 'Vat deze klant samen in vijf steekzinnen.'], ['Volgende stap', 'Wat is de volgende stap met deze klant?'], ['Bericht', 'Schrijf een kort WhatsApp-bericht voor deze klant.'], ['Werkstroom', 'Welke werkstroom past nu bij deze klant?']]
    };
    if (modus && S[modus]) return S[modus];
    if (k) return S.klant;
    if (/kwartaal/.test(pad)) return [['Btw', 'Wie moet ik nog achter de broek zitten voor het kwartaal?'], S.werk[0], S.boek[1], S.dag[0]];
    if (/inzichten/.test(pad)) return [['NPS', 'Wat moeten we verbeteren voor een hogere NPS?'], ['Contact', 'Welke vragen hadden we kunnen voorkomen, en hoe?'], S.werk[2], S.dag[0]];
    if (/werkstromen/.test(pad)) return S.werk;
    return [S.dag[0], S.boek[0], S.werk[1], S.dag[1]];
  }

  // ---------- Bevestigkaarten: acties die pas na een klik gebeuren ----------
  var BEV = 'ae-bevestigd';
  function bevStatus(id, v) { try { var m = JSON.parse(localStorage.getItem(BEV) || '{}'); if (v === undefined) return m[id]; m[id] = v; localStorage.setItem(BEV, JSON.stringify(m)); } catch (e) { return null; } }
  function kaartHtml(d) {
    var data = esc(JSON.stringify({ verzoek: d.verzoek, test: d.test || null, voorbeeld: d.voorbeeld || null, klaar: d.klaar || 'Gedaan', link: d.link || null }));
    return '<div class="ag-bev" data-id="' + esc(d.id) + '" data-bev-data="' + data + '"><div class="ag-bev-titel">' + esc(d.titel) + '</div><dl>' +
      (d.regels || []).map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]).replace(/\n/g, '<br>') + '</dd></div>'; }).join('') + '</dl>' +
      '<div class="ag-bev-knoppen"><button type="button" class="ja" data-bev="ja">' + esc(d.knop || 'Bevestigen') + '</button>' +
      (d.voorbeeld ? '<button type="button" data-bev="voorbeeld">Voorbeeld</button>' : '') + (d.test ? '<button type="button" data-bev="test">Test naar info@</button>' : '') +
      '<button type="button" class="stil" data-bev="nee">Annuleren</button></div><div class="ag-bev-status" aria-live="polite"></div></div>';
  }
  function zetKaart(k, staat, tekst, link) {
    k.classList.remove('is-klaar', 'is-weg', 'is-fout');
    if (staat) k.classList.add('is-' + staat);
    var st = k.querySelector('.ag-bev-status');
    st.innerHTML = tekst ? esc(tekst) + (link ? ' <a href="' + esc(link) + '">Openen</a>' : '') : '';
    k.querySelectorAll('[data-bev]').forEach(function (b) { b.disabled = staat === 'klaar' || staat === 'weg'; });
  }
  function herstelKaarten(el) {
    el.querySelectorAll('.ag-bev').forEach(function (k) {
      var s = bevStatus(k.dataset.id);
      if (s && s.staat === 'klaar') zetKaart(k, 'klaar', s.tekst, s.link);
      else if (s && s.staat === 'weg') zetKaart(k, 'weg', 'Geannuleerd');
    });
  }
  function kaartKlik(e) {
    var b = e.target.closest('[data-bev]'); if (!b) return;
    var k = b.closest('.ag-bev'), d = JSON.parse(k.getAttribute('data-bev-data')), wat = b.dataset.bev;
    if (wat === 'nee') { bevStatus(k.dataset.id, { staat: 'weg' }); return zetKaart(k, 'weg', 'Geannuleerd'); }
    if (wat === 'voorbeeld') return (typeof d.voorbeeld === 'string' ? AE.api(d.voorbeeld) : AE.api(d.voorbeeld.url, { method: 'POST', body: JSON.stringify(d.voorbeeld.body) })).then(toonVoorbeeld).catch(function (err) { zetKaart(k, 'fout', err.message); });
    var v = wat === 'test' ? d.test : d.verzoek;
    if (!v || String(v.url).indexOf('/intern/api/') !== 0) return;
    b.disabled = true; zetKaart(k, null, wat === 'test' ? 'Testmail versturen…' : 'Bezig…');
    AE.api(v.url, { method: v.method, headers: { 'Content-Type': 'application/json', 'x-via': 'agent' }, body: JSON.stringify(v.body) }).then(function (r) {
      if (wat === 'test') { b.disabled = false; return zetKaart(k, null, 'Testmail verstuurd naar info@. Klopt alles? Klik dan op ' + k.querySelector('.ja').textContent + '.'); }
      var link = d.link || (r && r.id ? '/intern/klant.html?id=' + encodeURIComponent(r.id) : null);
      bevStatus(k.dataset.id, { staat: 'klaar', tekst: d.klaar, link: link });
      zetKaart(k, 'klaar', d.klaar, link);
      AE.meld(d.klaar);
      if (AE.herlaadKlanten) AE.herlaadKlanten();
      document.dispatchEvent(new CustomEvent('ae:agent-actie'));
    }).catch(function (err) { b.disabled = false; zetKaart(k, 'fout', err.message || 'Mislukt'); });
  }
  function toonVoorbeeld(r) {
    var o = document.createElement('div'); o.className = 'ag-vb';
    o.innerHTML = '<div class="ag-vb-doos" role="dialog" aria-label="Voorbeeld mail"><div class="ag-vb-kop"><div><small>Onderwerp</small><b>' + esc(r.onderwerp) + '</b></div><button type="button" aria-label="Sluiten">&times;</button></div><iframe title="Voorbeeld"></iframe></div>';
    document.body.appendChild(o);
    o.querySelector('iframe').srcdoc = r.html;
    function weg() { o.remove(); }
    o.addEventListener('click', function (e) { if (e.target === o || e.target.closest('.ag-vb-kop button')) weg(); });
  }

  // ---------- Herbruikbare chat ----------
  // Gesprekken staan op de server (per persoon). Lokaal onthouden we alleen welk gesprek open staat.
  var ACTIEF = 'ae-gesprek-actief';
  function actief(v) { try { if (v === undefined) return localStorage.getItem(ACTIEF); if (v) localStorage.setItem(ACTIEF, v); else localStorage.removeItem(ACTIEF); } catch (e) { return null; } }

  function maakChat(root, opt) {
    opt = opt || {};
    var berichten = [], bezig = false, modus = opt.modus || null, gid = null, laadNr = 0;
    root.classList.add('ag-chat');
    root.innerHTML = '<div class="ag-stroom" aria-live="polite"></div><form class="ag-invoer"><div class="ag-veld"><textarea rows="1" placeholder="' + (opt.placeholder || 'Vraag het de agent…') + '" aria-label="Bericht aan de agent"></textarea><button type="submit" aria-label="Versturen" disabled>' + PIJL + '</button></div><div class="ag-hint"><span>Enter om te versturen, Shift+Enter voor een nieuwe regel</span><span class="ag-modus"></span></div></form>';
    var stroom = root.querySelector('.ag-stroom'), form = root.querySelector('form'), ta = root.querySelector('textarea'), knop = root.querySelector('button[type=submit]');
    function tekenModus() {
      var m = modusKeuze();
      root.querySelector('.ag-modus').innerHTML = '<span class="ag-schakel" role="group" aria-label="Snelheid"><button type="button" data-m="snel"' + (m === 'snel' ? ' class="is-aan"' : '') + ' title="Snelste antwoord (Gemini Flash-Lite)">Snel</button><button type="button" data-m="slim"' + (m === 'slim' ? ' class="is-aan"' : '') + ' title="Denkt beter na, iets trager (Gemini Flash)">Slim</button></span>';
    }
    STATUS.then(function (s) { if (s.slim) tekenModus(); else root.querySelector('.ag-modus').textContent = 'Lokale modus'; });
    root.querySelector('.ag-modus').addEventListener('click', function (e) { var b = e.target.closest('[data-m]'); if (!b) return; modusKeuze(b.dataset.m); tekenModus(); });
    opwarmen();

    function welkom() {
      return AE.ik().then(function (ik) {
        var u = new Date().getHours(), groet = u < 12 ? 'Goedemorgen' : u < 18 ? 'Goedemiddag' : 'Goedenavond';
        stroom.innerHTML = '<div class="ag-welkom">' + orb() + '<h2>Waar kan ik mee helpen?</h2><p>Ik ken jullie klanten, werkstromen en de kennisbank.</p><div class="ag-sug">' +
          suggesties(modus).map(function (s, i) { return '<button type="button" style="animation-delay:' + (.08 * i) + 's" data-vraag="' + esc(s[1]) + '"><small>' + esc(s[0]) + '</small>' + esc(s[1]) + '</button>'; }).join('') + '</div></div>';
      });
    }
    function tekenAlles() {
      if (!berichten.length) return welkom();
      stroom.innerHTML = '';
      berichten.forEach(function (b) { voegToe(b); });
      stroom.scrollTop = stroom.scrollHeight;
    }
    function voegToe(b) {
      var el = document.createElement('div');
      if (b.rol === 'gebruiker') { el.className = 'ag-msg mens'; el.innerHTML = '<div>' + esc(b.tekst) + '</div>'; }
      else {
        el.className = 'ag-msg agent';
        el.innerHTML = orb('mini') + '<div><div class="ag-stappen"></div><div class="md"></div><div class="ag-extra"></div></div>';
        el.querySelector('.md').innerHTML = md(b.tekst);
        if (b.stappen) el.querySelector('.ag-stappen').innerHTML = b.stappen.map(function (s) { return '<span class="ag-stap klaar">' + esc(s) + '</span>'; }).join('');
        if (b.extra) { el.querySelector('.ag-extra').innerHTML = b.extra; herstelKaarten(el); }
        if (b.tekst && b.vraag) { el._bericht = b; el.querySelector(':scope > div:not(.orb)').insertAdjacentHTML('beforeend', oordeelHtml(b)); }
      }
      stroom.appendChild(el);
      return el;
    }
    function oordeelHtml(b) {
      if (b.oordeel) return '<div class="ag-oordeel is-gegeven">' + (b.oordeel === 'goed' ? 'Gemarkeerd als goed antwoord. De agent gebruikt dit voortaan.' : 'Correctie opgeslagen. De agent neemt dit voortaan mee.') + '</div>';
      return '<div class="ag-oordeel"><button type="button" data-oordeel="goed" title="Goed antwoord: de agent hergebruikt dit">' + DUIM + 'Goed antwoord</button><button type="button" data-oordeel="beter" title="Kan beter: vertel wat er anders moet">' + DUIM_NEER + 'Kan beter</button></div>';
    }
    function oordeelKlik(e) {
      var k = e.target.closest('[data-oordeel]'); if (!k) return;
      var msg = k.closest('.ag-msg'), b = msg && msg._bericht; if (!b) return;
      var vak = k.closest('.ag-oordeel');
      if (k.dataset.oordeel === 'beter') {
        vak.innerHTML = '<form class="ag-correctie"><textarea rows="2" placeholder="Wat moet anders? Bijvoorbeeld: het juiste bedrag, wat er ontbrak, of hoe wij het doen."></textarea><div><button type="submit" data-oordeel="opslaan">Opslaan</button><button type="button" data-oordeel="annuleer" class="stil">Annuleren</button></div></form>';
        vak.querySelector('textarea').focus();
        return;
      }
      if (k.dataset.oordeel === 'annuleer') { vak.outerHTML = oordeelHtml(b); return; }
      e.preventDefault();
      var correctie = k.dataset.oordeel === 'opslaan' ? (vak.querySelector('textarea').value || '').trim() : '';
      if (k.dataset.oordeel === 'opslaan' && !correctie) { vak.querySelector('textarea').focus(); return; }
      k.disabled = true;
      AE.api('/intern/api/geheugen/oordeel', { method: 'POST', body: JSON.stringify({ vraag: b.vraag, antwoord: b.tekst, oordeel: correctie ? 'kan-beter' : 'goed', correctie: correctie, web: !!b.web, bronnen: b.bronnen || [] }) })
        .then(function () { b.oordeel = correctie ? 'kan-beter' : 'goed'; vak.outerHTML = oordeelHtml(b); bewaar(); AE.meld(correctie ? 'Correctie onthouden' : 'Onthouden als goed antwoord'); })
        .catch(function (err) { k.disabled = false; AE.meld(err.message); });
    }
    function bronnenHtml(lijst) {
      if (!lijst || !lijst.length) return '';
      var gezien = {};
      return '<div class="ag-bronnen">' + lijst.filter(function (b) { var s = b.bron || b.titel; if (gezien[s]) return false; gezien[s] = 1; return true; }).slice(0, 5).map(function (b) {
        var t = '<b>' + esc(b.groep || 'Bron') + '</b>' + esc(b.titel.length > 52 ? b.titel.slice(0, 50) + '…' : b.titel);
        return b.bron ? '<a href="' + esc(b.bron) + '" target="_blank" rel="noopener">' + t + '</a>' : '<span>' + t + '</span>';
      }).join('') + '</div>';
    }

    function vraag(tekst) {
      tekst = String(tekst || '').trim();
      if (!tekst || bezig) return;
      bezig = true; knop.disabled = true; ta.value = ''; groei();
      if (!berichten.length) stroom.innerHTML = '';
      var mens = { rol: 'gebruiker', tekst: tekst };
      berichten.push(mens); voegToe(mens);
      var el = voegToe({ rol: 'agent', tekst: '' });
      var mdEl = el.querySelector('.md'), stEl = el.querySelector('.ag-stappen'), exEl = el.querySelector('.ag-extra'), orbEl = el.querySelector('.orb');
      orbEl.classList.add('denkt'); document.querySelectorAll('.ag-kop .orb').forEach(function (o) { o.classList.add('denkt'); });
      mdEl.innerHTML = '<div class="ag-denkt"><span></span><span></span><span></span></div>';
      stroom.scrollTop = stroom.scrollHeight;
      var antwoord = '', stappen = [], bronnen = [], acties = [], links = [], open = null, raf = 0, info = '', kaarten = [], waarschuwingen = [];
      function teken() {
        raf = 0;
        mdEl.innerHTML = antwoord ? md(antwoord) : afgerond ? '' : '<div class="ag-denkt"><span></span><span></span><span></span></div>';
        var laatste = mdEl.lastElementChild; if (antwoord && laatste) laatste.classList.add('typt');
        var dichtbij = stroom.scrollHeight - stroom.scrollTop - stroom.clientHeight < 140;
        if (dichtbij) stroom.scrollTop = stroom.scrollHeight;
      }
      function stap(label) {
        if (open) open.classList.add('klaar');
        open = document.createElement('span'); open.className = 'ag-stap'; open.textContent = label; stEl.appendChild(open); stappen.push(label);
      }
      // Nooit eindeloos laden: na 45 s geven we het op met een duidelijke melding
      var afgerond = false, afbreek = new AbortController(), afbreekKlok = setTimeout(function () { afbreek.abort(); }, 45000);
      fetch('/agent-api', { method: 'POST', credentials: 'same-origin', signal: afbreek.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modus: modusKeuze(), berichten: berichten.slice(-40).map(function (b) { return { rol: b.rol, tekst: b.tekst }; }), pagina: document.title.split('|')[0].trim(), klant: window.AE_KLANT || '' }) })
        .then(function (r) {
          if (r.status === 401) { location.reload(); throw new Error('Uitgelogd'); }
          if (!r.ok || !r.body) throw new Error('De agent is even niet bereikbaar (' + r.status + ')');
          var reader = r.body.getReader(), dec = new TextDecoder(), buf = '';
          function lees() {
            return reader.read().then(function (x) {
              if (x.done) return;
              buf += dec.decode(x.value, { stream: true });
              var i;
              while ((i = buf.indexOf('\n\n')) >= 0) {
                var regel = buf.slice(0, i); buf = buf.slice(i + 2);
                if (regel.indexOf('data:') !== 0) continue;
                var d; try { d = JSON.parse(regel.slice(5)); } catch (e) { continue; }
                if (d.t === 'tekst') { if (d.v) { if (open) { open.classList.add('klaar'); open = null; } antwoord += d.v; if (!raf) raf = requestAnimationFrame(teken); } }
                else if (d.t === 'vervang') { if (d.v) { antwoord = d.v; if (open) { open.classList.add('klaar'); open = null; } if (!raf) raf = requestAnimationFrame(teken); } }
                else if (d.t === 'tool') stap(d.label);
                else if (d.t === 'bronnen') bronnen = bronnen.concat(d.v || []);
                else if (d.t === 'info') info = d.v;
                else if (d.t === 'bevestig') kaarten.push(d);
                else if (d.t === 'waarschuwing') waarschuwingen.push(d.v);
                else if (d.t === 'actie') { acties.push(d); AE.meld(d.tekst); }
                else if (d.t === 'klant') links.push(['Open ' + d.naam, '/intern/klant.html?id=' + encodeURIComponent(d.id)]);
                else if (d.t === 'werkstroom') links.push(['Werkstroom: ' + d.titel, '/intern/werkstromen.html?p=' + encodeURIComponent(d.id)]);
                else if (d.t === 'fout') throw new Error(d.v);
              }
              return lees();
            });
          }
          return lees();
        })
        .then(function () { if (!antwoord) throw new Error('Geen antwoord ontvangen: de server stopte voordat Gemini antwoordde. Probeer het nog eens, of kies Snel.'); })
        .catch(function (e) { var msg = e.name === 'AbortError' ? 'De agent deed er te lang over (45 s). Probeer het nog eens, of kies Snel.' : /load failed|failed to fetch|networkerror|network error/i.test(e.message || '') ? 'De verbinding met de agent viel weg. Probeer het nog eens.' : (e.message || 'Er ging iets mis'); exEl.innerHTML = '<div class="ag-fout">' + esc(msg) + '</div>'; })
        .then(function () {
          clearTimeout(afbreekKlok); afgerond = true;
          if (open) open.classList.add('klaar');
          if (raf) cancelAnimationFrame(raf); teken();
          var t = mdEl.querySelector('.typt'); if (t) t.classList.remove('typt');
          var gezien = {};
          var extra = bronnenHtml(bronnen) +
            acties.map(function (a) { return '<a class="ag-actie" href="' + esc(a.link || '#') + '">' + esc(a.tekst) + '</a>'; }).join('') +
            (links.length ? '<div class="ag-kaartjes">' + links.filter(function (l) { if (gezien[l[1]]) return false; gezien[l[1]] = 1; return true; }).slice(0, 3).map(function (l) { return '<a href="' + esc(l[1]) + '">' + esc(l[0]) + '</a>'; }).join('') + '</div>' : '');
          extra = kaarten.map(kaartHtml).join('') + extra;
          if (waarschuwingen.length) extra += waarschuwingen.map(function (w) { return '<div class="ag-waarsch">' + esc(w) + '</div>'; }).join('');
          if (info) extra += '<div class="ag-info">' + esc(info) + '</div>';
          exEl.innerHTML = extra + exEl.innerHTML;
          orbEl.classList.remove('denkt'); document.querySelectorAll('.ag-kop .orb').forEach(function (o) { o.classList.remove('denkt'); });
          if (antwoord) {
            var nieuw = { rol: 'agent', tekst: antwoord, stappen: stappen, extra: extra, vraag: tekst, web: /web/.test(info), bronnen: bronnen.filter(function (x) { return x.bron; }).slice(0, 6).map(function (x) { return { titel: x.titel, bron: x.bron }; }) };
            berichten.push(nieuw); bewaar();
            el._bericht = nieuw; el.querySelector(':scope > div:not(.orb)').insertAdjacentHTML('beforeend', oordeelHtml(nieuw));
          }
          else berichten.pop();
          bezig = false; knop.disabled = !ta.value.trim();
          if (acties.length) document.dispatchEvent(new CustomEvent('ae:agent-actie'));
          if (opt.focus !== false) ta.focus();
        });
    }
    function groei() { ta.style.height = 'auto'; ta.style.height = Math.min(160, ta.scrollHeight) + 'px'; }
    ta.addEventListener('focus', opwarmen);
    ta.addEventListener('input', function () { groei(); knop.disabled = bezig || !ta.value.trim(); });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); vraag(ta.value); } });
    form.addEventListener('submit', function (e) { e.preventDefault(); vraag(ta.value); });
    stroom.addEventListener('click', function (e) { var b = e.target.closest('[data-vraag]'); if (b) vraag(b.getAttribute('data-vraag')); });
    stroom.addEventListener('click', kaartKlik);
    stroom.addEventListener('click', oordeelKlik);
    stroom.addEventListener('submit', function (e) { if (e.target.closest('.ag-correctie')) { e.preventDefault(); var b = e.target.querySelector('[data-oordeel=opslaan]'); if (b) b.click(); } });

    function bewaar() {
      return AE.api('/intern/api/gesprek', { method: 'POST', body: JSON.stringify({ id: gid, berichten: berichten }) }).then(function (m) {
        gid = m.id; actief(gid);
        document.dispatchEvent(new CustomEvent('ae:gesprek', { detail: m }));
      }).catch(function () {});
    }
    function laadGesprek(id) {
      var nr = ++laadNr;
      if (!id) { gid = null; berichten = []; return welkom(); }
      stroom.innerHTML = '<div class="ag-laden"><div class="ag-denkt"><span></span><span></span><span></span></div></div>';
      return AE.api('/intern/api/gesprek?id=' + encodeURIComponent(id)).then(function (g) {
        if (nr !== laadNr) return;
        gid = g.id; berichten = g.berichten || []; actief(gid); tekenAlles();
      }).catch(function () { if (nr !== laadNr) return; gid = null; berichten = []; actief(null); welkom(); });
    }
    laadGesprek(opt.gesprek !== undefined ? opt.gesprek : actief());
    return {
      vraag: vraag,
      reset: function () { if (bezig) return; actief(null); laadGesprek(null); document.dispatchEvent(new CustomEvent('ae:gesprek', { detail: null })); },
      laad: function (id) { if (bezig) return; laadGesprek(id); },
      id: function () { return gid; },
      modus: function (m) { modus = m; if (!berichten.length) welkom(); },
      focus: function () { ta.focus(); },
      herteken: function () { if (!bezig && actief() !== gid) laadGesprek(actief()); }
    };
  }

  // ---------- Openen: altijd de volledige chatpagina (geen paneel of zwevende orb) ----------
  function open(vraag) {
    if (pad === '/intern/agent.html' && window.AE_GROTE_CHAT) { if (vraag) window.AE_GROTE_CHAT.vraag(vraag); else window.AE_GROTE_CHAT.focus(); return; }
    location.href = '/intern/agent.html' + (vraag ? '?nieuw=1&q=' + encodeURIComponent(vraag) : '');
  }
  function sluit() {}
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-agent]'); if (!a) return;
    e.preventDefault(); open(a.getAttribute('data-agent') || '');
  });
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); open(); }
  });

  AE.agent = { open: open, sluit: sluit, maakChat: maakChat, md: md, orb: orb };
  document.dispatchEvent(new CustomEvent('ae:agent-klaar'));
})();
