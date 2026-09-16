// Shared card renderer and card CSS, used by BOTH the YouTube panel
// (content.js) and the selection card injected into any page (selection.js).
//
// Visual language matches the TruthCheck website's evidence rail
// (truth-check-tool.lovable.app): light theme, oklch tokens, Manrope type,
// verdict-panel / evidence-block / rail-controls structure. Palette vars
// (--background, --foreground, --signal, --true, --false, --uncertain, ...)
// are declared by each consumer's own root scope (styles.css for the page
// panel, selection.js's :host for its shadow root) — this file only defines
// the classes that reference them.
//
// Loaded twice on YouTube: once via the manifest, once via executeScript. It
// must therefore be re-entrant — assign to globalThis, and never declare a
// top-level const/let/class.
//
// Every length below is in px, never rem/em. `rem` resolves against the HOST
// PAGE's root element, which we don't control and can't override from here:
// `all:initial` on our container doesn't rebase it. YouTube ships
// `html{font-size:10px}`, which silently rendered this whole card at 62.5%
// scale there while looking correct on a default 16px page.
globalThis.TC = {
  CSS: `.tc-ui{color:var(--foreground);font-family:Manrope,ui-sans-serif,system-ui,sans-serif}
.tc-close{background:transparent;border:0;color:var(--muted-foreground);cursor:pointer;border-radius:6px;display:grid;place-items:center;width:30px;height:30px;transition:background-color .15s}
.tc-close:hover{background:var(--accent)}
.tc-close svg{width:17px;height:17px}
.tc-empty{color:var(--muted-foreground);padding:40px 14px;text-align:center;font-size:14px;line-height:1.5}
.tc-empty b{color:var(--foreground);font-size:15px}
.tc-demo{font-size:10px;color:var(--muted-foreground);text-transform:uppercase;letter-spacing:.08em;font-weight:800;margin:0 14px 9px}
.tc-remaining{color:var(--muted-foreground);font-size:12px;margin:0 14px 11px}
.tc-loading{text-align:center;padding:42px 0;color:var(--muted-foreground);font-size:13px}
.tc-loading i{display:inline-block;width:6px;height:6px;margin:0 2px;border-radius:50%;background:var(--signal);animation:tcPulse 1s infinite alternate}
.tc-loading i:nth-child(2){animation-delay:.2s}
.tc-loading i:nth-child(3){animation-delay:.4s}
@keyframes tcPulse{to{opacity:.25;transform:translateY(-4px)}}
.tc-empty a.tc-upsell{display:inline-block;margin-top:10px;color:var(--foreground);text-decoration:underline}

/* --- rail head: logo + close --- */
.rail-head{border-bottom:1px solid var(--border);justify-content:space-between;align-items:center;min-height:50px;padding:11px 14px;font-weight:800;display:flex}
.rail-head>div{align-items:center;gap:8px;display:flex}
.rail-head span{font-size:16px;letter-spacing:-.01em}

/* --- rail progress: "Claim x of y" + dots --- */
.rail-progress{padding:14px 14px 12px;border-bottom:1px solid var(--border)}
.rail-progress>span{color:var(--muted-foreground);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
.rail-progress>div{grid-template-columns:repeat(var(--tc-claim-count,3),1fr);gap:4px;margin-top:8px;display:grid}
.rail-progress button{opacity:.25;background:var(--muted-foreground);border-radius:16px;height:4px;border:0;padding:0;cursor:pointer}
.rail-progress button.is-active{opacity:1}
.rail-progress button.progress-true{background:var(--true)}
.rail-progress button.progress-false{background:var(--false)}
.rail-progress button.progress-uncertain{background:var(--uncertain)}

/* --- verdict panel: icon, claim, evidence, source --- */
.verdict-panel{padding:14px}
.verdict-top{align-items:center;gap:10px;display:flex}
.verdict-icon{width:34px;height:34px;color:var(--background);border-radius:50%;place-items:center;display:grid;flex:none}
.verdict-icon svg{width:18px;height:18px}
.verdict-icon-true{background:var(--true)}
.verdict-icon-false{background:var(--false)}
.verdict-icon-uncertain{background:var(--uncertain)}
.verdict-top small{display:block;color:var(--muted-foreground);font-size:10px;font-weight:800;letter-spacing:.06em}
.verdict-top strong{font-size:18px;line-height:1.2}
.verdict-panel>p{margin:14px 0;font-weight:650;line-height:1.45;font-size:15px}
.evidence-block{border-left:3px solid var(--foreground);padding:2px 0 2px 11px}
.evidence-block.evidence-true{border-color:var(--true)}
.evidence-block.evidence-false{border-color:var(--false)}
.evidence-block.evidence-uncertain{border-color:var(--uncertain)}
.evidence-block>span{text-transform:uppercase;align-items:center;gap:5px;font-size:10px;font-weight:850;letter-spacing:.04em;display:flex;color:var(--muted-foreground)}
.evidence-block svg{width:12px;height:12px}
.evidence-block p{color:var(--muted-foreground);margin:6px 0 0;line-height:1.5;font-size:14px}
.verdict-panel>a{border:1px solid var(--border);background:var(--muted);border-radius:6px;justify-content:space-between;align-items:center;margin-top:16px;padding:11px;display:flex;text-decoration:none;color:inherit}
.verdict-panel>a:hover{border-color:var(--signal)}
.verdict-panel>a small{display:block;color:var(--muted-foreground);font-size:10px;font-weight:800;letter-spacing:.06em}
.verdict-panel>a strong{font-size:14px;font-weight:700}
.verdict-panel>a svg{width:14px;height:14px;color:var(--muted-foreground);flex:none}
.verdict-meta{color:var(--muted-foreground);font-size:12px;margin:-8px 0 14px}
.verdict-meta a{color:inherit;text-decoration:underline;cursor:pointer}
.verdict-meta .tc-quote{font-style:italic}

/* --- rail controls: prev/next + counter --- */
.rail-controls{border-top:1px solid var(--border);justify-content:space-between;align-items:center;padding:12px 14px;display:flex}
.rail-controls button{width:30px;height:30px;border:1px solid var(--border);border-radius:6px;background:var(--background);color:var(--foreground);display:grid;place-items:center;cursor:pointer;transition:background-color .15s}
.rail-controls button:hover:not(:disabled){background:var(--accent)}
.rail-controls button:disabled{opacity:.35;cursor:default}
.rail-controls button svg{width:16px;height:16px}
.rail-controls span{color:var(--muted-foreground);font-size:12px;font-weight:800}

/* --- rail foot: tagline --- */
.rail-foot{background:var(--foreground);color:var(--background);align-items:center;gap:6px;padding:10px 14px;font-size:11px;font-weight:600;display:flex}
.rail-foot svg{width:13px;height:13px;color:var(--signal);flex:none}

/* --- compact mini card, used by the live caption ticker (a running list,
   not a single-claim rail) --- */
.tc-card{background:var(--background);border:1px solid var(--border);border-radius:8px;margin:9px 0;padding:11px}
.tc-card .verdict-top{gap:8px}
.tc-card .verdict-icon{width:26px;height:26px}
.tc-card .verdict-icon svg{width:14px;height:14px}
.tc-card .verdict-top strong{font-size:14px}
.tc-card .evidence-block{margin-top:10px}
`,
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

  // Lucide-style 24x24 stroke icons (paths match lucide's published data), plus
  // the TruthCheck logo mark, all inheriting `currentColor` / sized by CSS.
  icons: {
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>`,
    externalLink: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>`,
    arrowLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path></svg>`,
    arrowRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>`,
    shieldCheck: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path></svg>`,
    sparkles: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path><path d="M20 2v4"></path><path d="M22 4h-4"></path><circle cx="4" cy="20" r="2"></circle></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path></svg>`,
    x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path></svg>`,
    alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="8" y2="12"></line><line x1="12" x2="12.01" y1="16" y2="16"></line></svg>`,
    logo: `<svg viewBox="0 0 32 32" role="img" aria-hidden="true"><rect width="32" height="32" rx="7.5" fill="var(--foreground)"></rect><rect x="7.5" y="9" width="17" height="2.6" rx="1.3" fill="var(--background)"></rect><rect x="7.5" y="14.2" width="11" height="2.6" rx="1.3" fill="var(--background)"></rect><rect x="7.5" y="20.4" width="9.5" height="2.4" rx="1.2" fill="var(--signal)"></rect><path d="M18.6 21.3 L21 23.9 L26 16.9" fill="none" stroke="var(--signal)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
  },

  // A single claim's verdict panel — the core unit shown by the rail
  // (content.js), the selection card, and (compact, wrapped in .tc-card) the
  // live caption ticker. `meta` is optional extra text (e.g. a timestamp
  // jump-link) rendered above the evidence block.
  verdictHtml(item, meta) {
    const status = (item.verdict || 'uncertain').toLowerCase() === 'unsure' ? 'uncertain' : (item.verdict || 'uncertain').toLowerCase();
    const icon = status === 'true' ? TC.icons.check : status === 'false' ? TC.icons.x : TC.icons.alert;
    const claim = item.claim || item.header || item.statement || '';
    const source = (item.sources || [])[0];
    return `<div class="verdict-panel"><div class="verdict-top"><span class="verdict-icon verdict-icon-${status}">${icon}</span><div><small>VERDICT</small><strong>${status.toUpperCase()}</strong></div></div><p>${TC.escapeHtml(claim)}</p>${meta ? `<div class="verdict-meta">${meta}</div>` : ''}<div class="evidence-block evidence-${status}"><span>${TC.icons.sparkles}What the evidence says</span><p>${TC.escapeHtml(item.explanation || '')}</p></div>${source ? `<a href="${TC.escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer"><span><small>PRIMARY SOURCE</small><strong>${TC.escapeHtml(source.publisher || source.title || 'Source')}</strong></span>${TC.icons.externalLink}</a>` : ''}</div>`;
  },

  // Compact card for the live caption ticker: verdict panel plus timestamp,
  // confidence and (if distinct from the claim) the original statement —
  // all shown up front, matching the site's no-click-to-expand rail.
  card(item) {
    const meta = [];
    if (Number.isFinite(item.timestamp)) meta.push(`<a class="tc-jump" data-time="${item.timestamp}">Jump to ${Math.floor(item.timestamp / 60)}:${String(Math.floor(item.timestamp % 60)).padStart(2, '0')}</a>`);
    if (item.confidence != null) meta.push(`${Math.round(item.confidence * 100)}% confidence`);
    if (item.statement && item.statement !== (item.claim || item.header)) meta.push(`<span class="tc-quote">“${TC.escapeHtml(item.statement)}”</span>`);
    return `<article class="tc-card" data-time="${item.timestamp ?? ''}">${TC.verdictHtml(item, meta.join(' · '))}</article>`;
  },
};
