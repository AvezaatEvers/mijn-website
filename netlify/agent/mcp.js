// Koppeling met Claude (custom connector, MCP via Streamable HTTP, zonder sessies).
// Ieder heeft een eigen geheime sleutel (aan te maken op /intern/claude.html), zodat we zien wie wat deed.
// De sleutel staat in de URL (/mcp/ae_...) of in de header Authorization: Bearer ae_...
import { agentHulp } from "../intern-logica.js";
import { mcpTools, mcpUitvoeren, wieBijSleutel, sleutelGebruikt } from "./agent.js";

const VERSIES = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const NAMEN = { koen: "Koen", daan: "Daan" };

function antwoord(data, status = 200, extra = {}) {
  return new Response(data === null ? null : JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra } });
}
const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const fout = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

function uitleg(wie) {
  return `Dit is het interne dashboard van Avezaat & Evers, het boekhoudkantoor van Koen Avezaat en Daan Evers (zzp'ers en eenmanszaken, MoneyMonk, € 80 per maand, vaste boekhouder).
Je werkt nu namens ${NAMEN[wie]}. Alles wat je via deze tools wijzigt, staat in het dashboard op naam van ${NAMEN[wie]} met het label 'via Claude', zodat Koen en Daan van elkaar zien wie wat deed.
- Zoek klanten altijd eerst op (zoek_klanten) voordat je een klant_id gebruikt. Gok nooit over klanten, cijfers of wat er al gebeurd is.
- Wijzigingen (klant toevoegen of bijwerken, mails, contact, notities, taken) gaan direct. Vat bij mails ontvanger, onderwerp en inhoud eerst samen en vraag akkoord; bied test=true aan bij twijfel.
- Voor 'wie heeft wat gedaan' gebruik je activiteit.
- Links naar het dashboard beginnen met https://avezaatenevers.nl/intern/.`;
}

export async function mcpVerwerk(request, store, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return antwoord(null, 204, { Allow: "POST" });
  if (request.method !== "POST") return antwoord({ fout: "Deze koppeling werkt alleen met POST (MCP Streamable HTTP, zonder SSE)" }, 405, { Allow: "POST" });

  const kop = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const uitPad = url.pathname.split("/").filter(Boolean)[1] || "";
  const wie = await wieBijSleutel(store, kop || uitPad);
  if (!wie) return antwoord({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Onbekende of ingetrokken sleutel. Maak een nieuwe aan op /intern/claude.html." } }, 401);

  let bericht;
  try { bericht = await request.json(); } catch { return antwoord(fout(null, -32700, "Ongeldige JSON"), 400); }
  const h = agentHulp(env);

  const een = async (m) => {
    if (!m || m.jsonrpc !== "2.0" || typeof m.method !== "string") return m && m.id !== undefined ? fout(m.id, -32600, "Ongeldig verzoek") : null;
    const isMelding = m.id === undefined || m.id === null;
    switch (m.method) {
      case "initialize": {
        await sleutelGebruikt(store, wie).catch(() => {});
        const gevraagd = m.params && m.params.protocolVersion;
        return ok(m.id, { protocolVersion: VERSIES.includes(gevraagd) ? gevraagd : VERSIES[0], capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "avezaat-evers", title: "Avezaat & Evers dashboard", version: "1.0.0" }, instructions: uitleg(wie) });
      }
      case "ping": return isMelding ? null : ok(m.id, {});
      case "tools/list": return ok(m.id, { tools: mcpTools() });
      case "tools/call": {
        const naam = m.params && m.params.name, args = (m.params && m.params.arguments) || {};
        try {
          const r = await mcpUitvoeren(naam, args, wie, store, env, h);
          const isFout = !!(r && r.fout && Object.keys(r).length <= 3);
          return ok(m.id, { content: [{ type: "text", text: JSON.stringify(r, null, 1).slice(0, 60000) }], isError: isFout });
        } catch (e) {
          console.log("MCP-tool mislukt", naam, e && e.message);
          return ok(m.id, { content: [{ type: "text", text: "Mislukt: " + String((e && e.message) || e).slice(0, 300) }], isError: true });
        }
      }
      case "resources/list": return ok(m.id, { resources: [] });
      case "prompts/list": return ok(m.id, { prompts: [] });
      default:
        if (isMelding) return null; // notifications/initialized e.d.
        return fout(m.id, -32601, "Onbekende methode: " + m.method);
    }
  };

  if (Array.isArray(bericht)) {
    const uit = (await Promise.all(bericht.map(een))).filter(Boolean);
    return uit.length ? antwoord(uit) : antwoord(null, 202);
  }
  const r = await een(bericht);
  return r ? antwoord(r) : antwoord(null, 202);
}
