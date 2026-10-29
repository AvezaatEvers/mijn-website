// KOR-check: rekent globaal uit wat de kleineondernemersregeling een zzp'er per jaar oplevert of kost.
// Uitgangspunt: particulieren betalen met KOR dezelfde prijs (incl. btw), bedrijven dezelfde prijs (excl. btw).
(function () {
  var form = document.getElementById('kc-form');
  if (!form) return;
  var GRENS = 20000;
  var fmt = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  function euro(n) { return fmt.format(Math.round(n)).replace(/\s/g, ' '); }
  function getal(id) {
    var v = document.getElementById(id).value.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    var n = parseFloat(v); return isFinite(n) && n > 0 ? n : 0;
  }
  function keuze(naam) { var el = form.querySelector('input[name="' + naam + '"]:checked'); return el ? el.value : ''; }
  function zet(id, t) { var el = document.getElementById(id); if (el) el.textContent = t; }
  function toon(id, aan) { var el = document.getElementById(id); if (el) el.hidden = !aan; }

  function bereken() {
    var omzet = getal('kc-omzet'), kosten = getal('kc-kosten'), invest = getal('kc-invest');
    var p = { part: 1, mix: 0.5, zak: 0 }[keuze('kc-klant')] || 0;
    var t = parseFloat(keuze('kc-tarief')) || 0.21;
    var plus = omzet * p * t;              // btw die je bij particulieren zelf houdt
    var minKosten = kosten * 0.21;         // btw op kosten die je niet meer terugkrijgt
    var minInvest = invest * 0.21;         // btw op investeringen die je niet meer terugkrijgt
    var verschil = plus - minKosten - minInvest;
    var gefactureerd = omzet * p * (1 + t) + omzet * (1 - p);
    return { omzet: omzet, plus: plus, minKosten: minKosten, minInvest: minInvest, verschil: verschil, gefactureerd: gefactureerd };
  }

  function update() {
    var r = bereken();
    var kan = r.omzet <= GRENS;
    var overGrens = kan && r.gefactureerd > GRENS;
    var resultaat = document.getElementById('kc-result');
    resultaat.classList.toggle('is-niet', !kan || overGrens);

    if (!kan) {
      zet('kc-kicker', 'De KOR is voor jou');
      zet('kc-big', 'niet mogelijk');
      zet('kc-sub', 'Je omzet is hoger dan de grens van € 20.000 per jaar.');
    } else if (overGrens) {
      zet('kc-kicker', 'Let op: met de KOR kom je');
      zet('kc-big', 'boven de grens');
      zet('kc-sub', 'Met dezelfde prijzen factureer je ' + euro(r.gefactureerd) + ', want je houdt de btw zelf. Dat is meer dan € 20.000.');
    } else if (Math.abs(r.verschil) < 250) {
      zet('kc-kicker', 'Met de KOR houd je per jaar');
      zet('kc-big', 'ongeveer hetzelfde over');
      zet('kc-sub', 'Het verschil is ' + euro(Math.abs(r.verschil)) + '. Het voordeel zit dan vooral in geen btw-aangifte meer.');
    } else if (r.verschil > 0) {
      zet('kc-kicker', 'Met de KOR houd je per jaar ongeveer');
      zet('kc-big', euro(r.verschil) + ' meer over');
      zet('kc-sub', 'Vóór inkomstenbelasting: wat je extra overhoudt, telt mee als winst.');
    } else {
      zet('kc-kicker', 'Met de KOR houd je per jaar ongeveer');
      zet('kc-big', euro(-r.verschil) + ' minder over');
      zet('kc-sub', 'De btw op je kosten kun je dan niet meer terugvragen.');
    }
    zet('kc-plus', '+ ' + euro(r.plus));
    zet('kc-minkosten', '− ' + euro(r.minKosten));
    zet('kc-mininvest', '− ' + euro(r.minInvest));
    zet('kc-verschil', (r.verschil < 0 ? '− ' : '+ ') + euro(Math.abs(r.verschil)));
    toon('kc-tabel', kan);
    toon('kc-dichtbij', kan && !overGrens && r.gefactureerd > 17000);
    toon('kc-herz', document.getElementById('kc-herziening').checked && kan);

    var tekst = 'Hoi! Ik heb de KOR-check gedaan: omzet ' + euro(r.omzet) + ', uitkomst ' + document.getElementById('kc-big').textContent + '. Kunnen jullie het met mij narekenen?';
    document.getElementById('kc-wa').href = 'https://wa.me/31850604363?text=' + encodeURIComponent(tekst);
  }

  // bedragen netjes opmaken bij verlaten van het veld
  form.querySelectorAll('.nc-money input').forEach(function (inp) {
    inp.addEventListener('blur', function () { var n = getal(inp.id); inp.value = n ? new Intl.NumberFormat('nl-NL').format(Math.round(n)) : '0'; });
  });
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  update();
})();
