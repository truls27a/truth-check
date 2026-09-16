// Toolbar popup: sign in/out, plan badge, update notice, and the button that
// opens the YouTube panel (the toolbar click used to do that directly).
//
// All account work happens in the service worker; this page only renders the
// state it reports, and re-renders whenever the stored session or plan changes.
const $ = id => document.getElementById(id);
const SESSION_KEY = 'tc.session';
const ENTITLEMENT_KEY = 'tc.entitlement';
const UPDATE_NOTICE_KEY = 'tc.updateNotice';

$('signup').href = TC_CONFIG.apiBase;
$('pricing').href = TC_CONFIG.pricingUrl;

function send(action, extra = {}) {
  return chrome.runtime.sendMessage({ type: 'tc-auth', action, ...extra })
    .catch(() => ({ signedIn: false, error: 'TruthCheck isn’t responding. Reload the extension and try again.' }));
}

function render(state) {
  $('loading').hidden = true;
  $('signed-out').hidden = state.signedIn;
  $('signed-in').hidden = !state.signedIn;
  $('plan').hidden = !state.signedIn;
  $('error').hidden = !state.error;
  $('error').textContent = state.error || '';
  if (!state.signedIn) return;
  $('who').textContent = state.email || '';
  $('plan').textContent = state.plan === 'pro' ? 'Pro' : 'Free';
  $('plan').classList.toggle('pro', state.plan === 'pro');
  $('stale').hidden = !state.stale;
  $('upsell').hidden = state.plan === 'pro';
}

async function refresh(action = 'state') { render(await send(action)); }

$('signed-out').addEventListener('submit', async event => {
  event.preventDefault();
  $('sign-in').disabled = true;
  $('sign-in').textContent = 'Signing in…';
  const state = await send('sign-in', { email: $('email').value, password: $('password').value });
  $('sign-in').disabled = false;
  $('sign-in').textContent = 'Sign in';
  if (state.signedIn) $('password').value = '';
  render(state);
});

$('sign-out').addEventListener('click', async () => {
  $('sign-out').disabled = true;
  render(await send('sign-out'));
  $('sign-out').disabled = false;
});

// The content script only runs on YouTube; activeTab (granted by opening this
// popup) lets us read the tab's URL.
async function setUpPanelButton() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https:\/\/www\.youtube\.com\//.test(tab.url || '')) return;
  $('panel').hidden = false;
  $('panel').addEventListener('click', () => {
    chrome.tabs.sendMessage(tab.id, { type: 'tc-toggle-panel' }).catch(() => {});
    window.close();
  });
}

// Shown once per new minimum version, then remembered as shown.
async function showUpdateNotice() {
  const notice = (await chrome.storage.local.get(UPDATE_NOTICE_KEY))[UPDATE_NOTICE_KEY];
  if (!notice || notice.shown) return;
  $('update').textContent = `TruthCheck was updated — please update the extension.${notice.notes ? ` ${notice.notes}` : ''}`;
  $('update').hidden = false;
  await chrome.storage.local.set({ [UPDATE_NOTICE_KEY]: { ...notice, shown: true } });
}

// Keeps the popup in sync when the worker signs the user out (for example,
// after a rejected refresh token) or updates the plan.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (SESSION_KEY in changes || ENTITLEMENT_KEY in changes)) refresh();
});

refresh('refresh');
setUpPanelButton();
showUpdateNotice();
