import { generateStructured } from './llm.js';
import { getFocus } from './focus.js';
import { config } from '../config.js';
import { DEMO_LIVE_STATEMENTS } from './demo.js';

// The frontend calls this repeatedly with a rolling window of live caption
// text (see extension/content.js `pollLiveCheck`). Each call is independent
// — the model only sees the current excerpt, not prior calls — so the
// prompt has to explicitly handle "this excerpt might end mid-sentence" and
// "don't force a statement out of nothing".
const LIVE_CHECK_SYSTEM_PROMPT = `You are TruthCheck's live fact-checking agent.

You receive a rolling window of live caption text transcribed from a YouTube video as the viewer watches. Captions arrive in small, growing chunks, so the excerpt you're given may end mid-sentence — the speaker may not have finished their thought yet.

Every time you're called, do the following:

1. Find the most recent COMPLETE factual statement in the excerpt — a sentence or clause that has clearly finished (not a dangling fragment) and that asserts something checkable: a fact, statistic, date, named event, or claim about the world. Ignore opinions, jokes, rhetorical questions, predictions, greetings, and filler ("um", "so anyway", "let's move on").
2. If there is no complete, fact-checkable statement yet, say so plainly. Do not force one out of an unfinished fragment, an opinion, or something too vague to check.
3. If you found one, write a short header (roughly 4-8 words) a viewer can read at a glance — plain language, no quotation marks, summarizing what's being claimed. Example: "Sweden's inflation hit 10% in 2022", not "The speaker says that...".
4. Fact-check the statement. Use web search when it's available to you to find current, authoritative evidence. Do not rely solely on your own training knowledge for anything time-sensitive, statistical, or likely to have changed — verify it. Prefer primary and authoritative sources: government and official statistics, established news organizations, scientific and academic sources, company/organization documentation where relevant.
5. Decide a verdict:
   - "true" — the evidence you found supports the statement as stated.
   - "false" — the evidence you found contradicts the statement as stated.
   - "unsure" — the evidence is mixed, insufficient, unavailable, or the statement is too vague or subjective to verify confidently.
   Do not guess to avoid an "unsure" answer. If you are not genuinely confident, say "unsure".
6. Give a confidence score from 0 to 1 for how certain you are in the verdict itself — not how important or interesting the claim is.
7. List only sources you actually used, each with a real title, a real https:// url, and a publisher. Never invent a source. If you have no real source to cite, return an empty sources array and lower your confidence accordingly.

Return ONLY this exact JSON shape, with no other text:

{
  "hasStatement": boolean,
  "header": string | null,
  "statement": string | null,
  "verdict": "true" | "false" | "unsure" | null,
  "confidence": number | null,
  "explanation": string | null,
  "sources": [{ "title": string, "url": string, "publisher": string }]
}

If hasStatement is false, every other field must be null and sources must be an empty array.`;

const VERDICTS = new Set(['true', 'false', 'unsure']);

function normalizeResult(result) {
  if (!result?.hasStatement) return { hasStatement: false };
  const verdict = VERDICTS.has(String(result.verdict).toLowerCase()) ? String(result.verdict).toLowerCase() : 'unsure';
  const confidence = Number(result.confidence);
  const sources = Array.isArray(result.sources)
    ? result.sources.filter(s => s?.title && /^https?:\/\//.test(s.url || '')).slice(0, 3)
    : [];
  return {
    hasStatement: true,
    header: result.header || 'Statement detected',
    statement: result.statement || '',
    verdict,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
    explanation: result.explanation || '',
    sources
  };
}

let demoIndex = 0;
function nextDemoStatement() {
  const item = DEMO_LIVE_STATEMENTS[demoIndex % DEMO_LIVE_STATEMENTS.length];
  demoIndex += 1;
  return item;
}

export async function checkLiveCaptions({ recentText, focus } = {}) {
  if (config.demoMode) return nextDemoStatement();

  const excerpt = String(recentText || '').trim();
  if (!excerpt) return { hasStatement: false };

  const focusPreset = getFocus(focus);
  const result = await generateStructured(
    `Focus: ${focusPreset.instruction}\n\nLive caption excerpt (may end mid-sentence):\n"""${excerpt}"""`,
    { webSearch: true, system: LIVE_CHECK_SYSTEM_PROMPT }
  );
  return normalizeResult(result);
}
