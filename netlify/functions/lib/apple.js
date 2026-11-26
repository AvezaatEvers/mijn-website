// Koppeling met Apple Agenda (iCloud) via CalDAV, om bezette tijden uit de planner te halen.
// Koen en Daan vullen in het dashboard hun Apple ID en een app-specifiek wachtwoord in (appleid.apple.com)
// en kiezen welke agenda's meetellen. We lezen alleen óf een moment bezet is, niet wat er staat.
// Opslag (Blobs-store "intern"):
//   planner-apple  { koen: { appleId, wachtwoord (versleuteld), home, agendas: [{ href, naam, aan }], op } }
//   planner-bezet  { koen: { op, blokken: [[startMs, eindMs]], fout } }   (korte cache)
import ICAL from "ical.js";
import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { MENSEN, lokaalNaarUtc } from "./planner.js";

const ICLOUD = "https://caldav.icloud.com/";
const APPLE = "planner-apple", BEZET = "planner-bezet";
const VOORUIT_MS = 16 * 864e5;
const NIET_STANDAARD = /verjaardag|birthday|feestdag|holiday|herinnering|reminder/i;

// ---------- Versleuteling van het app-specifieke wachtwoord ----------
const sleutel = (env) => createHash("sha256").update("apple:" + String(env("PLANNER_SECRET") || env("RESEND_API_KEY") || "avezaat-evers-planner")).digest();
export function versleutel(env, tekst) {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", sleutel(env), iv);
  const data = Buffer.concat([c.update(String(tekst), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}
export function ontsleutel(env, waarde) {
  const [iv, tag, data] = String(waarde || "").split(".").map((x) => Buffer.from(x, "base64"));
  const d = createDecipheriv("aes-256-gcm", sleutel(env), iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}

// ---------- CalDAV ----------
const ontsnap = (s) => String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&#13;|&#xD;/gi, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const tag = (naam) => new RegExp(`<(?:[\\w-]+:)?${naam}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${naam}>`, "i");
const tags = (xml, naam) => { const re = new RegExp(tag(naam).source, "gi"); const uit = []; let m; while ((m = re.exec(xml))) uit.push(m[1]); return uit; };
const eerste = (xml, naam) => { const m = tag(naam).exec(xml); return m ? m[1] : ""; };

async function dav(methode, url, body, auth, diepte) {
  const r = await fetch(url, { method: methode, redirect: "follow", signal: AbortSignal.timeout(8000),
    headers: { Authorization: "Basic " + Buffer.from(auth.appleId + ":" + auth.wachtwoord).toString("base64"), Depth: String(diepte), "Content-Type": "application/xml; charset=utf-8" }, body });
  if (r.status === 401 || r.status === 403) throw new Error("Apple ID of app-specifiek wachtwoord klopt niet");
  if (r.status !== 207 && !r.ok) throw new Error("iCloud gaf fout " + r.status);
  return { xml: await r.text(), url: r.url || url };
}

// Agenda's van het account opzoeken. Geeft { home, agendas: [{ href, naam, aan }] }
export async function ontdek(appleId, wachtwoord) {
  const auth = { appleId, wachtwoord };
  const p = await dav("PROPFIND", ICLOUD, '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>', auth, 0);
  const principal = ontsnap(eerste(eerste(p.xml, "current-user-principal"), "href")).trim();
  if (!principal) throw new Error("Geen iCloud-agenda gevonden voor dit account");
  const h = await dav("PROPFIND", new URL(principal, p.url).href, '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>', auth, 0);
  const home = new URL(ontsnap(eerste(eerste(h.xml, "calendar-home-set"), "href")).trim(), h.url).href;
  const l = await dav("PROPFIND", home, '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:resourcetype/><d:displayname/><c:supported-calendar-component-set/></d:prop></d:propfind>', auth, 1);
  const agendas = [];
  for (const r of tags(l.xml, "response")) {
    const type = eerste(r, "resourcetype");
    if (!/<(?:[\w-]+:)?calendar\b/i.test(type) || /schedule-(inbox|outbox)/i.test(type)) continue;
    const comps = eerste(r, "supported-calendar-component-set");
    if (comps && !/VEVENT/i.test(comps)) continue;
    const href = new URL(ontsnap(eerste(r, "href")).trim(), home).href, naam = ontsnap(eerste(r, "displayname")).trim() || "Agenda";
    agendas.push({ href, naam, aan: !NIET_STANDAARD.test(naam) });
  }
  if (!agendas.length) throw new Error("Geen agenda's gevonden in dit iCloud-account");
  return { home, agendas };
}

const ics = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// Tijd uit de agenda naar milliseconden; zwevende tijden en hele dagen rekenen we in Nederlandse tijd
function ms(t) {
  if (t.isDate) return lokaalNaarUtc(`${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`, "00:00").getTime();
  const zwevend = !t.zone || t.zone === ICAL.Timezone.localTimezone || t.zone.tzid === "floating";
  if (zwevend) return lokaalNaarUtc(`${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`, `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`).getTime() + t.second * 1000;
  return t.toJSDate().getTime();
}

// Bezette blokken uit agenda-data (ICS-tekst van één of meer agenda-items), binnen [van, tot)
export function bezetUitIcs(teksten, van, tot) {
  const blokken = [], perUid = new Map();
  for (const tekst of teksten) {
    let comp;
    try { comp = new ICAL.Component(ICAL.parse(tekst)); } catch { continue; }
    for (const tz of comp.getAllSubcomponents("vtimezone")) { try { ICAL.TimezoneService.register(tz); } catch { /* al bekend */ } }
    for (const ev of comp.getAllSubcomponents("vevent")) {
      const uid = ev.getFirstPropertyValue("uid") || Math.random().toString(36);
      if (!perUid.has(uid)) perUid.set(uid, { hoofd: null, uitzonderingen: [] });
      if (ev.hasProperty("recurrence-id")) perUid.get(uid).uitzonderingen.push(ev); else perUid.get(uid).hoofd = ev;
    }
  }
  const telt = (c) => c && String(c.getFirstPropertyValue("transp") || "").toUpperCase() !== "TRANSPARENT" && String(c.getFirstPropertyValue("status") || "").toUpperCase() !== "CANCELLED";
  const voeg = (s, e) => { if (e > van && s < tot) blokken.push([Math.max(s, van), Math.min(e, tot)]); };
  for (const { hoofd, uitzonderingen } of perUid.values()) {
    if (!hoofd) { for (const u of uitzonderingen) { if (!telt(u)) continue; const e = new ICAL.Event(u); voeg(ms(e.startDate), ms(e.endDate || e.startDate)); } continue; }
    const ev = new ICAL.Event(hoofd);
    for (const u of uitzonderingen) { try { ev.relateException(u); } catch { /* ander uid */ } }
    if (!ev.isRecurring()) { if (telt(hoofd)) voeg(ms(ev.startDate), ms(ev.endDate || ev.startDate)); continue; }
    const it = ev.iterator();
    for (let i = 0, t; i < 3000 && (t = it.next()); i++) {
      if (ms(t) >= tot) break;
      const d = ev.getOccurrenceDetails(t);
      if (!telt(d.item.component)) continue;
      voeg(ms(d.startDate), ms(d.endDate || d.startDate));
    }
  }
  return blokken.sort((a, b) => a[0] - b[0]);
}

async function haalBezet(env, cfg, van, tot) {
  const auth = { appleId: cfg.appleId, wachtwoord: ontsleutel(env, cfg.wachtwoord) };
  const body = `<?xml version="1.0" encoding="utf-8"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="${ics(new Date(van))}" end="${ics(new Date(tot))}"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`;
  const delen = await Promise.all(cfg.agendas.filter((a) => a.aan).map((a) => dav("REPORT", a.href, body, auth, 1)));
  const teksten = delen.flatMap((d) => tags(d.xml, "calendar-data").map(ontsnap)).filter((t) => t.includes("BEGIN:VCALENDAR"));
  return bezetUitIcs(teksten, van, tot);
}

// ---------- Opslag en cache ----------
export async function leesApple(store) { return (await store.get(APPLE, { type: "json" })) || {}; }
export async function bewaarApple(store, a) { await store.setJSON(APPLE, a); }
export async function wisBezet(store, wie) { const b = (await store.get(BEZET, { type: "json" })) || {}; delete b[wie]; await store.setJSON(BEZET, b); }

// Bezette blokken per persoon: { koen: [[s, e]], daan: [...] }. Ververst wat ouder is dan maxOud (ms).
// Lukt iCloud even niet, dan gebruiken we de laatste bekende blokken (tot 24 uur oud).
export async function bezetVoor(store, env, maxOud = 5 * 60e3) {
  const [cfg, cache] = await Promise.all([leesApple(store), store.get(BEZET, { type: "json" }).then((x) => x || {})]);
  const nu = Date.now(), uit = {};
  let gewijzigd = false;
  await Promise.all(MENSEN.map(async (wie) => {
    const c = cfg[wie];
    if (!c || !c.appleId || !c.agendas || !c.agendas.some((a) => a.aan)) { uit[wie] = []; return; }
    const oud = cache[wie], leeftijd = (x) => (x ? nu - new Date(x).getTime() : Infinity);
    const bruikbaar = oud && oud.blokken && leeftijd(oud.laatstGoed) < 24 * 3600e3 ? oud.blokken : [];
    if (oud && !oud.fout && leeftijd(oud.op) < maxOud) { uit[wie] = oud.blokken; return; }
    // Na een fout pas na 2 minuten opnieuw proberen, zodat bezoekers niet steeds op iCloud wachten
    if (oud && oud.fout && leeftijd(oud.op) < 2 * 60e3) { uit[wie] = bruikbaar; return; }
    try {
      const blokken = await haalBezet(env, c, nu - 864e5, nu + VOORUIT_MS);
      const op = new Date().toISOString();
      cache[wie] = { op, laatstGoed: op, blokken, fout: null }; gewijzigd = true;
      uit[wie] = blokken;
    } catch (e) {
      console.error(`Apple Agenda (${wie}) niet gelezen:`, e.message);
      uit[wie] = bruikbaar;
      cache[wie] = { blokken: bruikbaar, laatstGoed: (oud && oud.laatstGoed) || null, fout: e.message, op: new Date().toISOString() };
      gewijzigd = true;
    }
  }));
  if (gewijzigd) await store.setJSON(BEZET, cache);
  return uit;
}

export async function bezetStatus(store) { return (await store.get(BEZET, { type: "json" })) || {}; }
