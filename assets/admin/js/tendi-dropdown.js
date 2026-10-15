/* ============================================================
   Tendi custom dropdown (.tnd-select): vanilla JS, no deps.
   Pairs with the .tnd-select CSS in tendi-skin.css.

   Features:
   - opens downward, flips up when there isn't room below
   - optional search box that auto-focuses on open
   - selected item is highlighted with a check mark + scrolled into view
   - arrow keys move the cursor; Enter / Space select; Esc closes
   - menu width follows the field; click-away (blur) collapses it
   - writes the chosen value into the wrapper's <input type="hidden">
     and fires a `change` event, so it submits like a normal field.

   Auto-inits every .tnd-select on DOM ready. Re-init dynamically added
   ones with window.TndSelect.init(rootEl).
   ============================================================ */
(function () {
  'use strict';

  function initSelect(root) {
    if (root.__tnd) return;
    root.__tnd = true;

    var trigger = root.querySelector('.tnd-select-trigger');
    var menu = root.querySelector('.tnd-select-menu');
    var labelEl = root.querySelector('.tnd-select-label');
    var optionsWrap = root.querySelector('.tnd-select-options');
    var searchInput = root.querySelector('.tnd-select-search input');
    var emptyEl = root.querySelector('.tnd-select-empty');
    var hidden = root.querySelector('input[type="hidden"]');
    if (!trigger || !menu || !optionsWrap) return;

    var options = Array.prototype.slice.call(optionsWrap.querySelectorAll('.tnd-option'));
    var placeholder = (labelEl && labelEl.getAttribute('data-placeholder')) || 'Select…';
    // a prompt option ("- Select -") is the placeholder, not a menu item: hide it + use it as the clear target
    var phOpt = null;
    options.forEach(function (o, i) {
      var dv = o.getAttribute('data-value');
      if (isPlaceholderText(o.getAttribute('data-label') || o.textContent) && (dv === '' || dv === '0' || i === 0)) { o.classList.add('is-placeholder'); if (!phOpt) phOpt = o; }
    });
    // non-required selects get a "×" to clear the choice (opt out with data-required)
    var clearable = root.hasAttribute('data-clearable') || !root.hasAttribute('data-required');
    if (clearable && !trigger.querySelector('.tnd-select-clear')) {
      var _caret = trigger.querySelector('.tnd-select-caret');
      var _clr = document.createElement('button'); _clr.type = 'button'; _clr.className = 'tnd-select-clear'; _clr.tabIndex = -1; _clr.setAttribute('aria-label', 'Clear selection'); _clr.hidden = true; _clr.innerHTML = '<i class="fa fa-times"></i>';
      if (_caret) trigger.insertBefore(_clr, _caret); else trigger.appendChild(_clr);
      _clr.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); applySelection(null, true); });
    }

    // ---- helpers ----
    function visible() { return options.filter(function (o) { return !o.classList.contains('is-hidden') && !o.classList.contains('is-placeholder'); }); }
    function activeEl() { return optionsWrap.querySelector('.tnd-option.is-active'); }

    function setActive(opt, scroll) {
      options.forEach(function (o) { o.classList.remove('is-active'); });
      if (opt) {
        opt.classList.add('is-active');
        if (scroll) opt.scrollIntoView({ block: 'nearest' });
        if (opt.id) menu.setAttribute('aria-activedescendant', opt.id);
      } else {
        menu.removeAttribute('aria-activedescendant');
      }
    }

    function labelFor(opt) {
      return opt.getAttribute('data-label') || (opt.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function applySelection(opt, fireChange) {
      if (opt && opt.classList.contains('is-placeholder')) opt = null;        // choosing the prompt = clearing
      options.forEach(function (o) { o.classList.remove('is-selected'); o.setAttribute('aria-selected', 'false'); });
      var clrBtn = trigger.querySelector('.tnd-select-clear');
      if (!opt) {
        if (labelEl) { labelEl.textContent = placeholder; labelEl.classList.add('is-placeholder'); }
        if (hidden) { hidden.value = phOpt ? (phOpt.getAttribute('data-value') || '') : ''; if (fireChange) hidden.dispatchEvent(new Event('change', { bubbles: true })); }
        if (clrBtn) clrBtn.hidden = true;
        return;
      }
      opt.classList.add('is-selected');
      opt.setAttribute('aria-selected', 'true');
      if (labelEl) { labelEl.textContent = labelFor(opt); labelEl.classList.remove('is-placeholder'); }
      if (hidden) {
        hidden.value = opt.getAttribute('data-value') || labelFor(opt);
        if (fireChange) hidden.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (clrBtn) clrBtn.hidden = false;
    }

    function select(opt) {
      if (!opt) return;
      applySelection(opt, true);
      close();
      trigger.focus();
    }

    function filter(q) {
      q = (q || '').toLowerCase().trim();
      var any = false;
      options.forEach(function (o) {
        var text = (o.getAttribute('data-label') || o.textContent || '').toLowerCase();
        var match = !q || text.indexOf(q) !== -1;
        o.classList.toggle('is-hidden', !match);
        if (match) any = true;
      });
      if (emptyEl) emptyEl.hidden = any;
      setActive(visible()[0] || null, true);
    }

    function place() {
      root.classList.remove('is-up');
      var rect = trigger.getBoundingClientRect();
      var menuH = menu.offsetHeight; // menu is displayed at this point
      var below = window.innerHeight - rect.bottom;
      var above = rect.top;
      if (menuH + 10 > below && above > below) root.classList.add('is-up');
    }

    function open() {
      if (root.classList.contains('is-open')) return;
      // close any other open dropdown
      document.querySelectorAll('.tnd-select.is-open').forEach(function (s) { if (s !== root && s.__tndClose) s.__tndClose(); });
      root.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      if (searchInput) { searchInput.value = ''; filter(''); }
      place();
      // highlight the selected item (or first) and reveal it
      var sel = optionsWrap.querySelector('.tnd-option.is-selected');
      setActive(sel && !sel.classList.contains('is-hidden') ? sel : (visible()[0] || null), true);
      if (searchInput) searchInput.focus();
    }

    function close() {
      if (!root.classList.contains('is-open')) return;
      root.classList.remove('is-open', 'is-up');
      trigger.setAttribute('aria-expanded', 'false');
      setActive(null);
    }
    root.__tndClose = close;

    function toggle() { root.classList.contains('is-open') ? close() : open(); }

    function move(dir) {
      var vis = visible();
      if (!vis.length) return;
      var idx = vis.indexOf(activeEl());
      idx = (idx === -1) ? (dir > 0 ? 0 : vis.length - 1) : idx + dir;
      if (idx < 0) idx = vis.length - 1;
      if (idx >= vis.length) idx = 0;
      setActive(vis[idx], true);
    }

    function onKey(e) {
      var isSearch = (e.currentTarget === searchInput);
      if (!root.classList.contains('is-open')) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || (e.key === ' ' && !isSearch)) {
          e.preventDefault(); open();
        }
        return;
      }
      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); move(1); break;
        case 'ArrowUp': e.preventDefault(); move(-1); break;
        case 'Home': e.preventDefault(); setActive(visible()[0] || null, true); break;
        case 'End': e.preventDefault(); var v = visible(); setActive(v[v.length - 1] || null, true); break;
        case 'Enter': e.preventDefault(); select(activeEl()); break;
        case ' ': if (!isSearch) { e.preventDefault(); select(activeEl()); } break; // space types in the search box
        case 'Escape': case 'Tab': close(); if (e.key === 'Escape') { e.preventDefault(); trigger.focus(); } break;
      }
    }

    // ---- wire events ----
    trigger.addEventListener('click', function (e) { e.preventDefault(); toggle(); });
    trigger.addEventListener('keydown', onKey);
    if (searchInput) {
      searchInput.addEventListener('keydown', onKey);
      searchInput.addEventListener('input', function () { filter(searchInput.value); });
      // clicks in the search row shouldn't bubble to a select
      searchInput.addEventListener('click', function (e) { e.stopPropagation(); });
    }
    optionsWrap.addEventListener('click', function (e) {
      var opt = e.target.closest ? e.target.closest('.tnd-option') : null;
      if (opt) { e.preventDefault(); select(opt); }
    });
    optionsWrap.addEventListener('mousemove', function (e) {
      var opt = e.target.closest ? e.target.closest('.tnd-option') : null;
      if (opt && !opt.classList.contains('is-active')) setActive(opt, false);
    });

    // give options ids for aria-activedescendant
    options.forEach(function (o, i) { if (!o.id) o.id = (root.id || 'tnd') + '-opt-' + i; o.setAttribute('role', 'option'); });
    menu.setAttribute('role', 'listbox');

    // ---- initial state ----
    applySelection(optionsWrap.querySelector('.tnd-option.is-selected') || null, false);
  }

  // single global outside-click / scroll-close listener
  document.addEventListener('mousedown', function (e) {
    document.querySelectorAll('.tnd-select.is-open').forEach(function (s) {
      if (!s.contains(e.target) && s.__tndClose) s.__tndClose();
    });
  });

  function initAll(ctx) {
    (ctx || document).querySelectorAll('.tnd-select').forEach(initSelect);
  }

  // ----------------------------------------------------------
  // Progressive enhancement of a NATIVE <select> into a .tnd-select.
  // Hides the native control (kept for form submit + JS) and mirrors
  // selection back to it, firing `change` so existing handlers run.
  // ----------------------------------------------------------
  function escHtml(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // A "placeholder" option (e.g. "- Select -", "Choose…", "--") is the prompt, NOT a real choice.
  // It should be the greyed placeholder text but NOT a clickable item in the menu. (Deliberately does
  // NOT match valid choices like "All" / "None", which stay selectable. Those aren't placeholders.)
  function isPlaceholderText(t) {
    t = (t || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!t) return true;
    return /^[-–\s]*((please\s+)?select|choose)\b/.test(t) || /^[-–]{2,}$/.test(t);
  }
  function isPlaceholderOpt(o, i) {
    if (!isPlaceholderText(o.textContent)) return false;
    return o.value === '' || o.value === '0' || i === 0;
  }
  // the first placeholder option in a native <select> (used as the prompt + the "clear" target)
  function placeholderOptOf(sel) {
    for (var i = 0; i < sel.options.length; i++) { if (isPlaceholderOpt(sel.options[i], i)) return sel.options[i]; }
    return null;
  }

  // A list nobody has populated YET is a different problem from "no matches", and a blank panel
  // tells the user nothing. Name the gap and offer the fix. The server stamps data-tnd-empty-*
  // via su_select_attrs(); without those we still explain, just without a link.
  // NOTE: this only reaches selects enhanced into .tnd-select, raw/select2 selects are covered by
  // the server-side su_select_options() migration, which is the real coverage mechanism.
  function emptyStateHTML(sel) {
    var label = sel.getAttribute('data-tnd-empty-label') || '';
    var url   = sel.getAttribute('data-tnd-empty-url') || '';
    var what  = label ? label.toLowerCase() : 'options';
    // role=presentation: this row is a message (it carries the "Add <things>" link), not a choice.
    // A multi's option list is a role=listbox, and a listbox child that is not an option is invalid,
    // which a cascading multi hits every time it renders before its options have loaded.
    return '<div class="tnd-option tnd-option--empty" role="presentation" aria-disabled="true">'
      + '<span class="tnd-opt-label"><b>No ' + escHtml(what) + ' yet</b></span>'
      + (url
          ? '<a class="tnd-opt-add" href="' + escHtml(url) + '" target="_blank" rel="noopener">Add ' + escHtml(what)
            + ' <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/></svg></a>'
          : '<span class="tnd-opt-add is-plain">Nothing to choose from yet</span>')
      + '</div>';
  }

  // ---- multi-select checkbox ------------------------------------------------
  // A single-select marks its choice with a tick that is INVISIBLE until something is picked
  // (.tnd-check is opacity:0 until .is-selected). On a multi that makes an untouched list look
  // exactly like a single-select: nothing on screen says "you may pick more than one". So a multi
  // draws a real checkbox on every row instead, empty box and all, and the tick is dropped.
  //
  // Deliberately inline SVG with inline sizing rather than a stylesheet rule: this component is
  // loaded by pages on several different CSS bundles (tendi-skin, attendance_report, enrollment,
  // roster), and only the first of those carries the .tnd-select rules. Drawing it self-contained
  // means the checkbox looks the same everywhere the component is used, with no bundle to update.
  // Colour comes from `currentColor`, so it inherits the option's own state: muted ink when idle,
  // the primary violet once .is-selected repaints the row.
  function cbSvg(on) {
    return '<svg viewBox="0 0 20 20" width="16" height="16" style="display:block;flex:none" fill="none" aria-hidden="true">'
      + '<rect x="2.5" y="2.5" width="15" height="15" rx="4.5" stroke="currentColor" stroke-width="1.6"'
      + (on ? ' fill="currentColor"' : ' stroke-opacity="0.4"') + '/>'
      + (on ? '<path d="M6.3 10.2 8.8 12.7 13.8 7.5" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>' : '')
      + '</svg>';
  }
  function checkboxHTML(on) {
    return '<span class="tnd-optcb" data-on="' + (on ? '1' : '0') + '" style="display:inline-flex;align-items:center;flex:none">' + cbSvg(on) + '</span>';
  }

  function nativeOptionsHTML(sel) {
    var isMulti = !!sel.multiple;
    var real = Array.prototype.filter.call(sel.options, function (o, i) { return !isPlaceholderOpt(o, i); })
      // a lone disabled "No X yet" option (emitted by su_select_options) isn't a real choice either
      .filter(function (o) { return !(o.disabled && o.value === ''); });
    if (!real.length) { return emptyStateHTML(sel); }
    return real
      .map(function (o) {
        // data-sub = a short "what this is for" note rendered after the label, on the SAME line
        // (e.g. the Role picker: "Admin  Full access to manage this organization"). It stays out
        // of the option's textContent on purpose, so the closed trigger shows just "Admin" and
        // the type-ahead still matches on the name alone.
        var sub = o.getAttribute('data-sub');
        // .tnd-option is `justify-content: space-between`, so with the checkbox added the label has
        // to take up the slack or it would be flung to the far right.
        // A NOTED option needs the opposite treatment. .tnd-option--noted pins the label to
        // `flex: 0 0 auto` so the note is the only shrinkable box, which is right when the row holds
        // just label + note: the note truncates and the name never does. Add a checkbox and that
        // same rule squeezes the note to ZERO width on a narrow row (the enrollment pages put
        // data-sub="Group" options into class pickers that are all `multiple`). So on a multi the
        // label becomes shrinkable too and the two share what is left.
        var labelStyle = isMulti
          ? (sub ? ' style="flex:0 1 auto;min-width:0"' : ' style="flex:1 1 auto;min-width:0"')
          : '';
        return '<div class="tnd-option' + (o.selected ? ' is-selected' : '') + (sub ? ' tnd-option--noted' : '')
          + '" data-value="' + escHtml(o.value) + '"'
          + (isMulti ? ' role="option" aria-selected="' + (o.selected ? 'true' : 'false') + '"' : '') + '>'
          + (isMulti ? checkboxHTML(o.selected) : '')
          + '<span class="tnd-opt-label"' + labelStyle + '>' + escHtml(o.textContent) + '</span>'
          + (sub ? '<span class="tnd-opt-note">' + escHtml(sub) + '</span>' : '')
          + (isMulti ? '' : '<i class="tnd-check fa fa-check"></i>') + '</div>';
      }).join('');
  }

  function syncFromNative(sel) {
    var root = sel.__tndRoot; if (!root) return;
    var lbl = root.querySelector('.tnd-select-label');
    var cur = sel.options[sel.selectedIndex];
    var ph = root.getAttribute('data-placeholder') || 'Select…';
    if (sel.multiple) {                                                              // multi: N-selected label + per-option checks
      var picked = Array.prototype.filter.call(sel.options, function (o) { return o.selected; });
      if (lbl) {
        if (!picked.length) { lbl.textContent = ph; lbl.classList.add('is-placeholder'); }
        else {
          lbl.textContent = picked.length === 1 ? (picked[0].textContent || '').replace(/\s+/g, ' ').trim() : picked.length + ' selected';
          lbl.classList.remove('is-placeholder');
        }
      }
      var vals = picked.map(function (o) { return String(o.value); });
      root.querySelectorAll('.tnd-option').forEach(function (o) {
        if (o.classList.contains('tnd-option--empty')) return;   // the "No X yet" message is not a choice
        var on = vals.indexOf(o.getAttribute('data-value')) !== -1;
        o.classList.toggle('is-selected', on);
        // the checkbox is aria-hidden decoration, so the tick state has to reach a screen reader
        // through aria-selected or a multi sounds identical to a single-select
        o.setAttribute('aria-selected', on ? 'true' : 'false');
        // repaint the checkbox in place. Only the <svg> is swapped, never the row, so a toggle
        // cannot disturb the open menu's search filter or the keyboard cursor sitting on the row.
        var box = o.querySelector('.tnd-optcb');
        if (box && box.getAttribute('data-on') !== (on ? '1' : '0')) {
          box.setAttribute('data-on', on ? '1' : '0');
          box.innerHTML = cbSvg(on);
        }
      });
      var clrM = root.querySelector('.tnd-select-clear');
      if (clrM) clrM.hidden = !picked.length;
      return;
    }
    var phVal = root.getAttribute('data-ph-value');                                  // value of the hidden prompt, or null
    var emptyVal = (phVal != null) ? phVal : '';
    var isEmpty = (phVal != null) ? (sel.selectedIndex < 0 || String(sel.value) === phVal) : (sel.selectedIndex < 0);
    if (lbl) {
      if (isEmpty) { lbl.textContent = ph; lbl.classList.add('is-placeholder'); }
      else { lbl.textContent = cur ? cur.textContent : ph; lbl.classList.remove('is-placeholder'); }
    }
    root.querySelectorAll('.tnd-option').forEach(function (o) {
      o.classList.toggle('is-selected', o.getAttribute('data-value') === String(sel.value));
    });
    var clr = root.querySelector('.tnd-select-clear');                               // show "×" only when a real value is picked
    if (clr) clr.hidden = !(sel.selectedIndex >= 0 && String(sel.value) !== emptyVal && String(sel.value) !== '');
  }
  // A search box is only worth showing once the list is long enough to need one.
  // This is re-decided on every rebuild, not just at enhance time: a cascading select
  // (pick a branch -> its classes load by AJAX) is EMPTY when it gets enhanced, so
  // deciding once would leave a 40-item class list with no way to search it.
  var SEARCH_FROM = 7;
  function syncSearchRow(sel) {
    var root = sel.__tndRoot; if (!root) return;
    var row = root.querySelector('.tnd-select-search'); if (!row) return;
    row.hidden = (sel.options.length < SEARCH_FROM);
  }
  function rebuildNative(sel) {
    var root = sel.__tndRoot; if (!root) return;
    root.querySelector('.tnd-select-options').innerHTML = nativeOptionsHTML(sel);
    syncSearchRow(sel);
    syncFromNative(sel);
  }

  function enhanceNative(sel) {
    if (sel.__tndRoot) {
      // already enhanced → just refresh, but NOT while the menu is open (a multi-filter toggle
      // redraws the table, which re-runs the enhancer pipeline mid-interaction; a rebuild here
      // would wipe the open menu's search filter + active state under the user's cursor)
      if (!sel.__tndRoot.classList.contains('is-open')) rebuildNative(sel);
      return;
    }
    var isMulti = !!sel.multiple;
    var phOpt = placeholderOptOf(sel);
    // a data-placeholder attribute on the native select wins (e.g. a multi FILTER's empty state
    // means "no restriction" → the field should read "All", not "Select…")
    var phText = sel.getAttribute('data-placeholder') || (phOpt ? phOpt.textContent.replace(/\s+/g, ' ').trim() : 'Select…');
    // offer a "×" clear ONLY when the select is non-required AND has a placeholder/empty option to
    // clear TO. A select with no empty state (e.g. Rows-per-page 10/25/50/100/200) is effectively
    // required: clearing it is meaningless, so no "×". (data-required still forces no-clear.)
    // A multi always has an empty state (deselect everything) → clearable unless data-required.
    var clearable = !sel.disabled && !sel.hasAttribute('data-required') && (isMulti || (!sel.required && !!phOpt));
    var root = document.createElement('div');
    root.className = 'tnd-select tnd-select--native' + (isMulti ? ' tnd-select--multi' : '');
    root.setAttribute('data-placeholder', phText);
    if (phOpt) root.setAttribute('data-ph-value', phOpt.value);
    root.innerHTML =
      '<div class="tnd-select-trigger" role="combobox" tabindex="0" aria-haspopup="listbox" aria-expanded="false">'
      + '<span class="tnd-select-label"></span>'
      + (clearable ? '<button type="button" class="tnd-select-clear" tabindex="-1" aria-label="Clear selection" hidden><i class="fa fa-times"></i></button>' : '')
      + '<i class="tnd-select-caret fa fa-chevron-down"></i></div>'
      + '<div class="tnd-select-menu">'
      +   '<div class="tnd-select-search"' + (sel.options.length < SEARCH_FROM ? ' hidden' : '') + '><i class="fa fa-search"></i><input type="text" placeholder="Search…" autocomplete="off"></div>'
      // the multi options are role="option", so their direct parent has to be the listbox the
      // trigger's aria-haspopup already promises, and aria-multiselectable is what actually tells
      // a screen reader "more than one" (the checkbox is decoration, it says nothing)
      +   '<div class="tnd-select-options"' + (isMulti ? ' role="listbox" aria-multiselectable="true"' : '') + '>' + nativeOptionsHTML(sel) + '</div>'
      +   '<div class="tnd-select-empty" hidden>No matches</div>'
      + '</div>';
    sel.style.display = 'none'; sel.setAttribute('aria-hidden', 'true'); sel.tabIndex = -1;
    sel.parentNode.insertBefore(root, sel.nextSibling);
    sel.__tndRoot = root;
    // Claim the root for the native path. initSelect() drives HAND-WRITTEN .tnd-select markup and
    // would otherwise re-initialise this one the next time initAll() sweeps the page: it binds a
    // second trigger handler (so the trigger opens and instantly closes) and, being single-select
    // only, rewrites a multi's "2 selected" label to the first picked option.
    // The app is safe by accident of load order: head.php loads this script `defer`, so initAll()
    // runs at end-of-parse, before any view enhances. A page that loads it WITHOUT defer inverts
    // that, enhance() runs first and the DOMContentLoaded sweep lands on the finished roots, which
    // is exactly what the kitchen-sink harness does.
    root.__tnd = true;
    // "×" clear → reset to the prompt/empty value (non-required only) and fire change;
    // multi: deselect everything (= the filter's "All")
    var clearBtn = root.querySelector('.tnd-select-clear');
    if (clearBtn) clearBtn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (isMulti) { Array.prototype.forEach.call(sel.options, function (o) { o.selected = false; }); }
      else { var pv = root.getAttribute('data-ph-value'); sel.value = (pv != null ? pv : ''); }
      syncFromNative(sel); sel.dispatchEvent(new Event('change', { bubbles: true }));
    });

    var trigger = root.querySelector('.tnd-select-trigger');
    var menu = root.querySelector('.tnd-select-menu');
    var optsWrap = root.querySelector('.tnd-select-options');
    var searchInput = root.querySelector('.tnd-select-search input');
    var emptyEl = root.querySelector('.tnd-select-empty');
    function filterOpts(q) {
      q = (q || '').toLowerCase().trim(); var any = false;
      Array.prototype.forEach.call(optsWrap.querySelectorAll('.tnd-option'), function (o) {
        var m = !q || (o.textContent || '').toLowerCase().indexOf(q) !== -1;
        o.style.display = m ? '' : 'none'; if (m) any = true;
      });
      if (emptyEl) emptyEl.hidden = any;
    }

    function setAct(o) { optsWrap.querySelectorAll('.tnd-option.is-active').forEach(function (x) { x.classList.remove('is-active'); }); if (o) { o.classList.add('is-active'); o.scrollIntoView({ block: 'nearest' }); } }
    function open() {
      document.querySelectorAll('.tnd-select.is-open').forEach(function (s) { if (s !== root && s.__tndClose) s.__tndClose(); });
      root.classList.add('is-open'); trigger.setAttribute('aria-expanded', 'true'); root.classList.remove('is-up');
      var r = trigger.getBoundingClientRect(), mh = menu.offsetHeight, below = window.innerHeight - r.bottom;
      if (mh + 10 > below && r.top > below) root.classList.add('is-up');
      var s = optsWrap.querySelector('.tnd-option.is-selected'); setAct(s); if (s) s.scrollIntoView({ block: 'nearest' });
      // the search row is hidden on short lists (see syncSearchRow) - don't chase focus into it
      var searchOn = searchInput && !searchInput.closest('.tnd-select-search').hidden;
      if (searchInput) { searchInput.value = ''; filterOpts(''); }
      if (searchOn) setTimeout(function () { try { searchInput.focus(); } catch (e) {} }, 20);
    }
    function close() { root.classList.remove('is-open', 'is-up'); trigger.setAttribute('aria-expanded', 'false'); setAct(null); }
    root.__tndClose = close;
    function choose(opt) {
      if (!opt) return;
      if (isMulti) {                                     // toggle + STAY OPEN for more picks
        var v = opt.getAttribute('data-value');
        Array.prototype.forEach.call(sel.options, function (o) { if (String(o.value) === v) o.selected = !o.selected; });
        syncFromNative(sel);
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
      sel.value = opt.getAttribute('data-value'); syncFromNative(sel); close(); trigger.focus(); sel.dispatchEvent(new Event('change', { bubbles: true }));
    }

    trigger.addEventListener('click', function (e) { e.preventDefault(); root.classList.contains('is-open') ? close() : open(); });
    trigger.addEventListener('keydown', function (e) {
      if (!root.classList.contains('is-open')) { if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } return; }
      var vis = Array.prototype.slice.call(optsWrap.querySelectorAll('.tnd-option'));
      var i = vis.indexOf(optsWrap.querySelector('.tnd-option.is-active') || optsWrap.querySelector('.tnd-option.is-selected'));
      if (e.key === 'ArrowDown') { e.preventDefault(); setAct(vis[Math.min(vis.length - 1, i + 1)] || vis[0]); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setAct(vis[Math.max(0, i - 1)] || vis[0]); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(optsWrap.querySelector('.tnd-option.is-active') || vis[0]); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); trigger.focus(); }
    });
    // The empty state is a .tnd-option too, but it is a message, not a choice: it carries the
    // "Add <things>" link that emptyStateHTML() builds. preventDefault() on it killed that link,
    // so every "No X yet, add some" panel in the app was a dead end (found on the branch pane's
    // neighborhood picker, Trello ZM364E3I). Let the anchor through and select nothing.
    optsWrap.addEventListener('click', function (e) {
      var o = e.target.closest('.tnd-option');
      if (!o || o.classList.contains('tnd-option--empty')) { return; }
      e.preventDefault(); choose(o);
    });
    optsWrap.addEventListener('mousemove', function (e) { var o = e.target.closest('.tnd-option'); if (o) setAct(o); });
    if (searchInput) {
      searchInput.addEventListener('input', function () { filterOpts(searchInput.value); });
      searchInput.addEventListener('click', function (e) { e.stopPropagation(); });
      searchInput.addEventListener('keydown', function (e) {
        e.stopPropagation();
        var vis = Array.prototype.filter.call(optsWrap.querySelectorAll('.tnd-option'), function (o) { return o.style.display !== 'none'; });
        var i = vis.indexOf(optsWrap.querySelector('.tnd-option.is-active'));
        if (e.key === 'Escape') { close(); trigger.focus(); }
        else if (e.key === 'Enter') { e.preventDefault(); choose(optsWrap.querySelector('.tnd-option.is-active') || vis[0]); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); setAct(vis[Math.min(vis.length - 1, i + 1)] || vis[0]); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setAct(vis[Math.max(0, i - 1)] || vis[0]); }
      });
    }

    sel.addEventListener('change', function () { syncFromNative(sel); });           // programmatic value changes
    if (window.MutationObserver) { new MutationObserver(function () { rebuildNative(sel); }).observe(sel, { childList: true }); }  // dynamic <option>s
    syncFromNative(sel);
  }

  function enhance(target, ctx) {
    var els;
    if (typeof target === 'string') els = (ctx || document).querySelectorAll(target);
    else if (target && target.nodeType === 1) els = [target];          // a single element (note: a <select> has .length = option count, so test nodeType first)
    else if (target && target.length != null) els = target;            // NodeList / array / jQuery
    else els = [];
    Array.prototype.forEach.call(els, function (el) { if (el && el.tagName === 'SELECT') enhanceNative(el); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initAll(); });
  } else {
    initAll();
  }

  // sync() vs refresh()/enhance(): refresh REBUILDS the option list, and is skipped while the
  // menu is open so a rebuild can't yank the list out from under the cursor. When code changes
  // only the SELECTION (sel.value = …, or clearing a multi) the options are untouched and all
  // that is stale is the closed label + the ticks - which is this, and it is always safe to run.
  function syncOne(sel) { if (sel && sel.__tndRoot) syncFromNative(sel); }

  window.TndSelect = { init: initAll, initOne: initSelect, enhance: enhance, refresh: rebuildNative, sync: syncOne };
})();
