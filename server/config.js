import fs from 'node:fs';
import path from 'node:path';

// Tiny .env loader means the MVP needs no packages.
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}
export const config = {
  port: Number(process.env.PORT || 8787),
  demoMode: (process.env.DEMO_MODE || 'true').toLowerCase() === 'true',
  // Which LLM backend generateStructured() (server/services/llm.js) talks
  // to. "openai" (default) uses LLM_API_KEY/LLM_BASE_URL/LLM_MODEL below.
  // "ollama" talks to a local Ollama server instead — no API key needed,
  // but it has no web_search tool, so verification relies on the model's
  // own knowledge only. Selected here, not scattered across call sites:
  // this is the one place that decides which provider is active.
  llmProvider: (process.env.LLM_PROVIDER || 'openai').toLowerCase(),
  llmKey: process.env.LLM_API_KEY,
  llmBaseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
  llmModel: process.env.LLM_MODEL || 'gpt-5.6-luna',
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  // Accepts either a plain Ollama model name ("qwen2.5-coder:3b") or a
  // LiteLLM-style "provider/model" id ("ollama_chat/qwen2.5-coder:3b") —
  // only the part after the last "/" is used, since Ollama's own API takes
  // just the model name.
  ollamaModel: (process.env.OLLAMA_MODEL || 'qwen2.5-coder:3b').split('/').pop()
};
