import test from 'node:test';
import assert from 'node:assert/strict';
import { parseModelJson } from '../server/services/llm.js';
import { validVerdict } from '../server/services/verify.js';
import { getFocus, FOCUS_PRESETS } from '../server/services/focus.js';

function videoId(url) { return new URL(url).searchParams.get('v'); }
test('extracts a YouTube video id', () => assert.equal(videoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=4'), 'dQw4w9WgXcQ'));
test('parses model JSON inside a code fence', () => assert.deepEqual(parseModelJson('```json\n{"claims":[]}\n```'), { claims: [] }));
test('validates allowed verdicts', () => { assert.equal(validVerdict('TRUE'), true); assert.equal(validVerdict('MAYBE'), false); });
test('selects configured focus and falls back safely', () => { assert.equal(getFocus('science'), FOCUS_PRESETS.science); assert.equal(getFocus('missing'), FOCUS_PRESETS.general); });
