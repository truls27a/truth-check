import test from 'node:test';
import assert from 'node:assert/strict';
import { parseModelJson } from '../server/services/llm.js';
import { getFocus, FOCUS_PRESETS } from '../server/services/focus.js';
import { validVerdict, shapeVerdict } from '../server/services/verify.js';
import { normalizeSelection, demoSelectionClaim, MAX_SELECTION_CHARS } from '../server/services/selection.js';

function videoId(url) { return new URL(url).searchParams.get('v'); }
test('extracts a YouTube video id', () => assert.equal(videoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=4'), 'dQw4w9WgXcQ'));
test('parses model JSON inside a code fence', () => assert.deepEqual(parseModelJson('```json\n{"claims":[]}\n```'), { claims: [] }));
test('validates allowed verdicts', () => { assert.equal(validVerdict('TRUE'), true); assert.equal(validVerdict('MAYBE'), false); });
test('selects configured focus and falls back safely', () => { assert.equal(getFocus('science'), FOCUS_PRESETS.science); assert.equal(getFocus('missing'), FOCUS_PRESETS.general); });
test('normalizes a selection: collapses whitespace, trims, and caps length', () => {
  assert.equal(normalizeSelection('  Earth\nhas\twarmed  '), 'Earth has warmed');
  assert.equal(normalizeSelection('   '), '');
  assert.equal(normalizeSelection(null), '');
  assert.equal(normalizeSelection('a'.repeat(MAX_SELECTION_CHARS + 50)).length, MAX_SELECTION_CHARS);
});
test('shapes a verdict: filters sources and falls back to UNCERTAIN', () => {
  const shaped = shapeVerdict({ id: 'selection-1', claim: 'x', timestamp: null }, {
    verdict: 'MAYBE', confidence: '0.7', sources: [
      { title: 'No url' },
      { title: 'Bad scheme', url: 'javascript:alert(1)' },
      { title: 'A', url: 'https://a.example' }, { title: 'B', url: 'https://b.example' },
      { title: 'C', url: 'http://c.example' }, { title: 'D', url: 'https://d.example' }
    ]
  });
  assert.equal(shaped.verdict, 'UNCERTAIN');
  assert.equal(shaped.confidence, 0.7);
  assert.deepEqual(shaped.sources.map(s => s.title), ['A', 'B', 'C']);
});
test('demo selection claim is honest about not verifying anything', () => {
  const claim = demoSelectionClaim('The Moon landing happened in 1969.');
  assert.equal(claim.verdict, 'TRUE');
  assert.equal(claim.timestamp, null);
  assert.equal(claim.sources.length, 0);
});
