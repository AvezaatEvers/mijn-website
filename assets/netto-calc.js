// Netto-inkomen calculator voor zzp'ers (eenmanszaak, jonger dan AOW-leeftijd).
// Tarieven: 2026 definitief, 2027 voorlopig (Belastingplan 2027, Prinsjesdag 2026).
// Jaarlijks bijwerken: alleen het object JAREN aanpassen.
(function () {
  var form = document.getElementById('nc-form');
  if (!form) return;

  var JAREN = {
    2026: {
      schijven: [[38883, 0.3575], [78426, 0.3756], [Infinity, 0.495]],
      ahk: { max: 3115, start: 29736, pct: 0.06398 },
      ak: [[11965, 0, 0.08324, 0], [25845, 996, 0.31009, 11965], [45592, 5300, 0.0195, 25845]],
      akMax: 5685, akAfStart: 45592, akAfPct: 0.0651,
      za: 1200, sa: 2123, mkb: 0.127,
      zvw: { pct: 0.0485, max: 79409 }
    },
    2027: {
      schijven: [[39247, 0.3623], [78426, 0.3816], [Infinity, 0.495]],
      ahk: { max: 3154, start: 30910, pct: 0.06638 },
      ak: [[12438, 0, 0.09503, 0], [26866, 1182, 0.30205, 12438], [47834, 5540, 0.01855, 26866]],
      akMax: 5929, akAfStart: 47834, akAfPct: 0.0651,
      za: 900, sa: 10, mkb: 0.127,
      zvw: { pct: 0.0502, max: 82547 }
    }
  };

  function inkomstenbelasting(t, inkomen) {
    var rest = inkomen, onder = 0, totaal = 0;
    t.schijven.forEach(function (s) {
      var deel = Math.max(0, Math.min(rest, s[0] - onder));
      totaal += deel * s[1]; rest -= deel; onder = s[0];
    });
    return totaal;
  }
  function algemeneHeffingskorting(t, inkomen) {
    var k = t.ahk.max - Math.max(0, inkomen - t.ahk.start) * t.ahk.pct;
    return Math.max(0, k);
  }
  function arbeidskorting(t, arbeid) {
    if (arbeid <= 0) return 0;
    for (var i = 0; i < t.ak.length; i++) {
      var b = t.ak[i];
      if (arbeid <= b[0]) return b[1] + (arbeid - b[3]) * b[2];
    }
    return Math.max(0, t.akMax - (arbeid - t.akAfStart) * t.akAfPct);
  }

  function bereken(jaar, omzet, kosten, uren, starter) {
    var t = JAREN[jaar];
    var winst = omzet - kosten;
    var za = 0, sa = 0;
    if (uren && winst > 0) {
      za = Math.min(t.za, winst);
      if (starter) sa = Math.min(t.sa, winst - za);
    }
    var naAftrek = Math.max(0, winst - za - sa);
    var mkb = naAftrek * t.mkb;
    var belastbaar = Math.max(0, naAftrek - mkb);
    var ib = inkomstenbelasting(t, belastbaar);
    var kortingen = Math.min(ib, algemeneHeffingskorting(t, belastbaar) + arbeidskorting(t, belastbaar));
    var teBetalen = ib - kortingen;
    var zvw = Math.min(belastbaar, t.zvw.max) * t.zvw.pct;
    var netto = winst - teBetalen - zvw;
    return {
      winst: winst, za: za, sa: sa, mkb: mkb, belastbaar: belastbaar,
      ib: ib, kortingen: kortingen, teBetalen: teBetalen, zvw: zvw, netto: netto,
      reserveer: winst > 0 ? (teBetalen + zvw) / winst : 0
    };
  }
  window.__nettoBereken = bereken; // voor tests

  var fmt = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  function euro(n) { return fmt.format(Math.round(n)).replace(/\s/g, ' '); }
  function perJaar() { return form.querySelector('input[name="periode"]:checked').value === 'jaar'; }
  function getal(id) {
    var v = document.getElementById(id).value.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    var n = parseFloat(v);
    return isFinite(n) && n > 0 ? n : 0;
  }
  function zet(id, tekst) { var el = document.getElementById(id); if (el) el.textContent = tekst; }

  function update() {
    var jaar = form.querySelector('input[name="jaar"]:checked').value;
    var uren = document.getElementById('nc-uren').checked;
    var fase = form.querySelector('input[name="fase"]:checked').value;
    var eerderBox = document.getElementById('nc-eerder');
    var faseSet = document.getElementById('nc-fase');
    faseSet.disabled = !uren;
    faseSet.classList.toggle('is-uit', !uren);
    eerderBox.closest('label').hidden = fase === '0';
    var starter = uren && fase !== '0' && !eerderBox.checked;
    var hint = '';
    if (!uren) hint = 'Zonder urencriterium krijg je geen zelfstandigen- en startersaftrek.';
    else if (fase === '0') hint = 'Na je eerste drie jaar heb je geen recht meer op startersaftrek.';
    else if (eerderBox.checked) hint = 'Dan heb je waarschijnlijk geen recht op startersaftrek: die krijg je alleen als je in de vijf jaar daarvoor maximaal twee keer zelfstandigenaftrek had. We rekenen zonder.';
    else hint = 'Je krijgt startersaftrek: ' + euro(JAREN[jaar].sa) + ' in ' + jaar + (jaar === '2027' ? '. Vanaf 2028 vervalt die.' : '.');
    zet('nc-fase-hint', hint);
    var factor = perJaar() ? 1 : 12;
    form.querySelectorAll('.nc-per-label').forEach(function (el, i) {
      el.textContent = (i === 0 ? 'Omzet' : 'Zakelijke kosten') + (perJaar() ? ' per jaar' : ' per maand');
    });
    var r = bereken(jaar, getal('nc-omzet') * factor, getal('nc-kosten') * factor, uren, starter);
    zet('nc-netto-maand', euro(r.netto / 12));
    zet('nc-netto-jaar', euro(r.netto));
    zet('nc-winst', euro(r.winst));
    zet('nc-za', r.za + r.sa > 0 ? '− ' + euro(r.za + r.sa) : euro(0));
    zet('nc-mkb', '− ' + euro(r.mkb));
    zet('nc-belastbaar', euro(r.belastbaar));
    zet('nc-ib', euro(r.ib));
    zet('nc-kortingen', '− ' + euro(r.kortingen));
    zet('nc-tebetalen', euro(r.teBetalen));
    zet('nc-zvw', euro(r.zvw));
    zet('nc-reserveer', Math.round(r.reserveer * 100) + '%');
    zet('nc-reserveer-maand', euro((r.teBetalen + r.zvw) / 12));
    zet('nc-jaar-label', jaar === '2027' ? '2027 (voorlopige tarieven)' : '2026');
    document.getElementById('nc-negatief').hidden = r.winst >= 0;
  }

  // Wissel per maand / per jaar: rek de ingevulde bedragen om
  var vorige = perJaar();
  form.querySelectorAll('input[name="periode"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      var nu = perJaar();
      if (nu !== vorige) {
        ['nc-omzet', 'nc-kosten'].forEach(function (id) {
          var n = getal(id) * (nu ? 12 : 1 / 12);
          document.getElementById(id).value = n ? new Intl.NumberFormat('nl-NL').format(Math.round(n)) : '';
        });
        vorige = nu;
      }
    });
  });

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', function (e) { e.preventDefault(); update(); });
  ['nc-omzet', 'nc-kosten'].forEach(function (id) {
    var el = document.getElementById(id);
    el.addEventListener('blur', function () {
      var n = getal(id);
      el.value = n ? new Intl.NumberFormat('nl-NL').format(Math.round(n)) : '';
    });
  });
  update();
})();
