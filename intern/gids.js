// Dagmodus: de orb leidt je per missie door je dag. Vliegt naar de juiste plek, licht die uit en vertelt wat er moet gebeuren.
(function () {
  var AE = window.AE; if (!AE || !AE.agent) return;
  var esc = AE.esc, SLEUTEL = 'ae-dagmodus', vandaag = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' });
  var plan = null, huidig = null, orbEl = null, spot = null, straal = null, dok = null, doelEl = null, loop = 0, pos = null;

  function lees() { try { var s = JSON.parse(localStorage.getItem(SLEUTEL) || 'null'); return s && s.datum === vandaag ? s : null; } catch (e) { return null; } }
  function schrijf(s) { try { if (s) localStorage.setItem(SLEUTEL, JSON.stringify(Object.assign({ datum: vandaag }, s))); else localStorage.removeItem(SLEUTEL); } catch (e) {} }
  function sess(k, v) { try { if (v === undefined) { var x = sessionStorage.getItem(k); sessionStorage.removeItem(k); return x; } sessionStorage.setItem(k, v); } catch (e) { return null; } }
  function telefoon(t) { var d = String(t || '').replace(/[^\d+]/g, ''); return d; }
  function wa(t) { var d = String(t || '').replace(/\D/g, ''); if (d.indexOf('00') === 0) d = d.slice(2); else if (d.indexOf('0') === 0) d = '31' + d.slice(1); return d; }

  // ---------- Elementen ----------
  function bouw() {
    if (orbEl) return;
    document.body.classList.add('dagmodus');
    orbEl = document.createElement('div'); orbEl.className = 'gids-orb'; orbEl.title = 'Vraag de agent'; orbEl.innerHTML = AE.agent.orb();
    orbEl.addEventListener('click', function () { AE.agent.open(huidig ? 'Help me met: ' + huidig.titel + (huidig.klant ? ' voor ' + huidig.klant.naam : '') + '.' : ''); });
    spot = document.createElement('div'); spot.className = 'gids-spot';
    straal = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); straal.setAttribute('class', 'gids-straal');
    straal.innerHTML = '<defs><linearGradient id="gids-kleur" x1="0" x2="1"><stop offset="0" stop-color="#B8F0FF"/><stop offset="1" stop-color="#7FA4FF"/></linearGradient></defs><path d=""/><circle r="4" cx="-10" cy="-10"/>';
    dok = document.createElement('section'); dok.className = 'gids-dok weg'; dok.setAttribute('aria-label', 'Dagmodus'); dok.setAttribute('aria-live', 'polite');
    document.body.appendChild(spot); document.body.appendChild(straal); document.body.appendChild(dok); document.body.appendChild(orbEl);
    var start = rustPlek(); zet(start.x, start.y);
    dok.addEventListener('click', klikDok); dok.addEventListener('change', vinkChecklist);
    addEventListener('resize', function () { if (!doelEl) { var r = rustPlek(); vlieg(r.x, r.y, true); } });
  }
  function weg() {
    cancelAnimationFrame(loop);
    [orbEl, spot, straal, dok].forEach(function (e) { if (e) e.remove(); });
    orbEl = spot = straal = dok = doelEl = null; pos = null;
    document.body.classList.remove('dagmodus');
  }
  function rustPlek() {
    var zij = innerWidth > 960 ? 252 : 0, dokH = dok ? dok.offsetHeight : 180;
    return { x: zij + (innerWidth - zij) / 2 - 28, y: innerHeight - dokH - 18 - 70 };
  }
  function zet(x, y) { pos = { x: x, y: y }; orbEl.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)'; }

  // Vlucht in een boog, met een spoor van vonkjes
  function vlieg(x, y, snel) {
    return new Promise(function (klaar) {
      if (!pos) { zet(x, y); return klaar(); }
      var a = pos, d = Math.hypot(x - a.x, y - a.y);
      if (d < 4) return klaar();
      var mx = (a.x + x) / 2, my = (a.y + y) / 2, nx = -(y - a.y) / (d || 1), ny = (x - a.x) / (d || 1), boog = Math.min(140, d * 0.25) * (x > a.x ? -1 : 1);
      var duur = snel ? 350 : Math.min(1100, 450 + d * 0.6);
      orbEl.classList.add('vliegt');
      var anim = orbEl.animate([
        { transform: 'translate3d(' + a.x + 'px,' + a.y + 'px,0) scale(1)' },
        { transform: 'translate3d(' + (mx + nx * boog) + 'px,' + (my + ny * boog) + 'px,0) scale(.82)', offset: .5 },
        { transform: 'translate3d(' + x + 'px,' + y + 'px,0) scale(1)' }
      ], { duration: duur, easing: 'cubic-bezier(.65,0,.25,1)' });
      var t0 = performance.now(), spoor = setInterval(function () {
        var r = orbEl.getBoundingClientRect(), s = document.createElement('i'); s.className = 'gids-spoor';
        s.style.left = (r.left + r.width / 2) + 'px'; s.style.top = (r.top + r.height / 2) + 'px'; document.body.appendChild(s); setTimeout(function () { s.remove(); }, 700);
        if (performance.now() - t0 > duur) clearInterval(spoor);
      }, 28);
      anim.onfinish = function () { zet(x, y); orbEl.classList.remove('vliegt'); clearInterval(spoor); klaar(); };
    });
  }
  function ring() {
    var r = orbEl.getBoundingClientRect(), g = document.createElement('i'); g.className = 'gids-ring';
    g.style.left = r.left + 'px'; g.style.top = r.top + 'px'; g.style.width = r.width + 'px'; g.style.height = r.height + 'px';
    document.body.appendChild(g); setTimeout(function () { g.remove(); }, 950);
    orbEl.classList.remove('knal'); void orbEl.offsetWidth; orbEl.classList.add('knal');
  }
  function vonken(n) {
    var r = orbEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (var i = 0; i < (n || 18); i++) (function () {
      var v = document.createElement('i'); v.className = 'gids-vonk'; v.style.left = cx + 'px'; v.style.top = cy + 'px'; document.body.appendChild(v);
      var h = Math.random() * Math.PI * 2, afst = 50 + Math.random() * 90;
      v.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: 'translate(' + Math.cos(h) * afst + 'px,' + Math.sin(h) * afst + 'px) scale(.2)', opacity: 0 }], { duration: 700 + Math.random() * 400, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = function () { v.remove(); };
    })();
  }

  // ---------- Volgen van het doel (scrollen, vergroten) ----------
  function volg() {
    cancelAnimationFrame(loop);
    (function stap() {
      if (!spot) return;
      if (doelEl && doelEl.isConnected) {
        var r = doelEl.getBoundingClientRect(), p = 8;
        spot.style.left = (r.left - p) + 'px'; spot.style.top = (r.top - p) + 'px'; spot.style.width = (r.width + p * 2) + 'px'; spot.style.height = (r.height + p * 2) + 'px';
        spot.classList.add('zicht'); spot.classList.toggle('nav', !!doelEl.closest('.zij'));
        var o = orbEl.getBoundingClientRect(), ox = o.left + o.width / 2, oy = o.top + o.height / 2;
        var tx = Math.max(r.left, Math.min(ox, r.right)), ty = Math.max(r.top, Math.min(oy, r.bottom));
        if (ox >= r.left && ox <= r.right && oy >= r.top && oy <= r.bottom) { tx = r.left; ty = r.top; }
        var mx = (ox + tx) / 2 + (oy - ty) * .15, my = (oy + ty) / 2 - (ox - tx) * .15;
        straal.querySelector('path').setAttribute('d', 'M' + ox + ',' + oy + ' Q' + mx + ',' + my + ' ' + tx + ',' + ty);
        var c = straal.querySelector('circle'); c.setAttribute('cx', tx); c.setAttribute('cy', ty);
        straal.style.opacity = orbEl.classList.contains('vliegt') ? 0 : 1;
      } else {
        spot.classList.remove('zicht'); straal.style.opacity = 0;
      }
      loop = requestAnimationFrame(stap);
    })();
  }
  function plekBij(el) {
    var r = el.getBoundingClientRect(), m = 56, gap = 18, dokTop = dok.getBoundingClientRect().top;
    var x = r.right + gap, y = r.top + Math.min(r.height / 2, 60) - m / 2;
    if (x + m > innerWidth - 10) { x = r.left - gap - m; }
    if (x < (innerWidth > 960 ? 262 : 8)) { x = Math.min(innerWidth - m - 10, Math.max(r.left, r.right - m)); y = r.top - m - gap; if (y < 70) y = r.bottom + gap; }
    y = Math.max(70, Math.min(y, dokTop - m - 10));
    return { x: x, y: y };
  }
  function wachtOp(sel, ms) {
    return new Promise(function (ok) {
      if (!sel) return ok(null);
      var t0 = Date.now();
      (function kijk() {
        var el = null; try { el = sel && document.querySelector(sel); } catch (e) {}
        if (el && el.offsetParent !== null && el.getBoundingClientRect().height > 0) return ok(el);
        if (Date.now() - t0 > ms) return ok(null);
        setTimeout(kijk, 120);
      })();
    });
  }

  // ---------- Missies ----------
  function opPagina(url) {
    if (!url) return false;
    var u = new URL(url, location.origin), hier = new URLSearchParams(location.search);
    if (u.pathname.replace(/index\.html$/, '') !== location.pathname.replace(/index\.html$/, '')) return false;
    var id = u.searchParams.get('id'); if (id && hier.get('id') !== id) return false;
    var st = u.searchParams.get('status'); if (st && hier.get('status') !== st) return false;
    return true;
  }
  function paginaNaam(m) {
    if (!m.url) return '';
    if (/klant\.html/.test(m.url)) return 'de klantpagina van ' + (m.klant ? m.klant.naam : 'de klant');
    if (/status=prospect/.test(m.url)) return 'je leads';
    if (/klanten\.html/.test(m.url)) return 'de klantenlijst';
    if (/kwartaal/.test(m.url)) return 'het kwartaalbord';
    if (/inzichten/.test(m.url)) return 'Contact en NPS';
    if (m.url === '/intern/') return 'Vandaag';
    return 'de juiste pagina';
  }
  function navVoor(url) {
    var pad = new URL(url, location.origin).pathname;
    if (/klant\.html/.test(pad)) pad = '/intern/klanten.html';
    return document.querySelector('.zij a.zn[href="' + pad + '"]');
  }

  function laad() { return AE.api('/intern/api/dagplan').then(function (p) { plan = p; return p; }); }
  function sla() { return (lees() || {}).sla || []; }
  function kies(voorkeur) {
    var overgeslagen = sla();
    var lijst = plan.missies.filter(function (m) { return overgeslagen.indexOf(m.id) < 0; });
    if (!lijst.length && overgeslagen.length) { var st = lees() || {}; st.sla = []; schrijf(st); lijst = plan.missies; }
    return lijst.filter(function (m) { return m.id === voorkeur; })[0] || lijst[0] || null;
  }

  function toon(m, opt) {
    opt = opt || {};
    huidig = m; doelEl = null; terugIdx = 0;
    var s = lees() || {}; s.aan = true; s.huidig = m ? m.id : null;
    s.hist = s.hist || [];
    if (m && !opt.terug && s.hist[s.hist.length - 1] !== m.id) { s.hist.push(m.id); s.hist = s.hist.slice(-60); }
    schrijf(s);
    tekenDok(m, opt);
    if (!m) { var r = rustPlek(); vlieg(r.x, r.y).then(function () { ring(); vonken(28); }); return; }
    if (m.url && !m.extern && !opPagina(m.url)) {
      var nav = navVoor(m.url), doel = nav && innerWidth > 960 ? nav.getBoundingClientRect() : null;
      if (doel) { doelEl = nav; vlieg(doel.right + 14, doel.top + doel.height / 2 - 28); }
      else { var rp = rustPlek(); vlieg(rp.x, rp.y); }
      if (opt.door) { var ga = dok.querySelector('.ga'); if (ga) { ga.classList.add('telt'); ga._t = setTimeout(function () { reis(m.url); }, 1600); } }
      return;
    }
    if (m.doel) document.dispatchEvent(new CustomEvent('ae:toon', { detail: m.doel }));
    wachtOp(m.doel, 3500).then(function (el) {
      if (huidig !== m) return;
      if (!el) { var r = rustPlek(); return vlieg(r.x, r.y); }
      var r0 = el.getBoundingClientRect(), dokTop = dok.getBoundingClientRect().top;
      if (r0.top < 80 || r0.bottom > dokTop - 20) el.scrollIntoView({ behavior: 'smooth', block: r0.height > dokTop - 120 ? 'start' : 'center' });
      setTimeout(function () {
        if (huidig !== m) return;
        doelEl = el; var p = plekBij(el);
        vlieg(p.x, p.y).then(ring);
      }, 480);
    });
  }

  function tekenDok(m, opt) {
    var totaal = plan.klaarVandaag + plan.missies.length, nr = plan.klaarVandaag + 1;
    var seg = '';
    for (var i = 0; i < Math.min(totaal, 24); i++) seg += '<i class="' + (i < plan.klaarVandaag ? 'k' : i === plan.klaarVandaag && m ? 'n' : '') + '"></i>';
    var min = plan.minuten, tijd = min >= 60 ? Math.floor(min / 60) + 'u' + (min % 60 ? String(min % 60).padStart(2, '0') : '') : min + ' min';
    var boven = '<div class="gd-boven"><div class="gd-seg">' + seg + '</div><span class="gd-teller">' + (m ? 'Missie ' + nr + ' van ' + totaal + ', nog ±' + tijd : totaal + ' van ' + totaal + ' klaar') + '</span>' +
      '<button class="gd-knop" type="button" data-g="vorige" title="Vorige missie" aria-label="Vorige missie"' + (kanTerug() ? '' : ' disabled') + '>‹</button>' +
      '<button class="gd-knop" type="button" data-g="opnieuw" title="Dag opnieuw beginnen" aria-label="Dag opnieuw beginnen">↺</button>' +
      '<button class="gd-knop" type="button" data-g="klein" title="In- of uitklappen" aria-label="In- of uitklappen">–</button><button class="gd-knop" type="button" data-g="stop" title="Dagmodus stoppen" aria-label="Dagmodus stoppen">&times;</button></div>';
    var inhoud;
    if (!m) {
      inhoud = '<div class="gd-inhoud gd-klaar"><div class="gd-tag" style="justify-content:center">Dag rond</div><h3>Alles gedaan voor vandaag.</h3><p>' + plan.klaarVandaag + ' missies afgerond' + (plan.doorgeschoven ? ', ' + plan.doorgeschoven + ' maandverwerkingen schuiven door naar morgen' : '') + '. Lekker gewerkt.</p>' + gedaanLijst() + '<div class="gd-acties" style="justify-content:center"><button type="button" data-g="opnieuw">Begin opnieuw</button><button type="button" class="klaar" style="margin:0" data-g="stop">Dagmodus afsluiten</button></div></div>';
    } else {
      var k = m.klant, acties = [];
      var opDezePagina = !m.url || m.extern || opPagina(m.url);
      if (!opDezePagina) acties.push('<button type="button" class="ga" data-g="ga">Breng me naar ' + esc(paginaNaam(m)) + '<i></i></button>');
      if (m.extern && m.url) acties.push('<a href="' + esc(m.url) + '" target="_blank" rel="noopener">Openen</a>');
      (m.acties || []).forEach(function (a) {
        if (a === 'bel' && k && k.telefoon) acties.push('<a href="tel:' + esc(telefoon(k.telefoon)) + '">Bellen</a>');
        if (a === 'app' && k && k.telefoon) acties.push('<a href="https://wa.me/' + esc(wa(k.telefoon)) + '" target="_blank" rel="noopener">WhatsApp</a>');
        if (a === 'web' && k) acties.push('<a href="https://www.google.com/search?q=' + encodeURIComponent((k.naam || '') + ' ' + (k.contact || '')) + '" target="_blank" rel="noopener">Googelen</a>');
        if (a === 'contact') acties.push('<button type="button" data-contact="' + esc(k ? k.id : '') + '">Contact vastleggen</button>');
      });
      acties.push('<button type="button" data-g="agent">Vraag de agent</button>');
      acties.push('<button type="button" class="stil" data-g="later" title="Zet deze missie op morgen">Morgen</button>');
      acties.push('<button type="button" class="stil" data-g="sla">Overslaan</button>');
      acties.push('<button type="button" class="klaar" data-g="klaar">' + (m.soort === 'checklist' ? 'Alles klaar' : 'Klaar') + '</button>');
      inhoud = '<div class="gd-inhoud"><div class="gd-tag"><span>' + esc(m.proces.titel) + '</span>' + (m.stap ? '<span>Stap ' + m.stap.nr + ' van ' + m.stap.totaal + '</span>' : '') + (k ? '<b>' + esc(k.naam) + '</b>' : '') + '</div>' +
        '<div class="gd-titel">' + esc(m.titel) + '</div><p class="gd-uitleg">' + esc(m.uitleg) + '</p>' +
        (m.checklist ? '<ul class="gd-check">' + m.checklist.map(function (c) { return '<li><label><input type="checkbox" data-i="' + c.i + '"' + (c.klaar ? ' checked' : '') + '><span>' + esc(c.t) + '<small>' + esc(c.u) + '</small></span></label></li>'; }).join('') + '</ul>' : '') +
        '<div class="gd-acties">' + acties.join('') + '</div></div>';
    }
    dok.innerHTML = boven + inhoud;
    dok.classList.toggle('klein', !!(lees() || {}).klein);
    requestAnimationFrame(function () { dok.classList.remove('weg'); });
  }

  var terugIdx = 0;
  function kanTerug() { var h = (lees() || {}).hist || []; return h.length > 1 || (plan && plan.gedaan && plan.gedaan.length > 0); }
  function tijdVan(iso) { return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }); }
  function gedaanLijst() {
    var g = (plan.gedaan || []).slice(-8).reverse();
    if (!g.length) return '';
    return '<ul class="gd-gedaan">' + g.map(function (x) { return '<li><span><b>' + esc(x.titel) + '</b><small>' + esc(x.proces) + (x.klant ? ', ' + esc(x.klant.naam) : '') + ', ' + tijdVan(x.op) + '</small></span><button type="button" data-g="terugzetten" data-id="' + esc(x.id) + '">Terugzetten</button></li>'; }).join('') + '</ul>';
  }
  function toonGedaan(g) {
    huidig = null; doelEl = null;
    var r = rustPlek(); vlieg(r.x, r.y);
    tekenDok(null);
    dok.querySelector('.gd-teller').textContent = 'Terugblik, nog ' + plan.missies.length + ' open';
    dok.innerHTML = dok.querySelector('.gd-boven').outerHTML + '<div class="gd-inhoud"><div class="gd-tag"><span>Al gedaan vandaag, ' + tijdVan(g.op) + '</span><span>' + esc(g.proces) + '</span>' + (g.klant ? '<b>' + esc(g.klant.naam) + '</b>' : '') + '</div>' +
      '<div class="gd-titel">' + esc(g.titel) + '</div><p class="gd-uitleg">Per ongeluk afgevinkt, of wil je het toch nog doen? Zet hem terug, dan komt hij weer in je dagplan.</p>' +
      '<div class="gd-acties"><button type="button" data-g="terugzetten" data-id="' + esc(g.id) + '" data-open="1">Toch niet klaar, terugzetten</button><button type="button" class="klaar" data-g="verder">Verder</button></div></div>';
    dok._gedaan = g;
  }
  function vorige() {
    var s = lees() || {}, h = s.hist || [];
    // huidige van de stapel af en de vorige pakken die nog bestaat
    if (huidig && h[h.length - 1] === huidig.id) h.pop();
    while (h.length) {
      var id = h.pop();
      var open = plan.missies.filter(function (m) { return m.id === id; })[0];
      if (open) { s.hist = h; schrijf(s); return toon(open, { terug: true }); }
      var klaar = (plan.gedaan || []).filter(function (g) { return g.id === id; })[0];
      if (klaar) { s.hist = h; schrijf(s); return toonGedaan(klaar); }
    }
    s.hist = h; schrijf(s);
    var g = (plan.gedaan || []).slice().reverse();
    if (dok._gedaan) terugIdx = g.indexOf(g.filter(function (x) { return x.id === dok._gedaan.id; })[0]) + 1;
    if (g[terugIdx]) return toonGedaan(g[terugIdx]);
    AE.meld('Je bent bij het begin van je dag');
  }
  function zetTerug(id, open) {
    return AE.api('/intern/api/dagplan', { method: 'POST', body: JSON.stringify({ missie: id, actie: 'terug' }) }).then(function (p) {
      plan = p; document.dispatchEvent(new CustomEvent('ae:dagplan', { detail: p }));
      var m = p.missies.filter(function (x) { return x.id === id; })[0];
      AE.meld('Teruggezet' + (m ? ': ' + m.titel : ''));
      if (open && m) toon(m); else toon(kies());
    });
  }

  function reis(url) {
    var r = orbEl.getBoundingClientRect(), w = document.createElement('div'); w.className = 'gids-warp';
    w.style.setProperty('--x', (r.left + r.width / 2) + 'px'); w.style.setProperty('--y', (r.top + r.height / 2) + 'px');
    w.innerHTML = AE.agent.orb(); document.body.appendChild(w);
    sess('ae-warp', '1');
    requestAnimationFrame(function () { w.classList.add('vol'); });
    setTimeout(function () { location.href = url; }, 560);
  }
  function aankomst() {
    if (!sess('ae-warp')) return;
    var w = document.createElement('div'); w.className = 'gids-warp vol'; w.style.setProperty('--x', '50%'); w.style.setProperty('--y', '50%');
    w.innerHTML = AE.agent.orb(); document.body.appendChild(w);
    setTimeout(function () { w.classList.remove('vol'); }, 60);
    setTimeout(function () { w.remove(); }, 800);
  }

  function klikDok(e) {
    var b = e.target.closest('[data-g]'); if (!b) return;
    var g = b.dataset.g, m = huidig;
    var ga = dok.querySelector('.ga'); if (ga && ga._t && g !== 'ga') { clearTimeout(ga._t); ga.classList.remove('telt'); }
    if (g === 'stop') return stop();
    if (g === 'klein') { var s = lees() || {}; s.klein = !s.klein; schrijf(s); dok.classList.toggle('klein', s.klein); return; }
    if (g === 'vorige') return vorige();
    if (g === 'verder') { dok._gedaan = null; return toon(kies()); }
    if (g === 'terugzetten') { b.disabled = true; dok._gedaan = null; return zetTerug(b.dataset.id, !!b.dataset.open); }
    if (g === 'opnieuw') {
      var inh = dok.querySelector('.gd-inhoud');
      inh.innerHTML = '<div class="gd-tag">Dag opnieuw beginnen</div><div class="gd-titel">Waar wil je opnieuw beginnen?</div><p class="gd-uitleg">Opnieuw starten brengt je terug naar de eerste missie, ook overgeslagen missies komen weer mee. Je kunt ook alles wat je vandaag hebt afgevinkt terugzetten.</p>' +
        '<div class="gd-acties"><button type="button" data-g="annuleer">Annuleren</button>' + ((plan.gedaan || []).length ? '<button type="button" data-g="opnieuw-alles">Ook afgevinkte terugzetten (' + plan.gedaan.length + ')</button>' : '') + '<button type="button" class="klaar" data-g="opnieuw-start">Vanaf de eerste missie</button></div>';
      return;
    }
    if (g === 'annuleer') { dok._gedaan = null; return huidig ? tekenDok(huidig, {}) : toon(kies()); }
    if (g === 'opnieuw-start' || g === 'opnieuw-alles') {
      var st = lees() || {}; st.sla = []; st.hist = []; schrijf(st); dok._gedaan = null;
      var ids = g === 'opnieuw-alles' ? (plan.gedaan || []).map(function (x) { return x.id; }).reverse() : [];
      b.disabled = true;
      return ids.reduce(function (pr, id) { return pr.then(function () { return AE.api('/intern/api/dagplan', { method: 'POST', body: JSON.stringify({ missie: id, actie: 'terug' }) }); }); }, Promise.resolve())
        .then(laad).then(function (p) {
          document.dispatchEvent(new CustomEvent('ae:dagplan', { detail: p }));
          AE.meld(ids.length ? 'Dag opnieuw gestart, ' + ids.length + ' missies teruggezet' : 'Terug naar de eerste missie');
          ring(); vonken(14); toon(kies());
        });
    }
    if (!m) return;
    if (g === 'ga') return reis(m.url);
    if (g === 'agent') return AE.agent.open((m.vraag || 'Help me met de missie "' + m.titel + '" (' + m.proces.titel + ').') + (m.klant ? ' Het gaat om ' + m.klant.naam + '.' : ''));
    if (g === 'sla') { var ss = lees() || {}; ss.sla = (ss.sla || []).concat(m.id); schrijf(ss); return toon(kies()); }
    if (g === 'klaar' || g === 'later') {
      b.disabled = true;
      if (g === 'klaar') { ring(); vonken(); }
      AE.api('/intern/api/dagplan', { method: 'POST', body: JSON.stringify({ missie: m.id, actie: g }) }).then(function (p) {
        plan = p; AE.meld(g === 'klaar' ? 'Missie klaar: ' + m.titel : 'Staat op morgen: ' + m.titel);
        document.dispatchEvent(new CustomEvent('ae:dagplan', { detail: p }));
        dok.classList.add('weg');
        setTimeout(function () { toon(kies(), { door: true }); }, 380);
      }).catch(function (err) { b.disabled = false; AE.meld(err.message); });
    }
  }
  function vinkChecklist(e) {
    var i = e.target.closest('[data-i]'); if (!i || !huidig) return;
    var id = huidig.id.replace(/:\*$/, ':' + i.dataset.i);
    if (!i.checked) return; // uitvinken via de werkstromenpagina
    AE.api('/intern/api/dagplan', { method: 'POST', body: JSON.stringify({ missie: id }) }).then(function (p) {
      plan = p;
      var nog = p.missies.filter(function (m) { return m.id === huidig.id; })[0];
      if (!nog) { ring(); vonken(); dok.classList.add('weg'); setTimeout(function () { toon(kies(), { door: true }); }, 380); }
      else huidig = nog;
    });
  }

  // ---------- Starten en stoppen ----------
  function start(missieId) {
    bouw(); var s = lees() || {}; s.aan = true; schrijf(s);
    return laad().then(function () { toon(kies(missieId || s.huidig)); volg(); });
  }
  function stop() { schrijf(null); weg(); AE.meld('Dagmodus gestopt. Je kunt hem altijd weer starten op Vandaag.'); document.dispatchEvent(new CustomEvent('ae:dagmodus', { detail: false })); }

  // Als je zelf een klant afwerkt of een taak afvinkt elders op de pagina: plan verversen
  document.addEventListener('ae:contact', function () { if (orbEl) laad().then(function (p) { tekenDok(huidig && p.missies.filter(function (x) { return x.id === huidig.id; })[0] || kies(), {}); }); });
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-dagmodus]'); if (!b) return; e.preventDefault(); start(b.getAttribute('data-dagmodus') || ''); });

  AE.gids = { start: start, stop: stop, actief: function () { return !!(lees() || {}).aan; }, plan: function () { return laad(); } };
  aankomst();
  if ((lees() || {}).aan && !/agent\.html/.test(location.pathname)) start();
  document.dispatchEvent(new CustomEvent('ae:gids-klaar'));
})();
