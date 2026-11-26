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
import { TZ, wanneer, mailData, ics } from "./lib/afspraak.js";

const CAL = "https://cal.com";
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


export default async (req) => {
  if (req.method !== "POST") return new Response("alleen POST", { status: 405 });
  // Spaties, regeleinden en aanhalingstekens eromheen negeren: die gaan makkelijk mee bij kopiëren en plakken
  const geheim = String(process.env.CAL_WEBHOOK_SECRET || "").trim().replace(/^["']|["']$/g, "").trim();
  if (!geheim) { console.error("Cal.com-webhook: CAL_WEBHOOK_SECRET ontbreekt in Netlify"); return new Response("niet ingesteld", { status: 500 }); }
  const ruw = await req.text();
  let body;
  try { body = JSON.parse(ruw); } catch { return new Response("geen JSON", { status: 400 }); }
  const getekend = handtekeningKlopt(ruw, req.headers.get("x-cal-signature-256"), geheim);
  // De ping-test van Cal.com doet niets, dus die mag ook zonder (geldige) handtekening; we melden wel of de handtekening klopt
  if (body.triggerEvent === "PING") { console.log("Cal.com-webhook: ping ontvangen, handtekening " + (getekend ? "klopt" : "ontbreekt of klopt niet")); return new Response("pong"); }
  if (!getekend) {
    // Uitleg zonder de secret zelf te tonen: is er een handtekening, hoe lang is de secret, en de eerste tekens van de vingerafdruk
    const kop = String(req.headers.get("x-cal-signature-256") || "");
    const afdruk = createHmac("sha256", "vingerafdruk").update(geheim).digest("hex").slice(0, 6);
    console.error(`Cal.com-webhook: ongeldige handtekening bij ${body.triggerEvent}. Handtekening ${kop ? "aanwezig (" + kop.length + " tekens)" : "ONTBREEKT: staat er een secret in Cal.com?"}; secret in Netlify ${geheim.length} tekens, vingerafdruk ${afdruk}. Klopt CAL_WEBHOOK_SECRET met de secret in Cal.com?`);
    return new Response("ongeldige handtekening", { status: 401 });
  }
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
    k.afspraak = { uid, icsUid, seq, start: b.startTime, eind: b.endTime || b.startTime, status: soort, video, telefoon, tz: gast.timeZone || TZ, verzet, annuleer, wie, op: nu, herinnerd: null };
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
    const d = mailData({ naam, wie, start: b.startTime, eind: b.endTime, tz: gast.timeZone, video, telefoon, verzet, annuleer, reden: soort === "geannuleerd" ? schoon(b.cancellationReason, 300) : "" });
    const m = soort === "gepland" ? mails.afspraak(d, BASE) : soort === "verzet" ? mails.afspraakVerzet(d, BASE) : mails.afspraakGeannuleerd(d, BASE);
    const agenda = ics({ uid: icsUid, seq, start: b.startTime, eind: b.endTime || b.startTime, geannuleerd: soort === "geannuleerd", locatie: video || (telefoon ? "Telefonisch" : ""),
      titel: "Kennismaking Avezaat & Evers" + (wie ? ` met ${wie === "daan" ? "Daan" : "Koen"}` : " (Koen of Daan)"),
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
