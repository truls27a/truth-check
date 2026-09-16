import { config } from '../config.js';

export function parseModelJson(value) {
  const raw = String(value || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  const start = raw.search(/[\[{]/); const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
  if (start < 0 || end < start) throw new Error('Model did not return JSON');
  return JSON.parse(raw.slice(start, end + 1));
}
async function generateWithOpenAI(prompt, { webSearch, instruction }) {
  if (!config.llmKey) throw new Error('LLM_API_KEY is not configured');
  const response = await fetch(`${config.llmBaseUrl.replace(/\/$/, '')}/responses`, {
    method: 'POST', headers: { Authorization: `Bearer ${config.llmKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.llmModel, input: `${instruction}\n\n${prompt}`, ...(webSearch ? { tools: [{ type: 'web_search' }] } : {}) })
  });
  if (!response.ok) throw new Error(`LLM request failed (${response.status})`);
  const data = await response.json();
  return parseModelJson(data.output_text);
}

// Local Ollama has no web_search tool — callers that asked for it fall back
// to the model's own knowledge, which is the accepted tradeoff for running
// fully offline/free. `format: 'json'` asks Ollama to constrain output to
// valid JSON (supported by most current models, including qwen2.5-coder).
async function generateWithOllama(prompt, { webSearch, instruction }) {
  if (webSearch) console.warn('[TruthCheck] web search requested but the Ollama provider has no web_search tool — answering from the model\'s own knowledge only.');
  const response = await fetch(`${config.ollamaBaseUrl.replace(/\/$/, '')}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ollamaModel,
      messages: [{ role: 'system', content: instruction }, { role: 'user', content: prompt }],
      stream: false,
      format: 'json'
    })
  });
  if (!response.ok) throw new Error(`Ollama request failed (${response.status}) — is "ollama serve" running and is ${config.ollamaModel} pulled?`);
  const data = await response.json();
  return parseModelJson(data.message?.content);
}

export async function generateStructured(prompt, { webSearch = false, system } = {}) {
  const instruction = system || 'Return only valid JSON. Be evidence-grounded and concise.';
  return config.llmProvider === 'ollama'
    ? generateWithOllama(prompt, { webSearch, instruction })
    : generateWithOpenAI(prompt, { webSearch, instruction });
}
