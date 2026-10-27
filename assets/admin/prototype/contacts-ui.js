/* ---------------------------------------------------------------------------
   PROTOTYPE — the Family tab's contacts list and the Add-contact flow,
   injected into the running app. Local sandbox only, never deployed.

   It writes NOTHING. No form field is changed, no request is sent, nothing is
   saved. It exists so the link-first rule can be clicked instead of described.

   The search runs over assets/admin/prototype/people.json, generated from the
   sandbox database, so the results are the tenant's real names — including the
   duplicate spellings ("Dr. Lane" 259 children, "lane" 49) that are the
   whole argument for linking rather than creating.
--------------------------------------------------------------------------- */
(function () {
  'use strict';

  var PEOPLE = [];
  var MOUNTED = false;

  fetch('/tendi-families-demo/assets/admin/prototype/people.json')
    .then(function (r) { return r.json(); })
    .then(function (d) { PEOPLE = d.people || []; })
    .catch(function () { PEOPLE = []; });

  var KIND = {
    pediatrician: { label: 'Pediatrician', colour: '#3a7686' },
    father:       { label: 'Father',       colour: '#45805a' },
    mother:       { label: 'Mother',       colour: '#9c4f80' }
  };

  function initials(name) {
    var p = String(name).replace(/^Dr\.?\s*/i, '').trim().split(/\s+/);
    return ((p[0] || '')[0] || '?').toUpperCase() + ((p[1] || '')[0] || '').toUpperCase();
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* ---- the contacts panel, shown where the parent fields are today -------- */

  var ROWS = [
    { av: 'CH', c: '#9c4f80', name: 'Elan Jade Redwell', type: 'Mother', scope: 'family',
      sub: '(212) 555-0197', perms: ['Responsible adult', 'Notifications', 'May collect'],
      links: 1 },
    { av: 'YS', c: '#45805a', name: 'Zack Redwell', type: 'Father', scope: 'family',
      sub: '(212) 555-0197', perms: ['Responsible adult', 'Notifications', 'May collect'],
      links: 1 },
    { av: 'MB', c: '#6b54a3', name: 'Gene Brody', type: 'Grandmother', scope: 'family',
      sub: 'Also linked to the Halley household',
      perms: ['Emergency contact', 'May collect'], links: 2 },
    { av: 'DS', c: '#3a7686', name: 'Dr. Lane', type: 'Pediatrician', scope: 'family',
      sub: '2125550130 · one record, 259 children', perms: [], links: 259 },
    { av: 'SG', c: '#8a5a30', name: 'Nell Talgate', type: 'Car service', scope: 'child',
      sub: 'Authorised by D. Halley · 24 Sep 2026',
      perms: ['May collect', '1–14 Oct only'], links: 1 }
  ];

  function rowNode(r, i) {
    var n = el('div', 'pc-row');
    n.innerHTML =
      '<span class="pc-av" style="background:' + r.c + '">' + r.av + '</span>' +
      '<span class="pc-who"><b>' + escape(r.name) + '</b>' +
      '<i class="pc-type">' + escape(r.type) + '</i>' +
      '<i class="pc-scope' + (r.scope === 'child' ? ' own' : '') + '">' +
      (r.scope === 'child' ? 'this child only' : 'family') + '</i>' +
      '<span>' + escape(r.sub) + '</span></span>' +
      '<span class="pc-perm">' + (r.perms.length
        ? r.perms.map(function (p) { return '<i>' + escape(p) + '</i>'; }).join('')
        : '<i class="mute">No permissions</i>') + '</span>' +
      '<button type="button" class="pc-more" aria-label="Actions for ' + escape(r.name) + '">⋯</button>';
    n.querySelector('.pc-more').addEventListener('click', function (e) {
      e.stopPropagation();
      menu(this, r);
    });
    return n;
  }

  /* Two destructive actions, and they are not the same thing.
     "Remove from this family" deletes the LINK — the person survives, because
     they may be linked to other households. "Delete this person" deletes the
     record, and is only offered when no other link remains. Getting these two
     confused is how one grandmother disappears from five families at once. */
  function menu(btn, r) {
    var open = document.querySelector('.pc-menu');
    if (open) open.remove();
    var m = el('div', 'pc-menu');
    var canDelete = r.links <= 1;
    m.innerHTML =
      '<button type="button">Edit details</button>' +
      '<button type="button">Change permissions</button>' +
      (r.scope === 'family'
        ? '<button type="button">Make an exception for this child</button>'
        : '<button type="button">Apply to the whole family</button>') +
      '<div class="pc-sep"></div>' +
      '<button type="button" class="warn">' +
        (r.scope === 'child' ? 'Remove from this child' : 'Remove from this family') +
      '</button>' +
      '<div class="pc-why">Removes the link. ' + escape(r.name) + ' stays on file' +
        (r.links > 1 ? ' and keeps ' + (r.links - 1) + ' other link' + (r.links > 2 ? 's' : '') + '.' : '.') +
      '</div>' +
      '<button type="button" class="danger"' + (canDelete ? '' : ' disabled') + '>Delete this contact</button>' +
      '<div class="pc-why">' + (canDelete
        ? 'No other family is linked, so the record can go.'
        : 'Blocked: linked to ' + r.links + ' families. Remove the other links first.') +
      '</div>';
    document.body.appendChild(m);
    var b = btn.getBoundingClientRect();
    m.style.top = (b.bottom + 6) + 'px';
    m.style.left = Math.max(12, b.right - m.offsetWidth) + 'px';
    setTimeout(function () {
      document.addEventListener('click', function off() {
        m.remove(); document.removeEventListener('click', off);
      });
    }, 0);
  }

  function panel() {
    var p = el('div', 'pc-panel');
    p.setAttribute('data-pc', '1');
    p.innerHTML =
      '<div class="pc-head">' +
        '<div><b>Contacts</b><span>One row per contact. A row marked <i>family</i> reaches every ' +
        'child in the household, including a sibling enrolled later.</span></div>' +
        '<button type="button" class="pc-add">Add contact</button>' +
      '</div>';
    ROWS.forEach(function (r, i) { p.appendChild(rowNode(r, i)); });
    p.appendChild(el('div', 'pc-foot',
      'The pediatrician, the trusted list and the emergency list were three separate places on ' +
      'this form. They are one list of contacts now — <b>emergency contact</b> and ' +
      '<b>may collect</b> are permissions on the row, not lists of their own, so the grandmother ' +
      'who is both is one contact with two ticks.'));
    p.querySelector('.pc-add').addEventListener('click', openModal);
    return p;
  }

  /* ---- the add-contact modal, link first --------------------------------- */

  function openModal() {
    if (document.getElementById('pcModal')) return;
    var m = el('div', 'pc-back');
    m.id = 'pcModal';
    m.innerHTML =
      '<div class="pc-modal" role="dialog" aria-label="Add contact">' +
        '<div class="pc-mhead"><b>Add contact</b><button type="button" class="pc-x" aria-label="Close">&times;</button></div>' +
        '<div class="pc-mbody">' +
          '<div class="pc-sec">Who does this contact belong to?</div>' +
          '<div class="pc-opts">' +
            '<label class="pc-opt on"><span class="pc-dot"></span><span><b>The whole family</b>' +
            '<i>Every child in it, and any sibling enrolled later.</i></span></label>' +
            '<label class="pc-opt"><span class="pc-dot"></span><span><b>This child only</b>' +
            '<i>An exception, alongside the family’s contacts.</i></span></label>' +
          '</div>' +
          '<div class="pc-sec">Who is it? <i>Doctor, grandmother, car service, emergency — all of them start here</i></div>' +
          '<input class="pc-search" type="search" placeholder="Search by name or phone…" aria-label="Search contacts">' +
          '<div class="pc-results"><div class="pc-hint">Type a name or a number. Try <b>lane</b>, or <b>212</b>.</div></div>' +
          '<div class="pc-note">Every contact is one record, whoever they are. This tenant has ' +
          '<b>570 children with a pediatrician named and 36 actual doctors</b> — the search below ' +
          'shows the real names, duplicate spellings and all. That is what linking prevents.</div>' +
        '</div>' +
        '<div class="pc-mfoot"><span>Nothing here is saved.</span>' +
        '<button type="button" class="pc-cancel">Close</button></div>' +
      '</div>';
    document.body.appendChild(m);

    var input = m.querySelector('.pc-search');
    var out = m.querySelector('.pc-results');
    input.addEventListener('input', function () { render(out, this.value); });
    m.querySelector('.pc-x').addEventListener('click', close);
    m.querySelector('.pc-cancel').addEventListener('click', close);
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    document.addEventListener('keydown', esc);
    input.focus();

    function close() { document.removeEventListener('keydown', esc); m.remove(); }
    function esc(e) { if (e.key === 'Escape') close(); }
  }

  function render(out, q) {
    q = String(q || '').trim().toLowerCase();
    if (q.length < 2) {
      out.innerHTML = '<div class="pc-hint">Type a name or a number. Try <b>lane</b>, or <b>212</b>.</div>';
      return;
    }
    var hits = PEOPLE.filter(function (p) {
      return p.n.toLowerCase().indexOf(q) > -1 || String(p.p).replace(/\D/g, '').indexOf(q.replace(/\D/g, '')) > -1;
    }).slice(0, 8);

    if (!hits.length) {
      out.innerHTML = '<div class="pc-hint">Nobody on file matches.</div>' +
        '<div class="pc-new"><span>Then this is someone new.</span>' +
        '<button type="button" class="pc-newbtn">Create a new contact</button></div>';
      return;
    }

    out.innerHTML = hits.map(function (p) {
      var k = KIND[p.k] || { label: p.k, colour: '#6b54a3' };
      var sub = p.c > 1
        ? k.label + ' · already on ' + p.c + ' children'
        : k.label;
      return '<div class="pc-hit"><span class="pc-av sm" style="background:' + k.colour + '">' +
        initials(p.n) + '</span><span class="pc-who"><b>' + escape(p.n) + '</b>' +
        '<span>' + sub + (p.p ? ' · ' + escape(p.p) : '') + '</span></span>' +
        '<button type="button" class="pc-link">Link</button></div>';
    }).join('') +
      '<div class="pc-new"><span>Not one of these?</span>' +
      '<button type="button" class="pc-newbtn">Create a new contact</button></div>';
  }

  function escape(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---- mount it where the parent fields are ------------------------------ */

  function mount() {
    if (MOUNTED && document.querySelector('.pc-panel')) return;
    var anchor = document.querySelector('[name="father_name"]');
    if (!anchor) { MOUNTED = false; return; }
    var g = anchor.closest('.form-group') || anchor.parentNode;
    if (!g || !g.parentNode || document.querySelector('.pc-panel')) return;
    g.parentNode.insertBefore(panel(), g);
    MOUNTED = true;
  }

  var t = null;
  function schedule() { clearTimeout(t); t = setTimeout(mount, 160); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
