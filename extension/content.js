// Version marker: if this exact line doesn't print on page load, the
// extension has NOT picked up the current file — reload it in
// chrome://extensions, then fully close and reopen the YouTube tab (not
// just Cmd+Shift+R) before testing again.
console.log('[TruthCheck] content.js build: dom-scrape-verified-selectors');
// Website calls are proxied through the background service worker (see
// background.js's tc-fetch handler), which holds the user's session and
// attaches the access token — the token never enters this page. Resolves to
// the response data or { error, code }.
function backendFetch(path, body, interactive = false) {
  return chrome.runtime.sendMessage({ type: 'tc-fetch', path, body, interactive })
    .catch(() => ({ code: 'unavailable', error: 'TruthCheck was reloaded. Refresh this page to keep checking.' }));
}
// Conservative so a Free user's daily live allowance lasts through a video.
const LIVE_CHECK_INTERVAL_MS = 15000;
const MAX_LIVE_TEXT_CHARS = 1500;
const focuses = [
  ['general', 'General factual claims'], ['politics', 'Politics & current events'], ['science', 'Science & health'], ['economics', 'Economics'], ['history', 'History'], ['technology', 'Technology'], ['numbers', 'Numbers & statistics'], ['all', 'All relevant claims']
];
let activeVideoId = videoId();
let liveAnalysis = null;
// Every const/let referenced (even transitively) by the synchronous init
// block below — through line 34's watchCaptions(onCaptionText) call, which
// synchronously runs tryAttach() → watchContainer() → onCaption() if the
// caption container already exists — MUST be declared above that block.
// `const`/`let` (unlike `function` declarations) are not usable before their
// own line runs, so anything declared further down is still in its temporal
// dead zone at that point and throws.
let captionBuffer = [];
const CAPTION_CONTAINER_SELECTOR = '.ytp-caption-window-container';
const CAPTION_SEGMENT_SELECTOR = '.ytp-caption-segment';
let liveChecks = [];
let lastCheckedBufferLength = 0;
let liveCheckInFlight = false;
// { error, code } from the last failed live check, shown in the live overlay.
let liveNotice = null;
let liveBackoffUntil = 0;
let liveAllowanceUsed = false;
const root = document.createElement('div'); root.id = 'truthcheck-root';
root.innerHTML = `<div id="tc-caption-overlay"><b>TruthCheck sees</b><p id="tc-caption-text" aria-live="polite">Waiting for captions&hellip; (turn on CC and press play)</p></div><div id="tc-live-overlay"><b>Live fact-checks<span id="tc-live-count"></span></b><div id="tc-live-list"><p class="tc-live-empty">Watching for statements to check&hellip;</p></div></div><aside id="tc-panel" aria-label="TruthCheck panel"><header><div><strong>TruthCheck</strong><small>Verify claims as you watch</small></div><button class="tc-close" aria-label="Close">×</button></header><section class="tc-controls"><label>Focus<select id="tc-focus">${focuses.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></label><label class="tc-live"><input id="tc-live" type="checkbox" checked> Reveal claims as video plays</label><button id="tc-analyze">Analyze video <span>→</span></button><p id="tc-hint"></p></section><section id="tc-results" class="tc-ui"><div class="tc-empty"><b>Ready to check</b><p>Analyze this video's captions to find and verify important factual claims.</p></div></section></aside>`;
root.insertAdjacentHTML('afterbegin', `<style>${TC.CSS}</style>`);
document.documentElement.append(root);
const $ = s => root.querySelector(s); const panel = $('#tc-panel');
// The caption pipeline (captionBuffer, the live fact-checker) keeps running
// regardless of this setting — it only hides the readout box itself.
if (!TC_CONFIG.showCaptionOverlay) $('#tc-caption-overlay').style.display = 'none';
$('.tc-close').onclick = () => panel.classList.remove('open');
$('#tc-analyze').onclick = analyze;
// Panel is opened/closed from the toolbar icon (see background.js) rather
// than an in-page button.
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'tc-toggle-panel') panel.classList.toggle('open');
});
makeDraggable(panel, panel.querySelector('header'));
makeDraggable($('#tc-caption-overlay'), $('#tc-caption-overlay').querySelector('b'));
makeDraggable($('#tc-live-overlay'), $('#tc-live-overlay').querySelector('b'));
document.addEventListener('yt-navigate-finish', checkForVideoChange);
// YouTube is a single-page app; polling the URL also covers navigation paths
// where its custom event is missed by a content script.
setInterval(checkForVideoChange, 500);
setInterval(updateLiveClaims, 500);
setInterval(pollLiveCheck, LIVE_CHECK_INTERVAL_MS);
watchCaptions(onCaptionText);

