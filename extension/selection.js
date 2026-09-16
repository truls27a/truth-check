// The floating verdict card, injected on demand into any page.
//
// Re-entrant by construction: executeScript re-runs this file on every menu
// click, so there is no top-level const/let/class, and every listener is
// registered inside the factory, which runs exactly once per frame.
globalThis.__tcSelection || (globalThis.__tcSelection = createTruthCheckSelectionCard());

function createTruthCheckSelectionCard() {
  const CARD_WIDTH = 360;
  const GAP = 8;
  // Same palette as styles.css (#truthcheck-root) — repeated here because a
  // shadow root doesn't inherit custom properties from outside its host.
  //
  // `display` must stay a NORMAL declaration here: show()/hide() own it, and
  // they set it inline on the host, which lives in the outer tree. The cascade
  // inverts for shadow trees — for important declarations the INNER tree wins —
  // so a `display:block!important` here outranks hide()'s inline
  // `display:none!important` and the card can never be dismissed.
  const SELECTION_CSS = `:host{all:initial;display:block;
    --background:oklch(100% 0 0);--foreground:oklch(14.5% 0 0);--muted:oklch(94.5% 0 0);--muted-foreground:oklch(42% 0 0);
    --border:oklch(89% 0 0);--accent:oklch(92.5% .205 112);--signal:oklch(92.5% .205 112);
    --true:oklch(48% .13 152);--false:oklch(58% .2 29);--uncertain:oklch(63% .14 75)}
    .tc-selection{position:relative;background:var(--background);border:1px solid var(--border);border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.18);padding:12px 12px 4px;font:14px/1.4 Manrope,ui-sans-serif,system-ui,sans-serif;box-sizing:border-box}
    .tc-selection *{box-sizing:border-box}
    .tc-selection .tc-close{position:absolute;top:6px;right:10px;z-index:1}
    .tc-selection .tc-card{margin:0 0 9px}
    .tc-selection .tc-loading{padding:28px 0}
    .tc-selection .tc-empty{padding:26px 10px}`;

  const host = document.createElement('div');
  host.id = 'truthcheck-selection-host';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>${TC.CSS}${SELECTION_CSS}</style><div class="tc-ui tc-selection"><button class="tc-close" aria-label="Close">${TC.icons.close}</button><div class="tc-body"></div></div>`;
  document.documentElement.append(host);

  const body = shadow.querySelector('.tc-body');
  const state = { token: null, rect: null, text: '', retry: null };
  hide();

  shadow.querySelector('.tc-close').addEventListener('click', hide);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); }, true);
  // composedPath, not target: target is retargeted at the shadow boundary, so a
  // naive check would dismiss the card when its own source link is clicked.
  document.addEventListener('pointerdown', event => { if (!event.composedPath().includes(host)) hide(); }, true);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'tc-open') { sendResponse({ text: open(message) }); return; }
    if (message?.type === 'tc-result' && message.token === state.token) showResult(message);
  });

  // Reads the selection BEFORE touching the DOM, so nothing depends on reflow
  // ordering or on pages that clear selections on mutation.
  function open(message) {
    const selection = document.getSelection();
    const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
    const text = (selection?.toString() || '').trim() || message.fallbackText || '';
    let rect = range ? range.getBoundingClientRect() : null;
    if (!rect || (!rect.width && !rect.height)) {
      const active = document.activeElement;
      rect = active && /^(INPUT|TEXTAREA)$/.test(active.tagName) ? active.getBoundingClientRect() : null;
    }
    clearTimeout(state.retry);
    state.token = message.token;
    state.text = text;
    state.rect = rect && (rect.width || rect.height) ? { top: rect.top, bottom: rect.bottom, left: rect.left } : null;
    body.innerHTML = TC.loadingHtml();
    show();
    position();
    return text;
  }

  function showResult(message) {
    if (message.error) {
      body.innerHTML = TC.errorHtml(message);
      if (message.code === 'rate') scheduleRetry(message.token, message.retryAfterMs);
    } else if (!message.claims?.length) body.innerHTML = TC.emptyHtml(TC.escapeHtml(message.message || 'No fact-checkable statements found.'));
    else {
      body.innerHTML = `${message.demo ? '<div class="tc-demo">Demo result</div>' : ''}${TC.card(message.claims[0])}${TC.remainingHtml(message.remaining)}`;
    }
    position();
  }

  // Rate-limited: retry once after the back-off, unless the card was closed
  // or reused for another selection in the meantime.
  function scheduleRetry(token, delayMs) {
    clearTimeout(state.retry);
    state.retry = setTimeout(async () => {
      if (token !== state.token) return;
      body.innerHTML = TC.loadingHtml();
      position();
      const result = await chrome.runtime.sendMessage({ type: 'tc-fetch', path: '/api/public/check-text', body: { text: state.text }, interactive: true })
        .catch(() => ({ error: 'Verification is unavailable right now. Try again shortly.' }));
      if (token !== state.token) return;
      showResult({ ...result, code: result.code === 'rate' ? 'rate-final' : result.code, token });
    }, delayMs);
  }

  function position() {
    if (!state.rect) {
      // Selection lost or unmeasurable: park it out of the way.
      set({ position: 'fixed', top: 'auto', left: 'auto', right: '16px', bottom: '16px' });
      return;
    }
    const height = host.offsetHeight;
    const below = state.rect.bottom + GAP + height <= window.innerHeight;
    const top = below ? window.scrollY + state.rect.bottom + GAP
                      : Math.max(window.scrollY + GAP, window.scrollY + state.rect.top - height - GAP);
    const left = Math.max(window.scrollX + 12, Math.min(window.scrollX + state.rect.left, window.scrollX + window.innerWidth - CARD_WIDTH - 12));
    set({ position: 'absolute', top: `${top}px`, left: `${left}px`, right: 'auto', bottom: 'auto' });
  }

  // Page rules can style the host element itself (they cannot reach inside the
  // shadow), and :host loses to a page rule marked !important. So every
  // property that could hide, reshape or repaint the host is pinned inline.
  function set(styles) {
    const base = {
      width: `${CARD_WIDTH}px`, height: 'auto', 'max-width': 'none', 'max-height': 'none', 'min-width': '0', 'min-height': '0',
      margin: '0', padding: '0', border: 'none', background: 'transparent', 'box-shadow': 'none', 'border-radius': '0',
      opacity: '1', visibility: 'visible', transform: 'none', filter: 'none', 'clip-path': 'none', 'pointer-events': 'auto',
      float: 'none', 'z-index': '2147483647'
    };
    for (const [prop, value] of Object.entries({ ...base, ...styles })) host.style.setProperty(prop, value, 'important');
  }

  function show() { host.style.setProperty('display', 'block', 'important'); }
  function hide() { host.style.setProperty('display', 'none', 'important'); state.token = null; clearTimeout(state.retry); }

  return { open, hide };
}
