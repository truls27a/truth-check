import http from 'node:http';
import { config } from './config.js';
import { getYouTubeTranscript } from './services/transcript.js';
import { extractClaims } from './services/claims.js';
import { verifyClaim } from './services/verify.js';
import { demoClaims, DEMO_TRANSCRIPT } from './services/demo.js';
import { FOCUS_PRESETS } from './services/focus.js';
import { normalizeSelection, demoSelectionClaim, verifySelection } from './services/selection.js';

const MAX_BODY_BYTES = 100_000;

function send(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }); res.end(JSON.stringify(body)); }
function readBody(req) { return new Promise((resolve, reject) => { let raw = ''; req.on('data', x => { raw += x; if (raw.length > MAX_BODY_BYTES) { req.destroy(); reject(new Error('Request body too large')); } }); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON body')); } }); }); }
async function analyze(body) {
  const { videoId, transcript: suppliedTranscript, focus = 'general' } = body;
  if (!videoId && !suppliedTranscript) throw new Error('Open a YouTube video or paste a transcript first.');
  if (config.demoMode && !suppliedTranscript) return { claims: demoClaims, demo: true };
  const transcript = suppliedTranscript ? [{ start: 0, text: suppliedTranscript }] : await getYouTubeTranscript(videoId);
  if (!transcript.length) throw new Error('Transcript unavailable — paste transcript to analyze.');
  if (config.demoMode) return { claims: demoClaims, demo: true };
  const extracted = await extractClaims(transcript, focus);
  if (!extracted.length) return { claims: [], message: 'No fact-checkable statements found.' };
  const claims = await Promise.all(extracted.slice(0, 5).map(async item => { try { return await verifyClaim(item); } catch { return { ...item, verdict: 'UNCERTAIN', confidence: 0, explanation: 'This claim could not be verified right now.', sources: [] }; } }));
  return { claims, demo: false };
}
async function checkText(body) {
  const text = normalizeSelection(body.text);
  if (!text) throw new Error('Select some text to fact-check.');
  if (config.demoMode) return { claims: [demoSelectionClaim(text)], demo: true };
  let claim;
  try { claim = await verifySelection(text); } catch { throw new Error('Verification service unavailable.'); }
  if (!claim) return { claims: [], message: 'No fact-checkable statements found.' };
  return { claims: [claim], demo: false };
}
const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  try {
    if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true, demoMode: config.demoMode });
    if (req.method === 'GET' && req.url === '/api/demo-transcript') return send(res, 200, { transcript: DEMO_TRANSCRIPT });
    if (req.method === 'GET' && req.url === '/api/focuses') return send(res, 200, FOCUS_PRESETS);
    if (req.method === 'POST' && req.url === '/api/analyze') return send(res, 200, await analyze(await readBody(req)));
    if (req.method === 'POST' && req.url === '/api/check-text') return send(res, 200, await checkText(await readBody(req)));
    return send(res, 404, { error: 'Not found' });
  } catch (error) { return send(res, 400, { error: error.message || 'Verification service unavailable.' }); }
});
server.listen(config.port, () => console.log(`TruthCheck API at http://localhost:${config.port} (demo mode: ${config.demoMode})`));