// Lets the user reposition the floating panel by dragging its header.
function makeDraggable(el, handle) {
  let dragging = false, offsetX = 0, offsetY = 0;
  handle.addEventListener('mousedown', (e) => {
    if (e.target.closest('.tc-close')) return;
    dragging = true;
    const rect = el.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    el.style.left = `${rect.left}px`;
    el.style.top = `${rect.top}px`;
    el.style.right = 'auto';
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const maxX = window.innerWidth - el.offsetWidth;
    const maxY = window.innerHeight - el.offsetHeight;
    el.style.left = `${Math.min(Math.max(0, e.clientX - offsetX), maxX)}px`;
    el.style.top = `${Math.min(Math.max(0, e.clientY - offsetY), maxY)}px`;
  });
  document.addEventListener('mouseup', () => { dragging = false; });
}

function videoId() { try { return new URL(location.href).searchParams.get('v'); } catch { return null; } }
function checkForVideoChange() {
  const id = videoId();
  if (id === activeVideoId) return;
  activeVideoId = id;
  liveAnalysis = null;
  captionBuffer = [];
  liveChecks = [];
  lastCheckedBufferLength = 0;
  liveNotice = null;
  onCaptionText('');
  renderLiveChecks();
  renderEmpty(id ? 'New video detected. Ready to analyze.' : 'Open a YouTube video to analyze it.');
}

// Reads YouTube's own on-screen caption DOM in real time — no network call,
// no API key. Verified live via DevTools inspection of an actual caption
// element: spans with class "ytp-caption-segment" inside a
// ".ytp-caption-window-container", confirmed still current. (A direct
// timedtext-endpoint fetch was tried first instead of this, since it avoids
// depending on player DOM structure at all — but YouTube's caption endpoint
// silently returns an empty body for it, a known anti-scraping measure.
// Reading the rendered DOM sidesteps that: it only reads captions the player
// itself already successfully fetched and decrypted.)
// `captionBuffer` accumulates {time, text} entries as a foundation for a
// later step that sends accumulated captions to the backend for analysis.

