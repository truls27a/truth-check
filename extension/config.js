// Client-side extension settings. Edit a value below, then reload the
// extension in chrome://extensions and fully close/reopen the YouTube tab
// to apply it.
//
// Loaded via the manifest before card.js/content.js, so assign to
// globalThis rather than declaring top-level const/let (same re-entrancy
// convention as card.js — see the comment there).
globalThis.TC_CONFIG = {
  // Show the small "TruthCheck sees" live-caption readout (top-right).
  // The caption pipeline that feeds the live fact-checker keeps running
  // either way — this only controls whether the box itself is visible.
  showCaptionOverlay: false
};
