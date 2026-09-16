// Shared card renderer and card CSS, used by BOTH the YouTube panel
// (content.js) and the selection card injected into any page (selection.js).
//
// Loaded twice on YouTube: once via the manifest, once via executeScript. It
// must therefore be re-entrant — assign to globalThis, and never declare a
// top-level const/let/class.
globalThis.TC = {
  CSS: `.tc-ui{--muted:#9ca3af;color:#f8fafc;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.tc-close{background:transparent;border:0;color:#a8afbd;font-size:26px;line-height:18px;cursor:pointer}.tc-empty{color:var(--muted);padding:38px 13px;text-align:center;font-size:13px;line-height:1.5}.tc-empty b{color:#e6e8ed;font-size:14px}.tc-card{background:#191d27;border:1px solid #2a3040;border-radius:11px;margin:9px 0;padding:13px;cursor:pointer;transition:.15s}.tc-card:hover{border-color:#47516c}.tc-verdict{font-size:11px;letter-spacing:.08em;font-weight:800}.tc-verdict span{display:inline-grid;place-items:center;width:17px;height:17px;border-radius:50%;margin-right:6px;font-size:13px}.true .tc-verdict{color:#55d59a}.true .tc-verdict span{background:#173e31}.false .tc-verdict{color:#ff7e84}.false .tc-verdict span{background:#46242b}.uncertain .tc-verdict{color:#f7c955}.uncertain .tc-verdict span{background:#493a1b}.tc-card h3{font-size:13px;line-height:1.42;margin:8px 0 6px;font-weight:650}.tc-card>p{font-size:12px;line-height:1.45;color:#bac0cd;margin:0}.tc-detail{display:none;margin-top:12px;padding-top:10px;border-top:1px solid #2c3140;font-size:11px;color:#d4d8e1}.expanded .tc-detail{display:block}.tc-meta{color:#9fa8ba;margin-bottom:9px}.tc-detail b{display:block;margin-bottom:5px}.tc-detail a{display:block;color:#9bb5ff;text-decoration:none;padding:3px 0}.tc-detail a span{float:right}.tc-none{color:var(--muted)}.tc-demo{font-size:10px;color:#b4a5ff;text-transform:uppercase;letter-spacing:.1em;margin:0 5px 9px}.tc-loading{text-align:center;padding:42px 0;color:var(--muted);font-size:12px}.tc-loading i{display:inline-block;width:7px;height:7px;margin:2px;border-radius:50%;background:#8fa5ff;animation:tcPulse 1s infinite alternate}.tc-loading i:nth-child(2){animation-delay:.2s}.tc-loading i:nth-child(3){animation-delay:.4s}@keyframes tcPulse{to{opacity:.2;transform:translateY(-5px)}}.tc-empty p{margin:6px 0 0}.tc-empty a.tc-upsell{display:inline-block;margin-top:10px;color:#9bb5ff;text-decoration:none}.tc-remaining{color:var(--muted);font-size:11px;margin:0 5px 9px}`,
  escapeHtml(value) { const node = document.createElement('span'); node.textContent = value || ''; return node.innerHTML; },
  loadingHtml() { return `<div class="tc-loading"><i></i><i></i><i></i><p>Finding claims and checking evidence…</p></div>`; },
  emptyHtml(message) { return `<div class="tc-empty"><b>${message}</b></div>`; },
  // Renders a background.js { error, code } result. A used-up allowance gets
  // a calm upgrade link rather than reading as a failure.
  errorHtml(result) {
    const message = TC.escapeHtml(result.error);
    if (result.code === 'limit') return `<div class="tc-empty"><b>${message}</b><p>Upgrade to Pro for unlimited checks, or come back tomorrow.</p><a class="tc-upsell" href="${TC.escapeHtml(result.upgradeUrl || TC_CONFIG.pricingUrl)}" target="_blank" rel="noopener">See TruthCheck Pro ↗</a></div>`;
    if (result.code === 'auth') return `<div class="tc-empty"><b>${message}</b><p>Click the TruthCheck icon in your toolbar to sign in.</p></div>`;
    return TC.emptyHtml(message);
  },
  // `remaining` is null for Pro, so nothing is shown there.
  remainingHtml(remaining) { return Number.isFinite(remaining) ? `<p class="tc-remaining">${remaining} free check${remaining === 1 ? '' : 's'} left today</p>` : ''; },
  card(item) {
    const status = item.verdict?.toLowerCase() || 'uncertain';
    const time = Number.isFinite(item.timestamp) ? `${Math.floor(item.timestamp / 60)}:${String(Math.floor(item.timestamp % 60)).padStart(2, '0')}` : '';
    return `<article class="tc-card ${status}" data-time="${item.timestamp}"><div class="tc-verdict"><span>${status === 'true' ? '✓' : status === 'false' ? '×' : '!'}</span>${item.verdict}</div><h3>${TC.escapeHtml(item.claim)}</h3><p>${TC.escapeHtml(item.explanation)}</p><div class="tc-detail"><div class="tc-meta">${[time ? `Jump to ${time}` : '', item.confidence ? `${Math.round(item.confidence * 100)}% confidence` : ''].filter(Boolean).join(' · ')}</div><b>Sources</b>${(item.sources || []).map(s => `<a href="${s.url}" target="_blank" rel="noopener">${TC.escapeHtml(s.publisher || s.title)} <span>↗</span></a>`).join('') || '<span class="tc-none">No sources available</span>'}</div></article>`;
  }
};
