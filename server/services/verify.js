import { generateStructured } from './llm.js';

const verdicts = new Set(['TRUE', 'FALSE', 'UNCERTAIN']);
export function validVerdict(value) { return verdicts.has(value); }
export async function verifyClaim(item) {
  const result = await generateStructured(`Use web search to verify this claim. Prefer primary and authoritative sources. Decide only from evidence you retrieved, not your own prior knowledge. Return {"verdict":"TRUE|FALSE|UNCERTAIN","confidence":0-1,"explanation":"one or two concise sentences","sources":[{"title":"...","url":"https://...","publisher":"..."}]}. Include 1–3 genuinely used sources. If evidence is weak or mixed, choose UNCERTAIN.\nClaim: ${item.claim}`, { webSearch: true });
  const sources = Array.isArray(result.sources) ? result.sources.filter(source => source?.title && /^https?:\/\//.test(source.url || '')).slice(0, 3) : [];
  return { ...item, verdict: validVerdict(result.verdict) ? result.verdict : 'UNCERTAIN', confidence: Number(result.confidence) || 0, explanation: result.explanation || 'Evidence was inconclusive.', sources };
}
