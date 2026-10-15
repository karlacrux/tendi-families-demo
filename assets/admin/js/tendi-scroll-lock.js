/*
 * tendi-scroll-lock.js: kill the "the page jumps sideways when a popup opens" shift.
 *
 * THE PROBLEM
 *   When a popup locks page scroll (Bootstrap 3 modals add `.modal-open`; the legacy
 *   DevOops modal adds `.body-expanded`, both map to `overflow-y:hidden` on <body>
 *   in style.css), the window's vertical scrollbar disappears. The viewport then
 *   gets ~15px wider, so every in-flow element AND the fixed full-width top navbar
 *   slide that far to the right. On a page that already had a scrollbar this is a
 *   visible jump; on a page with NO scrollbar the old CSS hack (`margin-right:15px`,
 *   now removed) made it WORSE by shifting even when there was nothing to compensate.
 *
 * THE FIX  (the technique Bootstrap 4/5 ship, "measure and pad")
 *   While the page is locked, reserve the exact width the scrollbar occupied by
 *   adding equal right-padding to the elements that would otherwise widen, then
 *   remove it on unlock. Crucially the padding is applied ONLY when the page truly
 *   had a scrollbar, so no-scrollbar pages get 0px and never move, and on systems
 *   with overlay scrollbars (which take no layout space) the measured width is 0,
 *   which is also correct because there was no shift to begin with.
 *
 * WHY A CLASS WATCHER (and not modal open/close hooks)
 *   Both popup systems do the same thing: toggle a class on <body>. Watching that
 *   class with a MutationObserver covers every popup (current and future), without
 *   coupling to Bootstrap's events or the DevOops OpenModalBox/CloseModalBox calls,
 *   and it sidesteps the event-ordering race against Bootstrap's own delegated
 *   `show.bs.modal -> addClass('modal-open')` handler.
 */
(function () {
  'use strict';

  // Body classes that mean "page scroll is locked behind a popup".
  var LOCK_CLASSES = ['modal-open', 'body-expanded'];

  // Fixed elements that are sized to the viewport's right edge and therefore widen
  // when the scrollbar vanishes. Body padding can't move them (they're positioned to
  // the viewport, not to <body>), so each needs its own compensation. The top navbar
  // is `position:fixed; width:100%` and sits above the modal backdrop, so its shift
  // is plainly visible. Left-anchored fixed elements (#sidebar-left, the sub-pane)
  // are unaffected by a right-edge change and are intentionally left out.
  var FIXED_SELECTOR = '.navbar';

  var state = { locked: false, saved: [], htmlOverflow: null };

  // (The old off-screen probe that measured the OS scrollbar width is gone: the
  // viewport's own innerWidth/clientWidth delta is the real number and needs no
  // element in the document to find it.)

  function isLocked() {
    var cl = document.body.classList;
    for (var i = 0; i < LOCK_CLASSES.length; i++) {
      if (cl.contains(LOCK_CLASSES[i])) return true;
    }
    return false;
  }

  // How much width the viewport currently gives up to a scrollbar. Measured, not
  // inferred: `scrollHeight > clientHeight` was the old test, and it answers the
  // wrong question now that tendi-shell.css sets `html { overflow-y: scroll }`. A
  // short page under that rule shows a scrollbar while its content is NOT taller
  // than the viewport, so the old test said "no scrollbar", skipped compensation,
  // and let the page jump. Overlay scrollbars correctly measure 0.
  function reservedScrollbarWidth() {
    var w = window.innerWidth - document.documentElement.clientWidth;
    return w > 0 ? w : 0;
  }

  // Does <html> own the document scroll? tendi-shell.css makes it so, to keep the
  // scrollbar visible at all times. That stops <body>'s overflow propagating to the
  // viewport, so the `overflow-y:hidden` popups set on <body> no longer locks
  // anything and we have to move the lock up here ourselves.
  function htmlOwnsScroll() {
    var v = getComputedStyle(document.documentElement).overflowY;
    return v === 'scroll' || v === 'auto';
  }

  function targets() {
    var els = [document.body];
    var fixed = document.querySelectorAll(FIXED_SELECTOR);
    for (var i = 0; i < fixed.length; i++) els.push(fixed[i]);
    return els;
  }

  function lock() {
    state.locked = true;
    state.saved = [];
    // Measure BEFORE hiding the scrollbar: this is exactly the width about to be
    // handed back to the layout, so it is exactly what has to be paid back.
    var comp = reservedScrollbarWidth();

    // Take the scroll away at the level that actually owns it. Without this the
    // background keeps scrolling behind the popup, because <body>'s overflow no
    // longer reaches the viewport.
    state.htmlOverflow = null;
    if (htmlOwnsScroll()) {
      state.htmlOverflow = document.documentElement.style.overflowY;
      document.documentElement.style.overflowY = 'hidden';
    }

    if (comp <= 0) return; // no scrollbar, or overlay scrollbars -> nothing shifts.
    targets().forEach(function (el) {
      var current = parseFloat(getComputedStyle(el).paddingRight) || 0;
      // Remember the ORIGINAL inline value so unlock restores it exactly (usually
      // '': i.e. hand back control to the stylesheet).
      state.saved.push({ el: el, inline: el.style.paddingRight });
      el.style.paddingRight = (current + comp) + 'px';
    });
  }

  function unlock() {
    if (state.htmlOverflow !== null && state.htmlOverflow !== undefined) {
      document.documentElement.style.overflowY = state.htmlOverflow;
    }
    state.htmlOverflow = null;
    state.saved.forEach(function (s) { s.el.style.paddingRight = s.inline; });
    state.locked = false;
    state.saved = [];
  }

  // Reconcile our padding with the body's current lock state. Only acts on the
  // unlocked<->locked edge, so unrelated class changes (or our own style writes,
  // which aren't class changes anyway) are no-ops.
  function sync() {
    var locked = isLocked();
    if (locked && !state.locked) lock();
    else if (!locked && state.locked) unlock();
  }

  function start() {
    new MutationObserver(sync).observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });
    sync(); // handle the (rare) case where a popup is already open at load.
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
