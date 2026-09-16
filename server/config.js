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
  llmKey: process.env.LLM_API_KEY,
  llmBaseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
  llmModel: process.env.LLM_MODEL || 'gpt-5.6-luna'
};