function watchCaptions(onCaption) {
  let containerObserver = null;

  function readContainer(container) {
    return [...container.querySelectorAll(CAPTION_SEGMENT_SELECTOR)]
      .map(seg => seg.textContent)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function watchContainer(container) {
    if (containerObserver) containerObserver.disconnect();
    containerObserver = new MutationObserver(() => onCaption(readContainer(container)));
    containerObserver.observe(container, { childList: true, subtree: true, characterData: true });
    onCaption(readContainer(container));
  }

  function tryAttach() {
    const container = document.querySelector(CAPTION_CONTAINER_SELECTOR);
    if (container && !container.dataset.tcWatched) {
      container.dataset.tcWatched = '1';
      watchContainer(container);
    }
  }

  // The caption container itself appears/disappears with the player (and can
  // be torn down and recreated when CC is toggled), so watch the page for it
  // showing up rather than assuming it already exists or stays put.
  const rootObserver = new MutationObserver(tryAttach);
  rootObserver.observe(document.documentElement, { childList: true, subtree: true });
  tryAttach();
}

function onCaptionText(text) {
  const el = $('#tc-caption-text');
  if (el) el.textContent = text || 'Waiting for captions… (turn on CC and press play)';
  if (!text) return;
  const last = captionBuffer[captionBuffer.length - 1];
  if (last?.text === text) return;
  captionBuffer.push({ time: document.querySelector('video')?.currentTime ?? null, text });
  if (captionBuffer.length > 200) captionBuffer.shift();
}

// Sends newly-seen caption text (since the last check) to the website's live
// fact-checking endpoint. Runs in the background, independent of the panel —
// results show up in the #tc-live-overlay window, which stays hidden until
// there is something to show.
async function pollLiveCheck() {
  if (liveCheckInFlight || liveAllowanceUsed || Date.now() < liveBackoffUntil) return;
  const player = document.querySelector('video');
  if (!videoId() || player?.paused) return; // mirrors "pausing pauses reveals" elsewhere in this file
  const newEntries = captionBuffer.slice(lastCheckedBufferLength);
  const recentText = newEntries.map(e => e.text).join(' ').trim().slice(-MAX_LIVE_TEXT_CHARS);
  if (recentText.length < 20) return; // not enough new speech yet to be worth a check
  lastCheckedBufferLength = captionBuffer.length;
  liveCheckInFlight = true;
  try {
    const data = await backendFetch('/api/public/live-check', { recentText, focus: $('#tc-focus').value });
    if (data.error) return onLiveError(data);
    const hadNotice = Boolean(liveNotice);
    liveNotice = null;
    if (data.hasStatement) {
      liveChecks.unshift(data);
      if (liveChecks.length > 20) liveChecks.length = 20;
    }
    if (data.hasStatement || hadNotice) renderLiveChecks();
  } finally {
    liveCheckInFlight = false;
  }
}
// Signed out: keep polling (the worker answers without a network call) so
// checks resume after sign-in. Allowance used up: stop for this page.
function onLiveError(data) {
  if (data.code === 'limit') { liveAllowanceUsed = true; data = { ...data, error: 'Today’s free live checks are used up.' }; }
  if (data.code === 'rate' || data.code === 'unavailable') liveBackoffUntil = Date.now() + (data.retryAfterMs || 30000);
  liveNotice = data;
  renderLiveChecks();
}
function renderLiveChecks() {
  const list = $('#tc-live-list');
  const count = $('#tc-live-count');
  if (!list) return;
  $('#tc-live-overlay').classList.toggle('has-content', Boolean(liveChecks.length || liveNotice));
  if (count) count.textContent = liveChecks.length ? ` (${liveChecks.length})` : '';
  const notice = liveNotice ? TC.errorHtml(liveNotice) : '';
  if (!liveChecks.length) {
    list.innerHTML = notice || '<p class="tc-live-empty">Watching for statements to check…</p>';
    return;
  }
  list.innerHTML = notice + liveChecks.map(liveCard).join('');
  list.querySelectorAll('.tc-card').forEach(el => el.addEventListener('click', event => {
    if (event.target.closest('a')) return;
    el.classList.toggle('expanded');
  }));
}
function liveCard(item) {
  const status = item.verdict === 'unsure' ? 'uncertain' : item.verdict;
  const icon = status === 'true' ? '✓' : status === 'false' ? '×' : '!';
  return `<article class="tc-card ${status}"><div class="tc-verdict"><span>${icon}</span>${item.verdict?.toUpperCase()}</div><h3>${TC.escapeHtml(item.header)}</h3><p>${TC.escapeHtml(item.explanation)}</p><div class="tc-detail">${item.confidence != null ? `<div class="tc-meta">${Math.round(item.confidence * 100)}% confidence</div>` : ''}<b>Statement</b><p class="tc-quote">${TC.escapeHtml(item.statement)}</p><b>Sources</b>${(item.sources || []).map(s => `<a href="${s.url}" target="_blank" rel="noopener">${TC.escapeHtml(s.publisher || s.title)} <span>↗</span></a>`).join('') || '<span class="tc-none">No sources available</span>'}</div></article>`;
}
function renderEmpty(message) { $('#tc-results').innerHTML = TC.emptyHtml(message); }
function renderError(result) { $('#tc-results').innerHTML = TC.errorHtml(result); }
function renderLoading() { $('#tc-results').innerHTML = TC.loadingHtml(); }
async function analyze() {
  if (!videoId()) { renderEmpty('Open a YouTube watch page to analyze a video.'); return; }
  renderLoading(); $('#tc-analyze').disabled = true;
  try {
    const data = await backendFetch('/api/public/analyze', { videoId: videoId(), focus: $('#tc-focus').value }, true);
    // Only a transcript problem is worth offering the paste fallback for.
    if (data.code === 'invalid') { renderEmpty(`${TC.escapeHtml(data.error)}<br><button class="tc-paste">Paste transcript instead</button>`); $('.tc-paste')?.addEventListener('click', promptTranscript); }
    else if (data.error) renderError(data);
    else renderClaims(data.claims, data.demo, data.message, data.remaining);
  } finally { $('#tc-analyze').disabled = false; }
}
async function promptTranscript() {
  const transcript = prompt('Paste the video transcript:'); if (!transcript?.trim()) return;
  renderLoading();
  const d = await backendFetch('/api/public/analyze', { videoId: videoId(), transcript, focus: $('#tc-focus').value }, true);
  if (d.error) renderError(d); else renderClaims(d.claims, d.demo, d.message, d.remaining);
}
function renderClaims(claims, demo, message, remaining) {
  if (!claims?.length) return renderEmpty(TC.escapeHtml(message || 'No fact-checkable statements found.'));
  if ($('#tc-live').checked) {
    liveAnalysis = { claims, demo, remaining, revealed: [] };
    updateLiveClaims(true);
    return;
  }
  liveAnalysis = null;
  renderCards(claims, demo, undefined, remaining);
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
  renderCards(liveAnalysis.revealed, liveAnalysis.demo, `${liveAnalysis.claims.length} tracked`, liveAnalysis.remaining);
}
function renderCards(claims, demo, meta = `${claims.length} claims`, remaining = null) {
  $('#tc-results').innerHTML = `${demo ? '<div class="tc-demo">Demo results</div>' : ''}<h2>Analysis <em>${meta}</em></h2>${TC.remainingHtml(remaining)}${claims.map(item => TC.card(item)).join('')}`;
  root.querySelectorAll('.tc-card').forEach(el => el.addEventListener('click', event => {
    if (event.target.closest('a')) return;
    el.classList.toggle('expanded');
    const time = Number(el.dataset.time);
    const player = document.querySelector('video');
    if (Number.isFinite(time) && player && el.classList.contains('expanded')) player.currentTime = time;
  }));
}
