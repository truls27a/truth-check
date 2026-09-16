// Supabase session + plan entitlement, owned by the service worker only (the
// popup asks the worker over messages), so there is exactly one place that
// can rotate the refresh token.
//
// Talks to Supabase's auth REST endpoints directly instead of vendoring
// supabase-js: the extension has no bundler, and password sign-in, refresh and
// logout are all it needs. The session lives in chrome.storage.local — MV3
// service workers have no localStorage — and nothing here is ever logged.
globalThis.createTruthCheckAuth = function createTruthCheckAuth({ config, storage, fetchImpl, now = () => Date.now() }) {
  const SESSION_KEY = 'tc.session';
  const ENTITLEMENT_KEY = 'tc.entitlement';
  const ENTITLEMENT_TTL_MS = 5 * 60 * 1000;
  const EXPIRY_MARGIN_S = 60;
  let refreshing = null;

  async function read(key) { return (await storage.get(key))[key] ?? null; }

  async function clear() { await storage.remove([SESSION_KEY, ENTITLEMENT_KEY]); }

  async function tokenRequest(grantType, body) {
    const response = await fetchImpl(`${config.supabaseUrl}/auth/v1/token?grant_type=${grantType}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: config.supabaseKey },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error_description || data.msg || data.message || 'Sign-in failed. Try again.');
      error.status = response.status;
      throw error;
    }
    const session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at ?? Math.floor(now() / 1000) + (data.expires_in || 3600),
      user: { id: data.user?.id, email: data.user?.email }
    };
    await storage.set({ [SESSION_KEY]: session });
    return session;
  }

  async function signIn(email, password) {
    await clear();
    await tokenRequest('password', { email, password });
    await getEntitlement({ force: true });
    return getState();
  }

  async function signOut() {
    const session = await read(SESSION_KEY);
    await clear();
    if (!session) return;
    // Best effort: the local session is already gone either way.
    try {
      await fetchImpl(`${config.supabaseUrl}/auth/v1/logout?scope=local`, {
        method: 'POST', headers: { apikey: config.supabaseKey, Authorization: `Bearer ${session.access_token}` }
      });
    } catch {}
  }

  // Single-flight. A rejected refresh token (4xx) means the session is dead,
  // so sign out; a network failure keeps the session for when we're back online.
  function refresh(session) {
    refreshing ||= tokenRequest('refresh_token', { refresh_token: session.refresh_token })
      .catch(async error => {
        if (error.status && error.status < 500) await clear();
        return null;
      })
      .finally(() => { refreshing = null; });
    return refreshing;
  }

  async function getAccessToken({ forceRefresh = false } = {}) {
    let session = await read(SESSION_KEY);
    if (!session) return null;
    if (forceRefresh || session.expires_at - EXPIRY_MARGIN_S <= now() / 1000) session = await refresh(session);
    return session?.access_token ?? null;
  }

  // Returns null when signed out. On a 401, refreshes once and retries once.
  async function authorizedFetch(url, init = {}) {
    const send = token => fetchImpl(url, { ...init, headers: { ...init.headers, apikey: config.supabaseKey, Authorization: `Bearer ${token}` } });
    const token = await getAccessToken();
    if (!token) return null;
    const response = await send(token);
    if (response.status !== 401) return response;
    const fresh = await getAccessToken({ forceRefresh: true });
    if (!fresh) return response;
    const retried = await send(fresh);
    if (retried.status === 401) await clear();
    return retried;
  }

  // Cached for at most five minutes. When the website can't be reached, the
  // result is marked stale and never counts as Pro (see isPro).
  async function getEntitlement({ force = false } = {}) {
    const session = await read(SESSION_KEY);
    if (!session) { await storage.remove(ENTITLEMENT_KEY); return null; }
    const cached = await read(ENTITLEMENT_KEY);
    if (!force && cached?.userId === session.user?.id && now() - cached.fetchedAt < ENTITLEMENT_TTL_MS) return cached;
    try {
      const response = await authorizedFetch(`${config.apiBase}/api/public/entitlement`);
      if (!response || response.status === 401) { await clear(); return null; }
      if (!response.ok) throw new Error(`Entitlement check failed (${response.status})`);
      const data = await response.json();
      const entitlement = { userId: data.user?.id ?? session.user?.id, email: data.user?.email ?? session.user?.email, plan: data.plan === 'pro' ? 'pro' : 'free', status: data.status ?? null, fetchedAt: now() };
      await storage.set({ [ENTITLEMENT_KEY]: entitlement });
      return entitlement;
    } catch {
      return { ...(cached?.userId === session.user?.id ? cached : { plan: 'free' }), stale: true };
    }
  }

  function isPro(entitlement) {
    return Boolean(entitlement && !entitlement.stale && entitlement.plan === 'pro' && now() - entitlement.fetchedAt < ENTITLEMENT_TTL_MS);
  }

  async function getState() {
    const session = await read(SESSION_KEY);
    if (!session) return { signedIn: false };
    const entitlement = await getEntitlement();
    // getEntitlement may have discovered the session is invalid.
    if (!(await read(SESSION_KEY))) return { signedIn: false };
    return { signedIn: true, email: session.user?.email, plan: isPro(entitlement) ? 'pro' : 'free', stale: Boolean(entitlement?.stale) };
  }

  return { SESSION_KEY, ENTITLEMENT_KEY, signIn, signOut, getAccessToken, authorizedFetch, getEntitlement, isPro, getState };
};
