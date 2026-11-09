// Prompts for the ElevenLabs API key without echoing it, and saves it to .env.
import { setEnvValue } from "../lib/env.mjs";

process.stdout.write("Paste your ElevenLabs API key (hidden), then press Enter: ");
const stdin = process.stdin;
stdin.setRawMode?.(true);
stdin.resume();
stdin.setEncoding("utf8");

let key = "";
stdin.on("data", (chunk) => {
  for (const ch of chunk) {
    if (ch === "\r" || ch === "\n") {
      stdin.setRawMode?.(false);
      stdin.pause();
      key = key.trim();
      process.stdout.write("\n");
      if (!key) {
        console.error("No key entered. Nothing saved.");
        process.exit(1);
      }
      setEnvValue("ELEVENLABS_API_KEY", key);
      console.log(`Saved key ending in …${key.slice(-4)} to .env`);
      process.exit(0);
    } else if (ch === "\u0003") {
      process.stdout.write("\nCancelled.\n");
      process.exit(1);
    } else if (ch === "\u007f" || ch === "\b") {
      key = key.slice(0, -1);
    } else {
      key += ch;
    }
  }
});
