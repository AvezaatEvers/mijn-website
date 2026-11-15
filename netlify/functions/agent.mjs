// Het gesprek met de A&E-agent. Draait als gewone Netlify Function (Node), omdat edge functions
// maar 50 ms rekentijd per verzoek hebben. De edge function voor /intern/* controleert eerst de inlog;
// hier controleren we die voor de zekerheid nog een keer.
import { getStore } from "@netlify/blobs";
import { ingelogd, agentHulp, COOKIE } from "../intern-logica.js";
import { agentGesprek } from "../agent/agent.js";

function cookie(request, naam) {
  const c = request.headers.get("cookie") || "";
  const m = c.split(/;\s*/).find((x) => x.startsWith(naam + "="));
  return m ? decodeURIComponent(m.slice(naam.length + 1)) : null;
}

export default async (request) => {
  if (request.method !== "POST") return new Response(JSON.stringify({ fout: "Methode niet toegestaan" }), { status: 405, headers: { "Content-Type": "application/json" } });
  const wie = await ingelogd(cookie(request, COOKIE));
  if (!wie) return new Response(JSON.stringify({ fout: "Niet ingelogd" }), { status: 401, headers: { "Content-Type": "application/json" } });
  const env = (k) => process.env[k];
  return agentGesprek(request, wie, getStore({ name: "intern", consistency: "strong" }), env, agentHulp(env));
};

export const config = { path: "/intern/api/agent" };
