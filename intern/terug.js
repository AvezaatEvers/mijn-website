// Terugknop voor interne pagina's zonder zijbalk (voorstel, handtekening, mailsjablonen)
(function () {
  var ref = '';
  try { var r = new URL(document.referrer); if (r.origin === location.origin && r.pathname.indexOf('/intern') === 0 && r.href !== location.href) ref = r.pathname + r.search + r.hash; } catch (e) {}
  var naar = ref || '/intern/';
  var label = /klant\.html/.test(ref) ? 'Terug naar klant' : /klanten\.html/.test(ref) ? 'Terug naar klanten' : /tools\.html/.test(ref) ? 'Terug naar tools' : 'Terug naar dashboard';
  var css = document.createElement('style');
  css.textContent = '.ae-terug{position:fixed;left:16px;top:16px;z-index:9999;display:inline-flex;align-items:center;gap:6px;font:600 13.5px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;color:#1D1D1F;text-decoration:none;padding:9px 14px 9px 10px;border-radius:999px;background:rgba(255,255,255,.82);-webkit-backdrop-filter:saturate(180%) blur(16px);backdrop-filter:saturate(180%) blur(16px);border:1px solid rgba(0,0,0,.08);box-shadow:0 6px 20px -10px rgba(0,0,0,.25);transition:transform .2s,background .2s}' +
    '.ae-terug:hover{background:#fff;transform:translateX(-2px)}.ae-terug svg{width:16px;height:16px}' +
    '@media (min-width:601px){body.met-terug{padding-top:52px}}@media print{.ae-terug{display:none}}@media (max-width:600px){.ae-terug{top:auto;bottom:16px}}';
  document.head.appendChild(css);
  var a = document.createElement('a'); a.className = 'ae-terug'; a.href = naar;
  a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>' + label;
  document.body.appendChild(a); document.body.classList.add('met-terug');
})();
