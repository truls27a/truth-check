import { config } from '../config.js';

export function parseModelJson(value) {
  const raw = String(value || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  const start = raw.search(/[\[{]/); const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
  if (start < 0 || end < start) throw new Error('Model did not return JSON');
  return JSON.parse(raw.slice(start, end + 1));
}
// The raw Responses API returns no `output_text` — that is an SDK convenience
// property. Pull the text out of the output items instead.
export function outputText(data) {
  if (typeof data?.output_text === 'string') return data.output_text;
  return (data?.output || []).flatMap(item => item.content || []).filter(part => part.type === 'output_text').map(part => part.text).join('\n');
}
export async function generateStructured(prompt, { webSearch = false } = {}) {
  if (!config.llmKey) throw new Error('LLM_API_KEY is not configured');
  const response = await fetch(`${config.llmBaseUrl.replace(/\/$/, '')}/responses`, {
    method: 'POST', headers: { Authorization: `Bearer ${config.llmKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.llmModel, input: `Return only valid JSON. Be evidence-grounded and concise.\n\n${prompt}`, ...(webSearch ? { tools: [{ type: 'web_search' }] } : {}) })
  });
  if (!response.ok) throw new Error(`LLM request failed (${response.status})`);
  const data = await response.json();
  return parseModelJson(outputText(data));
}
