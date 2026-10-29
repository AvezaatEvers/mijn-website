// Opzijzet-calculator: hoeveel zet je van één factuur apart voor btw en inkomstenbelasting + Zvw.
// Gebruikt de berekening uit netto-calc.js (window.__nettoBereken).
(function () {
  var form = document.getElementById('oz-form');
  if (!form || !window.__nettoBereken) return;
  var jaar = new Date().getFullYear() >= 2027 ? 2027 : 2026;
  var fmt = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  function euro(n) { return fmt.format(Math.round(n)).replace(/\s/g, ' '); }
  function getal(id) {
    var v = document.getElementById(id).value.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    var n = parseFloat(v); return isFinite(n) && n > 0 ? n : 0;
  }
  function zet(id, t) { var el = document.getElementById(id); if (el) el.textContent = t; }

  function update() {
    var winst = getal('oz-winst'), factuur = getal('oz-factuur');
    var btwPct = parseFloat((form.querySelector('input[name="oz-btw"]:checked') || {}).value || '0.21');
    var uren = document.getElementById('oz-uren').checked;
    var r = window.__nettoBereken(jaar, winst, 0, uren, false);
    var pct = winst > 0 ? Math.ceil(r.reserveer * 100) : 0;
    var btw = factuur * btwPct;
    var belasting = factuur * pct / 100;
    zet('oz-big', euro(btw + belasting));
    zet('oz-sub', 'van een factuur van ' + euro(factuur + btw) + (btwPct ? ' (' + euro(factuur) + ' + ' + euro(btw) + ' btw)' : ''));
    zet('oz-btw-bedrag', euro(btw));
    zet('oz-pct', pct + '%');
    zet('oz-belasting', euro(belasting));
    zet('oz-zelf', euro(factuur - belasting));
    zet('oz-regel', btwPct ? 'de btw plus ' + pct + '%' : pct + '%');
    zet('oz-jaar', euro(r.teBetalen + r.zvw));
    zet('oz-jaartal', jaar);
  }
  form.querySelectorAll('.nc-money input').forEach(function (inp) {
    inp.addEventListener('blur', function () { var n = getal(inp.id); inp.value = n ? new Intl.NumberFormat('nl-NL').format(Math.round(n)) : '0'; });
  });
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  update();
})();
