// Service worker: owns the context menu, the Supabase session and every call
// to the TruthCheck website.
//
// The fetch lives here, not in the injected scripts, so the access token never
// enters a page's process, and so page CSP never applies to it. An
// extension-origin fetch backed by host_permissions also doesn't depend on
// the website's CORS headers.
//
// Classic worker (no "type": "module"), so shared code is pulled in with
// importScripts, which only works at top level.
importScripts('config.js', 'api.js', 'auth.js');

const API = TC_CONFIG.apiBase;
const MENU_ID = 'truthcheck-selection';
const TIMEOUT_MS = 25000;
const SIGN_IN_PROMPT_INTERVAL_MS = 60000;
const UPDATE_NOTICE_KEY = 'tc.updateNotice';
const OAUTH_PENDING_KEY = 'tc.oauthPending';
const AUTH_ERROR_KEY = 'tc.authError';
const OAUTH_TIMEOUT_MS = 10 * 60 * 1000;

const auth = createTruthCheckAuth({ config: TC_CONFIG, storage: chrome.storage.local, fetchImpl: (...args) => fetch(...args) });
let lastSignInPrompt = 0;

// Worker startup: refresh the plan and (once per browser session) the version.
auth.getEntitlement({ force: true }).catch(() => {});
checkExtensionVersion();

chrome.runtime.onInstalled.addListener(() => {
  // removeAll first so reloading the unpacked extension never hits a duplicate id.
  chrome.contextMenus.removeAll(() => chrome.contextMenus.create({
    id: MENU_ID,
    title: 'Fact-check with TruthCheck',
    contexts: ['selection'],
    // Hide the item where executeScript is forbidden anyway (chrome://, Web Store).
    documentUrlPatterns: ['http://*/*', 'https://*/*']
  }));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // The YouTube panel (content.js) and the selection card's retry share this
  // generic proxy instead of duplicating fetch/timeout/error handling.
  if (message?.type === 'tc-fetch') {
    fetchJson(message.path, message.body, { interactive: Boolean(message.interactive) }).then(sendResponse);
    return true; // keep the message channel open for the async response
  }
  // Account actions are only accepted from extension pages (the popup), never
  // from content scripts running inside web pages.
  if (message?.type === 'tc-auth' && !sender.tab && sender.url?.startsWith(chrome.runtime.getURL(''))) {
    handleAuth(message).then(sendResponse);
    return true;
  }
  return undefined;
});

async function handleAuth(message) {
  try {
    if (message.action === 'sign-in') return await auth.signIn(String(message.email || '').trim(), String(message.password || ''));
    if (message.action === 'google') return await startGoogleSignIn();
    if (message.action === 'sign-out') { await auth.signOut(); return { signedIn: false }; }
    if (message.action === 'refresh') await auth.getEntitlement({ force: true });
    return await auth.getState();
  } catch (error) {
    return { signedIn: false, error: error.message || 'Sign-in failed. Try again.' };
  }
}

// Google sign-in runs in a normal tab: Lovable's OAuth broker only redirects
// back to the website, so launchWebAuthFlow's chromiumapp.org redirect can't
// be used. The popup closes as soon as the tab opens, and the worker may be
// stopped while the user is on Google's page, so the pending sign-in lives in
// session storage and the tab listeners below are registered at top level.
async function startGoogleSignIn() {
  const state = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
  await chrome.storage.local.remove(AUTH_ERROR_KEY);
  const tab = await chrome.tabs.create({ url: auth.googleSignInUrl(state) });
  await chrome.storage.session.set({ [OAUTH_PENDING_KEY]: { state, tabId: tab.id, startedAt: Date.now() } });
  return { signedIn: false, pending: true };
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url?.startsWith(API)) finishGoogleSignIn(tabId, changeInfo.url);
});

chrome.tabs.onRemoved.addListener(async tabId => {
  const pending = (await chrome.storage.session.get(OAUTH_PENDING_KEY))[OAUTH_PENDING_KEY];
  if (pending?.tabId === tabId) await chrome.storage.session.remove(OAUTH_PENDING_KEY);
});

