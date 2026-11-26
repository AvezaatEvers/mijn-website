// Eigen planner voor de kennismaking (vervangt Cal.com), in de bekende indeling van Calendly en Cal.com:
// links de info over het gesprek, in het midden een maandkalender, rechts de tijden van de gekozen dag.
// Na het kiezen van een tijd komt het formulier in beeld (met een terugknop).
// Op /contact: <div id="planner"></div>. Op /afspraak: AEPlanner.start(element, { modus: "verzet", id, t, huidig, klaar }).
// De server staat in netlify/functions/planner.mjs; beschikbaarheid stellen Koen en Daan in het dashboard in.
(function () {
  var TZ = 'Europe/Amsterdam';
  var MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  var css = '' +
    '.pl{display:grid;grid-template-columns:280px minmax(0,1fr);min-height:540px;font:inherit;color:var(--ink,#111827);text-align:left}' +
    '.pl-info{padding:28px 26px;border-right:1px solid var(--line,#E5E7EB);display:flex;flex-direction:column;gap:14px}' +
    '.pl-fotos{display:flex}.pl-fotos img{width:44px;height:44px;border-radius:50%;object-fit:cover;border:3px solid #fff}.pl-fotos img+img{margin-left:-12px}' +
    '.pl-org{font-size:15px;color:var(--muted,#4B5563);font-weight:500;margin:0}' +
    '.pl-titel{font-size:24px;font-weight:700;letter-spacing:-.02em;margin:0;line-height:1.2}' +
    '.pl-feit{display:flex;gap:10px;align-items:flex-start;font-size:15px;font-weight:500;color:var(--muted,#4B5563);margin:0;line-height:1.45}' +
    '.pl-feit svg{flex:0 0 18px;margin-top:2px;color:var(--muted,#4B5563)}.pl-feit.is-keuze{color:var(--ink,#111827);font-weight:600}' +
    '.pl-uitleg{font-size:14.5px;color:var(--muted,#4B5563);margin:4px 0 0;line-height:1.6}' +
    '.pl-terug{width:40px;height:40px;border-radius:50%;border:1px solid var(--line,#E5E7EB);background:#fff;color:var(--accent,#26458F);display:grid;place-items:center;cursor:pointer;margin-bottom:2px}' +
    '.pl-terug:hover{background:var(--tint,#EEF2F8)}' +
    '.pl-main{padding:28px 26px;display:grid;grid-template-columns:minmax(0,1fr) 220px;gap:28px;align-items:start}' +
    '.pl-main.is-form{display:block;max-width:520px}' +
    '.pl-h{font-size:19px;font-weight:700;margin:0 0 18px;letter-spacing:-.01em}' +
    '.pl-maand{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}.pl-maand b{font-size:16px;font-weight:600;text-transform:capitalize}' +
    '.pl-pijl{width:38px;height:38px;border-radius:50%;border:0;background:var(--tint,#EEF2F8);color:var(--accent,#26458F);cursor:pointer;display:grid;place-items:center}' +
    '.pl-pijl[disabled]{background:none;color:#C4C9D2;cursor:default}' +
    '.pl-week,.pl-raster{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;text-align:center}' +
    '.pl-week span{font-size:12px;font-weight:600;color:var(--muted,#4B5563);text-transform:uppercase;padding-bottom:4px}' +
    '.pl-d{aspect-ratio:1;max-width:48px;width:100%;margin:0 auto;border-radius:50%;border:0;background:none;font:inherit;font-size:15px;color:#9CA3AF;display:grid;place-items:center;position:relative;padding:0}' +
    '.pl-d.is-vrij{background:var(--tint,#EEF2F8);color:var(--accent,#26458F);font-weight:700;cursor:pointer}.pl-d.is-vrij:hover{background:#DCE4F2}' +
    '.pl-d.is-aan,.pl-d.is-aan:hover{background:var(--accent,#26458F);color:#fff}' +
    '.pl-d.is-vandaag::after{content:"";position:absolute;bottom:6px;left:50%;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:currentColor}' +
    '.pl-tz{font-size:13px;color:var(--muted,#4B5563);margin:18px 0 0}' +
    '.pl-tijden h3{font-size:15px;font-weight:600;margin:6px 0 14px}' +
    '.pl-lijst{display:flex;flex-direction:column;gap:8px;max-height:390px;overflow-y:auto;padding-right:4px}' +
    '.pl-t{display:flex;gap:6px}.pl-t button{font:inherit;font-weight:600;font-size:15px;height:48px;border-radius:8px;cursor:pointer;flex:1;min-width:0}' +
    '.pl-t .tijd{border:1px solid var(--tint-border,#CAD4E8);background:#fff;color:var(--accent,#26458F)}.pl-t .tijd:hover{border:2px solid var(--accent,#26458F)}' +
    '.pl-t.is-aan .tijd{background:#4B5563;border-color:#4B5563;color:#fff}.pl-t .verder{display:none;border:0;background:var(--accent,#26458F);color:#fff}.pl-t.is-aan .verder{display:block}' +
    '.pl-leeg{color:var(--muted,#4B5563);font-size:14.5px;line-height:1.6;margin:0}' +
    '.pl-form{display:grid;gap:16px}' +
    '.pl-form label{display:flex;flex-direction:column;gap:6px;font-size:14px;font-weight:600;color:var(--ink,#111827)}' +
    '.pl-form .opt{font-weight:400;color:var(--muted,#4B5563)}' +
    '.pl-form input,.pl-form select,.pl-form textarea{font:inherit;font-size:16px;font-weight:400;padding:11px 14px;border-radius:8px;border:1px solid var(--tint-border,#CAD4E8);background:#fff;color:var(--ink,#111827);min-height:46px;width:100%}' +
    '.pl-form input:focus,.pl-form select:focus,.pl-form textarea:focus{outline:2px solid var(--accent,#26458F);outline-offset:1px}' +
    '.pl-form .check{flex-direction:row;align-items:flex-start;gap:10px;font-weight:400;color:var(--text,#374151)}.pl-form .check input{width:20px;min-height:20px;margin-top:3px}' +
    '.pl-form .weg{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}' +
    '.pl-knop{justify-self:start;border-radius:999px!important;padding:13px 26px!important}.pl-knop[disabled]{opacity:.6;cursor:wait}' +
    '.pl-melding{margin:16px 0 0;padding:12px 14px;border-radius:10px;background:#FEF3E2;color:#7A4A0E;font-size:14.5px}.pl-melding:empty{display:none}' +
    '.pl-voet{font-size:13.5px;color:var(--muted,#4B5563);margin:auto 0 0;padding-top:10px;line-height:1.6}' +
    '@media (max-width:900px){.pl-main{grid-template-columns:1fr;gap:22px}.pl-lijst{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));max-height:none;overflow:visible}}' +
    '@media (max-width:760px){.pl{grid-template-columns:1fr;min-height:0}.pl-info{border-right:0;border-bottom:1px solid var(--line,#E5E7EB);padding:22px 20px;gap:10px}.pl-main{padding:22px 20px}.pl-uitleg,.pl-voet{display:none}.pl-titel{font-size:21px}}';

  var svg = function (pad, w) { return '<svg width="' + (w || 18) + '" height="' + (w || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + pad + '</svg>'; };
  var IC = {
    klok: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    video: svg('<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3"/>'),
    agenda: svg('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/>'),
    wereld: '<span style="display:inline-block;vertical-align:-2px;margin-right:4px">' + svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>', 14) + '</span>',
    links: svg('<path d="M15 18l-6-6 6-6"/>'),
    rechts: svg('<path d="M9 18l6-6-6-6"/>')
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function tijd(iso) { return new Date(iso).toLocaleTimeString('nl-NL', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }); }
  function plus20(iso) { return new Date(new Date(iso).getTime() + 20 * 60000).toISOString(); }
  function datumLang(iso) { return new Date(iso).toLocaleDateString('nl-NL', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  function vandaagNL() { var p = {}; new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; }); return p.year + '-' + p.month + '-' + p.day; }
  function maandVan(datum) { return [+datum.slice(0, 4), +datum.slice(5, 7) - 1]; }
  function zetCss() { if (document.getElementById('pl-css')) return; var s = document.createElement('style'); s.id = 'pl-css'; s.textContent = css; document.head.appendChild(s); }

  function start(el, opt) {
    opt = opt || {};
    var verzet = opt.modus === 'verzet';
    var dagen = {}, lijstDagen = [], dag = null, gekozen = null, maand = null, stap = 'laden';
    zetCss();

    function info() {
      var h = stap === 'form' ? '<div><button type="button" class="pl-terug" data-terug aria-label="Terug naar de kalender">' + IC.links + '</button></div>' : '';
      h += '<div class="pl-fotos"><img src="/assets/img/koen-160.webp?v=4" alt="" width="44" height="44"><img src="/assets/img/daan-160.webp?v=4" alt="" width="44" height="44"></div>' +
        '<p class="pl-org">Avezaat &amp; Evers</p>' +
        '<h2 class="pl-titel">' + (verzet ? 'Verzet je kennismaking' : 'Gratis kennismaking') + '</h2>' +
        '<p class="pl-feit">' + IC.klok + '<span>20 min</span></p>' +
        '<p class="pl-feit">' + IC.video + '<span>Google Meet</span></p>';
      if (gekozen && stap === 'form') h += '<p class="pl-feit is-keuze">' + IC.agenda + '<span>' + tijd(gekozen) + ' – ' + tijd(plus20(gekozen)) + ', ' + esc(datumLang(gekozen)) + '</span></p>';
      else if (verzet && opt.huidig) h += '<p class="pl-feit">' + IC.agenda + '<span>Nu: ' + tijd(opt.huidig) + ', ' + esc(datumLang(opt.huidig)) + '</span></p>';
      if (!verzet) h += '<p class="pl-uitleg">Je spreekt Koen of Daan. We vragen naar je bedrijf en hoe je administratie nu loopt, en je hoort precies wat het kost. Vrijblijvend.</p>' +
        '<p class="pl-voet">Geen geschikt moment? <a href="https://wa.me/31850604363">App ons</a> of bel <a href="tel:+31850604363">085 060 4363</a>.</p>';
      return h;
    }

    function kalender() {
      var j = maand[0], m = maand[1];
      var eerste = new Date(Date.UTC(j, m, 1)), lege = (eerste.getUTCDay() + 6) % 7, aantal = new Date(Date.UTC(j, m + 1, 0)).getUTCDate();
      var vandaag = vandaagNL(), cellen = '';
      for (var i = 0; i < lege; i++) cellen += '<span></span>';
      for (var d = 1; d <= aantal; d++) {
        var datum = j + '-' + (m < 9 ? '0' : '') + (m + 1) + '-' + (d < 10 ? '0' : '') + d;
        var vrij = !!dagen[datum], aan = dag === datum, kl = datum === vandaag ? ' is-vandaag' : '';
        cellen += vrij ? '<button type="button" class="pl-d is-vrij' + (aan ? ' is-aan' : '') + kl + '" data-dag="' + datum + '" aria-pressed="' + aan + '" aria-label="' + esc(dagen[datum].label) + '">' + d + '</button>'
          : '<span class="pl-d' + kl + '">' + d + '</span>';
      }
      var mk = function (x) { return x[0] * 12 + x[1]; };
      var eersteM = mk(maandVan(lijstDagen[0])), laatsteM = mk(maandVan(lijstDagen[lijstDagen.length - 1]));
      return '<div class="pl-kal"><h2 class="pl-h">' + (verzet ? 'Kies een nieuw moment' : 'Kies een dag en tijd') + '</h2>' +
        '<div class="pl-maand"><b>' + MAANDEN[m] + ' ' + j + '</b><span style="display:flex;gap:8px">' +
        '<button type="button" class="pl-pijl" data-maand="-1" aria-label="Vorige maand"' + (mk(maand) <= eersteM ? ' disabled' : '') + '>' + IC.links + '</button>' +
        '<button type="button" class="pl-pijl" data-maand="1" aria-label="Volgende maand"' + (mk(maand) >= laatsteM ? ' disabled' : '') + '>' + IC.rechts + '</button></span></div>' +
        '<div class="pl-week"><span>Ma</span><span>Di</span><span>Wo</span><span>Do</span><span>Vr</span><span>Za</span><span>Zo</span></div>' +
        '<div class="pl-raster" style="margin-top:6px">' + cellen + '</div>' +
        '<p class="pl-tz">' + IC.wereld + 'Nederlandse tijd</p></div>';
    }

    function tijden() {
      if (!dag) return '<div class="pl-tijden"><p class="pl-leeg" style="margin-top:44px">Kies een dag in de kalender.</p></div>';
      var d = dagen[dag], label = d.label.charAt(0).toUpperCase() + d.label.slice(1);
      return '<div class="pl-tijden"><h3>' + esc(label) + '</h3><div class="pl-lijst">' + d.tijden.map(function (t) {
        var aan = gekozen === t.start;
        return '<div class="pl-t' + (aan ? ' is-aan' : '') + '"><button type="button" class="tijd" data-tijd="' + esc(t.start) + '">' + esc(t.tijd) + '</button><button type="button" class="verder" data-verder>' + (verzet ? 'Kiezen' : 'Volgende') + '</button></div>';
      }).join('') + '</div></div>';
    }

    function formulier() {
      if (verzet) return '<h2 class="pl-h">Nieuw moment bevestigen</h2><p class="pl-leeg" style="margin-bottom:18px">Je kennismaking wordt verzet naar het moment hiernaast. Je krijgt een nieuwe bevestiging per mail.</p>' +
        '<button class="btn btn-primary pl-knop" type="button" id="pl-verzet">Verzet naar dit moment</button><p class="pl-melding" role="alert"></p>';
      return '<h2 class="pl-h">Je gegevens</h2><form class="pl-form" novalidate>' +
        '<label>Naam<input name="naam" autocomplete="name" required></label>' +
        '<label>E-mail<input type="email" name="email" autocomplete="email" required></label>' +
        '<label><span>Telefoon <span class="opt">(optioneel)</span></span><input type="tel" name="telefoon" autocomplete="tel"></label>' +
        '<label>Wat is je situatie?<select name="situatie"><option value="start">Ik ben net gestart</option><option value="boekhouder">Ik wil overstappen van boekhouder</option><option value="zelf">Ik doe het nu zelf</option><option value="anders">Anders</option></select></label>' +
        '<label><span>Waar wil je het over hebben? <span class="opt">(optioneel)</span></span><textarea name="bericht" rows="3" placeholder="Bijvoorbeeld wat voor onderneming je hebt"></textarea></label>' +
        '<label class="weg" aria-hidden="true">Niet invullen<input name="website" tabindex="-1" autocomplete="off"></label>' +
        '<label class="check"><input type="checkbox" name="privacy" required><span>Ik ga akkoord met de <a href="/privacy">privacyverklaring</a>.</span></label>' +
        '<button class="btn btn-primary pl-knop" type="submit">Bevestig je kennismaking</button>' +
        '</form><p class="pl-melding" role="alert"></p>';
    }

    function teken(melding) {
      var main = stap === 'form' ? formulier()
        : stap === 'laden' ? '<p class="pl-leeg">Vrije momenten laden…</p>'
        : !lijstDagen.length ? '<div><h2 class="pl-h">Kies een dag en tijd</h2><p class="pl-leeg">Er zijn de komende twee weken geen vrije momenten online. <a href="https://wa.me/31850604363">App ons</a> of bel <a href="tel:+31850604363">085 060 4363</a>, dan plannen we samen een tijd.</p></div>'
        : kalender() + tijden();
      el.innerHTML = '<div class="pl"><aside class="pl-info">' + info() + '</aside><div class="pl-main' + (stap === 'form' ? ' is-form' : '') + '">' + main + '</div></div>';
      if (melding) {
        var mm = el.querySelector('.pl-melding');
        if (mm) mm.textContent = melding;
        else el.querySelector('.pl-main').insertAdjacentHTML('beforeend', '<p class="pl-melding" role="alert" style="grid-column:1/-1">' + esc(melding) + '</p>');
      }
    }

    function laad(melding) {
      stap = 'laden'; teken();
      var q = verzet ? '?id=' + encodeURIComponent(opt.id) + '&t=' + encodeURIComponent(opt.t) : '';
      fetch('/api/planner/tijden' + q, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (r) {
        dagen = {}; lijstDagen = [];
        (r.dagen || []).forEach(function (d) { dagen[d.datum] = d; lijstDagen.push(d.datum); });
        if (dag && !dagen[dag]) dag = null;
        gekozen = null; stap = 'kies';
        // Op een breed scherm staat de eerste vrije dag meteen open, zoals bij Calendly
        if (!dag && lijstDagen.length && window.matchMedia('(min-width: 901px)').matches) dag = lijstDagen[0];
        maand = maandVan(dag || lijstDagen[0] || vandaagNL());
        teken(melding);
      }).catch(function () { stap = 'kies'; lijstDagen = []; teken('Laden lukt even niet. App of bel ons, dan plannen we samen een tijd.'); });
    }

    function verstuur(pad, data, knop, tekst, ok) {
      var mel = el.querySelector('.pl-melding');
      knop.disabled = true; knop.textContent = 'Even geduld…'; mel.textContent = '';
      fetch(pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j.ok) return ok(j);
          if (j.bezet) return laad(j.fout);
          knop.disabled = false; knop.textContent = tekst; mel.textContent = j.fout || 'Dat lukte niet. Probeer het nog eens of app ons.';
        })
        .catch(function () { knop.disabled = false; knop.textContent = tekst; mel.textContent = 'Geen verbinding. Probeer het nog eens of app ons.'; });
    }

    el.addEventListener('click', function (e) {
      var t = e.target;
      var d = t.closest('[data-dag]');
      if (d) {
        dag = d.dataset.dag; gekozen = null; teken();
        var tl = el.querySelector('.pl-tijden'); if (tl && window.matchMedia('(max-width: 900px)').matches) tl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      var mb = t.closest('[data-maand]');
      if (mb && !mb.disabled) { var x = maand[0] * 12 + maand[1] + (+mb.dataset.maand); maand = [Math.floor(x / 12), x % 12]; teken(); return; }
      var tb = t.closest('[data-tijd]');
      if (tb) { gekozen = tb.dataset.tijd; el.querySelectorAll('.pl-t').forEach(function (r) { r.classList.toggle('is-aan', r.querySelector('.tijd') === tb); }); return; }
      if (t.closest('[data-verder]')) {
        stap = 'form'; teken();
        var top = el.getBoundingClientRect().top; if (top < 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        var n = el.querySelector('input[name="naam"]'); if (n) setTimeout(function () { n.focus({ preventScroll: true }); }, 250);
        return;
      }
      if (t.closest('[data-terug]')) { stap = 'kies'; teken(); return; }
      var vz = t.closest('#pl-verzet');
      if (vz) verstuur('/api/planner/verzet', { id: opt.id, t: opt.t, start: gekozen }, vz, 'Verzet naar dit moment', function (j) { if (opt.klaar) opt.klaar(j); });
    });
    el.addEventListener('submit', function (e) {
      e.preventDefault();
      var fm = e.target, knop = fm.querySelector('.pl-knop'), w = {}, mel = el.querySelector('.pl-melding');
      new FormData(fm).forEach(function (v, k) { w[k] = v; });
      if (!w.naam || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(w.email || '')) { mel.textContent = 'Vul je naam en een geldig e-mailadres in.'; return; }
      if (!fm.privacy.checked) { mel.textContent = 'Ga akkoord met de privacyverklaring.'; return; }
      w.privacy = true; w.start = gekozen;
      verstuur('/api/planner/boek', w, knop, 'Bevestig je kennismaking', function (j) {
        try { if (window.umami && typeof window.umami.track === 'function') window.umami.track('Afspraak ingepland', { pagina: location.pathname }); } catch (x) { /* meten mag nooit het boeken blokkeren */ }
        location.href = '/bedankt?afspraak=1&start=' + encodeURIComponent(j.start) + '&eind=' + encodeURIComponent(j.eind);
      });
    });
    laad();
  }

  window.AEPlanner = { start: start };
  var plek = document.getElementById('planner');
  if (plek) start(plek, {});
})();
