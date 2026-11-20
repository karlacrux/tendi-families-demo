/* ---------------------------------------------------------------------------
   PROTOTYPE — the FAMILIES page, and the nav item that reaches it.
   Local sandbox only, never deployed.

   Closes the first item in "Still pending": `family_id` exists in the design,
   but nothing in the product lets anyone SEE a whole household. This adds

       Children  >  Families      <- first: the family is the main container
                    Children         (client review, 2026-10-28)
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
      .then(function (d) { FAMILIES = d.families || []; seedRelationships(); seedPhones(); seedHebrew(); seedExtras(); })
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
  /* SAMPLE NUMBERS (design review 11/18, section 3): in the sample data most families share one number
     between the home and both parents. These three get a home landline and a mobile per parent, with
     some permissions on and one other number that also gets notifications. Prototype data only. */
  var PHONE_SEED = {
    Thornley:  { home: '(732) 555-0101', homePerm: { text: false, mms: false, voice: true },
                 people: { 'Joel Neve Thornley': ['(347) 555-0125', { text: true, mms: true, voice: true }],
                           'Leo Thornley':       ['(347) 555-0194', { text: true, mms: false, voice: false }] },
                 primary: 'Joel Neve Thornley', also: ['Leo Thornley'] },
    Fenhurst:  { home: '(732) 555-0202', homePerm: { text: false, mms: false, voice: false },
                 people: { 'Rina Fenhurst': ['(347) 555-0231', { text: true, mms: true, voice: false }],
                           'Adam Fenhurst': ['(347) 555-0232', { text: false, mms: false, voice: true }] },
                 primary: 'Rina Fenhurst', also: [] },
    Corstead:  { home: '(732) 555-0303', homePerm: { text: false, mms: false, voice: true },
                 people: { 'Knox Corstead':      ['(212) 555-0155', { text: true, mms: false, voice: true }],
                           'Tara Ryan Corstead': ['(212) 555-0156', { text: true, mms: true, voice: false }] },
                 primary: 'Knox Corstead', also: ['Tara Ryan Corstead'] }
  };
  /* SAMPLE HEBREW NAMES AND TITLES (design review 11/18, 4.3) for the parents of four families. A
     person has the same Hebrew name in every family they are in. Prototype data only. */
  var HEBREW_SEED = {
    'Joel Neve Thornley': ['\u05d9\u05d5\u05d0\u05dc \u05e0\u05d5\u05d4', 'Mr.'],
    'Leo Thornley':       ['\u05dc\u05d0\u05d4', 'Mrs.'],
    'Adam Fenhurst':      ['\u05d0\u05d3\u05dd', 'Mr.'],
    'Rina Fenhurst':      ['\u05e8\u05d9\u05e0\u05d4', 'Mrs.'],
    'Hal Shelstead':      ['\u05d7\u05d9\u05d9\u05dd', 'Rabbi'],
    'Joy Joel Shelstead': ['\u05e9\u05de\u05d7\u05d4', 'Mrs.'],
    'Knox Corstead':      ['\u05e0\u05d7\u05de\u05df', 'Dr.'],
    'Tara Ryan Corstead': ['\u05ea\u05de\u05e8 \u05e8\u05d1\u05e7\u05d4', 'Ms.']
  };
  function seedHebrew() {
    (FAMILIES || []).forEach(function (f) {
      (f.contacts || []).forEach(function (c) {
        var h = HEBREW_SEED[c.n];
        if (!h) return;
        if (!c.heb) c.heb = h[0];
        if (!c.title) c.title = h[1];
      });
    });
  }

  /* MORE SAMPLE DATA: emails, work phones, the families' other addresses (one deactivated 12 days ago),
     a parent on a Mailing address, the pediatricians' details, and a grandmother in the Thornley family
     who is an emergency contact living at the family Home. Prototype data only. */
  var NO_PERM = { text: false, mms: false, voice: false };
  var EXTRA_SEED = {
    Thornley: {
      emails: { 'Joel Neve Thornley': ['joel.thornley@example.com', 'jthornley@northfield-works.example.com'], 'Leo Thornley': ['leo.thornley@example.com'] },
      work: { 'Joel Neve Thornley': '(732) 555-0410' },
      addrs: [{ id: 's-th-1', type: 'Mailing', value: 'PO Box 412, Lakewood, NJ 08701' },
              { id: 's-th-2', type: 'Summer home', value: '18 Lake Shore Dr, Monticello, NY 12701', off: 12 }],
      parentAddr: { 'Leo Thornley': 's-th-1' },
      people: [{ n: 'Esther Rothstein', t: 'Grandmother', phone: '(732) 555-0144', perm: { text: true, mms: false, voice: true },
                 email: 'esther.rothstein@example.com', home: true, emerg: 1, heb: '\u05d0\u05e1\u05ea\u05e8', title: 'Mrs.' }]
    },
    Fenhurst: {
      emails: { 'Adam Fenhurst': ['adam.fenhurst@example.com'], 'Rina Fenhurst': ['rina.fenhurst@example.com', 'rina@fenhurst-design.example.com'] },
      work: { 'Adam Fenhurst': '(732) 555-0420' },
      addrs: [{ id: 's-fe-1', type: 'Work', value: '50 Main St, Toms River, NJ 08753' }],
      emergency: ['Leo Thornley']
    },
    Shelstead: {
      emails: { 'Hal Shelstead': ['hal.shelstead@example.com'], 'Joy Joel Shelstead': ['joy.shelstead@example.com'] },
      addrs: [{ id: 's-sh-1', type: 'Mailing', value: 'PO Box 88, Lakewood, NJ 08701' }]
    },
    Corstead: {
      emails: { 'Knox Corstead': ['knox.corstead@example.com', 'dr.corstead@lakewood-clinic.example.com'], 'Tara Ryan Corstead': ['tara.corstead@example.com'] },
      work: { 'Knox Corstead': '(212) 555-0430' },
      addrs: [{ id: 's-co-1', type: 'Work', value: '300 Clinic Way, Lakewood, NJ 08701' }]
    }
  };
  function seedExtras() {
    (FAMILIES || []).forEach(function (f) {
      var x = EXTRA_SEED[f.n];
      if (!x) return;
      (f.contacts || []).forEach(function (c) {
        var em = (x.emails || {})[c.n];
        if (em) {
          c.emails = em.map(function (e, i) { return { type: i ? 'Work' : 'Personal', value: e, primary: !i }; });
          c.e = em[0];
        }
        var w = (x.work || {})[c.n];
        if (w) {
          var ph = (c.phones || (c.p ? [{ type: 'Mobile', value: c.p, primary: true, perm: permsOf(c), msg: c.msg }] : [])).slice();
          ph.push({ type: 'Work', value: w, primary: false, perm: { text: false, mms: false, voice: true }, msg: 'Voice' });
          c.phones = ph;
        }
        // The pediatrician: a practice phone, email and an address of its own.
        if (/^pediatrician$/i.test(c.t || '') && !c.addrs) {
          c.p = c.p || '(732) 555-0400';
          c.phones = [{ type: 'Work', value: c.p, primary: true, perm: NO_PERM, msg: 'None' }];
          c.emails = [{ type: 'Work', value: 'office@littlesteps-peds.example.com', primary: true }];
          c.e = c.emails[0].value;
          c.addrs = [{ type: 'Work', value: '120 Clinic Rd, Lakewood, NJ 08701', primary: true }];
        }
      });
      if (x.addrs) {
        f.addrs = (f.addrs || []).concat(x.addrs.map(function (a) {
          var o = { id: a.id, type: a.type, value: a.value };
          if (a.off) o.off = new Date(Date.now() - a.off * 86400000).toISOString();
          return o;
        }));
      }
      Object.keys(x.parentAddr || {}).forEach(function (n) {
        var c = (f.contacts || []).filter(function (k) { return k.n === n; })[0];
        if (c) { c.addrRef = x.parentAddr[n]; c.addr = ''; }
      });
      (x.people || []).forEach(function (pp) {
        if ((f.contacts || []).some(function (k) { return k.n === pp.n; })) return;
        var msg = pp.perm.text && pp.perm.voice ? 'SMS & Voice' : pp.perm.text ? 'SMS' : pp.perm.voice ? 'Voice' : 'None';
        var nc = { n: pp.n, t: pp.t, p: pp.phone, msg: msg, on: false, heb: pp.heb, title: pp.title,
                   phones: [{ type: 'Mobile', value: pp.phone, primary: true, perm: pp.perm, msg: msg }],
                   emails: [{ type: 'Personal', value: pp.email, primary: true }], e: pp.email,
                   addrs: pp.home ? [{ famRef: 'home', type: 'Home', value: '', primary: true }] : [] };
        if (pp.emerg) { nc.emerg = true; nc.emergOrder = pp.emerg; }
        f.contacts.push(nc);
      });
      (x.emergency || []).forEach(function (n, i) {
        var c = (f.contacts || []).filter(function (k) { return k.n === n; })[0];
        if (c) { c.emerg = true; c.emergOrder = i + 1; }
      });
    });
  }

  function seedPhones() {
    // A person's number is the same in every family they are in (Leo and Joel are also an aunt and uncle).
    var byPerson = {};
    Object.keys(PHONE_SEED).forEach(function (k) { Object.keys(PHONE_SEED[k].people).forEach(function (n) { byPerson[n] = PHONE_SEED[k].people[n]; }); });
    (FAMILIES || []).forEach(function (f) {
      var own = PHONE_SEED[f.n] ? PHONE_SEED[f.n].people : {};
      (f.contacts || []).forEach(function (c) {
        var ps = byPerson[c.n];
        if (!ps || own[c.n]) return;
        var msg = ps[1].text && ps[1].voice ? 'SMS & Voice' : ps[1].text ? 'SMS' : ps[1].voice ? 'Voice' : 'None';
        c.p = ps[0]; c.msg = msg;
        c.phones = [{ type: 'Mobile', value: ps[0], primary: true, perm: ps[1], msg: msg }];
      });
    });
    (FAMILIES || []).forEach(function (f) {
      var seed = PHONE_SEED[f.n];
      if (!seed) return;
      f.p = seed.home;
      f.homePerm = seed.homePerm;
      f.alsoNotify = f.alsoNotify || {};
      (f.contacts || []).forEach(function (c) {
        var ps = seed.people[c.n];
        if (!ps) return;
        var msg = ps[1].text && ps[1].voice ? 'SMS & Voice' : ps[1].text ? 'SMS' : ps[1].voice ? 'Voice' : 'None';
        c.p = ps[0];
        c.msg = msg;
        c.phones = [{ type: 'Mobile', value: ps[0], primary: true, perm: ps[1], msg: msg }];
        if (seed.primary === c.n) f.primaryPhone = ps[0].replace(/\D/g, '').slice(-10);
        if (seed.also.indexOf(c.n) > -1) f.alsoNotify[ps[0].replace(/\D/g, '').slice(-10)] = true;
      });
    });
  }

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

  /* The AREA is Families too (client review, 2026-10-28): the rail item and the
     sub-pane title say Families, with a family glyph in place of the single child:
     a roof over two adults and two children, in lines like the child icon. Drawn
     here because no icon in the rail's set shows a family this size. The group key
     stays "children", so every page and route in it is unchanged. */
  var AREA = 'Families';
  // Solid in the rail, like the icons around it; in lines inside the page and its steps.
  var RAIL_ICON = '<svg viewBox="0 0 24 24" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true">' +
    '<path d="M2 10.4 12 2.8l10 7.6" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"></path>' +
    '<circle cx="9.3" cy="10.8" r="1.8"></circle><path d="M6.9 20.5v-4.7a2.4 2.4 0 0 1 4.8 0v4.7z"></path>' +
    '<circle cx="14.7" cy="10.8" r="1.8"></circle><path d="M12.3 20.5v-4.7a2.4 2.4 0 0 1 4.8 0v4.7z"></path>' +
    '<circle cx="4.4" cy="14.4" r="1.4"></circle><path d="M2.5 20.5v-2a1.9 1.9 0 0 1 3.8 0v2z"></path>' +
    '<circle cx="19.6" cy="14.4" r="1.4"></circle><path d="M17.7 20.5v-2a1.9 1.9 0 0 1 3.8 0v2z"></path></svg>';
  var AREA_ICON = '<svg viewBox="0 0 24 24" width="1.25em" height="1.25em" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M2.5 10 12 2.8l9.5 7.2"></path><circle cx="8.7" cy="10.8" r="1.8"></circle><circle cx="15.3" cy="10.8" r="1.8"></circle><path d="M5.8 20.5v-2.2a2.9 2.9 0 0 1 5.8 0v2.2"></path><path d="M12.4 20.5v-2.2a2.9 2.9 0 0 1 5.8 0v2.2"></path><circle cx="3.6" cy="14.6" r="1.2"></circle><circle cx="20.4" cy="14.6" r="1.2"></circle><path d="M1.6 20.5v-1a2 2 0 0 1 2-2"></path><path d="M22.4 20.5v-1a2 2 0 0 0-2-2"></path></svg>';
  function renameArea() {
    var subnav = document.querySelector('.tnd-subnav[data-group="children"]');
    var rail = document.querySelector('.tnd-rail-item[data-group="children"]');
    if (subnav && subnav.getAttribute('data-title') !== AREA) {
      subnav.setAttribute('data-title', AREA);
      var title = document.getElementById('tndSubpaneTitle');
      if (title && !subnav.hidden && title.textContent.trim() === 'Children') title.textContent = AREA;
    }
    if (rail) {
      var lab = rail.querySelector('.tnd-rail-label');
      if (lab && lab.textContent !== AREA) lab.textContent = AREA;
      var ico = rail.querySelector('i');
      if (ico && ico.className !== 'fam-rail-ico') { ico.className = 'fam-rail-ico'; ico.innerHTML = RAIL_ICON; }
      if (rail.getAttribute('title') === 'Children') rail.setAttribute('title', AREA);
    }
  }

  function injectNav() {
    renameArea();
    var subnav = document.querySelector('.tnd-subnav[data-group="children"]');
    if (!subnav || subnav.querySelector('[data-url="families"]')) return false;

    var a = document.createElement('a');
    a.className = 'tnd-sub-item ajax-page-link';
    a.href = 'families';
    a.setAttribute('data-url', 'families');
    a.innerHTML = '<span class="tnd-sub-bullet"></span><span class="tnd-sub-text">Families</span>';

    // FIRST in the section (client review, 2026-10-28): the family is the main
    // container, so it comes before Children.
    subnav.insertBefore(a, subnav.firstChild);
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
    if (title) { title.textContent = AREA; }
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
    out.sort(function (a, b) { return (!!b.top - !!a.top) || (!!b.draft - !!a.draft) || (b.c - a.c) || a.n.localeCompare(b.n); });
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
          '<b>' + esc(f.n) + '</b>' + (f.draft ? '<span class="fam-draft">Draft</span>' : '') +
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

  // A parent's access level (6.1); other contacts carry no level of their own.
  function badge(c) {
    var em = c.emerg && !isPro(c.t) ? '<span class="fam-pill fam-empill">Emergency</span>' : '';
    if (!/^(mother|father)$/i.test(c.t || '')) return em;
    var lv = accessOf(c);
    return em + '<span class="cm-permnote fam-badge' + (lv === 'full' ? '' : ' limited') + '">' + ACCESS_TEXT[lv] + '</span>';
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
        '<span>Family</span><span>Children</span><span>Parents</span><span>Address</span><span>Phone</span><span></span>';
    }
    body.innerHTML = rows.length
      ? rows.map(function (f) { return rowHtml(f, (FAMILIES || []).indexOf(f)); }).join('')
      : '<div class="fam-empty"><b>No family matches that.</b>' +
        'The search reads the surname, the address, the phone, every child’s ' +
        'name and every contact’s name.</div>';

    if (count) {
      count.innerHTML = rows.length === (FAMILIES || []).length
        ? '<b>' + rows.length + '</b> families'
        : '<b>' + rows.length + '</b> of ' + (FAMILIES || []).length + ' families';
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
    exp: SVG_I('<path d="M12 21V8"></path><path d="m7 13 5-5 5 5"></path><path d="M3 3h18"></path>'),
    arc: SVG_I('<rect x="3" y="4" width="18" height="4" rx="1"></rect><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"></path>'),
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg>'
  };
  function SVG_I(d) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }

  /* The dock: Manage Children's own .tnd-seldock — the count, then what can be done
     to every selected row at once, then × to clear. Households: export them, archive
     them (only those with no child enrolled or waiting). Contacts: export them. */
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
    if (c.s === 'waitlist') return c.toEnroll ? 'Waiting list \u00b7 to enroll once the family is complete' : 'Waiting list';
    return 'Enrolled' + (c.cl ? ' · ' + c.cl : '');
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
    bill: SV('<path d="M5 3v18l2.5-1.5L10 21l2-1.5 2 1.5 2.5-1.5L19 21V3l-2.5 1.5L14 3l-2 1.5L10 3 7.5 4.5z"></path><path d="M9 9h6"></path><path d="M9 13h6"></path>'),
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

  /* ---- the family (client review, 2026-10-28) ----------------------------
     The family is the container. Its panel has four tabs — Details (the family and
     its parents), Children, Other contacts, Billing. As in registering a child, the
     tabs can be changed at any time, with nothing required: leaving a tab saves it
     automatically, and if it cannot be saved yet what was typed waits there. 
     Enrollment, health, transportation and tuition are the child's, so they live on
     the child's record, which the Children tab opens; a child is only ever added
     from inside a family. */
  var QUIET = false;   // an automatic save, on leaving a tab: says nothing, stops nothing
  function say(m) { if (!QUIET && window.tndToast) window.tndToast.success(m); }
  var PAY_METHODS = ['ACH', 'Cash', 'Credit Card'];
  /* The family's tabs (design review 11/18): Emergency contacts, Portal access and Ledger are
     the family's own. Creating a family walks FLOW, the tabs in their order. Portal access and Ledger only show; they have nothing to edit. */
  var FTABS = [['details', 'Details'], ['children', 'Children'], ['contacts', 'Contacts'], ['emergency', 'Emergency contacts'],
               ['billing', 'Billing']];
  // Portal access (6.6) and Ledger (6.7) come later: their tab bodies and wiring stay below, unused.
  // Save and continue follows the tabs in order; what registering needs is checked at the end (askReady).
  var FLOW = ['details', 'children', 'contacts', 'emergency', 'billing'];
  var NO_FORM = ['children', 'portal', 'ledger'];

  function famName(f) { return f.n ? f.n + ' family' : 'New family'; }

  /* PRIMARY CONTACT (4.1): stored on the family, not a tick on the person. Default father, then
     mother, then the first contact. Any family contact can be chosen. */
  function primaryOf(f) {
    var cs = (f && f.contacts) || [];
    if (f && f.primaryC && cs.indexOf(f.primaryC) > -1) return f.primaryC;
    return cs.filter(function (c) { return /^father$/i.test(c.t || ''); })[0] ||
           cs.filter(function (c) { return /^mother$/i.test(c.t || ''); })[0] || cs[0] || null;
  }

  /* WHO PAYS (6.2): a dropdown of the family's contacts, the primary contact unless another is
     named. Access level and paying are separate: a payment-only parent can pay. Only the
     professionals (the pediatrician, a car service) are left out. */
  function canPay(c) { return !!c && !isPro(c.t); }
  function payerOf(f) {
    var b = f.billing || {};
    if (b.payerC && (f.contacts || []).indexOf(b.payerC) > -1) return b.payerC;
    var p = primaryOf(f);
    return p && canPay(p) ? p : (f.contacts || []).filter(canPay)[0] || null;
  }

  /* ACCESS LEVEL (6.1): Full or Payment only, per parent per family. It belongs to the parent's
     portal login; until those exist in the new system it sits on the family membership. */
  function accessOf(c) { return c && c.access === 'payment' ? 'payment' : 'full'; }
  var ACCESS_TEXT = { full: 'Full access', payment: 'Payment only' };

  /* PHONE NUMBERS (section 3). Each number carries its own Text, MMS and Voice permissions. The
     family has one primary number that receives notifications; any other number with a
     permission can also be switched to receive them (off by default, an open decision). */
  var digits = function (v) { return String(v || '').replace(/\D/g, '').slice(-10); };
  function permsOf(x) {
    if (x && x.perm) return x.perm;
    var m = (x && x.msg) || 'None';
    return { text: /SMS/.test(m), mms: false, voice: /Voice/.test(m) };
  }
  function permText(p) {
    var on = [p.text && 'Text', p.mms && 'MMS', p.voice && 'Voice'].filter(Boolean);
    return on.length ? on.join(', ') : 'No messages';
  }
  /* Every number in the family, once each: the same number linked to the family and to a parent
     is one row with one set of permissions (3.1), named after everyone it is linked to. */
  function famNumbers(f) {
    var out = [], by = {};
    var push = function (who, type, value, perm, owner) {
      var d = digits(value);
      if (!d) return;
      var n = by[d];
      if (!n) {
        n = by[d] = { d: d, whos: [], type: type, value: value, perm: perm || { text: false, mms: false, voice: false }, owners: [], home: false };
        out.push(n);
      }
      if (n.whos.indexOf(who) < 0) n.whos.push(who);
      if (owner) { n.owners.push(owner); if (n.type === 'Home' && type !== 'Home') { n.type = type; n.perm = perm || n.perm; } }
      else n.home = true;
    };
    if (f.p) push('Home', 'Home', f.p, f.homePerm, null);
    (f.contacts || []).forEach(function (c) {
      if (isPro(c.t)) return;
      listsOf(c, f).phone.forEach(function (x) {
        push(String(c.n || '').split(' ')[0], x.type === 'Cell' ? 'Mobile' : x.type, x.value, permsOf(x), c);
      });
    });
    out.forEach(function (n) {
      n.owner = n.owners[0] || null;
      n.who = n.whos.filter(function (w) { return w !== 'Home'; }).join(', ') || 'Home';
      if (n.home && n.owners.length) n.who += ' \u00b7 also the home phone';
    });
    return out;
  }
  // The primary number: as chosen, else the primary contact's mobile, else the first with Text on.
  // Never a home-only landline by default.
  function primaryNumber(f) {
    var list = famNumbers(f);
    if (f.primaryPhone) { var hit = list.filter(function (n) { return n.d === f.primaryPhone; })[0]; if (hit) return hit; }
    var pc = primaryOf(f), mob = function (n) { return n.owners.length && n.type !== 'Home'; };
    return list.filter(function (n) { return mob(n) && n.owners.indexOf(pc) > -1; })[0] ||
           list.filter(function (n) { return mob(n) && n.perm.text; })[0] ||
           list.filter(mob)[0] || null;
  }

  /* EMERGENCY CONTACTS (5.1): the family's, ordered as the calling order. Required to enroll a
     child. May pick up stays a separate, per-child permission. */
  /* An emergency contact is one of the family's contacts with "Emergency contact" on (c.emerg) and a
     place in the calling order (c.emergOrder). The Contacts tab and the Emergency contacts tab show the
     same records, so a change in one is in the other. */
  var EMERG_RELS = TYPES.filter(function (t) { return !/^(car service|pediatrician|other doctor|therapist|caseworker)$/i.test(t); });
  function emergOf(f) {
    return (f.contacts || []).filter(function (c) { return c.emerg && !isPro(c.t); })
      .sort(function (a, b) { return (a.emergOrder || 0) - (b.emergOrder || 0); });
  }
  function phoneOf(c, f) { var ph = listsOf(c, f).phone[0]; return (ph && ph.value) || c.p || ''; }
  function emergList(f) { return emergOf(f).map(function (c) { return { n: c.n, t: c.t, p: phoneOf(c, f) }; }); }
  // Turn the setting on or off for one contact; a contact newly on goes to the end of the calling order.
  function setEmerg(f, c, on) {
    if (on && !c.emerg) c.emergOrder = emergOf(f).reduce(function (m, x) { return Math.max(m, x.emergOrder || 0); }, 0) + 1;
    c.emerg = !!on;
  }
  // A contact's phone, written where the number lives (the first in their list).
  function setPhone(c, f, v) {
    var ls = listsOf(c, f).phone;
    if (ls.length) { c.phones = ls.map(function (x, i) { return i === 0 ? Object.assign({}, x, { value: v }) : x; }); c.p = v; }
    else { c.p = v; c.phones = v ? [{ type: 'Mobile', value: v, primary: true, perm: { text: false, mms: false, voice: false } }] : null; }
  }

  // Required once a child is enrolled, waiting-list children aside: the asterisk on Home address and Emergency contacts.
  function needsEnrollInfo(f) { return kidsOfHousehold(f).some(function (k) { return k.s === 'enrolled'; }); }
  var REQ = ' <span class="fam-req" title="Required to enroll a child">*</span>';
  /* HELP AS A TOOLTIP (as reviewed 11/20): an (i) in a circle beside the label; the text shows on hover
     or keyboard focus, instead of a line under the field. */
  function INFO(text) {
    return ' <span class="fam-info" tabindex="0" role="img" aria-label="' + esc(text) + '" data-tip="' + esc(text) + '">' +
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4M12 8h.01"></path></svg></span>';
  }
  window.famInfo = INFO;

  /* What a draft family still needs before a child can be enrolled (4.5). */
  function missingForEnroll(f) {
    var miss = [];
    if (!emergOf(f).length) miss.push('An emergency contact');
    if (!homeText(f)) miss.push('A Home address');
    if (!primaryOf(f)) miss.push('A primary contact');
    if (!primaryNumber(f)) miss.push('A primary number');
    return miss;
  }

  /* ADDRESSES ARE THE FAMILY'S, LINKED, NEVER COPIED (design review 11/18, section 2).
     A family has one Home (f.a, which the children are still matched by) and any number
     of other addresses (f.addrs). A parent with no link of their own uses the Home; a
     parent who lives elsewhere links to one of the family's addresses (c.addrRef), so a
     move edits one row and everyone who uses it sees it. Other contacts (a grandmother,
     the pediatrician) keep an address of their own. Types come from a lookup centers can
     add to; the prototype seeds Home, Mailing, Work and Other. */
  /* ADDRESS TYPES ARE A LOOKUP (design review 11/18, 2.1 and 2.7), set on Settings > Address types:
     ordered, renamed, added, deactivated, and deleted only once deactivated. Home is the system one
     (one per family, never deactivated); Other lets people name their own. A deactivated type is not
     offered for new addresses; typing its name again brings it back. Seeded: Home, Mailing, Work, Other. */
  var DAY = 86400000;
  var ADDR_TYPE_LIST = [
    { name: 'Home', system: true, note: 'One per family. Can\u2019t be deactivated.' },
    { name: 'Mailing' },
    { name: 'Work' },
    { name: 'Other', system: true, note: 'Lets people name their own type.' }
  ];
  function activeTypes(withHome) {
    return ADDR_TYPE_LIST.filter(function (t) { return !t.off && (withHome || t.name !== 'Home'); }).map(function (t) { return t.name; });
  }
  var typeByName = function (n) { return ADDR_TYPE_LIST.filter(function (t) { return t.name.toLowerCase() === String(n || '').trim().toLowerCase(); })[0]; };
  var daysOff = function (t) { return Math.max(0, Math.floor((Date.now() - new Date(t.off).getTime()) / DAY)); };
  var daysText = function (n) { return n === 0 ? 'today' : n === 1 ? '1 day' : n + ' days'; };
  // Someone used a deactivated type's name (picked as Other, or added again): it is active again.
  function reactivateTypes(names) {
    (names || []).forEach(function (n) {
      var t = typeByName(n);
      if (!t || !t.off) return;
      var d = daysOff(t);
      delete t.off;
      if (window.tndToast) window.tndToast.success('\u201c' + t.name + '\u201d was deactivated ' + (d ? 'for ' + daysText(d) : 'today') + '. It is active again.');
    });
  }
  window.famAddrTypesAll = function () { return activeTypes(true); };
  var ADDR_N = 0;
  var isParentC = function (c) { return /^(mother|father)$/i.test((c && c.t) || ''); };
  var homeText = function (f) { return String((f && f.a) || '').replace(/,?\s*USA$/i, ''); };
  function addrLine(a) {
    return [a.line1, a.line2 ? 'Apt ' + String(a.line2).replace(/^apt\.?\s*/i, '') : '', a.city,
            [a.state, a.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  }
  // Once per family: a parent's own address in the mock data becomes one of the family's.
  function initAddrs(f) {
    if (!f || f._addrInit) return;
    f._addrInit = true;
    f.addrs = f.addrs || [];
    var home = homeText(f).toLowerCase();
    parentsOf(f).forEach(function (c) {
      var own = String(c.addr || '').replace(/,?\s*USA$/i, '').trim();
      if (!own || c.addrRef) return;
      if (own.toLowerCase() === home) { c.addr = ''; return; }
      var hit = f.addrs.filter(function (a) { return a.value.toLowerCase() === own.toLowerCase(); })[0];
      if (!hit) { hit = { id: 'a' + (++ADDR_N), type: 'Mailing', value: own }; f.addrs.push(hit); }
      c.addrRef = hit.id;
      c.addr = '';
      c.addrs = null;
    });
  }
  function famAddrs(f) {
    initAddrs(f);
    var home = homeText(f);
    // A deactivated address (Manage addresses) is kept but not offered.
    return (home ? [{ id: 'home', type: 'Home', value: home }] : []).concat(((f && f.addrs) || []).filter(function (a) { return !a.off; }));
  }
  function addrById(f, id) { return famAddrs(f).filter(function (a) { return a.id === (id || 'home'); })[0] || null; }
  // The parents who use an address: the Home is everyone without a link of their own.
  function addrUsers(f, id) {
    return parentsOf(f).filter(function (c) {
      return id === 'home' ? !c.addrRef || !addrById(f, c.addrRef) : c.addrRef === id;
    });
  }
  // Who a change to the family Home reaches: the parents on it, and billing when it bills to the Home.
  // Family contacts (not parents) who picked one of the family's addresses in Manage addresses: a link.
  function linkedContacts(f, id) {
    return (f.contacts || []).filter(function (c) {
      return !isParentC(c) && (c.addrs || []).some(function (a) { return a.famRef === id && !a.off; });
    });
  }
  // A contact's address entry as shown: a link reads the family's address as it is now.
  function resolveAddr(f, a) {
    if (!a || !a.famRef) return a;
    var fa = addrById(f, a.famRef);
    return fa ? Object.assign({}, a, { type: fa.type, value: fa.value, linkedTo: fa.id }) : null;
  }
  function homeImpact(f) {
    var who = addrUsers(f, 'home').concat(linkedContacts(f, 'home')).map(function (c) { return String(c.n || '').split(' ')[0]; });
    if (homeText(f) && !((f.billing || {}).addrId && addrById(f, f.billing.addrId))) who.push('the billing address');
    return who;
  }
  var listText = function (xs) { return xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]; };

  function parentAddr(c, f) { return (c.addrRef && addrById(f, c.addrRef)) || addrById(f, 'home'); }
  function addFamAddr(f, type, value) {
    initAddrs(f);
    var a = { id: 'a' + (++ADDR_N), type: type || 'Other', value: value };
    f.addrs.push(a);
    return a;
  }
  // What a parent's address picker chose, kept on the contact: a link, never the text.
  function applyAddrChoice(f, c, r) {
    if (!r || !r.addrPick || !isParentC(c)) return;
    var id = r.addrPick;
    if (id === '__new') id = r.addrNew && r.addrNew.value ? addFamAddr(f, r.addrNew.type, r.addrNew.value).id : 'home';
    if (id === 'home') delete c.addrRef; else c.addrRef = id;
    c.addr = '';
    c.addrs = null;
  }

  /* A small pop-up inside the family panel (no page change): the billing address's
     "Add new", a parent's "Add new address" and the delete check use it. */
  function famPop(title, bodyHtml, okLabel, onOk, danger) {
    var pane = document.querySelector('.fam-setportal .tnd-pane') || document.querySelector('.fam-portal .tnd-pane');
    if (!pane) return null;
    var old = pane.querySelector('.fam-pop'); if (old) old.remove();
    var pop = document.createElement('div');
    pop.className = 'fam-pop';
    pop.innerHTML = '<div class="fam-pop-card" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
      '<h3 class="fam-pop-title">' + esc(title) + '</h3><div class="fam-pop-body">' + bodyHtml + '</div>' +
      '<div class="fam-pop-acts"><button type="button" class="btn-sm fam-pop-cancel">Cancel</button>' +
      '<button type="button" class="btn-sm ' + (danger ? 'fam-pop-danger' : 'primary') + ' fam-pop-ok">' + esc(okLabel) + '</button></div></div>';
    pane.appendChild(pop);
    var close = function () { pop.remove(); if (pop._onCancel) pop._onCancel(); };
    pop.querySelector('.fam-pop-cancel').addEventListener('click', close);
    pop.addEventListener('click', function (e) { if (e.target === pop) close(); });
    pop.querySelector('.fam-pop-ok').addEventListener('click', function () {
      if (onOk(pop) === false) return;
      pop._onCancel = null;
      pop.remove();
    });
    var first = pop.querySelector('input, select');
    if (first) first.focus();
    return pop;
  }
  /* "OTHER" CAN BE NAMED, everywhere a type is picked: choosing Other opens a field beside it to
     say what it is ("Grandma's house", "Neighbor upstairs"); that name is then the type shown.
     A type on file that is not in the list arrives as Other with its name filled in. */
  function typePicker(attrs, types, cur, label, example) {
    var custom = cur && types.map(function (t) { return t.toLowerCase(); }).indexOf(String(cur).toLowerCase()) < 0 ? cur : '';
    var sel = custom ? 'Other' : cur;
    return '<span class="fam-typebox"><select class="form-control fam-hasother" ' + attrs + ' aria-label="' + label + '">' + types.map(function (t) {
        return '<option' + (String(t).toLowerCase() === String(sel || '').toLowerCase() ? ' selected' : '') + '>' + t + '</option>';
      }).join('') + '</select>' +
      '<input type="text" class="form-control fam-othername" maxlength="40" placeholder="Name it, e.g. ' + esc(example) + '" aria-label="Name this ' + label.toLowerCase() + '" value="' + esc(custom) + '"' + (sel === 'Other' ? '' : ' hidden') + '></span>';
  }
  // The type a picker holds: the name typed for Other, else the choice.
  function readType(sel) {
    if (!sel) return '';
    var nm = sel.parentNode.querySelector('.fam-othername');
    return sel.value === 'Other' && nm && nm.value.trim() ? nm.value.trim() : sel.value;
  }
  document.addEventListener('change', function (e) {
    var sel = e.target.closest && e.target.closest('.fam-hasother');
    if (!sel) return;
    var nm = sel.parentNode.querySelector('.fam-othername');
    if (!nm) return;
    nm.hidden = sel.value !== 'Other';
    if (!nm.hidden) nm.focus();
  });

  function addrFields(prefix) {
    // Laid out like a contact's address row: the type beside Address line 1, then two fields a row.
    var inp = function (x) {
      return '<input type="text" class="form-control" data-' + prefix + '="' + x[0] + '" placeholder="' + x[1] + '" aria-label="' + x[1] + '" autocomplete="off">';
    };
    return '<div class="fam-afields">' +
      '<div class="fam-afrow1">' + typePicker('data-' + prefix + '="type"', activeTypes(), activeTypes()[0], 'Address type', 'Grandma\u2019s house') +
        inp(['line1', 'Address line 1']) + '</div>' +
      '<div class="fam-afgrid">' + [['line2', 'Apt or unit'], ['city', 'City'], ['state', 'State'], ['zip', 'ZIP code']].map(inp).join('') + '</div></div>';
  }
  function readAddrFields(root, prefix) {
    var v = function (k) { var x = root.querySelector('[data-' + prefix + '="' + k + '"]'); return x ? x.value.trim() : ''; };
    var ty = readType(root.querySelector('[data-' + prefix + '="type"]'));
    if (v('line1')) reactivateTypes([ty]);
    return { type: ty, value: addrLine({ line1: v('line1'), line2: v('line2'), city: v('city'), state: v('state'), zip: v('zip') }), line1: v('line1') };
  }
  // "Add new address": the pop-up, then the new address is the family's and is chosen.
  function addrPop(f, onAdd, onCancel) {
    var pop = famPop('New address for the ' + famName(f), addrFields('np') +
      '<p class="fam-pop-note">It is added to the family\u2019s addresses, so anyone in the family can use it.</p>', 'Add address', function (p) {
      var a = readAddrFields(p, 'np');
      if (!a.line1) {
        if (window.tndToast) window.tndToast.error('Enter the address line first.');
        p.querySelector('[data-np="line1"]').focus();
        return false;
      }
      onAdd(a);
    });
    if (pop) pop._onCancel = onCancel || null;
    return pop;
  }
  window.famAddr = { list: famAddrs, byId: addrById, add: addFamAddr, pop: addrPop, users: addrUsers };

  // The billing address: one of the family's addresses, the Home unless another was picked.
  function billAddress(f) {
    var a = addrById(f, (f.billing || {}).addrId);
    return a ? a.type + ' · ' + a.value : '';
  }

  // Version B calls the family's first tab Household.
  function ftabName(t) {
    return t[0] === 'details' && document.documentElement.classList.contains('fam-b') ? 'Household' : t[1];
  }

  function openDrawer(f, tab, opts) {
    opts = opts || {};
    var old = document.querySelector('.fam-portal');
    var stay = !!(old && old._fam === f) || !!opts.instant;   // same family, other tab: no slide
    if (old) old.remove();
    var st = { tab: tab || 'details', edit: !!opts.edit, dirty: false, held: {} };
    if (f.isNew) { st.tab = 'details'; st.edit = true; }
    if (f.bFlow) st.edit = true;

    var portal = document.createElement('div');
    portal.className = 'tendi-skin tnd-drawer-portal fam-portal';
    portal._fam = f;
    portal.innerHTML =
      '<div class="tnd-pane-scrim tnd-drawer-scrim"></div>' +
      '<aside class="tnd-pane tnd-drawer fam-fdrawer" role="dialog">' +
        '<div class="tnd-pane-head">' +
          '<span class="up-head-eyebrow"><span class="up-eb-view fam-eb"></span><span class="up-eb-edit fam-eb-edit"></span></span>' +
          '<span class="up-head-spacer"></span>' +
          '<div class="tnd-pane-head-actions">' +
            '<span class="fam-hacts"></span>' +
            '<button type="button" class="tnd-pane-close" aria-label="Close">' + DI.close + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="tnd-pane-body is-ready"><div class="tnd-pane-view fam-fview"></div></div>' +
      '</aside>';
    document.body.appendChild(portal);
    var pane = portal.querySelector('.tnd-pane'), scrim = portal.querySelector('.tnd-pane-scrim');
    var host = portal.querySelector('.fam-fview');

    var label = function (k) { return ftabName(FTABS.filter(function (t) { return t[0] === k; })[0]); };
    var go = function (k, edit) { st.tab = k; st.edit = !!edit; st.dirty = Object.keys(st.held).length > 0; paint(); };
    // Is the open tab showing a form? Children has none, and a family not saved yet has no billing to edit.
    var editing = function () { return st.edit && NO_FORM.indexOf(st.tab) < 0 && !(f.isNew && st.tab === 'billing' && !document.documentElement.classList.contains('fam-b')); };
    // Leaving a tab saves it, silently. A new family saves once it has its name; a form
    // that cannot be saved yet stays in the page (false) and is set aside by leave().
    var autosave = function () {
      var form = host.querySelector('.fam-editform');
      if (!form) return true;
      if (f.isNew) {
        var nm = form.querySelector('[data-k="name"]');
        if (st.tab !== 'details' || !nm || !nm.value.trim()) return false;
      } else if (!st.dirty) { form.remove(); delete st.held[st.tab]; return true; }
      QUIET = true;
      var res;
      try { res = TAB_SAVE[st.tab](f, form); } finally { QUIET = false; }
      if (res === false) return false;
      form.remove();
      delete st.held[st.tab];
      st.dirty = Object.keys(st.held).length > 0;
      refresh();
      return true;
    };
    var leave = function (k, edit) {
      autosave();
      var cur = host.querySelector('.fam-editform');
      if (cur) { st.held[st.tab] = cur; cur.remove(); }
      st.tab = k;
      if (edit) st.edit = true;
      paint();
    };
    /* Creating a family is editing one that does not exist yet: the same panel, tabs and
       buttons. It becomes real once it has its name, on leaving Details, on Save, or on
       adding a child, who needs a family to join. Until then the other tabs just wait. */
    var commitNew = function () {
      if (!f.isNew) return true;
      var form = st.tab === 'details' ? host.querySelector('.fam-editform') : st.held.details;
      var nm = form && form.querySelector('[data-k="name"]');
      if (!nm || !nm.value.trim()) {
        if (window.tndToast) window.tndToast.error('Give the family a name first.');
        if (st.tab !== 'details') leave('details');
        var back = host.querySelector('[data-k="name"]');
        if (back) back.focus();
        return false;
      }
      QUIET = true;
      try { TAB_SAVE.details(f, form); } finally { QUIET = false; }
      if (st.tab === 'details') form.remove();
      delete st.held.details;
      return true;
    };
    // What other tabs were left holding, saved with this one. One that cannot be yet stays.
    var flushHeld = function () {
      Object.keys(st.held).forEach(function (k) {
        QUIET = true;
        var res;
        try { res = TAB_SAVE[k](f, st.held[k]); } finally { QUIET = false; }
        if (res !== false) delete st.held[k];
      });
    };

    function hero() {
      var n = kids(f).length, nc = (f.contacts || []).length;
      return '<section class="vB-hero fam-fhero">' +
        '<span class="vB-avatar ' + acc(f.n || 'new') + '" aria-hidden="true">' + esc(String(f.n || '+').charAt(0).toUpperCase()) + '</span>' +
        '<h2 class="vB-name">' + esc(famName(f)) + '</h2>' +
        '<div class="vB-hero-meta"><span class="vB-idtag">' +
          (f.isNew ? 'Not saved yet' : n + (n === 1 ? ' child' : ' children') + ' · ' + nc + (nc === 1 ? ' contact' : ' contacts')) +
          '</span>' + (f.draft && !f.isNew ? '<span class="fam-draft">Draft</span>' : '') + '</div>' +
      '</section>';
    }

    function tabs() {
      return '<div class="tnd-tabs fam-ftabs" role="tablist">' + FTABS.map(function (t) {
        return '<button type="button" role="tab" class="tnd-tab' + (st.tab === t[0] ? ' is-active' : '') + '" data-ftab="' + t[0] + '"' +
          ' aria-selected="' + (st.tab === t[0]) + '">' + ftabName(t) + '</button>';
      }).join('') + '</div>';
    }

    /* LEAVING A FAMILY BEING CREATED (design review 11/18, 4.5): if it can't be registered yet, a
       pop-up lists what is missing, children included, and offers to complete it now or to keep
       it as a draft and finish later. Nothing is lost either way. */
    var readyList = function () {
      var miss = missingForEnroll(f).map(function (m) {
        return { text: m, tab: /emergency/i.test(m) ? 'emergency' : 'details' };
      });
      if (!kids(f).length) miss.push({ text: 'A child', tab: 'children' });
      return miss;
    };
    // A draft family can't enroll yet (4.5): a child being enrolled goes on the waiting list, marked
    // so that enrolling them is easy to pick up once the family is complete.
    var asDraft = function () {
      var moved = 0;
      (f.extra || []).forEach(function (k) { if (k.s === 'enrolled') { k.s = 'waitlist'; k.toEnroll = true; moved++; } });
      delete f.bFlow; delete f.creating;
      f.draft = true;
      refresh();
      closeDrawer();
      if (window.tndToast) window.tndToast.success('Saved as a draft.' + (moved ? (moved === 1 ? ' The child is' : ' The children are') + ' on the waiting list until the family is complete.' : ' Open the family any time to finish it.'));
    };
    var finishNow = function () {
      delete f.bFlow; delete f.creating;
      f.draft = false;
      refresh();
      closeDrawer();
      if (window.tndToast) window.tndToast.success('Family saved.');
    };
    var askReady = function () {
      var miss = readyList();
      if (!miss.length) return false;
      var pop = famPop('This family isn\u2019t ready to register yet', '<p>To register it, add:</p><ul class="fam-misslist">' + miss.map(function (m) {
          return '<li>' + esc(m.text) + '</li>';
        }).join('') + '</ul><p class="fam-pop-note">Or save it as a draft and finish later. Everything entered so far is kept' +
          ((f.extra || []).some(function (k) { return k.s === 'enrolled'; }) ? ', and the children go on the waiting list until the family is complete.' : '.') + '</p>',
        'Complete now', function () { leave(miss[0].tab, true); });
      if (pop) {
        var cancel = pop.querySelector('.fam-pop-cancel'), keep = cancel.cloneNode(true);
        keep.textContent = 'Save as draft, finish later';
        cancel.replaceWith(keep);
        keep.addEventListener('click', function () { pop.remove(); asDraft(); });
      }
      return true;
    };
    var creating = function () { return !f.isNew && (f.bFlow || f.creating); };

    // Tendi's edit rule, in the panel head like every record: Edit in view; Cancel and
    // Save in edit. They act on the open tab only: each tab saves on its own.
    function actions() {
      // The same on every tab: Edit when viewing; Cancel and Save when editing or creating.
      // Children, Portal access and Ledger have nothing to edit: their actions are in the tab.
      if (!st.edit) return NO_FORM.indexOf(st.tab) > -1 ? '' : '<button type="button" class="btn-sm primary tnd-drawer-edit fam-tedit">' + ICON_EDIT + ' Edit</button>';
      return '<button type="button" class="btn-sm tnd-drawer-cancel fam-tcancel">Cancel</button>' +
        '<button type="button" class="btn-sm primary tnd-drawer-save fam-tsave">' + ICON_SAVE + (f.bFlow && st.tab !== FLOW[FLOW.length - 1] ? ' Save and continue' : ' Save') + '</button>';
    }

    function bar() { return ''; }

    function paint() {
      var on = editing(), held = on ? st.held[st.tab] : null;
      pane.classList.toggle('is-readonly', !on);
      pane.classList.toggle('is-editing', st.edit);
      portal.querySelector('.fam-hacts').innerHTML = actions();
      portal.querySelector('.fam-eb-edit').textContent = f.isNew ? 'New family' : 'Editing ' + label(st.tab).toLowerCase();
      pane.setAttribute('aria-label', famName(f));
      portal.querySelector('.fam-eb').textContent = f.isNew ? 'New family' : 'Family';
      var body = held ? '' : TAB_BODY[st.tab](f, on);
      host.innerHTML = hero() + tabs() + bar() +
        (held ? '<div class="fam-heldslot"></div>'
          : on ? '<form class="form-horizontal tnd-pane-edit fam-editform" onsubmit="return false">' + body + '</form>'
               : '<div class="fam-tbody">' + body + '</div>');
      if (held) { host.querySelector('.fam-heldslot').replaceWith(held); delete st.held[st.tab]; }
      wire(!held);
      var after = TAB_WIRE[st.tab];
      if (after && !held) after(f, portal, { edit: on }, opts);
      opts = {};
    }

    function wire(fresh) {
      host.querySelectorAll('[data-ftab]').forEach(function (b) {
        b.addEventListener('click', function () {
          var k = b.getAttribute('data-ftab');
          if (k !== st.tab) leave(k);
        });
      });
      var ed = portal.querySelector('.fam-tedit');
      if (ed) ed.addEventListener('click', function () { go(st.tab, true); });
      var cn = portal.querySelector('.fam-tcancel');
      if (cn) cn.addEventListener('click', function () {
        if (creating()) { autosave(); flushHeld(); if (!askReady()) finishNow(); else paint(); return; }
        if (f.isNew || f.bFlow) { closeDrawer(); return; }
        var open = host.querySelector('.fam-editform');
        if (open) open.remove();
        st.held = {};
        go(st.tab, false);
      });
      var sv = portal.querySelector('.fam-tsave');
      if (sv) sv.addEventListener('click', function () {
        var form = host.querySelector('.fam-editform');
        if (st.tab !== 'details' && !commitNew()) return;
        // The last tab of a new family says the family is saved, not the tab.
        var finishing = !!f.bFlow && st.tab === FLOW[FLOW.length - 1];
        // Children, and a family's billing before it exists, have no form of their own.
        QUIET = finishing;
        var saved;
        try { saved = form ? TAB_SAVE[st.tab](f, form) : true; } finally { QUIET = false; }
        if (saved === false) return;
        delete f.creating;                              // Save is the end of creating it
        if (form) form.remove();
        flushHeld();
        refresh();
        if (f.bFlow) {
          // On to the next tab, still open; the last one finishes the family.
          var at = FLOW.indexOf(st.tab);
          if (at > -1 && at < FLOW.length - 1) { go(FLOW[at + 1], true); return; }
          // The last step: registered if nothing is missing, otherwise ask (complete now or draft).
          if (askReady()) return;
          finishNow();
          return;
        }
        go(st.tab, false);
      });
      var form = host.querySelector('.fam-editform');
      if (form && fresh) {
        var mark = function () { st.dirty = true; };
        form.addEventListener('input', mark);
        form.addEventListener('change', mark);
        form.addEventListener('click', function (e) { if (e.target.closest('button')) mark(); });
      }
      var ca = host.querySelector('.fam-caddview');
      if (ca) ca.addEventListener('click', function () { opts = { addContact: true }; go('contacts', true); });
      host.querySelectorAll('.fam-kidadd').forEach(function (b) {
        b.addEventListener('click', function () {
          if (!commitNew()) return;
          // A child can be added at any time; what registering still needs is checked on Save or on leaving (askReady).
          addChild(f, b.getAttribute('data-m'));
        });
      });
      host.querySelectorAll('.fam-toperson').forEach(function (a) {
        a.addEventListener('click', function () { var p = personById(a.getAttribute('data-person')); if (p) openPerson(p); });
      });
      host.querySelectorAll('.fam-tochild').forEach(function (a) {
        a.addEventListener('click', function () { openChild(a.getAttribute('data-child'), a.getAttribute('data-childname')); });
      });
      host.querySelectorAll('[data-goto]').forEach(function (a) {
        a.addEventListener('click', function () { go(a.getAttribute('data-goto'), false); });
      });
    }

    // Leaving the panel saves too, as leaving a tab does; Cancel is how changes are thrown away.
    var shut = function () {
      autosave();
      if (!f.isNew) flushHeld();
      if (creating()) { if (!askReady()) finishNow(); else paint(); return; }   // the tab stays as it was behind the pop-up
      closeDrawer();
    };
    portal.querySelector('.tnd-pane-close').addEventListener('click', shut);
    scrim.addEventListener('click', shut);
    paint();

    if (stay) {
      [pane, scrim].forEach(function (el) { el.style.transition = 'none'; el.classList.add('is-open'); });
      pane.getBoundingClientRect();
      setTimeout(function () { [pane, scrim].forEach(function (el) { el.style.transition = ''; }); }, 50);
    } else {
      requestAnimationFrame(function () { pane.classList.add('is-open'); scrim.classList.add('is-open'); });
    }
    return portal;
  }

  // The family's children: the matched records, plus any registered here.
  function childLinks(f) {
    var kidsOf = kidsOfHousehold(f);
    return kids(f).map(function (n) {
      return { n: n, full: n + ' ' + f.n, rec: kidsOf.filter(function (x) { return x.f === n; })[0] };
    });
  }
  function childRow(k, label) {
    var row = vRow(DI.person, label || whereOf(k.rec), k.full);
    return k.rec && k.rec.id ? row.replace('<div class="vB-row"', '<a class="vB-row vB-row--action fam-tochild" data-child="' + k.rec.id +
      '" data-childname="' + esc(k.full) + '" href="javascript:void(0);"').replace(/<\/div>$/, DI.cta + '</a>') : row;
  }

  // A contact as the child profile shows a parent: who, and how to reach them.
  function contactView(f, c) {
    return '<div class="vB-list fam-headed fam-pblock">' +
      vRow(DI.person, c.t + (c === primaryOf(f) ? ' \u00b7 primary contact' : ''), (c.title ? c.title + ' ' : '') + c.n)
        .replace('<div class="vB-row"', '<a class="vB-row vB-row--action fam-toperson" data-person="' +
        esc(pkey(c)) + '" href="javascript:void(0);"').replace(/<\/div>$/, DI.cta + '</a>') +
      (c.heb ? vRow(DI.person, 'Hebrew name', c.heb) : '') +
      (isParentC(c) ? vRow(DI.person, 'Access', ACCESS_TEXT[accessOf(c)]) : '') +
      (c.emerg && !isPro(c.t) ? vRow(DI.phone, 'Emergency contact', 'Number ' + (emergOf(f).indexOf(c) + 1) + ' to call') : '') +
      (!isParentC(c) ? (function () {
        var ad = listsOf(c, f).address[0];
        return ad ? vRow(DI.home, 'Address \u00b7 ' + ad.type, ad.value) : '';
      })() : '') +
      primaryRow(listsOf(c, f).phone, 'phone') +
      primaryRow(listsOf(c, f).email, 'email') +
      (isParentC(c) ? (function () {
        var a = parentAddr(c, f);
        return a ? vRow(DI.home, 'Address · ' + (a.id === 'home' ? 'Family Home' : a.type), a.value) : '';
      })() : '') +
    '</div>';
  }

  // The family's addresses, Home first, each with the parents who use it.
  function addrViewRows(f) {
    var list = famAddrs(f);
    if (!list.length) return '<p class="fam-empty-note">No addresses yet. Add the Home address on Edit.</p>';
    return '<div class="vB-list fam-headed fam-addrlist">' + list.map(function (a) {
      var who = addrUsers(f, a.id).concat(linkedContacts(f, a.id)).map(function (c) { return String(c.n || '').split(' ')[0]; });
      return '<div class="vB-row fam-arow-view"><span class="vB-row-ico" aria-hidden="true">' + DI.home + '</span>' +
        '<span class="vB-row-body"><span class="vB-row-label">' + esc(a.type) + '</span>' +
        '<span class="vB-row-value">' + esc(a.value) + '</span>' +
        (who.length ? '<span class="fam-ausers">Used by ' + esc(who.join(', ')) + '</span>' : '') + '</span>' +
        (a.id === 'home' ? '<span class="fam-atag">Home</span>' : '') + '</div>';
    }).join('') + '</div>' + (function () {
      var off = (f.addrs || []).filter(function (a) { return a.off; }).length;
      return off ? '<div class="fam-typesrow"><span class="fam-offnote">' + off + (off === 1 ? ' deactivated address' : ' deactivated addresses') + '</span></div>' : '';
    })();
  }

  // Edit: the family's other addresses under the Home one, each removable, plus Add address.
  function otherAddrRow(a) {
    var p = parseAddr(a.value || '');
    var inp = function (k, ph) {
      return '<input type="text" class="form-control" data-oa="' + k + '" value="' + esc(p[k] || '') + '" placeholder="' + ph + '" aria-label="' + ph + '">';
    };
    return '<div class="cm-mrow cm-mrow--address fam-oarow" data-aid="' + esc(a.id || '') + '"><div class="cm-mmain">' +
      typePicker('class-fam-oatype', activeTypes(), a.type, 'Address type', 'Grandma\u2019s house').replace('fam-hasother" class-fam-oatype', 'fam-hasother fam-oatype"') +
      inp('line1', 'Address line 1') + '</div>' +
      '<div class="cm-maddr">' + inp('line2', 'Apt or unit') + inp('city', 'City') + inp('state', 'State') + inp('zip', 'ZIP code') + '</div>' +
      '<div class="cm-mbar"><span></span><button type="button" class="cm-mrm fam-oarm">Remove</button></div></div>';
  }
  // Edit: every family address on one line each, Home first; changed in Manage addresses.
  function addrLinesEdit(f) {
    var list = famAddrs(f);
    return '<div class="cm-multi fam-addrsum"><div class="cm-mlabel">Addresses' + (needsEnrollInfo(f) ? REQ : '') + INFO('One Home per family. A parent uses the Home unless they pick another address.') + '</div>' +
      (list.length ? '<div class="fam-oasumlist">' + list.map(function (a) {
        var who = a.id === 'home' ? homeImpact(f) : addrUsers(f, a.id).concat(linkedContacts(f, a.id)).map(function (x) { return String(x.n || '').split(' ')[0]; });
        return '<div class="fam-oasumrow"><span class="fam-pill">' + esc(a.type) + '</span><span class="fam-oasumval">' + esc(a.value) + '</span>' +
          (who.length ? '<small>' + esc(listText(who)) + '</small>' : '') + '</div>';
      }).join('') + '</div>' : '<p class="fam-empty-note">No Home address yet.</p>') +
      '<div class="cm-mfoot">' + mgrLink('family') + '</div>' +
      '</div>';
  }
  var otherAddrRows = addrLinesEdit;
  // Only the Home so far: who it reaches, and the way to a second address.
  function homeOnlyFoot(f) {
    var who = homeImpact(f);
    return '<div class="fam-homeonly">' +
      (who.length ? '<p class="fam-impact">' + SV('<circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4M12 8h.01"></path>', 2) +
        '<span>Used by ' + esc(listText(who)) + '. Changing the Home address changes it for ' + (who.length > 1 ? 'all of them' : 'them') + '.</span></p>' : '') +
      '<div class="cm-mfoot">' + mgrLink('family', null, '+ Add another address') + '</div></div>';
  }

  // Remove: if a parent uses it, say who and that they go back to the Home.
  function wireOtherAddrs(f, portal) {
    var box = portal.querySelector('.fam-oalist');
    if (!box) return;
    var rows = box.querySelector('.fam-oarows');
    box.addEventListener('click', function (e) {
      if (e.target.closest('.fam-oaadd')) {
        rows.insertAdjacentHTML('beforeend', otherAddrRow({ type: 'Mailing' }));
        rows.lastElementChild.querySelector('[data-oa="line1"]').focus();
        return;
      }
      var rm = e.target.closest('.fam-oarm');
      if (!rm) return;
      var row = rm.closest('.fam-oarow'), id = row.getAttribute('data-aid');
      var users = id ? addrUsers(f, id) : [];
      var line = addrLine({ line1: row.querySelector('[data-oa="line1"]').value, line2: row.querySelector('[data-oa="line2"]').value,
        city: row.querySelector('[data-oa="city"]').value, state: row.querySelector('[data-oa="state"]').value, zip: row.querySelector('[data-oa="zip"]').value });
      var gone = function () { row.remove(); box.dispatchEvent(new Event('change', { bubbles: true })); };
      if (!users.length) { gone(); return; }
      var names = users.map(function (c) { return c.n; });
      famPop('Delete this address?',
        '<p class="fam-pop-addr">' + esc(line || 'This address') + '</p>' +
        '<p>' + esc(names.join(' and ')) + (names.length > 1 ? ' use' : ' uses') + ' this address. When you save, ' +
          (names.length > 1 ? 'they' : esc(String(names[0]).split(' ')[0])) + ' will use the family Home address instead' +
          (homeText(f) ? ' (' + esc(homeText(f)) + ')' : '') + '.</p>',
        'Delete address', function () { gone(); }, true);
    });
  }
  // Save: the rows become f.addrs; a parent whose address was deleted goes back to the Home.
  function saveOtherAddrs(f, form) {
    var box = form.querySelector('.fam-oalist');
    if (!box) return;
    initAddrs(f);
    var kept = [];
    box.querySelectorAll('.fam-oarow').forEach(function (row) {
      var v = function (k) { return row.querySelector('[data-oa="' + k + '"]').value.trim(); };
      var value = addrLine({ line1: v('line1'), line2: v('line2'), city: v('city'), state: v('state'), zip: v('zip') });
      if (!v('line1')) return;
      var id = row.getAttribute('data-aid') || ('a' + (++ADDR_N));
      kept.push({ id: id, type: readType(row.querySelector('.fam-oatype')), value: value });
      reactivateTypes([kept[kept.length - 1].type]);
    });
    var ids = kept.map(function (a) { return a.id; });
    (f.contacts || []).forEach(function (c) { if (c.addrRef && ids.indexOf(c.addrRef) < 0) delete c.addrRef; });
    if (f.billing && f.billing.addrId && ids.indexOf(f.billing.addrId) < 0) f.billing.addrId = null;
    f.addrs = kept;
  }

  /* ---- Manage addresses (design review 11/18, 2.5 and 2.7, as reviewed 11/19) ---------------
     A window opened from the family or from a contact, for that one's own addresses: put them in
     order, deactivate one (kept, with the date, and no longer offered in the dropdowns), delete it
     once deactivated, add a new one. Adding an address that is there but deactivated brings it back
     instead of making a second copy. The family's Home is fixed: it is edited on the Household tab. */
  /* UNDO FOR WHAT SAVES AT ONCE (as reviewed 11/20): a change made without a Save button (a Notifications
     switch, a Billing action, Manage addresses) says so in a message with Undo; Undo puts the state back
     as it was before that change. One at a time: a new change replaces the previous message. */
  var clone = function (o) { return o == null ? o : JSON.parse(JSON.stringify(o)); };
  function famUndo(msg, undo) {
    var old = document.querySelector('.fam-undotoast'); if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'tendi-skin fam-undotoast';
    t.setAttribute('role', 'status');
    t.innerHTML = '<span class="fam-undomsg"></span><button type="button" class="fam-undobtn">Undo</button>' +
      '<button type="button" class="fam-undox" aria-label="Close">' + SV('<path d="M18 6 6 18M6 6l12 12"></path>', 2) + '</button>';
    t.querySelector('.fam-undomsg').textContent = msg;
    document.body.appendChild(t);
    var gone = false, close = function () { if (gone) return; gone = true; t.classList.add('is-out'); setTimeout(function () { t.remove(); }, 200); };
    var timer = setTimeout(close, 8000);
    t.addEventListener('mouseenter', function () { clearTimeout(timer); });
    t.addEventListener('mouseleave', function () { timer = setTimeout(close, 4000); });
    t.querySelector('.fam-undox').addEventListener('click', close);
    t.querySelector('.fam-undobtn').addEventListener('click', function () {
      clearTimeout(timer); close();
      undo();
      if (window.tndToast) window.tndToast.success('Undone.');
    });
    requestAnimationFrame(function () { t.classList.add('is-in'); });
  }

  var normAddr = function (v) { return String(v || '').toLowerCase().replace(/,?\s*usa$/, '').replace(/[^a-z0-9]/g, ''); };
  function mgrLink(kind, ci, label) {
    return '<button type="button" class="fam-mgrlink" data-mgr="' + kind + '"' + (ci != null ? ' data-ci="' + ci + '"' : '') + '>' +
      (label ? '' : SV('<path d="M8 6h13M8 12h13M8 18h13"></path><path d="M3 6h.01M3 12h.01M3 18h.01"></path>', 2)) + (label || 'Manage addresses') + '</button>';
  }
  /* ONE ADDRESS: THE FIELDS; TWO OR MORE: THE LINES (as reviewed 11/19). With a single address it is
     typed in place; "+ Add another address" opens Manage addresses, and from the second address on
     they show as lines with "Manage addresses". What was typed is kept first, so the window starts
     from it. */
  var hasMany = function (f) { return (f.addrs || []).some(function (a) { return !a.off; }); };
  // A contact shows lines from two addresses, or when one is a link to the family's (a link is not typed).
  var contactLined = function (f, c) {
    return listsOf(c, f).address.length >= 2 || (c.addrs || []).some(function (a) { return a.famRef && !a.off; });
  };
  function commitHomeFields(f, form) {
    var x = function (k) { var el = form && form.querySelector('[data-k="' + k + '"]'); return el ? el.value.trim() : null; };
    if (x('line1') === null) return;
    var line = addrLine({ line1: x('line1'), line2: x('line2'), city: x('city'), state: x('state'), zip: x('zip') });
    if (line && line !== homeText(f)) { if (!f.key && f.a) f.key = f.a; f.a = line; }
  }
  function commitCardAddrs(f, c, card) {
    var vals = window.cmMulti ? window.cmMulti.values(card, 'address') : [];
    var off = (c.addrs || []).filter(function (a) { return a.off; });
    c.addrs = vals.map(function (a, i) { return { type: a.type, value: a.value, primary: i === 0 }; }).concat(off);
  }
  function lineCard(f, c, card) {
    if (card.querySelector('.fam-caddrsum')) return;
    var abox = card.querySelector('.cm-multi[data-multi="address"]');
    if (!abox) return;
    abox.insertAdjacentHTML('afterend', contactAddrLines(f, c));
    card.classList.remove('fam-addrfields');
    card.classList.add('fam-addrlined');
    card._liveAddrs = function () { return c.addrs ? c.addrs.slice() : []; };
    setTimeout(function () { var d = card.querySelector('details.cm-paddrs'); if (d) d.open = true; }, 0);
  }
  document.addEventListener('click', function (e) {
    var l = e.target.closest && e.target.closest('.fam-mgrlink');
    if (!l) return;
    e.preventDefault(); e.stopPropagation();
    var portal = document.querySelector('.fam-portal'), f = portal && portal._fam;
    if (!f) return;
    if (l.getAttribute('data-mgr') !== 'contact') commitHomeFields(f, portal.querySelector('.fam-editform'));
    openAddrMgr(f, l.getAttribute('data-mgr') === 'contact' ? f.contacts[+l.getAttribute('data-ci')] : null);
  });
  /* PHONE ROWS ON A CARD (as reviewed 11/19): "Primary" only when the person has two or more numbers
     (one number is their primary). "Also receives notifications" sits under the field, beside
     Primary, on any number that is not the family's primary number. Not for professionals, and not
     for a Payment-only parent (6.1: no child notifications). Saved with the card. */
  function phoneRowNotify(f, c, card) {
    if (!card.querySelector('.cm-multi[data-multi="phone"]')) return;
    f.alsoNotify = f.alsoNotify || {};
    card._rowAlso = {};
    card._rowAlsoDirty = false;
    var rel = card.querySelector('.cm-ptype select');
    var allowed = function () {
      var v = rel ? rel.value || '' : '';
      if (/^(car_service|pediatrician|other_doctor|therapist|caseworker)$/i.test(v)) return false;
      return !(/^(father|mother)$/i.test(v) && card._access === 'payment');
    };
    var paint = function () {
      var pb = card.querySelector('.cm-multi[data-multi="phone"]');
      if (!pb) return;
      var fam = primaryNumber(f), famD = fam ? fam.d : null;
      var rows = [].slice.call(pb.querySelectorAll('.cm-mrow'));
      var filled = rows.filter(function (r) { var v = r.querySelector('.cm-mval'); return v && digits(v.value).length >= 7; });
      pb.classList.toggle('fam-oneprim', filled.length <= 1);
      rows.forEach(function (r) {
        var v = r.querySelector('.cm-mval'), d = v ? digits(v.value) : '', bar = r.querySelector('.cm-mbar');
        if (!bar) return;
        var sw = bar.querySelector('.fam-rowalso');
        var show = allowed() && d.length >= 7 && d !== famD;
        if (!show) { if (sw) sw.remove(); return; }
        var on = d in card._rowAlso ? card._rowAlso[d] : !!f.alsoNotify[d];
        if (!sw) {
          var html = '<span class="fam-rowalso">' + swHtml('rowalso', on, 'Also receives notifications') + '</span>';
          var prim = bar.querySelector('.cm-mprim');
          if (prim) prim.insertAdjacentHTML('afterend', html); else bar.insertAdjacentHTML('afterbegin', html);
          sw = bar.querySelector('.fam-rowalso');
        } else {
          var inp = sw.querySelector('input');
          if (inp.checked !== on) { inp.checked = on; sw.querySelector('.fam-sw').classList.toggle('is-on', on); }
        }
        sw.setAttribute('data-d', d);
      });
    };
    var t = null, later = function () { clearTimeout(t); t = setTimeout(paint, 120); };
    card.addEventListener('change', function (e) {
      var x = e.target;
      if (x.matches && x.matches('[data-sw="rowalso"]')) {
        var d = x.closest('.fam-rowalso').getAttribute('data-d');
        card._rowAlso[d] = x.checked;
        card._rowAlsoDirty = true;
        x.closest('.fam-sw').classList.toggle('is-on', x.checked);
        return;
      }
      later();
    });
    card.addEventListener('input', later);
    card.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.cm-madd, .cm-mrm, [data-acc]')) later(); });
    if (rel) rel.addEventListener('change', later);
    setTimeout(paint, 0);
  }
  function applyRowNotify(f, card) {
    if (!card || !card._rowAlsoDirty) return;
    f.alsoNotify = f.alsoNotify || {};
    Object.keys(card._rowAlso).forEach(function (d) { f.alsoNotify[d] = card._rowAlso[d]; });
  }
  function notifyStrip(f, c, card) {
    var pb = card.querySelector('.cm-multi[data-multi="phone"]');
    if (!pb || card.querySelector('.fam-cardnotify')) return;
    f.alsoNotify = f.alsoNotify || {};
    var pn = primaryNumber(f);
    card._prim = pn ? pn.d : null;
    card._also = {};
    card._notifyDirty = false;
    var strip = document.createElement('div');
    strip.className = 'cm-multi fam-cardnotify';
    pb.parentNode.insertBefore(strip, pb.nextSibling);
    var rel = card.querySelector('.cm-ptype select');
    var draw = function () {
      var parent = !!rel && /^(father|mother)$/i.test(rel.value || '') && card._access !== 'payment';   // Payment only: no child notifications (6.1)
      // Only "Also receives notifications", for numbers that are not the family's primary (that one gets
      // them already, and is chosen on the Household tab). Nothing to show: no strip.
      var nums = (window.cmMulti ? window.cmMulti.values(card, 'phone') : []).filter(function (x) {
        var d = digits(x.value);
        return d.length >= 7 && d !== card._prim;
      });
      strip.style.display = parent && nums.length ? '' : 'none';
      if (!parent || !nums.length) { strip.innerHTML = ''; return; }
      strip.innerHTML = '<div class="cm-mlabel">Notifications</div>' + nums.map(function (x) {
        var d = digits(x.value), also = d in card._also ? card._also[d] : !!f.alsoNotify[d];
        return '<div class="fam-cnrow" data-d="' + d + '"><span class="fam-cnnum">' + esc(x.value) + '</span>' +
          swHtml('also', also, 'Also receives notifications') + '</div>';
      }).join('');
    };
    strip.addEventListener('change', function (e) {
      var sw = e.target.closest('[data-sw]');
      if (!sw) return;
      e.stopPropagation();
      var d = sw.closest('.fam-cnrow').getAttribute('data-d');
      if (sw.getAttribute('data-sw') === 'prim') {
        if (!sw.checked) {                               // one number is always the primary
          sw.checked = true;
          if (window.tndToast) window.tndToast.error('Turn Primary number on for another number instead.');
          return;
        }
        card._prim = d;
      } else card._also[d] = sw.checked;
      card._notifyDirty = true;
      draw();
      card.dispatchEvent(new Event('input', { bubbles: true }));
    });
    var t = null;
    var later = function (e) { if (e && e.target && e.target.closest && e.target.closest('.fam-cardnotify')) return; clearTimeout(t); t = setTimeout(draw, 150); };
    card.addEventListener('input', later);
    card.addEventListener('change', later);
    if (rel) rel.addEventListener('change', later);
    setTimeout(draw, 0);
  }
  // On save: a parent card's Primary number and Also receives notifications, if they were changed there.
  // A family contact's "Also receives notifications": on or off for each of their numbers.
  function applyContactNotify(f, c, card) {
    if (!card || !card._alsoAllDirty || isParentC(c) || isPro(c.t)) return;
    f.alsoNotify = f.alsoNotify || {};
    listsOf(c, f).phone.forEach(function (x) { var d = digits(x.value); if (d) f.alsoNotify[d] = !!card._alsoAll; });
  }
  function applyCardNotify(f, card) {
    if (!card || !card._notifyDirty) return;
    f.alsoNotify = f.alsoNotify || {};
    if (card._prim) f.primaryPhone = card._prim;
    Object.keys(card._also || {}).forEach(function (d) { f.alsoNotify[d] = card._also[d]; });
  }

  function contactAddrLines(f, c) {
    var list = listsOf(c, f).address;
    return '<div class="cm-multi fam-caddrsum" data-ci="' + f.contacts.indexOf(c) + '"><div class="cm-mlabel">Addresses</div>' +
      (list.length ? '<div class="fam-oasumlist">' + list.map(function (a) {
        return '<div class="fam-oasumrow"><span class="fam-pill">' + esc(a.type) + '</span><span class="fam-oasumval">' + esc(a.value) + '</span>' +
          (a.primary ? '<small>Primary</small>' : '') + '</div>';
      }).join('') + '</div>' : '<p class="fam-empty-note">No address yet.</p>') +
      '<div class="cm-mfoot">' + mgrLink('contact', f.contacts.indexOf(c)) + '</div></div>';
  }
  // A contact's own addresses as a list the window can keep (their first active one is their primary).
  function contactAddrs(c, f) {
    if (!c.addrs) c.addrs = (window.cmMulti ? window.cmMulti.items(c, '').address : []).map(function (a) { return { type: a.type, value: a.value, primary: !!a.primary }; });
    return c.addrs;
  }
  function openAddrMgr(f, c) {
    var old = document.querySelector('.fam-setportal'); if (old) old.remove();
    var portal = document.createElement('div');
    portal.className = 'tendi-skin tnd-drawer-portal fam-setportal fam-mgrportal';
    portal.innerHTML = '<div class="tnd-pane-scrim tnd-drawer-scrim"></div>' +
      '<aside class="tnd-pane tnd-drawer fam-fdrawer" role="dialog" aria-label="Manage addresses">' +
        '<div class="tnd-pane-head"><span class="up-head-eyebrow"><span class="up-eb-view">' + esc(c ? c.n : famName(f)) + '</span></span><span class="up-head-spacer"></span>' +
          '<div class="tnd-pane-head-actions"><button type="button" class="tnd-pane-close" aria-label="Close">' + DI.close + '</button></div></div>' +
        '<div class="tnd-pane-body is-ready"><div class="tnd-pane-view fam-fview fam-atview"></div></div></aside>';
    document.body.appendChild(portal);
    var host = portal.querySelector('.fam-atview');
    if (!c) initAddrs(f);
    var list = function () { return c ? contactAddrs(c, f) : (f.addrs = f.addrs || []); };
    var fixPrimary = function () {
      if (!c) return;
      var l = list(), first = l.filter(function (a) { return !a.off; })[0];
      l.forEach(function (a) { a.primary = a === first; });
    };
    var usersOf = function (a) {
      if (c) return [];
      var who = addrUsers(f, a.id).concat(linkedContacts(f, a.id)).map(function (x) { return String(x.n || '').split(' ')[0]; });
      if ((f.billing || {}).addrId === a.id) who.push('billing');
      return who;
    };
    var row = function (a0, i, n) {
      var a = c ? (resolveAddr(f, a0) || Object.assign({}, a0, { value: (a0.value || '') + ' (no longer a family address)' })) : a0;
      var off = !!a0.off, who = usersOf(a0);
      return '<div class="fam-atrow' + (off ? ' is-off' : '') + '" data-i="' + i + '">' +
        '<div class="fam-atmove"><button type="button" class="btn-sm fam-atup" aria-label="Move up"' + (i ? '' : ' disabled') + '>' + SV('<path d="m18 15-6-6-6 6"></path>', 2) + '</button>' +
          '<button type="button" class="btn-sm fam-atdown" aria-label="Move down"' + (i < n - 1 ? '' : ' disabled') + '>' + SV('<path d="m6 9 6 6 6-6"></path>', 2) + '</button></div>' +
        '<div class="fam-atmain"><div class="fam-atline"><span class="fam-pill">' + esc(a.type) + '</span><b class="fam-atname">' + esc(a.value) + '</b></div>' +
          '<small>' + (a0.famRef ? 'The family\u2019s address, linked: it changes when the family\u2019s changes. ' : '') +
          (who.length ? 'Used by ' + esc(listText(who)) : c && a0.primary && !off ? 'Primary address' : a0.famRef ? '' : 'Not used by anyone') +
          (off ? '. Deactivated ' + esc(nyDate(new Date(a.off))) + ': kept, but not offered in the address lists.' : '') + '</small></div>' +
        '<span class="fam-atstate' + (off ? ' is-off' : '') + '">' + (off ? (daysOff(a) ? 'Deactivated for ' + daysText(daysOff(a)) : 'Deactivated today') : 'Active') + '</span>' +
        '<div class="fam-atacts">' + (off ? '<button type="button" class="btn-sm fam-aton">Activate</button><button type="button" class="btn-sm fam-atdel">Delete</button>'
          : '<button type="button" class="btn-sm fam-atoff">Deactivate</button>') + '</div></div>';
    };
    var draw = function () {
      var l = list(), home = !c && homeText(f);
      host.innerHTML = '<section class="vB-hero fam-fhero"><h2 class="vB-name">Addresses</h2>' +
          '<div class="vB-hero-meta"><span class="vB-idtag">' + esc(c ? c.n + '’s own addresses, first one is the primary' : 'The ' + famName(f) + '’s addresses, in the order they are offered') + '</span></div></section>' +
        '<div class="fam-tbody"><section class="vB-group"><div class="fam-atlist">' +
          (!c ? '<div class="fam-atrow is-fixed"><div class="fam-atmove"></div><div class="fam-atmain"><div class="fam-atline"><span class="fam-pill">Home</span><b class="fam-atname">' + (home ? esc(home) : 'No Home address yet') + '</b></div>' +
            '<small>' + (homeImpact(f).length ? 'Used by ' + esc(listText(homeImpact(f))) + '. ' : '') + 'One per family; it can\u2019t be deactivated.</small>' +
            '<div class="fam-homeedit" hidden><div class="fam-homefields"></div>' +
              (homeImpact(f).length ? '<p class="fam-impact">' + SV('<circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4M12 8h.01"></path>', 2) +
                '<span>Changing the Home address changes it for ' + esc(listText(homeImpact(f))) + '.</span></p>' : '') +
              '<div class="fam-mgraddbtn"><button type="button" class="btn-sm fam-homecancel">Cancel</button><button type="button" class="btn-sm primary fam-homesave">Save Home</button></div></div></div>' +
            '<span class="fam-atstate">Active</span><div class="fam-atacts"><button type="button" class="btn-sm fam-homebtn">' + (home ? 'Edit' : 'Add') + '</button></div></div>' : '') +
          l.map(function (a, i) { return row(a, i, l.length); }).join('') +
          (!l.length && !home ? '<p class="fam-empty-note">No addresses yet.</p>' : '') + '</div>' +
        (c && !isPro(c.t) ? (function () {
          var have = list().map(function (x) { return x.famRef; });
          var opts = famAddrs(f).filter(function (fa) { return have.indexOf(fa.id) < 0; });
          return opts.length ? '<div class="fam-mgrfam"><div class="cm-mlabel">Use one of the family\u2019s addresses</div>' +
            '<div class="fam-mgrfamrow"><select class="form-control fam-mgrfamsel" aria-label="Family address">' + opts.map(function (fa) {
              return '<option value="' + esc(fa.id) + '">' + esc(fa.type + ' \u00b7 ' + fa.value) + '</option>';
            }).join('') + '</select><button type="button" class="btn-sm primary fam-mgrfamadd">Use this address</button></div>' +
            '<p class="fam-panel-note">For family who live there too. It is linked, not copied: when the family\u2019s address changes, theirs does.</p></div>' : '';
        })() : '') +
        '<div class="fam-mgradd"><div class="cm-mlabel">Add an address</div>' + addrFields('mg') +
          '<div class="fam-mgraddbtn"><button type="button" class="btn-sm primary fam-mgrnew">Add address</button></div></div>' +
        '<p class="fam-panel-note">Delete appears once an address is deactivated. Adding an address that is already here but deactivated makes it active again.</p>' +
        '</section></div>';
      wire();
    };
    var snap = null, prevSnap = null;   // prevSnap: the state before the last action
    var takeSnap = function () {
      snap = { a: f.a, key: f.key, addrs: clone(f.addrs), billAddr: (f.billing || {}).addrId,
               refs: (f.contacts || []).map(function (x) { return x.addrRef; }), caddrs: c ? clone(c.addrs) : null };
    };
    var undoTo = function (s0) {
      return function () {
        f.a = s0.a; f.key = s0.key; f.addrs = clone(s0.addrs);
        if (f.billing) f.billing.addrId = s0.billAddr;
        (f.contacts || []).forEach(function (x, i) { if (s0.refs[i]) x.addrRef = s0.refs[i]; else delete x.addrRef; });
        if (c) c.addrs = clone(s0.caddrs);
        if (document.body.contains(portal)) draw(); else afterMgr(f);
      };
    };
    var toast = function (m, bad) {
      if (bad) { if (window.tndToast) window.tndToast.error(m); return; }
      famUndo(m, undoTo(prevSnap || snap));
    };
    var wire = function () {
      prevSnap = snap;                 // each action redraws: what was on screen before it is kept for Undo
      takeSnap();
      var hb = host.querySelector('.fam-homebtn');
      if (hb) {
        var he = host.querySelector('.fam-homeedit');
        hb.addEventListener('click', function () {
          var a = parseAddr(f.a || ''), inp = function (k, ph) { return '<input type="text" class="form-control" data-hm="' + k + '" value="' + esc(a[k] || '') + '" placeholder="' + ph + '" aria-label="' + ph + '">'; };
          he.querySelector('.fam-homefields').innerHTML = '<div class="fam-afields"><div class="fam-afrow1">' + inp('line1', 'Address line 1') + '</div>' +
            '<div class="fam-afgrid">' + inp('line2', 'Apt or unit') + inp('city', 'City') + inp('state', 'State') + inp('zip', 'ZIP code') + '</div></div>';
          he.hidden = false; hb.hidden = true;
          he.querySelector('[data-hm="line1"]').focus();
        });
        host.querySelector('.fam-homecancel').addEventListener('click', function () { he.hidden = true; hb.hidden = false; });
        host.querySelector('.fam-homesave').addEventListener('click', function () {
          var v = function (k) { return he.querySelector('[data-hm="' + k + '"]').value.trim(); };
          if (!v('line1')) { toast('Enter the address line first.', true); return; }
          var who = homeImpact(f), before = homeText(f);
          if (!f.key && f.a) f.key = f.a;                // its children are still found by the old address
          f.a = addrLine({ line1: v('line1'), line2: v('line2'), city: v('city'), state: v('state'), zip: v('zip') });
          draw();
          toast(before && who.length ? 'Home address updated for ' + listText(who) + '.' : 'Home address saved.');
        });
      }
      host.querySelectorAll('.fam-atrow[data-i]').forEach(function (r) {
        var i = +r.getAttribute('data-i'), l = list(), a = l[i], shown = (c && resolveAddr(f, a)) || a;
        var move = function (d) { var j = i + d; if (j < 0 || j >= l.length) return; l.splice(j, 0, l.splice(i, 1)[0]); fixPrimary(); draw(); toast('Order changed.'); };
        r.querySelector('.fam-atup').addEventListener('click', function () { move(-1); });
        r.querySelector('.fam-atdown').addEventListener('click', function () { move(1); });
        var offB = r.querySelector('.fam-atoff');
        if (offB) offB.addEventListener('click', function () {
          var who = usersOf(a);
          famPop('Deactivate this address?', '<p class="fam-pop-addr">' + esc(shown.type + ' · ' + shown.value) + '</p>' +
            '<p>No longer offered in the address lists.' +
            (who.length ? ' ' + esc(listText(who)) + (who.length > 1 ? ' use' : ' uses') + ' it, and will use the family Home address instead.' : '') + '</p>', 'Deactivate', function () {
            a.off = new Date().toISOString();
            if (!c) {
              addrUsers(f, a.id).forEach(function (x) { delete x.addrRef; });
              if ((f.billing || {}).addrId === a.id) f.billing.addrId = null;
            }
            fixPrimary(); draw(); toast('Address deactivated.');
          });
        });
        var onB = r.querySelector('.fam-aton');
        if (onB) onB.addEventListener('click', function () { delete a.off; fixPrimary(); draw(); toast('Address active again.'); });
        var del = r.querySelector('.fam-atdel');
        if (del) del.addEventListener('click', function () {
          famPop('Delete this address?', '<p class="fam-pop-addr">' + esc(shown.type + ' · ' + shown.value) + '</p><p>' + (a.famRef ? 'The link is removed; the family’s address stays.' : 'It is removed for good.') + '</p>', 'Delete', function () {
            l.splice(i, 1); fixPrimary(); draw(); toast('Address deleted.');
          }, true);
        });
      });
      var famAdd = host.querySelector('.fam-mgrfamadd');
      if (famAdd) famAdd.addEventListener('click', function () {
        var id = host.querySelector('.fam-mgrfamsel').value, fa = addrById(f, id);
        if (!fa) return;
        list().push({ famRef: id, type: fa.type, value: fa.value, primary: false });
        fixPrimary(); draw(); toast('Linked to the family\u2019s ' + fa.type + ' address.');
      });
      host.querySelector('.fam-mgrnew').addEventListener('click', function () {
        var box = host.querySelector('.fam-mgradd'), a = readAddrFields(box, 'mg');
        if (!a.line1) { toast('Enter the address line first.', true); box.querySelector('[data-mg="line1"]').focus(); return; }
        var n = normAddr(a.value), l = list();
        if (!c && normAddr(homeText(f)) === n) { toast('That is the family Home already.', true); return; }
        var hit = l.filter(function (x) { return normAddr(x.value) === n; })[0];
        if (hit && hit.off) {
          var d = daysOff(hit); delete hit.off; fixPrimary(); draw();
          toast('This address was deactivated ' + (d ? 'for ' + daysText(d) : 'today') + '. It is active again.');
          return;
        }
        if (hit) { toast('That address is already in the list.', true); return; }
        l.push(c ? { type: a.type, value: a.value, primary: false } : { id: 'a' + (++ADDR_N), type: a.type, value: a.value });
        fixPrimary(); draw(); toast('Address added.');
      });
    };
    var shut = function () {
      var pane = portal.querySelector('.tnd-pane'); pane.classList.remove('is-open'); portal.querySelector('.tnd-pane-scrim').classList.remove('is-open');
      setTimeout(function () { portal.remove(); }, 220);
      afterMgr(f);
    };
    portal.querySelector('.tnd-pane-close').addEventListener('click', shut);
    portal.querySelector('.tnd-pane-scrim').addEventListener('click', shut);
    draw();
    requestAnimationFrame(function () { portal.querySelector('.tnd-pane').classList.add('is-open'); portal.querySelector('.tnd-pane-scrim').classList.add('is-open'); });
    setTimeout(function () { var pane = portal.querySelector('.tnd-pane'); if (pane && !pane.classList.contains('is-open')) { pane.classList.add('is-open'); portal.querySelector('.tnd-pane-scrim').classList.add('is-open'); } }, 400);
  }
  // After the window closes: the family panel shows the new list (a form being edited keeps what is typed).
  function afterMgr(f) {
    var portal = document.querySelector('.fam-portal');
    if (!portal || portal._fam !== f) return;
    if (!portal.querySelector('.fam-editform')) {
      var tab = portal.querySelector('.fam-ftabs .is-active'), body = portal.querySelector('.tnd-pane-body'), sc = body ? body.scrollTop : 0;
      var np = openDrawer(f, tab ? tab.getAttribute('data-ftab') : 'details', { instant: true });
      var nb = np && np.querySelector('.tnd-pane-body');
      if (nb) requestAnimationFrame(function () { nb.scrollTop = sc; });
      return;
    }
    portal.querySelectorAll('.fam-apick-sel, [data-k="billaddr"]').forEach(function (sel) { if (sel._redraw) sel._redraw(); });
    var sum = portal.querySelector('.fam-addrsum');
    if (sum) sum.outerHTML = addrLinesEdit(f);
    var hf = portal.querySelector('.fam-homefields-box'), foot = portal.querySelector('.fam-homeonly');
    if (hf && hasMany(f)) { if (foot) foot.remove(); hf.outerHTML = addrLinesEdit(f); }
    else if (hf) {
      var pa = parseAddr(f.a || '');
      ['line1', 'line2', 'city', 'state', 'zip'].forEach(function (k) { var el = hf.querySelector('[data-k="' + k + '"]'); if (el) el.value = pa[k] || ''; });
    }
    portal.querySelectorAll('.cm-extra.fam-addrfields').forEach(function (card) {
      var c = f.contacts[+card.getAttribute('data-ci')];
      if (!c) return;
      if (contactLined(f, c)) lineCard(f, c, card);
      else if (window.cmMulti) window.cmMulti.set(card, 'address', listsOf(c, f).address);
    });
    portal.querySelectorAll('.fam-caddrsum').forEach(function (box) {
      var c = f.contacts[+box.getAttribute('data-ci')];
      if (c) box.outerHTML = contactAddrLines(f, c);
    });
  }

  /* ---- design review 11/18: helpers for the family's new parts ------------------------- */
  var nyDate = function (d) { return (d || new Date()).toLocaleDateString('en-US', { timeZone: 'America/New_York' }); };
  var hashOf = function (s) { var h = 0; String(s || '').split('').forEach(function (ch) { h = (h * 31 + ch.charCodeAt(0)) >>> 0; }); return h; };
  var swHtml = function (key, on, label, extra) {
    return '<label class="fam-sw' + (on ? ' is-on' : '') + '"><input type="checkbox" data-sw="' + key + '"' + (on ? ' checked' : '') + (extra || '') + '>' +
      '<span class="fam-sw-track" aria-hidden="true"></span><span>' + label + '</span></label>';
  };

  // Notifications on the Household tab: the primary number, and each number's permissions, one click each.
  /* Notifications on the Household tab: the primary number and each number's switches, one click each
     on the family screen (design review 11/18, 3.3: "so setting them is one click"). The read-only
     form (edit false) is kept for later use. */
  function notifyRows(f, edit) {
    var list = famNumbers(f), prim = primaryNumber(f);
    // The primary number is always listed first, then the others in their order.
    if (prim) list = [list.filter(function (n) { return n.d === prim.d; })[0]].concat(list.filter(function (n) { return n.d !== prim.d; })).filter(Boolean);
    if (!list.length) return '<p class="fam-empty-note">No phone numbers yet.</p>';
    f.alsoNotify = f.alsoNotify || {};
    if (!edit) {
      return '<div class="fam-notify fam-notify-ro">' +
        '<div class="fam-nprim"><span class="fam-nlabel">Primary number' + INFO('Notifications go to the primary number. Most landlines are not primary, so a mobile is the default.') + '</span><span class="fam-nprimval">' +
          (prim ? esc(prim.who + ' \u00b7 ' + prim.type + ' \u00b7 ' + prim.value) : 'Not set') + '</span></div>' +
        list.map(function (n) {
          var isP = prim && prim.d === n.d;
          return '<div class="fam-nrow"><div class="fam-nwho"><b>' + esc(n.value) + '</b><small>' + esc(n.who + ' \u00b7 ' + n.type) + '</small></div>' +
            '<span class="fam-nperm-ro">' + esc(permText(n.perm)) + '</span>' +
            (isP ? '<span class="fam-pill">Primary</span>' : f.alsoNotify[n.d] ? '<span class="fam-pill">Also notified</span>' : '') + '</div>';
        }).join('') + '</div>';
    }
    return '<div class="fam-notify">' +
      // The family's primary number is chosen in Edit, beside the primary contact; here it is shown.
      '<div class="fam-nprim"><span class="fam-nlabel">Primary number' + INFO('Notifications go to the primary number. Most landlines are not primary, so a mobile is the default.') + '</span><span class="fam-nprimval">' +
        (prim ? esc(prim.who + ' \u00b7 ' + prim.type + ' \u00b7 ' + prim.value) : 'Not set') + '</span></div>' +
      list.map(function (n) {
        var isP = prim && prim.d === n.d;
        return '<div class="fam-nrow" data-d="' + n.d + '"><div class="fam-nwho"><b>' + esc(n.value) + '</b><small>' + esc(n.who + ' \u00b7 ' + n.type) + '</small></div>' +
          // The tag sits left of the switches, so the switches line up on the right in every row.
          (!isP && f.alsoNotify[n.d] ? '<span class="fam-pill fam-alsopill">Also receives notifications</span>' : '') +
          '<span class="fam-pill fam-nprimpill"' + (isP ? '' : ' hidden') + '>Primary</span>' +
          '<div class="fam-nperms">' + swHtml('text', n.perm.text, 'Text') + swHtml('mms', n.perm.mms, 'MMS') + swHtml('voice', n.perm.voice, 'Voice') + '</div></div>';
      }).join('') + '</div>';
  }
  // Edit: switches show their state as they change; the primary's row has no "Also notify".
  function wireNotifyEdit(portal) {
    var box = portal.querySelector('.fam-notify:not(.fam-notify-ro)');
    if (!box) return;
    box.addEventListener('change', function (e) {
      var sw = e.target.closest('[data-sw]');
      if (sw) { sw.closest('.fam-sw').classList.toggle('is-on', sw.checked); sw.setAttribute('data-dirty', '1'); return; }
      if (e.target.classList.contains('fam-nprim-sel')) {
        box.querySelectorAll('.fam-nrow').forEach(function (r) {
          var isP = r.getAttribute('data-d') === e.target.value;
          r.querySelector('.fam-nalso').hidden = isP;
          r.querySelector('.fam-nprimpill').hidden = !isP;
        });
      }
    });
  }
  // Save: the primary number and only the switches that were changed here.
  function saveNotify(f, form) {
    var box = form.querySelector('.fam-notify:not(.fam-notify-ro)');
    if (!box) return;
    f.alsoNotify = f.alsoNotify || {};
    var sel = box.querySelector('.fam-nprim-sel');
    if (sel) f.primaryPhone = sel.value;
    box.querySelectorAll('.fam-nrow').forEach(function (r) {
      var d = r.getAttribute('data-d');
      r.querySelectorAll('[data-sw][data-dirty]').forEach(function (sw) {
        var key = sw.getAttribute('data-sw');
        if (key === 'also') f.alsoNotify[d] = sw.checked; else setNumberPerm(f, d, key, sw.checked);
      });
    });
  }
  // A permission switched on the family screen is the number's: write it back where the number lives.
  function setNumberPerm(f, d, key, on) {
    if (f.p && digits(f.p) === d) { f.homePerm = Object.assign({ text: false, mms: false, voice: false }, f.homePerm); f.homePerm[key] = on; }
    (f.contacts || []).forEach(function (c) {
      var ls = listsOf(c, f).phone;
      if (!ls.some(function (x) { return digits(x.value) === d; })) return;
      c.phones = ls.map(function (x) { return Object.assign({}, x, { perm: Object.assign({}, permsOf(x)) }); });
      c.phones.forEach(function (x) { if (digits(x.value) === d) { x.perm[key] = on; x.msg = x.perm.text && x.perm.voice ? 'SMS & Voice' : x.perm.text ? 'SMS' : x.perm.voice ? 'Voice' : 'None'; } });
    });
  }

  // Cards on file and automatic payments come from billing (PHP). Sample data, seeded once per family.
  function seedBilling(f) {
    if (f._billSeed) return;
    f._billSeed = true;
    var h = hashOf(f.n);
    if (!f.cards) f.cards = h % 3 === 0 ? [] : [{ brand: 'Visa', last4: String(4000 + h % 5999).slice(-4), nick: 'Family card', exp: '08/2028' }]
      .concat(h % 4 === 1 ? [{ brand: 'Mastercard', last4: String(5100 + h % 899).slice(-4), nick: '', exp: '10/2026' }] : []);
    if (!f.autopay) {
      var p = payerOf(f);
      f.autopay = !f.cards.length ? { status: 'off' }
        : h % 4 === 1 ? { status: 'attention', reason: 'The card expired 10/2026', card: 1, consent: { who: p ? p.n : '', how: 'link', when: '9/2/2026' } }
        : { status: 'on', card: 0, consent: { who: p ? p.n : '', how: 'link', when: '9/2/2026' } };
    }
    f.chargeDays = f.chargeDays || {};
  }
  var cardName = function (c) { return c ? (c.bank ? 'Bank account' : c.brand) + ' •••• ' + c.last4 : ''; };
  function cardRows(f) {
    seedBilling(f);
    var ap = f.autopay || {}, live = (f.cards || []).filter(function (c) { return !c.off; });
    return (live.length ? '<div class="fam-cardlist2">' + (f.cards || []).map(function (c, i) {
        if (c.off) return '';
        var isAp = ap.status !== 'off' && ap.card === i;
        return '<div class="fam-card2" data-i="' + i + '"><div class="fam-card2who"><b>' + esc(cardName(c)) + (c.nick ? ' · ' + esc(c.nick) : '') + '</b>' +
          '<small>' + (c.exp ? 'Expires ' + esc(c.exp) : 'Expiry not known') + '</small></div>' +
          (isAp ? '<span class="fam-pill">Automatic payments</span>' : '<button type="button" class="btn-sm fam-cardact" data-act="useap">Use for automatic payments</button>') +
          '<button type="button" class="btn-sm fam-cardact" data-act="off">Deactivate</button></div>';
      }).join('') + '</div>' : '<p class="fam-empty-note">No cards or bank accounts on file.</p>') +
      '<div class="fam-cardbtns"><button type="button" class="btn-sm fam-cardact" data-act="add">Add card</button>' +
      '<button type="button" class="btn-sm fam-cardact" data-act="link">' + (f.linkSent ? 'Resend setup link' : 'Send setup link') + '</button></div>' +
      '<p class="fam-panel-note">' + (f.linkSent ? 'Setup link sent to ' + esc(f.linkSent) + '. ' : '') +
      'Cards are the family’s and are the same records on the child and Payments pages. Card numbers stay in billing’s secure form.</p>';
  }
  var AP_TEXT = { off: 'Off', waiting: 'Waiting for parent', on: 'On', paused: 'Paused', attention: 'Needs attention' };
  function autopayBox(f) {
    seedBilling(f);
    var ap = f.autopay || { status: 'off' }, card = (f.cards || [])[ap.card];
    var kids = kidsOfHousehold(f).filter(function (k) { return k.s === 'enrolled'; });
    var acts = { off: [['consent', 'Send consent link'], ['phone', 'Record phone consent']],
                 waiting: [['consent', 'Resend consent link'], ['phone', 'Record phone consent']],
                 on: [['pause', 'Pause'], ['stop', 'Stop'], ['card', 'Change card']],
                 paused: [['resume', 'Resume'], ['stop', 'Stop']],
                 attention: [['card', 'Change card'], ['stop', 'Stop']] }[ap.status] || [];
    var row = function (k, v) { return '<div class="fam-aprow"><span>' + k + '</span><span>' + v + '</span></div>'; };
    var ord = function (n) { return n + (n === 1 ? 'st' : n === 5 || n >= 10 ? 'th' : 'th'); };
    return '<div class="fam-apbox"><div class="fam-aphead"><b>Status</b><span class="fam-apstat is-' + ap.status + '">' + AP_TEXT[ap.status] +
        (ap.status === 'paused' && ap.until ? ' until ' + esc(ap.until) : '') + '</span></div>' +
      (ap.status === 'attention' ? '<p class="fam-apwarn">' + esc(ap.reason || 'It can’t be charged.') + '</p>' : '') +
      (ap.status === 'off' ? '' : row('Card', card ? esc(cardName(card)) : 'None')) +
      row('Children', kids.length ? kids.map(function (k) {
          var day = f.chargeDays[k.f] || 1;
          return esc(k.f) + ' <select class="fam-apday" data-kid="' + esc(k.f) + '" aria-label="Charge day for ' + esc(k.f) + '">' +
            [1, 5, 10, 15, 20, 25, 28].map(function (d) { return '<option value="' + d + '"' + (d === day ? ' selected' : '') + '>' + ord(d) + '</option>'; }).join('') + '</select>';
        }).join(' · ') : 'No enrolled children') +
      row('Covers', 'Tuition, Registration fee <small>(center setting)</small>') +
      row('Consent', ap.consent && ap.consent.who ? esc(ap.consent.who) + ', ' + (ap.consent.how === 'phone' ? 'by phone' : 'by link') + ', ' + esc(ap.consent.when) : 'Not given yet') +
      '<div class="fam-apacts">' + acts.map(function (a) { return '<button type="button" class="btn-sm fam-apact" data-act="' + a[0] + '">' + a[1] + '</button>'; }).join('') + '</div>' +
      '<p class="fam-panel-note">Set up here; one-time payments are entered on the Payments page. Also reachable from the billing page.</p></div>';
  }

  // A row on the Emergency contacts tab: who, relationship and phone, read only, with the calling order.
  // Their details are edited on the Contacts tab, where the same person lives.
  function emergRow(f, c, n) {
    var p = phoneOf(c, f);
    return '<div class="fam-erow fam-erow-ro" data-ci="' + f.contacts.indexOf(c) + '"><span class="fam-emn" aria-hidden="true">' + n + '</span>' +
      '<div class="fam-erow-who"><b>' + esc(c.n) + '</b><small>' + esc(c.t) + (p ? ' \u00b7 ' + esc(p) : ' \u00b7 no phone') + '</small></div>' +
      '<div class="fam-erow-acts"><button type="button" class="btn-sm fam-emup" aria-label="Move up">' + SV('<path d="m18 15-6-6-6 6"></path>', 2) + '</button>' +
      '<button type="button" class="btn-sm fam-emdown" aria-label="Move down">' + SV('<path d="m6 9 6 6 6-6"></path>', 2) + '</button>' +
      '<button type="button" class="cm-mrm fam-emrm" title="Takes them off the emergency list; they stay in Contacts">Remove</button></div></div>';
  }

  // Portal state per parent, sample data: the first parent signed in, the second invited.
  function portalOf(c, i) {
    if (!c.portal) c.portal = i === 0 ? { state: 'active', last: '11/14/2026' } : { state: 'invited', last: '11/10/2026' };
    return c.portal;
  }

  // Ledger lines, sample data: this month's tuition per enrolled child and last month's payment.
  function ledgerOf(f) {
    if (f.ledger) return f.ledger;
    var kids = kidsOfHousehold(f).filter(function (k) { return k.s === 'enrolled'; });
    var rows = kids.map(function (k) { return { date: '11/1/2026', desc: 'Tuition · ' + k.f, amt: 620 }; });
    if (kids.length) rows.push({ date: '10/28/2026', desc: 'Payment · automatic', amt: -620 * kids.length });
    if (kids.length) rows = rows.concat(kids.map(function (k) { return { date: '10/1/2026', desc: 'Tuition · ' + k.f, amt: 620 }; }));
    return (f.ledger = rows);
  }

  var TAB_BODY = {
    details: function (f, edit) {
      var addr = String(f.a || '').replace(/,?\s*USA$/i, '');
      if (!edit) {
        return group('Family', '<div class="vB-list fam-headed">' +
            // Version B: the panel's title already names the family.
            (document.documentElement.classList.contains('fam-b') ? '' : vRow(DI.home, 'Family name', famName(f))) +
            vRow(DI.person, 'Primary contact for the family', primaryOf(f) ? primaryOf(f).n + ' · ' + primaryOf(f).t : '') +
            vRow(DI.phone, 'Phone · Household', f.p, tel(f.p)) +
          '</div>') +
          group('Notifications', notifyRows(f, true)) +
          group('Addresses' + (needsEnrollInfo(f) ? REQ : ''), addrViewRows(f)) +
          group('Parents', parentsOf(f).length ? parentsOf(f).map(function (c) { return contactView(f, c); }).join('')
            : '<p class="fam-empty-note">No parents yet.</p>');
      }
      return '<section class="vB-group"><h3 class="vB-group-label">Family</h3><div class="vB-editcard">' +
          field('Family name', 'name', f.n, ' placeholder="Last name, e.g. Thornley" required') +
          (f.isNew ? '' : (function () {
            var pc = primaryOf(f);
            return '<div class="cm-multi fam-pcrow"><div class="cm-mlabel">Primary contact for the family' + INFO('Responsible for the family by default: notifications, billing and the first call. Default is the father, then the mother.') + '</div>' +
              '<select class="form-control" data-k="primary" aria-label="Primary contact for the family">' + (f.contacts || []).map(function (c, i) {
                return isPro(c.t) ? '' : '<option value="' + i + '"' + (c === pc ? ' selected' : '') + '>' + esc(c.n + ' · ' + c.t) + '</option>';
              }).join('') + '</select>' +
              '</div>' +
              (function () {
                var list = famNumbers(f), pn = primaryNumber(f);
                if (!list.length) return '';
                if (pn) list = [list.filter(function (n) { return n.d === pn.d; })[0]].concat(list.filter(function (n) { return n.d !== pn.d; })).filter(Boolean);
                return '<div class="cm-multi fam-pnrow"><div class="cm-mlabel">Primary number for the family' + INFO('Gets the family\u2019s notifications. Most landlines are not primary, so a mobile is the default.') + '</div>' +
                  '<select class="form-control" data-k="primaryphone" aria-label="Primary number for the family">' + list.map(function (n) {
                    return '<option value="' + n.d + '"' + (pn && pn.d === n.d ? ' selected' : '') + '>' + esc(n.who + ' \u00b7 ' + n.type + ' \u00b7 ' + n.value) + '</option>';
                  }).join('') + '</select>' +
                  '</div>';
              })();
          })()) +
          hhRows(f.p, parseAddr(f.a), f.isNew || !hasMany(f), (function () {
            // The household phone's "Also receives notifications", right under the phone.
            if (f.isNew || !f.p) return '';
            var d = digits(f.p), pn = primaryNumber(f);
            if (pn && pn.d === d) return '<p class="fam-panel-note fam-homeprim">The household phone is the primary number.</p>';
            return '<div class="fam-homealso">' + swHtml('homealso', !!(f.alsoNotify || {})[d], 'Also receives notifications') + '</div>';
          })()) +
          (f.isNew ? '' : hasMany(f) ? addrLinesEdit(f) : homeOnlyFoot(f)) +
        '</div></section>' +

        // Creating a family: its parents are part of it. Everyone else is on Contacts.
        (f.isNew ? '<section class="vB-group"><h3 class="vB-group-label">Father</h3><div class="vB-editcard fam-newparent" data-rel="father"></div></section>' +
          '<section class="vB-group"><h3 class="vB-group-label">Mother</h3><div class="vB-editcard fam-newparent" data-rel="mother"></div></section>'
          : '<section class="vB-group"><h3 class="vB-group-label">Parents</h3><div class="vB-editcard fam-clist fam-clist-parents">' +
              parentsOf(f).map(function (c) { return contactSummary(c, f.contacts.indexOf(c)); }).join('') +
              (parentsOf(f).length < 2 ? '<button type="button" class="reg-add fam-cadd">+ Add parent</button>' : '') +
            '</div></section>');
    },

    contacts: function (f, edit) {
      var others = otherContacts(f);
      if (!edit) {
        return group('Contacts', (others.length ? others.map(function (c) { return contactView(f, c); }).join('') : '') +
          '<button type="button" class="reg-add fam-caddview">+ Add contact</button>') +
          '<p class="fam-panel-note">Anyone here can be made the primary contact, the payer or an emergency contact.</p>';
      }
      return '<section class="vB-group"><h3 class="vB-group-label">Contacts</h3><div class="vB-editcard fam-clist">' +
          others.map(function (c) { return contactSummary(c, f.contacts.indexOf(c)); }).join('') +
          '<button type="button" class="reg-add fam-cadd">+ Add contact</button>' +
        '</div></section>';
    },

    children: function (f) {
      var list = childLinks(f);
      // Dashed, like Add contact, and the same two as after registering a child: a child
      // joins one way or the other, so each button is one of them.
      var add = '<div class="reg-more">' +
        '<button type="button" class="reg-add fam-kidadd" data-m="enroll">+ ' + (list.length ? 'Enroll another child' : 'Enroll a child') + '</button>' +
        '<button type="button" class="reg-add fam-kidadd" data-m="wait">+ Add to waiting list</button></div>';
      // Version B says so when there are none yet.
      var none = !list.length && document.documentElement.classList.contains('fam-b') ? '<div class="fb-nokids">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.870"/><path d="M16 3.130a4 4 0 0 1 0 7.750"/></svg>' +
        '<b>No children yet</b><span>Add each child with a few basics. Everything else can wait.</span></div>' : '';
      return group('Children', none + list.map(function (k) { return '<div class="vB-list fam-headed">' + childRow(k) + '</div>'; }).join('') + add);
    },

    /* BILLING (design review 11/18, section 6). PHP owns billing: the family page shows it and
       starts its actions, and PHP does the work. Card and bank numbers never reach this page:
       "Add card" opens billing's secure form. Prototype: the actions change sample data only. */
    billing: function (f, edit) {
      var payer = payerOf(f);
      if (!edit) {
        var line = function (v) { return v ? '<p class="fb-paytext">' + esc(v) + '</p>' : '<p class="fb-paytext is-none">Not set</p>'; };
        return group('Who pays', payer ? '<div class="fb-phead fb-payview" data-name="' + esc(payer.n) + '"><span class="fb-phead-av"></span>' +
              '<span class="fb-who"><b>' + esc(payer.n) + '</b><small>' + esc(payer.t) + (payer === primaryOf(f) && !(f.billing || {}).payerC ? ' · primary contact' : '') +
              '</small></span></div>' : line('')) +
          group('Billing address', line(billAddress(f))) +
          group('Cards and bank accounts', cardRows(f)) +
          group('Automatic payments', autopayBox(f)) +
          (f.isNew ? '' : group('Payments', '<a class="fb-paylink fam-topayments" href="javascript:void(0);">Open the ' + esc(famName(f)) + ' in Payments</a>' +
            '<p class="fam-panel-note">Each child can have a different payer, and tuition and vouchers are each child’s: open a child for their <b>Tuition</b> tab.</p>'));
      }
      var cs = f.contacts || [];
      return '<section class="vB-group"><h3 class="vB-group-label">Billing</h3><div class="vB-editcard">' +
          '<div class="form-group"><label class="col-sm-3 control-label">Who pays</label><div class="col-sm-4">' +
            '<select class="form-control" data-k="payer">' + cs.map(function (c, i) {
              return canPay(c) ? '<option value="' + i + '"' + (c === payer ? ' selected' : '') + '>' + esc(c.n + ' · ' + c.t) + '</option>' : '';
            }).join('') + (cs.filter(canPay).length ? '' : '<option value="">Nobody in the family yet</option>') + '</select></div></div>' +
        '</div></section>';
    },

    /* EMERGENCY CONTACTS (5.1): the family's own list, in calling order. Reused people with a
       relationship, not free text. Required before a child is enrolled. */
    emergency: function (f, edit) {
      var list = emergOf(f);
      // Required once a child is enrolled (5.1): an asterisk on the title says so. Waiting-list children don't count.
      var title = 'Emergency contacts' + (needsEnrollInfo(f) ? REQ : '');
      if (!edit) {
        return group(title, (list.length ? '<div class="vB-list fam-headed fam-emlist">' + list.map(function (c, i) {
            var p = phoneOf(c, f);
            return '<div class="vB-row fam-emrow"><span class="fam-emn" aria-hidden="true">' + (i + 1) + '</span>' +
              '<span class="vB-row-body"><span class="vB-row-label">' + esc(c.t) + '</span><span class="vB-row-value">' + esc(c.n) + '</span></span>' +
              (p ? '<a class="fam-emphone" href="' + tel(p) + '">' + esc(p) + '</a>' : '<span class="fam-emphone is-none">No phone</span>') + '</div>';
          }).join('') + '</div><p class="fam-panel-note">Called in this order when no parent answers. These are the family\u2019s contacts with Emergency contact on, the same people as in Contacts. Picking up a child is a separate permission on each child.</p>'
          : '') +
          '<button type="button" class="reg-add fam-emaddview">+ Add emergency contact</button>');
      }
      var others = (f.contacts || []).filter(function (c) { return !isPro(c.t) && !c.emerg && !(isParentC(c) && accessOf(c) === 'full'); });
      return '<section class="vB-group"><h3 class="vB-group-label">' + title + '</h3><div class="vB-editcard fam-clist">' +
          '<div class="fam-emrows">' + list.map(function (c, i) { return emergRow(f, c, i + 1); }).join('') + '</div>' +
          '<div class="fam-emnew"></div>' +
          '<div class="fam-emadd">' +
          (others.length ? '<select class="form-control fam-emadd-pick" aria-label="Add one of the family\u2019s contacts"><option value="">Add a family contact\u2026</option>' +
            others.map(function (c) { return '<option value="' + (f.contacts || []).indexOf(c) + '">' + esc(c.n + ' \u00b7 ' + c.t) + '</option>'; }).join('') + '</select>' : '') +
          '<button type="button" class="reg-add fam-emadd-new">+ New person</button></div>' +
          '<p class="fam-panel-note">The order is the calling order: use the arrows. To change someone\u2019s details, edit them on the Contacts tab. A new person is added to Contacts too.</p>' +
        '</div></section>';
    },

    /* PORTAL ACCESS (6.6): one row per parent. The parent portal and its logins are built
       separately; these buttons call its endpoints. */
    portal: function (f) {
      var ps = parentsOf(f);
      if (!ps.length) return group('Portal access', '<p class="fam-empty-note">No parents yet. Add them on the Household tab.</p>');
      return group('Portal access', '<div class="vB-list fam-headed fam-portlist">' + ps.map(function (c, i) {
          var s = portalOf(c, i), lv = accessOf(c);
          var state = s.state === 'active' ? 'Last sign-in ' + s.last : s.state === 'invited' ? 'Invited ' + s.last + ', not accepted yet' : 'No access';
          var btns = s.state === 'active' ? [['reset', 'Reset password'], ['link', 'Send new link'], ['remove', 'Remove access']]
                   : s.state === 'invited' ? [['resend', 'Resend invite'], ['remove', 'Remove access']] : [['invite', 'Send invite']];
          return '<div class="fam-portrow" data-ci="' + (f.contacts || []).indexOf(c) + '">' +
            '<div class="fam-portwho"><b>' + esc(c.n) + '</b><small>' + esc(c.t) + ' · ' + esc(state) + '</small></div>' +
            '<span class="fam-pill' + (lv === 'payment' ? ' is-pay' : '') + '">' + ACCESS_TEXT[lv] + '</span>' +
            '<span class="fam-portstate is-' + s.state + '">' + (s.state === 'active' ? 'On' : s.state === 'invited' ? 'Invited' : 'Off') + '</span>' +
            '<div class="fam-portacts">' + btns.map(function (b) { return '<button type="button" class="btn-sm fam-portbtn" data-act="' + b[0] + '">' + b[1] + '</button>'; }).join('') + '</div></div>';
        }).join('') + '</div>' +
        '<p class="fam-panel-note">Full or Payment only is set on each parent (Household, Edit). A payment-only parent sees only billing in the portal.</p>');
    },

    /* LEDGER (6.7, suggested): the family's balance, charges and payments, line items per child,
       read from PHP. Entering payments and statements stay on the Payments page. */
    ledger: function (f) {
      var rows = ledgerOf(f), bal = rows.reduce(function (t, r) { return t + r.amt; }, 0);
      var money = function (v) { return (v < 0 ? '−' : '') + '$' + Math.abs(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
      return group('Balance', '<div class="fam-ledbal"><b>' + money(bal) + '</b><small>' + (bal > 0 ? 'Due' : 'Nothing due') + '</small></div>') +
        group('Charges and payments', rows.length ? '<div class="fam-ledlist">' + rows.map(function (r) {
            return '<div class="fam-ledrow"><span class="fam-leddate">' + esc(r.date) + '</span><span class="fam-leddesc">' + esc(r.desc) + '</span>' +
              '<span class="fam-ledamt' + (r.amt < 0 ? ' is-pay' : '') + '">' + money(r.amt) + '</span></div>';
          }).join('') + '</div>' : '<p class="fam-empty-note">No charges yet.</p>') +
        group('More', '<div class="fam-ledlinks"><a class="fb-paylink fam-topayments" href="javascript:void(0);">Enter a payment for this family</a>' +
          '<a class="fb-paylink fam-tostatements" href="javascript:void(0);">Statements</a></div>' +
          '<p class="fam-panel-note">Read from billing. Payments, payment history and monthly statements stay on the Payments page.</p>');
    }
  };

  function otherContacts(f) {
    var ps = parentsOf(f);
    return (f.contacts || []).filter(function (c) { return ps.indexOf(c) === -1; });
  }

  // The contact rows on a form, saved; `fixed` are the family's contacts not on it.
  function saveContactRows(f, form, fixed) {
    var rows = [].slice.call(form.querySelectorAll('.fam-crow, .fam-cnew')).filter(function (row) {
      if (!row.classList.contains('fam-cnew')) return true;
      var r0 = readCard(row.querySelector('.cm-extra'));
      return r0.n;                                              // a card with no name is no contact yet
    });
    // Check every open card first, so nothing changes if one is incomplete.
    for (var i = 0; i < rows.length; i++) {
      var card = rows[i].querySelector('.cm-extra');
      if (!card || rows[i].classList.contains('is-removed')) continue;
      var r = readCard(card);
      if (!r.t || !r.n) {
        if (!QUIET) {
          if (window.tndToast) window.tndToast.error('Every contact needs a relationship and a name.');
          rows[i].scrollIntoView({ block: 'center' });
        }
        return false;
      }
    }
    var keep = fixed.slice();
    rows.forEach(function (row) {
      var card = row.querySelector('.cm-extra');
      if (row.classList.contains('fam-cnew')) {
        var rn = readCard(card);
        var nc = { t: rn.t, perm: rn.perm, pays: rn.pays, on: false };
        PERSON_KEYS.forEach(function (k) { nc[k] = rn[k]; });
        if (rn.access) nc.access = rn.access;
        applyRowNotify(f, card);
        if (rn.emerg) setEmerg(f, nc, !isPro(nc.t));
        applyAddrChoice(f, nc, rn);
        keep.push(nc);
        return;
      }
      var c = f.contacts[+row.getAttribute('data-ci')];
      if (row.classList.contains('is-removed')) return;         // the link goes; the person stays elsewhere
      if (card) {
        var r2 = readCard(card), p = personById(pkey(c)), offAddrs = (c.addrs || []).filter(function (a) { return a.off; });
        if (p) applyPerson(p, r2); else { PERSON_KEYS.forEach(function (k) { c[k] = r2[k]; }); }
        c.t = r2.t;                                             // the relationship is this family's link
        if (offAddrs.length && !isParentC(c)) c.addrs = (c.addrs || []).filter(function (a) { return !a.off; }).concat(offAddrs);   // kept, not shown on the card
        if (r2.access) c.access = r2.access;                    // ... and so is the access level (6.1)
        applyRowNotify(f, card);
        reactivateTypes((r2.addrs || []).map(function (a) { return a.type; }));
        if (r2.emerg !== undefined) setEmerg(f, c, r2.emerg && !isPro(c.t));
        applyAddrChoice(f, c, r2);
        // A number's permissions are the number's: the same number elsewhere in the family follows (3.1).
        (r2.phones || []).forEach(function (x) {
          if (x.perm) ['text', 'mms', 'voice'].forEach(function (k) { setNumberPerm(f, digits(x.value), k, !!x.perm[k]); });
        });
        if (r2.perm) c.perm = r2.perm;
        c.pays = r2.pays;
      }
      keep.push(c);
    });
    // Billing names its payer by position; keep it on the same person.
    var payer = payerOf(f);
    f.contacts = keep;
    if (f.billing && f.billing.payer != null && f.billing.payer > -1) {
      f.billing.payer = payer && keep.indexOf(payer) > -1 ? keep.indexOf(payer) : null;
    }
  }

  var TAB_SAVE = {
    details: function (f, form) {
      var v = function (k) { return form.querySelector('[data-k="' + k + '"]').value.trim(); };
      var name = v('name').replace(/\s+(family|household)$/i, '');
      if (!name) {
        if (QUIET) return false;
        if (window.tndToast) window.tndToast.error('Give the family a name.');
        form.querySelector('[data-k="name"]').focus();
        return false;
      }
      var hasHome = !!form.querySelector('[data-k="line1"]');
      if (hasHome && !v('line1') && f.addrs && f.addrs.length) {
        if (QUIET) return false;
        if (window.tndToast) window.tndToast.error('The family needs a Home address while it has other addresses.');
        form.querySelector('[data-k="line1"]').focus();
        return false;
      }
      saveOtherAddrs(f, form);                          // first: a parent may pick a new one below
      // The primary contact, read before the contact rows are rebuilt (they reorder the list).
      var psel = form.querySelector('[data-k="primary"]');
      var pickedPrimary = psel && psel.value !== '' ? (f.contacts || [])[+psel.value] : null;
      // A primary contact removed on this form needs another chosen first (4.1).
      var goingP = primaryOf(f);
      var gRow = goingP && form.querySelector('.fam-crow.is-removed[data-ci="' + f.contacts.indexOf(goingP) + '"]');
      if (gRow && (!pickedPrimary || pickedPrimary === goingP)) {
        if (QUIET) return false;
        if (window.tndToast) window.tndToast.error('Choose another primary contact before removing ' + goingP.n + '.');
        return false;
      }
      if (!f.isNew && saveContactRows(f, form, otherContacts(f)) === false) return false;
      if (pickedPrimary && f.contacts.indexOf(pickedPrimary) > -1) f.primaryC = pickedPrimary;
      var pph = form.querySelector('[data-k="primaryphone"]');
      if (pph && pph.value) f.primaryPhone = pph.value;
      if (f.n && name !== f.n && !f.sur) f.sur = f.n;   // its children are still found by the old surname
      if (!f.key && f.a) f.key = f.a;                   // ... and the old address: set before it changes
      var homeBefore = homeText(f), whoBefore = f.isNew ? [] : homeImpact(f);
      f.n = name;
      var homeAlso = form.querySelector('[data-sw="homealso"]');
      f.p = v('phone');
      if (homeAlso && f.p) { f.alsoNotify = f.alsoNotify || {}; f.alsoNotify[digits(f.p)] = homeAlso.checked; }
      if (hasHome) f.a = [v('line1'), v('line2') ? 'Apt ' + v('line2').replace(/^apt\.?\s*/i, '') : '', v('city'),
             [v('state'), v('zip')].filter(Boolean).join(' ')].filter(Boolean).join(', ');
      if (!f.key) f.key = f.a;                          // a new family: found by what it was saved with
      var homeMoved = !f.isNew && homeBefore && homeText(f) && homeBefore.toLowerCase() !== homeText(f).toLowerCase();
      if (f.isNew) {
        // A parent left without a first name is not added: not every family has both.
        form.querySelectorAll('.fam-newparent .cm-extra').forEach(function (card) {
          var who = window.cmCardValues ? window.cmCardValues(card) : null;
          if (!who || !who.first) return;
          var rp = readCard(card), np = { t: rp.t, perm: rp.perm, pays: rp.pays, on: false };
          PERSON_KEYS.forEach(function (k) { np[k] = rp[k]; });
          if (rp.access) np.access = rp.access;
          applyAddrChoice(f, np, rp);
          f.contacts.push(np);
        });
        // Saved as a draft: it is a family now, and gets its children, then its other contacts.
        delete f.isNew;
        f.creating = true;
        f.draft = true;
        FAMILIES.push(f);
        if (window.cmAddFamily) window.cmAddFamily(f);
        return;
      }
      if (homeMoved && whoBefore.length && !QUIET && window.tndToast) {
        window.tndToast.success('Home address updated for ' + listText(whoBefore) + '.');
        return;
      }
      say(ftabName(FTABS[0]) + ' saved.');
    },

    contacts: function (f, form) {
      if (saveContactRows(f, form, parentsOf(f)) === false) return false;
      say('Contacts saved.');
    },

    emergency: function (f, form) {
      // New people first: checked like any new contact, so nothing changes if one is incomplete.
      var cards = [].slice.call(form.querySelectorAll('.fam-emnew .cm-extra')).map(function (card) { return { card: card, r: readCard(card) }; })
        .filter(function (x) { return x.r.n; });
      for (var i = 0; i < cards.length; i++) {
        if (!cards[i].r.t) {
          if (QUIET) return false;
          if (window.tndToast) window.tndToast.error('Every contact needs a relationship and a name.');
          cards[i].card.scrollIntoView({ block: 'center' });
          return false;
        }
      }
      var on = [];
      form.querySelectorAll('.fam-emrows .fam-erow').forEach(function (row) {
        var c = f.contacts[+row.getAttribute('data-ci')];
        if (c) on.push(c);
      });
      cards.forEach(function (x) {
        var nc = { t: x.r.t, perm: x.r.perm, pays: x.r.pays, on: false };
        PERSON_KEYS.forEach(function (k) { nc[k] = x.r[k]; });
        if (x.r.access) nc.access = x.r.access;
        f.contacts.push(nc);                                     // the same record the Contacts tab shows
        on.push(nc);
      });
      on.forEach(function (c, k) { c.emerg = true; c.emergOrder = k + 1; });
      // Taken off the list: they stay in Contacts, with the setting off.
      (f.contacts || []).forEach(function (c) { if (c.emerg && on.indexOf(c) < 0) c.emerg = false; });
      if (f.draft && !missingForEnroll(f).length) f.draft = false;
      say('Emergency contacts saved.');
    },

    billing: function (f, form) {
      var who = form.querySelector('[data-k="payer"]'), v = who ? who.value : '';
      // The primary contact pays unless someone else is named: naming the primary is not naming anyone.
      var picked = v === '' ? null : (f.contacts || [])[+v];
      f.billing = Object.assign({}, f.billing, { payerC: picked && picked !== primaryOf(f) ? picked : null });
      // Version B's billing address (family-b.js): one of the family's addresses; Home is no choice stored.
      var ba = form.querySelector('[data-k="billaddr"]');
      if (ba) f.billing.addrId = ba.value && ba.value !== 'home' ? ba.value : null;
      say('Billing saved.');
    }
  };

  /* To this family on the Payments page: its own Families view, searched for the family.
     Payments groups families by phone, not by this page's surname and address, so the search
     is for an enrolled child's full name, which finds exactly their family; a surname could
     find several. With no enrolled child it falls back to the surname. */
  function openInPayments(f) {
    var kid = kidsOfHousehold(f).filter(function (c) { return c.s === 'enrolled'; })[0];
    var term = kid ? kid.f + ' ' + f.n : f.n;
    // The published demo is a recorded copy with no Payments page, so it says where this goes.
    if (window.__TENDI_REPLAY__) {
      if (window.tndToast) window.tndToast.success('In Tendi this opens the ' + famName(f) + ' on the Payments page.');
      return;
    }
    window.location.hash = 'payments';
    var t0 = Date.now();
    (function wait() {
      var btn = document.querySelector('.pay-view-btn[data-view="families"]');
      var box = document.getElementById('famSearch');
      if (!btn || !box) { if (Date.now() - t0 < 8000) setTimeout(wait, 80); return; }
      btn.click();
      box.value = term;
      box.dispatchEvent(new Event('input', { bubbles: true }));
    })();
  }

  // Credit Card opens the family's cards on file, and Add card, as on the Payments page.
  function wireCards(f, portal) {
    var box = portal.querySelector('.fam-cards'), sel = portal.querySelector('[data-k="method"]');
    var list = box.querySelector('.fam-cardlist'), form = box.querySelector('.fam-cardform'), add = box.querySelector('.fam-cardadd');
    var field = function (k) { return form.querySelector('[data-c="' + k + '"]'); };
    var draw = function () {
      list.innerHTML = (f.cards || []).length ? f.cards.map(function (c) {
        return '<div class="fam-cardrowitem"><b>' + esc(c.brand) + '</b> \u2022\u2022\u2022\u2022 ' + esc(c.last4) +
          (c.nick ? ' <span>' + esc(c.nick) + '</span>' : '') + '</div>';
      }).join('') : '<p class="fam-empty-note">No cards on file for this family.</p>';
    };
    var openForm = function (open) {
      form.hidden = !open;
      add.hidden = open;
      ['num', 'cvv', 'exp', 'name', 'nick'].forEach(function (k) { field(k).value = ''; });
    };
    var sync = function () {
      box.hidden = sel.value !== 'Credit Card';
      // Version B: Credit Card with no card yet goes straight to the card's fields.
      if (!box.hidden && !(f.cards || []).length && form.hidden && document.documentElement.classList.contains('fam-b')) {
        form.hidden = false;
        add.hidden = true;
      }
    };
    sel.addEventListener('change', sync);
    add.addEventListener('click', function () { openForm(true); field('num').focus(); });
    box.querySelector('.fam-cardcancel').addEventListener('click', function () { openForm(false); });
    box.querySelector('.fam-cardsave').addEventListener('click', function () {
      var num = field('num').value.replace(/\D/g, '');
      if (!num) { openForm(false); return; }            // nothing typed: nothing to add
      var brand = { 3: 'Amex', 4: 'Visa', 5: 'Mastercard', 6: 'Discover' }[num.charAt(0)] || 'Card';
      f.cards = (f.cards || []).concat([{ brand: brand, last4: num.slice(-4), nick: field('nick').value.trim() }]);
      openForm(false);
      draw();
      if (!QUIET && window.tndToast) window.tndToast.success('Card added.');
    });
    draw();
    sync();
  }

  // The rows on an edit form: each person's card, filled in; Remove; and the add button,
  // whose new card starts as `rel` when one is given. Returns that button.
  function wireContactRows(f, portal, rel) {
    var list = portal.querySelector('.fam-clist');
    // Each person is a closed card of their own: click to open. The form inside is built on
    // first opening, and a person never opened is saved as they were.
    portal.querySelectorAll('.fam-crow').forEach(function (row) {
      var c = f.contacts[+row.getAttribute('data-ci')];
      row.querySelector('.fam-crow-main').addEventListener('click', function (e) {
        if (e.target.closest('.fam-cremove')) return;
        var host = row.querySelector('.fam-crow-card');
        if (!host.firstChild) {
          var card = personCard(f, c);
          if (card) host.appendChild(card);
        }
        row.classList.toggle('is-editing');
      });
      row.querySelector('.fam-cremove').addEventListener('click', function () {
        var off = !row.classList.contains('is-removed');
        // The primary contact can't be removed until another one is chosen (4.1).
        var psel = portal.querySelector('[data-k="primary"]');
        var chosen = psel && psel.value !== '' ? f.contacts[+psel.value] : primaryOf(f);
        if (off && c === chosen) {
          if (window.tndToast) window.tndToast.error(c.n + ' is the primary contact. Choose another primary contact first.');
          return;
        }
        row.classList.toggle('is-removed', off);
        this.textContent = off ? 'Undo' : 'Remove';
      });
    });
    var add = portal.querySelector('.fam-cadd');
    if (add) add.addEventListener('click', function () {
      var wrap = document.createElement('div');
      wrap.className = 'fam-cnew';
      wrap.innerHTML = '<div class="fam-cnew-head"><b>New ' + (rel ? 'parent' : 'contact') + '</b><span class="up-head-spacer"></span>' +
        '<button type="button" class="fam-cremove">Remove</button></div>';
      var card = personCard(f, null);
      if (!card) return;
      wrap.appendChild(card);
      list.insertBefore(wrap, add);
      wrap.querySelector('.fam-cremove').addEventListener('click', function () { wrap.remove(); });
      var sel = card.querySelector('.cm-ptype select');
      if (sel) {
        if (rel) { sel.value = rel; sel.dispatchEvent(new Event('change')); card.classList.add('fam-fixedrel'); }   // + Add parent: fixed too
        else sel.focus();
      }
    });
    return add;
  }

  // What a tab needs once drawn: the contact cards, filled in; the address switch.
  var TAB_WIRE = {
    contacts: function (f, portal, st, opts) {
      if (!st.edit) return;
      var add = wireContactRows(f, portal);
      // "Add a contact": start with an empty card.
      if (opts.addContact && add) add.click();
    },
    details: function (f, portal, st) {
      if (!st.edit) { wireNotify(f, portal); return; }
      wireOtherAddrs(f, portal);
      var nm = portal.querySelector('[data-k="name"]');
      if (!f.isNew) { wireContactRows(f, portal, parentsOf(f)[0] && /^father$/i.test(parentsOf(f)[0].t) ? 'mother' : 'father'); return; }
      var lasts = [];
      portal.querySelectorAll('.fam-newparent').forEach(function (hostEl) {
        var card = personCard(f, null);
        if (!card) return;
        var sel = card.querySelector('.cm-ptype select');
        if (sel) { sel.value = hostEl.getAttribute('data-rel'); sel.dispatchEvent(new Event('change')); }
        // The Father and Mother sections fix the relationship (4.2): the section title says it, no dropdown.
        card.classList.add('fam-fixedrel');
        // "Copy the household address" reads what is typed above, not what is saved.
        var ab = card.querySelector('.cm-multi[data-multi="address"]');
        if (ab) ab._hhAddr = function () {
          var v = function (k) { return portal.querySelector('[data-k="' + k + '"]').value.trim(); };
          return [v('line1'), v('line2'), v('city'), [v('state'), v('zip')].filter(Boolean).join(' ')].filter(Boolean).join(', ');
        };
        hostEl.appendChild(card);
        var gs = card.querySelectorAll('[data-part="name"] .form-group');
        for (var i = 0; i < gs.length; i++) {
          var l = gs[i].querySelector('label');
          if (l && /^last name$/i.test((l.textContent || '').trim())) lasts.push(gs[i].querySelector('input'));
        }
      });
      // The family name is the parents' last name until someone types another one.
      if (nm) nm.addEventListener('input', function () {
        lasts.forEach(function (x) { if (x && (!x.value || x.getAttribute('data-auto') === '1')) { x.value = nm.value; x.setAttribute('data-auto', '1'); } });
      });
      lasts.forEach(function (x) { if (x) x.addEventListener('input', function () { x.removeAttribute('data-auto'); }); });
      if (nm) nm.focus();
    },
    billing: function (f, portal, st) {
      if (st.edit) return;
      wireToPayments(f, portal);
      wireBillingActs(f, portal);
    },
    emergency: function (f, portal, st) {
      if (!st.edit) {
        var av = portal.querySelector('.fam-emaddview');
        if (av) av.addEventListener('click', function () { openDrawer(f, 'emergency', { edit: true, instant: true }); });
        return;
      }
      var box = portal.querySelector('.fam-emrows'), nbox = portal.querySelector('.fam-emnew');
      var pick = portal.querySelector('.fam-emadd-pick');
      var renumber = function () {
        box.querySelectorAll('.fam-erow').forEach(function (r, i) { r.querySelector('.fam-emn').textContent = i + 1; });
        box.dispatchEvent(new Event('change', { bubbles: true }));
      };
      // + New person: the same card as adding a contact on the Contacts tab, Emergency contact already on.
      portal.querySelector('.fam-emadd-new').addEventListener('click', function () {
        var wrap = document.createElement('div');
        wrap.className = 'fam-cnew';
        wrap.innerHTML = '<div class="fam-cnew-head"><b>New emergency contact</b><span class="up-head-spacer"></span>' +
          '<button type="button" class="fam-cremove">Remove</button></div>';
        var card = personCard(f, null);
        if (!card) return;
        wrap.appendChild(card);
        nbox.appendChild(wrap);
        var sw = card.querySelector('.fam-emsw input');
        if (sw && !sw.checked) { sw.checked = true; sw.dispatchEvent(new Event('change', { bubbles: true })); }
        wrap.querySelector('.fam-cremove').addEventListener('click', function () { wrap.remove(); });
        var sel = card.querySelector('.cm-ptype select');
        if (sel) sel.focus();
      });
      if (pick) pick.addEventListener('change', function () {
        var ci = +pick.value, c = (f.contacts || [])[ci];
        if (pick.value === '' || !c) return;
        pick.querySelector('option[value="' + ci + '"]').remove();   // ticked: one row per person
        pick.value = '';
        box.insertAdjacentHTML('beforeend', emergRow(f, c, box.children.length + 1));
        renumber();
      });
      box.addEventListener('click', function (e) {
        var row = e.target.closest('.fam-erow');
        if (!row) return;
        if (e.target.closest('.fam-emrm')) {
          var ci = row.getAttribute('data-ci'), c = f.contacts[+ci];
          if (c && pick) pick.insertAdjacentHTML('beforeend', '<option value="' + ci + '">' + esc(c.n + ' \u00b7 ' + c.t) + '</option>');
          row.remove();
        }
        else if (e.target.closest('.fam-emup') && row.previousElementSibling) box.insertBefore(row, row.previousElementSibling);
        else if (e.target.closest('.fam-emdown') && row.nextElementSibling) box.insertBefore(row.nextElementSibling, row);
        else return;
        renumber();
      });
    },
    portal: function (f, portal) {
      portal.querySelectorAll('.fam-portbtn').forEach(function (b) {
        b.addEventListener('click', function () {
          var c = f.contacts[+b.closest('.fam-portrow').getAttribute('data-ci')], act = b.getAttribute('data-act');
          var first = String(c.n || '').split(' ')[0];
          var done = function (msg) { if (window.tndToast) window.tndToast.success(msg); openDrawer(f, 'portal', { instant: true }); };
          if (act === 'remove') {
            famPop('Remove portal access?', '<p>' + esc(c.n) + ' will no longer sign in to the parent portal. You can send a new invite later.</p>', 'Remove access', function () {
              c.portal = { state: 'none' }; done('Portal access removed for ' + first + '.');
            }, true);
            return;
          }
          if (act === 'invite' || act === 'resend') { c.portal = { state: 'invited', last: nyDate() }; done('Invite sent to ' + first + '.'); return; }
          done(act === 'reset' ? 'Password reset link sent to ' + first + '.' : 'New sign-in link sent to ' + first + '.');
        });
      });
    },
    ledger: function (f, portal) {
      wireToPayments(f, portal);
      var st2 = portal.querySelector('.fam-tostatements');
      if (st2) st2.addEventListener('click', function () {
        if (window.tndToast) window.tndToast.success('In Tendi this opens the ' + famName(f) + '\u2019s statements on the Payments page.');
      });
    }
  };

  function wireToPayments(f, portal) {
    var a = portal.querySelector('.fam-topayments');
    if (a) a.addEventListener('click', function () {
      clearPlan();                                    // leaving ends a registration
      closeDrawer();
      openInPayments(f);
    });
  }

  // Notifications on the Household tab change at once, one click each, as the review asked.
  function wireNotify(f, portal) {
    var box = portal.querySelector('.fam-notify');
    if (!box) return;
    var again = function (msg) { if (window.tndToast) window.tndToast.success(msg); openDrawer(f, 'details', { instant: true }); };
    var sel = box.querySelector('.fam-nprim-sel');
    if (sel) sel.addEventListener('change', function () { f.primaryPhone = sel.value; again('Primary number changed.'); });
    box.addEventListener('change', function (e) {
      var sw = e.target.closest('[data-sw]');
      if (!sw) return;
      var d = sw.closest('.fam-nrow').getAttribute('data-d'), key = sw.getAttribute('data-sw');
      if (key === 'also') { f.alsoNotify[d] = sw.checked; again(sw.checked ? 'This number also gets notifications.' : 'This number no longer gets notifications.'); return; }
      var on = sw.checked;
      setNumberPerm(f, d, key, on);
      sw.closest('.fam-sw').classList.toggle('is-on', on);
      famUndo({ text: 'Text', mms: 'MMS', voice: 'Voice' }[key] + (on ? ' on' : ' off') + ' for ' + sw.closest('.fam-nrow').querySelector('.fam-nwho b').textContent + '.', function () {
        setNumberPerm(f, d, key, !on);
        var pt = document.querySelector('.fam-portal');
        if (pt && pt._fam === f && !pt.querySelector('.fam-editform')) openDrawer(f, 'details', { instant: true });
      });
    });
  }

  /* Cards and automatic payments: each button stands for a PHP billing endpoint (6.8). Here they
     change the sample data and redraw the tab. */
  function wireBillingActs(f, portal) {
    var before = { cards: clone(f.cards), autopay: clone(f.autopay), chargeDays: clone(f.chargeDays), linkSent: f.linkSent };
    var restore = function () {
      f.cards = clone(before.cards); f.autopay = clone(before.autopay); f.chargeDays = clone(before.chargeDays); f.linkSent = before.linkSent;
      var pt = document.querySelector('.fam-portal');
      if (pt && pt._fam === f) openDrawer(f, 'billing', { instant: true });
    };
    var redraw = function (msg) { if (msg) famUndo(msg, restore); openDrawer(f, 'billing', { instant: true }); };
    var ap = f.autopay, payer = payerOf(f), pFirst = payer ? String(payer.n).split(' ')[0] : 'the payer';
    var liveCards = function () { return (f.cards || []).map(function (c, i) { return { c: c, i: i }; }).filter(function (x) { return !x.c.off; }); };
    portal.querySelectorAll('.fam-cardact').forEach(function (b) {
      b.addEventListener('click', function () {
        var act = b.getAttribute('data-act'), row = b.closest('.fam-card2'), i = row ? +row.getAttribute('data-i') : -1;
        if (act === 'link') { f.linkSent = payer ? payer.n : 'the payer'; redraw('Card setup link sent to ' + pFirst + '.'); return; }
        if (act === 'useap') { ap.card = i; if (ap.status === 'attention') ap.status = 'on'; redraw('Automatic payments now use ' + cardName(f.cards[i]) + '.'); return; }
        if (act === 'off') {
          if (ap.status !== 'off' && ap.card === i) { if (window.tndToast) window.tndToast.error('Automatic payments use this card. Choose another card for them first.'); return; }
          famPop('Deactivate this card?', '<p>' + esc(cardName(f.cards[i])) + ' stays in billing’s history but can’t be charged.</p>', 'Deactivate', function () {
            f.cards[i].off = true; redraw('Card deactivated.');
          }, true);
          return;
        }
        if (act === 'add') {
          famPop('Add a card', '<p>In Tendi this opens billing’s secure card form. The card number never passes through the family page.</p>' +
            '<p class="fam-pop-note">Prototype: a sample card is used.</p>' +
            '<input type="text" class="form-control" data-np="nick" placeholder="Nickname (optional)" aria-label="Nickname">', 'Continue', function (p) {
            var nick = p.querySelector('[data-np="nick"]').value.trim();
            var card = { brand: 'Visa', last4: String(1000 + Math.floor(Math.random() * 8999)), nick: nick, exp: '12/2029' };
            setTimeout(function () {
              famPop('Save this card?', '<p class="fam-pop-addr">' + esc(cardName(card)) + (nick ? ' · ' + esc(nick) : '') + '</p><p>It is saved for the family, the same card on the child and Payments pages.</p>', 'Save card', function () {
                f.cards.push(card);
                var cur = (f.cards || [])[ap.card];
                if (ap.status === 'off' || !cur) { redraw('Card saved.'); return; }
                setTimeout(function () {
                  famPop('Use it for automatic payments?', '<p>Instead of ' + esc(cardName(cur)) + '. Useful when that card expired.</p>' +
                    '<label class="fam-popck"><input type="checkbox" data-np="offothers"> Deactivate the other cards</label>', 'Use this card', function (p2) {
                    ap.card = f.cards.length - 1;
                    if (ap.status === 'attention') ap.status = 'on';
                    if (p2.querySelector('[data-np="offothers"]').checked) f.cards.forEach(function (c, k) { if (k !== ap.card) c.off = true; });
                    redraw('Card saved and used for automatic payments.');
                  })._onCancel = function () { redraw('Card saved.'); };
                }, 0);
              });
            }, 0);
          });
        }
      });
    });
    portal.querySelectorAll('.fam-apday').forEach(function (s) {
      s.addEventListener('change', function () { f.chargeDays[s.getAttribute('data-kid')] = +s.value; famUndo('Charge day saved for ' + s.getAttribute('data-kid') + '.', restore); });
    });
    portal.querySelectorAll('.fam-apact').forEach(function (b) {
      b.addEventListener('click', function () {
        var act = b.getAttribute('data-act');
        if (act === 'consent') { if (!liveCards().length) { if (window.tndToast) window.tndToast.error('Add a card first.'); return; }
          ap.status = 'waiting'; ap.card = ap.card != null && f.cards[ap.card] && !f.cards[ap.card].off ? ap.card : liveCards()[0].i; redraw('Consent link sent to ' + pFirst + '.'); return; }
        if (act === 'phone') {
          if (!liveCards().length) { if (window.tndToast) window.tndToast.error('Add a card first.'); return; }
          famPop('Record phone consent', '<p>Who agreed on the phone?</p><select class="form-control" data-np="who">' + (f.contacts || []).filter(canPay).map(function (c) {
            return '<option>' + esc(c.n) + '</option>'; }).join('') + '</select>', 'Record consent', function (p) {
            ap.status = 'on'; ap.card = ap.card != null && f.cards[ap.card] && !f.cards[ap.card].off ? ap.card : liveCards()[0].i;
            ap.consent = { who: p.querySelector('[data-np="who"]').value, how: 'phone', when: nyDate() };
            redraw('Automatic payments are on.');
          });
          return;
        }
        if (act === 'pause') {
          var d = new Date(); d.setDate(d.getDate() + 30);
          famPop('Pause automatic payments?', '<p>Nothing is charged until ' + nyDate(d) + '. You can resume earlier.</p>', 'Pause', function () {
            ap.status = 'paused'; ap.until = nyDate(d); redraw('Automatic payments paused.');
          });
          return;
        }
        if (act === 'resume') { ap.status = 'on'; delete ap.until; redraw('Automatic payments resumed.'); return; }
        if (act === 'stop') {
          famPop('Stop automatic payments?', '<p>The parent’s consent ends. Turning them on again needs a new consent.</p>', 'Stop', function () {
            f.autopay = { status: 'off' }; redraw('Automatic payments stopped.');
          }, true);
          return;
        }
        if (act === 'card') {
          var lc = liveCards();
          famPop('Card for automatic payments', '<select class="form-control" data-np="card">' + lc.map(function (x) {
            return '<option value="' + x.i + '"' + (x.i === ap.card ? ' selected' : '') + '>' + esc(cardName(x.c)) + '</option>'; }).join('') + '</select>', 'Use this card', function (p) {
            ap.card = +p.querySelector('[data-np="card"]').value; if (ap.status === 'attention') ap.status = 'on'; redraw('Card changed.');
          });
        }
      });
    });
  }

  // The registration's plan, which changemap.js's child steps read and move on.
  function writePlan(p) { try { sessionStorage.setItem('cm-reg', JSON.stringify(p)); } catch (err) {} }
  function clearPlan() { try { sessionStorage.removeItem('cm-reg'); } catch (err) {} }

  // A child joins a family from its Children tab: the regular New child panel, with
  // the family already picked, enrollment or the waiting list set from the button.
  function addChild(f, mode, earlier) {
    STATE.regFam = f;
    writePlan({ kids: [{ m: mode === 'wait' ? 'wait' : 'enroll' }], cur: 0, snaps: [], at: Date.now(), lname: f.n, famKnown: true, earlier: earlier || [] });
    if (window.cmAddFamily) window.cmAddFamily(f);
    var portal = document.querySelector('.fam-portal');
    if (portal) swapToChild(portal, { n: f.n, a: f.a });
    else newChildPanel({ n: f.n, a: f.a });
  }

  // From a child's Tuition tab, wherever the child was opened: to their family's Billing tab.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.cm-tobilling');
    if (!a) return;
    e.preventDefault();
    var id = String(a.getAttribute('data-child'));
    load().then(function () {
      var rec = CHILDREN_ALL.concat(CHILDREN_OFF).filter(function (c) { return String(c.id) === id; })[0];
      var f = rec && (FAMILIES || []).filter(function (x) { return kidsOfHousehold(x).indexOf(rec) > -1; })[0];
      if (!f) {
        if (window.tndToast) window.tndToast.error('This child is not linked to a family yet.');
        return;
      }
      if (window.TndListDrawer) window.TndListDrawer.close(true);
      if (page() !== 'families') window.location.hash = 'families';
      var t0 = Date.now();
      (function wait() {
        if (!document.getElementById('famRows')) { if (Date.now() - t0 < 8000) setTimeout(wait, 80); return; }
        highlight();
        openDrawer(f, 'billing');
      })();
    });
  });

  // From the welcome: the next child of the same family, in the same panel.
  document.addEventListener('cm-reg-more', function (e) {
    if (STATE.regFam) addChild(STATE.regFam, e.detail.mode, e.detail.earlier);
  });

  // Return from the child goes back to the family's Children tab.
  window.cmOpenFamilySetup = function () {
    if (STATE.regFam) openDrawer(STATE.regFam, 'children', { instant: true });
  };

  // Finish: the child is now in the family's list, and the family is no longer a draft.
  document.addEventListener('cm-reg-done', function (e) {
    var f = STATE.regFam, plan = e.detail;
    if (!f || !plan) return;
    (plan.snaps || []).forEach(function (s, i) {
      if (!s || !s.fname) return;
      f.extra = (f.extra || []).concat([{ f: s.fname, l: f.sur || f.n, a: homeKey(f),
        s: plan.kids[i] && plan.kids[i].m === 'wait' ? 'waitlist' : 'enrolled', cl: s.cls || '' }]);
      f.k = kids(f).concat([s.fname]).join(', ');
      f.c = kids(f).length;
    });
    f.draft = false;
    refresh();
  });
  document.addEventListener('cm-reg-closed', function () {
    var f = STATE.regFam;
    STATE.regFam = null;
    var html = document.documentElement;
    if (f && html.classList.contains('fam-b') && document.querySelector('.fam-portal')) {
      var tab = html.getAttribute('data-fb-tab') || 'children';
      html.removeAttribute('data-fb-tab');
      openDrawer(f, tab, { edit: true, instant: true });
      return;
    }
    // A family still being created goes on to its other contacts and billing, ready to fill in.
    // An existing one goes back to the list the child joined.
    if (f && document.getElementById('tndFamiliesPage')) {
      setTimeout(function () {
        if (f.creating) { delete f.creating; openDrawer(f, 'contacts', { edit: true, instant: true }); }
        else openDrawer(f, 'children', { instant: true });
      }, 260);
    }
  });

  /* ---- a person (FAM-FAM-6) ----------------------------------------------
     The household panel's parts again: hero, then Details, then Linked to — every
     household and child this one record reaches, each opening that household or
     child. What they may do for ONE child is that child's Family tab, not here. */
  /* A CHILD OPENS ONE LEVEL DEEPER (design review 11/18, 7.1). The child record is the app's own
     panel, so the family panel steps aside without a slide and the child panel opens in its place,
     with a breadcrumb back (family-review.js). Back returns to the same tab and scroll. */
  function openChild(id, name) {
    var portal = document.querySelector('.fam-portal');
    var body = portal && portal.querySelector('.tnd-pane-body');
    var tabBtn = portal && portal.querySelector('.fam-ftabs .tnd-tab.is-active');
    window.__famFrom = portal ? { f: portal._fam, tab: tabBtn ? tabBtn.getAttribute('data-ftab') : 'children', scroll: body ? body.scrollTop : 0, child: String(id) } : null;
    if (portal) portal.remove();                        // no slide: the next level replaces it
    document.querySelectorAll('.fam-row.is-open').forEach(function (r) { r.classList.remove('is-open'); });
    STATE.open = null;
    if (window.TndListDrawer && typeof window.TndListDrawer.openRecord === 'function') {
      setTimeout(function () {
        window.TndListDrawer.openRecord('children/edit/' + id, { id: id, name: name });
        // The child panel opens on an animation frame; if that frame never comes, finish opening it.
        setTimeout(function () {
          var dr = document.getElementById('tndDrawer'), sc = document.getElementById('tndDrawerScrim');
          if (dr && !dr.hidden && !dr.classList.contains('is-open')) { dr.classList.add('is-open'); if (sc) sc.classList.add('is-open'); }
        }, 600);
      }, 230);
    }
  }

  // For family-review.js: the family a child belongs to, and the way back to it.
  window.famReview = {
    familyOfChild: function (id) {
      var rec = CHILDREN_ALL.concat(CHILDREN_OFF).filter(function (c) { return String(c.id) === String(id); })[0];
      var f = rec && (FAMILIES || []).filter(function (x) { return kidsOfHousehold(x).indexOf(rec) > -1; })[0];
      return f ? { f: f, rec: rec } : null;
    },
    load: load,
    famName: famName, payerOf: payerOf, primaryOf: primaryOf, emergOf: emergList, canPay: canPay, esc: esc,
    backTo: function (f, tab, scroll) {
      if (window.TndListDrawer) window.TndListDrawer.close(true);
      var go = function () {
        var portal = openDrawer(f, tab || 'children', { instant: true });
        var body = portal && portal.querySelector('.tnd-pane-body');
        if (body && scroll) requestAnimationFrame(function () { body.scrollTop = scroll; });
      };
      if (page() !== 'families') {
        window.location.hash = 'families';
        var t0 = Date.now();
        (function wait() {
          if (!document.getElementById('famRows')) { if (Date.now() - t0 < 8000) setTimeout(wait, 80); return; }
          go();
        })();
      } else setTimeout(go, 60);
    }
  };

  function personAddress(c, f) {
    if (f && isParentC(c)) {
      var a = parentAddr(c, f);
      return a ? (a.id === 'home' ? 'Family Home · ' : a.type + ' · ') + a.value : '';
    }
    if (c.addr) return c.addr;
    return f && f.a ? 'Lives at the household address · ' + String(f.a).replace(/,?\s*USA$/i, '') : '';
  }

  /* A contact's phones, emails and addresses as lists (client review, 2026-10-27):
     each with a type, one primary. The mock contacts carry p / p2 / e / addr, so
     those are read as lists until a card saves real ones. */
  var PERSON_KEYS = ['n', 'p', 'p2', 'e', 'msg', 'addr', 'occ', 'emp', 'phones', 'emails', 'addrs', 'title', 'heb'];
  function listsOf(c, f) {
    var hh = f ? String(f.a || '').replace(/,?\s*USA$/i, '') : '';
    var out = window.cmMulti ? window.cmMulti.items(c, hh) : { phone: [], email: [], address: [] };
    out.address = out.address.filter(function (a) { return !a.off; })
      .map(function (a) { return f ? resolveAddr(f, a) : a; }).filter(Boolean);
    // A contact who is not a parent has only their own addresses: no falling back to the family Home.
    if (f && !isParentC(c) && !c.addrs && !c.addr) out.address = [];
    // A parent's address is a link to one of the family's: read it from there, never a copy.
    if (f && isParentC(c)) {
      var a = parentAddr(c, f);
      out.address = a ? [{ type: a.type, value: a.value, primary: true }] : [];
    }
    return out;
  }
  var LIST_NAME = { phone: 'Phone', email: 'Email', address: 'Address' };
  function listLabel(kind, x, withPrimary) {
    // A phone says what it may receive: Text, MMS, Voice (3.3). "Cell" reads "Mobile" now.
    var perm = kind === 'phone' ? permsOf(x) : null;
    return [LIST_NAME[kind], x.type === 'Cell' ? 'Mobile' : x.type, withPrimary && x.primary ? 'primary' : '',
            perm && (perm.text || perm.mms || perm.voice) ? permText(perm) : ''].filter(Boolean).join(' \u00b7 ');
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

  // A contact's main address; Edit shows the whole list.
  function primaryAddress(items) {
    var x = items.filter(function (i) { return i.primary; })[0] || items[0];
    return x && x.value ? vRow(DI.home, listLabel('address', x, false), x.value) : '';
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
        // Version B: only the family is a link here; its children are just named.
        if (document.documentElement.classList.contains('fam-b')) return row;
        return k ? row.replace('<div class="vB-row"', '<a class="vB-row vB-row--action fam-tochild" data-child="' + k.id +
          '" data-childname="' + esc(n + ' ' + l.f.n) + '" href="javascript:void(0);"').replace(/<\/div>$/, DI.cta + '</a>') : row;
      }).join('');
      return '<div class="vB-list fam-headed fam-linked">' +
        '<a class="vB-row vB-row--action fam-tohh" data-li="' + li + '" href="javascript:void(0);">' +
          // Version B: a family keeps the Families area's own icon; the house is the Household tab's.
          '<span class="vB-row-ico" aria-hidden="true">' + (document.documentElement.classList.contains('fam-b') ? AREA_ICON : DI.home) + '</span>' +
          '<span class="vB-row-body"><span class="vB-row-label">' + esc(l.c.t) + '</span>' +
          '<span class="vB-row-value">' + esc(l.f.n) + ' family</span></span>' +
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
          '<section class="vB-hero fam-fhero">' +
            '<span class="vB-avatar ' + acc(c.n) + '" aria-hidden="true">' + esc(initials(c.n)) + '</span>' +
            '<h2 class="vB-name">' + esc(c.n) + '</h2>' +
            '<div class="vB-hero-meta"><span class="vB-idtag">' + esc(p.types.join(', ')) + ' · ' + hh +
              (hh === 1 ? ' family' : ' families') + ' · ' + p.kids + (p.kids === 1 ? ' child' : ' children') + '</span></div>' +
          '</section>' +
          '<div class="fam-tbody">' +
          group('Details',
            '<div class="vB-list fam-pblock">' +
              listRows(listsOf(c, f0).phone, 'phone') +
              listRows(listsOf(c, f0).email, 'email') +
              vRow(DI.group, 'Work', [c.occ, c.emp].filter(Boolean).join(' · ')) +
              primaryAddress(listsOf(c, f0).address) +
            '</div>') +
          group('Linked to', linked) +
          '</div>' +
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
    return CHILDREN_ALL.concat(CHILDREN_OFF, f.extra || []).filter(function (c) {
      return c.l.toLowerCase() === String(f.sur || f.n).toLowerCase() && c.a.toLowerCase() === homeKey(f);
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
    addrPicker(f, c, card, ab);
    if (!c) { cardExtras(f, null, card); return card; }
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
    // Only a parent falls back to the family Home; anyone else starts with their own addresses (or none).
    if (window.cmMulti) window.cmMulti.fill(card, c, isParentC(c) ? hh : '');
    set(inp('work', /^occupation$/i), c.occ);
    set(inp('work', /^employer$/i), c.emp);
    // Their Payment responsible tick, as last saved.
    var paysBox = card.querySelector('[data-perm="payer"]');
    if (paysBox && c.pays != null && paysBox.checked !== c.pays) {
      paysBox.checked = c.pays;
      paysBox.dispatchEvent(new Event('change'));
    }
    cardExtras(f, c, card);
    return card;
  }

  /* The family panel's person card (design review 11/18): Title and Hebrew name (4.3), the access
     level for a parent (6.1) in place of the five permission ticks, and "Pick a family number"
     (3): the home number stays the family's, linked into the person's list, never retyped. */
  var TITLES = ['', 'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Rabbi'];
  function cardExtras(f, c, card) {
    card.classList.add('fam-ctx');
    // A parent's relationship is fixed, in the new-family form and in Edit (4.2, as reviewed 11/20).
    if (c && isParentC(c)) card.classList.add('fam-fixedrel');
    var namePart = card.querySelector('[data-part="name"]');
    if (namePart && !card.querySelector('.fam-titlebox')) {
      var tb = document.createElement('div');
      tb.className = 'fam-titlebox';
      tb.innerHTML = '<label class="fam-mini"><span>Title</span><select class="form-control fam-title" aria-label="Title">' + TITLES.map(function (t) {
          return '<option value="' + t + '"' + (c && c.title === t ? ' selected' : '') + '>' + (t || 'None') + '</option>';
        }).join('') + '</select></label>' +
        '<label class="fam-mini fam-mini-wide"><span>Hebrew name</span><input type="text" class="form-control fam-heb" dir="auto" aria-label="Hebrew name" value="' + esc((c && c.heb) || '') + '"></label>';
      namePart.parentNode.insertBefore(tb, namePart.nextSibling);
    }
    // Access level: a parent is Full by default; Payment only gets bills and nothing else.
    var rel = card.querySelector('.cm-ptype select');
    var acc = document.createElement('div');
    acc.className = 'fam-access';
    acc.innerHTML = '<span class="fam-mini-l">Access</span><div class="fam-accseg" role="radiogroup" aria-label="Access level">' +
      '<button type="button" data-acc="full" role="radio">Full</button><button type="button" data-acc="payment" role="radio">Payment only</button></div>' +
      '<small class="fam-access-note"></small>';
    var ptype = card.querySelector('.cm-ptype');
    if (ptype) ptype.parentNode.insertBefore(acc, ptype.nextSibling);
    var drawAcc = function () {
      acc.querySelectorAll('[data-acc]').forEach(function (b) { var on = b.getAttribute('data-acc') === card._access; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
      acc.querySelector('.fam-access-note').textContent = card._access === 'payment'
        ? 'Bills, receipts and card links only. No child notifications or reports, and can\u2019t pick up.'
        : 'Everything: notifications, reports and pick-up. Who pays is set on Billing.';
    };
    card._access = accessOf(c);
    acc.addEventListener('click', function (e) {
      var b = e.target.closest('[data-acc]');
      if (!b) return;
      card._access = b.getAttribute('data-acc');
      drawAcc();
      card.dispatchEvent(new Event('input', { bubbles: true }));
    });
    var syncAcc = function () { acc.style.display = rel && /^(father|mother)$/i.test(rel.value || '') ? '' : 'none'; };
    if (rel) rel.addEventListener('change', syncAcc);
    syncAcc(); drawAcc();
    // Emergency contact: the same setting the Emergency contacts tab lists and orders (5.1).
    var em = document.createElement('div');
    em.className = 'fam-emsw';
    var order = c && c.emerg ? emergOf(f).indexOf(c) + 1 : 0;
    // The hint is a tooltip; the calling order shows only once they are on the list.
    em.innerHTML = swHtml('emerg', !!(c && c.emerg), 'Emergency contact') +
      (order ? '<small>Number ' + order + ' to call. Change the order on the Emergency contacts tab.</small>' : '');
    em.querySelector('.fam-sw').title = 'Called in order when no parent answers.';
    acc.parentNode.insertBefore(em, acc.nextSibling);
    card._emerg = !!(c && c.emerg);
    em.querySelector('input').addEventListener('change', function (e) {
      card._emerg = e.target.checked;
      em.querySelector('.fam-sw').classList.toggle('is-on', card._emerg);
    });
    // Not for professionals, and not for a parent with Full access: they are called first anyway.
    var syncEm = function () {
      var v = rel ? rel.value || '' : '';
      var hide = /^(car_service|pediatrician|other_doctor|therapist|caseworker)$/i.test(v) || (/^(father|mother)$/i.test(v) && card._access !== 'payment');
      em.style.display = hide ? 'none' : '';
      if (hide && card._emerg) { card._emerg = false; em.querySelector('input').checked = false; em.querySelector('.fam-sw').classList.remove('is-on'); }
    };
    if (rel) rel.addEventListener('change', syncEm);
    acc.addEventListener('click', function () { setTimeout(syncEm, 0); });
    syncEm();
    // A saved contact's own addresses: one, typed in place; from two on, lines and Manage addresses.
    if (c && f.contacts.indexOf(c) > -1) {
      card.setAttribute('data-ci', f.contacts.indexOf(c));
      if (contactLined(f, c)) lineCard(f, c, card);
      else {
        card.classList.add('fam-addrfields');
        // "+ Add address" with one already filled: keep it, then add the second in Manage addresses.
        card.addEventListener('click', function (e) {
          var add = e.target.closest && e.target.closest('.cm-multi[data-multi="address"] .cm-madd');
          if (!add || !card.classList.contains('fam-addrfields')) return;
          var filled = window.cmMulti && window.cmMulti.values(card, 'address').length;
          if (!filled) return;                         // the first address is typed in place
          e.preventDefault(); e.stopPropagation();
          commitCardAddrs(f, c, card);
          openAddrMgr(f, c);
        }, true);
      }
    }
    // A parent's numbers: Primary number and Also receives notifications, the same settings as the
    // Household tab's Notifications (3.2 and 3.3), saved with this card.
    phoneRowNotify(f, c, card);
    // Pick a family number into this person's phones.
    var pb = card.querySelector('.cm-multi[data-multi="phone"]');
    var foot = pb && pb.querySelector('.cm-mfoot');
    if (foot && !pb.querySelector('.fam-phpick')) {
      var nums = famNumbers(f).filter(function (n) { return !c || n.owners.indexOf(c) < 0; });
      if (nums.length) {
        pb.insertAdjacentHTML('beforeend', '<select class="form-control fam-phpick" aria-label="Pick a family number"><option value="">Pick a family number\u2026</option>' +
          nums.map(function (n, i) { return '<option value="' + i + '">' + esc(n.who + ' \u00b7 ' + n.type + ' \u00b7 ' + n.value) + '</option>'; }).join('') + '</select>');
        var ps = pb.querySelector('.fam-phpick');
        ps.addEventListener('change', function (e) {
          e.stopPropagation();
          var n = nums[+ps.value];
          ps.value = '';
          if (!n || !pb._add) return;
          var box = card.querySelector('.cm-multi[data-multi="phone"]');
          (box._add || pb._add)({ type: n.type === 'Mobile' ? 'Mobile' : n.type, value: n.value, perm: n.perm, linked: true });
        });
        // Only a parent picks one of the family's numbers; other contacts add their own.
        var syncPick = function () { ps.style.display = rel && /^(father|mother)$/i.test(rel.value || '') ? '' : 'none'; };
        if (rel) rel.addEventListener('change', syncPick);
        syncPick();
      }
    }
  }

  /* A PARENT'S ADDRESS IS PICKED, NOT TYPED (design review 11/18, 2.3): "Same as family
     Home", another of the family's addresses, or "Add new address" (a pop-up; the new one
     becomes the family's). The card's own address list stays for everyone else: a
     grandmother's or the pediatrician's address is theirs, not the family's. The picker
     follows the relationship: Father or Mother shows it, anything else shows the list. */
  function addrPicker(f, c, card, ab) {
    if (!ab) return;
    var cur = c && c.addrRef && addrById(f, c.addrRef) ? c.addrRef : 'home';
    // One dropdown: the family's addresses (Home first) and "Add new address", which opens the fields below.
    var opts = function () {
      var list = famAddrs(f);
      var home = list.filter(function (a) { return a.id === 'home'; })[0];
      return '<option value="home">Same as family Home' + (home ? ' \u00b7 ' + esc(home.value) : f.isNew ? ' (the address above)' : '') + '</option>' +
        list.filter(function (a) { return a.id !== 'home'; }).map(function (a) {
          return '<option value="' + esc(a.id) + '">' + esc(a.type + ' \u00b7 ' + a.value) + '</option>';
        }).join('') +
        '<option value="__new">+ Add new address</option>';
    };
    var box = document.createElement('div');
    box.className = 'cm-multi fam-apick';
    box.innerHTML = '<div class="cm-mlabel">Address</div><select class="form-control fam-apick-sel" aria-label="Address"></select>' +
      '<div class="fam-apick-new" hidden>' + addrFields('pa') + '<div class="fam-apick-foot"><p class="fam-apick-note">Added to the family\u2019s addresses when you save, so anyone in the family can use it.</p>' + mgrLink('family') + '</div></div>' +
      '<p class="fam-apick-note fam-apick-link">Linked to the family\u2019s address, not copied. When that address changes, this parent\u2019s changes with it.</p>';
    ab.parentNode.insertBefore(box, ab.nextSibling);
    var pick = box.querySelector('select'), fields = box.querySelector('.fam-apick-new');
    pick.innerHTML = opts();
    pick.value = cur;
    card._addrPick = cur;
    pick._redraw = function () {
      var v = pick.value;
      pick.innerHTML = opts();
      pick.value = [].some.call(pick.options, function (o) { return o.value === v; }) ? v : 'home';
      card._addrPick = pick.value;
      fields.hidden = pick.value !== '__new';
    };
    pick.addEventListener('change', function (e) {
      e.stopPropagation();
      card._addrPick = pick.value;
      fields.hidden = pick.value !== '__new';
      box.querySelector('.fam-apick-link').hidden = pick.value === '__new';
      if (!fields.hidden) fields.querySelector('[data-pa="line1"]').focus();
      box.dispatchEvent(new Event('input', { bubbles: true }));
    });
    var rel = card.querySelector('.cm-ptype select');
    var sync = function () {
      var parent = !!rel && /^(father|mother)$/i.test(rel.value || '');
      // The card's own list is rebuilt when it is filled in, so it is hidden by a class on the card.
      box.style.display = parent ? '' : 'none';
      card.classList.toggle('fam-isparent', parent);
      card._isParentCard = parent;
      // A parent's address is the dropdown alone: no folded summary repeating it.
      var fold = box.closest('details');
      if (fold && parent) fold.open = true;
    };
    if (rel) rel.addEventListener('change', sync);
    sync();
    setTimeout(sync, 0);                                // the fold is built after the card
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
    var phones = get('phone'), emails = get('email'), addrs = card._liveAddrs && card._liveAddrs() ? card._liveAddrs() : get('address');
    var hh = String(card.getAttribute('data-fam-addr') || '').toLowerCase();
    var isWork = function (a) { return a.type === 'Work' || a.type === 'Office'; };
    var home = addrs.filter(function (a) { return !isWork(a); })[0];
    // A parent's address is the picker's link; their own address list is not read.
    if (card._isParentCard) { addrs = []; home = null; }
    var tEl = card.querySelector('.fam-title'), hEl = card.querySelector('.fam-heb');
    return {
      title: tEl ? tEl.value : undefined, heb: hEl ? hEl.value.trim() : undefined,
      emerg: card.querySelector('.fam-emsw') ? !!card._emerg : undefined,
      access: card.classList.contains('fam-ctx') && /^(father|mother)$/i.test(sel && sel.value || '') ? (card._access || 'full') : undefined,
      addrPick: card._isParentCard ? (card._addrPick || 'home') : '',
      addrNew: card._isParentCard && card._addrPick === '__new' ? readAddrFields(card.querySelector('.fam-apick-new'), 'pa') : null,
      t: sel && sel.value ? typeText(sel.value) : '',
      n: [inp('name', /^first name$/i), inp('name', /^last name$/i)].filter(Boolean).join(' '),
      phones: phones, emails: emails, addrs: addrs,
      p: phones[0] ? phones[0].value : '', p2: phones[1] ? phones[1].value : '',
      msg: phones[0] ? phones[0].msg : 'None', e: emails[0] ? emails[0].value : '',
      // Living at the household address is no own address, as before.
      addr: home && home.value.toLowerCase() !== hh ? home.value : '',
      occ: inp('work', /^occupation$/i), emp: inp('work', /^employer$/i),
      pays: !!card.querySelector('[data-perm="payer"]:checked'),
      perm: note && /\b(full|limited|none)\b/.test(note.className) ? note.className.match(/\b(full|limited|none)\b/)[1] : ''
    };
  }

  /* The household's phone and address in the same rows as a contact's, with the
     fixed type "Household" (client review, 2026-10-27). Same data-k keys as before. */
  function hhRows(p, a, withHome, phoneExtra) {
    var chip = '<span class="cm-mfixed">Household</span>';
    var inp = function (k, v, ph) {
      return '<input type="text" class="form-control" data-k="' + k + '" value="' + esc(v || '') +
        '" placeholder="' + ph + '" aria-label="' + ph + '">';
    };
    return '<div class="cm-reach fam-hhrows">' +
      '<div class="cm-multi"><div class="cm-mlabel">Phone</div><div class="cm-mrow"><div class="cm-mmain">' + chip +
        inp('phone', p, 'Phone number') + '</div></div>' + (phoneExtra || '') + '</div>' +
      // A new family types its Home here; afterwards every address is managed in Manage addresses.
      (withHome ? '<div class="cm-multi fam-homefields-box"><div class="cm-mlabel">Home address</div><div class="cm-mrow cm-mrow--address"><div class="cm-mmain">' +
        '<span class="cm-mfixed">Home</span>' +
        inp('line1', a.line1, 'Address line 1') + '</div><div class="cm-maddr">' + inp('line2', a.line2, 'Address line 2') +
        inp('city', a.city, 'City') + inp('state', a.state, 'State') + inp('zip', a.zip, 'ZIP code') + '</div></div></div>' : '') +
    '</div>';
  }

  // Edit family (row menu): the family's panel, its Details tab already in edit.
  function editHousehold(f, opts) {
    return openDrawer(f, 'details', { edit: true, instant: opts && opts.instant });
  }

  // 3. ADD A CONTACT — the very card "+ Add contact" builds on a child's Family
  //    tab (relationship, permissions, link existing, name, how to reach, address,
  //    work), added to the household.
  function addContact(f) {
    return openDrawer(f, 'contacts', { edit: true, addContact: true });
  }

  // 6. ARCHIVE HOUSEHOLD — only when no child in it is enrolled or waiting (the
  //    menu item is disabled otherwise, saying why). The app's own confirm and toast.
  function archiveHousehold(f) {
    if (activeKids(f).length) return;
    var go = function () {
      FAMILIES = (FAMILIES || []).filter(function (x) { return x !== f; });
      refresh();
      var sub = document.getElementById('famCount');
      if (sub) sub.innerHTML = '<b>' + FAMILIES.length + '</b> families';
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
    // Version B: the child opens under the family's own head and tabs (family-b.js), so the
    // family panel stays; its Save and Cancel act on the child until that is done.
    if (document.documentElement.classList.contains('fam-b')) {
      var edit = portal.querySelector('.fam-tedit');
      if (edit) edit.click();
      var bar = portal.querySelector('.fam-ftabs');
      document.documentElement.style.setProperty('--fb-top', (bar ? Math.round(bar.getBoundingClientRect().bottom) : 110) + 'px');
      document.documentElement.classList.add('fb-child');
      if (window.TndListDrawer) window.TndListDrawer.open('children/add', 'Add child');
      return;
    }
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

  /* The whole family, one row per person: its parents, its children and its other
     contacts, each carrying the family's address and billing, so the file can be
     filtered by family or by kind of person. */
  function exportCsv(scope, picked) {
    var rows = picked || (scope === 'view' ? visible() : (FAMILIES || []));
    var q = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [['Family', 'Family address', 'Family phone', 'Payment responsible', 'Payment method', 'Billing address', 'Type', 'Name',
      'Relationship', 'Status', 'Class', 'Date of birth', 'Phones', 'Emails', 'Addresses', 'Permission'].map(q).join(',')];
    var all = function (items) { return items.map(function (x) { return x.value; }).filter(Boolean).join('; '); };
    var perms = { full: 'Full permission', limited: 'Limited permission', none: 'No permission' };
    rows.forEach(function (f) {
      var payer = payerOf(f);
      var fam = [f.n, String(f.a || '').replace(/,?\s*USA$/i, ''), f.p, payer ? payer.n : '', (f.billing || {}).method || '', billAddress(f)];
      var people = [];
      parentsOf(f).concat((f.contacts || []).filter(function (c) { return !/^(mother|father)$/i.test(c.t || ''); })).forEach(function (c) {
        var l = listsOf(c, f), lv = permLevel(c);
        people.push([/^(mother|father)$/i.test(c.t || '') ? 'Parent' : 'Other contact', c.n, c.t, '', '', '', all(l.phone), all(l.email), all(l.address), perms[lv] || lv || '']);
      });
      kidsOfHousehold(f).forEach(function (c) {
        people.push(['Child', c.f + ' ' + c.l, '', c.s === 'waitlist' ? 'Waiting list' : c.s === 'inactive' ? 'Not enrolled' : 'Enrolled', c.cl || '', c.dob || '', '', '', '', '']);
      });
      if (!people.length) people.push(['', '', '', '', '', '', '', '', '', '']);
      people.forEach(function (p) { lines.push(fam.concat(p).map(q).join(',')); });
    });
    var blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = scope === 'sel' ? 'families-selected.csv' : scope === 'view' ? 'families-this-view.csv' : 'families.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    if (window.tndToast) window.tndToast.success(rows.length + (rows.length === 1 ? ' family' : ' families') + ' exported.');
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
    root.querySelector('.fam-addfamily').addEventListener('click', function () { openDrawer(newFamily(false)); });
    root.querySelector('.fam-addwait').addEventListener('click', function () { openDrawer(newFamily(true)); });

  }

  /* ---- a new family ------------------------------------------------------
     "Add family" opens the family's own panel, empty and in edit: the same tabs as any
     family. "Add to waiting list" is the same, with the waiting list first on Children. */
  function newFamily(wait) {
    // bFlow, Version B: created tab by tab, every tab open, finished by Save on the last one.
    return { n: '', a: '', p: '', k: '', c: 0, contacts: [], isNew: true, wait: !!wait, bFlow: document.documentElement.classList.contains('fam-b') };
  }

  /* What Version B of Add family (family-b.js) reads and hands back. */
  window.famApi = {
    ready: load,
    families: function () { return FAMILIES || []; },
    children: function () { return CHILDREN_ALL.concat(CHILDREN_OFF); },
    add: function (f) {
      FAMILIES.forEach(function (x) { delete x.top; });
      f.top = true;
      FAMILIES.push(f);
      if (window.cmAddFamily) window.cmAddFamily(f);
      refresh();
      var sub = document.getElementById('famCount');
      if (sub) sub.innerHTML = '<b>' + FAMILIES.length + '</b> families';
    },
    open: function (f, tab) { openDrawer(f, tab || 'details', { instant: true }); },
    close: closeDrawer,
    types: function () { return TYPES.slice(); },
    icon: function () { return AREA_ICON; }
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
        '<span class="current">Families</span>' +
      '</nav>' +

      /* Manage Children's own page head — .tnd-page-head with its icon tile, title,
         live-count subtitle and .btnContainer of actions — so the two pages share
         one header, buttons included. */
      '<div class="tnd-page-head tnd-page-head--icon fam-pagehead">' +
        '<div class="tnd-head-ico">' + AREA_ICON + '</div>' +
        '<div class="tnd-page-head-text"><h1 class="tnd-dt-title">Families</h1>' +
          // "120 households", or "2 of 120 households" while a search narrows the list.
          '<p class="tnd-dt-subtitle" id="famCount">' + ((FAMILIES && FAMILIES.length)
            ? '<b>' + FAMILIES.length + '</b> families' : 'Families') + '</p></div>' +
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
            '" data-view="households" aria-selected="' + (STATE.view === 'households') + '">Families</button>' +
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
        '. Remove them there first</span></span></button>';
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
      '<button type="button" class="tnd-chl-mi" role="menuitem" data-act="edit">' + ICON_EDIT + 'Edit family</button>' +
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
        // From inside the family, as everywhere: its Children tab.
        openDrawer(f, 'children');
        // Version B: straight to the new child's fields, under the family's head and tabs.
        if (document.documentElement.classList.contains('fam-b')) {
          var enroll = document.querySelector('.fam-portal .fam-kidadd[data-m="enroll"]');
          if (enroll) enroll.click();
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
