// Client-side extension settings. Edit a value below, then reload the
// extension in chrome://extensions and fully close/reopen the YouTube tab
// to apply it.
//
// Loaded by the manifest before card.js/content.js, by the service worker via
// importScripts, and by popup.html — so assign to globalThis rather than
// declaring top-level const/let (same re-entrancy convention as card.js).
globalThis.TC_CONFIG = {
  // Show the small "TruthCheck sees" live-caption readout (top-right).
  // The caption pipeline that feeds the live fact-checker keeps running
  // either way — this only controls whether the box itself is visible.
  showCaptionOverlay: false,

  // Hosted TruthCheck website; every fact-check runs there, behind accounts.
  apiBase: 'https://truth-check-tool.lovable.app',
  pricingUrl: 'https://truth-check-tool.lovable.app/pricing',

  // The website's Supabase project, so extension and site share accounts.
  // The publishable key is public by design; there are no other secrets.
  // Mirrors VITE_TRUTHCHECK_SUPABASE_URL / _KEY in .env.example.
  supabaseUrl: 'https://c--18989893-2e9e-4c1d-af2b-9d5cc74c2c93-prod.lovable.cloud',
  supabaseKey: 'sb_publishable_f63_GjfD38ZrafUKLupvuQ_Ekwv7yy_'
};
