import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// The extension files are classic scripts that assign to globalThis, so load
// them into a sandbox the same way importScripts would.
const context = vm.createContext({});
for (const file of ['config.js', 'api.js', 'auth.js']) {
  vm.runInContext(readFileSync(new URL(`../extension/${file}`, import.meta.url), 'utf8'), context, { filename: file });
}
const { TC_CONFIG, TCApi, createTruthCheckAuth } = context;
const ENTITLEMENT_URL = `${TC_CONFIG.apiBase}/api/public/entitlement`;
const TOKEN_URL = `${TC_CONFIG.supabaseUrl}/auth/v1/token`;

function memoryStorage() {
  const data = {};
  return {
    data,
    async get(key) { return key in data ? { [key]: structuredClone(data[key]) } : {}; },
    async set(items) { Object.assign(data, structuredClone(items)); },
    async remove(keys) { for (const key of [].concat(keys)) delete data[key]; }
  };
}

function reply(status, body) {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body };
}

// Routes by URL; each route is a function (url, init) => response or error.
function fakeFetch(routes) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    const route = Object.keys(routes).find(prefix => url.startsWith(prefix));
    if (!route) throw new TypeError('Failed to fetch');
    return routes[route](url, init);
  };
  return { calls, fetchImpl };
}

function tokenResponse(n, expiresIn = 3600) {
  return reply(200, { access_token: `access-${n}`, refresh_token: `refresh-${n}`, expires_in: expiresIn, user: { id: 'user-1', email: 'reader@example.com' } });
}

function setup(routes, clock = { t: 1_000_000_000_000 }) {
  const storage = memoryStorage();
  const net = fakeFetch(routes);
  const auth = createTruthCheckAuth({ config: TC_CONFIG, storage, fetchImpl: net.fetchImpl, now: () => clock.t });
  return { auth, storage, clock, ...net };
}

test('compares extension versions numerically', () => {
  assert.equal(TCApi.compareVersions('0.3.0', '0.1.0'), 1);
  assert.equal(TCApi.compareVersions('0.9.0', '0.10.0'), -1);
  assert.equal(TCApi.compareVersions('1.0', '1.0.0'), 0);
});

test('maps website error statuses to renderable results', () => {
  assert.equal(TCApi.apiError(401).code, 'auth');
  assert.equal(TCApi.apiError(401).error, 'Sign in to TruthCheck to fact-check.');
  assert.deepEqual(TCApi.apiError(402, {}, { pricingUrl: TC_CONFIG.pricingUrl }).upgradeUrl, 'https://truth-check-tool.lovable.app/pricing');
  assert.equal(TCApi.apiError(429).retryAfterMs, 30000);
  assert.equal(TCApi.apiError(429, {}, { retryAfter: '12' }).retryAfterMs, 12000);
  assert.equal(TCApi.apiError(429).error, 'Too many checks at once — try again in a moment.');
  assert.equal(TCApi.apiError(502).code, 'unavailable');
  assert.equal(TCApi.apiError(0).code, 'unavailable');
  assert.deepEqual({ ...TCApi.apiError(400, { error: 'Select some text to fact-check.' }) }, { code: 'invalid', error: 'Select some text to fact-check.' });
});

test('sign-in stores the session and reports a Pro plan', async () => {
  const { auth, storage, calls } = setup({
    [TOKEN_URL]: (url, init) => {
      assert.match(url, /grant_type=password$/);
      assert.equal(init.headers.apikey, TC_CONFIG.supabaseKey);
      return tokenResponse(1);
    },
    [ENTITLEMENT_URL]: (_url, init) => {
      assert.equal(init.headers.Authorization, 'Bearer access-1');
      return reply(200, { user: { id: 'user-1', email: 'reader@example.com' }, plan: 'pro', status: 'active', productId: 'p' });
    }
  });
  const state = await auth.signIn('reader@example.com', 'secret');
  assert.deepEqual({ ...state }, { signedIn: true, email: 'reader@example.com', plan: 'pro', stale: false });
  assert.equal(storage.data['tc.session'].refresh_token, 'refresh-1');
  assert.equal(JSON.stringify(storage.data).includes('secret'), false, 'password is never stored');
  assert.equal(calls.filter(c => c.url === ENTITLEMENT_URL).length, 1, 'state reuses the fresh entitlement');
});

test('failed sign-in surfaces the Supabase message and stays signed out', async () => {
  const { auth, storage } = setup({ [TOKEN_URL]: () => reply(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }) });
  await assert.rejects(auth.signIn('reader@example.com', 'wrong'), /Invalid login credentials/);
  assert.equal(storage.data['tc.session'], undefined);
  assert.equal((await auth.getState()).signedIn, false);
});

test('sign-out clears the session and the entitlement cache', async () => {
  const { auth, storage, calls } = setup({
    [TOKEN_URL]: () => tokenResponse(1),
    [ENTITLEMENT_URL]: () => reply(200, { plan: 'free', user: { id: 'user-1' } }),
    [`${TC_CONFIG.supabaseUrl}/auth/v1/logout`]: () => reply(204, {})
  });
  await auth.signIn('reader@example.com', 'secret');
  assert.ok(storage.data['tc.entitlement']);
  await auth.signOut();
  assert.deepEqual(Object.keys(storage.data), []);
  assert.equal(calls.at(-1).init.headers.Authorization, 'Bearer access-1');
  assert.equal((await auth.getState()).signedIn, false);
});

