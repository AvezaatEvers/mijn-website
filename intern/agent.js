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

  // ---------- Herbruikbare chat ----------
  var GESCHIEDENIS = 'ae-agent-v1';
  function laad() { try { return JSON.parse(localStorage.getItem(GESCHIEDENIS) || '[]'); } catch (e) { return []; } }
  function bewaar(l) { try { localStorage.setItem(GESCHIEDENIS, JSON.stringify(l.slice(-40))); } catch (e) {} }

  function maakChat(root, opt) {
    opt = opt || {};
    var berichten = laad(), bezig = false, modus = opt.modus || null;
    root.classList.add('ag-chat');
    root.innerHTML = '<div class="ag-stroom" aria-live="polite"></div><form class="ag-invoer"><div class="ag-veld"><textarea rows="1" placeholder="' + (opt.placeholder || 'Vraag het de agent…') + '" aria-label="Bericht aan de agent"></textarea><button type="submit" aria-label="Versturen" disabled>' + PIJL + '</button></div><div class="ag-hint"><span>Enter om te versturen, Shift+Enter voor een nieuwe regel</span><span class="ag-modus"></span></div></form>';
    var stroom = root.querySelector('.ag-stroom'), form = root.querySelector('form'), ta = root.querySelector('textarea'), knop = root.querySelector('button[type=submit]');
    STATUS.then(function (s) { root.querySelector('.ag-modus').textContent = 'Gratis, op jullie eigen data'; });

    function welkom() {
      return AE.ik().then(function (ik) {
        var u = new Date().getHours(), groet = u < 12 ? 'Goedemorgen' : u < 18 ? 'Goedemiddag' : 'Goedenavond';
        stroom.innerHTML = '<div class="ag-welkom">' + orb() + '<h2>' + groet + ', ' + esc(ik.naam) + '</h2><p>Ik ken jullie klanten, werkstromen en de kennisbank. Vraag me wat je wilt, of kies een start.</p><div class="ag-sug">' +
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
        if (b.extra) el.querySelector('.ag-extra').innerHTML = b.extra;
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
      var antwoord = '', stappen = [], bronnen = [], acties = [], links = [], open = null, raf = 0;
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
        .catch(function (e) { antwoord += (antwoord ? '\n\n' : '') + ''; exEl.innerHTML = '<div class="ag-fout">' + esc(e.message || 'Er ging iets mis') + '</div>'; })
        .then(function () {
          if (open) open.classList.add('klaar');
          if (raf) cancelAnimationFrame(raf); teken();
          var t = mdEl.querySelector('.typt'); if (t) t.classList.remove('typt');
          var gezien = {};
          var extra = bronnenHtml(bronnen) +
            acties.map(function (a) { return '<a class="ag-actie" href="' + esc(a.link || '#') + '">' + esc(a.tekst) + '</a>'; }).join('') +
            (links.length ? '<div class="ag-kaartjes">' + links.filter(function (l) { if (gezien[l[1]]) return false; gezien[l[1]] = 1; return true; }).slice(0, 3).map(function (l) { return '<a href="' + esc(l[1]) + '">' + esc(l[0]) + '</a>'; }).join('') + '</div>' : '');
          exEl.innerHTML = extra + exEl.innerHTML;
          orbEl.classList.remove('denkt'); document.querySelectorAll('.ag-kop .orb').forEach(function (o) { o.classList.remove('denkt'); });
          if (antwoord) { berichten.push({ rol: 'agent', tekst: antwoord, stappen: stappen, extra: extra }); bewaar(berichten); }
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
    tekenAlles();
    return {
      vraag: vraag,
      reset: function () { berichten = []; bewaar(berichten); welkom(); },
      modus: function (m) { modus = m; if (!berichten.length) welkom(); },
      focus: function () { ta.focus(); },
      herteken: function () { berichten = laad(); tekenAlles(); }
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
    STATUS.then(function (s) { var st = document.getElementById('ag-st'); st.textContent = 'Online, kent jullie klanten en kennisbank'; });
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
  if (zij) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'zij-agent'; b.setAttribute('data-agent', '');
    b.innerHTML = orb('klein') + '<span>Vraag de agent<small>Je AI-collega</small></span><kbd>' + (/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘J' : 'Ctrl J') + '</kbd>';
    zij.insertBefore(b, zij.querySelector('.zij-zoek'));
  }
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
    var el = document.createElement('div'); el.className = 'intro'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Welkom');
    el.innerHTML = '<canvas aria-hidden="true"></canvas><div class="intro-in"><div class="intro-label">Avezaat &amp; Evers, intern</div>' + orb() +
      '<h1><span id="in-groet"></span><span class="cursor"></span></h1><div class="intro-regels" id="in-regels"></div>' +
      '<div class="intro-knoppen" id="in-knoppen"><button type="button" class="hoofd" data-in="dag">Start mijn dag met de agent</button><button type="button" data-in="weg">Naar het dashboard</button></div></div><div class="intro-skip">Klik of druk op Esc om over te slaan</div>';
    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
    sterren(el.querySelector('canvas'));
    var klaar = false;
    function weg(daarna) {
      if (klaar) return; klaar = true;
      el.classList.add('weg'); document.body.style.overflow = '';
      setTimeout(function () { el.remove(); if (daarna) daarna(); }, 750);
    }
    el.addEventListener('click', function (e) {
      var k = e.target.closest('[data-in]');
      if (k && k.dataset.in === 'dag') return weg(function () { open('Waar moet ik vandaag mee beginnen?'); });
      if (!k || k.dataset.in === 'weg') weg();
    });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape' || e.key === 'Enter') { document.removeEventListener('keydown', esc); weg(); } });

    var data = Promise.all([AE.ik(), AE.api('/intern/api/overzicht?wie=ik').catch(function () { return null; })]);
    var u = new Date().getHours(), groet = u < 6 ? 'Goedenacht' : u < 12 ? 'Goedemorgen' : u < 18 ? 'Goedemiddag' : 'Goedenavond';
    data.then(function (r) {
      var ik = r[0], o = r[1];
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
        x.beginPath(); x.arc(px, py, q.z * dpr, 0, 7); x.fillStyle = 'rgba(160,190,255,' + alfa + ')'; x.fill();
      });
      requestAnimationFrame(loop);
    })(t0);
  }

  AE.agent = { open: open, sluit: sluit, maakChat: maakChat, md: md, orb: orb };
  document.dispatchEvent(new CustomEvent('ae:agent-klaar'));
  intro();
})();
