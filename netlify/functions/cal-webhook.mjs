// Cal.com-webhook: na boeken, verzetten of annuleren van een afspraak
// 1. stuurt de bezoeker een mail in onze huisstijl (met videolink, verzet- en annuleerlink en een agenda-bijlage),
// 2. zet de afspraak in het dashboard (lead aanmaken of bijwerken, notitie op de tijdlijn),
// 3. stuurt Koen en Daan een pushmelding en schrijft een regel in het logboek.
//
// Instellen in Cal.com: Settings → Developer → Webhooks → New
//   Subscriber URL: https://avezaatenevers.nl/api/cal-webhook
//   Triggers: Booking Created, Booking Rescheduled, Booking Cancelled
//   Secret: dezelfde waarde als CAL_WEBHOOK_SECRET in Netlify (Site configuration → Environment variables)
import { getStore } from "@netlify/blobs";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mails } from "./lib/mails.js";
import { verstuur, BASE } from "../klant-mails.js";
import { stuur, MENSEN } from "../push.js";
import { log } from "../logboek.js";

const CAL = "https://cal.com";
const TZ = "Europe/Amsterdam";
const SOORT = { BOOKING_CREATED: "gepland", BOOKING_RESCHEDULED: "verzet", BOOKING_CANCELLED: "geannuleerd" };

