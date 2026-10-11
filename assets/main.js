// Mobiel menu open/dicht
(function () {
  var btn = document.querySelector('.menu-toggle');
  var nav = document.getElementById('nav-links');
  if (!btn || !nav) return;
  btn.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  nav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') {
      nav.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
})();

// Pakket vooraf selecteren via ?pakket=starter|compleet|plus
(function () {
  var sel = document.getElementById('pakket');
  if (!sel) return;
  var m = /[?&]pakket=([a-z-]+)/.exec(window.location.search);
  if (m && sel.querySelector('option[value="' + m[1] + '"]')) sel.value = m[1];
})();

// Jaartal in footer
(function () {
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();

// Afvinkbare checklists, onthouden op dit apparaat
(function () {
  var boxes = document.querySelectorAll('.checklist input[type="checkbox"][data-key]');
  if (!boxes.length) return;
  var store = {};
  try { store = JSON.parse(localStorage.getItem('ae-checklist') || '{}'); } catch (e) { store = {}; }
  boxes.forEach(function (b) {
    if (store[b.dataset.key]) b.checked = true;
    b.addEventListener('change', function () {
      store[b.dataset.key] = b.checked;
      try { localStorage.setItem('ae-checklist', JSON.stringify(store)); } catch (e) {}
    });
  });
})();

// Stippen onder mobiele sliders (laat zien dat er meer is en waar je bent)
(function () {
  var mq = window.matchMedia('(max-width: 700px)');
  document.querySelectorAll('.m-slider').forEach(function (slider) {
    var slides = Array.prototype.slice.call(slider.children);
    if (slides.length < 2) return;
    var dots = document.createElement('div');
    dots.className = 'slider-dots';
    slides.forEach(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Ga naar ' + (i + 1) + ' van ' + slides.length);
      b.addEventListener('click', function () {
        slider.scrollTo({ left: s.offsetLeft - slider.offsetLeft - 24, behavior: 'smooth' });
      });
      dots.appendChild(b);
    });
    slider.parentNode.insertBefore(dots, slider.nextSibling);
    function update() {
      if (!mq.matches) return;
      // Welke kaart staat het dichtst bij de linkerrand van de slider (waar hij op uitlijnt)?
      var basis = slider.getBoundingClientRect().left + (parseFloat(getComputedStyle(slider).paddingLeft) || 0);
      var best = 0, bestD = Infinity;
      slides.forEach(function (s, i) {
        var d = Math.abs(s.getBoundingClientRect().left - basis);
        if (d < bestD) { bestD = d; best = i; }
      });
      // Helemaal naar rechts gescrold (en er valt echt iets te scrollen)? Dan is de laatste actief.
      var max = slider.scrollWidth - slider.clientWidth;
      if (max > 8 && slider.scrollLeft >= max - 4) best = slides.length - 1;
      dots.querySelectorAll('button').forEach(function (b, i) { b.classList.toggle('active', i === best); });
    }
    slider.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', update);
    window.addEventListener('load', update);
    update();
  });
})();

// Animatie bij in beeld komen (MoneyMonk-badge)
(function () {
  var el = document.querySelector('.app-section');
  if (!el || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('js-anim');
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { el.classList.add('in-view'); io.disconnect(); } });
  }, { threshold: 0.35 });
  io.observe(el);
})();

// Vloeiend open- en dichtklappen van FAQ-vragen
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.addEventListener('click', function (e) {
    var summary = e.target.closest('.faq summary');
    if (!summary || reduce.matches || !summary.parentElement.animate) return;
    var d = summary.parentElement;
    if (d.classList.contains('is-animating')) { e.preventDefault(); return; }
    e.preventDefault();
    var content = Array.prototype.slice.call(d.children).filter(function (c) { return c !== summary; });
    var start = d.offsetHeight, end;
    d.classList.add('is-animating');
    if (!d.open) {
      d.open = true;
      end = d.offsetHeight;
      content.forEach(function (c) { c.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'ease-out' }); });
    } else {
      d.open = false;
      end = d.offsetHeight;
      d.open = true;
      content.forEach(function (c) { c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-in', fill: 'forwards' }); });
    }
    var closing = end < start;
    var anim = d.animate([{ height: start + 'px' }, { height: end + 'px' }], { duration: 320, easing: 'cubic-bezier(.4,0,.2,1)' });
    if (closing) d.open = true;
    anim.onfinish = function () {
      if (closing) {
        d.open = false;
        content.forEach(function (c) { c.getAnimations().forEach(function (a) { a.cancel(); }); });
      }
      d.classList.remove('is-animating');
    };
  });
})();

