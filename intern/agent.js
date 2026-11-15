// A&E-agent in de browser: intro bij openen, chatpaneel op elke pagina, herbruikbare chat (ook voor /intern/agent.html).
(function () {
  var AE = window.AE; if (!AE) return;
  var esc = AE.esc, pad = location.pathname.replace(/index\.html$/, '');
  var PIJL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  var GROOT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
  var NIEUW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  function orb(kl) { return '<div class="orb ' + (kl || '') + '"><i></i><i></i><i></i></div>'; }
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
    AE.api(v.url, { method: v.method, body: JSON.stringify(v.body) }).then(function (r) {
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
    STATUS.then(function (s) { root.querySelector('.ag-modus').textContent = s.slim ? 'Gemini, met jullie data en het web' : 'Lokale modus'; });

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
      }
      stroom.appendChild(el);
      return el;
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
        mdEl.innerHTML = antwoord ? md(antwoord) : '<div class="ag-denkt"><span></span><span></span><span></span></div>';
        var laatste = mdEl.lastElementChild; if (antwoord && laatste) laatste.classList.add('typt');
        var dichtbij = stroom.scrollHeight - stroom.scrollTop - stroom.clientHeight < 140;
        if (dichtbij) stroom.scrollTop = stroom.scrollHeight;
      }
      function stap(label) {
        if (open) open.classList.add('klaar');
        open = document.createElement('span'); open.className = 'ag-stap'; open.textContent = label; stEl.appendChild(open); stappen.push(label);
      }
      fetch('/intern/api/agent', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ berichten: berichten.slice(-14).map(function (b) { return { rol: b.rol, tekst: b.tekst }; }), pagina: document.title.split('|')[0].trim(), klant: window.AE_KLANT || '' }) })
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
        .catch(function (e) { antwoord += (antwoord ? '\n\n' : '') + ''; var msg = /load failed|failed to fetch|networkerror|network error/i.test(e.message || '') ? 'De verbinding met de agent viel weg. Probeer het nog eens.' : (e.message || 'Er ging iets mis'); exEl.innerHTML = '<div class="ag-fout">' + esc(msg) + '</div>'; })
        .then(function () {
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
          if (antwoord) { berichten.push({ rol: 'agent', tekst: antwoord, stappen: stappen, extra: extra }); bewaar(); }
          else berichten.pop();
          bezig = false; knop.disabled = !ta.value.trim();
          if (acties.length) document.dispatchEvent(new CustomEvent('ae:agent-actie'));
          if (opt.focus !== false) ta.focus();
        });
    }
    function groei() { ta.style.height = 'auto'; ta.style.height = Math.min(160, ta.scrollHeight) + 'px'; }
    ta.addEventListener('input', function () { groei(); knop.disabled = bezig || !ta.value.trim(); });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); vraag(ta.value); } });
    form.addEventListener('submit', function (e) { e.preventDefault(); vraag(ta.value); });
    stroom.addEventListener('click', function (e) { var b = e.target.closest('[data-vraag]'); if (b) vraag(b.getAttribute('data-vraag')); });
    stroom.addEventListener('click', kaartKlik);

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

  // ---------- Paneel ----------
  var paneel = null, chat = null;
  function bouwPaneel() {
    if (paneel) return;
    paneel = document.createElement('div'); paneel.className = 'ag'; paneel.setAttribute('role', 'dialog'); paneel.setAttribute('aria-label', 'A&E Agent');
    paneel.innerHTML = '<div class="ag-paneel"><div class="ag-kop">' + orb('klein') + '<div><b>A&amp;E Agent</b><small id="ag-st">Verbinden…</small></div><div class="knoppen">' +
      '<button type="button" id="ag-nieuw" title="Nieuw gesprek" aria-label="Nieuw gesprek">' + NIEUW + '</button>' +
      '<a href="/intern/agent.html" title="Volledig scherm" aria-label="Volledig scherm">' + GROOT + '</a>' +
      '<button type="button" id="ag-sluit" title="Sluiten" aria-label="Sluiten">&times;</button></div></div><div id="ag-chat"></div></div>';
    document.body.appendChild(paneel);
    chat = maakChat(paneel.querySelector('#ag-chat'));
    STATUS.then(function (s) { var st = document.getElementById('ag-st'); st.textContent = s.slim ? 'Kent jullie klanten, kennisbank en het web' : 'Lokale modus, zonder AI-sleutel'; st.classList.toggle('lokaal', !s.slim); });
    paneel.addEventListener('click', function (e) { if (e.target === paneel) sluit(); });
    document.getElementById('ag-sluit').addEventListener('click', sluit);
    document.getElementById('ag-nieuw').addEventListener('click', function () { chat.reset(); });
  }
  function open(vraag) {
    if (pad === '/intern/agent.html' && window.AE_GROTE_CHAT) { if (vraag) window.AE_GROTE_CHAT.vraag(vraag); else window.AE_GROTE_CHAT.focus(); return; }
    bouwPaneel(); chat.herteken();
    document.body.classList.add('ag-open');
    setTimeout(function () { if (vraag) chat.vraag(vraag); else chat.focus(); }, 380);
  }
  function sluit() { document.body.classList.remove('ag-open'); }

  // Zijbalkknop en zwevende orb
  var zij = document.querySelector('.zij');
  if (pad !== '/intern/agent.html') {
    var z = document.createElement('button'); z.type = 'button'; z.className = 'ag-zweef'; z.setAttribute('data-agent', ''); z.setAttribute('aria-label', 'Vraag de agent');
    z.innerHTML = orb() + '<span class="tip">Vraag de agent</span>';
    document.body.appendChild(z);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-agent]'); if (!a) return;
    e.preventDefault(); open(a.getAttribute('data-agent') || '');
  });
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); document.body.classList.contains('ag-open') ? sluit() : open(); }
    if (e.key === 'Escape') sluit();
  });

  // ---------- Intro bij openen ----------
  function intro() {
    var gezien = false; try { gezien = sessionStorage.getItem('ae-intro') === '1'; sessionStorage.setItem('ae-intro', '1'); } catch (e) {}
    if (gezien || pad !== '/intern/' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var vanLogin = false; try { vanLogin = sessionStorage.getItem('ae-van-login') === '1'; sessionStorage.removeItem('ae-van-login'); } catch (e) {}
    var el = document.createElement('div'); el.className = 'intro' + (vanLogin ? ' van-login' : ''); el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Welkom');
    el.innerHTML = '<canvas aria-hidden="true"></canvas><div class="intro-in"><div class="intro-label">Avezaat &amp; Evers, intern</div>' + orb() +
      '<h1><span id="in-groet"></span><span class="cursor"></span></h1><div class="intro-regels" id="in-regels"></div>' +
      '<div class="intro-knoppen" id="in-knoppen"><button type="button" class="hoofd" data-in="dag">Leid me door mijn dag</button><button type="button" data-in="weg">Naar het dashboard</button></div></div><div class="intro-skip">Klik of druk op Esc om over te slaan</div>';
    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
    sterren(el.querySelector('canvas'));
    var klaar = false;
    function weg(daarna) {
      if (klaar) return; klaar = true;
      var heroOrb = document.getElementById('hero-orb'), introOrb = el.querySelector('.intro-in > .orb');
      if (!heroOrb || !introOrb || !el.animate) {
        el.classList.add('weg'); document.body.style.overflow = '';
        return setTimeout(function () { el.remove(); if (daarna) daarna(); }, 750);
      }
      vlucht(el, introOrb, heroOrb, daarna);
    }
    el.addEventListener('click', function (e) {
      var k = e.target.closest('[data-in]');
      if (k && k.dataset.in === 'dag') return weg(function () { if (AE.gids) AE.gids.start(); else open('Waar moet ik vandaag mee beginnen?'); });
      if (!k || k.dataset.in === 'weg') weg();
    });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape' || e.key === 'Enter') { document.removeEventListener('keydown', esc); weg(); } });

    var data = Promise.all([AE.ik(), AE.api('/intern/api/overzicht?wie=ik').catch(function () { return null; }), AE.api('/intern/api/dagplan').catch(function () { return null; })]);
    var u = new Date().getHours(), groet = u < 6 ? 'Goedenacht' : u < 12 ? 'Goedemorgen' : u < 18 ? 'Goedemiddag' : 'Goedenavond';
    data.then(function (r) {
      var ik = r[0], o = r[1], dp = r[2];
      typ(document.getElementById('in-groet'), groet + ', ' + ik.naam + '.', 46, function () {
        var regels = ['Ik heb je dag klaargezet.'];
        if (o) {
          var urgent = o.leads.filter(function (l) { return l.urgent; }).length, aandacht = o.aandacht.filter(function (a) { return a.ernst >= 2; }).length;
          var taken = o.taken.teLaat.length + o.taken.vandaag.length;
          var deel = [];
          if (o.leads.length) deel.push('<b>' + o.leads.length + (o.leads.length === 1 ? ' lead' : ' leads') + '</b>' + (urgent ? ', waarvan ' + urgent + ' wacht' + (urgent === 1 ? '' : 'en') : ''));
          if (aandacht) deel.push('<b>' + aandacht + (aandacht === 1 ? ' klant' : ' klanten') + '</b> met aandacht');
          if (taken) deel.push('<b>' + taken + (taken === 1 ? ' taak' : ' taken') + '</b> voor vandaag');
          if (deel.length) regels.push(deel.join(', ') + '.');
          if (dp && dp.missies.length) regels.push('Je dagplan: <b>' + dp.missies.length + ' missies</b>, ongeveer ' + (dp.minuten >= 60 ? Math.floor(dp.minuten / 60) + ' uur' + (dp.minuten % 60 >= 15 ? ' en ' + (dp.minuten % 60) + ' minuten' : '') : dp.minuten + ' minuten') + '. Ik leid je erdoorheen.');
          if (o.mailsDezeWeek.length) regels.push(o.mailsDezeWeek.length + ' automatische ' + (o.mailsDezeWeek.length === 1 ? 'mail gaat' : 'mails gaan') + ' deze week vanzelf de deur uit.');
        }
        var box = document.getElementById('in-regels');
        regels.forEach(function (t, i) {
          var d = document.createElement('div'); d.innerHTML = t; box.appendChild(d);
          setTimeout(function () { d.classList.add('zicht'); }, 250 + i * 650);
        });
        setTimeout(function () { var k = document.getElementById('in-knoppen'); if (k) { k.classList.add('zicht'); k.querySelector('.hoofd').focus(); } }, 300 + regels.length * 650);
      });
    });
  }
  // Na de begroeting: warp, de orb vliegt naar zijn plek op Vandaag en het dashboard bouwt zich op
  function vlucht(el, introOrb, heroOrb, daarna) {
    scrollTo(0, 0);
    var canvas = el.querySelector('canvas'), van = introOrb.getBoundingClientRect();
    heroOrb.style.opacity = '0';
    document.body.classList.add('ae-onthul');
    el.classList.add('vertrek');
    // warp op- en afbouwen
    var t0 = performance.now();
    (function warp(t) {
      var s = (t - t0) / 1000;
      canvas._warp = s < .8 ? s / .8 : s < 2 ? 1 : Math.max(0, 1 - (s - 2) / 1);
      if (s < 3.1 && canvas.isConnected) requestAnimationFrame(warp);
    })(t0);
    // kopie van de orb die de reis maakt
    var kloon = document.createElement('div'); kloon.className = 'reis-orb'; kloon.innerHTML = orb();
    kloon.style.width = kloon.style.height = van.width + 'px'; kloon.style.left = van.left + 'px'; kloon.style.top = van.top + 'px';
    kloon.querySelector('.orb').style.setProperty('--m', van.width + 'px');
    document.body.appendChild(kloon);
    introOrb.style.visibility = 'hidden';
    setTimeout(function () {
      var naar = heroOrb.getBoundingClientRect();
      var dx = naar.left + naar.width / 2 - (van.left + van.width / 2), dy = naar.top + naar.height / 2 - (van.top + van.height / 2), sc = naar.width / van.width;
      var anim = kloon.animate([
        { transform: 'translate(0,0) scale(1)', filter: 'brightness(1)' },
        { transform: 'translate(0,-24px) scale(1.18)', filter: 'brightness(1.5)', offset: .18 },
        { transform: 'translate(' + (dx * .45 - 120) + 'px,' + (dy * .45 + 90) + 'px) scale(' + (sc * .7) + ')', filter: 'brightness(1.9)', offset: .55 },
        { transform: 'translate(' + (dx + 18) + 'px,' + (dy - 10) + 'px) scale(' + (sc * 1.08) + ')', filter: 'brightness(1.4)', offset: .86 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sc + ')', filter: 'brightness(1)' }
      ], { duration: 2800, easing: 'cubic-bezier(.55,0,.25,1)', fill: 'forwards' });
      var spoor = setInterval(function () {
        var r = kloon.getBoundingClientRect();
        for (var i = 0; i < 2; i++) {
          var v = document.createElement('i'); v.className = 'reis-vonk';
          v.style.left = (r.left + r.width / 2 + (Math.random() - .5) * r.width * .5) + 'px'; v.style.top = (r.top + r.height / 2 + (Math.random() - .5) * r.height * .5) + 'px';
          document.body.appendChild(v); setTimeout(function (x) { return function () { x.remove(); }; }(v), 1000);
        }
      }, 30);
      setTimeout(function () { el.classList.add('weg'); document.body.style.overflow = ''; }, 1300);
      anim.onfinish = function () {
        clearInterval(spoor);
        heroOrb.style.opacity = ''; heroOrb.classList.add('aangekomen');
        var r = heroOrb.getBoundingClientRect();
        [0, 160, 320].forEach(function (d) {
          setTimeout(function () {
            var g = document.createElement('i'); g.className = 'reis-golf';
            g.style.left = r.left + 'px'; g.style.top = r.top + 'px'; g.style.width = r.width + 'px'; g.style.height = r.height + 'px';
            document.body.appendChild(g); setTimeout(function () { g.remove(); }, 1300);
          }, d);
        });
        kloon.remove(); el.remove();
        setTimeout(function () { document.body.classList.remove('ae-onthul'); heroOrb.classList.remove('aangekomen'); }, 2400);
        if (daarna) setTimeout(daarna, 500);
      };
    }, 450);
  }

  function typ(el, tekst, snel, klaar) {
    var i = 0; (function stap() { el.textContent = tekst.slice(0, ++i); if (i < tekst.length) setTimeout(stap, snel); else if (klaar) setTimeout(klaar, 280); })();
  }
  function sterren(c) {
    var x = c.getContext('2d'), w, h, p = [], dpr = Math.min(2, window.devicePixelRatio || 1), t0 = performance.now();
    function maat() { w = c.width = innerWidth * dpr; h = c.height = innerHeight * dpr; }
    maat(); addEventListener('resize', maat);
    for (var i = 0; i < 90; i++) p.push({ a: Math.random() * Math.PI * 2, r: 0.15 + Math.random() * 0.75, s: (Math.random() * .4 + .1) * (Math.random() < .5 ? -1 : 1), z: Math.random() * 1.6 + .4 });
    (function loop(t) {
      if (!c.isConnected) return;
      var dt = (t - t0) / 1000; x.clearRect(0, 0, w, h);
      var cx = w / 2, cy = h * 0.42, R = Math.min(w, h) * 0.62;
      p.forEach(function (q) {
        var a = q.a + dt * q.s * 0.25, rr = R * q.r * (1 + 0.04 * Math.sin(dt + q.a));
        var px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * 0.55;
        var alfa = Math.min(1, dt / 1.5) * (0.25 + 0.5 * Math.abs(Math.sin(dt * .8 + q.a * 3)));
        var wp = c._warp || 0;
        if (wp > 0.02) {
          var dx = px - cx, dy = py - cy, l = Math.hypot(dx, dy) || 1, len = wp * (60 + q.z * 90) * dpr;
          q.r += wp * 0.012; if (q.r > 1.4) q.r = 0.05 + Math.random() * 0.2;
          x.beginPath(); x.moveTo(px, py); x.lineTo(px + dx / l * len, py + dy / l * len);
          x.strokeStyle = 'rgba(184,240,255,' + Math.min(1, alfa + wp * .6) + ')'; x.lineWidth = q.z * dpr * (0.6 + wp); x.stroke();
        } else { x.beginPath(); x.arc(px, py, q.z * dpr, 0, 7); x.fillStyle = 'rgba(160,190,255,' + alfa + ')'; x.fill(); }
      });
      requestAnimationFrame(loop);
    })(t0);
  }

  AE.agent = { open: open, sluit: sluit, maakChat: maakChat, md: md, orb: orb };
  // Dagmodus (de orb als gids) laden
  var gc = document.createElement('link'); gc.rel = 'stylesheet'; gc.href = '/intern/gids.css?v=4'; document.head.appendChild(gc);
  var gs = document.createElement('script'); gs.src = '/intern/gids.js?v=3'; document.body.appendChild(gs);
  document.dispatchEvent(new CustomEvent('ae:agent-klaar'));
  intro();
})();
