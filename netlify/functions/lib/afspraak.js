// Gedeelde hulpjes voor de afspraakmails (cal-webhook.mjs en afspraak-herinnering.mjs)
export const TZ = "Europe/Amsterdam";

// Datum en tijd in de tijdzone van de bezoeker (Nederland als die onbekend is)
export function delen(iso, tz) {
  let zone = TZ;
  try { if (tz) { new Intl.DateTimeFormat("nl-NL", { timeZone: tz }); zone = tz; } } catch { /* onbekende tijdzone */ }
  const d = new Date(iso);
  return { zone, datum: d.toLocaleDateString("nl-NL", { timeZone: zone, weekday: "long", day: "numeric", month: "long" }),
    tijd: d.toLocaleTimeString("nl-NL", { timeZone: zone, hour: "2-digit", minute: "2-digit" }) };
}

// "donderdag 3 december om 14:00"
export function wanneer(iso, tz) {
  const x = delen(iso, tz);
  return `${x.datum} om ${x.tijd}${x.zone !== TZ ? ` (${x.zone})` : ""}`;
}

// Gegevens voor de mailsjablonen afspraak*, uit een opgeslagen afspraak (k.afspraak) of de webhookgegevens
export function mailData({ naam, wie, start, eind, tz, video, videoVolgt, telefoon, verzet, annuleer, reden }) {
  const begin = delen(start, tz), einde = eind ? delen(eind, tz) : null;
  return {
    naam, wie, wanneer: wanneer(start, tz), datum: begin.datum, tijd: begin.tijd + (begin.zone !== TZ ? ` (${begin.zone})` : ""), eindtijd: einde ? einde.tijd : "",
    duur: Math.max(5, Math.round((new Date(eind || start) - new Date(start)) / 60000) || 20), video, videoVolgt: !video && !!videoVolgt, telefoon, verzet, annuleer, reden: reden || "",
  };
}

// Agenda-bijlage (.ics). Eén vaste UID per afspraak, zodat verzetten en annuleren het bestaande agenda-item bijwerken.
export function ics({ uid, seq, start, eind, titel, beschrijving, locatie, geannuleerd }) {
  const t = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const tekst = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const vouw = (regel) => { const uit = []; let r = regel; while (Buffer.byteLength(r) > 74) { let n = 74; while (Buffer.byteLength(r.slice(0, n)) > 74) n--; uit.push(r.slice(0, n)); r = " " + r.slice(n); } uit.push(r); return uit.join("\r\n"); };
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Avezaat & Evers//Kennismaking//NL", "CALSCALE:GREGORIAN", `METHOD:${geannuleerd ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT", `UID:${uid}@avezaatenevers.nl`, `SEQUENCE:${seq}`, `DTSTAMP:${t(new Date().toISOString())}`, `DTSTART:${t(start)}`, `DTEND:${t(eind)}`,
    `SUMMARY:${tekst(titel)}`, `DESCRIPTION:${tekst(beschrijving)}`, locatie ? `LOCATION:${tekst(locatie)}` : "", locatie && /^https:\/\//.test(locatie || "") ? `URL:${locatie}` : "",
    `STATUS:${geannuleerd ? "CANCELLED" : "CONFIRMED"}`, "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).map(vouw).join("\r\n") + "\r\n";
}