// Zo werkt het: actieve stap volgen tijdens scrollen (alleen desktop)
(function () {
  var wrap = document.querySelector('.werk-grid .steps');
  if (!wrap) return;
  var mq = window.matchMedia('(min-width: 901px)');
  var stappen = Array.prototype.slice.call(wrap.children);
  document.documentElement.classList.add('js-werk');
  function zetActief(i) {
    stappen.forEach(function (s, k) {
      s.classList.toggle('is-actief', k === i);
      s.classList.toggle('is-gedaan', k < i);
    });
    var doel = stappen[i];
    var lijn = doel.offsetTop - stappen[0].offsetTop;
    wrap.style.setProperty('--werk-voortgang', lijn + 'px');
    wrap.style.setProperty('--werk-totaal', (stappen[stappen.length - 1].offsetTop - stappen[0].offsetTop) + 'px');
  }
  zetActief(0);
  // Een stap wordt actief zodra de bovenkant ervan op ~60% van het scherm komt
  var huidig = 0, gepland = false;
  function check() {
    gepland = false;
    if (!mq.matches) return;
    var lijn = window.innerHeight * 0.6, actief = 0;
    stappen.forEach(function (s, i) { if (s.getBoundingClientRect().top < lijn) actief = i; });
    if (actief !== huidig) { huidig = actief; zetActief(actief); }
  }
  window.addEventListener('scroll', function () { if (!gepland) { gepland = true; requestAnimationFrame(check); } }, { passive: true });
  window.addEventListener('resize', check);
  check();
})();

// Contactpagina: groen bolletje als we nu bereikbaar zijn (Nederlandse tijd),
// anders een korte melding wanneer we weer bereikbaar zijn
(function () {
  var els = document.querySelectorAll('.cc-tijd');
  if (!els.length) return;
  var DAGEN = ['', 'ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
  var nu = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
  var dag = nu.getDay() || 7, uur = nu.getHours() + nu.getMinutes() / 60;
  function tijd(u) { return (u < 10 ? '0' : '') + u + ':00'; }
  els.forEach(function (el) {
    var d = (el.getAttribute('data-dagen') || '1-7').split('-').map(Number);
    var van = +(el.getAttribute('data-van') || 0), tot = +(el.getAttribute('data-tot') || 24);
    var werkdag = function (x) { return x >= d[0] && x <= d[1]; };
    var open = werkdag(dag) && uur >= van && uur < tot;
    var tekst;
    if (open) tekst = 'Nu bereikbaar';
    else if (werkdag(dag) && uur < van) tekst = 'Weer bereikbaar: ' + tijd(van);
    else {
      for (var i = 1; i <= 7; i++) {
        var x = ((dag - 1 + i) % 7) + 1;
        if (werkdag(x)) { tekst = 'Weer bereikbaar: ' + DAGEN[x] + ' ' + tijd(van); break; }
      }
    }
    el.classList.toggle('is-open', open);
    var s = el.querySelector('.cc-status') || el.appendChild(document.createElement('span'));
    s.className = 'cc-status';
    s.textContent = tekst;
  });
})();

// Elementen zacht laten verschijnen bij scrollen (class "rv"); tellers in [data-tel] laten oplopen
(function () {
  var els = document.querySelectorAll('.rv');
  if (!els.length || !('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.documentElement.classList.add('js-rv');
  function tel(el) {
    el.querySelectorAll('[data-tel]').forEach(function (n) {
      var doel = +n.getAttribute('data-tel'); if (!doel) return;
      var start = performance.now();
      (function stap(t) { var p = Math.min(1, (t - start) / 1200); n.textContent = Math.round(doel * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(stap); })(start);
    });
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); tel(e.target); io.unobserve(e.target); } });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  els.forEach(function (el) { io.observe(el); });
  // Vangnet: na 4 seconden alles tonen wat nog verborgen is
  setTimeout(function () { els.forEach(function (el) { el.classList.add('is-in'); }); }, 4000);
})();
