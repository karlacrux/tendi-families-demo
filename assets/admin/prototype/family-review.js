/* ---------------------------------------------------------------------------
   PROTOTYPE: the child inside the family (design review 11/18, section 7).

   Decorates the app's child panel (#tndDrawer) without changing its code:
     7.1  a breadcrumb back to the family when the child was opened from it, and the
          family's name in bold under the child's, linking back, wherever it was opened;
          no Family tab (the family is in one place only).
     7.2  no Enrollment tab: "Change registration" opens the registration as a wizard,
          each step showing the tab its answers belong to. Nothing is stored twice.
     7.3  a Forms and immunizations tab (read from the Vaccines and forms data in PHP).
     6.2  on Tuition, who pays for this child: the family's payer unless overridden.
   Sample data only; nothing is saved anywhere.
--------------------------------------------------------------------------- */
(function () {
  'use strict';

  var CHEV = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var FR = function () { return window.famReview; };
  var toast = function (m, bad) { if (window.tndToast) window.tndToast[bad ? 'error' : 'success'](m); };

  function drawer() { return document.getElementById('tndDrawer'); }
  function childId(d) {
    var tag = d.querySelector('.tnd-pane-view .vB-idtag');
    var m = tag && /#(\d+)/.exec(tag.textContent || '');
    return m ? m[1] : null;
  }
  function childFirst(d) {
    var n = d.querySelector('.tnd-pane-view .vB-name');
    return n ? String(n.textContent || '').trim().split(/\s+/)[0] : 'this child';
  }

  /* ---- 7.1 the way back, and the family's name ---------------------------------------- */
  function decorateHead(d, id, fam) {
    var view = d.querySelector('.tnd-pane-view'), hero = view && view.querySelector('.vB-hero');
    if (!hero) return;
    var from = window.__famFrom && window.__famFrom.child === String(id) ? window.__famFrom : null;
    if (!view.querySelector('.fr-crumbs') && from && fam) {
      hero.insertAdjacentHTML('beforebegin', '<nav class="fr-crumbs" aria-label="Breadcrumb"><a href="javascript:void(0);" class="fr-back">' +
        esc(FR().famName(fam.f)) + '</a>' + CHEV + '<span>' + esc(childFirst(d)) + '</span></nav>');
      view.querySelector('.fr-back').addEventListener('click', function () { FR().backTo(fam.f, from.tab, from.scroll); });
    }
    if (!hero.querySelector('.fr-famlink') && fam) {
      var name = hero.querySelector('.vB-name');
      name.insertAdjacentHTML('afterend', '<a href="javascript:void(0);" class="fr-famlink">' + esc(FR().famName(fam.f)) + '</a>');
      hero.querySelector('.fr-famlink').addEventListener('click', function () {
        FR().backTo(fam.f, from ? from.tab : 'children', from ? from.scroll : 0);
      });
    }
  }

  /* ---- 7.3 forms and immunizations ------------------------------------------------------ */
  function formsList(id) {
    var h = +id || 0;
    return [
      { n: 'Immunization record', s: h % 5 === 0 ? 'Overdue' : 'Up to date', exp: h % 5 === 0 ? 'Expired 10/1/2026' : 'Next due 9/1/2027' },
      { n: 'Lunch income eligibility form', s: h % 3 === 0 ? 'Missing' : 'On file', exp: h % 3 === 0 ? '' : 'Expires 6/30/2027' },
      { n: 'Medical form', s: 'On file', exp: 'Expires 1/5/2027' },
      { n: 'Emergency card', s: h % 2 ? 'On file' : 'Expiring soon', exp: h % 2 ? 'Expires 8/31/2027' : 'Expires 12/1/2026' }
    ];
  }
  function formsHtml(id) {
    return '<h3 class="vB-group-label">Forms and immunizations</h3><div class="fr-forms">' + formsList(id).map(function (x) {
        var cls = /Up to date|On file/.test(x.s) ? 'ok' : /soon/.test(x.s) ? 'warn' : 'bad';
        return '<div class="fr-form"><div><b>' + esc(x.n) + '</b><small>' + esc(x.exp || 'Not on file') + '</small></div><span class="fr-st is-' + cls + '">' + esc(x.s) + '</span></div>';
      }).join('') + '</div>' +
      '<p class="fam-panel-note">The same data as Vaccines and forms, read from it: no second copy. The documents page stays for forms handled by classroom.</p>';
  }
  function addFormsTab(d, id) {
    var view = d.querySelector('.tnd-pane-view'), strip = view && view.querySelector(':scope > .tnd-tabs');
    var had = strip && strip.querySelector('[data-tab="fi"]');
    if (had) { if (strip.lastElementChild !== had) strip.appendChild(had); return; }   // the app reorders its tabs: keep this one last
    if (!strip) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tnd-tab fr-fitab';
    btn.setAttribute('data-tab', 'fi');
    btn.setAttribute('data-tab-name', 'Forms and immunizations');
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="m9 15 2 2 4-4"/></svg> Forms and immunizations';
    strip.appendChild(btn);
    var pane = document.createElement('section');
    pane.className = 'vB-group fr-fipane';
    pane.setAttribute('data-panel', 'fi');
    pane.hidden = true;
    pane.innerHTML = formsHtml(id);
    view.appendChild(pane);
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      showPanel(view, 'fi');
    });
    strip.addEventListener('click', function (e) {
      var t = e.target.closest('.tnd-tab');
      if (t && t !== btn) { pane.hidden = true; btn.classList.remove('is-active'); }
    });
  }
  function showPanel(view, key) {
    view.querySelectorAll(':scope > .vB-group[data-panel]').forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== String(key); });
    view.querySelectorAll(':scope > .tnd-tabs .tnd-tab').forEach(function (t) { t.classList.toggle('is-active', t.getAttribute('data-tab') === String(key)); });
  }

  /* ---- 6.2 who pays for this child -------------------------------------------------------- */
  function addPayer(d, id, fam) {
    var view = d.querySelector('.tnd-pane-view'), tuition = view && view.querySelector(':scope > .vB-group[data-panel="7"]');
    if (!tuition || !fam || tuition.querySelector('.fr-payer')) return;
    var f = fam.f, fp = FR().payerOf(f);
    f.childPayer = f.childPayer || {};
    var cur = f.childPayer[id];
    var box = document.createElement('div');
    box.className = 'fr-payer';
    box.innerHTML = '<label><span>Who pays for ' + esc(childFirst(d)) + '</span><select class="form-control" aria-label="Who pays for this child">' +
      '<option value="">The family’s payer' + (fp ? ' · ' + esc(fp.n) : '') + '</option>' +
      (f.contacts || []).filter(FR().canPay).map(function (c) {
        var i = f.contacts.indexOf(c);
        return '<option value="' + i + '"' + (cur === i ? ' selected' : '') + '>' + esc(c.n + ' · ' + c.t) + '</option>';
      }).join('') + '</select></label><small>Charges are the family’s, with a line per child. A different payer here is the exception.</small>';
    var label = tuition.querySelector('.vB-group-label');
    if (label) label.parentNode.insertBefore(box, label.nextSibling); else tuition.insertBefore(box, tuition.firstChild);
    box.querySelector('select').addEventListener('change', function (e) {
      var v = e.target.value;
      if (v === '') delete f.childPayer[id]; else f.childPayer[id] = +v;
      toast(v === '' ? 'Back to the family’s payer.' : 'Payer for ' + childFirst(d) + ' changed.');
    });
  }

  /* ---- 7.2 registration as a wizard -------------------------------------------------------- */
  var STEPS = [
    { k: 'details', t: 'Child details', panel: '0' },
    { k: 'family', t: 'Family' },
    { k: 'schedule', t: 'Schedule and classroom', panel: '6' },
    { k: 'health', t: 'Health', panel: '2' },
    { k: 'transport', t: 'Transportation', panel: '3' },
    { k: 'tuition', t: 'Tuition and payer', panel: '7' },
    { k: 'emergency', t: 'Emergency contacts' },
    { k: 'forms', t: 'Forms', panel: 'fi' },
    { k: 'review', t: 'Review' }
  ];
  function addRegButton(d, id, fam) {
    var acts = d.querySelector('.tnd-pane-head-actions'), edit = d.querySelector('#tndDrawerEdit');
    if (!acts || !edit || acts.querySelector('.fr-regbtn')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-sm fr-regbtn';
    b.textContent = 'Change registration';
    b.title = 'Label not decided yet: modify enrollment, change registration, update';
    acts.insertBefore(b, edit);
    b.addEventListener('click', function () { openWizard(d, id, fam); });
  }
  function openWizard(d, id, fam) {
    var view = d.querySelector('.tnd-pane-view');
    if (!view) return;
    var at = 0, old = view.querySelector('.fr-wiz'); if (old) old.remove();
    d.classList.add('fr-wizzing');
    var wiz = document.createElement('div');
    wiz.className = 'fr-wiz';
    view.insertBefore(wiz, view.querySelector(':scope > .tnd-tabs'));
    var custom = document.createElement('section');
    custom.className = 'vB-group fr-wizpane';
    custom.setAttribute('data-panel', 'wiz');
    view.appendChild(custom);
    var close = function () {
      wiz.remove(); custom.remove(); d.classList.remove('fr-wizzing');
      showPanel(view, '0');
    };
    var draw = function () {
      var s = STEPS[at];
      wiz.innerHTML = '<div class="fr-wizhead"><b>Registration</b><span>Step ' + (at + 1) + ' of ' + STEPS.length + ' · ' + esc(s.t) + '</span>' +
          '<button type="button" class="fr-wizx" aria-label="Close the registration">×</button></div>' +
        '<ol class="fr-steps">' + STEPS.map(function (x, i) {
          return '<li class="' + (i === at ? 'is-on' : i < at ? 'is-done' : '') + '"><button type="button" data-i="' + i + '">' + esc(x.t) + '</button></li>';
        }).join('') + '</ol>' +
        '<p class="fr-wiznote">Each step shows and edits the same fields as its tab. Nothing is stored twice.</p>' +
        '<div class="fr-wizacts"><button type="button" class="btn-sm fr-wizback"' + (at ? '' : ' disabled') + '>Back</button>' +
          '<button type="button" class="btn-sm primary fr-wiznext">' + (at === STEPS.length - 1 ? 'Finish' : 'Next') + '</button></div>';
      wiz.querySelector('.fr-wizx').textContent = '';
      wiz.querySelector('.fr-wizx').insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>');
      wiz.querySelector('.fr-wizx').addEventListener('click', close);
      wiz.querySelector('.fr-wizback').addEventListener('click', function () { if (at) { at--; draw(); } });
      wiz.querySelector('.fr-wiznext').addEventListener('click', function () {
        if (at === STEPS.length - 1) { close(); toast('Registration saved to the child’s tabs.'); return; }
        at++; draw();
      });
      wiz.querySelectorAll('[data-i]').forEach(function (b) { b.addEventListener('click', function () { at = +b.getAttribute('data-i'); draw(); }); });
      if (s.panel) { showPanel(view, s.panel); custom.hidden = true; return; }
      custom.innerHTML = stepHtml(s.k, d, id, fam);
      showPanel(view, 'wiz');
    };
    draw();
  }
  function stepHtml(k, d, id, fam) {
    var f = fam && fam.f;
    if (k === 'family') {
      return '<h3 class="vB-group-label">Family</h3>' + (f
        ? '<p class="fr-wiztext"><b>' + esc(FR().famName(f)) + '</b><br>Primary contact: ' + esc((FR().primaryOf(f) || {}).n || 'not set') + '</p>' +
          '<p class="fam-panel-note">Pick another family on file, or create a new one, when registering a new child.</p>'
        : '<p class="fr-wiztext">Not linked to a family yet. Pick a family on file or create a new one.</p>');
    }
    if (k === 'emergency') {
      var em = f ? FR().emergOf(f) : [];
      return '<h3 class="vB-group-label">Emergency contacts</h3>' + (em.length
        ? '<ol class="fr-emlist">' + em.map(function (e) { return '<li>' + esc(e.n) + ' · ' + esc(e.t) + ' · ' + esc(e.p) + '</li>'; }).join('') + '</ol>' +
          '<p class="fam-panel-note">The family’s list. Enrollment can go ahead.</p>'
        : '<p class="fr-wizwarn">The family has no emergency contact yet. Enrollment is blocked until one is added on the family’s Emergency contacts tab.</p>');
    }
    if (k === 'review') {
      return '<h3 class="vB-group-label">Review</h3><p class="fr-wiztext">' + esc(childFirst(d)) + '’s answers go into Details, Schedule, Health, Transportation and Tuition. ' +
        'Finish saves them there.</p><p class="fam-panel-note">In Tendi the child’s record is saved by the existing system, with its rules for dates, archive and audit.</p>';
    }
    return '';
  }

  /* ---- run on every child panel ---------------------------------------------------------- */
  function apply() {
    var d = drawer();
    if (!d || !d.querySelector('.tnd-pane-view .vB-hero')) return;
    var id = childId(d);
    if (!id || !FR()) return;
    var fam = FR().familyOfChild(id);
    decorateHead(d, id, fam);
    addFormsTab(d, id);
    addPayer(d, id, fam);
    if (d.classList.contains('is-readonly')) addRegButton(d, id, fam);
  }
  var t = null;
  new MutationObserver(function () { clearTimeout(t); t = setTimeout(apply, 80); })
    .observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
})();
