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
      var x = slider.scrollLeft, best = 0, bestD = Infinity;
      slides.forEach(function (s, i) {
        var d = Math.abs(s.offsetLeft - slider.offsetLeft - 24 - x);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (x + slider.clientWidth >= slider.scrollWidth - 4) best = slides.length - 1;
      dots.querySelectorAll('button').forEach(function (b, i) { b.classList.toggle('active', i === best); });
    }
    slider.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
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

// Contactpagina: groen bolletje als we nu bereikbaar zijn (Nederlandse tijd)
(function () {
  var els = document.querySelectorAll('.cc-tijd');
  if (!els.length) return;
  var nu = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
  var dag = nu.getDay() || 7, uur = nu.getHours() + nu.getMinutes() / 60;
  els.forEach(function (el) {
    var d = (el.getAttribute('data-dagen') || '1-7').split('-').map(Number);
    var van = +(el.getAttribute('data-van') || 0), tot = +(el.getAttribute('data-tot') || 24);
    var open = dag >= d[0] && dag <= d[1] && uur >= van && uur < tot;
    el.classList.toggle('is-open', open);
    el.setAttribute('title', open ? 'Nu bereikbaar' : 'Op dit moment buiten onze bereikbaarheid');
  });
})();
