// Koppeling met Google Agenda: per kennismaking een agenda-item met een echte Google Meet-link.
// Koen en Daan koppelen elk hun eigen Google-account in het dashboard (Beschikbaarheid). Het agenda-item komt
// in de agenda van wie het gesprek doet; die is dan ook host van de Meet.
// Nodig in Netlify: GOOGLE_CLIENT_ID en GOOGLE_CLIENT_SECRET (OAuth-client uit Google Cloud).
// De refresh tokens staan in de Blobs-store onder "planner-google".
import { TZ, lokaalNaarUtc } from "./planner.js";

const SLEUTEL = "planner-google";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AGENDA = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
// meetings.space.created: om een Meet-ruimte op "Open" te zetten (iedereen met de link kan direct meedoen, ook zonder Google-account)
export const SCOPE = "openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/meetings.space.created";
const MEET = "https://meet.googleapis.com/v2/spaces";

export const googleIngesteld = (env) => !!(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET"));
export async function leesGoogle(store) { return (await store.get(SLEUTEL, { type: "json" })) || {}; }
export async function bewaarGoogle(store, g) { await store.setJSON(SLEUTEL, g); }

export function googleAuthUrl(env, redirect, state) {
  return "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"), redirect_uri: redirect, response_type: "code", scope: SCOPE,
    access_type: "offline", prompt: "consent", include_granted_scopes: "true", state,
  });
}

// Code uit de terugkoppeling inwisselen voor een refresh token (en het e-mailadres van het account)
export async function googleCode(env, code, redirect) {
  const r = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"), redirect_uri: redirect, grant_type: "authorization_code" }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.refresh_token) return { fout: j.error_description || j.error || (j.access_token ? "Google gaf geen refresh token; ontkoppel de app in je Google-account en probeer opnieuw" : "Koppelen mislukt (" + r.status + ")") };
  let email = "";
  try { email = JSON.parse(Buffer.from(String(j.id_token).split(".")[1], "base64url").toString()).email || ""; } catch { /* geen id_token */ }
  return { refresh: j.refresh_token, email };
}

async function toegang(env, refresh) {
  const r = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"), refresh_token: refresh, grant_type: "refresh_token" }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error("Google-toegang mislukt: " + (j.error_description || j.error || r.status) + (j.error === "invalid_grant" ? " (koppel Google opnieuw in het dashboard)" : ""));
  return j.access_token;
}

// Welk account gebruiken we: dat van wie het gesprek doet, anders dat van de ander
export function accountVoor(g, wie) {
  if (g[wie] && g[wie].refresh) return wie;
  return ["koen", "daan"].find((w) => g[w] && g[w].refresh) || "";
}

