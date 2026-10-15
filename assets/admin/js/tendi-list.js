/* ============================================================
   Tendi generic list enhancer (reskin/children-paper)
   Brings the Users-page BEHAVIOR to every generic .tnd-list-generic page
   WITHOUT rebuilding each entity's form/backend:
     • Add / row-Edit / whole-row click open the entity's EXISTING add/edit
       form inside a styled slide-in side drawer (reuses the form's own JS +
       /save endpoint). On save the legacy form calls LoadAjaxContent(list),
       which we detect (MutationObserver on #ajax-content) to auto-close the
       drawer, so it reads as "edit in a pane, list refreshes."
   Additive + defensive: if anything is missing it falls back to the legacy
   full-fragment navigation (never breaks the page). Re-runs safely on every
   SPA fragment load (handlers are namespaced + re-bound).
   ============================================================ */
(function () {
  var jq = window.jQuery;

  // ---- SELF-HEAL for the blank-page-on-hard-refresh bug ----------------------------------------
  // On a hard refresh the legacy devoops bootstrap loads the initial #ajax-content fragment via an
  // `async:false` request whose ERROR handler is EMPTY (devoops.js). So if that one request ever
  // fails (a network blip, a transient 5xx, a browser blocking the sync XHR), the page is left a
  // SILENT BLANK with no recovery but a full re-login. Detect an empty content area shortly after
  // load and re-fire the fragment load a couple of times; if it still won't load, show a visible
  // Reload instead of a permanent blank. Only ever acts when the area is ALREADY empty (a broken
  // state), so it can't disturb a healthy load. Independent of jQuery so it runs regardless.
  (function bootSelfHeal() {
    var MAX = 2, tries = 0;
    function pageFromHash() {
      var h = (window.location.hash || '').replace(/^#/, '');
      return h.split('?')[0] || 'dashboard';
    }
    function contentEmpty() {
      var el = document.getElementById('ajax-content');
      if (!el) return false;
      if (el.querySelector('*')) return false;             // has any element child → loaded
      return (el.textContent || '').trim() === '';
    }
    function showReload() {
      var el = document.getElementById('ajax-content');
      if (!el || !contentEmpty()) return;
      el.innerHTML =
        '<div style="max-width:440px;margin:14vh auto 0;text-align:center;font-family:Inter,-apple-system,sans-serif;color:#5b5470">' +
          '<p style="font-size:15px;line-height:1.5;margin:0 0 16px">This page didn’t finish loading. This is usually a temporary hiccup.</p>' +
          '<button type="button" onclick="location.reload()" style="height:40px;padding:0 22px;border:0;border-radius:10px;background:#5a3fc2;color:#fff;font-weight:600;font-size:14px;cursor:pointer">Reload the page</button>' +
        '</div>';
    }
    function attempt() {
      if (!contentEmpty()) return;                          // content present → nothing to heal
      if (tries >= MAX) { showReload(); return; }
      tries++;
      if (typeof window.LoadAjaxContent === 'function') {
        try { window.LoadAjaxContent(pageFromHash()); } catch (e) {}
      }
      setTimeout(attempt, 1200);
    }
    function start() { setTimeout(attempt, 1500); }         // after the sync bootstrap has run
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', start); }
    else { start(); }
  })();
  // ---------------------------------------------------------------------------------------------

  // ---- #content VISIBILITY GUARD ----------------------------------------------------------------
  // Symptom: after a hard refresh the page looked blank. The fragment loaded fine (251KB of markup
  // present) but #content carried an INLINE `display:none`, so the whole content column collapsed to
  // height 0: recoverable only by signing out and back in. Nothing in this codebase hides #content
  // (verified: no CSS rule matches it, no JS targets it), so the setter is something outside our
  // control: a stray legacy/plugin call or an extension. #content is the app's only content column
  // and must NEVER be display:none, so we enforce that invariant and repair it if it happens.
  // Also instruments jQuery's hiding methods to name the culprit in the console if it recurs.
  (function contentVisibilityGuard() {
    function repair() {
      var c = document.getElementById('content');
      if (c && c.style && c.style.display === 'none') {
        c.style.removeProperty('display');            // no infinite loop: it's no longer 'none'
        try { console.warn('[tendi] #content had an inline display:none, restored by the visibility guard.'); } catch (e) {}
      }
    }
    // name whoever hides it (runs before devoops' document.ready handlers, so the wrap is in place)
    (function instrument() {
      var $ = window.jQuery;
      if (!$ || !$.fn || $.fn.__tndHideInstrumented) return;
      $.fn.__tndHideInstrumented = 1;
      ['hide', 'fadeOut', 'slideUp', 'toggle'].forEach(function (m) {
        var orig = $.fn[m];
        if (typeof orig !== 'function') return;
        $.fn[m] = function () {
          try {
            if (this.filter && this.filter('#content').length) {
              console.warn('[tendi] jQuery.' + m + '() was called on #content by:\n' + ((new Error()).stack || '(no stack)'));
            }
          } catch (e) {}
          return orig.apply(this, arguments);
        };
      });
    })();
    function start() {
      var c = document.getElementById('content');
      if (!c) return;
      repair();
      try { new MutationObserver(repair).observe(c, { attributes: true, attributeFilter: ['style'] }); } catch (e) {}
    }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', start); }
    else { start(); }
    setTimeout(start, 900);        // late pass in case #content is swapped after load
    setTimeout(repair, 2500);
  })();
  // ---------------------------------------------------------------------------------------------

  if (!jq) return;

  function init() {
    var $ = jq;
    // Loaded once globally; all handlers are delegated on document and self-scope to
    // .tnd-list-generic at event time, so they work for any list loaded later via the SPA.

    // ---- build the drawer shell once (portalled to <body> inside a .tendi-skin scope) ----
    if (!$('#tndDrawer').length) {
      $('body').append(
        '<div class="tendi-skin tnd-drawer-portal">' +
          '<div class="tnd-pane-scrim tnd-drawer-scrim" id="tndDrawerScrim" hidden></div>' +
          '<aside class="tnd-pane tnd-drawer" id="tndDrawer" hidden aria-hidden="true" aria-label="Record editor">' +
            '<div class="tnd-pane-head">' +
              '<span class="up-head-eyebrow"><span class="up-eb-view" id="tndEbView">Record</span><span class="up-eb-edit" id="tndEbEdit">Editing</span></span>' +
              '<span class="up-head-spacer"></span>' +
              '<div class="tnd-pane-head-actions">' +
                // What is still outstanding, right next to Save. The pane head is the one part of
                // the drawer that never scrolls and is visible from every tab, so a count that
                // lives here cannot be missed the way a message at the bottom of tab 3 can.
                // Filled by the enrollment counters below; inert (and hidden) on every other entity.
                '<span class="tnd-enroll-outstanding" id="tndEnrollOutstanding" hidden></span>' +
                '<button type="button" class="btn-sm tnd-drawer-cancel" id="tndDrawerCancel" hidden>Cancel</button>' +
                '<button type="button" class="btn-sm primary tnd-drawer-edit" id="tndDrawerEdit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> Edit</button>' +
                '<button type="button" class="btn-sm primary tnd-drawer-save" id="tndDrawerSave" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Save</button>' +
                '<button type="button" class="tnd-pane-close" id="tndDrawerClose" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
              '</div>' +
            '</div>' +
            '<div class="tnd-pane-body" id="tndDrawerBody"></div>' +
          '</aside>' +
        '</div>'
      );
    }

    var obs = null, drawerDirty = false;
    function stopObs() { if (obs) { try { obs.disconnect(); } catch (e) {} obs = null; } }

    // Read-only "view tenant data" session (platform console → View data): the shell marks the
    // document with .imp-ro. The pane now loads the real edit form here (that is where the tabs
    // live), so it must never OFFER editing: the server refuses the save either way, but a live
    // Edit/Save button in a read-only view is a lie. Read once; the class is server-rendered.
    var IMP_RO = document.documentElement.classList.contains('imp-ro');

    function closeDrawer(force) {
      // dirty-guard: ONLY block a soft close (scrim / Esc) when actually EDITING with unsaved changes.
      // In view mode (or edit mode with no changes) clicking away always closes.
      if (force !== true && drawerDirty && $('#tndDrawer').hasClass('is-editing')) {
        var d = $('#tndDrawer'); d.removeClass('tnd-nudge'); void d[0].offsetWidth; d.addClass('tnd-nudge');
        return;
      }
      drawerDirty = false;
      stopObs();
      clearEnrollmentChrome();   // counters/summary/armed state belong to the record being closed
      try { $('#ui-datepicker-div').hide(); if ($.datepicker) $('.hasDatepicker').datepicker('hide'); } catch (e) {}  // dismiss any open datepicker
      $('#tndDrawer').removeClass('is-open tnd-nudge').attr('aria-hidden', 'true');
      $('#tndDrawerScrim').removeClass('is-open');
      setTimeout(function () {
        $('#tndDrawer').prop('hidden', true);
        $('#tndDrawerScrim').prop('hidden', true);
        $('#tndDrawerBody').empty();
      }, 240);
    }

    // ---- read-only VIEW (mirrors the Users detail pane): identity header + the entity's own
    // edit form rendered read-only. Emits the SAME .up-*/.tnd-pane-edit classes as the Users
    // pane so the identical CSS applies, no parallel design.
    function initials(s) {
      s = (s || '').trim();
      if (!s) return '?';
      var parts = s.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return s.replace(/[^a-z0-9]/ig, '').slice(0, 2).toUpperCase() || s.slice(0, 1).toUpperCase();
    }
    var TND_ACCENTS = ['acc-plum', 'acc-teal', 'acc-rose', 'acc-sky', 'acc-lavender', 'acc-mint', 'acc-apricot', 'acc-sun', 'acc-coral'];
    function accentFor(key) { key = key || ''; var h = 0; for (var i = 0; i < key.length; i++) h = (h + key.charCodeAt(i)) % TND_ACCENTS.length; return TND_ACCENTS[h]; }
    function isActiveWord(t) { return /^(active|enabled|approved|paid|yes|completed|open|current)$/i.test((t || '').trim()); }
    function cap(t) { t = (t || '').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; }
    function upPill(text) { var t = (text || '').trim(); if (!t) return ''; return '<span class="up-pill ' + (isActiveWord(t) ? 'is-active' : 'is-inactive') + '"><span class="dot"></span>' + cap(t) + '</span>'; }
    // A trashed record is not a quiet "inactive": it is deleted, and it is only on screen because
    // somebody asked to see deleted rows. Give it the critical tint so it reads as a state you have
    // to act on, and so it matches the red wash `.tnd-row-trashed` already puts on the row.
    function isTrashWord(t) { return /^(trash|trashed|deleted)$/i.test((t || '').trim()); }
    function listStatusPill(text) {
      var t = (text || '').trim(); if (!t) return '';
      var tone = isTrashWord(t) ? 'is-critical' : (isActiveWord(t) ? 'is-active' : 'is-inactive');
      return '<span class="tnd-status-pill ' + tone + '"><span class="dot"></span>' + cap(t) + '</span>';
    }
    // entity label from the list-page title ("Manage Classes" → "Class"); falls back to "Record"
    function entityLabel() {
      var t = ($('.tnd-list-generic .box-name span:not(.tnd-page-sub)').first().text() || $('.tnd-list-generic .box-name').first().text() || $('.tnd-list-generic .box-header').first().text() || '').replace(/\s+/g, ' ').trim();
      t = t.replace(/^manage\s+/i, '').trim();
      if (!t) return 'Record';
      if (/(s|x|ch|sh)es$/i.test(t)) t = t.replace(/es$/i, '');       // classes→class, branches→branch
      else if (/ies$/i.test(t)) t = t.replace(/ies$/i, 'y');          // facilities→facility
      else if (/s$/i.test(t) && !/ss$/i.test(t)) t = t.replace(/s$/i, '');  // employees→employee
      return t;
    }
    // Read one cell as a VALUE. A cell is not a plain string: the name column is decorated, and
    // textContent glues every decoration onto the name in one run, which is what put
    // "SRShmeil Rosenberg" and "LMLittle MeAdd note" in the record pane's header. It picks up a
    // monogram avatar's two initials, a legal-name sub-line, and the note affordance, which on
    // reskin/children-paper sits INSIDE the name cell (here it is its own column), so a child
    // with no note contributed the literal words "Add note".
    // So prefer the cell's OWN name element when it has one, and strip the decoration when it
    // does not. `.tnd-row-avatar` / `.tnd-user-*` are this file's generic decoration and were the
    // only things stripped before; the rest is what the Children controller emits, and that page
    // opts OUT of the generic pass with data-tnd-rowcells="off", which is exactly why the old
    // selector list matched nothing there. `.tnd-noteline` / `.tnd-noteflag` exist only on the
    // reskin branch and are carried here so one helper is right on both.
    // The empty-note placeholder goes too: "Add note" is a prompt, not this child's note, and a
    // real note (.tnd-noteval) is left alone so the Notes value still reads.
    function cellText($orig) {
      var $clean = $orig.clone();
      $clean.find('.tnd-row-avatar, .tnd-rowav, .tnd-user-sub, .tnd-user-id, .tnd-rowsub-src, .tnd-noteline, .tnd-noteflag, .tnd-noteadd, .tnd-note-empty').remove();
      var $nm = $clean.find('.tnd-user-name, .tnd-nm .n1').first();
      return (($nm.length ? $nm : $clean).text() || '').replace(/\s+/g, ' ').trim();
    }
    // pull the row's primary name + #id + status from its own cells
    function rowFacts(tr) {
      var $tr = $(tr), table = $tr.closest('table'), headers = [];
      table.find('thead th').each(function () { headers.push($(this).text().trim()); });
      var idVal = '', status = '', nameVal = '', firstVal = '', subVal = '', lastVal = '';
      $tr.children('td').each(function (i) {
        var $orig = $(this), label = headers[i] || '', key = label.toLowerCase();
        if ($orig.find('.tnd-rowmenu').length) return;
        if ($orig.find('input[type=checkbox]').length && !$orig.text().trim()) return;
        var text = cellText($orig);
        if (key === 'id' || key === '#') { idVal = text; return; }
        if (/status|active|enabled|state/.test(key) && !status) status = text;
        if (!nameVal && /^(name|full ?name|first ?name|title|child|student|employee)\b/.test(key) && text) nameVal = text;
        if (/^last ?name\b/.test(key) && text) lastVal = text;                              // join first+last → full name
        if (!subVal && /^(type|role|position|category)\b/.test(key) && text) subVal = text;  // a role/type → identity sub-line
        if (!firstVal && text) firstVal = text;
      });
      var full = (nameVal && lastVal && !/\s/.test(nameVal)) ? (nameVal + ' ' + lastVal) : nameVal;
      return { primary: full || firstVal || 'Record', id: idVal, status: status, sub: subVal };
    }
    // hero/idstrip facts from EITHER a DOM <tr> (list-row click) OR a plain facts object supplied by
    // a caller that already knows the identity (e.g. a Logs card carrying the child's name + id).
    function factsFrom(src) {
      if (src && src.nodeType) return rowFacts(src);
      var f = src || {};
      return { primary: f.primary || f.name || 'Record', id: (f.id != null ? String(f.id) : ''), status: f.status || '', sub: f.sub || '' };
    }
    function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    // ≥ this many sections (or a very long single form) → use a tab bar (view + edit), else stack
    var TAB_MIN = 4;
    // label keyword → stroked SVG (mirrors the Users pane's per-row icon vibe)
    function viewIconSvg(label) {
      var n = (label || '').toLowerCase();
      var P = {
        mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/>',
        phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2.1z"/>',
        map: '<path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M9 21v-5h6v5"/>',
        cal: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M5.5 20a7 7 0 0 1 13 0"/>',
        users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>',
        money: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/>',
        lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
        bus: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M3 11h18"/><path d="M7 17v2M17 17v2"/>',
        hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
        tag: '<path d="M20.6 13.4 12 22l-9-9V3h10z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
        note: '<path d="M4 4h16v12l-5 4H4z"/><path d="M8 9h8M8 13h5"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/>'
      };
      var key = 'info';
      if (/e-?mail/.test(n)) key = 'mail';
      else if (/phone|mobile|tel\b|cell|fax/.test(n)) key = 'phone';
      else if (/address|location|city|state|zip|street|neighb/.test(n)) key = 'map';
      else if (/date|dob|birth|start|end|expire|day/.test(n)) key = 'cal';
      else if (/time|hour|schedul/.test(n)) key = 'clock';
      else if (/branch|class|group|kitchen|facilit|teacher|staff|assign|capab|member/.test(n)) key = 'users';
      else if (/name|first|last|child|student|parent|mother|father|contact|person|applicant/.test(n)) key = 'user';
      else if (/price|amount|fee|tuition|payment|cost|charge|voucher|balance|bank|salary/.test(n)) key = 'money';
      else if (/password|secret|access|login|pin|token/.test(n)) key = 'lock';
      else if (/bus|route|vehicle|geotab|driver|transport/.test(n)) key = 'bus';
      else if (/(^|\b)id$|number|code\b/.test(n)) key = 'hash';
      else if (/type|role|category|status|state/.test(n)) key = 'tag';
      else if (/note|comment|remark|message|description/.test(n)) key = 'note';
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + P[key] + '</svg>';
    }
    // vB hero (view) from the row's own facts: avatar, name, role/id meta, status pill
    function buildHero(tr) {
      var f = factsFrom(tr), accent = accentFor(f.primary + f.id);
      return '<section class="vB-hero">' +
        '<span class="vB-avatar ' + accent + '" aria-hidden="true">' + escapeHtml(initials(f.primary)) + '</span>' +
        '<h2 class="vB-name">' + (escapeHtml(f.primary) || '-') + '</h2>' +
        '<div class="vB-hero-meta">' +
          (f.sub ? '<span class="vB-role">' + escapeHtml(f.sub) + '</span>' : '') +
          (f.sub && f.id ? '<span class="vB-dotsep" aria-hidden="true"></span>' : '') +
          (f.id ? '<span class="vB-idtag">#' + escapeHtml(f.id) + '</span>' : '') +
        '</div>' +
        (f.status ? '<div class="vB-status ' + (isActiveWord(f.status) ? 'is-active' : 'is-inactive') + '"><span class="dot"></span>' + escapeHtml(cap(f.status)) + '</div>' : '') +
      '</section>';
    }
    // compact identity strip for EDIT mode (mini avatar + name + sub), mirrors the Users pane .vB-idstrip
    function buildIdStrip(tr) {
      var f = factsFrom(tr), accent = accentFor(f.primary + f.id);
      var sub = f.sub || entityLabel();
      if (f.id) sub += (sub ? ' · ' : '') + '#' + f.id;
      return '<div class="vB-idstrip">' +
        '<span class="vB-avatar ' + accent + '" aria-hidden="true">' + escapeHtml(initials(f.primary)) + '</span>' +
        '<div class="vB-idstrip-main"><div class="vB-idstrip-name">' + (escapeHtml(f.primary) || '-') + '</div>' +
        '<div class="vB-idstrip-sub">' + escapeHtml(sub) + '</div></div>' +
      '</div>';
    }
    // read one legacy field group (.field / .form-group) → { label, valueHtml, empty } for a vB-row
    function fieldToView(group) {
      // page opt-out: a form-group marked data-pane-skip never becomes a view row. Used to hide the
      // interactive date-range editors (which pack start + end + radios + day checkboxes into one
      // group and don't reduce to a clean row): their values surface via read-only .pane-summary
      // mirrors instead.
      if (group.getAttribute && group.getAttribute('data-pane-skip') != null) return { skip: true };
      // a field that does not apply to this record's enrollment status is not "empty", it is absent.
      // Showing "Class: Not set" for a waiting-list child states a fact about a question nobody asked.
      if (group.getAttribute && group.getAttribute('data-enroll-level') === 'na') return { skip: true };
      var labEl = group.querySelector('.field-label') || group.querySelector('label.control-label');
      if (!labEl) {
        var labs = group.querySelectorAll('label');
        for (var k = 0; k < labs.length; k++) { if (!labs[k].querySelector('input[type=checkbox],input[type=radio]')) { labEl = labs[k]; break; } }
      }
      var label = labEl ? labEl.textContent.replace(/\*+/g, '').replace(/\s+/g, ' ').trim() : '';
      var checks = group.querySelectorAll('input[type=checkbox]');
      var radios = group.querySelectorAll('input[type=radio]');
      var selects = group.querySelectorAll('select');
      var texts = group.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]):not([type=button]):not([type=submit]):not([type=reset]), textarea');
      function lblOf(input) {
        var l = input.closest('label'); var t = l ? l.textContent.replace(/\s+/g, ' ').trim() : '';
        if (t) return t;
        if (input.id) { var fl = group.querySelector('label[for="' + input.id + '"]'); if (fl) return fl.textContent.trim(); }
        return (input.value || '').trim();
      }
      // single boolean checkbox → Yes/No pill (its own label names the row)
      if (checks.length === 1 && radios.length === 0 && texts.length === 0 && selects.length === 0) {
        return { label: label || lblOf(checks[0]) || 'Enabled', valueHtml: upPill(checks[0].checked ? 'Yes' : 'No'), empty: false };
      }
      // MULTI-value (checkbox group / multi-select) → render the selected values as chips, not a CSV
      var multiSel = []; Array.prototype.forEach.call(selects, function (s) { if (s.multiple) multiSel.push(s); });
      if (checks.length > 1 || multiSel.length) {
        var chips = [];
        if (multiSel.length) { multiSel.forEach(function (s) { Array.prototype.forEach.call(s.selectedOptions || [], function (o) { var t = (o.textContent || '').trim(); if (t && String(o.value) !== '') chips.push(t); }); }); }
        else { Array.prototype.forEach.call(checks, function (c) { if (c.checked) { var t = lblOf(c); if (t) chips.push(t); } }); }
        return { label: label, chips: chips, empty: chips.length === 0 };
      }
      var val = '', link = '';
      if (selects.length) {
        var parts = [];
        Array.prototype.forEach.call(selects, function (s) { Array.prototype.forEach.call(s.selectedOptions || [], function (o) { var t = (o.textContent || '').trim(); if (t && String(o.value) !== '') parts.push(t); }); });
        val = parts.join(', ');
      } else if (checks.length) {
        var on = []; Array.prototype.forEach.call(checks, function (c) { if (c.checked) { var t = lblOf(c); if (t) on.push(t); } }); val = on.join(', ');
      } else if (radios.length) {
        var r = group.querySelector('input[type=radio]:checked'); val = r ? lblOf(r) : '';
      } else if (texts.length) {
        var t0 = texts[0];
        if (t0.type === 'password') { val = t0.value ? '••••••••' : ''; }
        else if (t0.type === 'color') { var cv = (t0.getAttribute('value') || '').trim(); return { label: label, valueHtml: cv ? ('<span class="vB-swatch" style="background:' + escapeHtml(cv) + '"></span>' + escapeHtml(cv)) : 'Not set', empty: !cv }; }
        else val = (t0.value || '').trim();
        // actionable email / phone → the view row becomes a mailto:/tel: link (matches the Users pane)
        if (val) {
          var lab = (label || '').toLowerCase();
          if (t0.type === 'email' || (/e-?mail/.test(lab) && /@/.test(val))) link = 'mailto:' + val;
          else if (t0.type === 'tel' || (/phone|mobile|tel\b|cell|fax/.test(lab) && /\d/.test(val))) link = 'tel:' + val.replace(/[^\d+]/g, '');
        }
      } else { return { skip: true }; }
      var empty = !String(val).trim();
      return { label: label, valueHtml: empty ? 'Not set' : escapeHtml(val), empty: empty, link: link };
    }
    // rich vB view from the structured form sections (hero + grouped rows; tab bar when heavy)
    function buildVbView(sections, tr) {
      var tabbed = sections.length >= TAB_MIN;
      var bar = tabbed ? ('<div class="tnd-tabs" role="tablist">' + sections.map(function (s, i) { var nm = s.name || ('Section ' + (i + 1)); return '<button type="button" class="tnd-tab' + (i === 0 ? ' is-active' : '') + '" data-tab="' + i + '" data-tab-name="' + escapeHtml(nm) + '">' + escapeHtml(nm) + '</button>'; }).join('') + '</div>') : '';
      var groups = sections.map(function (s, i) {
        var rows = (s.fields || []).map(function (fd) {
          var v = fieldToView(fd.el);
          if (v.skip) return '';
          var valueHtml, chipRow = false;
          if (v.chips) {
            chipRow = !v.empty;
            valueHtml = v.empty ? 'Not set' : ('<span class="vB-chips">' + v.chips.map(function (c) { return '<span class="vB-chip">' + escapeHtml(c) + '</span>'; }).join('') + '</span>');
          } else { valueHtml = v.valueHtml; }
          var cls = 'vB-row' + (v.empty ? ' is-empty' : '') + (chipRow ? ' vB-row--chips' : '');
          var body = '<span class="vB-row-ico" aria-hidden="true">' + viewIconSvg(v.label) + '</span>' +
            '<span class="vB-row-body"><span class="vB-row-label">' + (escapeHtml(v.label) || '&nbsp;') + '</span>' +
            '<span class="vB-row-value' + (v.empty ? ' vB-muted' : '') + '">' + valueHtml + '</span></span>';
          if (v.link && !v.empty) {
            return '<a class="' + cls + ' vB-row--action" href="' + escapeHtml(v.link) + '">' + body +
              '<span class="vB-row-cta" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg></span></a>';
          }
          return '<div class="' + cls + '">' + body + '</div>';
        }).join('');
        if (!rows) rows = '<div class="vB-row is-empty"><span class="vB-row-ico" aria-hidden="true">' + viewIconSvg('') + '</span><span class="vB-row-body"><span class="vB-row-value vB-muted">No details</span></span></div>';
        return '<section class="vB-group" data-panel="' + i + '"' + (tabbed && i > 0 ? ' hidden' : '') + '><h3 class="vB-group-label">' + escapeHtml(s.name || ('Section ' + (i + 1))) + '</h3><div class="vB-list">' + rows + '</div></section>';
      }).join('');
      return '<div class="tnd-pane-view">' + buildHero(tr) + bar + groups + '</div>';
    }
    // column-only fallback (entity has no /edit form): hero + one vB-group from the row's own cells
    function buildView(tr) {
      var $tr = $(tr), table = $tr.closest('table'), headers = [];
      table.find('thead th').each(function () { headers.push($(this).text().trim()); });
      var rows = [];
      $tr.children('td').each(function (i) {
        var $orig = $(this), label = headers[i] || '', key = label.toLowerCase();
        if ($orig.find('.tnd-rowmenu').length) return;
        if ($orig.find('input[type=checkbox]').length && !$orig.text().trim()) return;
        if (key === 'id' || key === '#') return;
        var text = cellText($orig), empty = !text;
        var val = empty ? 'Not set' : (/status|active|enabled|state/.test(key) ? upPill(text) : escapeHtml(text));
        rows.push('<div class="vB-row' + (empty ? ' is-empty' : '') + '"><span class="vB-row-ico" aria-hidden="true">' + viewIconSvg(label) + '</span><span class="vB-row-body"><span class="vB-row-label">' + (escapeHtml(label) || '&nbsp;') + '</span><span class="vB-row-value' + (empty ? ' vB-muted' : '') + '">' + val + '</span></span></div>');
      });
      return '<div class="tnd-pane-view">' + buildHero(tr) + '<section class="vB-group"><h3 class="vB-group-label">' + escapeHtml(entityLabel()) + ' details</h3><div class="vB-list">' + rows.join('') + '</div></section></div>';
    }

    // structure the entity's form to MATCH the Users pane edit: wrap each concern into a
    // .vB-group ( .vB-group-label + .vB-editcard ); stack them (like Users) OR, when the record is
    // data-heavy (≥ TAB_MIN sections), add a .tnd-tabs bar and make each group a switchable panel.
    // Groups come from the form's own h3/h4/h5/legend headers. Returns the section model so the
    // read-only vB view can mirror it field-for-field.
    function structureForm() {
      var bodyEl = document.getElementById('tndDrawerBody');
      var form = bodyEl && bodyEl.querySelector('form');
      if (!form) return null;
      if (form.__tndSections) return form.__tndSections;                          // already structured
      form.classList.add('tnd-pane-edit');
      var fhEl = form.querySelector('.form-horizontal') || form;
      function headingText(b) {
        if (b.matches && b.matches('h3,h4,h5,legend')) return b.textContent.trim();
        var h = b.querySelector && b.querySelector('h3,h4,h5,legend');
        return h ? h.textContent.trim() : null;
      }
      // flatten nested .row / <fieldset> wrappers to a flat leaf list FIRST, then section by headings,
      // so an <h4>/<legend> ANYWHERE (even inside a fieldset, like the employee form) starts a card.
      var leaves = [];
      (function collect(parent) {
        Array.prototype.slice.call(parent.children).forEach(function (b) {
          if (b.classList && (b.classList.contains('row') || b.tagName === 'FIELDSET')) collect(b);
          else leaves.push(b);
        });
      })(fhEl);
      var sections = [], cur = null;
      leaves.forEach(function (b) {
        var ht = headingText(b);
        if (ht) { cur = { name: ht, blocks: [] }; sections.push(cur); if (!(b.matches && b.matches('h3,h4,h5,legend'))) cur.blocks.push(b); }
        else { if (!cur) { cur = { name: 'Details', blocks: [] }; sections.push(cur); } cur.blocks.push(b); }
      });
      // merge field-less sections into a neighbour (e.g. a pre-heading "Details" of only hidden inputs)
      function hasFields(s) { return s.blocks.some(function (b) { return b.querySelector && b.querySelector('input:not([type=hidden]), select, textarea'); }); }
      var kept = [], pending = [];
      sections.forEach(function (s) {
        if (hasFields(s)) kept.push(s);
        else if (kept.length) kept[kept.length - 1].blocks = kept[kept.length - 1].blocks.concat(s.blocks);
        else pending = pending.concat(s.blocks);
      });
      if (pending.length && kept.length) kept[0].blocks = pending.concat(kept[0].blocks);
      sections = kept;
      if (!sections.length) sections = [{ name: entityLabel() + ' details', blocks: Array.prototype.slice.call(fhEl.children) }];
      else if (sections.length === 1 && (!sections[0].name || sections[0].name === 'Details')) sections[0].name = entityLabel() + ' details';
      // unwrap structural containers (.row, <fieldset>) so the real field units (.form-group/.field)
      // become DIRECT children of the card. Recurse for nesting; drop stray text nodes.
      function addBlock(target, b) {
        if (b.classList && (b.classList.contains('row') || b.tagName === 'FIELDSET')) {
          while (b.firstChild) { var c = b.firstChild; if (c.nodeType === 1) addBlock(target, c); else b.removeChild(c); }
          if (b.parentNode) b.parentNode.removeChild(b);
        } else target.appendChild(b);
      }
      var tabbed = sections.length >= TAB_MIN;
      var bar = null;
      if (tabbed) { bar = document.createElement('div'); bar.className = 'tnd-tabs'; bar.setAttribute('role', 'tablist'); }
      var out = [];
      sections.forEach(function (s, i) {
        var name = s.name || ('Section ' + (i + 1));
        var grp = document.createElement('section'); grp.className = 'vB-group'; grp.setAttribute('data-panel', i); if (tabbed && i > 0) grp.hidden = true;
        var lab = document.createElement('h3'); lab.className = 'vB-group-label'; lab.textContent = name; grp.appendChild(lab);
        var card = document.createElement('div'); card.className = 'vB-editcard';
        s.blocks.forEach(function (b) { if (b.matches && b.matches('h3,h4,h5,legend')) { if (b.parentNode) b.parentNode.removeChild(b); return; } addBlock(card, b); });
        var dup = card.querySelector('h3,h4,h5,legend'); if (dup && dup.textContent.trim() === name) dup.parentNode.removeChild(dup);
        grp.appendChild(card);
        fhEl.appendChild(grp);
        // collect the leaf field-groups (for the view mirror)
        var fields = [];
        Array.prototype.slice.call(card.children).forEach(function (c) {
          if (c.nodeType !== 1) return;
          if (c.classList && (c.classList.contains('field') || c.classList.contains('form-group'))) fields.push({ el: c });
          else if (c.querySelector && c.querySelector('input:not([type=hidden]),select,textarea')) fields.push({ el: c });
        });
        // data-tab-name keeps the section's NAME separate from the button's text, because the
        // enrollment counters append number badges into the same button: reading the name back off
        // textContent would then hand you "Details21".
        if (tabbed) { var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'tnd-tab' + (i === 0 ? ' is-active' : ''); btn.setAttribute('data-tab', i); btn.setAttribute('data-tab-name', name); btn.textContent = name; bar.appendChild(btn); }
        out.push({ name: name, fields: fields, groupEl: grp });
      });
      // drop leftover empty .row/<fieldset> wrappers, keeping any hidden inputs they held (still submit)
      Array.prototype.slice.call(fhEl.children).forEach(function (c) {
        if (c.classList && c.classList.contains('vB-group')) return;
        if (c.nodeType === 1 && (!c.querySelector || !c.querySelector('input:not([type=hidden]),select,textarea'))) {
          if (c.querySelectorAll) Array.prototype.slice.call(c.querySelectorAll('input[type=hidden]')).forEach(function (hid) { form.appendChild(hid); });
          if (c.parentNode) c.parentNode.removeChild(c);
        }
      });
      if (bar) fhEl.insertBefore(bar, fhEl.firstChild);
      form.__tndSections = out;
      return out;
    }

    // re-run the structuring + view build (used when a form injected its fields late; see watchLateForm)
    function reflowDrawer(formEl, tr) {
      if (!formEl || !document.body.contains(formEl)) return;
      var fh = formEl.querySelector('.form-horizontal') || formEl;
      // move any fields back out of their (stale) cards, then drop the empty vB-* wrappers
      Array.prototype.slice.call(formEl.querySelectorAll('.vB-group')).forEach(function (g) {
        var card = g.querySelector('.vB-editcard');
        if (card) while (card.firstChild) fh.appendChild(card.firstChild);
        if (g.parentNode) g.parentNode.removeChild(g);
      });
      Array.prototype.slice.call(formEl.querySelectorAll('.tnd-tabs')).forEach(function (b) { if (b.parentNode) b.parentNode.removeChild(b); });
      $(formEl).children('.vB-idstrip').remove();
      $('#tndDrawerBody .tnd-pane-view').remove();
      formEl.__tndSections = null;
      var sections = structureForm();
      if (sections && tr) $(formEl).before(buildVbView(sections, tr));
      if (tr && !$(formEl).children('.vB-idstrip').length) $(formEl).prepend(buildIdStrip(tr));
      enhanceToggles(formEl);
      refreshEnrollment();      // the panels were just rebuilt, so every field moved tab index
    }
    // some entity forms inject their fields via a deferred jQuery.ready() AFTER load (e.g. complaints),
    // so structureForm ran on an empty form and the cards came out empty. Watch briefly; when fields
    // appear OUTSIDE the cards, re-structure once so the view + edit cards fill in correctly.
    function watchLateForm(formEl, tr) {
      var tries = 0;
      (function check() {
        if (!document.body.contains(formEl)) return;
        tries++;
        var loose = formEl.querySelectorAll('.form-group, .field').length;
        var inCard = formEl.querySelectorAll('.vB-editcard .form-group, .vB-editcard .field').length;
        if (loose > 0 && loose > inCard && !formEl.__tndReflowed) { formEl.__tndReflowed = true; reflowDrawer(formEl, tr); inCard = formEl.querySelectorAll('.vB-editcard .form-group, .vB-editcard .field').length; }
        if (inCard === 0 && loose === 0 && tries < 10) { setTimeout(check, 250); return; }   // form still empty → keep waiting
        // safety net: if the form-derived view has no real rows (a form we couldn't structure, e.g. one
        // that rebuilds itself with JS), fall back to the row-column view so VIEW still shows the data.
        var view = document.querySelector('#tndDrawerBody .tnd-pane-view');
        if (view && tr && tr.nodeType && !view.querySelector('.vB-row:not(.is-empty)')) $(view).replaceWith(buildView(tr));
      })();
    }

    function showPane() {
      $('#tndDrawer').prop('hidden', false).attr('aria-hidden', 'false');
      $('#tndDrawerScrim').prop('hidden', false);
      window.requestAnimationFrame(function () { $('#tndDrawer').addClass('is-open'); $('#tndDrawerScrim').addClass('is-open'); });
    }
    // read-only beautify: empty text → "-" placeholder; AND mark value-less fields .tnd-ro-empty so the
    // CSS shows a muted "-" instead of a floating label (covers hidden color/file/select fields too).
    function readonlyDashes(on) {
      var body = document.getElementById('tndDrawerBody'); if (!body) return;
      $(body).find('.tnd-pane-edit input:not([type=checkbox]):not([type=file]):not([type=hidden]):not([type=radio]):not([type=color]), .tnd-pane-edit textarea').each(function () {
        if (on) { if (this.getAttribute('data-ph') === null) this.setAttribute('data-ph', this.getAttribute('placeholder') || ''); this.placeholder = '-'; }
        else if (this.getAttribute('data-ph') !== null) this.placeholder = this.getAttribute('data-ph');
      });
      // multi/size selects (e.g. employee Type, Groups) render as a tall listbox, in read-only
      // show the selected option labels as plain text instead, and hide the listbox.
      $(body).find('.tnd-pane-edit select').each(function () {
        var sel = this; if (!(sel.multiple || sel.size > 1)) return;
        var txt = sel.parentNode.querySelector('.tnd-ro-multi');
        if (on) {
          var labels = Array.prototype.filter.call(sel.options, function (o) { return o.selected; })
            .map(function (o) { return (o.textContent || '').trim(); }).filter(Boolean);
          if (labels.length) {
            if (!txt) { txt = document.createElement('div'); txt.className = 'tnd-ro-multi'; sel.parentNode.insertBefore(txt, sel.nextSibling); }
            txt.textContent = labels.join(', '); txt.hidden = false;
          } else if (txt) { txt.hidden = true; }
          sel.classList.add('tnd-ro-hide');
        } else {
          if (txt) txt.hidden = true;
          sel.classList.remove('tnd-ro-hide');
        }
      });
      $(body).find('.tnd-pane-edit .field, .tnd-pane-edit .form-group').each(function () {
        this.classList.remove('tnd-ro-empty', 'tnd-ro-yes', 'tnd-ro-no');
        if (!on) return;
        // skip groups that hold no real control (e.g. the Save/Cancel button row). They must NOT get a "-"
        if (!this.querySelector('input:not([type=hidden]), select, textarea')) return;
        var checks = this.querySelectorAll('input[type=checkbox]');
        var others = this.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea, select');
        // a single boolean checkbox (not a multi-select group) → render a clean "Yes" / "No"
        if (checks.length === 1 && others.length === 0 && !this.querySelector('.tnd-checklist, .tnd-classes-wrap')) {
          this.classList.add(checks[0].checked ? 'tnd-ro-yes' : 'tnd-ro-no'); return;
        }
        // otherwise mark value-less fields → CSS shows a muted "-"
        var hasVal = false;
        this.querySelectorAll('input, textarea, select').forEach(function (c) {
          if (c.type === 'checkbox' || c.type === 'radio') { if (c.checked) hasVal = true; }
          else if (c.type === 'color') { if ((c.getAttribute('value') || '').trim() !== '') hasVal = true; }  // color coerces to #000000; use the attr
          else if (c.tagName === 'SELECT' && (c.multiple || c.size > 1)) { if (c.selectedOptions && c.selectedOptions.length) hasVal = true; }  // multi-select: count selections, not .value
          else if (String(c.value || '').trim() !== '') hasVal = true;
        });
        this.classList.toggle('tnd-ro-empty', !hasVal);
      });
    }
    // view ↔ edit: same .is-editing/.is-readonly mechanism + button hiding as the Users pane
    function setMode(mode) {
      var editing = (mode === 'edit') && !IMP_RO;   // a read-only view can never enter edit mode
      $('#tndDrawer').toggleClass('is-editing', editing).toggleClass('is-readonly', !editing);
      readonlyDashes(!editing);
      $('#tndDrawerEdit').prop('hidden', editing || IMP_RO);
      $('#tndDrawerSave').prop('hidden', !editing);
      $('#tndDrawerCancel').prop('hidden', !editing);
    }
    // shared loader: GET the entity's add/edit page + inject it (its <script> re-runs:
    // validate / Google-Maps / TinyMCE / submit). isView → prepend the .up-identity header + start
    // read-only so EVERY field shows; Edit flips the SAME form to editable (no re-fetch).
    function loadFormInto(url, isView, tr) {
      $('#tndDrawerBody').removeClass('is-ready').html('<div class="tnd-drawer-loading"><span class="tnd-spin"></span></div>');
      $.ajax({
        url: url, type: 'GET', dataType: 'html',
        success: function (html) {
          var body = $('#tndDrawerBody');
          clearEnrollmentChrome();                            // never inherit the previous record's counts / armed state
          body.html(html).addClass('is-ready');
          body.find('.box-header, .breadcrumbs').remove();   // drop legacy window chrome (we have our own head)
          enhanceSelects(body[0]);                            // native <select> → custom .tnd-select dropdown
          enhanceMultiSelects(body[0]);                       // native <select multiple> → violet chip/tag picker
          enhanceVaccineSelectAll(body[0]);                   // checkbox-chip group → same front-end Select all toggle
          var sections = structureForm();                     // .tnd-pane-edit → .vB-group / .vB-editcard (+ tabs)
          var formEl = body.find('form')[0];
          // build the rich vB read-only VIEW (hero + grouped rows) mirroring the Users pane, then
          // normalise the body to [view, form] so the .is-readonly swap hides ALL legacy edit chrome.
          body.find('.tnd-pane-view').remove();
          if (formEl) {
            if (formEl.parentNode !== body[0]) body[0].appendChild(formEl);   // pull form out of any .box chrome
            var viewHtml = (sections && tr) ? buildVbView(sections, tr) : (tr && tr.nodeType ? buildView(tr) : '');
            if (viewHtml) $(formEl).before(viewHtml);                          // .tnd-pane-view sits before the form
            if (tr && !$(formEl).children('.vB-idstrip').length) $(formEl).prepend(buildIdStrip(tr));  // compact identity at the top of EDIT (matches Users)
            Array.prototype.slice.call(body[0].children).forEach(function (ch) {
              if (ch === formEl || (ch.classList && ch.classList.contains('tnd-pane-view')) || ch.tagName === 'SCRIPT') return;
              ch.style.display = 'none';                       // empty legacy chrome → out of the way
            });
            enhanceToggles(formEl);                            // single-boolean checkboxes → .vB-toggle switches
            if (tr) watchLateForm(formEl, tr);                 // re-structure if the form injects fields late (e.g. complaints)
          } else if (tr && tr.nodeType) {
            body.html(buildView(tr));                          // no edit form → column-only view
          }
          setMode(isView ? 'view' : 'edit');
          if (!formEl) $('#tndDrawerEdit').prop('hidden', true);
          drawerDirty = false;
          body.off('input.tndDirty change.tndDirty').on('input.tndDirty change.tndDirty', function () { if ($('#tndDrawer').hasClass('is-editing')) drawerDirty = true; });   // only a real edit (in edit mode) counts as dirty
          // fallback close: if a save still replaces #ajax-content (a table we can't refresh in place)
          var ajaxContent = document.getElementById('ajax-content');
          stopObs();
          if (ajaxContent && window.MutationObserver) {
            obs = new MutationObserver(function () { closeDrawer(true); });
            obs.observe(ajaxContent, { childList: true });
          }
          if (!isView && formEl) {
            var first = $(formEl).find('input:not([type=hidden]):not([type=file]), select, textarea').filter(':visible').first();
            if (first.length) { try { first.trigger('focus'); } catch (e) {} }
          }
          // the enrollment counters, once the panels exist and the form's own inline script has
          // published its engine. The late pass covers a form that fills in asynchronously
          // (watchLateForm re-structures it, which renumbers the panels).
          refreshEnrollment();
          setTimeout(refreshEnrollment, 400);
        },
        error: function () {
          if (isView) { $('#tndDrawerBody').addClass('is-ready').html(tr && tr.nodeType ? buildView(tr) : '<div class="tnd-drawer-error">Could not load this record.</div>'); setMode('view'); $('#tndDrawerEdit').prop('hidden', true); }
          else { closeDrawer(true); if (window.LoadAjaxContent) window.LoadAjaxContent(url); }   // fall back to legacy navigation
        }
      });
    }

    function setEyebrow(label, editText) { $('#tndEbView').text(label + ' profile'); $('#tndEbEdit').text(editText || ('Editing ' + label.toLowerCase())); }

    // whole-row click → read-only VIEW of the FULL record (the edit form rendered read-only) so
    // EVERY setting is visible; Edit flips the same form to editable.
    function openView(tr) {
      var editLink = $(tr).find('a[href*="/edit/"]').first();
      // A row whose actions are a ⋮ kebab has no edit ANCHOR to read the record url from, so it also
      // accepts `data-edit_url` on any element in the row (Children emits it on the kebab). Without
      // this the pane fell through to the column-dump branch below: no form, so no tabs and no Edit.
      var href = editLink.length
        ? editLink.attr('href')
        : ($(tr).find('[data-edit_url]').first().attr('data-edit_url') || '');
      $('#tndDrawer').data('viewTr', tr).data('editHref', href);
      setEyebrow(entityLabel());
      stopObs(); drawerDirty = false;
      showPane();
      if (href) loadFormInto(href, true, tr);
      else { $('#tndDrawerBody').addClass('is-ready').html(buildView(tr)); setMode('view'); $('#tndDrawerEdit').prop('hidden', true); }   // no edit form → column view
    }

    function openDrawer(url, title) {
      if (!url) return;
      var lbl = entityLabel();
      $('#tndDrawer').data('viewTr', null);   // straight to edit (no view to return to)
      setEyebrow(lbl, /add/i.test(title || '') ? 'New ' + lbl.toLowerCase() : 'Editing ' + lbl.toLowerCase());
      showPane();
      // setMode('edit') happens in the loader. Under a read-only view every entry point (row Edit
      // action, Add) opens the SAME form read-only instead, so there is no route into edit mode.
      loadFormInto(url, IMP_RO, null);
    }
    // open a specific record's read-only VIEW pane (hero + details) WITHOUT its list row: the caller
    // supplies the identity facts (name/id/sub). The Logs timeline uses this: a log click opens the
    // child's record WITH a proper header, then Edit flips the same form editable.
    function openRecord(url, facts) {
      if (!url) return;
      $('#tndDrawer').data('viewTr', null);
      setEyebrow((facts && facts.sub) || entityLabel());
      stopObs(); drawerDirty = false;
      showPane();
      loadFormInto(url, true, facts || {});   // isView → read-only first; facts drive the hero + idstrip
    }
    // expose for inline callers / debugging
    window.TndListDrawer = { open: openDrawer, openRecord: openRecord, close: closeDrawer };

    // ---- in-place save (matches Users): when the drawer is open and the legacy form's success
    // handler calls LoadAjaxContent(list), refresh ONLY the table rows (draw(false)) and close the
    // drawer, no full-fragment reload / scroll-jump / flash. Wrapped once; transparent when no
    // drawer is open or the table can't be refreshed in place (then the original reload runs).
    if (!window.__tndLacWrapped && typeof window.LoadAjaxContent === 'function') {
      window.__tndLacWrapped = true;
      var __origLac = window.LoadAjaxContent;
      window.LoadAjaxContent = function () {
        try {
          if (!$('#tndDrawer').prop('hidden') && $('#tndDrawer').hasClass('is-open') &&
              $.fn.dataTable && $.fn.dataTable.isDataTable('#datatable-1')) {
            drawerDirty = false;
            var dt = $('#datatable-1').DataTable();
            if (dt.clearPipeline) dt.clearPipeline();
            dt.draw(false);                 // re-fetch current page in place (serverSide) → shows the edit/new row
            if (window.tndToast) tndToast.success('Saved.');
            closeDrawer(true);
            return;
          }
        } catch (e) {}
        return __origLac.apply(this, arguments);
      };
    }

    // ---- wire handlers (namespaced + re-bound each fragment load) ----
    $(document).off('click.tndList');
    $(document).off('keydown.tndList');

    // Add button + any row Edit link inside a generic list → open in the drawer.
    // Capture phase so we beat the global ajax-page-link handler; scoped to the list.
    function isEditish(a) {
      var href = a.getAttribute('href') || '';
      // `?` counts as a terminator, not just `/` or end-of-string: Children's "Add to waiting list"
      // is `children/add?waitlist=1`, and without this it fell through to the legacy full-fragment
      // navigation, i.e. the one Add button on the page that did NOT open the side pane (so no tabs
      // and none of the enrollment counters). The query string travels with the drawer's GET.
      return /\/(add|edit)(\/|\?|$)/.test(href);
    }
    document.removeEventListener('click', window.__tndListCap || function(){}, true);
    window.__tndListCap = function (e) {
      var a = e.target.closest && e.target.closest('a.ajax-page-link, a.tnd-btn-add, a.tnd-edit-row');
      if (!a) return;
      if (!a.closest('.tendi-skin.tnd-list-generic')) return;   // only the list page's own add/edit links
      if (!isEditish(a)) return;
      e.preventDefault(); e.stopPropagation();
      var isAdd = /\/add(\/|$)/.test(a.getAttribute('href') || '');
      openDrawer(a.getAttribute('href'), isAdd ? 'Add' : 'Edit');
    };
    document.addEventListener('click', window.__tndListCap, true);

    // a click that ends inline note-editing (clicking out of the textarea) must NOT also open the row
    // pane: record when such a click-away begins so the row handler below ignores that one click.
    var tndNoteBlurAt = 0;
    document.addEventListener('mousedown', function (e) {
      var editing = document.querySelector('.tnd-list-generic .tnd-note-edit');
      if (editing && !editing.contains(e.target)) tndNoteBlurAt = Date.now();
    }, true);

    // whole-row click → open the read-only VIEW pane (matches Users: view first, then Edit)
    $(document).on('click.tndList', '.tnd-list-generic table.tnd-list-table tbody tr', function (e) {
      if ($(this).closest('.tnd-no-rowpane').length) return;   // page opted out (e.g. read-only Logs) → no side-pane
      if (Date.now() - tndNoteBlurAt < 600) return;     // this click just closed an inline note → save only, no pane
      // `.tnd-noteflag` is the note affordance a page can render inside its identity cell (Children
      // puts one next to the name). It opens the note editor, so it must not ALSO open the row pane.
      if ($(e.target).closest('a, button, input, label, .tnd-rowmenu, select, textarea, .child_note, .tnd-note, .tnd-noteflag, .tnd-inline-cell').length) return;
      openView(this);
    });

    // ---- inline-editable Notes cell (.child_note). Edit IN PLACE, save via <defaultUrl>/update_description.
    // A capture-phase listener intercepts the click so the legacy "edit note" modal AND the row→pane open
    // are both suppressed; we render a textarea in the cell instead. ----
    function tndRenderNote(note, val) {
      note.innerHTML = '';
      if (val && val.trim()) { note.classList.remove('is-empty'); note.textContent = val; }
      else { note.classList.add('is-empty'); note.textContent = 'Add note'; }
    }
    function tndEditNote(note) {
      if (note.querySelector('textarea')) return;
      var listEl = note.closest('.tnd-list-generic');
      var table = listEl && listEl.querySelector('table.tnd-list-table');
      var base = table ? $(table).data('default_url') : '';
      if (!base) return;
      var id = note.getAttribute('data-id');
      var cur = note.textContent.trim(); if (/^(click to update|add note)$/i.test(cur)) cur = '';
      var prev = note.innerHTML, wasEmpty = note.classList.contains('is-empty');
      var ta = document.createElement('textarea'); ta.className = 'tnd-note-edit'; ta.value = cur;
      note.classList.remove('is-empty'); note.innerHTML = ''; note.appendChild(ta);
      ta.focus(); try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {}
      var done = false;
      function finish(save) {
        if (done) return; done = true;
        if (!save) { note.innerHTML = prev; if (wasEmpty) note.classList.add('is-empty'); return; }
        var val = ta.value.trim();
        note.innerHTML = '<span class="tnd-note-saving">Saving…</span>';
        $.ajax({
          url: base + '/update_description', method: 'POST', dataType: 'json', data: { recordId: id, description: val },
          success: function (r) {
            if (r && r.success) { tndRenderNote(note, val); if (window.tndToast) tndToast.success((r && r.message) || 'Note saved.'); }
            else { note.innerHTML = prev; if (wasEmpty) note.classList.add('is-empty'); if (window.tndToast) tndToast.error((r && r.message) || 'Could not save the note.'); }
          },
          error: function () { note.innerHTML = prev; if (wasEmpty) note.classList.add('is-empty'); if (window.tndToast) tndToast.error('Could not save the note.'); }
        });
      }
      ta.addEventListener('blur', function () { finish(true); });
      ta.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
        else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); ta.blur(); }
      });
    }
    $(document).on('click.tndList', '.tnd-list-generic .tnd-note', function (e) {
      if (this.querySelector('textarea')) return;                 // already editing → let the textarea work
      e.stopPropagation();
      tndEditNote(this);
    });
    // take over each Notes cell: DROP the legacy .child_note class (so its modal handler can no longer
    // match it) and mark it .tnd-note for our own inline editor; normalise "Click to update" → "Add note".
    function enhanceNoteCells() {
      $('.tnd-list-generic .child_note').each(function () {
        // OPT-OUT: a page that renders its own note affordance marks its root
        // data-tnd-rowcells="off". Without this the branch below would replace that markup (an icon,
        // say) with the literal text "Add note".
        if (this.closest('[data-tnd-rowcells="off"]')) return;
        this.classList.remove('child_note'); this.classList.add('tnd-note');
        var t = this.textContent.trim();
        if (/^click to update$/i.test(t) || t === '') { this.classList.add('is-empty'); this.textContent = 'Add note'; }
      });
    }

    // X = force close; scrim/Esc = soft close (dirty-guarded)
    $(document).on('click.tndList', '#tndDrawerClose', function () { closeDrawer(true); });
    $(document).on('click.tndList', '#tndDrawerScrim', function () { closeDrawer(false); });
    // Cancel discards edits and CLOSES the drawer (not back to view), matches Save closing it.
    $(document).on('click.tndList', '#tndDrawerCancel', function () { closeDrawer(true); });
    // view → edit: flip the SAME already-loaded form to editable (no re-fetch). Reset dirty so just
    // opening the editor (no field changes yet) doesn't trip the click-away guard.
    $(document).on('click.tndList', '#tndDrawerEdit', function () { drawerDirty = false; setMode('edit'); });
    // tab switching: data-heavy records get a .tnd-tabs bar in BOTH the view and the edit trees;
    // activating a panel index does it across both (.vB-group[data-panel]) so view & edit stay in
    // sync, and both tab bars highlight together. Factored out of the click handler because a
    // failed save also has to switch tabs (see reportEnrollmentInvalid).
    function activatePanel(i) {
      i = String(i);
      var d = $('#tndDrawer');
      if (!d.find('.tnd-tab[data-tab="' + i + '"]').length) return;
      d.find('.tnd-tab').each(function () { $(this).toggleClass('is-active', String($(this).attr('data-tab')) === i); });
      d.find('.vB-group[data-panel]').each(function () { this.hidden = (String(this.getAttribute('data-panel')) !== i); });
    }
    $(document).on('click.tndList', '#tndDrawer .tnd-tab', function () { activatePanel($(this).attr('data-tab')); });

    /* ============================================================================================
       ENROLLMENT: WHAT IS STILL WAITING ON THE OTHER TABS  (card "Tendi resell" #91 · §7B)
       --------------------------------------------------------------------------------------------
       A tabbed editor hides most of the record most of the time, and until now it hid the WORK too:
       a required field two tabs over produced no marker, no count and (because jQuery Validate's
       default `ignore: ":hidden"` skipped it) no error either. You could save a child with blank
       required fields and never learn it.

       The form itself owns WHAT is required (views/admin/children.php reads the one matrix in
       helpers/enrollment_helper.php and publishes `window.tndEnrollment`). This file owns only how
       that reads in the pane:
         · a per-tab count of REQUIRED fields still empty, which turns solid once a save was tried,
         · a per-tab count of OPTIONAL fields still empty, muted, so "there is more in here" is
           visible without being a demand,
         · a one-line summary under the pane head naming the tabs that are holding the save up, each
           one clickable,
         · a chip beside Save in the fixed head, so the total is on screen from every tab.

       Entirely inert for every other entity: without `window.tndEnrollment` pointing at the form
       currently in the drawer, nothing is rendered and nothing is measured.
       ============================================================================================ */
    var TND_ENROLL_ICO_ALERT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5"/><path d="M12 16.4h.01"/></svg>';
    var TND_ENROLL_ICO_OK    = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

    // the child form's engine, but ONLY when it belongs to the form currently in the drawer. It is a
    // window global that outlives the form that published it, so a stale one would otherwise paint
    // a previous child's counts onto whatever record is open now.
    function enrollmentEngine() {
      var eng = window.tndEnrollment;
      if (!eng || !eng.form || !eng.audit) return null;
      // A form that brought its OWN surface is not in the drawer and must not be judged by it (the
      // Settings page is one). Still checked for being on the page at all, which is what stops a
      // stale global painting onto whatever loaded after it.
      if (eng.surface) return document.body.contains(eng.form) ? eng : null;
      var body = document.getElementById('tndDrawerBody');
      if (!body || !body.contains(eng.form)) return null;
      return eng;
    }

    /* WHERE THE CHROME IS PAINTED, as a small object rather than selectors baked into the renderer.

       Everything below used to address the drawer directly, so the counts, the summary and the chip
       could only ever appear on a record in the side pane. They are not a drawer feature though,
       they are a "this form is tabbed and the save was refused" feature, and the app has tabbed
       forms that are not records: Settings is eleven Bootstrap tabs over one form.

       A surface answers where the tabs are, how a field maps to one, and where the chip and the
       summary hang. The drawer's answers are below and are exactly what the code did before, so the
       child form goes through the same renderer it always did and cannot drift from it. */
    var TND_DRAWER_SURFACE = {
      scope:      function () { return document.getElementById('tndDrawer'); },
      tabs:       function () { return document.querySelectorAll('#tndDrawer .tnd-pane-edit .tnd-tab'); },
      tabKey:     function (t) { return String(t.getAttribute('data-tab')); },
      tabName:    function (k) {
        var t = document.querySelector('#tndDrawer .tnd-pane-edit .tnd-tab[data-tab="' + k + '"]');
        return t ? (t.getAttribute('data-tab-name') || '') : '';
      },
      panelKeyOf: function (el) {
        var g = (el && el.closest) ? el.closest('.vB-group[data-panel]') : null;
        return g ? String(g.getAttribute('data-panel')) : null;
      },
      // panels are numbered, so the summary reads in tab order
      order:      function (a, b) { return Number(a) - Number(b); },
      chip:       function () { return document.getElementById('tndEnrollOutstanding'); },
      summaryHost: function () { return document.getElementById('tndDrawerBody'); },
      activate:   function (k) { activatePanel(k); }
    };
    function enrollSurface(eng) { return (eng && eng.surface) || TND_DRAWER_SURFACE; }
    function enrollPanelOf(el) { return TND_DRAWER_SURFACE.panelKeyOf(el); }
    // one counter badge on one tab. Numbers only (no glyph icons); the spoken/hovered label spells
    // out what the number counts so it is never just a bare digit.
    function enrollBadge(tab, cls, n, noun) {
      var el = tab.querySelector('.' + cls);
      if (!n) { if (el && el.parentNode) el.parentNode.removeChild(el); return; }
      if (!el) { el = document.createElement('span'); el.className = cls; tab.appendChild(el); }
      el.textContent = String(n);
      var label = n + ' ' + noun + (n === 1 ? ' field is' : ' fields are') + ' still empty on this tab';
      el.setAttribute('title', label);
      el.setAttribute('aria-label', label);
    }
    // the summary lives inside whatever the surface calls its body, and is found by CLASS rather
    // than by id: the drawer is not the only thing that renders one now, and two elements sharing
    // an id on the same page is how the wrong one gets updated.
    function enrollSummaryEl(S, create) {
      var host = S.summaryHost();
      if (!host) return null;
      var el = host.querySelector('.tnd-enroll-summary');
      if (el || !create) return el;
      el = document.createElement('div');
      el.className = 'tnd-enroll-summary';
      el.setAttribute('role', 'alert');
      el.hidden = true;
      el.innerHTML = '<span class="tnd-enroll-summary-ico">' + TND_ENROLL_ICO_ALERT + '</span><span class="tnd-enroll-summary-text"></span>';
      host.insertBefore(el, host.firstChild);
      return el;
    }
    // every trace of the previous record's state: run on close and on each fresh load, so a new
    // child never opens pre-armed with someone else's counts.
    function clearEnrollmentChrome(S) {
      S = S || TND_DRAWER_SURFACE;
      var scope = S.scope();
      if (scope) {
        $(scope).find('.tnd-tab-req, .tnd-tab-opt').remove();
        $(scope).removeClass('tnd-enroll-armed');
      }
      var head = S.chip();
      if (head) { head.hidden = true; head.classList.remove('is-clear'); head.innerHTML = ''; }
      var sum = enrollSummaryEl(S, false);
      if (sum && sum.parentNode) sum.parentNode.removeChild(sum);
    }
    function refreshEnrollment() {
      var eng = enrollmentEngine();
      if (!eng) { clearEnrollmentChrome(); return; }
      var report;
      try { report = eng.audit(); } catch (e) { return; }          // never let a count break the editor
      /* WHAT IS HOLDING THE SAVE UP is not the same question as WHAT IS EMPTY.

         A form whose required fields are all full but whose email will not parse, or whose name the
         remote rule finds already taken, is still refused. Counting only emptiness meant the chip
         answered such a refusal with a green tick and the words "Nothing outstanding", which is not
         merely unhelpful: it asserts the form is complete at the exact moment the server is turning
         it down, and the user has no reason left to look at the field. So the count is over both
         lists, and the summary and the per-tab badges follow it.

         An engine that reports no `invalid` list is unchanged by this. The child form is one, so
         `blocking` is exactly `missing` there and every string below reads as it always did. */
      var S = enrollSurface(eng);
      var blocking = report.missing.concat(report.invalid || []);
      // "still required" is only true while every one of them is genuinely blank. Saying "required"
      // of a field the user has already filled reads as the form having lost what they typed.
      var allBlank = !(report.invalid && report.invalid.length);
      var byTabReq = {}, byTabOpt = {}, missingTotal = blocking.length;
      blocking.forEach(function (m) { var p = S.panelKeyOf(m.el) || '0'; byTabReq[p] = (byTabReq[p] || 0) + 1; });
      report.optional.forEach(function (o) { var p = S.panelKeyOf(o.el) || '0'; byTabOpt[p] = (byTabOpt[p] || 0) + 1; });

      /* NOTHING IS ON SCREEN UNTIL A SAVE HAS BEEN REFUSED (card "Simplify the enrollment and
         waiting-list selection", https://trello.com/c/Rn6tUAT4).

         The counts used to be drawn the moment the record opened, so a brand new child came up
         wearing "7 still required" beside Save and a red digit on four of seven tabs, before the
         user had typed a character. That is a form telling somebody off for not having done work
         it has not asked for yet, and the cost is not the noise: a marker that is always there is
         a marker nobody reads, so the one time it means "your save was refused, look here" it
         reads the same as it did on arrival.

         `armed` is set by the form's own invalidHandler, so the counts appear on the first
         refused save and not before. They still come and go per keystroke after that, which is
         the half worth keeping: fill the field, the badge goes. Both badges are gated, not just
         the red one, so the tab strip is genuinely quiet rather than quieter. */
      var armed = !!(eng.isArmed && eng.isArmed());
      Array.prototype.slice.call(S.tabs()).forEach(function (tab) {
        var i = S.tabKey(tab);
        // 0 removes the badge outright, which is what makes "armed" here a hide and not a restyle
        enrollBadge(tab, 'tnd-tab-req', armed ? (byTabReq[i] || 0) : 0, 'required');
        enrollBadge(tab, 'tnd-tab-opt', armed ? (byTabOpt[i] || 0) : 0, 'optional');
      });

      var head = S.chip();
      if (head) {
        if (!armed) {
          // not "hidden with the old count still in it": the chip is read by screen readers off
          // the DOM, and a stale total sitting there is worse than no chip.
          head.classList.remove('is-clear');
          head.innerHTML = '';
          head.hidden = true;
        } else if (missingTotal > 0) {
          head.classList.remove('is-clear');
          head.innerHTML = TND_ENROLL_ICO_ALERT + '<span>' + missingTotal + (allBlank ? ' still required' : ' to fix') + '</span>';
          head.hidden = false;
        } else {
          // they hit Save, it failed, they fixed everything: say so rather than leaving the head
          // silent, which reads as "did my fix register?"
          head.classList.add('is-clear');
          head.innerHTML = TND_ENROLL_ICO_OK + '<span>Nothing outstanding</span>';
          head.hidden = false;
        }
      }

      var sum = enrollSummaryEl(S, armed && missingTotal > 0);
      if (!sum) return;
      if (!armed || missingTotal === 0) { sum.hidden = true; return; }
      var parts = Object.keys(byTabReq).map(function (p) { return { panel: p, n: byTabReq[p], name: S.tabName(p) }; });
      parts.sort(function (a, b) { return S.order(a.panel, b.panel); });
      var html;
      if (parts.length && parts[0].name) {
        // "2 required on Details, 1 on Parents Details." Each tab name jumps to that tab.
        html = parts.map(function (p, idx) {
          return escapeHtml((idx === 0 ? (p.n + (allBlank ? ' required on ' : ' to fix on ')) : (p.n + ' on ')))
            + '<button type="button" class="tnd-enroll-jump" data-tab="' + escapeHtml(p.panel) + '">' + escapeHtml(p.name) + '</button>';
        }).join(', ') + '.';
      } else {
        // an untabbed record (few enough sections that structureForm stacked them) has no tab to name
        html = escapeHtml(allBlank
          ? (missingTotal + (missingTotal === 1 ? ' required field is still empty.' : ' required fields are still empty.'))
          : (missingTotal + (missingTotal === 1 ? ' field still needs fixing.' : ' fields still need fixing.')));
      }
      sum.querySelector('.tnd-enroll-summary-text').innerHTML = html;
      sum.hidden = false;
    }
    // a failed save: recount (the form has armed itself by now), then take the user to the FIRST tab
    // holding an error. Runs before the form focuses that field, which is the only reason the focus
    // can land at all: you cannot focus a control inside a hidden panel.
    function reportEnrollmentInvalid(validator) {
      refreshEnrollment();
      var list = (validator && validator.errorList) || [];
      if (!list.length) return;
      var S = enrollSurface(enrollmentEngine());
      var panel = S.panelKeyOf(list[0].element);
      if (panel !== null) S.activate(panel);
    }
    // the jump buttons are written INTO the summary, which now hangs wherever the surface put it, so
    // this can no longer be scoped to the drawer. The surface of whichever engine is live decides
    // what activating a tab means: a click on a pane tab, or Bootstrap's own tab('show').
    $(document).on('click.tndList', '.tnd-enroll-jump', function () {
      enrollSurface(enrollmentEngine()).activate($(this).attr('data-tab'));
    });
    /* The form fires these on itself and both bubble to document, so nothing here needs re-binding
       when a new record is loaded into the pane. `[data-tnd-audit]` is stamped by
       TndFormAudit.attach: a tabbed form that is not a record has its own id (Settings posts
       #frmWebsiteSettings), and hardcoding the record form's id here is what would otherwise have
       let it arm itself and then render nothing at all. */
    $(document).off('tnd:enrollment.tndList tnd:enrollment-invalid.tndList');
    $(document).on('tnd:enrollment.tndList', '#frmAddEditRecord, [data-tnd-audit]', function () { refreshEnrollment(); });
    $(document).on('tnd:enrollment-invalid.tndList', '#frmAddEditRecord, [data-tnd-audit]', function (e, validator) { reportEnrollmentInvalid(validator); });

    /* ============================================================================================
       THE SAME REFUSAL REPORT, ON EVERY MULTI-TAB RECORD
       Card "We need the same err/validation checking process we have on a child ... across the
       board where we have multi-tab module" (https://trello.com/c/E3K1oq5i).

       Everything above this point only DRAWS: the per-tab counts, the summary naming the tabs that
       are holding the save up, the chip beside Save. None of it knows anything about children. It
       asks one object, window.tndEnrollment, for three things (`form`, `audit()`, `isArmed()`) and
       renders whatever it gets back. But the child form was the only thing that had ever answered,
       so in practice a feature written to be generic shipped as a children-only feature, and the
       other two tabbed records (Branches, Classes) refused a save with a toast and no marked field.

       This is the generic answer, for any form that has already written its requirements down in
       its own jQuery Validate rules. One attach() call and the form behaves like the child form:
       silent until a save is actually refused, then a count on every tab, the summary line, the
       head chip and a red ring on each empty required field, all of it clearing live as the fields
       are filled.

       Requirements are READ BACK OFF THE VALIDATOR rather than restated in a second list here, and
       that is the whole design. A count kept separately drifts from the rules the day somebody
       edits one and not the other, and then the badge says a tab is clear while the save keeps
       being refused. Reading the validator also inherits each form's own `ignore`, which matters
       more than it sounds: all three tabbed forms override `ignore` precisely so that a field on a
       tab you cannot see is still validated, while a native <select> hidden under its own
       .tnd-select widget is treated however that form decided to treat it. Both answers come along
       for free, and they are by construction the same answers the save itself uses.

       The global stays named tndEnrollment because that is the contract tendi-list.js already
       reads and children.php already publishes. It is a record-completeness engine and not an
       enrollment one; the name is simply older than its second caller.
       ============================================================================================ */

    // "did the user put anything in it". Written out rather than borrowed from the plugin on
    // purpose: this build is jQuery Validate 1.9.0, whose methods.required() has to be called with
    // the validator as `this` AND a value the caller has already extracted, and whose elementValue()
    // helper does not exist yet. A checkbox or a radio is answered across its whole NAME group, and
    // that group is gathered by comparing .name in a filter rather than with an attribute selector,
    // because the names on these forms (`type[]`, `required_branches[]`) are not valid inside one.
    function tndControlFilled(form, el) {
      if (el.type === 'checkbox' || el.type === 'radio') {
        var nm = el.name;
        return $(form).find('input[type="' + el.type + '"]').filter(function () {
          return this.name === nm && this.checked;
        }).length > 0;
      }
      var v = $(el).val();
      if (v == null) return false;
      if ($.isArray(v)) return v.length > 0;                  // <select multiple> with nothing picked
      return $.trim(String(v)).length > 0;
    }
    /* a control the user can actually fill right now.

       The awkward case is a field on a tab that is not on screen. Every panel but the open one
       carries the `hidden` attribute, so a plain :hidden test would report five of a six-tab record
       as "nothing left to fill". But answering that with a bare "inside a hidden panel, therefore in
       play" is wrong in the other direction: the form's OWN conditional blocks (`.d-none`, an inline
       display:none, the Class field a waiting-list child does not have) would then be counted while
       their tab is in the background and uncounted the moment you click onto it, so the muted number
       moved when nothing but the tab had changed.

       So the panel is treated as transparent and every ancestor BELOW it is still asked. `display`
       is not inherited, so a wrapper inside a hidden panel still reports its own value and this
       reads the form's answer rather than the tab's.

       readOnly is deliberately NOT symmetrical with the required sweep. Nobody can type into a
       readonly control, so counting it under "still empty" would be asking for something that
       cannot be given; a readonly field that is REQUIRED and empty is a genuine problem and is
       counted, because there the form is the thing that is wrong. */
    function tndControlInPlay(el) {
      var $el = $(el);
      if (el.disabled || el.readOnly) return false;
      if (/^(hidden|submit|reset|image|button|file|password)$/.test(el.type || '')) return false;
      var panel = $el.closest('.vB-group[data-panel]')[0];
      if (panel && $el.closest('[hidden]').length) {
        // the control itself: a native <select> is hidden by the widget that replaced it, which is
        // not the form withholding the field, so it stays in play.
        if (el.tagName !== 'SELECT' && getComputedStyle(el).display === 'none') return false;
        for (var n = el.parentElement; n && n !== panel; n = n.parentElement) {
          if (n.nodeType === 1 && getComputedStyle(n).display === 'none') return false;
        }
        return true;
      }
      if (el.tagName === 'SELECT') return true;
      return !$el.is(':hidden');
    }

    /* The chip is created on demand for any surface that is not the drawer (the drawer ships its
       own in the pane head markup). Found by CLASS inside its host and never by id, because the
       drawer owns `tndEnrollOutstanding`, the drawer markup is part of the page shell and is
       therefore present on these pages too, and two elements sharing an id is how the wrong one
       silently gets written to. */
    function tndMountChip(hostSel) {
      var host = document.querySelector(hostSel);
      if (!host) return null;
      var el = host.querySelector('.tnd-enroll-outstanding');
      if (!el) {
        el = document.createElement('span');
        el.className = 'tnd-enroll-outstanding';
        el.hidden = true;
        host.insertBefore(el, host.firstChild);
      }
      return el;
    }

    window.TndFormAudit = {
      /* A surface for a form with NO tab strip at all, which still wants to be told what is
         holding its save up. The Users pane is one: five sections stacked down the pane rather
         than tabbed (it carries dead `.tnd-tab` handling in tendi-users.js that never renders
         anything, which is easy to mistake for a tab bar; there is none).

         tabs() is empty, so the per-tab badge pass does nothing, and tabName() answering '' is
         what drops the summary into its untabbed wording, "2 required fields are still empty.",
         which the renderer already had for a record too small to be tabbed. The chip and the
         field rings are the parts that carry the meaning here. */
      plainSurface: function (opts) {
        opts = opts || {};
        return {
          scope:       function () { return document.querySelector(opts.scope || 'body'); },
          tabs:        function () { return []; },
          tabKey:      function () { return '0'; },
          tabName:     function () { return ''; },
          panelKeyOf:  function () { return null; },
          order:       function () { return 0; },
          chip:        function () { return tndMountChip(opts.chipHost); },
          summaryHost: function () { return document.querySelector(opts.summaryHost); },
          activate:    function () {}                 // there is no tab to move to
        };
      },

      /* A surface for a plain Bootstrap tab bar, which is what a tabbed form that is NOT a record
         uses (Settings: one form, eleven `.tab-pane`s, a `ul.nav-tabs` of anchors whose href is the
         pane id). Hand it the tab anchors and the panes and it answers the same questions the
         drawer answers.

         opts.tabs        selector for the tab ANCHORS (their href points at the pane)
         opts.panes       selector for the panes, default '.tab-pane'
         opts.chipHost    where the "N still required" chip is mounted, next to Save
         opts.summaryHost where the summary line hangs, first child

         The chip and the summary are found by CLASS inside their host rather than by id: the drawer
         owns those ids, the drawer markup is part of the page shell and is present here too, and
         two elements sharing an id is how the wrong one silently gets written to. */
      bootstrapTabs: function (opts) {
        opts = opts || {};
        var paneSel = opts.panes || '.tab-pane';
        function tabEls() { return Array.prototype.slice.call(document.querySelectorAll(opts.tabs)); }
        function keyOf(t) { return String(t.getAttribute('href') || '').replace(/^#/, ''); }
        return {
          scope: function () { return document.querySelector(opts.scope || 'body'); },
          tabs: tabEls,
          tabKey: keyOf,
          tabName: function (k) {
            var hit = null;
            tabEls().forEach(function (t) { if (keyOf(t) === k) hit = t; });
            if (!hit) return '';
            /* Only the anchor's own TEXT nodes. Its element children are the tab's inline SVG icon
               and the two counter badges this very renderer appends, so a plain textContent would
               read "Organization" back as "Organization2" and put the badge's digit inside the
               summary sentence. The drawer dodges this with a data-tab-name attribute written
               before any badge exists; a Bootstrap tab bar has no such attribute to read. */
            var s = '';
            Array.prototype.slice.call(hit.childNodes).forEach(function (n) {
              if (n.nodeType === 3) s += n.nodeValue;
            });
            return $.trim(s);
          },
          panelKeyOf: function (el) {
            var p = (el && el.closest) ? el.closest(paneSel) : null;
            return p && p.id ? p.id : null;
          },
          // pane ids are words, so document order of the tab bar is the only sane ordering
          order: function (a, b) {
            var keys = tabEls().map(keyOf);
            return keys.indexOf(a) - keys.indexOf(b);
          },
          chip: function () { return tndMountChip(opts.chipHost); },
          summaryHost: function () { return document.querySelector(opts.summaryHost); },
          activate: function (k) {
            tabEls().forEach(function (t) {
              if (keyOf(t) !== k) return;
              try { $(t).tab('show'); } catch (e) { t.click(); }
            });
          }
        };
      },

      /* form: the record form (these are all #frmAddEditRecord).
         Returns the engine, so the caller's invalidHandler can arm() it. Safe to call again on a
         later SPA visit: each fragment load brings a NEW form element, gets a new engine with
         `armed` back to false, and the stale one is ignored by enrollmentEngine()'s containment
         check the moment its form leaves the drawer. */
      attach: function (form, surface) {
        if (!form || !$.fn.validate) return null;
        var $form = $(form), armed = false, timer = null, sameTurn = null;
        // how the delegated tnd:enrollment handlers find a form that is not the record form
        form.setAttribute('data-tnd-audit', '1');

        // read lazily, never cached: attach() may run before .validate() does, and Classes adds and
        // removes a rule at runtime (the out-of-hours schedule) that a cached copy would miss.
        function validator() { return $form.data('validator') || null; }

        // is `required` on this field switched on RIGHT NOW. `.rules()` has normalised the entry by
        // the time we see it, which in this build also means it has already called a bare
        // dependency callback for us (normalizeRules ends `a[d] = isFunction(e) ? e(b) : e`). The
        // function branch is therefore belt and braces for a plugin bump, not a live path, and a
        // callback that throws is read as required: over-counting shows a badge the user can clear,
        // under-counting shows a clear form the server keeps refusing.
        function requiredNow(v, el, req) {
          if (req === undefined || req === false || req === null) return false;
          if (typeof req === 'function') { try { return !!req.call(v, el); } catch (e) { return true; } }
          return true;
        }
        function missingRequired() {
          var v = validator(), out = [];
          if (!v || typeof v.elements !== 'function') return out;
          var els;
          try { els = v.elements(); } catch (e) { return out; }   // never let a count break the editor
          els.each(function () {
            var rules;
            try { rules = $(this).rules(); } catch (e) { return; }
            if (!rules || !requiredNow(v, this, rules.required)) return;
            if (!tndControlFilled(form, this)) out.push({ field: this.name, el: this });
          });
          return out;
        }
        /* Everything else holding the save up: a malformed email, a name the remote rule found
           already taken, a capacity typed as a word. WITHOUT THIS the head chip answered such a
           refusal with a green tick and "Nothing outstanding", because every required field was
           full and the count only ever looked at emptiness.

           The source is THE MESSAGES THE FORM IS SHOWING, not `validator.invalid`. Both were tried
           and the map is not trustworthy here: a `remote` rule still in flight makes check() return
           "pending", which leaves `invalid[name] === true` behind and never clears it if the answer
           comes back good. Measured on a brand new Branch, where the duplicate-name check had not
           returned by the time Save ran: `invalid` held `name`, nothing on screen said anything was
           wrong with the name, and the chip insisted on one more thing to fix that the user could
           not find. `errorList` is no better, being rebuilt per check and emptied by a single-field
           recheck. A visible message is the honest test, because it is the same evidence the user
           has: if the form is not saying what is wrong with a field, that field must not be in a
           count that sends them looking for it.

           `display` on the label itself, not :hidden: the plugin hides a cleared message with an
           inline display:none, while a message on a background TAB is only hidden by its panel, and
           display is not inherited so the label still reports its own value either way. */
        function otherInvalid(missing) {
          var out = [], seen = {};
          missing.forEach(function (m) { seen[m.field] = true; });
          $form.find('label.error').each(function () {
            if (!$.trim(this.textContent || '')) return;
            if (getComputedStyle(this).display === 'none') return;
            var grp = this.closest ? this.closest('.form-group, .field') : null;
            /* The label's own `for` first. A control whose value lives in a hidden input (the
               alert-recipient chip box writes one) resolves through the query below to its
               unnamed entry box, fails the `el.name` test, and silently leaves the count, so
               the chip said "Nothing outstanding" while the save was being refused. */
            var fr = this.getAttribute('for');
            var el = (fr && (form.querySelector('[name="' + fr + '"]') || document.getElementById(fr)))
                     || (grp ? grp.querySelector('input:not([type=hidden]), select, textarea') : null);
            if (!el || !el.name || seen[el.name]) return;
            seen[el.name] = true;
            out.push({ field: el.name, el: el });
          });
          return out;
        }
        /* the muted "there is more in here" count. Not read off the validator: an optional field
           usually carries no rule at all, so validator.elements() cannot see it.
           Checkboxes and radios are skipped unless a rule names them. An unchecked box is not an
           empty field, it is the answer "no", and counting one under "N optional fields are still
           empty on this tab" is a category error: it put the Class form's "remove the image I
           already have" plumbing on the Appearance tab's badge as work outstanding. */
        function emptyOptional(skipNames) {
          var out = [], seen = {}, v = validator();
          var ruled = (v && v.settings && v.settings.rules) || {};
          $form.find('input, select, textarea').each(function () {
            if (!this.name || seen[this.name] || skipNames[this.name]) return;
            /* `[]` means a group, and a group is covered by its own rule when it matters, so it
               is never an empty optional field: counting an all-unticked group here is the same
               category error the paragraph above describes. */
            if ((this.type === 'checkbox' || this.type === 'radio') && (!ruled[this.name] || /\[\]$/.test(this.name))) return;
            if (!tndControlInPlay(this)) return;
            seen[this.name] = true;
            if (!tndControlFilled(form, this)) out.push({ field: this.name, el: this });
          });
          return out;
        }
        function audit() {
          if (sameTurn) return sameTurn;   // see refresh(): one walk feeds both this and the chrome
          var v = validator(), missing = missingRequired(), invalid = otherInvalid(missing), skip = {};
          missing.forEach(function (m) { skip[m.field] = true; });
          invalid.forEach(function (m) { skip[m.field] = true; });
          /* A field that is already counted is never also counted as optional, so a blank Name is
             one badge and not two. Keyed by NAME, because a radio group is many elements and one
             field. The sweep below catches a field the form's own `ignore` withheld from the
             validator: it is in neither list above, and counting it as "optional, still empty"
             would tell the user a required field is a nice-to-have. normalizeRule() first, because
             `rules: { name: "required" }` is legal and leaves a String here whose .required is
             undefined. A rule that is not `required` is left alone, so an optional-but-format-
             checked field still counts toward the muted total. */
          if (v && v.settings && v.settings.rules) {
            Object.keys(v.settings.rules).forEach(function (n) {
              var r = v.settings.rules[n];
              try { r = $.validator.normalizeRule(r); } catch (e) {}
              if (r && r.required) skip[n] = true;
            });
          }
          return { missing: missing, invalid: invalid, optional: emptyOptional(skip) };
        }
        /* the per-field red ring. It lands on the field's GROUP rather than on the control, which
           is what keeps it alive under select2: select2 rewrites its container's class attribute
           from the source select shortly after it initialises, so a class written onto the widget
           is wiped, while one written onto the .form-group above it is not. The stylesheet reaches
           down from the group to whichever widget is rendered (tendi-enrollment.css §1).

           `sameTurn` is what stops the form being walked twice per recount: the trigger below is
           synchronous, so refreshEnrollment's own eng.audit() lands inside this call and gets the
           report already computed. Cleared on the next tick rather than at the end of this function,
           because a handler between here and then would otherwise walk it again. */
        function refresh() {
          // a debounce can outlive the record: closeDrawer clears the chrome at once but empties the
          // body 240ms later, so a timer landing in that window used to repaint badges over a
          // closing pane. Nothing to draw for a form that is on its way out.
          if (!document.body.contains(form)) return { missing: [], invalid: [], optional: [] };
          var drawer = document.getElementById('tndDrawer');
          if (drawer && drawer.hidden && $form.closest('#tndDrawerBody').length) {
            return { missing: [], invalid: [], optional: [] };
          }
          var report = audit();
          sameTurn = report;
          setTimeout(function () { sameTurn = null; }, 0);
          $form.find('.tnd-enroll-missing').removeClass('tnd-enroll-missing');
          if (armed) {
            // both lists: a field the server would reject for its CONTENT needs the same ring as one
            // that is blank, and in the pane it gets none of its own (the skin's `.form-control.error`
            // rule is outweighed there the same way this one was).
            report.missing.concat(report.invalid).forEach(function (m) {
              var g = m.el && m.el.closest ? m.el.closest('.form-group, .field') : null;
              if (g) g.classList.add('tnd-enroll-missing');
            });
          }
          $form.trigger('tnd:enrollment');      // → refreshEnrollment(): tabs, summary, head chip
          return report;
        }
        function arm(on) {
          armed = !!on;
          /* The form carries the flag for its own fields and the drawer shell carries it too,
             because the head chip and the tab counters live OUTSIDE the form. Both are load
             bearing, and not interchangeable: the ring selectors in tendi-enrollment.css read
             `#tndDrawer ... .tnd-enroll-armed ... .vB-editcard`, so the flag has to be on a
             DESCENDANT of the drawer (the form) and not on the drawer itself, while the badges and
             the chip are outside the form and can only see the drawer's copy. The form's copy is
             also the only one that exists on the standalone full-page route, which has no drawer. */
          $form.toggleClass('tnd-enroll-armed', armed);
          // and the surface's own scope, because the chip and the counters sit outside the form
          var scope = surface ? surface.scope() : document.getElementById('tndDrawer');
          if (scope) $(scope).toggleClass('tnd-enroll-armed', armed);
          refresh();
          // A `remote` rule refused in flight paints its message when the response lands, which is
          // after this. Nothing else would recount until the user next types, so the one count they
          // read straight after pressing Save would be the one taken before the answer arrived.
          if (armed) setTimeout(function () { if (armed) refresh(); }, 900);
        }

        // Live recount, so a badge goes the moment the field it names is filled. Debounced because
        // one pass walks every control on the form and asks the browser for computed styles, and
        // skipped entirely while disarmed: nothing is on screen yet, so there is nothing to redraw.
        // .off() first, since a fragment's inline script re-runs on every SPA visit.
        $form.off('input.tndAudit change.tndAudit').on('input.tndAudit change.tndAudit', function (e) {
          if (!armed) return;
          /* Ask the validator again about the field that just changed, BEFORE recounting it.
             `validator.invalid` is a map that only changes when an element is re-checked, so a
             corrected email stayed in the count until the next Save: the ring cleared, the message
             cleared, and the chip went on insisting there was one thing to fix. The plugin's own
             keyup handler does exactly this for a field that has already been submitted once; it
             just never sees a value set programmatically or by a widget. Restricted to fields
             ALREADY known bad, so a `remote` rule is not re-fired for a field nobody has
             questioned, and re-checking the same value is served from the plugin's own cache. */
          var v = validator(), t = e.target;
          if (v && t && t.name && v.invalid && v.invalid[t.name]) { try { v.element(t); } catch (err) {} }
          clearTimeout(timer);
          timer = setTimeout(refresh, 140);
        });

        window.tndEnrollment = {
          form: form,
          surface: surface || null,      // absent means the drawer, which is the default surface
          audit: audit,
          refresh: refresh,
          arm: arm,
          isArmed: function () { return armed; }
        };
        return window.tndEnrollment;
      }
    };

    // header Save proxies to the loaded form's own submit (keeps the legacy validation/ajax intact)
    $(document).on('click.tndList', '#tndDrawerSave', function () {
      var f = $('#tndDrawerBody').find('#frmAddEditRecord, form').first();
      var btn = f.find('#Save, button[type="submit"], input[type="submit"]').first();
      if (btn.length) btn.trigger('click'); else f.trigger('submit');
    });
    $(document).on('keydown.tndList', function (e) {
      if ((e.key === 'Escape' || e.which === 27) && !$('#tndDrawer').prop('hidden')) closeDrawer(false);
    });

    // safety net: the legacy forms have no ajax-error handler, so a failed /save would leave the
    // drawer's loader spinning forever. If a save POST fails while the drawer is open, un-stick it
    // and surface a message so the user can retry or close.
    $(document).off('ajaxError.tndList').on('ajaxError.tndList', function (ev, xhr, settings) {
      if ($('#tndDrawer').prop('hidden')) return;
      var url = (settings && settings.url) || '';
      if (!/\/save(\/|$|\?)/.test(url)) return;
      var body = $('#tndDrawerBody');
      body.find('.loader').hide();
      body.find('.btnContainer').css('display', '');
      if (!body.find('.tnd-drawer-error').length) {
        body.find('form').first().prepend('<div class="tnd-drawer-error"></div>');
      }
      body.find('.tnd-drawer-error').text('Could not save, the server returned an error. Please try again.').show();
    });

    // ---- native <select> → custom .tnd-select dropdown (consistent with the kitchen sink) ----
    function enhanceSelects(root) {
      if (!(window.TndSelect && window.TndSelect.enhance)) return;
      var sels = (root || document).querySelectorAll('select');
      Array.prototype.forEach.call(sels, function (s) {
        if (s.__tndRoot) return;                                  // already enhanced
        if (s.multiple || s.classList.contains('no-tnd')) return; // skip multi-selects
        try { window.TndSelect.enhance(s); } catch (e) {}
      });
    }
    // ---- native <select multiple> → a violet chip/tag picker (the raw listbox is clunky) ----
    // every option is a toggle chip (selected = violet); the native select stays hidden + synced for
    // form submit, and each toggle fires `change` so legacy handlers (type→vaccine forms etc.) still run.
    function enhanceMultiSelects(root) {
      $(root || document).find('select[multiple]').each(function () {
        var sel = this;
        if (sel.__tndTags || sel.classList.contains('no-tnd')) return;
        sel.__tndTags = true;
        var wrap = document.createElement('div'); wrap.className = 'tnd-tags';
        function render() {
          wrap.innerHTML = '';
          var opts = Array.prototype.filter.call(sel.options, function (o) { return o.value || o.textContent.trim(); });
          // front-end Select all / Clear all toggle (purely client-side, selects/deselects every option at once)
          if (opts.length > 1) {
            var allOn = opts.every(function (o) { return o.selected; });
            var allBtn = document.createElement('button'); allBtn.type = 'button';
            allBtn.className = 'tnd-tag tnd-tag-all'; allBtn.textContent = allOn ? 'Clear all' : 'Select all';
            allBtn.addEventListener('click', function () { var on = !opts.every(function (o) { return o.selected; }); opts.forEach(function (o) { o.selected = on; }); render(); $(sel).trigger('change'); });
            wrap.appendChild(allBtn);
          }
          opts.forEach(function (o) {
            var chip = document.createElement('button');
            chip.type = 'button'; chip.className = 'tnd-tag' + (o.selected ? ' is-on' : '');
            chip.innerHTML = '<span></span>' + (o.selected ? '<i class="fa fa-times tnd-tag-x"></i>' : '<i class="fa fa-plus tnd-tag-x"></i>');
            chip.firstChild.textContent = o.textContent.trim();
            chip.addEventListener('click', function () { o.selected = !o.selected; render(); $(sel).trigger('change'); });
            wrap.appendChild(chip);
          });
        }
        render();
        sel.style.display = 'none';                              // keep it in the DOM (submits) but show chips instead
        $(sel).next('.select2-container').hide();                // hide any legacy select2 widget
        sel.parentNode.insertBefore(wrap, sel.nextSibling);
        // keep chips in sync if the value changes programmatically (e.g. Select-All)
        $(sel).on('change.tndTags', function (e) { if (!e.__fromTags) render(); });
      });
    }
    // Vaccine/Forms requirements is a checkbox group (#vaccine-forms-requirements) styled as chips, and it is
    // AJAX-reloaded on Type change. Inject the same front-end "Select all / Clear all" toggle, and re-inject it
    // whenever the chips are replaced (MutationObserver), since the reload wipes the container's children.
    function enhanceVaccineSelectAll(root) {
      var box = (root || document).querySelector('#vaccine-forms-requirements');
      if (!box || box.__tndVaccAll) return;
      box.__tndVaccAll = true;
      function boxes() { return Array.prototype.slice.call(box.querySelectorAll('input[type=checkbox]')); }
      function allChecked() { var bs = boxes(); return bs.length > 0 && bs.every(function (b) { return b.checked; }); }
      function inject() {
        if (!boxes().length || box.querySelector('.tnd-vacc-all')) return;
        var btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'tnd-tag tnd-tag-all tnd-vacc-all';
        btn.textContent = allChecked() ? 'Clear all' : 'Select all';
        btn.addEventListener('click', function () {
          var on = !allChecked();
          boxes().forEach(function (b) { b.checked = on; });
          btn.textContent = on ? 'Clear all' : 'Select all';
        });
        box.insertBefore(btn, box.firstChild);
      }
      box.addEventListener('change', function () {
        var btn = box.querySelector('.tnd-vacc-all'); if (btn) btn.textContent = allChecked() ? 'Clear all' : 'Select all';
      });
      inject();
      try { new MutationObserver(function () { inject(); }).observe(box, { childList: true }); } catch (e) {}
    }
    // ---- single-boolean checkbox fields → iOS-style .vB-toggle switches in EDIT (matches the Users pane) ----
    // moves the real checkbox into a .vB-toggle (keeps its name/checked/handlers, so the form still submits
    // and any onchange dependency still fires); only standalone booleans, never chip/group checkboxes.
    function enhanceToggles(formEl) {
      if (!formEl) return;
      $(formEl).find('.vB-editcard .form-group, .vB-editcard .field').each(function () {
        var fg = this;
        if (fg.__tndToggle) return;
        var checks = fg.querySelectorAll('input[type=checkbox]');
        var others = fg.querySelectorAll('input:not([type=checkbox]):not([type=hidden]), select, textarea');
        if (checks.length !== 1 || others.length) return;                              // single boolean only
        // `.tnd-msg-opts` is the child form's messaging block (card https://trello.com/c/OGg5n7yt).
        // It is already a chip group and its "Send Notifications" box only escapes the test above
        // because the Home phone input happens to share its .form-group. If that ever stops being
        // true this runs, MOVES the checkbox into a .vB-toggle and DELETES every sibling label,
        // which silently eats the chip. Named here so the protection does not rest on a neighbour.
        if (fg.querySelector('#vaccine-forms-requirements, .tnd-tags, .tnd-classes-wrap, .tnd-msg-opts')) return;  // not a chip/group container
        var cb = checks[0];
        if (/\[\]$/.test(cb.name || '')) return;                                        // array name → part of a group
        if (cb.closest('.vB-toggle')) return;
        fg.__tndToggle = true;
        var labEl = fg.querySelector('.control-label, .field-label') || (cb.id ? fg.querySelector('label[for="' + cb.id + '"]') : null) || cb.closest('label');
        var txt = labEl ? labEl.textContent.replace(/\s+/g, ' ').trim() : (cb.value || 'Enabled');
        var toggle = document.createElement('label'); toggle.className = 'vB-toggle';
        var tt = document.createElement('span'); tt.className = 'tt';
        var lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = txt; tt.appendChild(lbl);
        var track = document.createElement('span'); track.className = 'track';
        toggle.appendChild(cb); toggle.appendChild(tt); toggle.appendChild(track);     // MOVE the real checkbox in
        Array.prototype.slice.call(fg.querySelectorAll('label')).forEach(function (l) { if (l !== toggle && !l.contains(cb) && l.parentNode) l.parentNode.removeChild(l); });
        fg.appendChild(toggle);
        // drop now-empty legacy wrappers (.checkbox-inline / .controls left behind), keep any hidden inputs
        Array.prototype.slice.call(fg.children).forEach(function (c) {
          if (c === toggle || c.tagName === 'INPUT') return;
          // .tnd-viewonly-label carries the wording the READ-ONLY pane names this row with, which is
          // not the same sentence as the switch's own label (see the child form's waiting-list
          // toggle). It holds no input by design, so the test below would reap it, and buildVbView
          // would then fall back to the switch label and print an instruction as a record value.
          if (c.nodeType === 1 && c.classList && c.classList.contains('tnd-viewonly-label')) return;
          if (c.nodeType === 1 && !c.querySelector('input, select, textarea')) { if (c.parentNode) c.parentNode.removeChild(c); }
        });
      });
    }
    // FILTER-ROW multi selects (e.g. Children's Branch, a legacy select2 multi) → the same
    // .tnd-select custom dropdown as every other filter (TndSelect multi mode: toggle + checks +
    // "N selected" label). Scoped to .textbox-form columns so form/drawer multi selects keep the
    // .tnd-tags chip picker and modal select2s (Add-to-group) stay untouched.
    function enhanceFilterMultiSelects(page) {
      if (!(window.TndSelect && window.TndSelect.enhance)) return;
      $(page).find('#frmBatchOperations select[multiple], form > .row select[multiple]').each(function () {
        var sel = this;
        if (sel.__tndTags || sel.classList.contains('no-tnd')) return;
        if (!sel.closest('.textbox-form')) return;
        var wasEnhanced = !!sel.__tndRoot;
        if (!sel.getAttribute('data-placeholder')) sel.setAttribute('data-placeholder', 'All');  // empty multi FILTER = no restriction
        try { window.TndSelect.enhance(sel); } catch (e) {}
        if (wasEnhanced) return;
        // hide the select2 widget the page's own JS initialised on it (it duplicates the field)
        var col = sel.closest('.textbox-form');
        if (col) Array.prototype.forEach.call(col.querySelectorAll('.select2-container'), function (c) { c.style.display = 'none'; });
      });
    }
    // enhance the list's own selects (filters + the rows-per-page length control)
    function enhanceListSelects() {
      $('.tnd-list-generic').each(function () { enhanceSelects(this); enhanceFilterMultiSelects(this); });
      /* The BESPOKE filter rows too (Users, and anything else that builds its own `.tnd-filter-row`
         instead of the generic markup row). Those pages are not `.tnd-list-generic`, so the sweep
         above never reached them and their role/branch filters were still raw browser selects: the
         one place in the reskin still rendering an OS dropdown, next to controls that are not.
         hideSingleBranchFilters() has always reached into this row; this is the same reach.
         enhanceSelects() is idempotent and skips multi-selects, so this is safe to re-run. */
      $('.tnd-filter-row').each(function () { enhanceSelects(this); });
    }

    // ---- organize filters: a page's injected filter dropdown(s) (e.g. employee "Type") are
    // dropped by DataTables into the search area, where the "Search:" label-hide also hides their
    // label and they sit apart from the markup filters (Branch/Class). Move them up into the
    // markup filter row so ALL filter dropdowns sit together, labeled + aligned. ----
    function consolidateFilters() {
      $('.tnd-list-generic').each(function () {
        var page = this;
        var fr = page.querySelector('#frmBatchOperations > .row, form > .row');     // markup filter row (Branch/Class…)
        var dtf = page.querySelector('.tnd-dt-toolbar2 .dataTables_filter');
        if (!fr || !dtf) return;
        var chk = fr.querySelector('input[type=checkbox]');
        var trashedCol = chk && chk.closest ? chk.closest('[class*="col-sm-"]') : null;   // keep Show-trashed last
        dtf.querySelectorAll('label').forEach(function (lbl) {
          if (lbl.dataset.tndFmoved || !lbl.querySelector('select')) return;        // only a <label> that wraps a filter <select> (not the search input)
          // DE-DUPE: a page that re-inits its table on every filter change (e.g. employee
          // applyFilters -> DataTable destroy+redraw) re-injects a FRESH copy of the same
          // filter. The previously moved one now lives OUTSIDE the DT wrapper, so `destroy`
          // can't reap it, without this it accumulates one dropdown per interaction (and
          // duplicate ids break `$('#type_filter').val()`). Drop the stale twin, keep the new.
          var sel = lbl.querySelector('select');
          var key = (sel.name || sel.id || '');
          if (key) {
            fr.querySelectorAll('.tnd-moved-filter').forEach(function (old) {
              var os = old.querySelector('select');
              if (os && (os.name || os.id || '') === key && old.parentNode) old.parentNode.removeChild(old);
            });
          }
          var col = document.createElement('div');
          col.className = 'col-sm-2 textbox-form tnd-moved-filter';
          lbl.dataset.tndFmoved = '1';
          col.appendChild(lbl);
          if (trashedCol) fr.insertBefore(col, trashedCol); else fr.appendChild(col);
        });
        // ---- search on the SAME row as the filters, wrapped as a `.tnd-dt-search` pill so it gets
        // the Users-page look (magnifier + "/" keycap + placeholder). Pages that RE-INIT their table
        // on every filter change (employee applyFilters -> DataTable destroy+redraw) regenerate the
        // native search input, so we move the CURRENT live input in each pass and drop the stale twin
        //: same de-dupe approach as the Type filter above. The moved <input> keeps DataTables' own
        // keyup/search handler (it's bound to the element, not the location). ----
        var liveInput = dtf.querySelector('input');
        if (liveInput) {
          var box = fr.querySelector('.tnd-dt-search.tnd-inrow');
          if (!box) {
            box = document.createElement('div');
            box.className = 'tnd-dt-search tnd-inrow';
            box.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>';
            var kbd = document.createElement('kbd'); kbd.className = 'tnd-dt-search-hint'; kbd.textContent = '/';
            box.appendChild(kbd);
            fr.appendChild(box);                                                     // search sits after the dropdowns
          }
          if (box.querySelector('input') !== liveInput) {
            var stale = box.querySelector('input');
            if (stale && stale.parentNode) stale.parentNode.removeChild(stale);      // discard the reinit twin
            box.insertBefore(liveInput, box.querySelector('.tnd-dt-search-hint'));
          }
          if (!liveInput.getAttribute('placeholder')) {
            var pt = ((page.querySelector('.tnd-dt-title') || {}).textContent || '').replace(/^\s*manage\s+/i, '').trim().toLowerCase();
            liveInput.setAttribute('placeholder', pt ? ('Search ' + pt + '…') : 'Search…');
          }
          // the row lives inside #frmBatchOperations, so Enter in the search would submit that form
          // (fire a batch action). Swallow ONLY search-originated submits, in the capture phase, so
          // the page's own submit handler never runs. The page's Enter-to-search stays intact.
          var frm = fr.closest ? fr.closest('form') : null;
          if (frm && !frm.__tndSearchGuard) {
            frm.__tndSearchGuard = 1;
            frm.addEventListener('submit', function (e) {
              var ae = document.activeElement;
              if (ae && ae.closest && ae.closest('.tnd-dt-search')) { e.preventDefault(); e.stopImmediatePropagation(); }
            }, true);
          }
        }
        /* THE PAGE HAS PROVED IT CONSOLIDATES, so from here the CSS hides the DataTables toolbar
           these controls are moved OUT of.

           Why it has to be hidden: a page that re-inits its table on every filter change (the
           employee list destroys and re-creates it) has DataTables rebuild that toolbar with a
           FRESH search input, and the page re-appends its Type dropdown into it. Both are visible
           there until this function runs again on the next draw, so for a few hundred milliseconds
           there is a second search box and a second Type dropdown sitting between the filter row
           and the table, and the table jumps down to make room and back up again. Reported as
           exactly that: a jump, and a duplicate search and Type dropdown for a split second.

           Set LAST, and only once the live search input is out of the toolbar, so a page where the
           move failed keeps its search box rather than losing it to a hidden container. */
        if (!dtf.querySelector('input')) page.classList.add('tnd-filters-moved');
      });
    }

    // ---- hide the Branch FILTER when there is only one branch to choose from. A single-branch
    // org (or a user scoped to one branch) gains nothing from a "Branch: All / <the one branch>"
    // dropdown. Works for the generic list pages AND the bespoke Users filter row. A <select> is a
    // Branch filter when its name/id contains "branch"; it's redundant when it offers ≤1 real
    // (non-empty-value) option. Assignment selects in the pane/drawer/table are never touched.
    // Those must always show. Idempotent; safe to re-run on every draw. ----
    function hideSingleBranchFilters() {
      var sels = document.querySelectorAll(
        '.tnd-list-generic #frmBatchOperations select, .tnd-list-generic form > .row select, ' +
        '.tnd-list-generic .box-content .row select, .tnd-filter-row select'
      );
      Array.prototype.forEach.call(sels, function (sel) {
        var key = (sel.name || sel.id || '');
        if (!/branch/i.test(key)) return;
        // A branch the RECORD names is not the branch the VIEWER is scoped to. "Preferred branch" is
        // the location a waiting-list family asked for, so auto-selecting the org's only branch here
        // quietly appends `AND preferred_branch_id = X` and hides every family that never named a
        // preference, with nothing on screen to explain or undo it. Only the scope filter is the
        // redundant one on a single-branch org; this stays a real filter, defaulting to All.
        if (/preferred/i.test(key)) return;
        if (sel.closest('table, thead, tbody, #tndUserPane, #tndDrawer, .tnd-pane, .modal, .tnd-pane-edit')) return;
        var real = Array.prototype.filter.call(sel.options, function (o) { return (o.value || '').trim() !== ''; });
        if (real.length > 1) { return; }        // 2+ branches → keep the filter (don't latch, options may still be loading)
        // ONE branch: select it + fire change ONCE, so any control that depends on the branch (the
        // Class dropdown loads its list via get_classes on branch change) populates for the sole
        // branch before we hide it. Without this, hiding an unselected single-branch filter left the
        // Class filter stuck on "All" (the reported #children bug). Guarded so the change can't loop
        // (change → applyFilters → redraw → draw → here again).
        if (real.length === 1 && !sel.__tndBranchAuto) {
          sel.__tndBranchAuto = 1;
          try {
            if (window.jQuery) {
              window.jQuery(sel).val(sel.multiple ? [real[0].value] : real[0].value).trigger('change');
            } else {
              real[0].selected = true;
              sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
          } catch (e) {}
        }
        var wrap = sel.closest('.textbox-form, .tnd-moved-filter, [class*="col-sm-"]');
        if (wrap) { wrap.style.display = 'none'; wrap.setAttribute('data-tnd-hide', 'single-branch'); return; }
        // Users filter row: the <select> sits bare in .tnd-filter-row, hide it (+ any enhanced twin)
        sel.style.display = 'none';
        var sib = sel.nextElementSibling;
        if (sib && sib.classList && (sib.classList.contains('tnd-select') || sib.classList.contains('select2-container'))) sib.style.display = 'none';
      });
    }

    // ---- unify above-table boolean filters into one pill component (.tnd-filter-chip), so every
    // page's "Show trashed" / log-type / etc. checkbox matches the Children filter row. We only add
    // a class + a sync listener (the real checkbox stays, so the legacy filter handlers still fire). ----
    function enhanceFilterChips() {
      $('.tnd-list-generic .checkbox-inline > label').each(function () {
        var label = this;
        if (label.classList.contains('tnd-filter-chip') || label.classList.contains('filter-chip')) return;
        if (label.closest('table, thead, tbody, #tndDrawer, .tnd-pane, .modal')) return;        // toolbar only
        var checks = label.querySelectorAll('input[type=checkbox]');
        if (checks.length !== 1) return;
        var cb = checks[0];
        if (cb.id === 'markAll' || cb.id === 'selectAllGroups' || cb.classList.contains('inputBatchOperations') || /\[\]$/.test(cb.name || '')) return;
        if (!(label.textContent || '').replace(/\s+/g, '')) return;                              // needs a visible label
        label.classList.add('tnd-filter-chip');
        var sync = function () { label.classList.toggle('is-on', cb.checked); };
        sync();
        $(cb).off('change.tndChip').on('change.tndChip', sync);
      });
    }

    // ---- move the legacy Add buttons (a right-aligned row above the box) up onto the title row,
    // right of the title, matching the Users page (title left, actions right). ----
    function relocateActions() {
      $('.tnd-list-generic').each(function () {
        // destination = the VISIBLE shared-partial header (.tnd-page-head), NOT the legacy
        // .box-header (which is now hidden). Put the relocated buttons in its .btnContainer
        // so they sit alongside the Add/Delete buttons on the title row.
        var page = this, head = page.querySelector('.tnd-page-head');
        if (!head) return;
        var dest = head.querySelector('.btnContainer');
        if ((dest && dest.querySelector('.tnd-head-actions')) || head.querySelector('.tnd-head-actions')) return;   // already moved
        var cand = null;
        page.querySelectorAll('.text-right').forEach(function (el) {
          if (cand || el.closest('table') || el.closest('.box-content') || el.closest('.tnd-pane')) return;
          if (el.querySelector('a[href*="/add"], .btn')) cand = el;
        });
        if (!cand) return;
        var wrap = document.createElement('div'); wrap.className = 'tnd-head-actions';
        while (cand.firstChild) { var c = cand.firstChild; if (c.nodeType === 1) wrap.appendChild(c); else cand.removeChild(c); }
        if (!dest) { dest = document.createElement('div'); dest.className = 'btnContainer text-right'; head.appendChild(dest); }
        dest.insertBefore(wrap, dest.firstChild);     // relocated actions sit LEFT of the Add/Delete buttons
        var oldRow = cand.closest('.row') || cand;
        if (oldRow && oldRow !== head && oldRow !== dest) oldRow.style.display = 'none';
      });
    }

    // ---- search: add the "/" keycap hint (matches the Users search) ----
    function enhanceSearchHint() {
      $('.tnd-list-generic .dataTables_filter').each(function () {
        // give the input a placeholder so it reads like the Users search ("Search users…")
        // instead of an empty box. Derive the noun from the page title when we can.
        var inp = this.querySelector('input');
        if (inp && !inp.getAttribute('placeholder')) {
          var t = (document.querySelector('.tnd-list-generic .tnd-dt-title') || {}).textContent || '';
          t = t.replace(/^\s*manage\s+/i, '').trim().toLowerCase();
          inp.setAttribute('placeholder', t ? ('Search ' + t + '…') : 'Search…');
        }
        if (this.querySelector('.tnd-dt-search-hint')) return;
        var lbl = this.querySelector('label') || this;
        var hint = document.createElement('span'); hint.className = 'tnd-dt-search-hint'; hint.textContent = '/';
        lbl.appendChild(hint);
      });
    }

    // ---- bulk Delete: hidden until ≥1 row is selected, shows a live count (matches Users) ----
    function updateBulkBtn(scope) {
      $(scope || '.tnd-list-generic').each(function () {
        var btn = this.querySelector('#btnDelete'); if (!btn) return;
        var n = this.querySelectorAll('tbody .inputBatchOperations:checked').length;
        btn.style.display = n > 0 ? '' : 'none';
        var cnt = btn.querySelector('.tnd-sel-count');
        if (!cnt) { cnt = document.createElement('span'); cnt.className = 'tnd-sel-count'; btn.appendChild(cnt); }
        cnt.textContent = n > 0 ? ' (' + n + ')' : '';
      });
    }
    $(document).on('change.tndList', '.tnd-list-generic tbody .inputBatchOperations', function () { updateBulkBtn(); });
    $(document).on('change.tndList', '.tnd-list-generic #markAll', function () {
      var on = this.checked;
      $(this).closest('.tnd-list-generic').find('tbody .inputBatchOperations').prop('checked', on);
      updateBulkBtn();
    });

    // ---- the SELECT COLUMN is the click target, not the 20px box inside it ------------------
    // "Bulk select is very hard to select the checkboxes": a 20px control centred in a ~56x60 cell
    // means most of the cell looks clickable and is not. Mark the cell (CSS gives it the cursor and
    // the hover tint) and toggle from anywhere inside it.
    function markCheckCells() {
      $('.tnd-list-generic table.tnd-list-table').each(function () {
        $(this).find('tbody td, thead th').each(function () {
          if (this.classList.contains('tnd-c-check')) return;
          if (this.querySelector('input.inputBatchOperations, input#markAll')) this.classList.add('tnd-c-check');
        });
      });
    }
    // Clicks that LAND on the input already toggle it: re-toggling here would cancel them out, so
    // anything interactive inside the cell is left alone and handled by the browser.
    $(document).on('click.tndList', '.tnd-list-generic table.tnd-list-table .tnd-c-check', function (e) {
      if ($(e.target).closest('input, label, a, button, select, textarea').length) return;
      var box = this.querySelector('input.inputBatchOperations, input#markAll');
      if (!box || box.disabled) return;
      box.checked = !box.checked;
      $(box).trigger('change');
    });

    // ---- the ACTION cell opens the row menu, not just the 30px dots -------------------------
    // Same complaint as the checkbox, same shape: the trigger is a 30px button centred in a 56px
    // sticky column, so the margin around it looks like part of the control and is not. Reported
    // as "I click the three dots and nothing happens", which is what a near miss looks like.
    // Only fires when the click missed every real control in the cell, so an inline
    // .tnd-rowaction-keep button and the trigger itself keep their own behaviour.
    $(document).on('click.tndList', '.tnd-list-generic table.tnd-list-table td.tnd-c-action', function (e) {
      if ($(e.target).closest('a, button, input, label, .tnd-rowmenu-pop').length) return;
      var trig = this.querySelector('.tnd-rowmenu-trigger');
      if (trig) { e.stopPropagation(); trig.click(); }
    });

    // ---- LIVE SEARCH for every DataTables list: typing searches, Enter is never required -------
    // Why this lives here and not in the pages: each list view's own inline script runs
    //     jqView('#datatable-1_filter .input-sm').unbind().on('keypress', … e.which == 13 …)
    // and that bare `.unbind()` strips DataTables' own live-search binding off the input, leaving
    // Enter as the ONLY way to search. Fixing ~20 copies of that line is not the fix; owning the
    // behaviour once here is. The handlers below are DELEGATED ON `document`, so a page's
    // `.unbind()` on the input can never reach them.
    //
    // Standard search-field behaviour, matching the Users page (tendi-users.js) and Children
    // (tendi-children-list.js), the two lists that already had it:
    //   • 300ms debounce (the "sleep"), so a 10-character query is ONE request, not ten
    //   • nothing fires when the value did not actually change (arrows, modifiers, tab, refocus)
    //   • Enter searches immediately, skipping the debounce
    //   • emptying the box restores the unfiltered list
    //   • a request still in flight is dropped before a newer one starts, so a slow early reply
    //     can never land on top of a later one
    var TND_SEARCH_DELAY = 300;
    // WHICH input: NOT a position, an ATTRIBUTE. DataTables stamps `type="search"` +
    // `aria-controls="<tableId>"` on the filter input it builds, and both travel WITH the element
    // when consolidateFilters() moves it out of `#datatable-1_filter` into the `.tnd-dt-search`
    // pill on the filter row. Matching on the attributes (rather than on `.input-sm` or on the
    // `#…_filter` wrapper, the assumption that has broken handlers here before) means the lookup
    // is correct both before and after the move, and on pages that never move it at all.
    // It also can't collide with the hand-written `.tnd-dt-search` boxes on Users / Attendance /
    // Reports: those are `type="text"` with no `aria-controls`, and own their own search logic.
    var TND_SEARCH_SEL = 'input[type="search"][aria-controls]';

    // the table this input searches, resolved defensively: the id DataTables put in aria-controls,
    // else the enclosing DataTables wrapper, else the nearest ancestor that holds a live table.
    function tndSearchTable(inp) {
      if (!inp || !inp.getAttribute) return null;
      var id = inp.getAttribute('aria-controls');
      if (id) { var byId = document.getElementById(id); if (byId) return byId; }
      var wrap = $(inp).closest('.dataTables_wrapper');
      if (wrap.length) { var inWrap = wrap.find('table.dataTable')[0]; if (inWrap) return inWrap; }
      var el = inp.parentNode;
      while (el && el.querySelector) {
        var t = el.querySelector('table.dataTable');
        if (t) return t;
        el = el.parentNode;
      }
      return null;
    }
    // the live DataTables API for a search input, or null when there is nothing we can drive
    function tndSearchApi(inp) {
      var tbl = tndSearchTable(inp);
      if (!tbl || !$.fn.dataTable || !$.fn.dataTable.isDataTable(tbl)) return null;
      try { return $(tbl).DataTable(); } catch (e) { return null; }
    }
    function tndRunSearch(inp, api) {
      api = api || tndSearchApi(inp);
      if (!api) return;
      var v = String(inp.value == null ? '' : inp.value).trim();
      try { if (api.search() === v) return; } catch (e) {}   // this query is already on screen
      // RACE SAFETY. DataTables discards an out-of-sequence RESPONSE (it compares json.draw with
      // settings.iDraw), but devoops' pipeline still writes that stale reply into its page cache
      // first, so a later page-change could serve rows for the previous query. Abort the in-flight
      // request instead, then drop the cache, so only the newest query can ever produce rows.
      // An abort reports status 0, which the app's global ajaxError handlers already ignore, and
      // DataTables only logs an ajax error when readyState is 4 (an abort leaves it 0).
      try {
        var st = api.settings()[0];
        if (st && st.jqXHR && st.jqXHR.abort && st.jqXHR.readyState !== 4) st.jqXHR.abort();
      } catch (e) {}
      try { if (api.clearPipeline) api.clearPipeline(); } catch (e) {}
      try { api.search(v).draw(); } catch (e) {}
    }
    // `input` only fires when the value really changed, so arrow keys, Ctrl/Shift, Tab and a
    // refocus never queue a search; the __tndSearchLast check also absorbs a programmatic
    // .trigger('input') that re-sends an unchanged value.
    $(document).off('input.tndSearch keydown.tndSearch');
    $(document).on('input.tndSearch', TND_SEARCH_SEL, function () {
      var inp = this;
      if (inp.__tndSearchLast === inp.value) return;
      inp.__tndSearchLast = inp.value;
      clearTimeout(inp.__tndSearchTimer);
      inp.__tndSearchTimer = setTimeout(function () { tndRunSearch(inp); }, TND_SEARCH_DELAY);
    });
    $(document).on('keydown.tndSearch', TND_SEARCH_SEL, function (e) {
      if (e.key !== 'Enter' && e.which !== 13 && e.keyCode !== 13) return;
      // Resolve the table BEFORE cancelling anything: if we can't drive the search ourselves we
      // must leave the page's own Enter handler its default path rather than silently kill it.
      var api = tndSearchApi(this);
      if (!api) return;
      // Cancelling keydown also cancels the keypress the browser would have produced next, which
      // is what keeps a page's legacy Enter-only keypress handler from running the SAME search a
      // second time. It also stops Enter submitting the surrounding #frmBatchOperations. If a
      // browser ever dispatched that keypress anyway, the page would re-apply the value we just
      // applied: one redundant identical request, never a wrong result.
      e.preventDefault();
      clearTimeout(this.__tndSearchTimer);
      this.__tndSearchLast = this.value;
      tndRunSearch(this, api);
    });
    // Hand the input over to the delegated pair above by removing DataTables' own search binding.
    // Without this, a page that never called `.unbind()` (Payments, the file-upload lists) would
    // ALSO run DataTables' throttled search, i.e. two requests per pause. `keypress.DT` is left
    // alone on purpose: it is DataTables' form-submit guard, not a search trigger.
    // Per-element flag, so a `destroy:true` re-init (which builds a fresh input) re-arms itself.
    function armSearchInputs() {
      $(TND_SEARCH_SEL).each(function () {
        if (this.__tndSearchArmed) return;
        this.__tndSearchArmed = 1;
        try { $(this).off('keyup.DT search.DT input.DT paste.DT cut.DT'); } catch (e) {}
      });
    }
    // arm the moment a table finishes initialising, i.e. before anyone can type into it
    $(document).off('init.dt.tndSearch').on('init.dt.tndSearch', function () { armSearchInputs(); });

    // "/" focuses the list search when not already typing in a field (matches Users)
    $(document).on('keydown.tndList', function (e) {
      var isSlash = (e.key === '/' || e.which === 191);
      if (!isSlash || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
      var inp = document.querySelector('.tnd-list-generic .tnd-dt-search input, .tnd-list-generic .dataTables_filter input');
      if (!inp) {
        // fallback for a list page that isn't .tnd-list-generic (Payments, the file-upload lists):
        // its DataTables search box, if one is actually on screen. Purely additive, the generic
        // lookup above is untouched.
        inp = document.querySelector(TND_SEARCH_SEL);
        // getClientRects(), not offsetParent: offsetParent is also null for any
        // position:fixed element, so a search box inside a fixed drawer would be
        // treated as hidden and the "/" shortcut would skip it.
        if (inp && inp.getClientRects().length === 0) inp = null;
      }
      if (!inp) return;
      e.preventDefault(); inp.focus(); inp.select();
    });

    // ---- at-a-glance row columns (matches Users): a monogram avatar on the name column + a
    // status PILL on a text status column. Gated so it never touches numeric names or live
    // toggle/control cells (e.g. the children status switch). Re-run on every draw. ----
    function enhanceRowCells() {
      $('.tnd-list-generic table.tnd-list-table').each(function () {
        // OPT-OUT: a page whose controller already emits the avatar / status / sub-line markup marks
        // its root data-tnd-rowcells="off". Re-deriving them here reads cell.textContent, which on
        // an already-decorated cell includes the avatar's own initials, so the name came out as
        // "SRShmeil Rosenberg" and the sub-line was flattened into it.
        if (this.closest('[data-tnd-rowcells="off"]')) return;
        var table = this, headers = [], ths = table.querySelectorAll('thead th');
        $(table).find('thead th').each(function () { headers.push($(this).text().trim().toLowerCase()); });
        var nameIdx = -1, statusIdx = -1, typeIdx = -1, notesIdx = -1, phoneIdx = -1;
        for (var i = 0; i < headers.length; i++) {
          if (nameIdx < 0 && /^(name|full ?name|first ?name|child|student|employee|title)\b/.test(headers[i])) nameIdx = i;
          if (statusIdx < 0 && /^(status|active|state|enabled)$/.test(headers[i])) statusIdx = i;
          if (typeIdx < 0 && /^(type|role|category|position|department|program|kind|level)$/.test(headers[i])) typeIdx = i;
          if (notesIdx < 0 && /^(notes?|description)$/.test(headers[i])) notesIdx = i;
          if (phoneIdx < 0 && /^(phone|mobile|cell|tel|fax|contact ?(no|number|#)?)\b/.test(headers[i])) phoneIdx = i;
        }
        // column-width classes on the header cells (the matching <td>s are tagged in the row loop)
        function tagTh(idx, cls) { if (idx >= 0 && ths[idx]) ths[idx].classList.add(cls); }
        tagTh(nameIdx, 'tnd-c-name'); tagTh(statusIdx, 'tnd-c-status'); tagTh(typeIdx, 'tnd-c-type'); tagTh(notesIdx, 'tnd-c-notes'); tagTh(phoneIdx, 'tnd-c-phone');
        if (nameIdx < 0 && statusIdx < 0 && typeIdx < 0 && notesIdx < 0 && phoneIdx < 0) return;
        $(table).find('tbody tr').each(function () {
          var tds = this.children, rid = this.id || '';
          if (nameIdx >= 0 && tds[nameIdx]) tds[nameIdx].classList.add('tnd-c-name');
          if (statusIdx >= 0 && tds[statusIdx]) tds[statusIdx].classList.add('tnd-c-status');
          if (typeIdx >= 0 && tds[typeIdx]) tds[typeIdx].classList.add('tnd-c-type');
          if (notesIdx >= 0 && tds[notesIdx]) tds[notesIdx].classList.add('tnd-c-notes');
          if (phoneIdx >= 0 && tds[phoneIdx]) tds[phoneIdx].classList.add('tnd-c-phone');
          // name cell → .tnd-user-cell (.tnd-row-avatar monogram + name): same markup/CSS as the Users list
          if (nameIdx >= 0 && tds[nameIdx] && !tds[nameIdx].querySelector('.tnd-user-cell')) {
            var cell = tds[nameIdx];
            // optional sub-line (e.g. a friendly name) the controller emits as
            // <small class="tnd-rowsub-src">…</small> inside the name cell: render it under the name
            var subEl = cell.querySelector('.tnd-rowsub-src');
            var sub = subEl ? subEl.textContent.trim() : '';
            if (subEl && subEl.parentNode) subEl.parentNode.removeChild(subEl);
            var name = cell.textContent.trim();
            if (name && /[a-z]/i.test(name) && !cell.querySelector('img')) {
              var av = document.createElement('span'); av.className = 'tnd-row-avatar ' + accentFor(name + rid); av.setAttribute('aria-hidden', 'true'); av.textContent = initials(name);
              var nm = document.createElement('span'); nm.className = 'tnd-user-name'; nm.textContent = name;
              var info = document.createElement('span'); info.className = 'tnd-user'; info.appendChild(nm);   // .tnd-user wrapper = same as the Users list
              if (sub) { var sb = document.createElement('span'); sb.className = 'tnd-user-sub'; sb.textContent = sub; info.appendChild(sb); }
              var wrap = document.createElement('div'); wrap.className = 'tnd-user-cell'; wrap.appendChild(av); wrap.appendChild(info);
              cell.innerHTML = ''; cell.appendChild(wrap);
            }
          }
          // status cell → .tnd-status-pill. Status is read-only in the table (edited in the side pane),
          // so a legacy on/off toggle-switch is replaced by a plain pill reflecting its checked state.
          if (statusIdx >= 0 && tds[statusIdx]) {
            var sc = tds[statusIdx];
            if (!sc.querySelector('.tnd-status-pill')) {
              var tog = sc.querySelector('.toggle-switch input[type="checkbox"], input[name^="toggleSwitch"], input.toggle-switch-checkbox');
              if (tog) {
                sc.innerHTML = listStatusPill(tog.checked ? 'Active' : 'Inactive');
              } else if (!sc.querySelector('input, select, button, a, label, .toggle, [onclick]')) {
                var st = sc.textContent.trim();
                if (st && /^(active|inactive|enabled|disabled|approved|pending|paid|unpaid|completed|open|closed|yes|no|blocked|rejected|trash|trashed|archived)$/i.test(st)) sc.innerHTML = listStatusPill(st);
              }
            }
          }
          // type / role / category cell → quiet .tnd-badge (matches the Users "Type" column)
          if (typeIdx >= 0 && tds[typeIdx]) {
            var tc = tds[typeIdx];
            if (!tc.querySelector('.tnd-badge') && !tc.querySelector('input, select, button, a, label, .tnd-rowmenu, [onclick]')) {
              var tv = tc.textContent.trim();
              if (tv && tv.length <= 28 && /[a-z]/i.test(tv)) { var bd = document.createElement('span'); bd.className = 'tnd-badge'; bd.textContent = tv; tc.innerHTML = ''; tc.appendChild(bd); }
            }
          }
        });
      });
    }

    // ---- 3-dot action flyout for generic rows (matches the Users page) ----
    function enhanceActionCells() {
      $('.tnd-list-generic table.tnd-list-table tbody tr').each(function () {
        var tr = this;
        if (tr.querySelector('.tnd-rowmenu')) return;             // already done
        // the action cell = the last cell that holds edit/delete controls
        var cell = null, tds = tr.querySelectorAll('td');
        for (var i = tds.length - 1; i >= 0; i--) {
          if (tds[i].querySelector('a[href*="/edit/"], [onclick*="delete" i], a.btn, button.btn')) { cell = tds[i]; break; }
        }
        if (!cell) return;
        var actions = cell.querySelectorAll('a, button');
        if (!actions.length) return;
        // pin this column to the right edge so the flyout stays reachable when a wide table scrolls
        cell.classList.add('tnd-c-action');
        var aci = Array.prototype.indexOf.call(tr.children, cell);
        var atbl = tr.closest('table.tnd-list-table');
        var ath = atbl ? atbl.querySelectorAll('thead th')[aci] : null;
        if (ath) ath.classList.add('tnd-c-action');
        var pop = document.createElement('div'); pop.className = 'tnd-rowmenu-pop';
        // OPT-IN: a page can mark a row action `.tnd-rowaction-keep` to keep it visible in the
        // cell next to the ⋮ trigger instead of hiding it in the flyout (a frequent action that
        // shouldn't cost two clicks). Inert unless a page asks for it; the flyout is unchanged.
        var keep = [];
        Array.prototype.forEach.call(actions, function (a) {
          if (a.classList.contains('tnd-rowaction-keep')) { keep.push(a); return; }
          a.classList.add('tnd-rowmenu-item');
          a.classList.remove('btn', 'btn-primary', 'btn-danger', 'btn-info', 'btn-success', 'btn-warning', 'btn-label-left', 'btn-sm', 'btn-lg');
          var oc = (a.getAttribute('onclick') || ''), txt = (a.textContent || '');
          // `unTrashConfirm(…)` contains "trash" but UNDOES the delete, so a bare /trash/ match
          // painted Restore in the destructive red. Require "trash" to start a word.
          if (/delete|remove/i.test(oc) || /(^|[^a-z])trash/i.test(oc) || /delete|remove/i.test(txt) || a.querySelector('.fa-trash, .fa-trash-o, .fa-times, .fa-trash-alt')) a.classList.add('danger');
          // these row buttons are icon-only → give each flyout item a readable text label
          var isItin = !!a.querySelector('.fa-list-ol');
          if (!txt.replace(/\s+/g, '')) {
            var label = a.getAttribute('title') || a.getAttribute('aria-label') || '';
            if (!label) {
              var ico = a.querySelector('i'), ic = ico ? (ico.className || '') : '';
              if (isItin) label = 'Itinerary';
              else if (/fa-pencil|fa-pen\b|fa-edit/.test(ic)) label = 'Edit';
              else if (/fa-trash|fa-trash-o|fa-trash-alt/.test(ic)) label = 'Delete';
              else if (/fa-rotate-left|fa-undo|fa-reply|fa-arrow-rotate-left/.test(ic)) label = 'Restore';
              else if (/fa-clone|fa-copy|fa-files-o/.test(ic)) label = 'Duplicate';
              else if (/fa-eye/.test(ic)) label = 'View';
              else if (/fa-download/.test(ic)) label = 'Download';
              else if (/fa-print/.test(ic)) label = 'Print';
              else label = 'Action';
            }
            var lbl = document.createElement('span');
            lbl.className = 'tnd-rowmenu-label';
            lbl.textContent = label;
            a.appendChild(lbl);
          }
          // the itinerary action: show the SAME "route" icon used in its datatable column
          if (isItin) {
            var iconHost = a.querySelector('.fa-list-ol').parentNode;
            iconHost.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>';
          }
          pop.appendChild(a);
        });
        svgifyIcons(pop);   // flyout item glyphs (Edit/Delete/View/…) → SVG to match Users
        var wrap = document.createElement('div'); wrap.className = 'tnd-rowmenu';
        var trig = document.createElement('button');
        trig.type = 'button'; trig.className = 'tnd-rowmenu-trigger'; trig.setAttribute('aria-label', 'Actions');
        trig.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>';
        wrap.appendChild(trig); wrap.appendChild(pop);
        cell.innerHTML = '';
        if (keep.length) {
          // the action column is a fixed 56px sticky sliver: let it size to the inline buttons
          cell.classList.add('tnd-has-inline');
          if (ath) ath.classList.add('tnd-has-inline');
          keep.forEach(function (k) {
            k.classList.remove('btn', 'btn-primary', 'btn-danger', 'btn-info', 'btn-success', 'btn-warning', 'btn-label-left', 'btn-sm', 'btn-lg');
            k.classList.add('tnd-rowaction-inline');
            cell.appendChild(k);
          });
          svgifyIcons(cell);
        }
        if (pop.children.length) cell.appendChild(wrap);   // no ⋮ when every action stayed inline
      });
    }

    // open/close the flyout (position:fixed so it escapes the table's overflow clip). While open we
    // lift the Action cell above its sticky siblings (.tnd-rowmenu-cell-open), otherwise the next
    // row's pinned cell, which has its own z-index/stacking context, paints over the pop.
    function tndCloseFlyouts() {
      $('.tnd-rowmenu').removeClass('is-open');
      $('.tnd-c-action.tnd-rowmenu-cell-open').removeClass('tnd-rowmenu-cell-open');
    }
    $(document).on('click.tndList', '.tnd-list-generic .tnd-rowmenu-trigger', function (e) {
      e.stopPropagation();
      var menu = $(this).closest('.tnd-rowmenu');
      var willOpen = !menu.hasClass('is-open');
      tndCloseFlyouts();
      if (willOpen) {
        menu.addClass('is-open');
        menu.closest('.tnd-c-action').addClass('tnd-rowmenu-cell-open');
        var pop = menu.find('.tnd-rowmenu-pop'), r = this.getBoundingClientRect();
        var pw = pop.outerWidth() || 170, ph = pop.outerHeight() || 90;
        var top = r.bottom + 4;
        if (top + ph > window.innerHeight - 8) top = r.top - ph - 4;
        pop.css({ left: Math.max(8, r.right - pw) + 'px', top: top + 'px' });
      }
    });
    $(document).on('click.tndList', '.tnd-rowmenu-item', function () { tndCloseFlyouts(); });
    $(document).on('click.tndList', function (e) { if (!$(e.target).closest('.tnd-rowmenu').length) tndCloseFlyouts(); });
    $(document).on('scroll.tndList', '.tnd-table-scroll', function () { tndCloseFlyouts(); });

    // ---- FA → SVG icon swap: match the Users page's stroked-SVG icon set on generic pages ----
    var TND_ICONS = {
      'plus':        ['2.4', '<path d="M12 5v14M5 12h14"/>'],
      'trash':       ['1.9', '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/>'],
      'pencil':      ['1.9', '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'],
      'download':    ['1.9', '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'],
      'upload':      ['1.9', '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>'],
      'eye':         ['1.9', '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>'],
      'print':       ['1.8', '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/>'],
      'clone':       ['1.8', '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'],
      'arrow-left':  ['2',   '<path d="M19 12H5M12 19l-7-7 7-7"/>'],
      'file':        ['1.8', '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>'],
      'id-card':     ['1.8', '<rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8.5" cy="10.5" r="2"/><path d="M5.5 16c.5-1.7 1.6-2.5 3-2.5s2.5.8 3 2.5"/><path d="M15 9h4M15 13h4"/>'],
      'object-group':['1.8', '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'],
      'users':       ['1.9', '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'],
      'check':       ['2.4', '<path d="M20 6 9 17l-5-5"/>'],
      'times':       ['2',   '<path d="M18 6 6 18M6 6l12 12"/>']
    };
    var TND_ICON_ALIAS = { 'pen':'pencil','pencil-alt':'pencil','edit':'pencil','trash-o':'trash','trash-alt':'trash','copy':'clone','files-o':'clone','cloud-download':'download','cloud-upload':'upload','arrow-circle-left':'arrow-left','chevron-left':'arrow-left','file-o':'file','file-text':'file','file-text-o':'file','file-pdf':'file','file-pdf-o':'file','id-card-o':'id-card','close':'times','remove':'times' };
    function tndFaToSvg(cls) {
      var key = '';
      (cls || '').split(/\s+/).forEach(function (c) { if (/^fa-/.test(c) && !/^fa-(solid|regular|brands|light|thin)$/.test(c) && !key) key = c.slice(3); });
      if (TND_ICON_ALIAS[key]) key = TND_ICON_ALIAS[key];
      var def = TND_ICONS[key];
      return def ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + def[0] + '" stroke-linecap="round" stroke-linejoin="round">' + def[1] + '</svg>' : null;
    }
    function svgifyIcons(root) {
      if (!root) return;
      $(root).find('i[class*="fa-"]').each(function () {
        var svg = tndFaToSvg(this.className); if (!svg) return;
        var holder = document.createElement('span'); holder.innerHTML = svg;
        this.parentNode.replaceChild(holder.firstChild, this);
      });
    }
    // swap Font Awesome glyphs in the page-head action buttons (custom extra_actions) to SVG
    function svgifyHeaderButtons() { svgifyIcons(document.querySelector('.tnd-list-generic .tnd-page-head .btnContainer')); }
    // empty-state in the table body when a generic search/filter returns no rows (matches Users)
    function genericEmptyState() {
      $('.tnd-list-generic td.dataTables_empty').each(function () {
        if (this.querySelector('.tnd-empty')) return;
        var $tbl = $(this).closest('table');
        var n = $tbl.find('thead th').length; if (n) this.setAttribute('colspan', n);
        // per-table copy: data-empty-title / data-empty-sub override the generic wording. An
        // explicit empty data-empty-sub="" drops the sub-line for a gentler one-line notice.
        var title = $tbl.attr('data-empty-title') || 'No results found';
        var sub = $tbl.attr('data-empty-sub');
        if (typeof sub === 'undefined') sub = 'Try a different search or clear the filter.';
        var subHtml = sub ? '<span class="tnd-empty-sub">' + sub + '</span>' : '';
        this.innerHTML = '<div class="tnd-empty"><span class="tnd-empty-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></span><span class="tnd-empty-title">' + title + '</span>' + subHtml + '</div>';
      });
    }

    // wrap the scroll body in a rounded clip layer (mockup `.pay-tablewrap > .pay-scroll`) so the
    // sticky-header table's native scrollbar can't square off the rounded corner, matches Users.
    function clipWrapTable() {
      $('.tnd-list-generic .tnd-table-scroll').each(function () {
        if (this.parentNode && this.parentNode.classList.contains('tnd-table-clip')) return;
        var clip = document.createElement('div'); clip.className = 'tnd-table-clip';
        this.parentNode.insertBefore(clip, this); clip.appendChild(this);
      });
    }

    // Wrap long plain-text cells in a fixed-width box that clamps to 2 lines. Without this a long
    // multi-word value (e.g. a status string) collapses to its longest word when a wide table
    // overflows and stacks into 5–6 lines. Runs AFTER the column-tagging enhancers so the
    // skip-classes below already exist. Special columns (name/status/type/notes/phone/action) and
    // cells that hold their own elements (badges, links, inputs) are left untouched.
    function wrapTextCells() {
      $('.tnd-list-generic table.tnd-list-table tbody tr').each(function () {
        var tds = this.children;
        for (var i = 1; i < tds.length; i++) {                 // skip the checkbox column (0)
          var td = tds[i];
          if (!td.classList || td.querySelector('.tnd-cellwrap')) continue;
          var isClip = td.classList.contains('tnd-clip');
          if (!isClip) {
            if (td.classList.contains('tnd-c-name') || td.classList.contains('tnd-c-status') ||
                td.classList.contains('tnd-c-type') || td.classList.contains('tnd-c-action') ||
                td.classList.contains('tnd-c-notes') || td.classList.contains('tnd-c-phone')) continue;
            if (td.children.length > 0) continue;              // holds a badge/link/input → leave alone
            if ((td.textContent || '').trim().length < 16) continue;   // short enough already
          }
          if (!(td.textContent || '').trim()) continue;
          var w = document.createElement('span'); w.className = 'tnd-cellwrap';
          while (td.firstChild) w.appendChild(td.firstChild);
          td.appendChild(w);
        }
      });
    }

    // run the enhancers after each DataTables draw (events bubble to document) + once on load
    $(document).off('draw.dt.tndList').on('draw.dt.tndList', function (e) {
      var tbl = e.target;
      armSearchInputs();          // BEFORE the gates below: live search is for every list, not just the generic ones
      if (!tbl || !tbl.matches || !tbl.matches('table.tnd-list-table')) return;
      // hide the pager when there is only a single page (all reskinned list tables, generic + Users)
      try {
        var api = $(tbl).DataTable(), pi = api.page.info();
        $(tbl).closest('.dataTables_wrapper').find('.dataTables_paginate').toggle(pi.pages > 1);
      } catch (err) {}
      if (tbl.closest('.tnd-list-generic')) { clipWrapTable(); enhanceActionCells(); enhanceRowCells(); enhanceNoteCells(); wrapTextCells(); enhanceListSelects(); consolidateFilters(); enhanceFilterChips(); relocateActions(); enhanceSearchHint(); hideSingleBranchFilters(); markCheckCells(); updateBulkBtn(); genericEmptyState(); svgifyHeaderButtons(); }
    });
    // unconditional (runs on every page incl. the bespoke Users page), covers Users' filter row
    setTimeout(function () { clipWrapTable(); enhanceActionCells(); enhanceRowCells(); enhanceNoteCells(); wrapTextCells(); enhanceListSelects(); consolidateFilters(); enhanceFilterChips(); relocateActions(); enhanceSearchHint(); hideSingleBranchFilters(); markCheckCells(); updateBulkBtn(); genericEmptyState(); svgifyHeaderButtons(); armSearchInputs(); }, 700);

    /* A BESPOKE FILTER ROW ARRIVES WHEN THE SPA SAYS SO, NOT 700ms AFTER DOM READY.
       The timeout above is the ONLY pass that reaches a page which is not `.tnd-list-generic`:
       those have no DataTables draw on a `.tnd-list-table` to hook, so nothing else ever sweeps
       them. And the shell loads first while the fragment is fetched after it, so whether the row
       is in the DOM when that timer fires is a race against the network. It won on beta and lost
       on the app line, where the Users role and branch filters stayed raw browser selects: the
       same build behaving differently on two environments, which is the worst way for this to
       fail because testing one of them proves nothing about the other.

       Watch for the row instead of guessing at it. The observer is deliberately cheap in the
       steady state: it debounces, then does one querySelectorAll and returns without touching the
       DOM unless there is an unenhanced select to deal with, so the enhancement it performs
       cannot feed itself back into a loop. */
    (function watchForLateFilterRows() {
      var host = document.getElementById('ajax-content') || document.body;
      if (!window.MutationObserver || !host) return;
      var pending = null;
      function sweep() {
        pending = null;
        var sels = document.querySelectorAll('.tnd-filter-row select');
        for (var i = 0; i < sels.length; i++) {
          var s = sels[i];
          if (!s.__tndRoot && !s.multiple && !s.classList.contains('no-tnd')) {
            $('.tnd-filter-row').each(function () { enhanceSelects(this); });
            return;
          }
        }
      }
      new MutationObserver(function () {
        if (pending) return;
        pending = setTimeout(sweep, 60);
      }).observe(host, { childList: true, subtree: true });
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
