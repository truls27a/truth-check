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
// The claim currently shown by the single-claim evidence rail (#tc-results),
// and its sibling list — populated by both the one-shot analyze() path and
// the live-reveal path in updateLiveClaims().
let railClaims = [];
let railIndex = 0;
let railDemo = false;
let railRemaining = null;
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
// Visibility of the live fact-check window (#tc-live-overlay), the surface the
// toolbar button opens. It starts closed, opens itself when the first check
// lands, and once the user closes it stays closed — otherwise the next poll,
// 15s later, would pop it straight back open.
let liveOpen = false;
let liveDismissed = false;
const root = document.createElement('div'); root.id = 'truthcheck-root';
root.innerHTML = `<div id="tc-caption-overlay"><b>TruthCheck sees</b><p id="tc-caption-text" aria-live="polite">Waiting for captions&hellip; (turn on CC and press play)</p></div><div id="tc-live-overlay" class="tc-ui"><b>Live fact-checks<span id="tc-live-count"></span><button class="tc-close" aria-label="Close fact-check window">${TC.icons.close}</button></b><div id="tc-live-list"><p class="tc-live-empty">Watching for statements to check&hellip;</p></div></div><aside id="tc-panel" class="tc-ui" aria-label="TruthCheck panel"><div class="rail-head"><div>${TC.icons.logo}<span>TruthCheck</span></div><button class="tc-close" aria-label="Close evidence panel">${TC.icons.close}</button></div><div class="tc-scroll"><section class="tc-controls"><label>Focus<select id="tc-focus">${focuses.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></label><label class="tc-live"><input id="tc-live" type="checkbox" checked> Reveal claims as video plays</label><button id="tc-analyze">Analyze video <span>→</span></button><p id="tc-hint"></p></section><section id="tc-results"><div class="tc-empty"><b>Ready to check</b><p>Analyze this video's captions to find and verify important factual claims.</p></div></section></div><div class="rail-controls" id="tc-rail-controls" hidden><button id="tc-prev" aria-label="Previous claim">${TC.icons.arrowLeft}</button><span id="tc-rail-count"></span><button id="tc-next" aria-label="Next claim">${TC.icons.arrowRight}</button></div><div class="rail-foot">${TC.icons.shieldCheck}<span>Evidence stays linked to the words.</span></div></aside>`;
root.insertAdjacentHTML('afterbegin', `<style>${TC.CSS}</style>`);
document.documentElement.append(root);
const $ = s => root.querySelector(s); const panel = $('#tc-panel');
// The caption pipeline (captionBuffer, the live fact-checker) keeps running
// regardless of this setting — it only hides the readout box itself.
if (!TC_CONFIG.showCaptionOverlay) $('#tc-caption-overlay').style.display = 'none';
// Scoped selectors: both the panel and the live window carry a .tc-close, and
// the live window comes first in the markup above.
$('#tc-panel .tc-close').onclick = () => panel.classList.remove('open');
$('#tc-live-overlay .tc-close').onclick = () => setLiveOpen(false);
$('#tc-analyze').onclick = analyze;
$('#tc-prev').onclick = () => { railIndex = Math.max(0, railIndex - 1); renderRail(); };
$('#tc-next').onclick = () => { railIndex = Math.min(railClaims.length - 1, railIndex + 1); renderRail(); };
// The toolbar button (see popup.js) opens the live fact-check window — empty
// to begin with, then checks appear in it as the video plays. It deliberately
// does not open #tc-panel: the one-shot "analyze the whole video" overview is
// a different, non-live flow.
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'tc-toggle-panel') return;
  // An explicit reopen clears an earlier dismissal.
  if (!liveOpen) liveDismissed = false;
  setLiveOpen(!liveOpen);
});
makeDraggable(panel, panel.querySelector('.rail-head'));
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
  railClaims = []; railIndex = 0;
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
// Closing the window is sticky (see liveDismissed) — only an explicit reopen
// from the toolbar clears it.
function setLiveOpen(open) {
  liveOpen = open;
  if (!open) liveDismissed = true;
  $('#tc-live-overlay').classList.toggle('is-open', open);
}
function renderLiveChecks() {
  const list = $('#tc-live-list');
  const count = $('#tc-live-count');
  if (!list) return;
  // Surface the window on the first result, unless the user closed it.
  if (!liveDismissed && (liveChecks.length || liveNotice)) setLiveOpen(true);
  if (count) count.textContent = liveChecks.length ? ` (${liveChecks.length})` : '';
  const notice = liveNotice ? TC.errorHtml(liveNotice) : '';
  if (!liveChecks.length) {
    list.innerHTML = notice || '<p class="tc-live-empty">Watching for statements to check…</p>';
    return;
  }
  list.innerHTML = notice + liveChecks.map(TC.card).join('');
  list.querySelectorAll('.tc-jump').forEach(a => a.addEventListener('click', () => jumpTo(Number(a.dataset.time))));
}
function jumpTo(time) { const player = document.querySelector('video'); if (Number.isFinite(time) && player) player.currentTime = time; }
function hideRailControls() { $('#tc-rail-controls').hidden = true; railClaims = []; railIndex = 0; }
function renderEmpty(message) { hideRailControls(); $('#tc-results').innerHTML = TC.emptyHtml(message); }
function renderError(result) { hideRailControls(); $('#tc-results').innerHTML = TC.errorHtml(result); }
function renderLoading() { hideRailControls(); $('#tc-results').innerHTML = TC.loadingHtml(); }
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
  showRail(claims, demo, remaining, false);
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
    hideRailControls();
    $('#tc-results').innerHTML = `<div class="tc-live-status"><span></span>Watching for verified claims…<small>Results appear at their timestamp. Pause the video to pause reveals.</small></div>`;
    return;
  }
  // Jump to the newest reveal so the rail always surfaces what just aired;
  // the viewer can still step back with prev/dots to earlier claims.
  showRail(liveAnalysis.revealed, liveAnalysis.demo, liveAnalysis.remaining, true);
}
// Populates the single-claim evidence rail (#tc-results + #tc-rail-controls)
// and renders it. `jumpToNewest` is used by the live-reveal path so a newly
// surfaced claim is what the viewer sees.
function showRail(claims, demo, remaining, jumpToNewest) {
  railClaims = claims;
  railDemo = demo;
  railRemaining = remaining;
  railIndex = jumpToNewest ? claims.length - 1 : Math.min(railIndex, claims.length - 1);
  renderRail();
}
function railStatus(item) { const s = (item.verdict || 'uncertain').toLowerCase(); return s === 'unsure' ? 'uncertain' : s; }
function renderRail() {
  const n = railClaims.length;
  const railControls = $('#tc-rail-controls');
  if (!n) { railControls.hidden = true; return; }
  const item = railClaims[railIndex];
  const dots = railClaims.map((c, i) => `<button class="progress-${railStatus(c)}${i === railIndex ? ' is-active' : ''}" data-i="${i}" aria-label="View ${railStatus(c)} claim" aria-current="${i === railIndex}"></button>`).join('');
  const time = Number.isFinite(item.timestamp) ? `<a class="tc-jump" data-time="${item.timestamp}">Jump to ${Math.floor(item.timestamp / 60)}:${String(Math.floor(item.timestamp % 60)).padStart(2, '0')}</a>` : '';
  $('#tc-results').innerHTML = `${railDemo ? '<div class="tc-demo">Demo results</div>' : ''}<div class="rail-progress"><span>Claim ${railIndex + 1} of ${n}</span><div style="--tc-claim-count:${n}">${dots}</div></div>${TC.verdictHtml(item, time)}${TC.remainingHtml(railRemaining)}`;
  $('#tc-results .tc-jump')?.addEventListener('click', () => jumpTo(item.timestamp));
  $('#tc-results').querySelectorAll('.rail-progress button').forEach(b => b.addEventListener('click', () => { railIndex = Number(b.dataset.i); renderRail(); }));
  railControls.hidden = false;
  $('#tc-rail-count').textContent = `${railIndex + 1} / ${n}`;
  $('#tc-prev').disabled = railIndex === 0;
  $('#tc-next').disabled = railIndex === n - 1;
}
