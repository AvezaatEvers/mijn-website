// Aan- en afmelden voor pushmeldingen, voorkeuren per persoon en een testmelding.
// De edge function voor /intern/* controleert de inlog al; hier doen we dat voor de zekerheid nog een keer.
import { getStore } from "@netlify/blobs";
import { ingelogd, COOKIE } from "../intern-logica.js";
import { laadPush, bewaarPush, voorkeurVan, stuur, SOORTEN } from "../push.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

function cookie(request, naam) {
  const c = request.headers.get("cookie") || "";
  const m = c.split(/;\s*/).find((x) => x.startsWith(naam + "="));
  return m ? decodeURIComponent(m.slice(naam.length + 1)) : null;
}
const geldigEindpunt = (u) => { try { const x = new URL(u); return x.protocol === "https:" && u.length < 1000; } catch { return false; } };

export async function pushApi(request, wie, store) {
  const url = new URL(request.url);
  const pad = url.pathname;

  if (pad === "/intern/api/push/test" && request.method === "POST") {
    const r = await stuur(store, [wie], "test", { title: "Het werkt", body: "Je krijgt meldingen van Avezaat & Evers op dit apparaat.", url: "/intern/" });
    return json(r);
  }
  if (pad !== "/intern/api/push") return json({ fout: "Onbekend" }, 404);

  const d = await laadPush(store);
  if (request.method === "GET") {
    const eindpunt = url.searchParams.get("eindpunt");
    return json({
      publicKey: d.vapid.publicKey,
      soorten: SOORTEN,
      voorkeuren: voorkeurVan(d, wie),
      apparaten: d.abonnementen.filter((a) => a.wie === wie).map((a) => ({ apparaat: a.apparaat, op: a.op, ditApparaat: a.endpoint === eindpunt })),
    });
  }
  const body = request.method === "DELETE" ? Object.fromEntries(url.searchParams) : await request.json().catch(() => ({}));

  if (request.method === "POST") {
    const ab = body.abonnement || {};
    if (!geldigEindpunt(ab.endpoint) || !ab.keys || !ab.keys.p256dh || !ab.keys.auth) return json({ fout: "Ongeldig abonnement" }, 400);
    d.abonnementen = d.abonnementen.filter((a) => a.endpoint !== ab.endpoint);
    d.abonnementen.push({ wie, endpoint: ab.endpoint, keys: { p256dh: String(ab.keys.p256dh).slice(0, 200), auth: String(ab.keys.auth).slice(0, 100) },
      apparaat: String(body.apparaat || "Onbekend apparaat").replace(/[<>]/g, "").slice(0, 60), op: new Date().toISOString() });
    await bewaarPush(store, d);
    return json({ ok: true });
  }
  if (request.method === "DELETE") {
    d.abonnementen = d.abonnementen.filter((a) => !(a.endpoint === body.eindpunt && a.wie === wie));
    await bewaarPush(store, d);
    return json({ ok: true });
  }
  if (request.method === "PATCH") {
    const v = body.voorkeuren || {};
    d.voorkeuren[wie] = Object.fromEntries(Object.keys(SOORTEN).map((s) => [s, s in v ? !!v[s] : voorkeurVan(d, wie)[s]]));
    await bewaarPush(store, d);
    return json({ voorkeuren: d.voorkeuren[wie] });
  }
  return json({ fout: "Methode niet toegestaan" }, 405);
}

export default async (request) => {
  const wie = await ingelogd(cookie(request, COOKIE));
  if (!wie) return json({ fout: "Niet ingelogd" }, 401);
  return pushApi(request, wie, getStore({ name: "intern", consistency: "strong" }));
};

export const config = { path: ["/intern/api/push", "/intern/api/push/*"] };
