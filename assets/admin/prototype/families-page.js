/* ---------------------------------------------------------------------------
   PROTOTYPE — the FAMILIES page, and the nav item that reaches it.
   Local sandbox only, never deployed.

   Closes the first item in "Still pending": `family_id` exists in the design,
   but nothing in the product lets anyone SEE a whole household. This adds

       Children  >  Children
                    Families      <- same level, directly under Children
                    Lunch
                    ...

   and the screen behind it. Two halves, deliberately kept apart:

     1. the nav item, injected into the shell's sub-pane once per page load.
        It is a normal `.ajax-page-link`, so the app's own SPA loader, hash
        sync and active-state highlighting handle it exactly like every other
        page -- no click interception, no fighting devoops.js. The fragment it
        asks for is served by prototype-server.php, which is untracked.

     2. the page, rendered here into the fragment's empty container from
        assets/admin/prototype/families.json.

   It WRITES NOTHING. No form, no save, no request beyond reading the two JSON
   files. The households are DERIVED (surname + address), which is the rule the
   migration uses to PROPOSE families at import -- it is not a stored column,
   and the page says so where it is read.
--------------------------------------------------------------------------- */
(function () {
  'use strict';

  var FAMILIES = null;      // null until the fetch resolves, [] if it failed
  var PEOPLE = [];          // people.json, used only for the "N children" count
  // view: households | people — the Families and Contacts tabs. filter: the
  // Contacts view's group chip.
  var STATE = { q: '', open: null, view: 'households', filter: 'all' };

  /* ---- data -------------------------------------------------------------- */

  function load() {
    if (FAMILIES !== null) return Promise.resolve();
    return fetch('/tendi-families-demo/assets/admin/prototype/families.json')
      .then(function (r) { return r.json(); })
      .then(function (d) { FAMILIES = d.families || []; seedRelationships(); })
      .catch(function () { FAMILIES = []; });
  }

  /* ONE PERSON, SEVERAL RELATIONSHIPS. The relationship belongs to the link, not
     the person: a mother in her own family is an aunt in her sister's. The sample
     households are grouped by surname + address, so they never show this; these
     links add it, reusing the same person (same name and phone). Prototype data only. */
  var SEED = [
    { who: 'Leo Thornley',        from: 'Thornley', to: 'Fenhurst', t: 'Aunt' },
    { who: 'Joel Neve Thornley', from: 'Thornley', to: 'Fenhurst', t: 'Uncle' },
    { who: 'Tara Ryan Corstead',       from: 'Corstead',      to: 'Penmont',     t: 'Aunt' },
    { who: 'Knox Corstead',         from: 'Corstead',      to: 'Penmont',     t: 'Uncle' },
    { who: 'Joy Joel Shelstead', from: 'Shelstead',  to: 'Stonefield',    t: 'Grandmother' },
    { who: 'Neve Penmont',            from: 'Penmont',      to: 'Westmont',     t: 'Babysitter' }
  ];
  function seedRelationships() {
    var byName = function (n) { return (FAMILIES || []).filter(function (f) { return f.n === n; })[0]; };
    SEED.forEach(function (x) {
      var from = byName(x.from), to = byName(x.to);
      if (!from || !to) return;
      var c = (from.contacts || []).filter(function (k) { return k.n === x.who; })[0];
      if (!c || (to.contacts || []).some(function (k) { return k.n === x.who; })) return;
      to.contacts = (to.contacts || []).concat([{ n: c.n, p: c.p, e: c.e, t: x.t, on: false }]);
    });
  }

  fetch('/tendi-families-demo/assets/admin/prototype/people.json')
    .then(function (r) { return r.json(); })
    .then(function (d) { PEOPLE = d.people || []; })
    .catch(function () { PEOPLE = []; });

  // How many children name this person. Only answerable for the professionals,
  // which is the point: "Dr. Lane, one record, 259 children" is the argument
  // for linking rather than retyping.
  function shared(name) {
    for (var i = 0; i < PEOPLE.length; i++) {
      if (PEOPLE[i].n === name) return PEOPLE[i].c || 0;
    }
    return 0;
  }

  /* ---- small helpers ----------------------------------------------------- */

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function kids(f) {
    return String(f.k || '').split(',').map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; });
  }

  function initials(name) {
    var p = String(name).replace(/^Dr\.?\s*/i, '').trim().split(/\s+/);
    return ((p[0] || '')[0] || '?').toUpperCase() + ((p[1] || '')[0] || '').toUpperCase();
  }

  // Colour from the name, off the product's accent ramp (the -deep steps, which
  // are the ones rated safe under white text). Same surname, same colour, every
  // time: an avatar that changes colour between two renders is noise.
  var RAMP = ['#6b54a3', '#74539f', '#9c4f80', '#a84d6a', '#8a5a30',
              '#836a2b', '#45805a', '#357f6d', '#3a7686', '#4574b5'];
  function colour(name) {
    var h = 0, s = String(name);
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
    return RAMP[h % RAMP.length];
  }

  var ICON_HOME =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/>' +
    '<path d="M5 9.8V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.8"/><path d="M9.5 21v-6h5v6"/></svg>';
  // Manage Children's own search and clear glyphs, so the two bars match.
  var ICON_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle>' +
    '<path d="m20 20-3.5-3.5"></path></svg>';
  var ICON_CLEAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" ' +
    'stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg>';
  /* ---- the nav item ------------------------------------------------------
     Placed immediately after "Children", at the SAME level: the household is a
     peer of the child, not a screen buried inside one child's form. The shell
     renders the sub-pane once, outside #ajax-content, so this survives SPA
     navigation and only has to be injected once -- the guard makes a repeat
     call from the observer a no-op. */

  function injectNav() {
    var subnav = document.querySelector('.tnd-subnav[data-group="children"]');
    if (!subnav || subnav.querySelector('[data-url="families"]')) return false;

    var a = document.createElement('a');
    a.className = 'tnd-sub-item ajax-page-link';
    a.href = 'families';
    a.setAttribute('data-url', 'families');
    a.innerHTML = '<span class="tnd-sub-bullet"></span><span class="tnd-sub-text">Families</span>';

    var after = subnav.querySelector('.tnd-sub-item[data-url="children"]');
    if (after && after.nextSibling) { subnav.insertBefore(a, after.nextSibling); }
    else if (after) { subnav.appendChild(a); }
    else { subnav.insertBefore(a, subnav.firstChild); }
    return true;
  }

  /* tendi-nav.js highlights the current page from DOMContentLoaded, reading the
     sub-items that exist AT THAT MOMENT. injectNav() above is therefore called
     synchronously, while the document is still loading, so the item is in place
     before that pass runs and the shell highlights it like any other page.

     If it ever lands late -- the sub-pane arriving after ready -- that pass has
     already been and gone, and a cold load on #families would show the page with
     no rail highlight and the pane shut. Put it right directly rather than by
     firing a synthetic hashchange, which devoops.js also listens to and would
     answer by fetching the same fragment a second time. */
  function highlight() {
    if (page() !== 'families') return;
    var item = document.querySelector('.tnd-sub-item[data-url="families"]');
    var rail = document.querySelector('.tnd-rail-item[data-group="children"]');
    var pane = document.getElementById('tndSubpane');
    var title = document.getElementById('tndSubpaneTitle');
    if (!item || !rail || !pane || item.classList.contains('active')) return;

    document.querySelectorAll('.tnd-sub-item.active').forEach(function (a) {
      a.classList.remove('active');
    });
    item.classList.add('active');

    document.querySelectorAll('.tnd-rail-item').forEach(function (r) {
      var on = r === rail;
      r.classList.toggle('active', on);
      r.classList.toggle('open', on);
      if (!r.classList.contains('tnd-rail-nav')) {
        r.setAttribute('aria-expanded', on ? 'true' : 'false');
      }
    });
    document.querySelectorAll('.tnd-subnav').forEach(function (n) {
      n.hidden = n.getAttribute('data-group') !== 'children';
    });
    if (title) { title.textContent = 'Children'; }
    pane.setAttribute('data-open', 'true');
    pane.setAttribute('aria-hidden', 'false');
    document.body.classList.add('tnd-pane-open');
  }

  function page() {
    return (window.location.hash || '').replace(/^#/, '').split('?')[0];
  }

  /* ---- search ------------------------------------------------------------
     Over PEOPLE as well as households, for the same reason decision B3 gives:
     the office knows "the mother is Leo Thornley" or a phone number. The
     surname + address grouping is the migration's rule, not how anyone finds a
     family at the desk. */

  function matches(f, q) {
    if (!q) return true;
    var hay = [f.n, f.a, f.p, f.k].join(' ');
    (f.contacts || []).forEach(function (c) { hay += ' ' + c.n + ' ' + (c.p || ''); });
    return hay.toLowerCase().indexOf(q) !== -1;
  }

  function visible() {
    var q = STATE.q.trim().toLowerCase();
    var out = (FAMILIES || []).filter(function (f) { return matches(f, q); });
    // Largest household first, then by surname. There is no sort control: the
    // search is how a household is found.
    out.sort(function (a, b) { return (b.c - a.c) || a.n.localeCompare(b.n); });
    return out;
  }

  /* ---- the list ---------------------------------------------------------- */

  /* The parents, as the office says them: the household column already carries
     the surname, so a parent whose surname matches it is named by first name
     ("Joel Neve · Leo"), and only one with a different surname is named in
     full. Father first, then mother; the full names and roles are in the title. */
  function parentsOf(f) {
    return (f.contacts || []).filter(function (c) { return /^(mother|father)$/i.test(c.t || ''); })
      .sort(function (a, b) { return /^father$/i.test(a.t) ? -1 : /^father$/i.test(b.t) ? 1 : 0; });
  }
  function parentsCell(f) {
    var ps = parentsOf(f);
    if (!ps.length) return '<span class="fam-parents none">no parent named</span>';
    var sur = String(f.n || '').toLowerCase();
    var shortName = function (c) {
      var parts = String(c.n || '').trim().split(/\s+/);
      var last = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
      return last === sur ? parts.slice(0, -1).join(' ') : c.n;
    };
    var title = ps.map(function (c) { return c.n + ' (' + c.t + ')'; }).join(', ');
    return '<span class="fam-parents" title="' + esc(title) + '">' +
      ps.map(function (c) { return esc(shortName(c)); }).join(' \u00b7 ') + '</span>';
  }

  /* CHILDREN — one column: how many, then up to three first names and "+N".
     It used to be two (the names, and a "Size" that was the same count), which
     read as two different facts. On a narrow screen the names go, the count stays. */
  function kidsCell(f) {
    var k = kids(f), show = k.slice(0, 3), rest = k.length - show.length;
    return '<span class="fam-kids"><i class="fam-kidn" title="' + f.c + (f.c === 1 ? ' child' : ' children') + '">' + f.c + '</i>' +
      '<span class="fam-kidnames">' +
        show.map(function (n) { return '<span class="fam-kid">' + esc(n) + '</span>'; }).join('') +
        (rest > 0 ? '<span class="fam-kid more">+' + rest + '</span>' : '') +
      '</span></span>';
  }

  /* SELECTION — the Children list's own: a checkbox at the start of each row, one
     in the header for the whole view, and the dark bar of bulk actions at the foot
     of the screen. It replaced expanding a row in place: everything that showed is
     in the side panel the row opens. Kept per view, by household index / contact id. */
  var SEL = { households: {}, people: {} };
  function selBox(attr, label, on) {
    return '<span class="fam-sel"><input type="checkbox" class="fam-cb" ' + attr + (on ? ' checked' : '') +
      ' aria-label="Select ' + esc(label) + '"></span>';
  }

  function rowHtml(f, i) {
    var on = !!SEL.households[i];
    return '' +
      // A row is clickable, but not a <button>: it holds the checkbox and the kebab.
      '<div class="fam-row' + (on ? ' is-sel' : '') + '" role="button" tabindex="0" data-fam="' + i + '">' +
        selBox('data-sel="' + i + '"', 'the ' + f.n + ' household', on) +
        '<span class="fam-name">' +
          '<span class="fam-av" style="background:' + colour(f.n) + '">' + esc(String(f.n).charAt(0).toUpperCase()) + '</span>' +
          '<b>' + esc(f.n) + '</b>' +
        '</span>' +
        kidsCell(f) +
        parentsCell(f) +
        // The list shows the main address and phone only; their type is in the panel.
        '<span class="fam-addr">' + (f.a ? '<span class="fam-addr-t">' + esc(f.a) + '</span>' : '<i class="blank">no address</i>') + '</span>' +
        '<span class="fam-phone' + (f.p ? '' : ' none') + '">' + (f.p ? esc(f.p) : 'not on file') + '</span>' +
        '<span class="fam-act"><span class="tnd-rowmenu">' +
          '<button type="button" class="tnd-kebab" aria-label="Actions for the ' + esc(f.n) + ' household" ' +
          'aria-haspopup="true" aria-expanded="false" data-fam="' + i + '">' + ICON_KEBAB + '</button>' +
        '</span></span>' +
      '</div>';
  }

  function ageOf(dob) {
    if (!dob) return '';
    var b = new Date(dob + 'T00:00:00'), n = new Date();
    var m = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth()) - (n.getDate() < b.getDate() ? 1 : 0);
    // Old records carry placeholder birth dates (1900); an age nobody has is not shown.
    if (m < 0 || m > 25 * 12) return '';
    if (m < 24) return m + (m === 1 ? ' mo' : ' mos');
    return Math.floor(m / 12) + ' yrs';
  }

  function badge(c) {
    var lv = permLevel(c);
    var txt = { full: 'Full permission', limited: 'Limited permission', none: 'No permission' }[lv];
    return '<span class="cm-permnote fam-badge' + (lv === 'full' ? '' : ' ' + lv) + '">' + txt + '</span>';
  }

  function emailCell(c, cls) {
    var m = mainOf(c, 'email');
    if (!m) return '<span class="' + cls + ' none">no email</span>';
    return '<span class="' + cls + '" title="' + esc(m.value + ' \u00b7 ' + m.type) + '">' + esc(m.value) + typeTag(m.type) +
      '</span>';
  }
  // A contact's main phone / email / address — the primary one, else the first.
  function mainOf(c, kind, f) {
    var it = listsOf(c, f)[kind];
    return it.filter(function (x) { return x.primary; })[0] || it[0] || null;
  }
  // Every phone, email and address on screen says what kind it is (client review).
  function typeTag(t) { return t ? '<small class="fam-type">' + esc(t) + '</small>' : ''; }
  function phoneCell(c, cls, none) {
    var m = mainOf(c, 'phone');
    return m ? '<span class="' + cls + '">' + esc(m.value) + typeTag(m.type) + '</span>'
             : '<span class="' + cls + ' none">' + none + '</span>';
  }

  // The tables' own row menu (⋮), on every member row too: one way to act on a row.
  function subKebab(attrs, name) {
    return '<span class="tnd-rowmenu"><button type="button" class="tnd-kebab" ' + attrs + ' aria-label="Actions for ' + esc(name) + '" ' +
      'aria-haspopup="true" aria-expanded="false">' + ICON_KEBAB + '</button></span>';
  }

  function renderList(root) {
    if (STATE.view === 'people') { renderPeople(root); paintDock(root); return; }
    var rows = visible();
    var body = root.querySelector('#famRows');
    var count = root.querySelector('#famCount');
    var head = root.querySelector('#famTh');
    if (!body) return;
    if (head) {
      head.className = 'fam-th';
      head.innerHTML = selBox('id="famAll"', 'every household in this view', false) +
        '<span>Household</span><span>Children</span><span>Parents</span><span>Address</span><span>Phone</span><span></span>';
    }
    body.innerHTML = rows.length
      ? rows.map(function (f) { return rowHtml(f, (FAMILIES || []).indexOf(f)); }).join('')
      : '<div class="fam-empty"><b>No household matches that.</b>' +
        'The search reads the surname, the address, the phone, every child’s ' +
        'name and every contact’s name.</div>';

    if (count) {
      count.innerHTML = rows.length === (FAMILIES || []).length
        ? '<b>' + rows.length + '</b> households'
        : '<b>' + rows.length + '</b> of ' + (FAMILIES || []).length + ' households';
    }
    paintDock(root);
  }

  /* The rows in view, as [key, item] pairs of the current view: what the header box
     selects and the dock acts on. */
  function viewItems() {
    return STATE.view === 'people'
      ? peopleVisible().map(function (p) { return [p.id, p]; })
      : visible().map(function (f) { return [String((FAMILIES || []).indexOf(f)), f]; });
  }
  function selected() {
    var sel = SEL[STATE.view];
    return viewItems().filter(function (x) { return sel[x[0]]; }).map(function (x) { return x[1]; });
  }

  var DOCK_ICO = {
    msg: SVG_I('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>'),
    exp: SVG_I('<path d="M12 21V8"></path><path d="m7 13 5-5 5 5"></path><path d="M3 3h18"></path>'),
    arc: SVG_I('<rect x="3" y="4" width="18" height="4" rx="1"></rect><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"></path>'),
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg>'
  };
  function SVG_I(d) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }

  /* The dock: Manage Children's own .tnd-seldock — the count, then what can be done
     to every selected row at once, then × to clear. Households: message the
     families, export them, archive them (only those with no child enrolled or
     waiting). Contacts: message them, export them. Nothing is sent or saved. */
  function paintDock(root) {
    var dock = document.getElementById('famSelDock');
    if (!dock) {
      dock = document.createElement('div');
      dock.className = 'tnd-seldock';
      dock.id = 'famSelDock';
      dock.setAttribute('role', 'region');
      dock.setAttribute('aria-label', 'Bulk actions');
      root.appendChild(dock);
      dock.addEventListener('click', function (e) { dockAct(root, e); });
    }
    var list = selected(), n = list.length, ppl = STATE.view === 'people';
    var all = root.querySelector('#famAll'), items = viewItems();
    if (all) {
      all.checked = n > 0 && n === items.length;
      all.indeterminate = n > 0 && n < items.length;
    }
    dock.classList.toggle('is-on', n > 0);
    if (!n) return;
    var noun = ppl ? (n === 1 ? 'contact' : 'contacts') : (n === 1 ? 'household' : 'households');
    var canArc = ppl ? 0 : list.filter(function (f) { return !activeKids(f).length; }).length;
    dock.innerHTML =
      '<span class="cnt" aria-live="polite"><b>' + n + '</b> ' + noun + ' selected</span>' +
      '<div class="vdiv"></div>' +
      '<button type="button" class="tnd-dockbtn" data-dock="msg">' + DOCK_ICO.msg + 'Send a message</button>' +
      '<button type="button" class="tnd-dockbtn" data-dock="export">' + DOCK_ICO.exp + 'Export</button>' +
      (ppl ? '' : '<button type="button" class="tnd-dockbtn danger" data-dock="archive"' + (canArc ? '' : ' disabled') +
        ' title="' + (canArc ? 'Only households with no child enrolled or waiting' : 'Every selected household has a child enrolled or waiting') + '">' +
        DOCK_ICO.arc + 'Archive' + (canArc ? ' (' + canArc + ')' : '') + '</button>') +
      '<button type="button" class="tnd-dockx" data-dock="clear" aria-label="Clear selection">' + DOCK_ICO.x + '</button>';
  }

  function dockAct(root, e) {
    var b = e.target.closest && e.target.closest('[data-dock]');
    if (!b || b.disabled) return;
    var act = b.getAttribute('data-dock'), list = selected(), ppl = STATE.view === 'people';
    var toast = function (m) { if (window.tndToast) window.tndToast.success(m); };
    if (act === 'clear') { SEL[STATE.view] = {}; renderList(root); return; }
    if (act === 'export') { if (ppl) exportPeople(list); else exportCsv('sel', list); return; }
    if (act === 'msg') {
      toast('Prototype: a message to ' + list.length + (ppl ? (list.length === 1 ? ' contact' : ' contacts')
        : (list.length === 1 ? ' household' : ' households')) + ' would open here. Nothing is sent.');
      return;
    }
    if (act === 'archive') {
      var ok = list.filter(function (f) { return !activeKids(f).length; });
      var msg = 'Archive ' + ok.length + (ok.length === 1 ? ' household' : ' households') + '? ' +
        (ok.length < list.length ? (list.length - ok.length) + ' selected stay: a child in them is enrolled or waiting. ' : '') +
        'Their contacts stay on file.';
      var go = function () {
        FAMILIES = (FAMILIES || []).filter(function (x) { return ok.indexOf(x) === -1; });
        SEL.households = {};
        renderList(root);
        toast('Archived ' + ok.length + (ok.length === 1 ? ' household.' : ' households.'));
      };
      if (window.jConfirm) window.jConfirm(msg, 'Archive households', 'primary', function (y) { if (y) go(); });
      else if (window.confirm(msg)) go();
    }
  }

  /* ---- people (FAM-FAM-6) -------------------------------------------------
     A person is one record however many households and children they are linked
     to. The prototype has no person table, so people are built from the
     households' contacts: a professional by name (the pediatrician 106
     households share), anyone else by name and phone. Editing a person writes to
     every contact that is them, so every household shows the change — which is
     what one family_contacts row behind many contact_links rows does. */
  var PARENT_STANDING = /^(mother|father|step[- ]?mother|step[- ]?father|legal guardian|foster parent)$/i;
  /* RELATIONSHIPS — one list, no categories (owner, 2026-10-02): parents first,
     then family, then everyone else, in the order the office knows. */
  var TYPES = ['Mother', 'Father', 'Step mother', 'Step father', 'Grandmother', 'Grandfather', 'Aunt', 'Uncle',
    'Sibling', 'Legal guardian', 'Foster parent', 'Family friend', 'Babysitter', 'Car service', 'Pediatrician',
    'Other doctor', 'Therapist', 'Caseworker', 'Other'];
  // A business or a practice ("Bright Start", a car service) has one name, not a first and
  // a last, and the same name is the same record. A babysitter or a therapist is a person.
  function isPro(t) { return /^(pediatrician|other doctor|car service)$/i.test(String(t || '')); }
  function permLevel(c) {
    if (c.perm) return c.perm;
    return PARENT_STANDING.test(c.t || '') ? 'full' : 'none';
  }
  function pkey(c) {
    return isPro(c.t) ? 'pro:' + String(c.n || '').trim().toLowerCase()
      : 'p:' + String(c.n || '').trim().toLowerCase() + ':' + String(c.p || '').replace(/\D/g, '');
  }
  function persons() {
    var map = {}, list = [];
    (FAMILIES || []).forEach(function (f) {
      (f.contacts || []).forEach(function (c) {
        var k = pkey(c), p = map[k];
        if (!p) { p = map[k] = { id: k, c: c, links: [] }; list.push(p); }
        p.links.push({ f: f, c: c });
      });
    });
    list.forEach(function (p) {
      var seen = {};
      p.types = p.links.map(function (l) { return l.c.t; }).filter(function (t) { return !seen[t] && (seen[t] = 1); });
      p.kids = p.links.reduce(function (s, l) { return s + (l.f.c || 0); }, 0);
    });
    return list;
  }
  /* FILTER GROUPS — used only by the People filter; choosing a relationship is one
     flat list. Parents includes legal guardians and foster parents: they hold the parent's place. */
  var FILTER_GROUPS = [
    ['Parents', ['Mother', 'Father', 'Legal guardian', 'Foster parent']],
    ['Other family members', ['Step mother', 'Step father', 'Grandmother', 'Grandfather', 'Aunt', 'Uncle', 'Sibling']],
    ['Professionals', ['Babysitter', 'Car service', 'Pediatrician', 'Other doctor', 'Therapist', 'Caseworker']],
    ['Others', ['Family friend', 'Other']]
  ];
  function inFilter(p, g) {
    var grp = FILTER_GROUPS.filter(function (x) { return x[0] === g; })[0];
    var inList = function (t) { return grp[1].some(function (x) { return x.toLowerCase() === String(t).toLowerCase(); }); };
    // A relationship in no list (typed in by an import) counts as Others.
    var known = function (t) { return FILTER_GROUPS.some(function (x) { return x[1].some(function (y) { return y.toLowerCase() === String(t).toLowerCase(); }); }); };
    return !!grp && p.types.some(function (t) { return inList(t) || (g === 'Others' && !known(t)); });
  }
  function personById(id) { return persons().filter(function (p) { return p.id === id; })[0]; }

  function peopleVisible() {
    var q = STATE.q.trim().toLowerCase();
    return persons().filter(function (p) {
      if (STATE.filter !== 'all' && !inFilter(p, STATE.filter)) return false;
      if (!q) return true;
      var ls = listsOf(p.c);
      var hay = [p.c.n, p.c.p, p.c.p2, p.c.e].concat(ls.phone.concat(ls.email).map(function (x) { return x.value; })).concat(p.links.map(function (l) { return l.f.n; })).join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    }).sort(function (a, b) { return (b.links.length - a.links.length) || String(a.c.n).localeCompare(String(b.c.n)); });
  }

  /* The Relationship column: every relationship the person has, once each
     ("Mother, Aunt"). Which family each one belongs to is in the person panel. */
  function relCell(p) {
    return '<span class="fam-rel" title="' + esc(p.types.join(', ')) + '">' + esc(p.types.join(', ')) + '</span>';
  }

  /* HOUSEHOLDS — the way the Households list shows children: how many, then the
     main one by name (where they are a parent, else the first), and "+N" for the
     rest. Every household and the relationship in it is in the title and the panel. */
  function hhCell(p) {
    var main = function (l) { return PARENT_STANDING.test(l.c.t || '') ? 0 : 1; };
    var ls = p.links.slice().sort(function (a, b) { return main(a) - main(b); });
    var rest = ls.length - 1;
    return '<span class="fam-kids fam-hhs" title="' +
        esc(ls.map(function (l) { return l.f.n + ' (' + l.c.t + ')'; }).join(', ')) + '">' +
      '<i class="fam-kidn">' + ls.length + '</i><span class="fam-kidnames">' +
        '<span class="fam-kid">' + esc(ls[0].f.n) + '</span>' +
        (rest > 0 ? '<span class="fam-kid more">+' + rest + '</span>' : '') +
      '</span></span>';
  }

  function personRowHtml(p) {
    var c = p.c, on = !!SEL.people[p.id];
    var ph = mainOf(c, 'phone');
    return '<div class="fam-row fam-row--people' + (on ? ' is-sel' : '') + '" role="button" tabindex="0" data-person="' + esc(p.id) + '">' +
      selBox('data-sel="' + esc(p.id) + '"', c.n, on) +
      '<span class="fam-name"><span class="fam-av fam-av--p ' + acc(c.n) + '">' + esc(initials(c.n)) + '</span><b>' + esc(c.n) + '</b></span>' +
      relCell(p) +
      hhCell(p) +
      '<span class="fam-kids"><i class="fam-kidn">' + p.kids + '</i></span>' +
      '<span class="fam-phone' + (ph ? '' : ' none') + '">' + (ph ? esc(ph.value) : 'not on file') + '</span>' +
      '<span class="fam-act"><span class="tnd-rowmenu">' +
        '<button type="button" class="tnd-kebab" aria-label="Actions for ' + esc(c.n) + '" ' +
        'aria-haspopup="true" aria-expanded="false" data-person="' + esc(p.id) + '">' + ICON_KEBAB + '</button>' +
      '</span></span>' +
    '</div>';
  }

  function renderPeople(root) {
    var all = persons(), rows = peopleVisible();
    var body = root.querySelector('#famRows'), count = root.querySelector('#famCount'), head = root.querySelector('#famTh');
    if (!body) return;
    if (head) {
      head.className = 'fam-th fam-th--people';
      head.innerHTML = selBox('id="famAll"', 'every contact in this view', false) +
        '<span>Name</span><span>Relationship</span><span>Households</span><span>Children</span>' +
        '<span>Phone</span><span></span>';
    }
    var sel = root.querySelector('#famPSel');
    if (sel) {
      var n = function (g) {
        return g === 'all' ? all.length
          : all.filter(function (p) { return inFilter(p, g); }).length;
      };
      var opts = [['all', 'All contacts']].concat(FILTER_GROUPS.map(function (g) { return [g[0], g[0]]; }));
      var cur = opts.filter(function (x) { return x[0] === STATE.filter; })[0] || opts[0];
      sel.querySelector('.lbl').textContent = cur[1];
      sel.classList.toggle('is-set', STATE.filter !== 'all');
      sel.querySelector('.tnd-chl-menu').innerHTML = opts.map(function (x) {
        var on = STATE.filter === x[0];
        return '<button type="button" class="tnd-chl-mi fam-pmi' + (on ? ' is-on' : '') + '" role="option" aria-selected="' + on + '" data-filter="' + x[0] + '">' +
          '<span class="sp">' + x[1] + '</span><span class="fam-pmi-n">' + n(x[0]) + '</span></button>';
      }).join('');
    }
    body.innerHTML = rows.length ? rows.map(personRowHtml).join('')
      : '<div class="fam-empty"><b>Nobody matches that.</b>' +
        'The search reads the name, the phone, the email and the household.</div>';
    if (count) {
      count.innerHTML = rows.length === all.length ? '<b>' + all.length + '</b> contacts'
        : '<b>' + rows.length + '</b> of ' + all.length + ' contacts';
    }
  }

  /* ---- the household drawer ----------------------------------------------
     The CHILD PROFILE drawer's own parts, so a household opens exactly the way a
     child does: the portal and scrim, aside.tnd-pane.tnd-drawer, the pane head with
     its eyebrow and close, the .vB-hero (avatar, name, meta, status pill), and
     .vB-group sections of .vB-list cards holding .vB-row rows — icon tile, small-
     caps label, value, "Not set" in .vB-muted, tappable phone rows with the arrow.
     The icons are the ones that drawer draws. */
  var CHILDREN_ALL = [];
  fetch('/tendi-families-demo/assets/admin/prototype/children.json')
    .then(function (r) { return r.json(); })
    .then(function (d) { CHILDREN_ALL = d.children || []; })
    .catch(function () { CHILDREN_ALL = []; });
  // The households' children who are not enrolled or waiting: they open like any
  // other child (their record is the same record), so they need their ids too.
  var CHILDREN_OFF = [];
  fetch('/tendi-families-demo/assets/admin/prototype/children-inactive.json')
    .then(function (r) { return r.json(); })
    .then(function (d) { CHILDREN_OFF = (d.children || []).map(function (c) { c.s = 'inactive'; c.cl = ''; return c; }); })
    .catch(function () { CHILDREN_OFF = []; });
  function whereOf(c) {
    if (!c || c.s === 'inactive') return 'Not enrolled';
    return c.s === 'waitlist' ? 'Waiting list' : 'Enrolled' + (c.cl ? ' · ' + c.cl : '');
  }

  var SV = function (d, w) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 1.8) +
      '" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  };
  var DI = {
    close: SV('<path d="M18 6 6 18M6 6l12 12"></path>', 2),
    person: SV('<circle cx="12" cy="8" r="4"></circle><path d="M5.5 20a7 7 0 0 1 13 0"></path>'),
    group: SV('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>'),
    phone: SV('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2.1z"></path>'),
    home: SV('<path d="M3 21h18"></path><path d="M5 21V8l7-5 7 5v13"></path><path d="M9 21v-5h6v5"></path>'),
    cta: '<span class="vB-row-cta" aria-hidden="true">' + SV('<path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path>', 2) + '</span>'
  };
  var ACC = ['acc-sky', 'acc-apricot', 'acc-sage', 'acc-rose', 'acc-sun', 'acc-mint', 'acc-coral', 'acc-lavender', 'acc-teal', 'acc-plum'];
  function acc(name) {
    var h = 0;
    String(name || '').split('').forEach(function (ch) { h = (h * 31 + ch.charCodeAt(0)) >>> 0; });
    return ACC[h % ACC.length];
  }

  function vRow(ico, label, value, href) {
    var empty = !value;
    var body = '<span class="vB-row-ico" aria-hidden="true">' + ico + '</span>' +
      '<span class="vB-row-body"><span class="vB-row-label">' + esc(label) + '</span>' +
      '<span class="vB-row-value' + (empty ? ' vB-muted' : '') + '">' + (empty ? 'Not set' : esc(value)) + '</span></span>';
    return (href && !empty)
      ? '<a class="vB-row vB-row--action" href="' + href + '">' + body + DI.cta + '</a>'
      : '<div class="vB-row' + (empty ? ' is-empty' : '') + '">' + body + '</div>';
  }
  var tel = function (v) { return v ? 'tel:' + String(v).replace(/[^\d+]/g, '') : ''; };
  var group = function (label, inner) {
    return '<section class="vB-group"><h3 class="vB-group-label">' + label + '</h3>' + inner + '</section>';
  };

  function closeDrawer() {
    var portal = document.querySelector('.fam-portal');
    if (portal) {
      var pane = portal.querySelector('.tnd-pane'), scrim = portal.querySelector('.tnd-pane-scrim');
      if (pane) pane.classList.remove('is-open');
      if (scrim) scrim.classList.remove('is-open');
      setTimeout(function () { portal.remove(); }, 220);
    }
    document.querySelectorAll('.fam-row.is-open').forEach(function (r) { r.classList.remove('is-open'); });
    STATE.open = null;
  }

  function openDrawer(f) {
    var old = document.querySelector('.fam-portal');
    if (old) old.remove();

    var parents = parentsOf(f);                    // father first, then mother
    var others = (f.contacts || []).filter(function (c) { return parents.indexOf(c) === -1; });
    var kidsOf = kidsOfHousehold(f);
    var names = kids(f);
    var addr = String(f.a || '').replace(/,?\s*USA$/i, '');

    // One row per child: their name, and where they are now — the profile's words.
    var childRows = names.map(function (n) {
      var c = kidsOf.filter(function (x) { return x.f === n; })[0];
      var where = whereOf(c);
      // The name is the value, as on every profile row; where they are is its label.
      return vRow(DI.person, where, n);
    }).join('');

    /* Each person as the child profile shows a parent: the view's own card of
       rows — who they are, what they may do, which children they reach, how to
       reach them. The name row opens the person. Read-only: the Edit at the top
       turns the whole family into its edit form, as every record in Tendi does. */
    var personCard = function (c) {
      var lv = permLevel(c);
      return '<div class="vB-list">' +
        vRow(DI.person, c.t, c.n).replace('<div class="vB-row"', '<a class="vB-row vB-row--action fam-toperson" data-person="' +
          esc(pkey(c)) + '" href="javascript:void(0);"').replace(/<\/div>$/, DI.cta + '</a>') +
        vRow(DI.group, 'What they may do', { full: 'Full permission', limited: 'Limited permission', none: 'No permission' }[lv]) +
        primaryRow(listsOf(c, f).phone, 'phone') +
        primaryRow(listsOf(c, f).email, 'email') +
      '</div>';
    };

    var portal = document.createElement('div');
    portal.className = 'tendi-skin tnd-drawer-portal fam-portal';
    portal.innerHTML =
      '<div class="tnd-pane-scrim tnd-drawer-scrim"></div>' +
      '<aside class="tnd-pane tnd-drawer is-readonly" role="dialog" aria-label="' + esc(f.n) + ' household">' +
        '<div class="tnd-pane-head">' +
          '<span class="up-head-eyebrow"><span class="up-eb-view">Household</span></span>' +
          '<span class="up-head-spacer"></span>' +
          '<div class="tnd-pane-head-actions">' +
            '<button type="button" class="btn-sm primary tnd-drawer-edit fam-hedit">' + ICON_EDIT + ' Edit</button>' +
            '<button type="button" class="tnd-pane-close" aria-label="Close">' + DI.close + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="tnd-pane-body is-ready"><div class="tnd-pane-view">' +
          '<section class="vB-hero">' +
            '<span class="vB-avatar ' + acc(f.n) + '" aria-hidden="true">' + esc(String(f.n).charAt(0).toUpperCase()) + '</span>' +
            '<h2 class="vB-name">' + esc(f.n) + ' household</h2>' +
            '<div class="vB-hero-meta"><span class="vB-idtag">' + f.c + (f.c === 1 ? ' child' : ' children') +
              ' · ' + (f.contacts || []).length + ' contacts</span></div>' +
          '</section>' +
          group('Household',
            '<div class="vB-list">' +
              vRow(DI.home, 'Address \u00b7 Household', addr) +
              vRow(DI.phone, 'Phone \u00b7 Household', f.p, tel(f.p)) +
            '</div>') +
          group('Children', '<div class="vB-list">' + childRows + '</div>') +
          (parents.length ? group('Parents', parents.map(personCard).join('')) : '') +
          (others.length ? group('Other contacts', others.map(personCard).join('')) : '') +
        '</div></div>' +
      '</aside>';
    document.body.appendChild(portal);
    portal.querySelector('.tnd-pane-scrim').addEventListener('click', closeDrawer);
    portal.querySelector('.tnd-pane-close').addEventListener('click', closeDrawer);
    portal.querySelectorAll('.fam-toperson').forEach(function (a) {
      a.addEventListener('click', function () { var p = personById(a.getAttribute('data-person')); if (p) openPerson(p); });
    });
    // View → edit in the same place, no slide: the panel simply becomes the form.
    portal.querySelector('.fam-hedit').addEventListener('click', function () { editHousehold(f, { instant: true }); });
    requestAnimationFrame(function () {
      portal.querySelector('.tnd-pane').classList.add('is-open');
      portal.querySelector('.tnd-pane-scrim').classList.add('is-open');
    });
  }

  /* ---- a person (FAM-FAM-6) ----------------------------------------------
     The household panel's parts again: hero, then Details, then Linked to — every
     household and child this one record reaches, each opening that household or
     child. What they may do for ONE child is that child's Family tab, not here. */
  function openChild(id, name) {
    closeDrawer();
    if (window.TndListDrawer && typeof window.TndListDrawer.openRecord === 'function') {
      setTimeout(function () { window.TndListDrawer.openRecord('children/edit/' + id, { id: id, name: name }); }, 230);
    }
  }

  function personAddress(c, f) {
    if (c.addr) return c.addr;
    return f && f.a ? 'Lives at the household address · ' + String(f.a).replace(/,?\s*USA$/i, '') : '';
  }

  /* A contact's phones, emails and addresses as lists (client review, 2026-10-27):
     each with a type, one primary. The mock contacts carry p / p2 / e / addr, so
     those are read as lists until a card saves real ones. */
  var PERSON_KEYS = ['n', 'p', 'p2', 'e', 'msg', 'addr', 'occ', 'emp', 'phones', 'emails', 'addrs'];
  function listsOf(c, f) {
    var hh = f ? String(f.a || '').replace(/,?\s*USA$/i, '') : '';
    return window.cmMulti ? window.cmMulti.items(c, hh) : { phone: [], email: [], address: [] };
  }
  var LIST_NAME = { phone: 'Phone', email: 'Email', address: 'Address' };
  function listLabel(kind, x, withPrimary) {
    return [LIST_NAME[kind], x.type, withPrimary && x.primary ? 'primary' : '',
            x.msg && x.msg !== 'None' ? x.msg : ''].filter(Boolean).join(' \u00b7 ');
  }
  function listHref(kind, v) { return kind === 'phone' ? tel(v) : kind === 'email' ? 'mailto:' + v : ''; }
  function listRows(items, kind) {
    var ico = kind === 'address' ? DI.home : kind === 'phone' ? DI.phone : DI.person;
    if (!items.length) return vRow(ico, LIST_NAME[kind], '');
    return items.map(function (x) { return vRow(ico, listLabel(kind, x, items.length > 1), x.value, listHref(kind, x.value)); }).join('');
  }
  function primaryRow(items, kind) {
    var x = items.filter(function (i) { return i.primary; })[0] || items[0];
    var ico = kind === 'phone' ? DI.phone : DI.person;
    return x ? vRow(ico, listLabel(kind, x, false), x.value, listHref(kind, x.value)) : vRow(ico, LIST_NAME[kind], '');
  }

  function openPerson(p) {
    var old = document.querySelector('.fam-portal');
    if (old) old.remove();
    var c = p.c, f0 = p.links[0] && p.links[0].f;
    var hh = p.links.length;
    var linked = p.links.map(function (l, li) {
      var kidsOf = kidsOfHousehold(l.f);
      var kidRows = kids(l.f).map(function (n) {
        var k = kidsOf.filter(function (x) { return x.f === n; })[0];
        var where = whereOf(k);
        var row = vRow(DI.person, where, n + ' ' + l.f.n);
        return k ? row.replace('<div class="vB-row"', '<a class="vB-row vB-row--action fam-tochild" data-child="' + k.id +
          '" data-childname="' + esc(n + ' ' + l.f.n) + '" href="javascript:void(0);"').replace(/<\/div>$/, DI.cta + '</a>') : row;
      }).join('');
      return '<div class="vB-list fam-linked">' +
        '<a class="vB-row vB-row--action fam-tohh" data-li="' + li + '" href="javascript:void(0);">' +
          '<span class="vB-row-ico" aria-hidden="true">' + DI.home + '</span>' +
          '<span class="vB-row-body"><span class="vB-row-label">' + esc(l.c.t) + ' · ' + badge(l.c) + '</span>' +
          '<span class="vB-row-value">' + esc(l.f.n) + ' household · ' + l.f.c + (l.f.c === 1 ? ' child' : ' children') + '</span></span>' +
          DI.cta + '</a>' +
        kidRows +
      '</div>';
    }).join('');

    var em = c.e || '';
    var portal = document.createElement('div');
    portal.className = 'tendi-skin tnd-drawer-portal fam-portal';
    portal.innerHTML =
      '<div class="tnd-pane-scrim tnd-drawer-scrim"></div>' +
      '<aside class="tnd-pane tnd-drawer is-readonly" role="dialog" aria-label="' + esc(c.n) + '">' +
        '<div class="tnd-pane-head">' +
          '<span class="up-head-eyebrow"><span class="up-eb-view">Contact</span></span>' +
          '<span class="up-head-spacer"></span>' +
          '<div class="tnd-pane-head-actions">' +
            '<button type="button" class="btn-sm primary tnd-drawer-save fam-pedit">' + ICON_EDIT + ' Edit</button>' +
            '<button type="button" class="tnd-pane-close" aria-label="Close">' + DI.close + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="tnd-pane-body is-ready"><div class="tnd-pane-view">' +
          '<section class="vB-hero">' +
            '<span class="vB-avatar ' + acc(c.n) + '" aria-hidden="true">' + esc(initials(c.n)) + '</span>' +
            '<h2 class="vB-name">' + esc(c.n) + '</h2>' +
            '<div class="vB-hero-meta"><span class="vB-idtag">' + esc(p.types.join(', ')) + ' · ' + hh +
              (hh === 1 ? ' household' : ' households') + ' · ' + p.kids + (p.kids === 1 ? ' child' : ' children') + '</span></div>' +
          '</section>' +
          group('Details',
            '<div class="vB-list">' +
              listRows(listsOf(c, f0).phone, 'phone') +
              listRows(listsOf(c, f0).email, 'email') +
              listRows(listsOf(c, f0).address, 'address') +
              vRow(DI.group, 'Work', [c.occ, c.emp].filter(Boolean).join(' · ')) +
            '</div>') +
          group('Linked to', linked +
            '<p class="fam-panel-note">The relationship and what they may do are set per family, for every child in it.</p>') +
        '</div></div>' +
      '</aside>';
    document.body.appendChild(portal);
    portal.querySelector('.tnd-pane-scrim').addEventListener('click', closeDrawer);
    portal.querySelector('.tnd-pane-close').addEventListener('click', closeDrawer);
    portal.querySelector('.fam-pedit').addEventListener('click', function () { editPerson(p, { instant: true }); });
    portal.querySelectorAll('.fam-tohh').forEach(function (a) {
      a.addEventListener('click', function () { openDrawer(p.links[+a.getAttribute('data-li')].f); });
    });
    portal.querySelectorAll('.fam-tochild').forEach(function (a) {
      a.addEventListener('click', function () { openChild(a.getAttribute('data-child'), a.getAttribute('data-childname')); });
    });
    requestAnimationFrame(function () {
      portal.querySelector('.tnd-pane').classList.add('is-open');
      portal.querySelector('.tnd-pane-scrim').classList.add('is-open');
    });
  }

  // The person's own fields, written to EVERY contact that is them.
  function applyPerson(p, v) {
    p.links.forEach(function (l) {
      var c = l.c;
      PERSON_KEYS.forEach(function (k) { c[k] = v[k]; });
    });
  }

  function splitName(n) {
    var parts = String(n || '').trim().split(/\s+/);
    return parts.length > 1 ? { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] } : { first: parts[0] || '', last: '' };
  }

  function msgSelect(v) {
    return '<div class="form-group"><label class="col-sm-3 control-label">Messages</label><div class="col-sm-4">' +
      '<select class="form-control" data-k="msg">' + ['None', 'SMS', 'Voice', 'SMS & Voice'].map(function (o) {
        return '<option' + ((v || 'None') === o ? ' selected' : '') + '>' + o + '</option>';
      }).join('') + '</select></div></div>';
  }

  /* EDIT CONTACT — the same card a contact is created with, so the fields are the
     same everywhere: First Name, Last Name, Phone and Phone 2 with their message
     setting, Email, Address, Work. What belongs to each family link — the
     relationship, what they may do, which children — is per family, so the card's
     top part is left out and each family keeps its relationship under Households. */
  function editPerson(p, opts) {
    var c = p.c, hh = p.links.length, f0 = p.links[0] && p.links[0].f;
    var portal = openEditPane('Editing contact',
      // Before Save, not after: the change lands on every family listed here.
      (hh > 1 ? '<div class="fam-shared-note"><b>In ' + hh + ' families · ' + p.kids +
        (p.kids === 1 ? ' child' : ' children') + '.</b> Saving changes this contact in all of them: ' +
        esc(p.links.map(function (l) { return l.f.n; }).join(', ')) + '.</div>' : '') +
      '<section class="vB-group"><h3 class="vB-group-label">Contact</h3><div class="vB-editcard fam-pcardhost"></div></section>' +
      '<section class="vB-group"><h3 class="vB-group-label">Households</h3><div class="vB-editcard fam-plinks">' +
        p.links.map(function (l, li) { return linkRow(l.f, l.c.t, 'li' + li); }).join('') +
        '<div class="fam-padd">' +
          '<button type="button" class="reg-add fam-padd-btn">' + HI.plus + 'Add to a household</button>' +
          '<div class="fam-padd-pick" hidden>' +
            '<input type="text" class="form-control fam-padd-q" placeholder="Search households: surname, parent, address or phone" autocomplete="off">' +
            '<div class="fam-padd-list"></div>' +
          '</div>' +
        '</div>' +
      '</div></section>',
      function (pt) {
        var card = pt.querySelector('.fam-pcardhost .cm-extra');
        var r = card ? readCard(card) : null;
        if (!r || !r.n) { if (window.tndToast) window.tndToast.error('Give a first or last name.'); return false; }
        var rows = [].slice.call(pt.querySelectorAll('.fam-plink'));
        var kept = rows.filter(function (x) { return !x.classList.contains('is-removed'); });
        if (!kept.length) {
          if (window.tndToast) window.tndToast.error('Keep them in at least one household. To remove the contact entirely, use Delete contact.');
          return false;
        }
        if (kept.some(function (x) { return !linkVals(x).t; })) {
          if (window.tndToast) window.tndToast.error('Choose their relationship in each household.');
          return false;
        }
        var who = {};
        PERSON_KEYS.forEach(function (k) { who[k] = r[k]; });
        applyPerson(p, who);
        var added = 0, removed = 0;
        rows.forEach(function (row) {
          var key = row.getAttribute('data-link'), lv = linkVals(row), type = lv.t;
          if (key.indexOf('li') === 0) {
            var l = p.links[+key.slice(2)];
            if (row.classList.contains('is-removed')) {
              l.f.contacts = (l.f.contacts || []).filter(function (x) { return x !== l.c; });
              removed++;
            } else { l.c.t = type; if (lv.perm) l.c.perm = lv.perm; }
          } else if (!row.classList.contains('is-removed')) {
            var f = (FAMILIES || [])[+key.slice(3)];
            if (!f) return;
            var nc = { t: type, on: false, perm: lv.perm };
            PERSON_KEYS.forEach(function (k) { nc[k] = who[k]; });
            f.contacts = (f.contacts || []).concat([nc]);
            added++;
          }
        });
        refresh();
        var msg = hh > 1 ? 'Saved in ' + hh + ' households.' : 'Saved.';
        if (added) msg += ' Added to ' + added + (added === 1 ? ' household.' : ' households.');
        if (removed) msg += ' Removed from ' + removed + (removed === 1 ? ' household.' : ' households.');
        if (window.tndToast) window.tndToast.success(msg);
      }, null, opts);

    // The creation card, filled in, without its per-family top part (relationship,
    // applies to, what they may do, link existing): everything before the name.
    var card = f0 ? personCard(f0, c) : null;
    if (card) {
      var nameGrid = card.querySelector('[data-part="name"]');
      while (nameGrid && nameGrid.previousElementSibling) nameGrid.previousElementSibling.remove();
      portal.querySelector('.fam-pcardhost').appendChild(card);
    }

    var links = portal.querySelector('.fam-plinks'), addWrap = portal.querySelector('.fam-padd');
    var wireLink = function (r) {
      r.querySelector('.fam-plink-rm').addEventListener('click', function () {
        if (r.getAttribute('data-link').indexOf('new') === 0) { r.remove(); return; }
        var off = !r.classList.contains('is-removed');
        r.classList.toggle('is-removed', off);
        this.textContent = off ? 'Undo' : 'Remove';
      });
    };
    links.querySelectorAll('.fam-plink').forEach(function (r) {
      var l = p.links[+r.getAttribute('data-link').slice(2)];
      fillLink(r, l.f, l.c);
      wireLink(r);
    });
    var pick = portal.querySelector('.fam-padd-pick'), pq = portal.querySelector('.fam-padd-q'), plist = portal.querySelector('.fam-padd-list');
    var inUse = function (fi) {
      return [].some.call(links.querySelectorAll('.fam-plink'), function (r) {
        var k = r.getAttribute('data-link');
        return k === 'new' + fi || (k.indexOf('li') === 0 && (FAMILIES || []).indexOf(p.links[+k.slice(2)].f) === fi);
      });
    };
    var draw = function () {
      var q = pq.value.trim().toLowerCase();
      var hits = (FAMILIES || []).map(function (f, fi) { return { f: f, fi: fi }; }).filter(function (x) {
        return !inUse(x.fi) && (!q || matches(x.f, q));
      }).slice(0, 8);
      plist.innerHTML = hits.length ? hits.map(function (x) {
        return '<button type="button" class="fam-padd-hit" data-fi="' + x.fi + '"><b>' + esc(x.f.n) + ' household</b>' +
          '<small>' + esc(parentsOf(x.f).map(function (c) { return c.n; }).join(' \u00b7 ') || 'no parent named') +
          ' \u00b7 ' + esc(String(x.f.a || '').replace(/,?\s*USA$/i, '')) + '</small></button>';
      }).join('') : '<p class="fam-panel-note">No household matches that.</p>';
    };
    portal.querySelector('.fam-padd-btn').addEventListener('click', function () {
      pick.hidden = false; this.hidden = true; draw(); pq.focus();
    });
    pq.addEventListener('input', draw);
    plist.addEventListener('click', function (e) {
      var b = e.target.closest('.fam-padd-hit');
      if (!b) return;
      var fi = +b.getAttribute('data-fi');
      var tmp = document.createElement('div');
      tmp.innerHTML = linkRow(FAMILIES[fi], '', 'new' + fi);
      var r = tmp.firstChild;
      links.insertBefore(r, addWrap);
      fillLink(r, FAMILIES[fi], null);
      wireLink(r);
      var s2 = r.querySelector('.cm-ptype select'); if (s2) s2.focus();
      pq.value = ''; pick.hidden = true; portal.querySelector('.fam-padd-btn').hidden = false;
    });
  }

  // One household this person is (or is about to be) linked to: its name, the
  // relationship there, and Remove.
  /* One family this contact is in (or is being added to), shown like a contact in
     Edit household: the family's name with Remove, then the creation card's own
     per-family part — Relationship, Applies to, What they may do — filled with
     this link. The person's details are above, once; these are per family. */
  function linkRow(f, type, key) {
    var isNew = key.indexOf('new') === 0;
    return '<div class="fam-plink fam-crow is-editing" data-link="' + key + '">' +
      '<div class="fam-crow-main">' +
        '<span class="fam-sub-av ' + acc(f.n) + '">' + esc(String(f.n).charAt(0).toUpperCase()) + '</span>' +
        '<span class="fam-crow-who"><b>' + esc(f.n) + ' household</b><small><span>' + f.c + (f.c === 1 ? ' child' : ' children') +
          '</span>' + (isNew ? '<span>new</span>' : '') + '</small></span>' +
        '<button type="button" class="fam-cremove fam-plink-rm" title="Takes them out of this household only">Remove</button>' +
      '</div>' +
      '<div class="fam-crow-card"></div>' +
    '</div>';
  }
  function fillLink(row, f, c) {
    var card = personCard(f, c);
    if (!card) return;
    var lk = card.querySelector('.cm-lkrow') || card.querySelector('[data-part="name"]');
    while (lk && lk.nextElementSibling) lk.nextElementSibling.remove();
    if (lk) lk.remove();
    row.querySelector('.fam-crow-card').appendChild(card);
  }
  // A family link's values, read from its card: relationship, children, permission.
  function linkVals(row) {
    var card = row.querySelector('.cm-extra');
    if (!card) return { t: '', perm: '' };
    var sel = card.querySelector('.cm-ptype select');
    var note = card.querySelector('.cm-permnote');
    return {
      t: sel && sel.value ? typeText(sel.value) : '',
      perm: note && /\b(full|limited|none)\b/.test(note.className) ? note.className.match(/\b(full|limited|none)\b/)[1] : ''
    };
  }

  /* ---- editing: the child drawer's EDIT state ----------------------------
     The same pane in is-editing: the head's eyebrow says what is being edited,
     Cancel and Save sit where the child drawer has them, and the body is a form
     of section.vB-group > .vB-editcard > .form-group rows. Families are the
     derived households of families.json, so Save updates this page's copy and
     nothing is stored. */
  // Children are matched to a household by surname + the address it was grouped
  // on. Editing the address must not un-match them, so the original is kept.
  function homeKey(f) { return String(f.key || f.a).toLowerCase(); }
  function kidsOfHousehold(f) {
    return CHILDREN_ALL.concat(CHILDREN_OFF).filter(function (c) {
      return c.l.toLowerCase() === String(f.n).toLowerCase() && c.a.toLowerCase() === homeKey(f);
    });
  }
  function activeKids(f) {
    return kidsOfHousehold(f).filter(function (c) { return c.s === 'enrolled' || c.s === 'waitlist'; });
  }

  function parseAddr(a) {
    var parts = String(a || '').replace(/,?\s*USA$/i, '').split(/\s*,\s*/);
    var out = { line1: parts[0] || '', line2: '', city: '', state: '', zip: '' };
    if (parts.length >= 3) {
      out.city = parts[parts.length - 2];
      var m = parts[parts.length - 1].match(/^(.*?)\s*(\d{5}(?:-\d{4})?)?$/);
      out.state = m ? m[1] : parts[parts.length - 1];
      out.zip = m && m[2] ? m[2] : '';
      if (parts.length > 3) out.line2 = parts.slice(1, parts.length - 2).join(', ');
    } else if (parts.length === 2) { out.city = parts[1]; }
    return out;
  }

  var ICON_SAVE = SV('<path d="M20 6 9 17l-5-5"></path>', 2.2);
  function field(label, key, value, attrs) {
    return '<div class="form-group"><label class="col-sm-3 control-label">' + esc(label) + '</label>' +
      '<div class="col-sm-4"><input type="text" class="form-control" data-k="' + key + '" value="' +
      esc(value || '') + '"' + (attrs || '') + '></div></div>';
  }

  /* Tendi's edit rule, as in every record's panel: Cancel throws the changes away and
     closes; Save saves and closes; clicking outside with unsaved changes does not
     close — the panel nudges instead. */
  function openEditPane(title, bodyHtml, onSave, saveLabel, opts) {
    var old = document.querySelector('.fam-portal');
    if (old) old.remove();
    var portal = document.createElement('div');
    portal.className = 'tendi-skin tnd-drawer-portal fam-portal';
    portal.innerHTML =
      '<div class="tnd-pane-scrim tnd-drawer-scrim"></div>' +
      '<aside class="tnd-pane tnd-drawer is-editing" role="dialog" aria-label="' + esc(title) + '">' +
        '<div class="tnd-pane-head">' +
          '<span class="up-head-eyebrow"><span class="up-eb-edit">' + esc(title) + '</span></span>' +
          '<span class="up-head-spacer"></span>' +
          '<div class="tnd-pane-head-actions">' +
            '<button type="button" class="btn-sm tnd-drawer-cancel fam-cancel">Cancel</button>' +
            '<button type="button" class="btn-sm primary tnd-drawer-save fam-save">' + ICON_SAVE + ' ' + esc(saveLabel || 'Save') + '</button>' +
            '<button type="button" class="tnd-pane-close" aria-label="Close">' + DI.close + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="tnd-pane-body is-ready"><form class="form-horizontal tnd-pane-edit fam-editform" onsubmit="return false">' +
          bodyHtml + '</form></div>' +
      '</aside>';
    document.body.appendChild(portal);
    var dirty = false, pane = portal.querySelector('.tnd-pane');
    portal.querySelector('.fam-editform').addEventListener('input', function () { dirty = true; });
    portal.querySelector('.fam-editform').addEventListener('change', function () { dirty = true; });
    portal.querySelector('.fam-editform').addEventListener('click', function (e) { if (e.target.closest('button')) dirty = true; });
    portal.querySelector('.tnd-pane-scrim').addEventListener('click', function () {
      if (!dirty) { closeDrawer(); return; }
      pane.classList.remove('fam-nudge'); void pane.offsetWidth; pane.classList.add('fam-nudge');
    });
    portal.querySelector('.tnd-pane-close').addEventListener('click', closeDrawer);
    portal.querySelector('.fam-cancel').addEventListener('click', closeDrawer);
    portal.querySelector('.fam-save').addEventListener('click', function () {
      if (onSave(portal) !== false) closeDrawer();
    });
    if (opts && opts.instant) {
      [pane, portal.querySelector('.tnd-pane-scrim')].forEach(function (el) { el.style.transition = 'none'; el.classList.add('is-open'); });
      pane.getBoundingClientRect();
      setTimeout(function () { [pane, portal.querySelector('.tnd-pane-scrim')].forEach(function (el) { el.style.transition = ''; }); }, 50);
      return portal;
    }
    requestAnimationFrame(function () {
      pane.classList.add('is-open');
      portal.querySelector('.tnd-pane-scrim').classList.add('is-open');
    });
    return portal;
  }

  // Redraw the list after a change (renderList only needs a node that contains it).
  function refresh() { if (document.getElementById('famRows')) renderList(document); }

  /* 1. EDIT HOUSEHOLD — its phone and its address, in the US postal shape (the
        name is derived from the parents' surname, so it is shown, not edited);
        then its CONTACTS, each editable in place, removable, and + Add contact;
        then its CHILDREN, read-only. A child changes household one at a time,
        from Change on their own Family tab — rare, and never in bulk here. */
  function typeOptions(sel) {
    return '<option value="">Relationship…</option>' + TYPES.map(function (t) {
      return '<option' + (String(sel || '').toLowerCase() === t.toLowerCase() ? ' selected' : '') + '>' + t + '</option>';
    }).join('');
  }

  /* CONTACTS IN EDIT HOUSEHOLD. Each person is listed, not opened: name,
     relationship, permission, phone and email, with Edit and Remove. Edit opens the
     SAME card used to create a contact (window.cmExtraCard, from the child form):
     relationship, what they may do, first and last name, Phone, Phone 2, Email,
     messages, Address and Work — filled with what is on file. One card, whether a
     person is being created or edited. + Add contact adds that card empty. */
  var typeKey = function (t) { return String(t || '').toLowerCase().replace(/[- ]+/g, '_'); };
  var typeText = function (k) { return String(k || '').replace(/_/g, ' ').replace(/^./, function (x) { return x.toUpperCase(); }); };

  function contactSummary(c, idx) {
    var p = personById(pkey(c)), hh = p ? p.links.length : 1;
    return '<div class="fam-crow" data-ci="' + idx + '">' +
      '<div class="fam-crow-main">' +
        '<span class="fam-sub-av ' + acc(c.n) + '">' + esc(initials(c.n)) + '</span>' +
        // While the card is open the relationship and badge live in it, once.
        '<span class="fam-crow-who"><b>' + esc(c.n) + '</b><small><span class="fam-crow-rel">' + esc(c.t) + '</span>' +
          (hh > 1 ? '<span class="fam-crow-also">also in ' + (hh - 1) + (hh === 2 ? ' other family' : ' other families') + '</span>' : '') + '</small></span>' +
        badge(c) +
        '<button type="button" class="fam-cremove" title="Takes them out of this household only; they stay in their other families">Remove</button>' +
      '</div>' +
      '<div class="fam-crow-facts">' +
        (function () { var m = mainOf(c, 'phone'); return '<span>' + (m ? esc(m.value) + typeTag(m.type) : '<i>No phone</i>') + '</span>'; })() +
        (function () { var m = mainOf(c, 'email'); return '<span>' + (m ? esc(m.value) + typeTag(m.type) : '<i>No email</i>') + '</span>'; })() +
      '</div>' +
      '<div class="fam-crow-card"></div>' +
    '</div>';
  }

  /* No "Applies to" here any more (client review, 2026-10-27): a household's
     contact applies to every child in it, so the card has no scope choice. */

  // The creation card, emptied of what does not apply here (its own Remove), and
  // filled with the contact's details: names, the phone / email / address lists, work.
  function personCard(f, c) {
    if (!window.cmExtraCard) return null;
    var card = window.cmExtraCard();
    var rm = card.querySelector('.cm-extra-remove'); if (rm) rm.remove();
    var cap = card.querySelector('.cm-ptype-cap');
    if (cap) cap.textContent = 'Relationship';
    var hh = String(f.a || '').replace(/,?\s*USA$/i, '');
    card.setAttribute('data-fam-addr', hh);
    var hhFn = function () { return hh; };
    var ab = card.querySelector('.cm-multi[data-multi="address"]');
    if (ab) {
      ab._hhAddr = hhFn;
      // The household's other contacts, for "Copy an address from…".
      ab._peers = function () {
        return (f.contacts || []).filter(function (x) { return x !== c; }).map(function (x) {
          return { who: x.n + ' (' + x.t + ')', items: listsOf(x).address };
        });
      };
    }
    if (!c) return card;
    var sel = card.querySelector('.cm-ptype select');
    if (sel) { sel.value = typeKey(c.t); sel.dispatchEvent(new Event('change')); }
    var inp = function (part, re) {
      var gs = card.querySelectorAll('[data-part="' + part + '"] .form-group');
      for (var i = 0; i < gs.length; i++) {
        var l = gs[i].querySelector('label');
        if (l && re.test((l.textContent || '').trim())) return gs[i].querySelector('input');
      }
      return null;
    };
    var set = function (el, v) { if (el) el.value = v || ''; };
    var nm = splitName(c.n);
    set(inp('name', /^first name$/i), nm.first);
    set(inp('name', /^last name$/i), nm.last);
    if (window.cmMulti) window.cmMulti.fill(card, c, hh);
    set(inp('work', /^occupation$/i), c.occ);
    set(inp('work', /^employer$/i), c.emp);
    return card;
  }

  // Everything the creation card holds, read back. The lists are kept whole; p, p2,
  // e, msg and addr are their primary values, for the list rows and the search.
  function readCard(card) {
    var inp = function (part, re) {
      var gs = card.querySelectorAll('[data-part="' + part + '"] .form-group');
      for (var i = 0; i < gs.length; i++) {
        var l = gs[i].querySelector('label');
        if (l && re.test((l.textContent || '').trim())) { var x = gs[i].querySelector('input'); return x ? x.value.trim() : ''; }
      }
      return '';
    };
    var sel = card.querySelector('.cm-ptype select');
    var note = card.querySelector('.cm-permnote');
    var get = function (k) { return window.cmMulti ? window.cmMulti.values(card, k) : []; };
    var phones = get('phone'), emails = get('email'), addrs = get('address');
    var hh = String(card.getAttribute('data-fam-addr') || '').toLowerCase();
    var isWork = function (a) { return a.type === 'Work' || a.type === 'Office'; };
    var home = addrs.filter(function (a) { return !isWork(a); })[0];
    return {
      t: sel && sel.value ? typeText(sel.value) : '',
      n: [inp('name', /^first name$/i), inp('name', /^last name$/i)].filter(Boolean).join(' '),
      phones: phones, emails: emails, addrs: addrs,
      p: phones[0] ? phones[0].value : '', p2: phones[1] ? phones[1].value : '',
      msg: phones[0] ? phones[0].msg : 'None', e: emails[0] ? emails[0].value : '',
      // Living at the household address is no own address, as before.
      addr: home && home.value.toLowerCase() !== hh ? home.value : '',
      occ: inp('work', /^occupation$/i), emp: inp('work', /^employer$/i),
      perm: note && /\b(full|limited|none)\b/.test(note.className) ? note.className.match(/\b(full|limited|none)\b/)[1] : ''
    };
  }

  /* The household's phone and address in the same rows as a contact's, with the
     fixed type "Household" (client review, 2026-10-27). Same data-k keys as before. */
  function hhRows(p, a) {
    var chip = '<span class="cm-mfixed">Household</span>';
    var inp = function (k, v, ph) {
      return '<input type="text" class="form-control" data-k="' + k + '" value="' + esc(v || '') +
        '" placeholder="' + ph + '" aria-label="' + ph + '">';
    };
    return '<div class="cm-reach fam-hhrows">' +
      '<div class="cm-multi"><div class="cm-mlabel">Phone</div><div class="cm-mrow"><div class="cm-mmain">' + chip +
        inp('phone', p, 'Phone number') + '</div></div></div>' +
      '<div class="cm-multi"><div class="cm-mlabel">Address</div><div class="cm-mrow cm-mrow--address"><div class="cm-mmain">' + chip +
        inp('line1', a.line1, 'Address line 1') + '</div><div class="cm-maddr">' + inp('line2', a.line2, 'Address line 2') +
        inp('city', a.city, 'City') + inp('state', a.state, 'State') + inp('zip', a.zip, 'ZIP code') + '</div></div></div>' +
    '</div>';
  }

  function editHousehold(f, opts) {
    var a = parseAddr(f.a);
    var contacts = (f.contacts || []).slice().sort(function (x, y) {
      var r = function (c) { return /^father$/i.test(c.t) ? 0 : /^mother$/i.test(c.t) ? 1 : 2; };
      return r(x) - r(y);
    });
    var parentList = contacts.filter(function (c) { return /^(mother|father)$/i.test(c.t || ''); });
    var otherList = contacts.filter(function (c) { return parentList.indexOf(c) === -1; });
    var kidsOf = kidsOfHousehold(f);
    var childRows = kids(f).map(function (n) {
      var k = kidsOf.filter(function (x) { return x.f === n; })[0];
      return '<div class="fam-ckid"><b>' + esc(n + ' ' + f.n) + '</b><span>' + esc(whereOf(k)) + '</span>' +
        (k ? '<button type="button" class="fam-sub-btn" data-child="' + k.id + '" data-childname="' + esc(n + ' ' + f.n) + '">Open</button>' : '') +
      '</div>';
    }).join('');

    var portal = openEditPane('Editing household',
      '<section class="vB-group"><h3 class="vB-group-label">Household</h3><div class="vB-editcard">' +
        field('Name', 'name', f.n + ' household', ' readonly') +
        hhRows(f.p, a) +
      '</div></section>' +
      '<section class="vB-group"><h3 class="vB-group-label">Children</h3><div class="vB-editcard">' +
        (childRows || '<p class="fam-panel-note">No children.</p>') +
        '<p class="fam-panel-note">To move a child to another household, open the child and use <b>Change</b> on their Family tab.</p>' +
      '</div></section>' +
      // Parents, then everyone else — the same two groups the household's view shows.
      (parentList.length ? '<section class="vB-group"><h3 class="vB-group-label">Parents</h3><div class="vB-editcard fam-clist-parents">' +
        parentList.map(function (c) { return contactSummary(c, (f.contacts || []).indexOf(c)); }).join('') +
      '</div></section>' : '') +
      '<section class="vB-group"><h3 class="vB-group-label">Other contacts</h3><div class="vB-editcard fam-clist">' +
        otherList.map(function (c) { return contactSummary(c, (f.contacts || []).indexOf(c)); }).join('') +
        '<button type="button" class="reg-add fam-cadd">' + HI.plus + 'Add contact</button>' +
      '</div></section>',

      function (portal) {
        var v = function (k) { return portal.querySelector('[data-k="' + k + '"]').value.trim(); };
        var rows = [].slice.call(portal.querySelectorAll('.fam-crow, .fam-cnew'));
        // Check every open card first, so nothing changes if one is incomplete.
        for (var i = 0; i < rows.length; i++) {
          var card = rows[i].querySelector('.cm-extra');
          if (!card || rows[i].classList.contains('is-removed')) continue;
          var r = readCard(card);
          if (!r.t || !r.n) {
            if (window.tndToast) window.tndToast.error('Every contact needs a relationship and a name.');
            rows[i].scrollIntoView({ block: 'center' });
            return false;
          }
        }
        var keep = [];
        rows.forEach(function (row) {
          var card = row.querySelector('.cm-extra');
          if (row.classList.contains('fam-cnew')) {
            var rn = readCard(card);
            var nc = { t: rn.t, perm: rn.perm, on: false };
            PERSON_KEYS.forEach(function (k) { nc[k] = rn[k]; });
            keep.push(nc);
            return;
          }
          var c = f.contacts[+row.getAttribute('data-ci')];
          if (row.classList.contains('is-removed')) return;       // the link goes; the person stays elsewhere
          if (card) {
            var r2 = readCard(card), p = personById(pkey(c));
            if (p) applyPerson(p, r2); else { PERSON_KEYS.forEach(function (k) { c[k] = r2[k]; }); }
            c.t = r2.t;                                           // the relationship is this household's link
            if (r2.perm) c.perm = r2.perm;
          }
          keep.push(c);
        });
        f.contacts = keep;
        if (!f.key) f.key = f.a;
        f.p = v('phone');
        f.a = [v('line1'), v('line2') ? 'Apt ' + v('line2').replace(/^apt\.?\s*/i, '') : '', v('city'),
               [v('state'), v('zip')].filter(Boolean).join(' ')].filter(Boolean).join(', ');
        refresh();
        if (window.tndToast) window.tndToast.success('Saved.');
      }, null, opts);

    var list = portal.querySelector('.fam-clist');
    // Every person is open in the edit form: the full creation card, filled in.
    portal.querySelectorAll('.fam-crow').forEach(function (row) {
      var c = f.contacts[+row.getAttribute('data-ci')];
      var card = personCard(f, c);
      if (card) row.querySelector('.fam-crow-card').appendChild(card);
      row.classList.add('is-editing');
      row.querySelector('.fam-cremove').addEventListener('click', function () {
        var off = !row.classList.contains('is-removed');
        row.classList.toggle('is-removed', off);
        this.textContent = off ? 'Undo' : 'Remove';
      });
    });
    portal.querySelector('.fam-cadd').addEventListener('click', function () {
      var wrap = document.createElement('div');
      wrap.className = 'fam-cnew';
      wrap.innerHTML = '<div class="fam-cnew-head"><b>New contact</b><span class="up-head-spacer"></span>' +
        '<button type="button" class="fam-cremove">Remove</button></div>';
      var card = personCard(f, null);
      if (!card) return;
      wrap.appendChild(card);
      list.insertBefore(wrap, this);
      wrap.querySelector('.fam-cremove').addEventListener('click', function () { wrap.remove(); });
      var sel = card.querySelector('.cm-ptype select');
      if (sel) sel.focus();
    });
    portal.querySelectorAll('[data-child]').forEach(function (btn) {
      btn.addEventListener('click', function () { openChild(btn.getAttribute('data-child'), btn.getAttribute('data-childname')); });
    });
  }

  // 3. ADD A CONTACT — the very card "+ Add contact" builds on a child's Family
  //    tab (relationship, permissions, link existing, name, how to reach, address,
  //    work), added to the household.
  function addContact(f) {
    var portal = openEditPane('New contact',
      '<section class="vB-group"><h3 class="vB-group-label">' + esc(f.n) + ' household</h3>' +
        '<div class="vB-editcard fam-contacthost"></div></section>',
      function (pt) {
        var card = pt.querySelector('.cm-extra');
        var v = window.cmCardValues ? window.cmCardValues(card) : null;
        if (!v || !v.type || !(v.first || v.last)) {
          if (window.tndToast) window.tndToast.error('Choose the relationship and give a name.');
          return false;
        }
        f.contacts = f.contacts || [];
        var rc = readCard(card);
        var nc = { t: v.typeLabel, perm: rc.perm, on: false };
        PERSON_KEYS.forEach(function (k) { nc[k] = rc[k]; });
        f.contacts.push(nc);
        refresh();
        if (window.tndToast) window.tndToast.success('Contact added.');
      });
    var host = portal.querySelector('.fam-contacthost');
    if (window.cmExtraCard) {
      var card = window.cmExtraCard();
      var rm = card.querySelector('.cm-extra-remove');
      if (rm) rm.remove();
      card.setAttribute('data-fam-addr', String(f.a || '').replace(/,?\s*USA$/i, ''));
      var ab = card.querySelector('.cm-multi[data-multi="address"]');
      if (ab) {
        ab._hhAddr = function () { return card.getAttribute('data-fam-addr'); };
        ab._peers = function () {
          return (f.contacts || []).map(function (x) { return { who: x.n + ' (' + x.t + ')', items: listsOf(x).address }; });
        };
      }
      host.appendChild(card);
      var sel = card.querySelector('select');
      if (sel) sel.focus();
    }
  }

  // 6. ARCHIVE HOUSEHOLD — only when no child in it is enrolled or waiting (the
  //    menu item is disabled otherwise, saying why). The app's own confirm and toast.
  function archiveHousehold(f) {
    if (activeKids(f).length) return;
    var go = function () {
      FAMILIES = (FAMILIES || []).filter(function (x) { return x !== f; });
      refresh();
      var sub = document.getElementById('famCount');
      if (sub) sub.innerHTML = '<b>' + FAMILIES.length + '</b> households';
      if (window.tndToast) window.tndToast.success('Archived.');
    };
    var msg = 'Archive the ' + f.n + ' household? None of its children is enrolled or on the waiting list. ' +
      'Its contacts stay on file.';
    if (window.jConfirm) window.jConfirm(msg, 'Archive household', 'primary', function (ok) { if (ok) go(); });
    else if (window.confirm(msg)) go();
  }

  /* ---- page-head actions --------------------------------------------------
     The Children header's own buttons and glyphs. Add family and Add to waiting
     list open the New child side panel (a household is created with its first
     child — the field map's rule), handing over which question to pre-answer:
     New family, or the waiting-list switch on. Import is the app's own children
     importer: households are built from children, so that is how they arrive.
     Export writes the households as a CSV — the list as it is filtered, or all. */
  var HI = {
    waitlist: SV('<path d="M8 6h10M8 12h10M8 18h6M3 6h.01M3 12h.01M3 18h.01"></path><path d="M18 15v6M15 18h6"></path>', 1.9),
    importIco: SV('<path d="M12 3v13"></path><path d="m7 11 5 5 5-5"></path><path d="M3 21h18"></path>', 1.9),
    exportIco: SV('<path d="M12 21V8"></path><path d="m7 13 5-5 5 5"></path><path d="M3 3h18"></path>', 1.9),
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" ' +
      'stroke-linejoin="round" style="width:12px;height:12px"><path d="m6 9 6 6 6-6"></path></svg>',
    plus: SV('<path d="M12 5v14M5 12h14"></path>', 2.4)
  };

  function newChildPanel(handover, url) {
    try { sessionStorage.setItem('cm-add-family', JSON.stringify(handover)); } catch (err) {}
    closeDrawer();
    if (window.TndListDrawer && typeof window.TndListDrawer.open === 'function') {
      window.TndListDrawer.open(url || 'children/add', 'Add child');
    }
  }

  // Setup → first child without a visible reload: the child panel opens, unanimated, UNDER the
  // setup panel (same place, same size) and loads there; the setup panel is dropped only once
  // the child form is built and the registration head is on it. Nothing slides out and back in.
  function swapToChild(portal, handover) {
    try { sessionStorage.setItem('cm-add-family', JSON.stringify(handover)); } catch (err) {}
    var drawer = document.getElementById('tndDrawer'), scrim = document.getElementById('tndDrawerScrim');
    var still = [drawer, scrim].filter(Boolean);
    still.forEach(function (el) { el.style.transition = 'none'; });
    var own = portal.querySelector('.tnd-pane-scrim');
    if (own) { own.style.transition = 'none'; own.style.opacity = '0'; }   // the child panel's scrim takes over
    if (window.TndListDrawer && typeof window.TndListDrawer.open === 'function') {
      window.TndListDrawer.open('children/add', 'Add child');
    }
    var t0 = Date.now();
    (function wait() {
      var body = document.getElementById('tndDrawerBody');
      var ready = body && body.classList.contains('is-ready') && drawer && drawer.classList.contains('reg-active');
      if (!ready && Date.now() - t0 < 8000) { setTimeout(wait, 40); return; }
      portal.remove();
      STATE.open = null;
      setTimeout(function () { still.forEach(function (el) { el.style.transition = ''; }); }, 50);
    })();
  }

  function exportCsv(scope, picked) {
    var rows = picked || (scope === 'view' ? visible() : (FAMILIES || []));
    var q = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [['Household', 'Address', 'Household phone', 'Children', 'Mother', 'Father', 'Other contacts'].join(',')];
    rows.forEach(function (f) {
      var who = function (t) { return (f.contacts || []).filter(function (c) { return (c.t || '').toLowerCase() === t; }).map(function (c) { return c.n; }).join('; '); };
      var other = (f.contacts || []).filter(function (c) { return !/^(mother|father)$/i.test(c.t || ''); })
        .map(function (c) { return c.n + ' (' + c.t + ')'; }).join('; ');
      lines.push([f.n, f.a, f.p, kids(f).join('; '), who('mother'), who('father'), other].map(q).join(','));
    });
    var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = scope === 'sel' ? 'households-selected.csv' : scope === 'view' ? 'households-this-view.csv' : 'households.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    if (window.tndToast) window.tndToast.success(rows.length + (rows.length === 1 ? ' household' : ' households') + ' exported.');
  }
  function exportPeople(list) {
    var q = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [['Name', 'Relationship', 'Households', 'Main phone', 'Main email'].join(',')];
    list.forEach(function (p) {
      var ph = mainOf(p.c, 'phone'), em = mainOf(p.c, 'email');
      lines.push([p.c.n, p.types.join('; '), p.links.map(function (l) { return l.f.n + ' (' + l.c.t + ')'; }).join('; '),
        ph ? ph.value : '', em ? em.value : ''].map(q).join(','));
    });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = 'contacts-selected.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    if (window.tndToast) window.tndToast.success(list.length + (list.length === 1 ? ' contact' : ' contacts') + ' exported.');
  }

  function wireHead(root) {
    var ie = root.querySelector('.fam-ie');
    var trg = ie.querySelector('button'), menu = ie.querySelector('.tnd-chl-menu');
    var set = function (open) {
      ie.classList.toggle('is-open', open);
      menu.classList.toggle('is-open', open);
      trg.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    trg.addEventListener('click', function (e) { e.stopPropagation(); set(!menu.classList.contains('is-open')); });
    document.addEventListener('click', function (e) { if (!ie.contains(e.target)) set(false); });
    ie.querySelectorAll('.fam-export').forEach(function (a) {
      a.addEventListener('click', function () { set(false); exportCsv(a.getAttribute('data-scope')); });
    });
    root.querySelector('.fam-addfamily').addEventListener('click', function () { openSetup([{ m: 'enroll' }]); });
    root.querySelector('.fam-addwait').addEventListener('click', function () { openSetup([{ m: 'wait' }]); });
  }

  /* ---- a new family: how many children, and enrollment or waiting list ----
     The first panel of registering a family. Before any form: one row per child
     with the app's icon tile — a person for enrollment, an hourglass for the
     waiting list — a choice for each, and a line saying what happens next: they
     are registered one by one, and the family and shared answers carry over.
     Start hands the plan to the regular child panel (changemap.js, regFlow),
     which walks the children with Next and Back and ends on a welcome. */
  function openSetup(kids, prior, opt) {
    var old = document.querySelector('.fam-portal');
    if (old) old.remove();
    var portal = document.createElement('div');
    portal.className = 'tendi-skin tnd-drawer-portal fam-portal';
    portal.innerHTML =
      '<div class="tnd-pane-scrim tnd-drawer-scrim"></div>' +
      '<aside class="tnd-pane tnd-drawer is-editing" role="dialog" aria-label="New family">' +
        '<div class="tnd-pane-head">' +
          '<span class="up-head-eyebrow"><span class="up-eb-edit">New family</span></span>' +
          '<div class="reg-strip"></div>' +
          '<span class="up-head-spacer"></span>' +
          '<div class="tnd-pane-head-actions">' +
            // No Cancel: the × already leaves.
            '<button type="button" class="btn-sm primary tnd-drawer-save fam-start">Start</button>' +
            '<button type="button" class="tnd-pane-close" aria-label="Close">' + DI.close + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="tnd-pane-body is-ready"><div class="tnd-pane-view fam-setup"></div></div>' +
      '</aside>';
    document.body.appendChild(portal);
    var host = portal.querySelector('.fam-setup');

    function render() {
      var e = kids.filter(function (k) { return k.m === 'enroll'; }).length, w = kids.length - e;
      // The children, small, in the head row (changemap.js draws the track, so this
      // panel and the child panels share it).
      if (window.cmRegTrack) window.cmRegTrack(portal.querySelector('.reg-strip'), kids.map(function (k) {
        return { w: k.m === 'wait', title: k.m === 'wait' ? 'Waiting list' : 'Enrollment' };
      }), -1);
      host.innerHTML =
        '<p class="reg-intro">You\u2019ll register them one by one. The family, and anything the children share, ' +
          'carries over to the next child, so each one only asks for what\u2019s different.</p>' +
        '<section class="vB-group"><h3 class="vB-group-label">Children joining</h3>' +
        kids.map(function (k, i) {
          var wt = k.m === 'wait';
          return '<div class="reg-row"><span class="reg-tile sm">' + REG_ICO.kid + '</span>' +
            '<span class="reg-nm">Child ' + (i + 1) + '</span>' +
            '<span class="reg-seg"><button type="button" data-i="' + i + '" data-m="enroll" class="' + (!wt ? 'on' : '') + '">Enrollment</button>' +
            '<button type="button" data-i="' + i + '" data-m="wait" class="' + (wt ? 'onw' : '') + '">Waiting list</button></span>' +
            (kids.length > 1 ? '<button type="button" class="reg-rm" data-rm="' + i + '" aria-label="Remove child ' + (i + 1) + '">' + DI.close + '</button>' : '') +
            '</div>';
        }).join('') +
        (kids.length < 8 ? '<button type="button" class="reg-add">' + HI.plus + 'Add a child</button>' : '') +
        '<p class="reg-sum">' + kids.length + (kids.length === 1 ? ' child' : ' children') +
          (e ? ' \u00b7 ' + e + ' to enroll' : '') + (w ? ' \u00b7 ' + w + ' for the waiting list' : '') + '</p>' +
        '</section>';
      host.querySelectorAll('.reg-seg button').forEach(function (b) {
        b.addEventListener('click', function () { kids[+b.getAttribute('data-i')].m = b.getAttribute('data-m'); render(); });
      });
      host.querySelectorAll('[data-rm]').forEach(function (b) {
        b.addEventListener('click', function () { kids.splice(+b.getAttribute('data-rm'), 1); render(); });
      });
      var add = host.querySelector('.reg-add');
      if (add) add.addEventListener('click', function () { kids.push({ m: kids[kids.length - 1].m }); render(); });

    }
    render();

    var leave = function () { try { sessionStorage.removeItem('cm-reg'); } catch (err) {} closeDrawer(); };
    portal.querySelector('.tnd-pane-scrim').addEventListener('click', leave);
    portal.querySelector('.tnd-pane-close').addEventListener('click', leave);
    portal.querySelector('.fam-start').addEventListener('click', function () {
      // Coming back from the children (Return), what was typed for the children
      // that are still here is kept; a removed child takes its details with it.
      var snaps = prior && prior.snaps ? prior.snaps.slice(0, kids.length) : [];
      var plan = { kids: kids.map(function (k) { return { m: k.m }; }), cur: 0, snaps: snaps, at: Date.now() };
      try { sessionStorage.setItem('cm-reg', JSON.stringify(plan)); } catch (err) {}
      var fam0 = snaps[0] && snaps[0].fam;
      swapToChild(portal, fam0 ? { n: fam0.n, a: fam0.a } : { mode: 'new', waitlist: kids[0].m === 'wait' });
    });
    var paneEl = portal.querySelector('.tnd-pane'), scrimEl = portal.querySelector('.tnd-pane-scrim');
    if (opt && opt.instant) {
      // Back from the first child: already in place, no slide.
      [paneEl, scrimEl].forEach(function (el) { el.style.transition = 'none'; el.classList.add('is-open'); });
      paneEl.getBoundingClientRect();
      setTimeout(function () { [paneEl, scrimEl].forEach(function (el) { el.style.transition = ''; }); }, 50);
      return;
    }
    requestAnimationFrame(function () {
      paneEl.classList.add('is-open');
      scrimEl.classList.add('is-open');
    });
  }
  // Return from the first child lands here again, with the plan as it was.
  window.cmOpenFamilySetup = function (plan, opt) {
    openSetup((plan.kids || [{ m: 'enroll' }]).map(function (k) { return { m: k.m }; }), plan, opt);
  };
  var REG_ICO = {
    kid: SV('<circle cx="12" cy="8" r="4"></circle><path d="M5.5 20a7 7 0 0 1 13 0"></path>', 1.9),
    wait: SV('<path d="M6.5 7h11"></path><path d="M6.5 17h11"></path><path d="M6 20v-2a6 6 0 1 1 12 0v2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z"></path><path d="M6 4v2a6 6 0 1 0 12 0V4a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"></path>', 1.8)
  };

  /* ---- the page ---------------------------------------------------------- */

  function placeholder() {
    return STATE.view === 'people' ? 'Search contacts: name, phone, email or household'
      : 'Search this view: surname, address, parent, child or phone';
  }

  function render(root) {
    STATE.view = /[?&]view=(people|contacts)\b/.test(window.location.hash || '') ? 'people' : 'households';
    root.innerHTML = '' +
      // Manage Children's own toolbar block: breadcrumb and page head, 20px apart.
      '<div class="tnd-dt-toolbar">' +
      '<nav class="breadcrumbs tnd-list-crumbs" aria-label="Breadcrumb">' +
        '<a href="dashboard" class="ajax-page-link">Dashboard</a><span class="sep">/</span>' +
        '<a href="children" class="ajax-page-link">Children</a><span class="sep">/</span>' +
        '<span class="current">Families</span>' +
      '</nav>' +

      /* Manage Children's own page head — .tnd-page-head with its icon tile, title,
         live-count subtitle and .btnContainer of actions — so the two pages share
         one header, buttons included. */
      '<div class="tnd-page-head tnd-page-head--icon fam-pagehead">' +
        '<div class="tnd-head-ico">' + ICON_HOME + '</div>' +
        '<div class="tnd-page-head-text"><h1 class="tnd-dt-title">Families</h1>' +
          // "120 households", or "2 of 120 households" while a search narrows the list.
          '<p class="tnd-dt-subtitle" id="famCount">' + ((FAMILIES && FAMILIES.length)
            ? '<b>' + FAMILIES.length + '</b> households' : 'Households') + '</p></div>' +
        '<div class="btnContainer text-right">' +
          '<a class="tnd-btn btn-add-waitlist fam-addwait" href="javascript:void(0);">' + HI.waitlist + 'Add to waiting list</a>' +
          '<div class="tnd-fpop-wrap fam-ie" data-fam-menu="">' +
            '<button type="button" class="tnd-btn" aria-haspopup="true" aria-expanded="false">' + HI.importIco +
              'Import / Export' + HI.chev + '</button>' +
            '<div class="tnd-chl-menu r" style="min-width:262px" role="menu">' +
              '<div class="tnd-chl-mhead">Bring in</div>' +
              '<a class="tnd-chl-mi ajax-page-link" href="import?entity=children" role="menuitem">' + HI.importIco +
                '<span class="sp">Import children</span></a>' +
              '<div class="tnd-chl-msep"></div>' +
              '<div class="tnd-chl-mhead">Take out</div>' +
              '<a class="tnd-chl-mi fam-export" data-scope="view" href="javascript:void(0);" role="menuitem">' + HI.exportIco +
                '<span class="sp">Export this view</span></a>' +
              '<a class="tnd-chl-mi fam-export" data-scope="all" href="javascript:void(0);" role="menuitem">' + HI.exportIco +
                '<span class="sp">Export every household</span></a>' +
            '</div>' +
          '</div>' +
          ' <a class="btn btn-primary btn-label-left tnd-btn-add fam-addfamily" href="javascript:void(0);"><span>' +
            HI.plus + '</span>Add family</a>' +
        '</div>' +
      '</div>' +
      '</div>' +

      /* The search is Manage Children's own component — .tnd-chl-bar around
         .tnd-chl-search, its icon, its "/" hint and its clear button — so it looks
         and behaves the same: "/" jumps to it, typing swaps the hint for the clear. */
      /* HOUSEHOLDS | PEOPLE (FAM-FAM-6) — the app's own segmented control. People
         lists every person once, however many households they are in, so one
         person can be found and edited without finding their family first. */
      '<div class="tnd-chl-bar fam-bar">' +
        '<div class="tnd-chl-seg fam-seg" role="tablist" aria-label="View">' +
          '<button type="button" role="tab" class="' + (STATE.view === 'households' ? 'is-active' : '') +
            '" data-view="households" aria-selected="' + (STATE.view === 'households') + '">Households</button>' +
          '<button type="button" role="tab" class="' + (STATE.view === 'people' ? 'is-active' : '') +
            '" data-view="people" aria-selected="' + (STATE.view === 'people') + '">Contacts</button>' +
        '</div>' +
        '<div class="tnd-chl-div"></div>' +
        '<div class="tnd-chl-search' + (STATE.q ? ' has-val' : '') + '" id="famSearchWrap">' + ICON_SEARCH +
          '<input id="famQ" type="text" autocomplete="off" aria-label="Search" ' +
          'placeholder="' + placeholder() + '" value="' + esc(STATE.q) + '">' +
          '<div class="hint"><button type="button" class="clr" id="famQClear" aria-label="Clear search">' +
          ICON_CLEAR + '</button><kbd>/</kbd></div>' +
        '</div>' +
        // People filter: Manage Children's own bar dropdown (.tnd-chl-sel), one choice.
        '<div class="tnd-chl-sel fam-psel" id="famPSel"' + (STATE.view === 'people' ? '' : ' hidden') + '>' +
          '<button type="button" class="trg" aria-haspopup="listbox" aria-expanded="false">' +
            '<svg class="lead" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" ' +
              'stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>' +
              '<circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path></svg>' +
            '<span class="lbl">All contacts</span>' + HI.chev.replace('<svg ', '<svg class="car" ') +
          '</button>' +
          '<div class="tnd-chl-menu r" role="listbox"></div>' +
        '</div>' +
      '</div>' +

      '<div class="fam-table">' +
        '<div class="fam-th" id="famTh"></div>' +
        '<div id="famRows"></div>' +
      '</div>';


    wireHead(root);
    var q = root.querySelector('#famQ'), wrap = root.querySelector('#famSearchWrap');
    q.addEventListener('input', function () {
      STATE.q = this.value;
      wrap.classList.toggle('has-val', !!this.value);
      renderList(root);
    });
    root.querySelectorAll('.fam-seg [data-view]').forEach(function (b) {
      b.addEventListener('click', function () {
        STATE.view = b.getAttribute('data-view');
        // Kept in the address, so a reload or a shared link lands on the same view.
        // replaceState does not fire hashchange, so the SPA router does not reload.
        try { history.replaceState(null, '', '#families' + (STATE.view === 'people' ? '?view=contacts' : '')); } catch (err) {}
        root.querySelectorAll('.fam-seg [data-view]').forEach(function (x) {
          var on = x === b;
          x.classList.toggle('is-active', on);
          x.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        root.querySelector('#famPSel').hidden = STATE.view !== 'people';
        q.placeholder = placeholder();
        renderList(root);
      });
    });
    root.querySelector('#famTh').addEventListener('change', function (e) {
      if (!e.target.matches('#famAll')) return;
      var sel = SEL[STATE.view] = {};
      if (e.target.checked) viewItems().forEach(function (x) { sel[x[0]] = true; });
      renderList(root);
    });
    var psel = root.querySelector('#famPSel');
    var setOpen = function (open) {
      psel.classList.toggle('is-open', open);
      psel.querySelector('.tnd-chl-menu').classList.toggle('is-open', open);
      psel.querySelector('.trg').setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    psel.querySelector('.trg').addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(!psel.classList.contains('is-open'));
    });
    psel.querySelector('.tnd-chl-menu').addEventListener('click', function (e) {
      var b = e.target.closest('[data-filter]');
      if (!b) return;
      STATE.filter = b.getAttribute('data-filter');
      setOpen(false);
      renderList(root);
    });
    document.addEventListener('click', function (e) { if (!psel.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    root.querySelector('#famQClear').addEventListener('click', function () {
      q.value = '';
      q.dispatchEvent(new Event('input', { bubbles: true }));
      q.focus();
    });
    // "/" goes to the search from anywhere on the page that is not already a field.
    if (!window.__famSlash) {
      window.__famSlash = true;
      document.addEventListener('keydown', function (e) {
        if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
        var t = e.target, tag = t && t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
        var box = document.getElementById('famQ');
        if (!box || !box.offsetParent) return;
        e.preventDefault();
        box.focus();
      });
    }
    root.querySelector('#famRows').addEventListener('click', function (e) {
      if (!e.target.closest) return;
      var keb = e.target.closest('.tnd-kebab');
      if (keb) { e.stopPropagation(); rowMenu(keb); return; }
      if (e.target.closest('.tnd-rowmenu')) return;
      var cb = e.target.closest('.fam-sel');
      if (cb) {
        var box = cb.querySelector('input');
        if (e.target !== box) box.checked = !box.checked;
        SEL[STATE.view][box.getAttribute('data-sel')] = box.checked;
        box.closest('.fam-row').classList.toggle('is-sel', box.checked);
        paintDock(root);
        return;
      }
      var row = e.target.closest('.fam-row');
      if (!row) return;
      if (row.hasAttribute('data-person')) {
        var p = personById(row.getAttribute('data-person'));
        if (p) openPerson(p);
        return;
      }
      var f = (FAMILIES || [])[parseInt(row.getAttribute('data-fam'), 10)];
      if (!f) return;
      row.classList.add('is-open');
      STATE.open = f;
      openDrawer(f);
    });

    root.querySelector('#famRows').addEventListener('keydown', function (e) {
      var row = e.target.classList && e.target.classList.contains('fam-row') ? e.target : null;
      if (!row) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        row.click();
      } else if (e.key === ' ') {
        // Space selects the row, as a checkbox would.
        e.preventDefault();
        row.querySelector('.fam-sel').click();
      }
    });

    renderList(root);
  }

  /* ---- the row menu ------------------------------------------------------
     Manage Children's own row menu — .tnd-kebab opening a fixed .tnd-chl-menu of
     .tnd-chl-mi items — with the three things a household row can actually do:
     open it, add a child to it, and call it. Add a child hands the household to
     the Add child page, which opens with it already picked under Family on file. */
  var ICON_KEBAB = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">' +
    '<circle cx="12" cy="5" r="1.7"></circle><circle cx="12" cy="12" r="1.7"></circle>' +
    '<circle cx="12" cy="19" r="1.7"></circle></svg>';
  var MI = function (d) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  };
  var ICON_EDIT = MI('<path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path>');
  var ICON_ADDCONTACT = MI('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M19 8v6M22 11h-6"></path>');
  var ICON_ARCHIVE = MI('<rect x="3" y="4" width="18" height="4" rx="1"></rect><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"></path>');
  var ICON_VIEW = MI('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle>');
  var ICON_ADDKID = MI('<circle cx="9" cy="8" r="4"></circle><path d="M2 21a7 7 0 0 1 14 0"></path><path d="M19 8v6M16 11h6"></path>');
  var ICON_CALL = MI('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"></path>');

  function closeMenus() {
    document.querySelectorAll('.fam-rowmenu-open').forEach(function (m) { m.remove(); });
    document.querySelectorAll('#famRows .tnd-kebab[aria-expanded="true"]').forEach(function (b) {
      b.setAttribute('aria-expanded', 'false');
      b.closest('.tnd-rowmenu').classList.remove('is-open');
    });
  }

  /* The People row menu: Edit person; a divider; Delete person — blocked
     while any link remains, saying how many (C2: removing a link is done from the
     household, and the person survives it). */
  function personMenu(btn) {
    var p = personById(btn.getAttribute('data-person'));
    if (!p) return;
    var holder = btn.closest('.tnd-rowmenu');
    var hh = p.links.length;
    var m = document.createElement('div');
    m.className = 'tnd-chl-menu r is-open is-fixed fam-rowmenu-open';
    m.setAttribute('role', 'menu');
    m.innerHTML =
      '<button type="button" class="tnd-chl-mi" role="menuitem" data-act="edit">' + ICON_EDIT + 'Edit contact</button>' +
      '<div class="tnd-chl-msep"></div>' +
      '<button type="button" class="tnd-chl-mi is-disabled" role="menuitem" data-act="delete" aria-disabled="true">' + ICON_ARCHIVE +
        '<span class="fam-mi-text">Delete contact<span class="fam-mi-why">Linked to ' + hh + (hh === 1 ? ' household' : ' households') +
        ' — remove them there first</span></span></button>';
    holder.appendChild(m);
    holder.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    var r = btn.getBoundingClientRect();
    var top = r.bottom + 6;
    if (top + m.offsetHeight > window.innerHeight - 12) top = Math.max(12, r.top - m.offsetHeight - 6);
    m.style.left = Math.max(12, r.right - m.offsetWidth) + 'px';
    m.style.top = top + 'px';
    m.addEventListener('click', function (e) {
      var it = e.target.closest('[data-act]');
      if (!it || it.getAttribute('aria-disabled') === 'true') return;
      closeMenus();
      if (it.getAttribute('data-act') === 'edit') editPerson(p);
    });
  }
  /* A child's row menu, inside an expanded household: open the child. Moving
     them to another household is Change on their own Family tab, not here. */
  function childMenu(btn) {
    var id = btn.getAttribute('data-child'), name = btn.getAttribute('data-childname');
    var holder = btn.closest('.tnd-rowmenu');
    var m = document.createElement('div');
    m.className = 'tnd-chl-menu r is-open is-fixed fam-rowmenu-open';
    m.setAttribute('role', 'menu');
    m.innerHTML = id
      ? '<button type="button" class="tnd-chl-mi" role="menuitem" data-act="open">' + ICON_VIEW + 'Open child</button>' +
        '<button type="button" class="tnd-chl-mi" role="menuitem" data-act="edit">' + ICON_EDIT + 'Edit details</button>'
      : '<button type="button" class="tnd-chl-mi is-disabled" role="menuitem" aria-disabled="true">' + ICON_VIEW +
        '<span class="fam-mi-text">Open child<span class="fam-mi-why">Not an active child in this sample</span></span></button>';
    holder.appendChild(m);
    holder.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    var r = btn.getBoundingClientRect();
    var top = r.bottom + 6;
    if (top + m.offsetHeight > window.innerHeight - 12) top = Math.max(12, r.top - m.offsetHeight - 6);
    m.style.left = Math.max(12, r.right - m.offsetWidth) + 'px';
    m.style.top = top + 'px';
    m.addEventListener('click', function (e) {
      var it = e.target.closest('[data-act]');
      if (!it || it.getAttribute('aria-disabled') === 'true') return;
      closeMenus();
      if (it.getAttribute('data-act') === 'open') openChild(id, name);
      else if (window.TndListDrawer) { closeDrawer(); window.TndListDrawer.open('children/edit/' + id, 'Edit child'); }
    });
  }

  function rowMenu(btn) {
    var open = btn.getAttribute('aria-expanded') === 'true';
    closeMenus();
    if (open) return;
    if (btn.hasAttribute('data-person')) { personMenu(btn); return; }
    if (btn.hasAttribute('data-child')) { childMenu(btn); return; }
    var f = (FAMILIES || [])[parseInt(btn.getAttribute('data-fam'), 10)];
    if (!f) return;
    var holder = btn.closest('.tnd-rowmenu');
    var m = document.createElement('div');
    m.className = 'tnd-chl-menu r is-open is-fixed fam-rowmenu-open';
    m.setAttribute('role', 'menu');
    /* The app's menu order: Edit first; then what is particular to a household;
       a divider; then the status change. No View (the row opens it) and no Call
       (the phone is a tappable row in the panel). No Delete: a household is ended
       by archiving it, and only once no child in it is enrolled or waiting. */
    var active = activeKids(f);
    m.innerHTML =
      // Edit household opens the family straight in its edit form (the same one the
      // panel's Edit opens).
      '<button type="button" class="tnd-chl-mi" role="menuitem" data-act="edit">' + ICON_EDIT + 'Edit household</button>' +
      '<button type="button" class="tnd-chl-mi" role="menuitem" data-act="addkid">' + ICON_ADDKID + 'Add a child</button>' +
      '<button type="button" class="tnd-chl-mi" role="menuitem" data-act="addcontact">' + ICON_ADDCONTACT + 'Add a contact</button>' +
      '<div class="tnd-chl-msep"></div>' +
      '<button type="button" class="tnd-chl-mi' + (active.length ? ' is-disabled' : '') + '" role="menuitem" data-act="archive"' +
        (active.length ? ' aria-disabled="true"' : '') + '>' + ICON_ARCHIVE +
        '<span class="fam-mi-text">Archive household' +
        (active.length ? '<span class="fam-mi-why">' + active.length + (active.length === 1 ? ' child is' : ' children are') +
          ' still enrolled or waiting</span>' : '') + '</span></button>';
    holder.appendChild(m);
    holder.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    var r = btn.getBoundingClientRect();
    var left = Math.max(12, r.right - m.offsetWidth);
    var top = r.bottom + 6;
    if (top + m.offsetHeight > window.innerHeight - 12) top = Math.max(12, r.top - m.offsetHeight - 6);
    m.style.left = left + 'px';
    m.style.top = top + 'px';

    m.addEventListener('click', function (e) {
      var it = e.target.closest('[data-act]');
      if (!it) return;
      var act = it.getAttribute('data-act');
      if (it.getAttribute('aria-disabled') === 'true') return;
      closeMenus();
      if (act === 'edit') {
        editHousehold(f);
      } else if (act === 'addcontact') {
        addContact(f);
      } else if (act === 'archive') {
        archiveHousehold(f);
      } else if (act === 'addkid') {
        // The app's own side panel (window.TndListDrawer — the same drawer a child
        // opens in), loaded with the Add child form: the household stays on
        // screen behind it instead of the page changing. The household is handed
        // over, so the form opens on Family on file with it already picked.
        try { sessionStorage.setItem('cm-add-family', JSON.stringify({ n: f.n, a: f.a })); } catch (err) {}
        closeDrawer();
        if (window.TndListDrawer && typeof window.TndListDrawer.open === 'function') {
          window.TndListDrawer.open('children/add', 'Add child');
        } else {
          var go = document.createElement('a');
          go.href = 'children/add';
          go.className = 'ajax-page-link';
          go.style.display = 'none';
          document.body.appendChild(go);
          go.click();
          go.remove();
        }
      }
    });
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('.fam-rowmenu-open, #famRows .tnd-kebab')) closeMenus();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenus(); });
  window.addEventListener('scroll', closeMenus, true);

  /* ---- wiring ------------------------------------------------------------
     The shell loads pages by AJAX, so the container arrives long after this
     file did. One observer covers both jobs: put the nav item back if the
     shell re-rendered, and fill the page container the moment it appears. */

  function tick() {
    if (injectNav() && document.readyState !== 'loading') { highlight(); }
    var root = document.getElementById('tndFamiliesPage');
    if (root && root.getAttribute('data-rendered') !== '1') {
      root.setAttribute('data-rendered', '1');
      load().then(function () { render(root); });
    }
    if (!root && document.querySelector('.fam-portal')) { closeDrawer(); }
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.querySelector('.fam-portal')) closeDrawer();
  });

  var t = null;
  function schedule() { clearTimeout(t); t = setTimeout(tick, 60); }

  injectNav();          // synchronous: must beat tendi-nav.js's ready handler

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule);
  } else {
    schedule();
  }
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
