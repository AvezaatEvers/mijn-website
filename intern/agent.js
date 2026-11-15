// Orb-intro bij openen van het dashboard.
// De chat-agent is weggehaald: vragen stel je nu in Claude via de koppeling (/intern/claude.html).
(function () {
  var AE = window.AE; if (!AE) return;
  var pad = location.pathname.replace(/index\.html$/, '');
  function orb(kl) { return '<div class="orb ' + (kl || '') + '"><i></i><i></i><i></i></div>'; }
  // ---------- Intro bij openen ----------
  function intro() {
    var gezien = false; try { gezien = sessionStorage.getItem('ae-intro') === '1'; sessionStorage.setItem('ae-intro', '1'); } catch (e) {}
    if (gezien || pad !== '/intern/' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var vanLogin = false; try { vanLogin = sessionStorage.getItem('ae-van-login') === '1'; sessionStorage.removeItem('ae-van-login'); } catch (e) {}
    var el = document.createElement('div'); el.className = 'intro' + (vanLogin ? ' van-login' : ''); el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Welkom');
    el.innerHTML = '<canvas aria-hidden="true"></canvas><div class="intro-in"><div class="intro-label">Avezaat &amp; Evers, intern</div>' + orb() +
      '<h1><span id="in-groet"></span><span class="cursor"></span></h1><div class="intro-regels" id="in-regels"></div>' +
      '<div class="intro-knoppen" id="in-knoppen"><button type="button" class="hoofd" data-in="weg">Naar mijn dag</button></div></div><div class="intro-skip">Klik of druk op Esc om over te slaan</div>';
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

  AE.agent = { orb: orb, open: function () {}, sluit: function () {} };
  document.dispatchEvent(new CustomEvent('ae:agent-klaar'));
  intro();
})();
