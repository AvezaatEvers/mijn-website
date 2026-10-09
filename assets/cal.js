// Cal.com: kennismaking plannen
// - Knoppen met data-cal-link openen de agenda als pop-up.
// - Een element met id="cal-inline" toont de agenda direct in de pagina.
// Link wijzigen? Pas CAL_LINK hieronder aan.
var CAL_LINK = "avezaatenevers/kennismaking";

(function (C, A, L) {
  var p = function (a, ar) { a.q.push(ar); };
  var d = C.document;
  C.Cal = C.Cal || function () {
    var cal = C.Cal; var ar = arguments;
    if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; }
    if (ar[0] === L) {
      var api = function () { p(api, arguments); };
      var namespace = ar[1]; api.q = api.q || [];
      if (typeof namespace === "string") { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ["initNamespace", namespace]); }
      else p(cal, ar);
      return;
    }
    p(cal, ar);
  };
})(window, "https://app.cal.com/embed/embed.js", "init");

Cal("init", "kennismaking", { origin: "https://cal.com" });

// Pas als het Cal.com-script echt geladen is, nemen we de knoppen over.
// Lukt laden niet (bijv. door een adblocker), dan gaan de knoppen gewoon naar /contact.html.
(function () {
  var s = document.querySelector('script[src="https://app.cal.com/embed/embed.js"]');
  if (s) s.addEventListener("load", function () { window.__calReady = true; });
})();
Cal.ns.kennismaking("ui", {
  cssVarsPerTheme: { light: { "cal-brand": "#1E40AF" }, dark: { "cal-brand": "#1E40AF" } },
  theme: "light",
  hideEventTypeDetails: false,
  layout: "month_view"
});

if (document.getElementById("cal-inline")) {
  Cal.ns.kennismaking("inline", {
    elementOrSelector: "#cal-inline",
    config: { layout: "month_view", theme: "light" },
    calLink: CAL_LINK
  });
}

// Alle "Plan een kennismaking"-knoppen openen de pop-up (op de contactpagina zelf scrollen we naar de agenda)
(function () {
  var onContact = !!document.getElementById("cal-inline");
  var links = document.querySelectorAll('a[href^="/contact.html"]:not(.banner):not([data-no-cal])');
  links.forEach(function (a) {
    if (onContact) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        document.getElementById("plannen").scrollIntoView({ behavior: "smooth" });
      });
      return;
    }
    a.setAttribute("data-cal-link", CAL_LINK);
    a.setAttribute("data-cal-namespace", "kennismaking");
    a.setAttribute("data-cal-config", '{"layout":"month_view","theme":"light"}');
    a.addEventListener("click", function (e) { if (window.__calReady) e.preventDefault(); });
  });
})();
