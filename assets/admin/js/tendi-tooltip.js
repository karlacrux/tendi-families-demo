/* ============================================================
   Tendi INFO TOOLTIP (reskin/children-paper): library component
   ------------------------------------------------------------
   Markup (drop this anywhere, no wiring needed):

     <span class="tnd-info" tabindex="0" role="button" aria-label="About X"
           data-tip="Short explanation. Requirements if any.">
       <svg …info icon…></svg>
     </span>

   Behaviour:
     • hover OR keyboard focus opens it; leave / blur / Esc / scroll closes it
     • the bubble is PORTALLED to <body> with position:fixed, so a scrollable
       side pane, drawer or modal can never clip it
     • flips above/below and clamps to the viewport so it is always readable
     • aria-describedby is wired while open (screen readers announce it)
     • delegated + observer-free: works for markup injected later by the SPA
   ============================================================ */
(function () {
  'use strict';

  var TIP_ID = 'tndTip', OPEN_DELAY = 90, CLOSE_DELAY = 60, GAP = 9, EDGE = 8;
  var tipEl = null, current = null, showT = null, hideT = null, watchT = null, seq = 0;

  function tip() {
    if (tipEl && document.body.contains(tipEl)) return tipEl;
    tipEl = document.createElement('div');
    tipEl.className = 'tnd-tip';
    tipEl.id = TIP_ID;
    tipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(tipEl);
    return tipEl;
  }

  function place(trigger) {
    var t = tip();
    var r = trigger.getBoundingClientRect();
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;

    t.style.maxWidth = Math.min(264, vw - EDGE * 2) + 'px';
    t.style.left = '0px'; t.style.top = '0px';          // measure unconstrained
    var tw = t.offsetWidth, th = t.offsetHeight;

    // prefer above; flip below when there isn't room
    var above = r.top - GAP - th >= EDGE;
    var top = above ? (r.top - GAP - th) : (r.bottom + GAP);
    if (!above && top + th > vh - EDGE) { top = Math.max(EDGE, vh - EDGE - th); }

    // centre on the trigger, then clamp into the viewport
    var left = r.left + r.width / 2 - tw / 2;
    left = Math.max(EDGE, Math.min(left, vw - EDGE - tw));

    t.style.left = Math.round(left) + 'px';
    t.style.top = Math.round(top) + 'px';
    t.setAttribute('data-place', above ? 'top' : 'bottom');

    // arrow follows the trigger's centre even when the bubble was clamped
    var ax = r.left + r.width / 2 - left;
    ax = Math.max(12, Math.min(ax, tw - 12));
    t.style.setProperty('--tnd-tip-ax', Math.round(ax) + 'px');
  }

  /**
   * Is this trigger still a real, visible thing on the page?
   * A re-render under a STATIONARY cursor fires mouseover for whatever lands under the pointer,
   * so a tip can open on an element that is then replaced or hidden a moment later. No mouseout
   * ever arrives for a node that was removed, so without this the bubble stays up forever,
   * anchored to a rect that has collapsed to 0,0 (it parks itself in the top-left corner).
   */
  function alive(el) {
    if (!el || !document.contains(el)) return false;
    var r = el.getBoundingClientRect();
    if (r.width <= 0 && r.height <= 0) return false;

    // Still on the page, but is it still on TOP? An overlay, drawer or modal opening over the
    // trigger leaves it laid out and hoverable-looking while the pointer can no longer reach it,
    // so the same orphaned bubble results. Ask the document what is actually at that point.
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > document.documentElement.clientWidth
                         || cy > document.documentElement.clientHeight) return false;
    var hit = document.elementFromPoint(cx, cy);
    if (!hit) return false;
    return hit === el || el.contains(hit) || hit === tipEl || (tipEl && tipEl.contains(hit));
  }

  function watch() {
    clearInterval(watchT);
    watchT = setInterval(function () {
      if (!current) { clearInterval(watchT); return; }
      if (!alive(current)) { close(); }
    }, 150);
  }

  function open(trigger) {
    var text = trigger.getAttribute('data-tip');
    if (!text) return;
    current = trigger;
    var t = tip();
    t.textContent = text;                                // text only, never inject HTML
    t.style.display = 'block';
    place(trigger);
    // next frame so the transition runs from the hidden state
    (window.requestAnimationFrame || setTimeout)(function () { t.classList.add('is-open'); });
    if (!trigger.id) { trigger.id = 'tndInfo' + (++seq); }
    trigger.setAttribute('aria-describedby', TIP_ID);
    watch();
  }

  function close() {
    clearInterval(watchT);
    if (tipEl) { tipEl.classList.remove('is-open'); }
    if (current) { current.removeAttribute('aria-describedby'); }
    current = null;
    if (tipEl) {
      clearTimeout(tipEl.__hideT);
      tipEl.__hideT = setTimeout(function () {
        if (!tipEl.classList.contains('is-open')) { tipEl.style.display = 'none'; }
      }, 200);
    }
  }

  function trigFrom(e) {
    var el = e.target;
    return (el && el.closest) ? el.closest('[data-tip]') : null;
  }
  function schedOpen(trigger) {
    clearTimeout(hideT); clearTimeout(showT);
    if (current === trigger) return;
    showT = setTimeout(function () { open(trigger); }, OPEN_DELAY);
  }
  function schedClose() {
    clearTimeout(showT); clearTimeout(hideT);
    hideT = setTimeout(close, CLOSE_DELAY);
  }

  document.addEventListener('mouseover', function (e) {
    var t = trigFrom(e); if (t) { schedOpen(t); }
  });
  document.addEventListener('mouseout', function (e) {
    var t = trigFrom(e); if (t && t === current) { schedClose(); }
    else if (t) { clearTimeout(showT); }
  });
  document.addEventListener('focusin', function (e) {
    var t = trigFrom(e); if (t) { clearTimeout(hideT); open(t); }
  });
  document.addEventListener('focusout', function (e) {
    var t = trigFrom(e); if (t && t === current) { close(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && current) { close(); }
  });
  // a tooltip anchored to a moving element would float away: close instead
  window.addEventListener('scroll', function () { if (current) { close(); } }, true);
  window.addEventListener('resize', function () { if (current) { close(); } });
  /**
   * Is this hint attached to something that DOES something when clicked?
   *
   * A bare hint (the little info glyph) is inert, and swallowing its click is what stops a tap on
   * a hint inside a <label> from flipping the control that label is bound to. A hint on a real
   * CONTROL is the opposite case: swallowing there kills the control.
   *
   * That is not hypothetical. `data-tip="Pick any colour"` sits on the <label> wrapping the
   * designer's <input type="color">, so preventDefault() here stopped the browser from ever
   * opening its colour picker: the swatch looked like a button that did nothing.
   */
  function interactive(el) {
    if (!el) return false;
    if (el.matches('a[href], button, input, select, textarea, label, summary, [contenteditable="true"]')) return true;
    // a hint wrapping a control counts too: the click is meant for what is inside it
    return !!el.querySelector('a[href], button, input, select, textarea');
    /* ⚠ ARIA ROLES ARE DELIBERATELY NOT CONSULTED. `.tnd-info`, the hint glyph this component was
       built for, is a <span role="button"> for the keyboard, and there are 30+ of them in Settings
       alone. Treating role="button" as a control would stop swallowing exactly the case the swallow
       exists for: admin_users_manage.php has one INSIDE a <label> that wraps a checkbox, and a tap
       on the hint would then flip the toggle. A role is an accessibility promise, not a native
       action; what matters here is whether the browser does something on click. */
  }

  // touch: tapping a bare hint toggles it. Swallowed only for inert hints, per interactive() above.
  document.addEventListener('click', function (e) {
    var t = trigFrom(e);
    if (!t) { if (current) { close(); } return; }
    if (interactive(t)) { close(); return; }   // let the control do its job
    /* preventDefault ONLY, never stopPropagation. Cancelling the default is what stops an enclosing
       <label> from activating its control, which is the whole point. Stopping propagation as well
       would also kill any DELEGATED handler bound further up, which is how most of this app's
       buttons are wired, so a hint on a custom widget would silently disable that widget. */
    e.preventDefault();
    if (current === t) { close(); } else { clearTimeout(showT); open(t); }
  });
})();