test('an expired access token is refreshed before the request', async () => {
  let issued = 0;
  const { auth, clock } = setup({
    [TOKEN_URL]: () => tokenResponse(++issued),
    [ENTITLEMENT_URL]: () => reply(200, { plan: 'free' })
  });
  await auth.signIn('reader@example.com', 'secret');
  clock.t += 3600 * 1000;
  assert.equal(await auth.getAccessToken(), 'access-2');
});

test('a 401 triggers one refresh and one retry', async () => {
  let issued = 0;
  const seen = [];
  const { auth } = setup({
    [TOKEN_URL]: () => tokenResponse(++issued),
    [ENTITLEMENT_URL]: () => reply(200, { plan: 'free' }),
    [`${TC_CONFIG.apiBase}/api/public/check-text`]: (_url, init) => {
      seen.push(init.headers.Authorization);
      return seen.length === 1 ? reply(401, { error: 'expired' }) : reply(200, { claims: [], remaining: 9 });
    }
  });
  await auth.signIn('reader@example.com', 'secret');
  const response = await auth.authorizedFetch(`${TC_CONFIG.apiBase}/api/public/check-text`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  assert.equal(response.status, 200);
  assert.deepEqual(seen, ['Bearer access-1', 'Bearer access-2']);
});

test('concurrent refreshes share a single token request', async () => {
  let refreshes = 0;
  const { auth, clock } = setup({
    [TOKEN_URL]: url => (url.endsWith('refresh_token') ? (refreshes++, tokenResponse(2)) : tokenResponse(1)),
    [ENTITLEMENT_URL]: () => reply(200, { plan: 'free' })
  });
  await auth.signIn('reader@example.com', 'secret');
  clock.t += 3600 * 1000;
  const tokens = await Promise.all([auth.getAccessToken(), auth.getAccessToken(), auth.getAccessToken()]);
  assert.deepEqual(tokens, ['access-2', 'access-2', 'access-2']);
  assert.equal(refreshes, 1);
});

test('a rejected refresh token signs the user out without throwing', async () => {
  const { auth, storage, clock } = setup({
    [TOKEN_URL]: url => (url.endsWith('refresh_token') ? reply(400, { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' }) : tokenResponse(1)),
    [ENTITLEMENT_URL]: () => reply(200, { plan: 'pro' })
  });
  await auth.signIn('reader@example.com', 'secret');
  clock.t += 3600 * 1000;
  assert.equal(await auth.authorizedFetch(`${TC_CONFIG.apiBase}/api/public/check-text`), null);
  assert.deepEqual(Object.keys(storage.data), []);
  assert.equal((await auth.getState()).signedIn, false);
});

test('a refresh that fails offline keeps the session', async () => {
  let offline = false;
  const { auth, storage, clock } = setup({
    [TOKEN_URL]: () => { if (offline) throw new TypeError('Failed to fetch'); return tokenResponse(1); },
    [ENTITLEMENT_URL]: () => reply(200, { plan: 'free' })
  });
  await auth.signIn('reader@example.com', 'secret');
  offline = true;
  clock.t += 3600 * 1000;
  assert.equal(await auth.getAccessToken(), null);
  assert.equal(storage.data['tc.session'].refresh_token, 'refresh-1');
});

test('entitlement is cached for five minutes, then re-fetched', async () => {
  let fetches = 0;
  const { auth, clock } = setup({
    [TOKEN_URL]: () => tokenResponse(1, 86400),
    [ENTITLEMENT_URL]: () => (fetches++, reply(200, { plan: 'pro' }))
  });
  await auth.signIn('reader@example.com', 'secret');
  clock.t += 4 * 60 * 1000;
  assert.equal(auth.isPro(await auth.getEntitlement()), true);
  assert.equal(fetches, 1);
  clock.t += 2 * 60 * 1000;
  await auth.getEntitlement();
  assert.equal(fetches, 2);
});

test('an unreachable website never unlocks Pro from a stale cache', async () => {
  let offline = false;
  const { auth, clock } = setup({
    [TOKEN_URL]: () => tokenResponse(1, 86400),
    [ENTITLEMENT_URL]: () => { if (offline) throw new TypeError('Failed to fetch'); return reply(200, { plan: 'pro' }); }
  });
  await auth.signIn('reader@example.com', 'secret');
  offline = true;
  clock.t += 10 * 60 * 1000;
  const entitlement = await auth.getEntitlement();
  assert.equal(entitlement.stale, true);
  assert.equal(entitlement.plan, 'pro', 'last known plan is still reported');
  assert.equal(auth.isPro(entitlement), false);
  const state = await auth.getState();
  assert.deepEqual({ ...state }, { signedIn: true, email: 'reader@example.com', plan: 'free', stale: true });
});

test('an entitlement 401 that survives a refresh forces re-authentication', async () => {
  let issued = 0;
  const { auth, storage } = setup({
    [TOKEN_URL]: () => tokenResponse(++issued),
    [ENTITLEMENT_URL]: () => reply(401, { error: 'Invalid token' })
  });
  await assert.doesNotReject(auth.signIn('reader@example.com', 'secret'));
  assert.deepEqual(Object.keys(storage.data), []);
  assert.equal((await auth.getState()).signedIn, false);
});
