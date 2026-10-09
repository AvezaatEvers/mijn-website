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
