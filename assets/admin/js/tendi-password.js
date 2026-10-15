/* ============================================================
   Tendi password REVEAL toggle (reskin/children-paper)
   Adds an eye button inside every <input type="password"> so the user can
   check what they typed. Self-contained (no jQuery, no CSS file): styles are
   injected once and use design tokens with hard fallbacks, because this also
   runs on the login + account-setup pages which have their own <head>.

   Additive + defensive:
     • the input keeps its id/name/classes/handlers, only `type` flips, so
       validation, autofill and form submission are untouched
     • re-runs on DOM changes (SPA fragments, side drawers, modals)
     • opt out per field with `data-no-reveal`
     • never reveals on submit/blur-to-another-page: state is per field only
   ============================================================ */
(function () {
  'use strict';

  var STYLE_ID = 'tndPwStyle';
  var EYE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-2.8 3.4"/>' +
    '<path d="M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.1-1.4"/>' +
    '<path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m3 3 18 18"/></svg>';

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      '.tnd-pw{position:relative;display:block}' +
      '.tnd-pw>input{padding-right:42px !important}' +
      '.tnd-pw-btn{position:absolute;top:50%;right:7px;transform:translateY(-50%);width:30px;height:30px;' +
        'display:inline-flex;align-items:center;justify-content:center;padding:0;margin:0;border:0;line-height:0;' +
        'background:transparent;color:var(--ink-4,#6b6480);cursor:pointer;border-radius:8px;z-index:2}' +
      '.tnd-pw-btn:hover{color:var(--primary,#5a3fc2);background:var(--primary-tint,rgba(90,63,194,.09))}' +
      '.tnd-pw-btn:focus-visible{outline:2px solid var(--primary,#5a3fc2);outline-offset:1px}' +
      '.tnd-pw-btn svg{width:17px;height:17px;pointer-events:none;display:block}';
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.appendChild(document.createTextNode(css));
    (document.head || document.documentElement).appendChild(s);
  }

  function enhance(input) {
    if (!input || input.__tndPw) return;
    if (input.type !== 'password') return;
    if (input.hasAttribute('data-no-reveal')) return;
    if (input.closest && input.closest('.tnd-pw')) return;      // already wrapped
    input.__tndPw = 1;

    // wrap so the button can sit inside the field regardless of the page's layout
    var wrap = document.createElement('span');
    wrap.className = 'tnd-pw';
    if (input.parentNode) {
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
    } else { return; }

    // Move the field's own vertical margins onto the wrapper. Without this the wrapper is taller
    // than the input (it still contains the input's margin), so a `top:50%` button would sit below
    // the field's centre on pages that space inputs with margin-bottom (e.g. account setup).
    try {
      var cs = window.getComputedStyle(input);
      wrap.style.marginTop = cs.marginTop;
      wrap.style.marginBottom = cs.marginBottom;
      input.style.marginTop = '0';
      input.style.marginBottom = '0';
    } catch (e) {}

    var btn = document.createElement('button');
    btn.type = 'button';                                        // never submits the form
    btn.className = 'tnd-pw-btn';
    btn.tabIndex = -1;                                          // keep tab order: field -> next field
    btn.setAttribute('aria-label', 'Show password');
    btn.setAttribute('title', 'Show password');
    btn.innerHTML = EYE;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var show = input.type === 'password';
      // preserve the caret across the type swap
      var s = input.selectionStart, en = input.selectionEnd;
      input.type = show ? 'text' : 'password';
      btn.innerHTML = show ? EYE_OFF : EYE;
      var lbl = show ? 'Hide password' : 'Show password';
      btn.setAttribute('aria-label', lbl);
      btn.setAttribute('title', lbl);
      try { input.focus(); if (s !== null) input.setSelectionRange(s, en); } catch (err) {}
    });
    wrap.appendChild(btn);
  }

  function scan(root) {
    var scope = (root && root.querySelectorAll) ? root : document;
    var list;
    try { list = scope.querySelectorAll('input[type="password"]'); } catch (e) { return; }
    for (var i = 0; i < list.length; i++) { enhance(list[i]); }
  }

  function start() {
    injectStyle();
    scan(document);
    // SPA fragments / drawers / modals inject password fields long after load
    try {
      var pending = null;
      new MutationObserver(function () {
        if (pending) return;
        pending = setTimeout(function () { pending = null; scan(document); }, 120);
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', start); }
  else { start(); }
})();
