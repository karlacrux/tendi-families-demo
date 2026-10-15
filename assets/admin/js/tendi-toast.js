/* ============================================================
   Tendi toast notifications: thin wrapper over Notyf (vendored at
   assets/admin/plugins/notyf/). Pairs with assets/admin/css/tendi-toast.css.

   Two things this file does:

   1. Exposes a clean API for NEW reskin code:
        tndToast.success("Saved")          tndToast.error("Something broke")
        tndToast.warning("Heads up")       tndToast.info("FYI")
        tndToast.show(msg, type, opts)     tndToast.dismissAll()

   2. Shims the LEGACY global jAlert() so the whole app gets toasts with
      ZERO call-site edits (~465 jAlert calls across 66 views). Legacy usage is
      jAlert(message, title, dialogClass, callback):
        - NO callback  -> render a toast (the vast majority: fire-and-forget
          "Saved" / "Failed" feedback after an AJAX call). dialogClass
          (success/danger/warning/info) maps to the toast severity.
        - WITH callback -> fall through to the ORIGINAL modal jAlert, untouched.
          Those callbacks (e.g. retry-an-upload) need an explicit click to
          acknowledge; a self-dismissing toast firing them would be wrong.

   jConfirm / jPrompt / jCustomConfirm are NOT touched. They return a user
   choice and must stay modal.

   Load order (see common/inc/head.php): notyf.min.js, then this file, both
   AFTER jquery.alerts.js so the original jAlert exists to capture. This is a
   plain global script (no jQuery dep) and is safe to load app-wide.
   ============================================================ */
(function () {
  'use strict';

  if (typeof Notyf === 'undefined') { return; } // notyf.min.js must load first

  // ---- Notyf singleton (lazy: build its DOM container on first use) ----
  var FA = {
    success: 'fa-solid fa-check',
    error:   'fa-solid fa-xmark',
    warning: 'fa-solid fa-triangle-exclamation',
    info:    'fa-solid fa-info',
    'default': 'fa-solid fa-bell'
  };
  // one source of truth for how long each severity stays up (ms): used both for Notyf's own
  // timer and for the stuck-toast sweep below
  var DURATION = {
    success: 3200,
    error:   6000,
    warning: 5000,
    info:    3600,
    'default': 3600
  };
  function typeDef(type, duration) {
    return {
      type: type,
      className: 'tnd-toast--' + type,
      duration: duration,
      // Notyf ships built-in success/error types with a hardcoded coloured
      // backgroundColor; null it so ALL types render as our flat white card and
      // the severity reads only from the icon chip (CSS-driven). '' is falsy, so
      // Notyf sets no inline background and doesn't tint the icon.
      background: '',
      backgroundColor: '',
      icon: { tagName: 'i', className: FA[type] + ' tnd-toast-ico' }
    };
  }
  var _notyf = null;
  function notyf() {
    if (_notyf) return _notyf;
    _notyf = new Notyf({
      ripple: false,                       // we use a flat icon chip, not Notyf's coloured ripple
      dismissible: true,
      position: { x: 'center', y: 'bottom' },
      types: [
        typeDef('success', DURATION.success),
        typeDef('error',   DURATION.error),
        typeDef('warning', DURATION.warning),
        typeDef('info',    DURATION.info),
        typeDef('default', DURATION['default'])
      ]
    });
    return _notyf;
  }

  // ---- helpers ----
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // mirror the legacy plugin: treat the message as plain text, then turn
  // newlines into <br> (Notyf renders message as innerHTML).
  function toHtml(msg) { return escapeHtml(msg == null ? '' : msg).replace(/\n/g, '<br>'); }

  // SAFETY NET: Notyf only detaches a dismissed toast from its `animationend` handler. If that
  // event never fires: animation suppressed by a stylesheet, a background tab that never runs
  // the animation, a browser quirk. The node stays on screen forever even though its timer ran.
  // Sweep anything left in the disappear state shortly after it should have gone.
  function sweepStuckToasts() {
    var stuck = document.querySelectorAll('.notyf__toast--disappear');
    for (var i = 0; i < stuck.length; i++) {
      if (stuck[i].parentNode) { stuck[i].parentNode.removeChild(stuck[i]); }
    }
  }

  function show(msg, type, opts) {
    type = FA[type] ? type : 'default';
    var o = { type: type, message: toHtml(msg) };
    if (opts && typeof opts === 'object') {
      if (opts.duration != null) o.duration = opts.duration;
      if (opts.dismissible != null) o.dismissible = opts.dismissible;
    }
    var n = notyf().open(o);
    var ms = (o.duration != null ? o.duration : DURATION[type]) || 4000;
    if (ms > 0) { setTimeout(sweepStuckToasts, ms + 1200); }
    return n;
  }

  var tndToast = {
    success: function (msg, opts) { return show(msg, 'success', opts); },
    error:   function (msg, opts) { return show(msg, 'error', opts); },
    warning: function (msg, opts) { return show(msg, 'warning', opts); },
    info:    function (msg, opts) { return show(msg, 'info', opts); },
    show:    function (msg, type, opts) { return show(msg, type, opts); },
    dismissAll: function () { if (_notyf) _notyf.dismissAll(); }
  };
  window.tndToast = tndToast;

  // ---- map a legacy jAlert dialogClass to a toast severity ----
  function classToType(dialogClass) {
    switch (String(dialogClass || '').toLowerCase()) {
      case 'success': return 'success';
      case 'danger':
      case 'error':   return 'error';
      case 'warning':
      case 'warn':    return 'warning';
      case 'info':    return 'info';
      default:        return 'default';   // 'inverse' / unknown / omitted
    }
  }

  // ---- shim the legacy global jAlert (capture the original modal first) ----
  var legacyAlert = window.jAlert;        // defined by jquery.alerts.js (loaded before us)

  window.jAlert = function (message, title, dialogClass, callback) {
    // The plugin also documents a 3-arg form jAlert(message, title, callbackFn);
    // if arg3 is a function, treat it as the callback.
    if (typeof dialogClass === 'function') { callback = dialogClass; dialogClass = null; }

    // Anything with a callback keeps the original blocking modal so the
    // callback fires on an explicit user acknowledgement (unchanged behaviour).
    if (typeof callback === 'function') {
      if (typeof legacyAlert === 'function') return legacyAlert(message, title, dialogClass, callback);
      // extremely defensive fallback: no legacy modal available -> toast, then run cb
      show(message, classToType(dialogClass));
      try { callback(true); } catch (e) {}
      return;
    }

    // Fire-and-forget notification -> toast.
    return show(message, classToType(dialogClass));
  };
})();
