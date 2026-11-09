// Serves the storefront and mints short-lived ElevenLabs session credentials,
// so the API key never reaches the browser.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { loadEnv, readCatalog, ROOT } from "./lib/env.mjs";

loadEnv();
const PORT = Number(process.env.PORT || 5173);
const PUBLIC = path.join(ROOT, "public");
const VENDOR = path.join(ROOT, "node_modules/@elevenlabs/client/dist/lib.iife.js");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function elevenlabs(url) {
  const res = await fetch(`https://api.elevenlabs.io${url}`, { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

async function session(res, transport) {
  const agent = process.env.ELEVENLABS_AGENT_ID;
  if (!process.env.ELEVENLABS_API_KEY || !agent) {
    return send(res, 503, { error: "not_configured", message: "Add ELEVENLABS_API_KEY to .env and run npm run setup-agent." });
  }
  // WebRTC gives the best audio (echo cancellation, low latency); fall back to a WebSocket signed URL.
  // Text-only sessions ask for ?transport=websocket.
  try {
    if (transport === "websocket") throw new Error("websocket requested");
    const { token } = await elevenlabs(`/v1/convai/conversation/token?agent_id=${encodeURIComponent(agent)}`);
    return send(res, 200, { conversationToken: token, connectionType: "webrtc" });
  } catch (webrtcError) {
    try {
      const { signed_url } = await elevenlabs(`/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agent)}`);
      return send(res, 200, { signedUrl: signed_url, connectionType: "websocket" });
    } catch (wsError) {
      console.error("Session error:", webrtcError.message, "|", wsError.message);
      return send(res, 502, { error: "session_failed", message: wsError.message });
    }
  }
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/session") return session(res, url.searchParams.get("transport"));
    if (url.pathname === "/api/catalog") return send(res, 200, readCatalog());
    if (url.pathname === "/vendor/elevenlabs.js") return send(res, 200, fs.readFileSync(VENDOR, "utf8"), TYPES[".js"]);

    const file = path.join(PUBLIC, url.pathname === "/" ? "index.html" : url.pathname);
    if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, "Not found", "text/plain");
    send(res, 200, fs.readFileSync(file), TYPES[path.extname(file)] || "application/octet-stream");
  })
  .listen(PORT, () => console.log(`Sales rep running at http://localhost:${PORT}`));
