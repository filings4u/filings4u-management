/**
 * filings4u shared portal session security
 *
 * Security model:
 * - Every protected page is still gated by its role-specific auth guard.
 * - 10 minutes of inactivity makes the browser session stale.
 * - A stale session is NOT signed out in the background just for sitting on a page.
 * - The next protected-page load or protected-page interaction requires a fresh login.
 * - Activity is shared across tabs for the same signed-in user.
 */
(function () {
  'use strict';

  const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
  const ACTIVITY_WRITE_THROTTLE_MS = 5000;
  const CHANNEL_NAME = 'filings4u-session-security';
  const KEY_PREFIX = 'f4u:session:last_activity:';

  const state = {
    started: false,
    expiring: false,
    db: null,
    userId: '',
    portal: '',
    loginPage: '',
    timeoutMs: DEFAULT_TIMEOUT_MS,
    lastActivity: 0,
    lastWrite: 0,
    channel: null,
    listeners: []
  };

  const now = () => Date.now();
  const keyFor = (userId) => KEY_PREFIX + String(userId || 'anonymous');

  function safeGet(key) {
    try { return window.localStorage.getItem(key); } catch (_) { return null; }
  }

  function safeSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (_) {}
  }

  function safeRemove(key) {
    try { window.localStorage.removeItem(key); } catch (_) {}
  }

  function readActivity(userId) {
    const value = Number(safeGet(keyFor(userId)) || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function isExpired(userId, timeoutMs) {
    const timeout = Number(timeoutMs) > 0 ? Number(timeoutMs) : DEFAULT_TIMEOUT_MS;
    const last = readActivity(userId);

    // No activity marker means we cannot prove that this persisted session is fresh.
    // Require a fresh login once, then the login script creates the marker.
    if (!last) return true;

    return now() - last >= timeout;
  }

  function currentTarget() {
    return (location.pathname.split('/').pop() || '') + location.search + location.hash;
  }

  function loginUrl(reason) {
    const page = state.loginPage || (state.portal === 'admin' ? 'admin-login.html' : 'customer-login.html');
    const joiner = page.includes('?') ? '&' : '?';
    return page + joiner +
      'reason=' + encodeURIComponent(reason || 'session_timeout') +
      '&returnTo=' + encodeURIComponent(currentTarget());
  }

  function ensureModal() {
    let root = document.getElementById('f4uSessionOverlay');
    if (root) return root;

    root = document.createElement('div');
    root.id = 'f4uSessionOverlay';
    root.className = 'f4u-session-overlay is-expired';
    root.hidden = true;
    root.innerHTML = `
      <div class="f4u-session-card" role="alertdialog" aria-modal="true" aria-labelledby="f4uSessionTitle" aria-describedby="f4uSessionMessage">
        <div class="f4u-session-brand">
          <img src="images/logo.png" alt="filings4u">
          <span>Secure session</span>
        </div>
        <div class="f4u-session-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"></path>
            <path d="M9 12l2 2 4-4"></path>
          </svg>
        </div>
        <h2 id="f4uSessionTitle">Please sign in again</h2>
        <p id="f4uSessionMessage">For your security, 10 minutes of inactivity requires a fresh filings4u sign in before you can continue.</p>
        <div class="f4u-session-countdown" id="f4uSessionCountdown" aria-live="polite">Opening secure sign in…</div>
        <div class="f4u-session-security-note">Your protected account page remains locked until authentication is completed.</div>
      </div>`;
    document.body.appendChild(root);
    return root;
  }

  function showExpired() {
    const root = ensureModal();
    root.hidden = false;
  }

  function broadcast(message) {
    try { state.channel?.postMessage({ ...message, userId: state.userId }); } catch (_) {}
  }

  function setActivityTimestamp(ts, doBroadcast) {
    state.lastActivity = ts;
    state.lastWrite = ts;
    safeSet(keyFor(state.userId), String(ts));
    if (doBroadcast) broadcast({ type: 'activity', ts });
  }

  function touchActivity(force) {
    if (!state.started || state.expiring) return false;

    const current = now();
    const stored = Math.max(state.lastActivity || 0, readActivity(state.userId) || 0);

    // Never let the first action after 10 minutes silently revive the session.
    if (!stored || current - stored >= state.timeoutMs) {
      expire('session_timeout');
      return false;
    }

    if (!force && current - state.lastWrite < ACTIVITY_WRITE_THROTTLE_MS) {
      state.lastActivity = current;
      return true;
    }

    setActivityTimestamp(current, true);
    return true;
  }

  async function performSignOut(reason) {
    try {
      await window.filings4uAuditEvent?.('session_timeout',{source:'portal'});
      if (state.db?.auth?.signOut) await state.db.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.warn('[filings4u session] sign out returned an error', error);
    } finally {
      location.replace(loginUrl(reason || 'session_timeout'));
    }
  }

  function expire(reason) {
    if (state.expiring) return;
    state.expiring = true;
    safeRemove(keyFor(state.userId));
    showExpired();
    broadcast({ type: 'logout', reason: reason || 'session_timeout', ts: now() });
    window.setTimeout(() => performSignOut(reason || 'session_timeout'), 650);
  }

  function guardEvent(event) {
    if (!state.started || state.expiring) return;

    const stored = Math.max(state.lastActivity || 0, readActivity(state.userId) || 0);
    const stale = !stored || now() - stored >= state.timeoutMs;

    if (stale) {
      if (event?.cancelable) event.preventDefault();
      if (event?.stopImmediatePropagation) event.stopImmediatePropagation();
      else if (event?.stopPropagation) event.stopPropagation();
      expire('session_timeout');
      return;
    }

    touchActivity(false);
  }

  function bindActivity() {
    // Explicit user actions. No background timer is used.
    ['pointerdown', 'click', 'keydown', 'touchstart', 'submit'].forEach((name) => {
      const fn = (event) => guardEvent(event);
      window.addEventListener(name, fn, { capture: true, passive: false });
      state.listeners.push([window, name, fn, true]);
    });

    // Scrolling counts as activity while the session is still fresh.
    ['wheel', 'scroll'].forEach((name) => {
      const fn = () => {
        if (!state.started || state.expiring) return;
        const stored = Math.max(state.lastActivity || 0, readActivity(state.userId) || 0);
        if (stored && now() - stored < state.timeoutMs) touchActivity(false);
      };
      window.addEventListener(name, fn, { capture: true, passive: true });
      state.listeners.push([window, name, fn, true]);
    });

    const storageFn = (event) => {
      if (event.key !== keyFor(state.userId)) return;
      const ts = Number(event.newValue || 0);
      if (Number.isFinite(ts) && ts > state.lastActivity) state.lastActivity = ts;
    };
    window.addEventListener('storage', storageFn);
    state.listeners.push([window, 'storage', storageFn, false]);

    if ('BroadcastChannel' in window) {
      try {
        state.channel = new BroadcastChannel(CHANNEL_NAME);
        state.channel.addEventListener('message', (event) => {
          const data = event.data || {};
          if (String(data.userId || '') !== state.userId) return;
          if (data.type === 'activity' && Number(data.ts) > state.lastActivity) {
            state.lastActivity = Number(data.ts);
          }
          // A logout caused by an explicit stale interaction in another tab should
          // lock this tab too because Supabase auth storage is shared by the browser.
          if (data.type === 'logout' && !state.expiring) {
            state.expiring = true;
            safeRemove(keyFor(state.userId));
            showExpired();
            window.setTimeout(() => performSignOut(data.reason || 'session_timeout'), 650);
          }
        });
      } catch (_) {}
    }
  }

  function start(options) {
    options = options || {};
    const userId = String(options.user?.id || options.userId || '');
    if (!userId || !options.db) return false;

    if (state.started) {
      if (state.userId === userId) return true;
      stop();
    }

    state.started = true;
    state.expiring = false;
    state.db = options.db;
    state.userId = userId;
    state.portal = options.portal === 'admin' ? 'admin' : 'client';
    state.loginPage = options.loginPage || (state.portal === 'admin' ? 'admin-login.html' : 'customer-login.html');
    state.timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : DEFAULT_TIMEOUT_MS;
    state.lastActivity = readActivity(userId);
    state.lastWrite = state.lastActivity || 0;

    // Guards call isExpired() before reveal. start() only binds activity tracking.
    bindActivity();
    return true;
  }

  function stop() {
    state.listeners.forEach(([target, name, fn, capture]) => {
      try { target.removeEventListener(name, fn, capture); } catch (_) {}
    });
    state.listeners = [];
    try { state.channel?.close(); } catch (_) {}
    Object.assign(state, {
      started: false,
      expiring: false,
      db: null,
      userId: '',
      portal: '',
      loginPage: '',
      timeoutMs: DEFAULT_TIMEOUT_MS,
      lastActivity: 0,
      lastWrite: 0,
      channel: null
    });
  }

  function resetForUser(userId) {
    if (!userId) return;
    safeSet(keyFor(userId), String(now()));
  }

  function clearForUser(userId) {
    if (!userId) return;
    safeRemove(keyFor(userId));
  }

  window.filings4uSessionSecurity = {
    start,
    stop,
    isExpired,
    markActivity: () => touchActivity(true),
    resetForUser,
    clearForUser,
    expire: () => expire('session_timeout'),
    get timeoutMinutes() { return DEFAULT_TIMEOUT_MS / 60000; }
  };
})();
