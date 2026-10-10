// Bezoekersstatistieken met Umami Cloud (gratis, geen cookies, geen persoonsgegevens).
// Instellen: maak een account op umami.is, voeg de website toe en plak het Website ID hieronder.
// Er wordt alleen gemeten op het echte domein, niet op de conceptversie of lokaal.
var UMAMI_WEBSITE_ID = "931b51e9-cfd4-41b0-9b54-bc51ab4c0d77";

(function () {
  if (!UMAMI_WEBSITE_ID) return;
  var host = location.hostname.replace(/^www\./, "");
  if (host !== "avezaatenevers.nl") return;

  var s = document.createElement("script");
  s.defer = true;
  s.src = "https://cloud.umami.is/script.js";
  s.setAttribute("data-website-id", UMAMI_WEBSITE_ID);
  document.head.appendChild(s);

  function meet(naam, data) {
    if (window.umami && typeof window.umami.track === "function") window.umami.track(naam, data);
  }

  // Klikken op belangrijke knoppen en links
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a, button");
    if (!a) return;
    var href = a.getAttribute("href") || "";
    var plek = location.pathname;
    if (href.indexOf("/contact.html#plannen") === 0 || a.hasAttribute("data-cal-link")) meet("Kennismaking-knop", { pagina: plek });
    else if (href.indexOf("mailto:info@") === 0) meet("Mail", { pagina: plek });
    else if (href.indexOf("tel:") === 0) meet("Bellen", { pagina: plek });
    else if (href.indexOf("https://wa.me/31") === 0) meet("WhatsApp", { pagina: plek });
    else if (href.indexOf("instagram.com") > -1) meet("Instagram", { pagina: plek });
    else if (a.id === "ref-wa" || a.id === "ref-mail" || a.id === "ref-copy") meet("Aanbevelen delen", { via: a.id.replace("ref-", "") });
  }, true);

  // Contactformulier verstuurd
  document.addEventListener("submit", function (e) {
    if (e.target.getAttribute("name") === "kennismaking") meet("Formulier verstuurd");
  }, true);

  // Nettocalculator: één keer per bezoek tellen als hij echt gebruikt wordt
  var calc = document.getElementById("nc-form");
  if (calc) {
    var gebruikt = false;
    calc.addEventListener("input", function () {
      if (gebruikt) return;
      gebruikt = true;
      meet("Calculator gebruikt");
    });
  }

  // Afspraak echt ingepland via Cal.com
  function koppelCal() {
    if (window.Cal && window.Cal.ns && window.Cal.ns.kennismaking) {
      window.Cal.ns.kennismaking("on", {
        action: "bookingSuccessful",
        callback: function () { meet("Afspraak ingepland", { pagina: location.pathname }); }
      });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", koppelCal);
  else koppelCal();
})();