// Een Meet-ruimte met toegang "Open" aanmaken via de Meet-API. Geeft de link, of null als het niet lukt
// (bijvoorbeeld omdat de Meet-API nog niet aanstaat in Google Cloud of het account gekoppeld is vóór deze toestemming).
async function openMeet(at) {
  try {
    const r = await fetch(MEET, { method: "POST", headers: { Authorization: "Bearer " + at, "Content-Type": "application/json" },
      body: JSON.stringify({ config: { accessType: "OPEN", entryPointAccess: "ALL" } }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.meetingUri) { console.error("Meet-API: open ruimte niet gemaakt:", r.status, (j.error && j.error.message) || ""); return null; }
    return j.meetingUri;
  } catch (e) { console.error("Meet-API:", e.message); return null; }
}

const meetVan = (ev) => ev.hangoutLink || ((((ev.conferenceData || {}).entryPoints) || []).find((e) => e.entryPointType === "video") || {}).uri || "";

// Nieuw agenda-item met Meet-link. Geeft { eventId, meet, account } of gooit een fout.
export async function maakAfspraak(env, g, a, { titel, beschrijving }) {
  const account = accountVoor(g, a.wie);
  if (!account) throw new Error("Geen Google-account gekoppeld");
  const at = await toegang(env, g[account].refresh);
  // Voorkeur: een open Meet (geen aankloppen, geen account nodig). Lukt dat niet, dan een gewone Meet via de agenda.
  const open = await openMeet(at);
  if (open) {
    const r0 = await fetch(AGENDA + "?sendUpdates=none", {
      method: "POST", headers: { Authorization: "Bearer " + at, "Content-Type": "application/json" },
      body: JSON.stringify({ summary: titel, description: "Google Meet: " + open + "\n\n" + beschrijving, location: open, start: { dateTime: a.start, timeZone: TZ }, end: { dateTime: a.eind, timeZone: TZ },
        attendees: a.email ? [{ email: a.email, displayName: a.naam || undefined }] : [], guestsCanInviteOthers: false, guestsCanSeeOtherGuests: false }),
    });
    const ev0 = await r0.json().catch(() => ({}));
    if (!r0.ok) throw new Error("Google Agenda: " + ((ev0.error && ev0.error.message) || r0.status));
    return { eventId: ev0.id, meet: open, account, open: true };
  }
  const r = await fetch(AGENDA + "?conferenceDataVersion=1&sendUpdates=none", {
    method: "POST", headers: { Authorization: "Bearer " + at, "Content-Type": "application/json" },
    // De klant als gast (Google mailt niet: sendUpdates=none), zodat hij de Meet direct in kan zonder aan te kloppen
    body: JSON.stringify({ summary: titel, description: beschrijving, start: { dateTime: a.start, timeZone: TZ }, end: { dateTime: a.eind, timeZone: TZ },
      attendees: a.email ? [{ email: a.email, displayName: a.naam || undefined }] : [], guestsCanInviteOthers: false, guestsCanSeeOtherGuests: false,
      conferenceData: { createRequest: { requestId: "ae-" + a.id + "-" + Date.now(), conferenceSolutionKey: { type: "hangoutsMeet" } } } }),
  });
  let ev = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Google Agenda: " + ((ev.error && ev.error.message) || r.status));
  // De Meet-link is soms nog niet direct klaar
  for (let i = 0; i < 3 && !meetVan(ev); i++) {
    await new Promise((res) => setTimeout(res, 1200));
    const r2 = await fetch(AGENDA + "/" + encodeURIComponent(ev.id), { headers: { Authorization: "Bearer " + at } });
    if (r2.ok) ev = await r2.json();
  }
  return { eventId: ev.id, meet: meetVan(ev), account, open: false };
}

export async function verzetAfspraak(env, g, account, eventId, a) {
  if (!g[account] || !g[account].refresh) throw new Error("Google-account niet meer gekoppeld");
  const at = await toegang(env, g[account].refresh);
  const r = await fetch(AGENDA + "/" + encodeURIComponent(eventId) + "?sendUpdates=none", {
    method: "PATCH", headers: { Authorization: "Bearer " + at, "Content-Type": "application/json" },
    body: JSON.stringify({ start: { dateTime: a.start, timeZone: TZ }, end: { dateTime: a.eind, timeZone: TZ } }),
  });
  if (!r.ok) throw new Error("Google Agenda verzetten: " + r.status);
}

export async function verwijderAfspraak(env, g, account, eventId) {
  if (!g[account] || !g[account].refresh) return;
  const at = await toegang(env, g[account].refresh);
  const r = await fetch(AGENDA + "/" + encodeURIComponent(eventId) + "?sendUpdates=none", { method: "DELETE", headers: { Authorization: "Bearer " + at } });
  if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error("Google Agenda verwijderen: " + r.status);
}

// Bezette tijden uit de eigen (primaire) Google Agenda: [[startMs, eindMs, eventId]].
// Telt niet mee: afspraken op "Beschikbaar" (transparent, standaard bij hele-dag-items), geannuleerde en afgeslagen uitnodigingen.
// Hiervoor is calendar.events genoeg (lezen mag met die toestemming).
export async function bezetUitGoogle(env, g, wie, van, tot) {
  if (!g[wie] || !g[wie].refresh) return [];
  const at = await toegang(env, g[wie].refresh);
  const blokken = [];
  let pagina = "";
  for (let i = 0; i < 5; i++) {
    const q = new URLSearchParams({ timeMin: new Date(van).toISOString(), timeMax: new Date(tot).toISOString(), singleEvents: "true", maxResults: "2500", showDeleted: "false",
      fields: "items(id,status,transparency,start,end,attendees(self,responseStatus)),nextPageToken", ...(pagina ? { pageToken: pagina } : {}) });
    const r = await fetch(AGENDA + "?" + q, { headers: { Authorization: "Bearer " + at }, signal: AbortSignal.timeout(10000) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error("Google Agenda lezen: " + ((j.error && j.error.message) || r.status));
    for (const ev of j.items || []) {
      if (ev.status === "cancelled" || ev.transparency === "transparent") continue;
      if ((ev.attendees || []).some((x) => x.self && x.responseStatus === "declined")) continue;
      const s = ev.start && (ev.start.dateTime ? Date.parse(ev.start.dateTime) : ev.start.date ? lokaalNaarUtc(ev.start.date, "00:00").getTime() : NaN);
      const e = ev.end && (ev.end.dateTime ? Date.parse(ev.end.dateTime) : ev.end.date ? lokaalNaarUtc(ev.end.date, "00:00").getTime() : NaN);
      if (Number.isFinite(s) && Number.isFinite(e) && e > s) blokken.push([s, e, ev.id]);
    }
    if (!j.nextPageToken) break;
    pagina = j.nextPageToken;
  }
  return blokken;
}
