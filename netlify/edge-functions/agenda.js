// Agenda-bestand (.ics) voor de kennismaking, zodat bezoekers de afspraak met één tik
// in hun agenda zetten. Een echt bestand van de server werkt ook op iPhone en Android,
// een bestand dat de browser zelf maakt niet.
// Gebruik: /agenda.ics?start=2026-10-14T08:00:00.000Z&eind=2026-10-14T08:20:00.000Z[&id=…&meet=https://meet.google.com/…]
// Met id krijgt het item dezelfde UID als de bijlage in de bevestigingsmail, zodat de agenda het niet dubbel zet.

function icsTijd(d) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export default async (request) => {
  const url = new URL(request.url);
  const start = new Date(url.searchParams.get("start") || "");
  let eind = new Date(url.searchParams.get("eind") || "");

  // Alleen geldige tijden binnen een redelijke periode accepteren
  const nu = Date.now();
  if (isNaN(start) || start.getTime() < nu - 2 * 864e5 || start.getTime() > nu + 400 * 864e5) {
    return new Response("Ongeldige afspraak", { status: 400 });
  }
  if (isNaN(eind) || eind <= start || eind - start > 4 * 3600e3) {
    eind = new Date(start.getTime() + 20 * 60000);
  }

  const id = url.searchParams.get("id") || "";
  const meet = url.searchParams.get("meet") || "";
  const uid = /^[a-z0-9]{10,40}$/i.test(id) ? id : icsTijd(start) + "-kennismaking";
  const link = /^https:\/\/meet\.google\.com\/[a-z0-9-]{3,40}$/i.test(meet) ? meet : "";

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Avezaat & Evers//Kennismaking//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "UID:" + uid + "@avezaatenevers.nl",
    "DTSTAMP:" + icsTijd(new Date()),
    "DTSTART:" + icsTijd(start),
    "DTEND:" + icsTijd(eind),
    "SUMMARY:Kennismaking Avezaat & Evers",
    link ? "DESCRIPTION:Gratis kennismaking van 20 minuten.\\nDeelnemen: " + link : "DESCRIPTION:Gratis kennismaking van 20 minuten. De link voor het gesprek staat in je bevestigingsmail.",
    ...(link ? ["LOCATION:" + link] : []),
    "URL:https://avezaatenevers.nl/",
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Kennismaking Avezaat & Evers",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="kennismaking-avezaat-evers.ics"',
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
};

export const config = { path: "/agenda.ics" };
