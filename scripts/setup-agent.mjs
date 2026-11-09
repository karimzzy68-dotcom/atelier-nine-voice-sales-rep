// Creates (or updates) the ElevenLabs voice agent from catalog.json and lib/prompt.mjs.
// Usage: npm run setup-agent            create or update the agent
//        npm run setup-agent -- voices   list voices you can put in VOICE_ID
import { loadEnv, setEnvValue, readCatalog } from "../lib/env.mjs";
import { buildPrompt, firstMessage, clientTools } from "../lib/prompt.mjs";

loadEnv();
const API = "https://api.elevenlabs.io";
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) {
  console.error("Missing ELEVENLABS_API_KEY. Copy .env.example to .env and paste your key.");
  process.exit(1);
}

async function call(method, url, body) {
  const res = await fetch(API + url, {
    method,
    headers: { "xi-api-key": KEY, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json };
}

if (process.argv[2] === "voices") {
  const { ok, json } = await call("GET", "/v1/voices");
  if (!ok) { console.error(json); process.exit(1); }
  for (const v of json.voices) {
    const l = v.labels || {};
    console.log(`${v.voice_id}  ${v.name.padEnd(28)} ${[l.gender, l.accent, l.age, l.descriptive || l.description, l.use_case].filter(Boolean).join(", ")}`);
  }
  process.exit(0);
}

const catalog = readCatalog();
// Sarah: a warm, natural, conversational premade voice. Override with VOICE_ID.
const voiceId = process.env.VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
// Most expressive model first; later entries are fallbacks if your account does not have it.
const ttsModels = [process.env.TTS_MODEL, "eleven_v3_conversational", "eleven_turbo_v2", "eleven_flash_v2"].filter(Boolean);
const llms = [process.env.LLM, "claude-sonnet-4-5", "gpt-4.1", "gemini-2.5-flash"].filter(Boolean);

function config({ ttsModel, llm, inlineTools, toolIds, voiceTuning }) {
  const prompt = { prompt: buildPrompt(catalog), temperature: 0.7 };
  if (llm) prompt.llm = llm;
  if (inlineTools) prompt.tools = clientTools;
  if (toolIds) prompt.tool_ids = toolIds;
  const tts = { voice_id: voiceId };
  if (ttsModel) tts.model_id = ttsModel;
  if (voiceTuning) Object.assign(tts, { stability: 0.4, similarity_boost: 0.8, speed: 1.0 });
  return {
    name: `${catalog.store.name} - ${catalog.store.rep}`,
    conversation_config: {
      agent: { first_message: firstMessage(catalog), language: "en", prompt },
      tts,
      turn: { turn_timeout: 10 },
      conversation: { max_duration_seconds: 900 },
    },
  };
}

let toolIds = null;
async function ensureToolIds() {
  if (toolIds) return toolIds;
  const existing = await call("GET", "/v1/convai/tools");
  const byName = new Map((existing.json.tools || []).map((t) => [t.tool_config?.name, t.id]));
  toolIds = [];
  for (const tool of clientTools) {
    if (byName.has(tool.name)) {
      await call("PATCH", `/v1/convai/tools/${byName.get(tool.name)}`, { tool_config: tool });
      toolIds.push(byName.get(tool.name));
      continue;
    }
    const r = await call("POST", "/v1/convai/tools", { tool_config: tool });
    if (!r.ok) throw new Error(`Could not create tool ${tool.name}: ${JSON.stringify(r.json)}`);
    toolIds.push(r.json.id);
  }
  return toolIds;
}

// Try the richest configuration first, then step down until the API accepts it.
const attempts = [];
for (const ttsModel of [...ttsModels, null]) {
  for (const llm of [...llms, null]) attempts.push({ ttsModel, llm, voiceTuning: true });
}
attempts.push({ ttsModel: null, llm: null, voiceTuning: false });

const agentId = process.env.ELEVENLABS_AGENT_ID;
let lastError;
for (const a of attempts) {
  for (const toolMode of ["inline", "ids"]) {
    const opts = { ...a, inlineTools: toolMode === "inline" };
    if (toolMode === "ids") {
      try { opts.toolIds = await ensureToolIds(); } catch (e) { lastError = e.message; continue; }
    }
    const body = config(opts);
    const r = agentId
      ? await call("PATCH", `/v1/convai/agents/${agentId}`, body)
      : await call("POST", "/v1/convai/agents/create", body);
    if (r.ok) {
      const id = agentId || r.json.agent_id;
      setEnvValue("ELEVENLABS_AGENT_ID", id);
      console.log(`${agentId ? "Updated" : "Created"} agent ${id}`);
      console.log(`  voice: ${voiceId}, tts model: ${a.ttsModel || "account default"}, llm: ${a.llm || "account default"}, tools: ${toolMode}`);
      console.log("Now run: npm start");
      process.exit(0);
    }
    lastError = `${r.status} ${JSON.stringify(r.json).slice(0, 400)}`;
    if (r.status === 401 || r.status === 403) {
      console.error("ElevenLabs rejected the API key:", lastError);
      console.error("Check the key, and that it has Conversational AI / Agents permissions.");
      process.exit(1);
    }
  }
}
console.error("Could not create the agent. Last error:", lastError);
process.exit(1);
