import { generateStructured } from './llm.js';
import { getFocus } from './focus.js';

export async function extractClaims(transcript, focusKey) {
  const focus = getFocus(focusKey);
  const compact = transcript.slice(0, 500).map(x => `[${x.start}s] ${x.text}`).join('\n');
  const result = await generateStructured(`Extract at most 5 fact-checkable claims from this transcript. ${focus.instruction} Ignore opinions, predictions, jokes, and vague assertions. Return {"claims":[{"id":"claim-1","claim":"...","timestamp":number,"relevance":0-1,"factCheckability":0-1,"category":"..."}]}.\n${compact}`);
  return Array.isArray(result.claims) ? result.claims.slice(0, 5) : [];
}
