// Koppeling met Claude (custom connector via MCP). De logica staat in netlify/agent/mcp.js.
import { getStore } from "@netlify/blobs";
import { mcpVerwerk } from "../agent/mcp.js";

export default (request) => mcpVerwerk(request, getStore({ name: "intern", consistency: "strong" }), (k) => process.env[k]);

export const config = { path: ["/mcp", "/mcp/*"] };
