// Service worker: owns the context menu and the backend call.
//
// The fetch lives here, not in the injected script, because a page like
// https://news.example fetching http://localhost is a public->local request
// subject to Private Network Access preflight, which the backend does not
// answer. An extension-origin fetch backed by host_permissions sidesteps that,
// along with page CSP and any dependence on the server's CORS headers.
//
// Keep this file import-free; adding an import requires "type": "module" in
// the manifest. That is also why API is duplicated from content.js.
const API = 'http://localhost:8787';
const MENU_ID = 'truthcheck-selection';
const TIMEOUT_MS = 25000;

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
  const files = ['card.js', 'selection.js'];
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

async function checkText(text) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${API}/api/check-text`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }), signal: controller.signal
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
  } catch (error) {
    return { error: error?.name === 'AbortError' || /Failed to fetch|NetworkError/i.test(String(error)) ? 'Verification service unavailable.' : (error.message || 'Verification service unavailable.') };
  } finally {
    clearTimeout(timer);
  }
}
