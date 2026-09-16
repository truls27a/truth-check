import { generateStructured } from './llm.js';
import { shapeVerdict } from './verify.js';

export const MAX_SELECTION_CHARS = 1000;

export function normalizeSelection(text) { return String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_SELECTION_CHARS); }
export function truncate(text, limit) { return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text; }

// Demo mode never calls the model, so it must not imply that evidence was found.
export function demoSelectionClaim(text) {
  return { id: 'selection-1', claim: truncate(text, 200), verdict: 'TRUE', confidence: 0.94, timestamp: null, explanation: 'Demo mode — no verification was performed. Set DEMO_MODE=false to check this selection against live sources.', sources: [] };
}

// One round trip: reducing the selection to a proposition is an input the
// verifier needs anyway, so a separate pre-pass would only add latency.
export async function verifySelection(text) {
  const result = await generateStructured(`A reader selected the following text on a web page. First reduce it to the single most important checkable factual proposition, restated as one short sentence. If it contains no checkable factual proposition (a slogan, opinion, question, navigation label, or prediction), return {"checkable":false}. Otherwise use web search to verify that proposition. Prefer primary and authoritative sources. Decide only from evidence you retrieved, not your own prior knowledge. Return {"checkable":true,"claim":"...","verdict":"TRUE|FALSE|UNCERTAIN","confidence":0-1,"explanation":"one or two concise sentences","sources":[{"title":"...","url":"https://...","publisher":"..."}]}. Include 1–3 genuinely used sources. If evidence is weak or mixed, choose UNCERTAIN.\nSelected text: ${text}`, { webSearch: true });
  if (result.checkable === false || !result.claim) return null;
  return shapeVerdict({ id: 'selection-1', claim: String(result.claim), timestamp: null }, result);
}
