/* ---------------------------------------------------------------------------
   PROTOTYPE: the child inside the family (design review 11/18, section 7).

   Decorates the app's child panel (#tndDrawer) without changing its code:
     7.1  a breadcrumb back to the family when the child was opened from it, and the
          family's name in bold under the child's, linking back, wherever it was opened;
          no Family tab (the family is in one place only).
     7.2  no Enrollment tab: it is "Schedule and classroom". An existing child has tabs; a new
          child is added through a wizard whose steps are those same tabs (newChildWizard).
     7.3  a Forms and immunizations tab (read from the Vaccines and forms data in PHP).
     5.2  on Health, the child's doctor is the family's Doctor contact (one Doctor type).
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
      if (!sec) return;
      sec.innerHTML = formsHtml(id) + (isEditPane(p) ? '<p class="fam-panel-note">Not edited here: forms are updated on <a href="javascript:void(0);" class="fr-vfgo">Vaccines and forms</a>.</p>' : '');
      // Vaccines and forms is Tendi's files window for this child (the same one the Children list opens).
      sec.querySelectorAll('.fr-vfgo').forEach(function (a) {
        a.addEventListener('click', function () {
          var el = document.createElement('a'), nm = d.querySelector('.tnd-pane-view .vB-name');
          // The demo is a recorded copy with no files behind it: it says where this goes, like Payments.
          if (window.__TENDI_REPLAY__ || typeof window.upload_file !== 'function') {
            toast('In Tendi this opens Vaccines and forms for ' + (nm ? nm.textContent.trim() : 'this child') + '.');
            return;
          }
          el.setAttribute('data-id', id);
          el.setAttribute('data-name', nm ? nm.textContent.trim() : '');
          window.upload_file(null, el);
          var jq = window.jqView || window.jQuery;
          if (jq && jq.fn && jq.fn.modal) jq('#upload_file').modal('show');
        });
      });
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
      draft[+add.value].on = true;                      // back with the Always or dates they had
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
      var health = p.querySelector('.vB-group[data-panel="2"]');
      if (!health) return;
      var box = health.querySelector('.fr-docbox');
      if (!isEditPane(p)) {
        // The old pediatrician rows give way to the family's Doctor.
        health.querySelectorAll('.vB-row').forEach(function (r) {
          var l = r.querySelector('.vB-row-label');
          if (l && /^pediatrician/i.test(l.textContent.trim())) { if (!r.hidden) r.hidden = true; if (!r.classList.contains('fr-oldped')) r.classList.add('fr-oldped'); if (r.style.display !== 'none') r.style.display = 'none'; }
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
      var tuition = p.querySelector('.vB-group[data-panel="7"]');
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
    var sec = ep.querySelector('.fr-pupane');
    if (sec) { sec._draft = puDraft(id, fam.f); drawPuEdit(sec, d, id, fam.f); }
    var sel = ep.querySelector('[data-fr="payer"]');
    if (sel) { var cur = (fam.f.childPayer || {})[id]; sel.value = cur == null ? '' : String(cur); }
  }
  function saveEdit(d, id, fam) {
    var ep = d.querySelector('.tnd-pane-edit'), vp = d.querySelector('.tnd-pane-view');
    if (!ep || !fam) return;
    var f = fam.f, sec = ep.querySelector('.fr-pupane');
    if (sec && sec._draft) {
      puPeople(f).forEach(function (c) {
        var dr = sec._draft[f.contacts.indexOf(c)];
        if (dr && !dr.always && !dr.from && !dr.to) dr.always = true;   // no dates given: no limit
        if (dr) Object.assign(puOf(c, id), dr);
      });
      var vsec = vp && vp.querySelector('.fr-pupane');
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
    { k: 'tuition', t: 'Tuition', panel: '7' },
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

  /* ---- Edit hides nothing View shows: on Details, the child's address (the family's Home),
     read-only here: it is changed on the family. */
  var RO_LABELS = /^(address|apartment number|city|state|zip code)$/i;
  function addDetailsRo(d) {
    var vp = d.querySelector('.tnd-pane-view'), ep = d.querySelector('.tnd-pane-edit');
    var vsec = vp && vp.querySelector('.vB-group[data-panel="0"]'), esec = ep && ep.querySelector('.vB-group[data-panel="0"]');
    if (!vsec || !esec || esec.querySelector('.fr-detro')) return;
    var rows = Array.prototype.filter.call(vsec.querySelectorAll('.vB-row'), function (r) {
      var l = r.querySelector('.vB-row-label');
      return l && RO_LABELS.test(l.textContent.trim());
    });
    if (!rows.length) return;
    var box = document.createElement('div');
    box.className = 'fr-detro';
    var info = window.famInfo ? window.famInfo('The child\u2019s address is the family\u2019s Home: shown here as it is saved, and changed on the family\u2019s Household tab.') : '';
    box.innerHTML = '<div class="fr-detro-head">Address' + info + '</div><div class="vB-list fr-detro-list"></div>';
    rows.forEach(function (r) { var c = r.cloneNode(true); c.style.order = ''; c.hidden = false; c.style.display = ''; box.querySelector('.fr-detro-list').appendChild(c); });
    var label = esec.querySelector('.vB-group-label');
    if (label) label.parentNode.insertBefore(box, label.nextSibling); else esec.insertBefore(box, esec.firstChild);
  }

  /* ---- Tuition stays as Tendi has it today: the prototype doesn't repeat it. Its fields are kept
     (hidden, still posted in Edit) and a note says so. ------------------------------------------- */
  function tuitionAsToday(d) {
    panes(d).forEach(function (p) {
      var tab = p.querySelector(':scope > .tnd-tabs .tnd-tab[data-tab-name="Tuition"]') ||
        Array.prototype.filter.call(p.querySelectorAll(':scope > .tnd-tabs .tnd-tab'), function (t) { return /^\s*tuition\s*$/i.test(t.textContent); })[0];
      var sec = tab && p.querySelector('.vB-group[data-panel="' + tab.getAttribute('data-tab') + '"]');
      if (!sec) return;
      if (!sec.querySelector(':scope > .fr-today')) {
        sec.insertAdjacentHTML('beforeend', '<p class="fr-today">The same as Tendi today: Tuition will change after Family Module first implementation</p>');
        sec.classList.add('fr-todaysec');
      }
      // Hidden inline, so the app's own styles can't show them again; anything it adds later too.
      Array.prototype.forEach.call(sec.children, function (el) {
        if (!el.classList.contains('vB-group-label') && !el.classList.contains('fr-today')) el.style.setProperty('display', 'none', 'important');
      });
    });
  }

  /* ---- Dates read m/d/yyyy, no leading zeros (03/21/2017 reads 3/21/2017). ------------------------ */
  function plainDates(d) {
    var vp = d.querySelector('.tnd-pane-view');
    if (!vp) return;
    vp.querySelectorAll('.vB-row-value').forEach(function (v) {
      if (v.children.length) return;
      var t = v.textContent, n = t.replace(/\b0?(\d{1,2})\/0?(\d{1,2})\/(\d{4})\b/g, '$1/$2/$3');
      if (n !== t) v.textContent = n;
    });
  }

  /* ---- A child opened inside the family (families-page.js, openChild): a family tab or closing
     the family leaves the child first; the child closing by itself drops the in-family mode. ---- */
  var htmlEl = document.documentElement;
  document.addEventListener('click', function (e) {
    if (!htmlEl.classList.contains('fb-childopen')) return;
    var b = e.target.closest && e.target.closest('.fam-portal [data-ftab], .fam-portal .tnd-pane-close, .fam-portal .tnd-pane-scrim');
    if (!b) return;
    var dr = drawer();
    if (window.TndListDrawer) window.TndListDrawer.close();      // a soft close: unsaved edits hold it
    if (dr && dr.classList.contains('is-open')) { e.stopPropagation(); e.preventDefault(); return; }
    htmlEl.classList.remove('fb-childopen', 'fb-childedit');
  }, true);
  var wasOpen = false;
  setInterval(function () {
    if (!htmlEl.classList.contains('fb-childopen')) { wasOpen = false; return; }
    // Kept on the family's panel as it is now (it may still have been sliding in when the child opened).
    var fp = document.querySelector('.fam-portal .tnd-pane'), bar = document.querySelector('.fam-portal .fam-ftabs');
    if (fp) htmlEl.style.setProperty('--fb-left', Math.round(fp.getBoundingClientRect().left) + 'px');
    if (bar) htmlEl.style.setProperty('--fb-top', Math.round(bar.getBoundingClientRect().bottom) + 'px');
    var dr = drawer(), open = !!(dr && !dr.hidden && dr.classList.contains('is-open'));
    if (open) wasOpen = true;
    else if (wasOpen || Date.now() - (window.__fbOpenAt || 0) > 4000) { htmlEl.classList.remove('fb-childopen', 'fb-childedit'); wasOpen = false; }
    if (!document.querySelector('.fam-portal')) htmlEl.classList.remove('fb-childopen', 'fb-childedit');
    // Edited inside the family: Cancel leaves the child (there is no separate reading page here).
    if (htmlEl.classList.contains('fb-childedit') && dr) {
      if (dr.classList.contains('is-editing')) dr._fbWasEditing = true;
      else if (dr._fbWasEditing && dr.classList.contains('is-readonly')) { dr._fbWasEditing = false; if (window.TndListDrawer) window.TndListDrawer.close(true); }
    }
  }, 250);

  /* ---- 7.2 A NEW CHILD IS ADDED THROUGH A WIZARD. The steps are the child's own tabs, in order:
     each step is that tab's fields (the same fields, nothing copied), then a review with the
     emergency-contacts check. The family's Save adds the child, as before. An existing child has
     tabs, not the wizard. ------------------------------------------------------------------------ */
  var NW_CHECK = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  /* A VERTICAL STEPPER: the steps stay stacked, as the form always looked. The current step is
     open with Back and Continue under it; a finished step is closed with a check and a one-line
     summary, and opens again on a click; a step still to come shows only its title. */
  function newChildWizard() {
    var existing = htmlEl.classList.contains('fb-childedit');   // a saved child, edited inside the family
    if (!htmlEl.classList.contains('fb-child') && !existing) return;
    var form = document.querySelector('#tndDrawer .tnd-pane-edit.fb-fold'), card = form && form.querySelector(':scope > .fb-childcard');
    if (!card) return;
    var secs = Array.prototype.filter.call(card.querySelectorAll(':scope > .fb-sec'), function (x) { return !x.classList.contains('fb-off') && !x.classList.contains('fr-nwreview'); })
      .sort(function (a, b) { return (+a.style.order || 0) - (+b.style.order || 0); });
    if (!secs.length) return;
    // The tab's own name (family-b.js keeps it in data-fb), not the marks added here.
    var label = function (x) {
      var h = x.querySelector(':scope > .vB-group-label');
      if (!h) return '';
      if (h.getAttribute('data-fb')) return h.getAttribute('data-fb').split('|')[0];
      var t = ''; h.childNodes.forEach(function (n) { if (n.nodeType === 3) t += n.textContent; });
      return t.trim();
    };
    // Details and its "Other details" are one step: the Details tab.
    var steps = [];
    secs.forEach(function (x) {
      if (x.classList.contains('fb-other') && steps.length) { steps[0].secs.push(x); return; }
      steps.push({ t: label(x), secs: [x] });
    });
    var rev = card.querySelector(':scope > .fr-nwreview');
    if (!rev) { rev = document.createElement('section'); rev.className = 'vB-group fb-sec fr-nwreview'; rev.style.order = '990'; card.appendChild(rev); }
    steps.push({ t: 'Review', secs: [rev], review: true });
    if (!form.classList.contains('fr-nwiz')) { form.classList.add('fr-nwiz'); form._nwAt = 0; }
    var at = Math.max(0, Math.min(form._nwAt || 0, steps.length - 1));
    var old = card.querySelector(':scope > .fr-nwbar'); if (old) old.remove();   // the horizontal chips, before

    var v = function (n) { var e = form.querySelector('[name="' + n + '"]'); return e ? String(e.value || '').trim() : ''; };
    var wait = form.querySelector('[name="is_waitlist"]'), waiting = !!(wait && wait.checked);
    var summary = function (st) {
      if (st.review) return '';
      if (/^details$/i.test(st.t)) return [[v('fname'), v('lname')].filter(Boolean).join(' '), waiting ? 'On the waiting list' : 'Enrolling now'].filter(Boolean).join(' · ');
      var days = Array.prototype.filter.call(st.secs[0].querySelectorAll('input[type="checkbox"]:checked'), function (c) { return /days/i.test(c.name); }).length;
      return days ? days + (days === 1 ? ' day a week' : ' days a week') : 'Done';
    };
    steps.forEach(function (st, i) {
      var state = i === at ? 'on' : i < at ? 'done' : 'next';
      st.secs.forEach(function (x, k) {
        if (x.getAttribute('data-nw') !== String(i)) x.setAttribute('data-nw', i);
        ['on', 'done', 'next'].forEach(function (c) { var cl = 'fr-nw-' + c; if (x.classList.contains(cl) !== (c === state)) x.classList.toggle(cl); });
        var closed = state !== 'on';
        if (x.classList.contains('fb-closed') !== closed) x.classList.toggle('fb-closed', closed);
        // A closed step shows one title: the Details step's second part stays out of sight.
        var hide = closed && k > 0;
        if ((x.style.display === 'none') !== hide) { if (hide) x.style.setProperty('display', 'none', 'important'); else x.style.removeProperty('display'); }
        if (k > 0) return;
        var h = x.querySelector(':scope > .vB-group-label');
        if (!h) { h = document.createElement('h3'); h.className = 'vB-group-label'; x.insertBefore(h, x.firstChild); }
        if (st.review && h.textContent.indexOf('Review') < 0) h.textContent = 'Review';
        var mark = h.querySelector('.fr-nwmark');
        if (!mark) { mark = document.createElement('span'); mark.className = 'fr-nwmark'; h.insertBefore(mark, h.firstChild); }
        var mk = state === 'done' ? NW_CHECK : String(i + 1);
        if (mark.getAttribute('data-k') !== state + i) { mark.setAttribute('data-k', state + i); mark.innerHTML = mk; }
        var sm = h.querySelector('.fr-nwsum'), text = state === 'done' ? summary(st) : '';
        if (!sm) { sm = document.createElement('small'); sm.className = 'fr-nwsum'; h.appendChild(sm); }
        if (sm.textContent !== text) sm.textContent = text;
      });
    });
    if (at === steps.length - 1) {
      var html = reviewHtml(form, steps.slice(0, -1));
      var body = rev.querySelector('.fr-nwrevbody');
      if (!body) { body = document.createElement('div'); body.className = 'fr-nwrevbody'; rev.appendChild(body); }
      if (body.getAttribute('data-h') !== html) { body.setAttribute('data-h', html); body.innerHTML = html; }
    }
    // Back and Continue sit under the open step.
    var lastSec = steps[at].secs[steps[at].secs.length - 1];
    var nav = card.querySelector(':scope > .fr-nwnav');
    if (!nav) {
      nav = document.createElement('div');
      nav.className = 'fr-nwnav';
      card.appendChild(nav);
      nav.addEventListener('click', function (e) {
        var b = e.target.closest('[data-nwgo]');
        if (b) nwGo(form, (form._nwAt || 0) + +b.getAttribute('data-nwgo'));
        // Saving is the family's own way to add a child (family-b.js): through its Save when it
        // is being edited, else by returning to its Children tab, which saves a named child.
        if (e.target.closest('.fr-nwdone')) {
          // A saved child: the child's own Save.
          if (htmlEl.classList.contains('fb-childedit')) { var own = document.getElementById('tndDrawerSave'); if (own) own.click(); return; }
          var save = document.querySelector('.fam-portal .fam-tsave'), kids = document.querySelector('.fam-portal [data-ftab="children"]');
          (save && save.offsetParent ? save : kids).click();
        }
      });
      // A finished step opens again from its title.
      card.addEventListener('click', function (e) {
        var h = e.target.closest && e.target.closest(htmlEl.classList.contains('fb-childedit') ? '.fr-nw-done > .vB-group-label, .fr-nw-next > .vB-group-label' : '.fr-nw-done > .vB-group-label');
        if (!h) return;
        e.stopPropagation();
        nwGo(form, +h.parentNode.getAttribute('data-nw'));
      }, true);
    }
    var order = String((+lastSec.style.order || 0) + 1);
    if (nav.style.order !== order) nav.style.order = order;
    var last = at === steps.length - 1, navKey = at + '/' + steps.length;
    if (nav.getAttribute('data-k') !== navKey) {
      nav.setAttribute('data-k', navKey);
      nav.innerHTML = (at ? '<button type="button" class="btn-sm" data-nwgo="-1">Back</button>' : '<span></span>') +
        (last ? '<button type="button" class="btn-sm primary fr-nwdone">' + (existing ? 'Save changes' : 'Save child') + '</button>' : '<button type="button" class="btn-sm primary" data-nwgo="1">Continue</button>');
    }
  }
  function nwGo(form, i) {
    // Past the first step only with a first name: the same check Save makes.
    if (i > 0 && (form._nwAt || 0) === 0) {
      var fn = form.querySelector('[name="fname"]');
      if (fn && !fn.value.trim()) { toast('Enter the child’s first name.', true); fn.focus(); return; }
    }
    form._nwAt = Math.max(0, i);
    newChildWizard();
    var open = form.querySelector('.fr-nw-on');
    if (open) open.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  // The last step: everything entered, step by step, under each step's name.
  function reviewHtml(form, steps) {
    var v = function (n) { var e = form.querySelector('[name="' + n + '"]'); return e ? String(e.value || '').trim() : ''; };
    var name = [v('fname'), v('lname')].filter(Boolean).join(' ') || 'The child';
    var wait = form.querySelector('[name="is_waitlist"]'), waiting = !!(wait && wait.checked);
    var clean = function (t) { return String(t || '').replace(/\*/g, '').replace(/\s+/g, ' ').trim(); };
    // A field the form doesn't use now (hidden by the stage or the app) is not reviewed.
    var unused = function (el, stop) {
      for (var e = el; e && e !== stop; e = e.parentElement) {
        if (e.hidden || e.classList.contains('fb-orig') || e.style.display === 'none') return true;
      }
      return false;
    };
    var rowsOf = function (sec) {
      var out = [];
      sec.querySelectorAll('.form-group').forEach(function (g) {
        if (unused(g, sec) || g.querySelector('.form-group')) return;
        var l = g.querySelector('label.control-label') || g.querySelector('label');
        var label = l ? clean(l.textContent) : '';
        var vals = [];
        g.querySelectorAll('input, select, textarea').forEach(function (el) {
          if (unused(el, g) || el.type === 'hidden' || el.type === 'file' || el.type === 'button' || el.type === 'submit') return;
          if (el.type === 'checkbox' || el.type === 'radio') {
            if (!el.checked || el.name === 'is_waitlist') return;
            var lab = el.closest('label') || (el.id && g.querySelector('label[for="' + el.id + '"]'));
            var t = lab ? clean(lab.textContent) : '';
            vals.push(t && t !== label ? t : 'Yes');
            return;
          }
          if (el.tagName === 'SELECT') {
            Array.prototype.forEach.call(el.selectedOptions || [], function (o) {
              var t = clean(o.textContent);
              if (o.value !== '' && !/^-+\s*select\s*-+$/i.test(t)) vals.push(t);
            });
            return;
          }
          var t2 = clean(el.value);
          if (t2) vals.push(t2);
        });
        vals = vals.filter(function (x, k) { return vals.indexOf(x) === k; });
        if (label && vals.length) out.push([label, vals.join(', ')]);
      });
      return out;
    };
    var html = '<div class="fr-nwrevin"><p class="fr-wiztext"><b>' + esc(name) + '</b> · ' + (waiting ? 'On the waiting list' : 'Enrolling now') + '</p>';
    (steps || []).forEach(function (st) {
      var rows = [];
      st.secs.forEach(function (x) { rows = rows.concat(rowsOf(x)); });
      if (!rows.length) return;                         // only what was entered
      html += '<h4 class="fb-esub">' + esc(st.t) + '</h4>' +
        '<dl class="fr-nwrevlist">' + rows.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>';
    });
    return html + '</div>';
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
    addDetailsRo(d);
    tuitionAsToday(d);
    plainDates(d);
    seedChild(d, id, fam);
  }

  /* SEED DATA. Branch, Class, Join Date and Tuition Type are required for a child, and so is a way
     to reach the family, so no child on file in Tendi is without them. The recorded sample children
     were, and showed Tendi's "Still missing" note. Fill them here, the same value every time for the
     same child, in the form and in the view, so the sample reads like real data. */
  var CLASS_NAMES = [];
  fetch('/tendi-families-demo/assets/admin/prototype/children.json').then(function (r) { return r.json(); }).then(function (j) {
    (j.children || []).forEach(function (c) { if (c.cl && CLASS_NAMES.indexOf(c.cl) < 0) CLASS_NAMES.push(c.cl); });
    CLASS_NAMES.sort();
  }).catch(function () {});
  function seedChild(d, id, fam) {
    var form = d.querySelector('#frmAddEditRecord');
    if (!form || !/children\/save\/[1-9]/.test(form.getAttribute('action') || '')) return;
    var q = function (n) { return form.querySelector('[name="' + n + '"]'); };
    var br = q('branches');
    if (!br || !CLASS_NAMES.length) return;
    if (form._frSeeded === id) { seedClass(d, form); return; }
    form._frSeeded = id;
    var n = +id || 1, shown = {};
    var fire = function (el) { if (window.jQuery) window.jQuery(el).trigger('change'); else el.dispatchEvent(new Event('change', { bubbles: true })); };
    var real = function (sel) { return Array.prototype.filter.call(sel.options, function (o) { return o.value !== ''; }); };
    var waiting = !!(q('is_waitlist') && q('is_waitlist').checked);
    if (!waiting && !br.value && real(br).length) {
      var bo = real(br)[n % real(br).length];
      br.value = bo.value; fire(br); shown.Branch = bo.text.trim();
    }
    var sd = q('start_date');
    if (!waiting && sd && !sd.value) {
      var dobEl = q('dob'), dob = dobEl && dobEl._flatpickr && dobEl._flatpickr.selectedDates[0];
      var when = new Date(2025, 8, 2 + (n % 20));
      if (dob && dob > when) when = new Date(dob.getFullYear(), dob.getMonth() + 3, 1);
      if (sd._flatpickr) sd._flatpickr.setDate(when, true); else { sd.value = (when.getMonth() + 1) + '/' + when.getDate() + '/' + when.getFullYear(); fire(sd); }
      shown['Join Date'] = (when.getMonth() + 1) + '/' + when.getDate() + '/' + when.getFullYear();
    }
    var types = form.querySelectorAll('[name="hra_acs"]');
    if (types.length && !form.querySelector('[name="hra_acs"]:checked')) {
      var pick = ['cash', 'hra', 'acs', 'tax_credit'][n % 4], r = form.querySelector('[name="hra_acs"][value="' + pick + '"]') || types[0];
      r.checked = true; fire(r);
      var lab = r.closest('label'); shown['Tuition Type (HRA/ACS)'] = lab ? lab.textContent.trim() : r.value;
    }
    var reach = ['father_phone', 'mother_phone', 'home_phone', 'cell_number', 'number', 'parent_email'].some(function (k) { var e = q(k); return e && e.value.trim(); });
    if (!reach && q('home_phone')) {
      var ph = '';
      (fam && fam.contacts || []).some(function (c) { ph = c.p || ''; return !!ph; });
      q('home_phone').value = ph || '(212) 555-0' + String(100 + n % 900).slice(-3);
      fire(q('home_phone'));
      shown['Home Phone'] = q('home_phone').value;
    }
    // Class: by the child's age, among the classes the sample uses. Its list is filled when a branch
    // is picked, so it is set on the next passes too, until it holds.
    if (!waiting && q('class') && !q('class').value) {
      var dobEl2 = q('dob'), dob2 = dobEl2 && dobEl2._flatpickr && dobEl2._flatpickr.selectedDates[0];
      var months = dob2 ? (new Date().getFullYear() - dob2.getFullYear()) * 12 + new Date().getMonth() - dob2.getMonth() : 30;
      var want = months < 6 ? 'younger babies' : months < 12 ? 'Older babies' : months < 24 ? '18-24' : months < 30 ? "younger 2's" : months < 36 ? "Older 2's" : months < 42 ? "younger 3's" : months < 48 ? "Older 3's" : (n % 2 ? 'Kindergarten Boys' : 'Kindergarten Girls');
      form._frClass = CLASS_NAMES.indexOf(want) > -1 ? want : CLASS_NAMES[n % CLASS_NAMES.length];
      shown.Class = form._frClass;
    }
    form._frShown = shown;
    seedClass(d, form);
    if (window.tndEnrollment && window.tndEnrollment.refresh) setTimeout(function () { window.tndEnrollment.refresh(); }, 700);
  }
  function seedClass(d, form) {
    var cl = form.querySelector('[name="class"]'), want = form._frClass;
    // A few tries only: if something keeps clearing it, stop rather than fight over it.
    if (cl && want && !cl.value && (form._frTries = (form._frTries || 0) + 1) <= 8) {
      var o = Array.prototype.find.call(cl.options, function (x) { return x.text.trim() === want; });
      if (!o) { o = document.createElement('option'); o.value = 'seed-' + want; o.textContent = want; cl.appendChild(o); }
      cl.value = o.value;
      if (window.jQuery) window.jQuery(cl).trigger('change'); else cl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // The view shows what was filled, where it said "Not set".
    var shown = form._frShown || {};
    d.querySelectorAll('.tnd-pane-view .vB-row').forEach(function (row) {
      var l = row.querySelector('.vB-row-label'), v = row.querySelector('.vB-row-value') || row.lastElementChild;
      var key = l && l.textContent.trim();
      if (key && shown[key] && v && /not set/i.test(v.textContent)) v.textContent = shown[key];
    });
  }
  var t = null;
  // At most every 80ms, never starved: a screen that keeps changing still gets its pass.
  new MutationObserver(function () { if (t) return; t = setTimeout(function () { t = null; apply(); newChildWizard(); }, 80); })
    .observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
})();
