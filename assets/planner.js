// Eigen planner voor de kennismaking (vervangt Cal.com).
// Op /contact: <div id="planner"></div> toont dagen, tijden en het formulier om te boeken.
// Op /afspraak: AEPlanner.start(element, { modus: "verzet", id, t, klaar }) laat een nieuw moment kiezen.
// De server staat in netlify/functions/planner.mjs; beschikbaarheid stellen Koen en Daan in het dashboard in.
(function () {
  var TZ = 'Europe/Amsterdam';
  var css = '' +
    '.pl{font:inherit;color:var(--ink,#111827)}' +
    '.pl-kop{padding:20px 22px 4px}.pl-kop h2{font-size:26px;margin:0 0 6px}.pl-kop p{margin:0;color:var(--muted,#4B5563)}' +
    '.pl-stap{font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--accent,#26458F);margin:22px 22px 10px}' +
    '.pl-dagen{display:flex;gap:8px;overflow-x:auto;padding:2px 22px 8px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}' +
    '.pl-dag{flex:0 0 auto;scroll-snap-align:start;min-width:74px;padding:10px 12px;border:1.5px solid var(--line,#E5E7EB);border-radius:12px;background:#fff;cursor:pointer;text-align:center;font:inherit;color:inherit;line-height:1.25}' +
    '.pl-dag b{display:block;font-size:13px;font-weight:600;color:var(--muted,#4B5563);text-transform:capitalize}.pl-dag span{display:block;font-size:16px;font-weight:600}' +
    '.pl-dag:hover{border-color:var(--tint-border,#CAD4E8)}.pl-dag[aria-pressed="true"]{border-color:var(--accent,#26458F);background:var(--tint,#EEF2F8)}.pl-dag[aria-pressed="true"] b{color:var(--accent,#26458F)}' +
    '.pl-tijden{display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:8px;padding:0 22px}' +
    '.pl-tijd{padding:12px 8px;border:1.5px solid var(--tint-border,#CAD4E8);border-radius:10px;background:#fff;color:var(--accent,#26458F);font:inherit;font-weight:600;cursor:pointer}' +
    '.pl-tijd:hover{background:var(--tint,#EEF2F8)}.pl-tijd[aria-pressed="true"]{background:var(--accent,#26458F);border-color:var(--accent,#26458F);color:#fff}' +
    '.pl-keuze{margin:22px 22px 0;padding:16px 18px;border-radius:12px;background:var(--tint,#EEF2F8);display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}' +
    '.pl-keuze strong{font-size:17px}.pl-keuze small{display:block;color:var(--muted,#4B5563);font-size:14px}.pl-keuze button{font:inherit;font-size:14px;background:none;border:0;color:var(--accent,#26458F);text-decoration:underline;cursor:pointer;padding:4px}' +
    '.pl-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;padding:18px 22px 4px}' +
    '.pl-form label{display:flex;flex-direction:column;gap:6px;font-size:14px;font-weight:500;color:var(--text,#374151)}.pl-form .vol{grid-column:1/-1}' +
    '.pl-form input,.pl-form select,.pl-form textarea{font:inherit;font-size:16px;padding:12px 14px;border-radius:8px;border:1px solid var(--tint-border,#CAD4E8);background:#fff;color:var(--ink,#111827);min-height:46px;width:100%}' +
    '.pl-form input:focus,.pl-form select:focus,.pl-form textarea:focus{outline:2px solid var(--accent,#26458F);outline-offset:1px}' +
    '.pl-form .check{flex-direction:row;align-items:flex-start;gap:10px;font-weight:400}.pl-form .check input{width:20px;min-height:20px;margin-top:3px}' +
    '.pl-form .opt{font-weight:400;color:var(--muted,#4B5563)}.pl-form .weg{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}' +
    '.pl-knop{grid-column:1/-1;justify-self:start}.pl-knop[disabled]{opacity:.6;cursor:wait}' +
    '.pl-melding{margin:16px 22px 0;padding:12px 14px;border-radius:10px;background:#FEF3E2;color:#7A4A0E;font-size:15px}.pl-melding:empty{display:none}' +
    '.pl-leeg{padding:22px;color:var(--muted,#4B5563)}.pl-voet{padding:16px 22px 22px;font-size:14px;color:var(--muted,#4B5563)}';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function f(iso, opt) { opt.timeZone = TZ; return new Date(iso).toLocaleString('nl-NL', opt); }
  function tijd(iso) { return f(iso, { hour: '2-digit', minute: '2-digit' }); }
  function plus20(iso) { return new Date(new Date(iso).getTime() + 20 * 60000).toISOString(); }
  function zetCss() { if (document.getElementById('pl-css')) return; var s = document.createElement('style'); s.id = 'pl-css'; s.textContent = css; document.head.appendChild(s); }

  function start(el, opt) {
    opt = opt || {};
    var verzet = opt.modus === 'verzet';
    var dagen = [], dag = null, gekozen = null;
    zetCss();
    el.innerHTML = '<div class="pl">' +
      (verzet ? '' : '<div class="pl-kop"><h2>Plan een gratis kennismaking</h2><p>20 minuten via Google Meet, met Koen of Daan. Vrijblijvend.</p></div>') +
      '<p class="pl-stap" id="pl-stap1">' + (verzet ? 'Kies een nieuwe dag' : '1. Kies een dag') + '</p><div class="pl-dagen" role="group" aria-labelledby="pl-stap1"></div>' +
      '<p class="pl-stap" id="pl-stap2" hidden>' + (verzet ? 'Kies een tijd' : '2. Kies een tijd') + '</p><div class="pl-tijden" role="group" aria-labelledby="pl-stap2"></div>' +
      '<div class="pl-verder" hidden></div><p class="pl-melding" role="alert"></p>' +
      (verzet ? '' : '<p class="pl-voet">Geen geschikt moment? <a href="https://wa.me/31850604363">App ons</a> of bel <a href="tel:+31850604363">085 060 4363</a>, dan prikken we samen een tijd.</p>') +
      '</div>';
    var $ = function (s) { return el.querySelector(s); };
    var melding = function (t) { $('.pl-melding').textContent = t || ''; };

    function laad(behoud) {
      $('.pl-dagen').innerHTML = '<p class="pl-leeg" style="padding:0">Vrije momenten laden…</p>';
      var q = verzet ? '?id=' + encodeURIComponent(opt.id) + '&t=' + encodeURIComponent(opt.t) : '';
      fetch('/api/planner/tijden' + q, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (r) {
        dagen = r.dagen || [];
        if (!dagen.length) {
          $('.pl-dagen').innerHTML = '<p class="pl-leeg" style="padding:0">Er zijn de komende twee weken geen vrije momenten online. App of bel ons, dan plannen we samen een tijd.</p>';
          $('#pl-stap2').hidden = true; $('.pl-tijden').innerHTML = ''; $('.pl-verder').hidden = true; return;
        }
        var nog = behoud && dag && dagen.filter(function (d) { return d.datum === dag.datum; })[0];
        tekenDagen(); kiesDag(nog || dagen[0]);
      }).catch(function () { $('.pl-dagen').innerHTML = '<p class="pl-leeg" style="padding:0">Laden lukt even niet. App of bel ons, dan plannen we samen een tijd.</p>'; });
    }
    function tekenDagen() {
      $('.pl-dagen').innerHTML = dagen.map(function (d, i) {
        var x = new Date(d.datum + 'T12:00:00Z');
        return '<button type="button" class="pl-dag" data-i="' + i + '" aria-pressed="false" aria-label="' + esc(d.label) + '"><b>' + esc(x.toLocaleDateString('nl-NL', { weekday: 'short', timeZone: 'UTC' }).replace('.', '')) + '</b><span>' + esc(x.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', '')) + '</span></button>';
      }).join('');
    }
    function kiesDag(d) {
      dag = d; gekozen = null; $('.pl-verder').hidden = true; melding('');
      el.querySelectorAll('.pl-dag').forEach(function (b) { b.setAttribute('aria-pressed', String(dagen[+b.dataset.i] === d)); });
      $('#pl-stap2').hidden = false;
      $('.pl-tijden').innerHTML = d.tijden.map(function (t) { return '<button type="button" class="pl-tijd" data-start="' + esc(t.start) + '" aria-pressed="false">' + esc(t.tijd) + '</button>'; }).join('');
    }
    function kiesTijd(st) {
      gekozen = st; melding('');
      el.querySelectorAll('.pl-tijd').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.start === st)); });
      var lbl = dag.label.charAt(0).toUpperCase() + dag.label.slice(1);
      var v = $('.pl-verder'); v.hidden = false;
      v.innerHTML = '<div class="pl-keuze"><div><strong>' + esc(lbl) + '</strong><small>' + tijd(st) + ' – ' + tijd(plus20(st)) + ' uur · 20 minuten · Google Meet</small></div><button type="button" class="pl-wijzig">Ander moment</button></div>' +
        (verzet ? '<div class="pl-form"><button class="btn btn-primary pl-knop" type="button" id="pl-verzet">Verzet naar dit moment</button></div>' :
        '<form class="pl-form" novalidate>' +
          '<p class="pl-stap vol" style="margin:4px 0 0">3. Je gegevens</p>' +
          '<label>Naam<input name="naam" autocomplete="name" required></label>' +
          '<label>E-mail<input type="email" name="email" autocomplete="email" required></label>' +
          '<label><span>Telefoon <span class="opt">(optioneel)</span></span><input type="tel" name="telefoon" autocomplete="tel"></label>' +
          '<label>Situatie<select name="situatie"><option value="start">Ik ben net gestart</option><option value="boekhouder">Ik wil overstappen van boekhouder</option><option value="zelf">Ik doe het nu zelf</option><option value="anders">Anders</option></select></label>' +
          '<label class="vol"><span>Waar wil je het over hebben? <span class="opt">(optioneel)</span></span><textarea name="bericht" rows="3" placeholder="Bijvoorbeeld wat voor onderneming je hebt"></textarea></label>' +
          '<label class="weg" aria-hidden="true">Niet invullen<input name="website" tabindex="-1" autocomplete="off"></label>' +
          '<label class="check vol"><input type="checkbox" name="privacy" required><span>Ik ga akkoord met de <a href="/privacy">privacyverklaring</a>.</span></label>' +
          '<button class="btn btn-primary pl-knop" type="submit">Bevestig je kennismaking</button>' +
        '</form>');
      v.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      var n = v.querySelector('input[name="naam"]'); if (n) setTimeout(function () { n.focus({ preventScroll: true }); }, 250);
    }
    function bezig(knop, aan, tekst) { knop.disabled = aan; if (tekst) knop.textContent = tekst; }
    function verstuur(pad, data, knop, tekst, ok) {
      bezig(knop, true, 'Even geduld…');
      fetch(pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
        .then(function (r) {
          if (r.j.ok) return ok(r.j);
          bezig(knop, false, tekst); melding(r.j.fout || 'Dat lukte niet. Probeer het nog eens of app ons.');
          if (r.j.bezet) laad(true);
        })
        .catch(function () { bezig(knop, false, tekst); melding('Geen verbinding. Probeer het nog eens of app ons.'); });
    }

    el.addEventListener('click', function (e) {
      var d = e.target.closest('.pl-dag'); if (d) return kiesDag(dagen[+d.dataset.i]);
      var t = e.target.closest('.pl-tijd'); if (t) return kiesTijd(t.dataset.start);
      if (e.target.closest('.pl-wijzig')) { $('.pl-verder').hidden = true; $('.pl-tijden').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
      var vz = e.target.closest('#pl-verzet');
      if (vz) verstuur('/api/planner/verzet', { id: opt.id, t: opt.t, start: gekozen }, vz, 'Verzet naar dit moment', function (j) { if (opt.klaar) opt.klaar(j); });
    });
    el.addEventListener('submit', function (e) {
      e.preventDefault();
      var fm = e.target, knop = fm.querySelector('.pl-knop'), w = {};
      new FormData(fm).forEach(function (v, k) { w[k] = v; });
      if (!w.naam || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(w.email || '')) { melding('Vul je naam en een geldig e-mailadres in.'); return; }
      if (!fm.privacy.checked) { melding('Ga akkoord met de privacyverklaring.'); return; }
      w.privacy = true; w.start = gekozen;
      verstuur('/api/planner/boek', w, knop, 'Bevestig je kennismaking', function (j) {
        try { if (window.umami && typeof window.umami.track === 'function') window.umami.track('Afspraak ingepland', { pagina: location.pathname }); } catch (x) { /* meten mag nooit het boeken blokkeren */ }
        location.href = '/bedankt?afspraak=1&start=' + encodeURIComponent(j.start) + '&eind=' + encodeURIComponent(j.eind);
      });
    });
    laad(false);
  }

  window.AEPlanner = { start: start };
  var plek = document.getElementById('planner');
  if (plek) start(plek, {});
})();