async function finishGoogleSignIn(tabId, url) {
  const pending = (await chrome.storage.session.get(OAUTH_PENDING_KEY))[OAUTH_PENDING_KEY];
  if (pending?.tabId !== tabId) return;
  if (Date.now() - pending.startedAt > OAUTH_TIMEOUT_MS) { await chrome.storage.session.remove(OAUTH_PENDING_KEY); return; }
  const result = auth.parseOAuthRedirect(url, pending.state);
  if (!result) return;
  await chrome.storage.session.remove(OAUTH_PENDING_KEY);
  chrome.tabs.remove(tabId).catch(() => {});
  try {
    if (result.error) throw new Error(result.error);
    await auth.signInWithTokens(result.tokens);
  } catch (error) {
    // Shown by the popup the next time it opens.
    await chrome.storage.local.set({ [AUTH_ERROR_KEY]: error.message || 'Google sign-in failed. Try again.' });
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;
  // activeTab is granted by this click, which is what lets us inject anywhere
  // without a broad host permission.
  const frameId = await inject(tab.id, info.frameId ?? 0);
  if (frameId === null) return;
  const token = String(Date.now());
  const opened = await sendToFrame(tab.id, frameId, { type: 'tc-open', token, fallbackText: info.selectionText || '' });
  const text = opened?.text?.trim();
  if (!text) return sendToFrame(tab.id, frameId, { type: 'tc-result', token, error: 'Select some text to fact-check.' });
  sendToFrame(tab.id, frameId, { type: 'tc-result', token, ...await checkText(text) });
});

// Returns the frame the card was injected into, or null if the page forbids it.
async function inject(tabId, frameId) {
  const files = ['config.js', 'card.js', 'selection.js'];
  try {
    await chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, files });
    return frameId;
  } catch {
    if (frameId === 0) return null;
    // Sub-frame injection can be refused; fall back to a card in the top frame.
    try { await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, files }); return 0; } catch { return null; }
  }
}

function sendToFrame(tabId, frameId, message) {
  return chrome.tabs.sendMessage(tabId, message, { frameId }).catch(() => null);
}

function checkText(text) {
  return fetchJson('/api/public/check-text', { text }, { interactive: true });
}

// POSTs when there is a body, GETs otherwise. Always resolves, to either the
// response data or { error, code } (see TCApi.apiError).
async function fetchJson(path, body, { interactive = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const init = body === undefined
      ? { method: 'GET', signal: controller.signal }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal };
    const response = await auth.authorizedFetch(`${API}${path}`, init);
    if (!response || response.status === 401) return signInRequired(interactive);
    const data = await response.json().catch(() => ({}));
    if (response.ok) return data;
    return TCApi.apiError(response.status, data, { pricingUrl: TC_CONFIG.pricingUrl, retryAfter: response.headers.get('Retry-After') });
  } catch {
    return TCApi.apiError(0);
  } finally {
    clearTimeout(timer);
  }
}

// Opens the sign-in popup for user-initiated checks only (never for background
// live polling), and at most once a minute.
function signInRequired(interactive) {
  if (interactive && Date.now() - lastSignInPrompt > SIGN_IN_PROMPT_INTERVAL_MS) {
    lastSignInPrompt = Date.now();
    chrome.action.openPopup?.().catch(() => {});
  }
  return TCApi.apiError(401);
}

// Once per browser session. Never blocks usage: it only leaves a notice for
// the popup to show once.
async function checkExtensionVersion() {
  try {
    const { versionChecked } = await chrome.storage.session.get('versionChecked');
    if (versionChecked) return;
    const response = await fetch(`${API}/api/public/extension-version`);
    if (!response.ok) return;
    const { min, notes } = await response.json();
    await chrome.storage.session.set({ versionChecked: true });
    if (!min || TCApi.compareVersions(chrome.runtime.getManifest().version, min) >= 0) {
      await chrome.storage.local.remove(UPDATE_NOTICE_KEY);
      return;
    }
    const existing = (await chrome.storage.local.get(UPDATE_NOTICE_KEY))[UPDATE_NOTICE_KEY];
    if (existing?.min !== min) await chrome.storage.local.set({ [UPDATE_NOTICE_KEY]: { min, notes: notes || '', shown: false } });
  } catch {
    // Offline or unreachable: try again on the next worker start.
  }
}
