// Tendi <-> OpenReplay (self-hosted at replay.webaryco.com).
//
// Why this file exists instead of the canonical Repos/Replay
// frontend-integration/openreplay.js: that template is written for a Vite/React
// app and reads import.meta.env. The Tendi dashboard is CodeIgniter with no
// bundler, so the tracker is vendored next to this file as a pinned ESM build
// and configured from a plain object that PHP prints into the page
// (window.__TENDI_OR__ -- see application/views/admin/common/inc/head.php).
//
// Masking is OFF by decision (2026-09-03): this instance is self-hosted on
// Webary infrastructure and 30-day retention is the control, not masking.
// See Repos/Tendi/docs/OPENREPLAY-ROLLOUT-PLAN.md section 8.

import Tracker from './tracker-18.1.5.esm.js';

const cfg = window.__TENDI_OR__ || {};

// No project key configured for this environment -> stay completely inert.
// (Local dev boxes without the constant set should not phone home.)
if (!cfg.projectKey || !cfg.ingestPoint) {
  window.TendiReplay = { enabled: false, event() {}, identify() {}, sessionId: () => null };
} else {
  const tracker = new Tracker({
    projectKey: cfg.projectKey,
    ingestPoint: cfg.ingestPoint,

    // Every default mask off -- see header comment. The server-side
    // projects.gdpr row must agree or it overrides these; that is applied by
    // Repos/Replay/server-config/tendi-projects.sql.
    obscureTextEmails: false,
    obscureTextNumbers: false,
    obscureInputEmails: false,
    obscureInputNumbers: false,
    obscureInputDates: false,
    defaultInputMode: 0, // Plain

    // Capture request/response bodies so a failed save shows the server's
    // actual error, not a bare 500. Auth endpoints are stripped so admin
    // passwords and OTP codes never reach the recording.
    network: {
      capturePayload: true,
      ignoreHeaders: ['Authorization', 'Cookie', 'Set-Cookie'],
      sanitizer: (data) => {
        if (/\/(account|login|logout|otp|password|token|reset)\b/i.test(data.url || '')) {
          if (data.request) data.request.body = null;
          if (data.response) data.response.body = null;
        }
        return data;
      },
    },

    respectDoNotTrack: false,

    // Allow http:// on local dev boxes; production is https and unaffected.
    __DISABLE_SECURE_MODE: !!cfg.dev,
  });

  const meta = cfg.metadata || {};

  tracker.start({
    userID: cfg.userID || undefined,
    metadata: meta,
  }).catch(() => { /* never let replay break the dashboard */ });

  // ---- SPA navigation -------------------------------------------------
  // Admin pages are AJAX partials: devoops.js sets window.location.hash and
  // swaps #content, so the document URL's hash is the only thing that says
  // which screen the user is on. Emit an explicit, searchable event on every
  // hash change -- without this a two-hour admin session is a single
  // undifferentiated page in the session list.
  let lastHash = null;
  const reportLocation = () => {
    const h = (window.location.hash || '').replace(/^#/, '') || '/';
    if (h === lastHash) return;
    lastHash = h;
    try { tracker.event('navigate', h); } catch (e) { /* ignore */ }
  };
  window.addEventListener('hashchange', reportLocation);
  reportLocation();

  window.TendiReplay = {
    enabled: true,
    tracker,
    event: (name, payload) => { try { tracker.event(name, payload); } catch (e) {} },
    identify: (id, metadata) => {
      try {
        if (id) tracker.setUserID(id);
        Object.entries(metadata || {}).forEach(([k, v]) => {
          if (v !== null && v !== undefined && v !== '') tracker.setMetadata(k, String(v));
        });
      } catch (e) { /* ignore */ }
    },
    sessionId: () => { try { return tracker.getSessionID(); } catch (e) { return null; } },
  };

  // Make the session id available to jQuery AJAX callers so server-side logs
  // can be grepped by it (see head.php for the header wiring).
  window.TendiReplaySessionId = () => window.TendiReplay.sessionId();
}