const schoon = (s, n = 200) => String(s || "").replace(/[<>]/g, "").trim().slice(0, n);
const mailadres = (e) => { const v = String(e || "").trim().toLowerCase(); return /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/.test(v) ? v : ""; };
const https = (u) => (/^https:\/\/[^\s"<>]+$/.test(String(u || "").trim()) ? String(u).trim() : "");
const nieuweId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

function handtekeningKlopt(ruw, kop, geheim) {
  const verwacht = Buffer.from(createHmac("sha256", geheim).update(ruw).digest("hex"));
  const gekregen = Buffer.from(String(kop || "").trim().replace(/^sha256=/, ""));
  return gekregen.length === verwacht.length && timingSafeEqual(gekregen, verwacht);
}

// "donderdag 3 december om 14:00", in de tijdzone van de bezoeker (Nederland als die onbekend is)
function wanneer(iso, tz) {
  let zone = TZ;
  try { if (tz) { new Intl.DateTimeFormat("nl-NL", { timeZone: tz }); zone = tz; } } catch { /* onbekende tijdzone */ }
  const d = new Date(iso);
  const dag = d.toLocaleDateString("nl-NL", { timeZone: zone, weekday: "long", day: "numeric", month: "long" });
  const tijd = d.toLocaleTimeString("nl-NL", { timeZone: zone, hour: "2-digit", minute: "2-digit" });
  return `${dag} om ${tijd}${zone !== TZ ? ` (${zone})` : ""}`;
}

// Agenda-bijlage (.ics). Eén vaste UID per afspraak, zodat verzetten en annuleren het bestaande agenda-item bijwerken.
function ics({ uid, seq, start, eind, titel, beschrijving, locatie, geannuleerd }) {
  const t = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const tekst = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const vouw = (regel) => { const uit = []; let r = regel; while (Buffer.byteLength(r) > 74) { let n = 74; while (Buffer.byteLength(r.slice(0, n)) > 74) n--; uit.push(r.slice(0, n)); r = " " + r.slice(n); } uit.push(r); return uit.join("\r\n"); };
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Avezaat & Evers//Kennismaking//NL", "CALSCALE:GREGORIAN", `METHOD:${geannuleerd ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT", `UID:${uid}@avezaatenevers.nl`, `SEQUENCE:${seq}`, `DTSTAMP:${t(new Date().toISOString())}`, `DTSTART:${t(start)}`, `DTEND:${t(eind)}`,
    `SUMMARY:${tekst(titel)}`, `DESCRIPTION:${tekst(beschrijving)}`, locatie ? `LOCATION:${tekst(locatie)}` : "", locatie && https(locatie) ? `URL:${locatie}` : "",
    `STATUS:${geannuleerd ? "CANCELLED" : "CONFIRMED"}`, "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).map(vouw).join("\r\n") + "\r\n";
}

export default async (req) => {
  if (req.method !== "POST") return new Response("alleen POST", { status: 405 });
  const geheim = process.env.CAL_WEBHOOK_SECRET;
  if (!geheim) { console.error("Cal.com-webhook: CAL_WEBHOOK_SECRET ontbreekt in Netlify"); return new Response("niet ingesteld", { status: 500 }); }
  const ruw = await req.text();
  if (!handtekeningKlopt(ruw, req.headers.get("x-cal-signature-256"), geheim)) return new Response("ongeldige handtekening", { status: 401 });

  let body;
  try { body = JSON.parse(ruw); } catch { return new Response("geen JSON", { status: 400 }); }
  if (body.triggerEvent === "PING") return new Response("pong");
  const soort = SOORT[body.triggerEvent];
  if (!soort) return new Response("overgeslagen");

  const b = body.payload || {};
  const gast = (Array.isArray(b.attendees) && b.attendees[0]) || {};
  const r = b.responses || {};
  const email = mailadres(gast.email || (r.email && r.email.value));
  const naam = schoon(gast.name || (r.name && (r.name.value || r.name)), 120);
  const uid = /^[A-Za-z0-9_-]{6,80}$/.test(b.uid || "") ? b.uid : "";
  if (!b.startTime || !uid) { console.error("Cal.com-webhook: geen starttijd of uid", body.triggerEvent); return new Response("onvolledig", { status: 400 }); }
  const org = String((b.organizer && (b.organizer.name + " " + b.organizer.email)) || "").toLowerCase();
  const wie = /daan/.test(org) ? "daan" : /koen/.test(org) ? "koen" : "";
  const video = https((b.metadata && b.metadata.videoCallUrl) || (b.videoCallData && b.videoCallData.url) || b.location);
  const telefoon = schoon((r.attendeePhoneNumber && r.attendeePhoneNumber.value) || (/^\+?[\d\s()-]{8,}$/.test(b.location || "") ? b.location : ""), 30);
  const duur = Math.max(5, Math.round((new Date(b.endTime || b.startTime) - new Date(b.startTime)) / 60000) || 20);
  const verzet = `${CAL}/reschedule/${uid}`, annuleer = `${CAL}/booking/${uid}?cancel=true`;
  const tekstWanneer = wanneer(b.startTime, gast.timeZone);

  const store = getStore({ name: "intern", consistency: "strong" });
  // Cal.com kan een webhook opnieuw sturen: elke boeking en gebeurtenis maar één keer verwerken
  const eerste = await store.setJSON(`cal/${uid}/${soort}`, new Date().toISOString(), { onlyIfNew: true });
  if (eerste && eerste.modified === false) return new Response("al verwerkt");

  // Dashboard: lead aanmaken of bijwerken
  const klanten = (await store.get("klanten", { type: "json" })) || [];
  const nu = new Date().toISOString();
  let k = email ? klanten.find((x) => x.email === email) : null;
  const nieuw = !k && soort !== "geannuleerd";
  if (nieuw) {
    k = { id: nieuweId(), naam, bedrijf: "", email, telefoon, boekhouder: wie, status: "prospect", start: "", voorstelLink: "", notitie: "", uit: [], verstuurd: {}, log: [], tijdlijn: [], door: "formulier", aangemaakt: nu, herkomst: "website", lead: { bron: "afspraak", op: nu } };
    klanten.push(k);
  }
  // Bij verzetten maakt Cal.com een nieuwe boeking; we houden de agenda-UID van de eerste vast
  const vorige = k && k.afspraak && (k.afspraak.uid === uid || k.afspraak.uid === b.rescheduleUid || k.afspraak.uid === b.fromReschedule) ? k.afspraak : null;
  const icsUid = vorige ? vorige.icsUid : uid;
  const seq = vorige ? (vorige.seq || 0) + 1 : 0;
  if (k) {
    if (soort !== "geannuleerd" && k.status !== "klant") { if (k.status !== "prospect") k.status = "prospect"; if (!k.lead) k.lead = { bron: "afspraak", op: nu }; }
    if (!k.telefoon && telefoon) k.telefoon = telefoon;
    if (!k.naam && naam) k.naam = naam;
    if (!k.boekhouder && wie) k.boekhouder = wie;
    k.afspraak = { uid, icsUid, seq, start: b.startTime, eind: b.endTime || b.startTime, status: soort, video, verzet, annuleer, wie, op: nu };
    k.tijdlijn = k.tijdlijn || [];
    const w = wanneer(b.startTime);
    const tekst = soort === "gepland" ? `Kennismaking gepland via Cal.com: ${w}`
      : soort === "verzet" ? `Kennismaking verzet via Cal.com naar ${w}`
      : `Kennismaking van ${w} geannuleerd via Cal.com${b.cancellationReason ? ". Reden: " + schoon(b.cancellationReason, 300) : ""}`;
    k.tijdlijn.unshift({ id: nieuweId(), soort: "notitie", door: "formulier", op: nu, tekst });
  }

  // Mail naar de bezoeker
  let mailOk = null;
  if (email) {
    const d = { naam, wie, wanneer: tekstWanneer, duur, video, telefoon, verzet, annuleer, reden: soort === "geannuleerd" ? schoon(b.cancellationReason, 300) : "" };
    const m = soort === "gepland" ? mails.afspraak(d, BASE) : soort === "verzet" ? mails.afspraakVerzet(d, BASE) : mails.afspraakGeannuleerd(d, BASE);
    const agenda = ics({ uid: icsUid, seq, start: b.startTime, eind: b.endTime || b.startTime, geannuleerd: soort === "geannuleerd", locatie: video || (telefoon ? "Telefonisch" : ""),
      titel: "Kennismaking Avezaat & Evers" + (wie ? ` met ${wie === "daan" ? "Daan" : "Koen"}` : ""),
      beschrijving: `${video ? "Deelnemen: " + video + "\n" : ""}Ander moment kiezen: ${verzet}\nAnnuleren: ${annuleer}\n\nVragen? App of bel 085 060 4363.` });
    const res = await verstuur((x) => process.env[x], {
      aan: email, mail: m,
      bijlagen: [{ filename: soort === "geannuleerd" ? "kennismaking-geannuleerd.ics" : "kennismaking.ics", content: Buffer.from(agenda).toString("base64"), content_type: `text/calendar; method=${soort === "geannuleerd" ? "CANCEL" : "PUBLISH"}; charset=UTF-8` }],
    });
    mailOk = res.ok;
    if (!res.ok) console.error("Cal.com-webhook: mail niet verstuurd:", res.fout);
    if (k) {
      k.log = k.log || [];
      k.log.unshift({ type: "afspraak", onderwerp: m.subject, aan: email, op: nu, door: "gepland", test: false, ok: res.ok, fout: res.fout || null });
      k.log = k.log.slice(0, 100);
    }
  }

  await store.setJSON("klanten", klanten);
  const klantNaam = (k && (k.bedrijf || k.naam)) || naam || "Iemand";
  await log(store, { wie: "systeem", soort: "klant", klant: k,
    tekst: `Kennismaking ${soort} via Cal.com (${wanneer(b.startTime)})${nieuw ? ", lead aangemaakt" : ""}${mailOk === true ? ", bevestiging gemaild" : mailOk === false ? ", mail mislukt" : ""}` });

  // Pushmelding
  try {
    const kort = new Date(b.startTime).toLocaleString("nl-NL", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    await stuur(store, wie ? [wie] : MENSEN, "lead", {
      title: `Kennismaking ${soort}: ${klantNaam}`,
      body: soort === "geannuleerd" ? `Was ${kort}.${b.cancellationReason ? " Reden: " + schoon(b.cancellationReason, 100) : ""}` : `${kort}${wie ? " met " + (wie === "daan" ? "Daan" : "Koen") : ""}.`,
      url: k ? "/intern/klant.html?id=" + encodeURIComponent(k.id) : "/intern/klanten.html", tag: "afspraak-" + uid,
    });
  } catch (e) {
    console.error("Cal.com-webhook: push mislukt:", e.message);
  }
  return new Response("ok");
};

export const config = { path: "/api/cal-webhook" };
