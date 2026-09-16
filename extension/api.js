// Pure helpers for the service worker, loaded via importScripts. No chrome.*
// access here, so test/extension.test.js can load this file directly.
globalThis.TCApi = {
  RATE_LIMIT_BACKOFF_MS: 30000,

  // Numeric comparison of dotted versions: '0.10.0' is newer than '0.9.0'.
  compareVersions(a, b) {
    const pa = String(a).split('.').map(Number);
    const pb = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const diff = (pa[i] || 0) - (pb[i] || 0);
      if (diff) return Math.sign(diff);
    }
    return 0;
  },

  // Maps a non-2xx website response to the { error, code } shape the selection
  // card and YouTube panel render. Only 400s echo the server's own message.
  apiError(status, data, { pricingUrl, retryAfter } = {}) {
    if (status === 401) return { code: 'auth', error: 'Sign in to TruthCheck to fact-check.' };
    if (status === 402) return { code: 'limit', error: 'You’ve used today’s free checks.', upgradeUrl: pricingUrl };
    if (status === 429) {
      const seconds = Number(retryAfter);
      return { code: 'rate', error: 'Too many checks at once — try again in a moment.', retryAfterMs: seconds > 0 ? seconds * 1000 : TCApi.RATE_LIMIT_BACKOFF_MS };
    }
    if (status === 400 && data?.error) return { code: 'invalid', error: String(data.error) };
    return { code: 'unavailable', error: 'Verification is unavailable right now. Try again shortly.' };
  }
};
