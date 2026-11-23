/* ---------------------------------------------------------------------------
   PROTOTYPE: the child inside the family (design review 11/18, section 7).

   Decorates the app's child panel (#tndDrawer) without changing its code:
     7.1  a breadcrumb back to the family when the child was opened from it, and the
          family's name in bold under the child's, linking back, wherever it was opened;
          no Family tab (the family is in one place only).
     7.2  no Enrollment tab: "Change registration" opens the registration as a wizard,
          each step showing the tab its answers belong to. Nothing is stored twice.
     7.3  a Forms and immunizations tab (read from the Vaccines and forms data in PHP).
     5.2  on Health, the child's doctor is the family's Doctor contact (one Doctor type).
     6.2  on Tuition, who pays for this child: the family's payer unless overridden.
     5.1  a Pick-up tab: who may pick up this child, always or for a date range. A separate
          permission from Emergency contact. View reads; Edit adds family contacts, and Save keeps it.
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
  /* The child panel has two panes, View and Edit, each with its own tab strip. Our tabs go in both,
     so the two always show the same tabs: View reads, Edit changes, and Save keeps the changes. */
  function panes(d) { return [d.querySelector('.tnd-pane-view'), d.querySelector('.tnd-pane-edit')].filter(Boolean); }
  function isEditPane(p) { return p.classList.contains('tnd-pane-edit'); }
  // Add a tab and its panel to one pane, once. `before` keeps it ahead of another of our tabs, since
  // the app reorders its tabs.
  function addTab(pane, key, label, icon, cls, before) {
    var strip = pane.querySelector(':scope > .tnd-tabs');
    if (!strip) return null;
    var had = strip.querySelector('[data-tab="' + key + '"]');
    var nextTo = before ? strip.querySelector('[data-tab="' + before + '"]') : null;
    if (had) {
      if (nextTo) { if (had.nextElementSibling !== nextTo) strip.insertBefore(had, nextTo); }
      else if (strip.lastElementChild !== had) strip.appendChild(had);
      return null;
    }
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tnd-tab ' + cls + 'tab';
    btn.setAttribute('data-tab', key);
    btn.setAttribute('data-tab-name', label);
    btn.innerHTML = icon + ' ' + label;
    strip.insertBefore(btn, nextTo || null);
    var sec = document.createElement('section');
    sec.className = 'vB-group ' + cls + 'pane';
    sec.setAttribute('data-panel', key);
    sec.hidden = true;
    pane.appendChild(sec);
    btn.addEventListener('click', function (e) { e.stopPropagation(); showPanel(pane, key); });
    strip.addEventListener('click', function (e) {
      var t = e.target.closest('.tnd-tab');
      if (t && t !== btn) { sec.hidden = true; btn.classList.remove('is-active'); }
    });
    return sec;
  }
  var FI_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="m9 15 2 2 4-4"/></svg>';
  // Forms are read from Vaccines and forms: the same read-only list in View and Edit.
  function addFormsTab(d, id) {
    panes(d).forEach(function (p) {
      var sec = addTab(p, 'fi', 'Forms and immunizations', FI_ICON, 'fr-fi');
      if (sec) sec.innerHTML = formsHtml(id) + (isEditPane(p) ? '<p class="fam-panel-note">Not edited here: forms are updated on Vaccines and forms.</p>' : '');
    });
  }
  function showPanel(view, key) {
    view.querySelectorAll(':scope > .vB-group[data-panel]').forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== String(key); });
    view.querySelectorAll(':scope > .tnd-tabs .tnd-tab').forEach(function (t) { t.classList.toggle('is-active', t.getAttribute('data-tab') === String(key)); });
  }

  /* ---- 5.1 who may pick up this child --------------------------------------------------- */
  var PU_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/></svg>';
  var TRASH = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>';
  // The family's people who can be given the permission: everyone but professionals (doctor, car service).
  function puPeople(f) { return (f.contacts || []).filter(function (c) { return !FR().isPro(c.t); }); }
  // Full access: may pick up, always, by default. Anyone else only when added; in the sample data
  // an aunt, uncle, nanny or family friend may pick up for the school year.
  function puOf(c, id) {
    c.pickup = c.pickup || {};
    if (!c.pickup[id]) {
      var full = FR().accessOf(c) === 'full';
      var dated = !full && /^(aunt|uncle|nanny|babysitter|family friend)$/i.test(c.t || '');
      c.pickup[id] = full ? { on: true, always: true, from: '', to: '' }
        : dated ? { on: true, always: false, from: '2026-09-01', to: '2027-06-30' }
        : { on: false, always: true, from: '', to: '' };
    }
    return c.pickup[id];
  }
  var usDate = function (v) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? (+m[2]) + '/' + (+m[3]) + '/' + m[1] : ''; };
  function puWhen(p) {
    if (p.always) return 'Always';
    if (p.from && p.to) return usDate(p.from) + ' to ' + usDate(p.to);
    if (p.from) return 'From ' + usDate(p.from);
    if (p.to) return 'Until ' + usDate(p.to);
    return 'Dates not set';
  }
  function puTitle(d, edit) {
    return '<h3 class="vB-group-label">Who may pick up ' + esc(childFirst(d)) + FR().info(edit
      ? 'Add people from the family’s contacts. Always is on by default; untick it to give a date range. Save keeps the changes.'
      : 'A separate permission from Emergency contact: being called in an emergency does not let someone collect ' + childFirst(d) + '.') + '</h3>';
  }
  function who(c) { return '<div class="fr-puwho"><b>' + esc(c.n) + '</b><small>' + esc(c.t || 'Contact') + (c.emerg ? ' · Emergency contact' : '') + '</small></div>'; }
  // View: who may pick up, and when. Nothing to change here.
  function puViewHtml(d, id, f) {
    var on = puPeople(f).filter(function (c) { return puOf(c, id).on; });
    return puTitle(d, false) + (on.length
      ? '<div class="fr-pulist">' + on.map(function (c) {
          var p = puOf(c, id);
          return '<div class="fr-pu is-on">' + who(c) + '<span class="fr-puwhen' + (p.always ? '' : ' is-dated') + '">' + esc(puWhen(p)) + '</span></div>';
        }).join('') + '</div>'
      : '<p class="fr-wiztext">No one may pick up ' + esc(childFirst(d)) + ' yet. Use Edit to add someone from the family’s contacts.</p>');
  }
  // Edit: the same people, with Always or a date range, a way to remove them, and a way to add
  // another family contact. Works on a draft; Save keeps it.
  function puEditHtml(d, id, f, draft) {
    var people = puPeople(f);
    var on = people.filter(function (c) { var p = draft[f.contacts.indexOf(c)]; return p && p.on; });
    var off = people.filter(function (c) { return on.indexOf(c) < 0; });
    return puTitle(d, true) +
      (on.length ? '<div class="fr-pulist">' + on.map(function (c) {
        var i = f.contacts.indexOf(c), p = draft[i];
        return '<div class="fr-pu is-on" data-ci="' + i + '">' + who(c) +
          '<label class="fr-pualways"><input type="checkbox" data-pu="always"' + (p.always ? ' checked' : '') + '> Always</label>' +
          '<div class="fr-pudates"' + (p.always ? ' hidden' : '') + '>' +
            '<label><span>From</span><input type="date" class="form-control" data-pu="from" value="' + esc(p.from) + '"></label>' +
            '<label><span>To</span><input type="date" class="form-control" data-pu="to" value="' + esc(p.to) + '"></label></div>' +
          '<button type="button" class="fr-pudel" aria-label="Remove ' + esc(c.n) + ' from pick-up" title="Remove">' + TRASH + '</button>' +
        '</div>';
      }).join('') + '</div>' : '<p class="fr-wiztext">No one may pick up ' + esc(childFirst(d)) + ' yet.</p>') +
      (off.length ? '<select class="form-control fr-puadd" aria-label="Add a family contact who may pick up"><option value="">Add a family contact…</option>' +
          off.map(function (c) { return '<option value="' + f.contacts.indexOf(c) + '">' + esc(c.n + ' · ' + (c.t || 'Contact')) + '</option>'; }).join('') + '</select>' : '') +
      '<p class="fam-panel-note">Only the family’s contacts are listed. To add someone new, add them on the family’s Contacts tab first.</p>';
  }
  function puDraft(id, f) {
    var dr = {};
    puPeople(f).forEach(function (c) { dr[f.contacts.indexOf(c)] = JSON.parse(JSON.stringify(puOf(c, id))); });
    return dr;
  }
  function drawPuEdit(sec, d, id, f) {
    var draft = sec._draft;
    sec.innerHTML = puEditHtml(d, id, f, draft);
    var redraw = function () { drawPuEdit(sec, d, id, f); };
    sec.querySelectorAll('.fr-pu').forEach(function (row) {
      var p = draft[+row.getAttribute('data-ci')];
      row.querySelector('[data-pu="always"]').addEventListener('change', function (e) { p.always = e.target.checked; redraw(); });
      row.querySelectorAll('[data-pu="from"], [data-pu="to"]').forEach(function (inp) {
        inp.addEventListener('change', function () {
          var k = inp.getAttribute('data-pu');
          if (k === 'to' && inp.value && p.from && inp.value < p.from) { toast('The end date is before the start date.', true); inp.value = p.to; return; }
          if (k === 'from' && inp.value && p.to && inp.value > p.to) { toast('The start date is after the end date.', true); inp.value = p.from; return; }
          p[k] = inp.value;
        });
      });
      row.querySelector('.fr-pudel').addEventListener('click', function () { p.on = false; redraw(); });
    });
    var add = sec.querySelector('.fr-puadd');
    if (add) add.addEventListener('change', function () {
      if (add.value === '') return;
      Object.assign(draft[+add.value], { on: true, always: true });
      redraw();
    });
  }
  function addPickupTab(d, id, fam) {
    if (!fam) return;
    var f = fam.f;
    panes(d).forEach(function (p) {
      var edit = isEditPane(p), sec = addTab(p, 'pu', 'Pick-up', PU_ICON, 'fr-pu', 'fi');
      if (!sec) return;
      if (edit) { sec._draft = puDraft(id, f); drawPuEdit(sec, d, id, f); }
      else sec.innerHTML = puViewHtml(d, id, f);
    });
  }

  /* ---- 5.2 the child's doctor is the family's Doctor contact ------------------------------ */
  // The registration (Health) shows the family's Doctor: the same record as on the family's Contacts
  // tab, not three boxes of text. View and Edit show it the same way; it is changed on the family.
  function doctorsOf(f) { return (f.contacts || []).filter(function (c) { return /^doctor$/i.test(c.t || ''); }); }
  function docAddr(c) {
    var a = (c.addrs || []).filter(function (x) { return !x.off && x.value; })[0];
    return a ? a.value : (c.addr || '');
  }
  function doctorHtml(f, d) {
    var docs = doctorsOf(f);
    var info = window.famInfo ? window.famInfo('The family’s doctor, from the family’s Contacts. To change it, edit the family.') : '';
    return '<div class="fr-dochead"><span>Doctor' + info + '</span><a href="javascript:void(0);" class="fr-docgo">Family contacts</a></div>' +
      (docs.length ? docs.map(function (c) {
        var ph = FR().phoneOf(c, f), ad = docAddr(c);
        return '<div class="fr-doc"><b>' + esc(c.n) + '</b>' + (ph ? '<span>' + esc(ph) + '</span>' : '') + (ad ? '<span>' + esc(String(ad).replace(/,?\s*USA$/i, '')) + '</span>' : '') + '</div>';
      }).join('') : '<p class="fr-docnone">No doctor on file. Add one on the family’s Contacts tab, with the relationship Doctor.</p>');
  }
  function addDoctor(d, id, fam) {
    if (!fam) return;
    var f = fam.f;
    panes(d).forEach(function (p) {
      var health = p.querySelector(':scope > .vB-group[data-panel="2"]');
      if (!health) return;
      var box = health.querySelector('.fr-docbox');
      if (!isEditPane(p)) {
        // The old pediatrician rows give way to the family's Doctor.
        health.querySelectorAll('.vB-row').forEach(function (r) {
          var l = r.querySelector('.vB-row-label');
          if (l && /^pediatrician/i.test(l.textContent.trim())) { r.hidden = true; r.classList.add('fr-oldped'); r.style.display = 'none'; }
        });
        if (box) return;
        var list = health.querySelector('.vB-list') || health;
        box = document.createElement('div');
        box.className = 'vB-row fr-docbox';
        box.style.order = '201';
        list.appendChild(box);
      } else {
        var old = health.querySelector('.cm-pedi');
        if (old) old.style.display = 'none';     // its old columns still post: they get the Doctor below
        if (box) return;
        box = document.createElement('div');
        box.className = 'fr-docbox fr-docedit';
        if (old) old.parentNode.insertBefore(box, old); else health.appendChild(box);
        // Down-sync: the old columns (and the child form PDF) read the family's Doctor.
        var doc = doctorsOf(f)[0], set = function (n, v) { var e = p.querySelector('[name="' + n + '"]'); if (e) e.value = v; };
        if (doc) { set('reg_pediatrician_name', doc.n); set('reg_pediatrician_phone', FR().phoneOf(doc, f)); set('reg_pediatrician_address', String(docAddr(doc)).replace(/,?\s*USA$/i, '')); }
      }
      box.innerHTML = doctorHtml(f, d);
      box.querySelector('.fr-docgo').addEventListener('click', function () { FR().backTo(f, 'contacts', 0); });
    });
  }

  /* ---- 6.2 who pays for this child -------------------------------------------------------- */
  function payerText(f, id) {
    var cur = (f.childPayer || {})[id], fp = FR().payerOf(f);
    var c = cur != null ? (f.contacts || [])[cur] : null;
    return c ? esc(c.n + ' · ' + c.t) + ' <small>instead of the family’s payer</small>' : 'The family’s payer' + (fp ? ' · ' + esc(fp.n) : '');
  }
  function addPayer(d, id, fam) {
    if (!fam) return;
    var f = fam.f;
    f.childPayer = f.childPayer || {};
    panes(d).forEach(function (p) {
      var tuition = p.querySelector(':scope > .vB-group[data-panel="7"]');
      if (!tuition || tuition.querySelector('.fr-payer')) return;
      var box = document.createElement('div');
      box.className = 'fr-payer';
      var info = window.famInfo ? window.famInfo('Charges are the family’s, with a line per child. A different payer here is the exception.') : '';
      if (!isEditPane(p)) {
        box.innerHTML = '<span class="fr-payerlbl">Who pays for ' + esc(childFirst(d)) + info + '</span><span class="fr-payerval">' + payerText(f, id) + '</span>';
      } else {
        var fp = FR().payerOf(f), cur = f.childPayer[id];
        box.innerHTML = '<label><span>Who pays for ' + esc(childFirst(d)) + info + '</span><select class="form-control" data-fr="payer" aria-label="Who pays for this child">' +
          '<option value="">The family’s payer' + (fp ? ' · ' + esc(fp.n) : '') + '</option>' +
          (f.contacts || []).filter(FR().canPay).map(function (c) {
            var i = f.contacts.indexOf(c);
            return '<option value="' + i + '"' + (cur === i ? ' selected' : '') + '>' + esc(c.n + ' · ' + c.t) + '</option>';
          }).join('') + '</select></label>';
      }
      var label = tuition.querySelector('.vB-group-label');
      if (label) label.parentNode.insertBefore(box, label.nextSibling); else tuition.insertBefore(box, tuition.firstChild);
    });
  }

  /* Edit opens: start from what is saved. Save: keep the pick-up and payer changes, then View shows
     them. Cancel: nothing is kept. */
  function resetEdit(d, id, fam) {
    var ep = d.querySelector('.tnd-pane-edit');
    if (!ep || !fam) return;
    var sec = ep.querySelector(':scope > .fr-pupane');
    if (sec) { sec._draft = puDraft(id, fam.f); drawPuEdit(sec, d, id, fam.f); }
    var sel = ep.querySelector('[data-fr="payer"]');
    if (sel) { var cur = (fam.f.childPayer || {})[id]; sel.value = cur == null ? '' : String(cur); }
  }
  function saveEdit(d, id, fam) {
    var ep = d.querySelector('.tnd-pane-edit'), vp = d.querySelector('.tnd-pane-view');
    if (!ep || !fam) return;
    var f = fam.f, sec = ep.querySelector(':scope > .fr-pupane');
    if (sec && sec._draft) {
      puPeople(f).forEach(function (c) {
        var dr = sec._draft[f.contacts.indexOf(c)];
        if (dr && !dr.always && !dr.from && !dr.to) dr.always = true;   // no dates given: no limit
        if (dr) Object.assign(puOf(c, id), dr);
      });
      var vsec = vp && vp.querySelector(':scope > .fr-pupane');
      if (vsec) vsec.innerHTML = puViewHtml(d, id, f);
    }
    var sel = ep.querySelector('[data-fr="payer"]');
    if (sel) {
      if (sel.value === '') delete f.childPayer[id]; else f.childPayer[id] = +sel.value;
      var val = vp && vp.querySelector('.fr-payer .fr-payerval');
      if (val) val.innerHTML = payerText(f, id);
    }
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#tndDrawerEdit, #tndDrawerSave');
    var d = drawer();
    if (!b || !d || !FR()) return;
    var id = childId(d), fam = id && FR().familyOfChild(id);
    if (!fam) return;
    if (b.id === 'tndDrawerEdit') resetEdit(d, id, fam); else saveEdit(d, id, fam);
  }, true);

  /* ---- 7.2 registration as a wizard -------------------------------------------------------- */
  var STEPS = [
    { k: 'details', t: 'Child details', panel: '0' },
    { k: 'family', t: 'Family' },
    { k: 'schedule', t: 'Schedule and classroom', panel: '6' },
    { k: 'health', t: 'Health', panel: '2' },
    { k: 'transport', t: 'Transportation', panel: '3' },
    { k: 'tuition', t: 'Tuition and payer', panel: '7' },
    { k: 'emergency', t: 'Emergency contacts' },
    { k: 'pickup', t: 'Who may pick up', panel: 'pu' },
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
    addPickupTab(d, id, fam);
    addDoctor(d, id, fam);
    addPayer(d, id, fam);
    if (d.classList.contains('is-readonly')) addRegButton(d, id, fam);
  }
  var t = null;
  new MutationObserver(function () { clearTimeout(t); t = setTimeout(apply, 80); })
    .observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
})();
