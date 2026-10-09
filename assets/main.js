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
