import { config } from '../config.js';

export function parseModelJson(value) {
  const raw = String(value || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  const start = raw.search(/[\[{]/); const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
  if (start < 0 || end < start) throw new Error('Model did not return JSON');
  return JSON.parse(raw.slice(start, end + 1));
}
export async function generateStructured(prompt, { webSearch = false } = {}) {
  if (!config.llmKey) throw new Error('LLM_API_KEY is not configured');
  const response = await fetch(`${config.llmBaseUrl.replace(/\/$/, '')}/responses`, {
    method: 'POST', headers: { Authorization: `Bearer ${config.llmKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.llmModel, input: `Return only valid JSON. Be evidence-grounded and concise.\n\n${prompt}`, ...(webSearch ? { tools: [{ type: 'web_search' }] } : {}) })
  });
  if (!response.ok) throw new Error(`LLM request failed (${response.status})`);
  const data = await response.json();
  return parseModelJson(data.output_text);
}
