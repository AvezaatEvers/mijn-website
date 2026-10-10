// Slimme zoekfunctie voor de veelgestelde vragen.
// Werkt volledig in de browser: begrijpt synoniemen, vergeeft typefouten
// en negeert vulwoorden, zodat bezoekers in gewone zinnen kunnen zoeken.
(function () {
  var input = document.getElementById('faq-zoek');
  if (!input) return;
  var resultsBox = document.getElementById('faq-resultaten');
  var cats = document.getElementById('faq-categorieen');
  var items = Array.prototype.slice.call(document.querySelectorAll('.faq-all details[data-q]'));
  var grid = document.getElementById('faq-grid');
  var back = document.getElementById('faq-terug');
  var sections = Array.prototype.slice.call(document.querySelectorAll('.faq-cat'));
  document.documentElement.classList.add('js-faq');

  // Onderwerpen-grid: toon één categorie tegelijk
  function route(scroll) {
    var id = location.hash.slice(1);
    var target = id && document.getElementById(id);
    var sec = null, q = null;
    if (target && target.classList.contains('faq-cat')) sec = target;
    else if (target && target.tagName === 'DETAILS') { q = target; sec = target.closest('.faq-cat'); }
    sections.forEach(function (s) { s.classList.toggle('active', s === sec); });
    if (sec) {
      grid.hidden = true; back.hidden = false;
      if (q) q.open = true;
      if (scroll) (q || back).scrollIntoView({ block: 'start' });
    } else {
      grid.hidden = false; back.hidden = true;
    }
  }
  back.addEventListener('click', function (e) {
    e.preventDefault();
    history.pushState('', document.title, location.pathname + location.search);
    route(false);
    grid.scrollIntoView({ block: 'start' });
  });
  window.addEventListener('hashchange', function () { route(true); });

  // Woorden met (ongeveer) dezelfde betekenis
  var GROUPS = [
    'kosten kost kosten prijs prijzen tarief tarieven betalen duur goedkoop euro geld abonnement bedrag maandbedrag',
    'opzeggen stoppen stop beeindigen opzegtermijn contract looptijd vastzitten vast vertrekken weggaan',
    'btw omzetbelasting kwartaal kwartaalaangifte',
    'inkomstenbelasting ib jaaraangifte belastingaangifte belasting jaarcijfers jaarrekening',
    'aangifte aangiftes indienen',
    'bon bonnetje bonnetjes bonnen kassabon kwitantie',
    'factuur facturen factureren verkoopfactuur inkoopfactuur',
    'aanleveren uploaden foto scannen doorsturen insturen opsturen',
    'overstappen overstap wisselen switchen veranderen',
    'starten start beginnen starter gestart begonnen nieuw',
    'bank rekening bankrekening koppeling koppelen bankkoppeling psd2',
    'transactie transacties mutatie mutaties afschrijving bijschrijving',
    'contact bellen bereikbaar bereiken mail mailen whatsapp appen telefoon',
    'gesprek afspraak call meeting overleg inplannen plannen 1op1',
    'partner echtgenoot echtgenote vriend vriendin man vrouw samenwonend',
    'privacy veilig veiligheid gegevens data avg beveiliging',
    'buitenland eu europa icp internationaal duitsland belgie',
    'kor kleineondernemersregeling vrijstelling vrijgesteld',
    'laat deadline termijn optijd boete vergeten uiterlijk',
    'achterstand achter inhalen achterstallig',
    'bv vof vennootschap rechtsvorm maatschap',
    'moneymonk app software programma boekhoudprogramma',
    'aftrek aftrekpost aftrekposten zelfstandigenaftrek startersaftrek aftrekbaar aftrekken',
    'prive persoonlijk',
    'vakantie afwezig ziek vervanging vervanger',
    'kwijt verloren',
    'boekhouder boekhouders boekhouding administratie',
    'snel snelheid reactie reageren antwoord wachten',
    'wie jullie eigenaren oprichters',
    'id identiteitsbewijs paspoort legitimatie wwft'
  ];
  var STOP = ' de het een en of ik je jij jou jullie u we wij mijn mij me is zijn ben bent heb hebt heeft hoe wat wie waar wanneer waarom welke kan kun kunnen moet moeten mag doe doen dat dit die er in op aan van voor met bij naar om te tot als dan ook nog al wel niet geen hier daar zo maar want omdat dus over uit ';

  function norm(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/1-op-1/g, '1op1').replace(/[^a-z0-9 ]+/g, ' ');
  }
  function stem(w) {
    if (w.length > 5) w = w.replace(/(ingen|ing|en|es|s|e)$/, '');
    return w;
  }
  function tokens(s) {
    return norm(s).split(/\s+/).filter(function (w) { return w && STOP.indexOf(' ' + w + ' ') === -1; });
  }
  var SYN = {};
  GROUPS.forEach(function (g) {
    var words = g.split(' ');
    words.forEach(function (w) {
      var k = stem(w);
      SYN[k] = (SYN[k] || []).concat(words.map(stem));
    });
  });
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 3;
    var prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }
  function close(q, t) {
    if (q === t) return 1;
    if (q.length >= 3 && t.indexOf(q) === 0) return 0.85;
    if (t.length >= 4 && q.indexOf(t) === 0) return 0.75;
    var max = q.length >= 8 ? 2 : (q.length >= 4 ? 1 : 0);
    if (max && lev(q, t) <= max) return 0.7;
    return 0;
  }

  // Index opbouwen
  var index = items.map(function (el) {
    var q = el.getAttribute('data-q');
    var a = el.querySelector('p').textContent;
    var tags = el.getAttribute('data-tags') || '';
    return {
      el: el, q: q,
      fields: [
        { w: 3, t: tokens(q).map(stem) },
        { w: 2.2, t: tokens(tags).map(stem) },
        { w: 1, t: tokens(a).map(stem) }
      ]
    };
  });

  function score(entry, qtoks) {
    var total = 0, hits = 0;
    qtoks.forEach(function (qt) {
      var variants = [{ w: qt, f: 1 }];
      (SYN[qt] || []).forEach(function (s) { if (s !== qt) variants.push({ w: s, f: 0.8 }); });
      var best = 0;
      entry.fields.forEach(function (field) {
        field.t.forEach(function (tt) {
          variants.forEach(function (v) {
            var c = close(v.w, tt);
            if (c) best = Math.max(best, c * v.f * field.w);
          });
        });
      });
      if (best > 0) hits++;
      total += best;
    });
    if (qtoks.length > 1) total *= (0.5 + 0.5 * hits / qtoks.length);
    return total;
  }

  // Veelvoorkomende vraagvormen die direct naar een antwoord wijzen
  var INTENTS = [
    { re: /(aan|ergens) ?vast|vast ?zit|zit .*vast|opzeg|stoppen|looptijd/, id: 'opzeggen', b: 6 },
    { re: /(hoeveel|wat) kost|^kosten$|^prijs|per maand/, id: 'wat-kost-het', b: 6 },
    { re: /kilometer|ritten|uren ?registratie|uren bijhouden/, id: 'uren-ritten', b: 6 },
    { re: /webshop|veel transacties|meer dan 100/, id: 'meer-dan-100', b: 4 },
    { re: /te laat|deadline (gemist|vergeten)|niet op tijd/, id: 'te-laat', b: 5 },
    { re: /partner|vriendin|vriend |echtgeno|man |vrouw/, id: 'ib-partner', b: 4 },
    { re: /(wanneer|deadline).*(inkomstenbelasting|belastingaangifte|ib)/, id: 'ib-wanneer', b: 5 },
    { re: /paspoort|identiteitsbewijs|legitim|id kaart/, id: 'legitimatie', b: 5 }
  ];

  function render(q) {
    var qtoks = tokens(q).map(stem);
    if (!q.trim()) {
      resultsBox.hidden = true; resultsBox.innerHTML = '';
      cats.hidden = false;
      route(false);
      return;
    }
    cats.hidden = true; grid.hidden = true; back.hidden = true;
    var nq = norm(q);
    var ranked = index.map(function (e) {
      var s = score(e, qtoks);
      INTENTS.forEach(function (it) { if (it.re.test(nq) && e.el.id === it.id) s += it.b; });
      return { e: e, s: s };
    })
      .filter(function (r) { return r.s >= 1.2; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, 8);
    resultsBox.hidden = false;
    resultsBox.innerHTML = '';
    var head = document.createElement('p');
    head.className = 'faq-count';
    if (!ranked.length) {
      head.innerHTML = 'Geen vraag gevonden die hierop lijkt. Probeer andere woorden, of <a href="/contact.html#plannen">plan een kennismaking</a> en stel je vraag direct.';
      resultsBox.appendChild(head);
      return;
    }
    head.textContent = ranked.length === 1 ? '1 vraag gevonden' : ranked.length + ' vragen gevonden';
    resultsBox.appendChild(head);
    var wrap = document.createElement('div');
    wrap.className = 'faq';
    ranked.forEach(function (r, i) {
      var clone = r.e.el.cloneNode(true);
      clone.removeAttribute('id');
      if (i === 0) clone.open = true;
      wrap.appendChild(clone);
    });
    resultsBox.appendChild(wrap);
  }

  var t;
  input.addEventListener('input', function () {
    clearTimeout(t);
    t = setTimeout(function () { render(input.value); }, 120);
  });
  document.getElementById('faq-form').addEventListener('submit', function (e) { e.preventDefault(); render(input.value); });

  route(!!location.hash);
})();
