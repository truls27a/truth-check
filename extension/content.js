const API = 'http://localhost:8787';
const focuses = [
  ['general', 'General factual claims'], ['politics', 'Politics & current events'], ['science', 'Science & health'], ['economics', 'Economics'], ['history', 'History'], ['technology', 'Technology'], ['numbers', 'Numbers & statistics'], ['all', 'All relevant claims']
];
let activeVideoId = videoId();
let liveAnalysis = null;
const root = document.createElement('div'); root.id = 'truthcheck-root';
root.innerHTML = `<button id="tc-fab" aria-label="Open TruthCheck">✓<span>TruthCheck</span></button><aside id="tc-panel" aria-label="TruthCheck panel"><header><div><strong>TruthCheck</strong><small>Verify claims as you watch</small></div><button class="tc-close" aria-label="Close">×</button></header><section class="tc-controls"><label>Focus<select id="tc-focus">${focuses.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></label><label class="tc-live"><input id="tc-live" type="checkbox" checked> Reveal claims as video plays</label><button id="tc-analyze">Analyze video <span>→</span></button><p id="tc-hint"></p></section><section id="tc-results"><div class="tc-empty"><b>Ready to check</b><p>Analyze this video's captions to find and verify important factual claims.</p></div></section></aside>`;
document.documentElement.append(root);
const $ = s => root.querySelector(s); const panel = $('#tc-panel');
$('#tc-fab').onclick = () => panel.classList.toggle('open'); $('.tc-close').onclick = () => panel.classList.remove('open');
$('#tc-analyze').onclick = analyze;
document.addEventListener('yt-navigate-finish', checkForVideoChange);
// YouTube is a single-page app; polling the URL also covers navigation paths
// where its custom event is missed by a content script.
setInterval(checkForVideoChange, 500);
setInterval(updateLiveClaims, 500);

function videoId() { try { return new URL(location.href).searchParams.get('v'); } catch { return null; } }
function checkForVideoChange() {
  const id = videoId();
  if (id === activeVideoId) return;
  activeVideoId = id;
  liveAnalysis = null;
  renderEmpty(id ? 'New video detected. Ready to analyze.' : 'Open a YouTube video to analyze it.');
}
function renderEmpty(message) { $('#tc-results').innerHTML = `<div class="tc-empty"><b>${message}</b></div>`; }
function renderLoading() { $('#tc-results').innerHTML = `<div class="tc-loading"><i></i><i></i><i></i><p>Finding claims and checking evidence…</p></div>`; }
async function analyze() {
  if (!videoId()) { renderEmpty('Open a YouTube watch page to analyze a video.'); return; }
  renderLoading(); $('#tc-analyze').disabled = true;
  try {
    const response = await fetch(`${API}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId: videoId(), focus: $('#tc-focus').value }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    renderClaims(data.claims, data.demo, data.message);
  } catch (error) { renderEmpty(`${error.message || 'Verification service unavailable.'}<br><button class="tc-paste">Paste transcript instead</button>`); $('.tc-paste')?.addEventListener('click', promptTranscript); }
  finally { $('#tc-analyze').disabled = false; }
}
async function promptTranscript() {
  const transcript = prompt('Paste the video transcript:'); if (!transcript?.trim()) return;
  renderLoading();
  try { const r = await fetch(`${API}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript, focus: $('#tc-focus').value }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); renderClaims(d.claims, d.demo, d.message); } catch (e) { renderEmpty(e.message); }
}
function renderClaims(claims, demo, message) {
  if (!claims?.length) return renderEmpty(message || 'No fact-checkable statements found.');
  if ($('#tc-live').checked) {
    liveAnalysis = { claims, demo, revealed: [] };
    updateLiveClaims(true);
    return;
  }
  liveAnalysis = null;
  renderCards(claims, demo);
}
function updateLiveClaims(initial = false) {
  if (!liveAnalysis) return;
  const player = document.querySelector('video');
  // Pausing intentionally pauses new claim reveals. The initial call still
  // reveals claims at or before the current playback position.
  if (!initial && player?.paused) return;
  const currentTime = player?.currentTime || 0;
  const newlyDue = liveAnalysis.claims.filter(item => {
    const due = !Number.isFinite(item.timestamp) || item.timestamp <= currentTime + 0.25;
    return due && !liveAnalysis.revealed.includes(item);
  });
  if (!newlyDue.length && liveAnalysis.revealed.length) return;
  liveAnalysis.revealed.push(...newlyDue);
  if (!liveAnalysis.revealed.length) {
    $('#tc-results').innerHTML = `<div class="tc-live-status"><span></span>Watching for verified claims…<small>Results appear at their timestamp. Pause the video to pause reveals.</small></div>`;
    return;
  }
  renderCards(liveAnalysis.revealed, liveAnalysis.demo, `${liveAnalysis.claims.length} tracked`);
}
function renderCards(claims, demo, meta = `${claims.length} claims`) {
  $('#tc-results').innerHTML = `${demo ? '<div class="tc-demo">Demo results</div>' : ''}<h2>Analysis <em>${meta}</em></h2>${claims.map(card).join('')}`;
  root.querySelectorAll('.tc-card').forEach(el => el.addEventListener('click', event => {
    if (event.target.closest('a')) return;
    el.classList.toggle('expanded');
    const time = Number(el.dataset.time);
    const player = document.querySelector('video');
    if (Number.isFinite(time) && player && el.classList.contains('expanded')) player.currentTime = time;
  }));
}
function card(item) { const status = item.verdict?.toLowerCase() || 'uncertain'; const time = Number.isFinite(item.timestamp) ? `${Math.floor(item.timestamp / 60)}:${String(Math.floor(item.timestamp % 60)).padStart(2, '0')}` : ''; return `<article class="tc-card ${status}" data-time="${item.timestamp}"><div class="tc-verdict"><span>${status === 'true' ? '✓' : status === 'false' ? '×' : '!'}</span>${item.verdict}</div><h3>${escapeHtml(item.claim)}</h3><p>${escapeHtml(item.explanation)}</p><div class="tc-detail"><div class="tc-meta">${time ? `Jump to ${time}` : ''} ${item.confidence ? ` · ${Math.round(item.confidence * 100)}% confidence` : ''}</div><b>Sources</b>${(item.sources || []).map(s => `<a href="${s.url}" target="_blank" rel="noopener">${escapeHtml(s.publisher || s.title)} <span>↗</span></a>`).join('') || '<span class="tc-none">No sources available</span>'}</div></article>`; }
function escapeHtml(value) { const node = document.createElement('span'); node.textContent = value || ''; return node.innerHTML; }
