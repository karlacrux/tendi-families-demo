/* ---------------------------------------------------------------------------
   PROTOTYPE CHANGE MAP — local sandbox only, never deployed.

   Marks the child add/edit form with what the family module does to each field.
   It reads the DOM and adds classes; it changes no value, submits nothing and
   touches no application file. The SPA loads panes by AJAX, so a MutationObserver
   re-applies the marks whenever the form is re-rendered.

   The verdicts come from the impact analysis, not from guesswork:
     out    the value stops living on `children` and moves to families /
            family_contacts / contact_links / addresses
     wave2  address and geocode columns, deliberately deferred: they are read by
            bus routing and WRITTEN by the geocode cron, so they are a separate
            project from the contact columns
     new    does not exist today
--------------------------------------------------------------------------- */
(function () {
  'use strict';

  // true: no Change map pill/panel and no annotations (set false to bring the map back).
  var CLEAN_VIEW = true;
  if (CLEAN_VIEW) {
    var cmOff = function () { document.body.classList.add('cm-off'); };
    if (document.body) cmOff(); else document.addEventListener('DOMContentLoaded', cmOff);
  }

  var OUT = {
    father_name:  'to father contact',
    mother_name:  'to mother contact',
    father_phone: 'to contact phone',
    mother_phone: 'to contact phone',
    home_phone:   'to families.phone',
    parent_email: 'goes away \u00b7 each parent gets their own',
    use_father_phone_for_notification: 'to contact_links',
    use_mother_phone_for_notification: 'to contact_links',
    notification_father_phone_method:  'to the contact',
    notification_mother_phone_method:  'to the contact',
    home_send_notification:            'to the family',
    is_association_child: 'superseded',
    associate_child:      'superseded',

    // Registration Form Details = children_additional_information. On the legacy
    // tenant this is where the parent data people actually use lives (phones at
    // 78%, names at 97%), so it is the migration SOURCE, not an afterthought.
    // Percentages are measured, from the Sep 3 dump.
    reg_father_fname:        'to father contact · 91%',
    reg_father_lname:        'surname source · 97%',
    reg_mother_fname:        'to mother contact · 92%',
    reg_mother_lname:        'surname source · 97%',
    reg_father_home_phone:   'the live father phone · 78%',
    reg_mother_home_phone:   'the live mother phone · 78%',
    reg_father_office_phone: 'to phone2 · 51%',
    reg_mother_office_phone: 'drop · 0% filled',
    reg_father_email:        'to contact email · 33%',
    reg_mother_email:        'to contact email · 33%',
    reg_father_occupation:   'decide · 14%',
    reg_mother_occupation:   'drop · 0% filled',
    reg_father_employer:     'drop · 0% filled',
    reg_mother_employer:     'drop · 0% filled',
    reg_father_work_address: 'drop · 0% filled',
    reg_mother_work_address: 'drop · 0% filled',
    reg_pediatrician_name:   'to a contact, shown on Health · 75%',
    reg_pediatrician_phone:  'to a contact, shown on Health · 71%',
    reg_pediatrician_address:'drop · 0% filled'
  };

  // Stays in the product, but sits on the wrong tab. This tab is named after a
  // PAPER FORM, so it mixes four unrelated subjects: the child's identity, the
  // child's health, the parents, and the schedule. The fill rates say the
  // placement is the problem, not the field:
  //   children.allergies, next to the child          19 filled
  //   cai.allergy_special_instructions, on this tab    0 filled
  //   children.legal_name, next to the name          739 filled
  //   cai.nickname, on this tab                        0 filled
  // Once the parent columns leave, nothing holds this tab together.
  var MOVE = {
    reg_nickname:                     'to Details, beside the name',
    reg_medical_conditions:           'to Health',
    reg_allergy_special_instructions: 'to Health · merge with children.allergies',
    reg_comments:                     'to Details · merge with children.note',
    'reg_enrolled_days[]':            'to Enrollment'
  };

  var WAVE2 = {
    address:          'wave 2',
    apartment_number: 'wave 2 · line2',
    city:             'wave 2',
    state:            'wave 2',
    zip:              'wave 2',
    latitude:         'wave 2 · cron writes',
    longitude:        'wave 2 · cron writes',
    reg_father_address: 'decide · same household 688/688',
    reg_mother_address: 'decide · same household 688/688'
  };

  // Whole blocks, found by their label text rather than a field name.
  var BLOCKS = [
    { text: 'trusted contacts',   kind: 'cm-out', tag: 'to contact_links' },
    { text: 'emergency contacts', kind: 'cm-out', tag: 'to contact_links' }
  ];

  function group(el) {
    return el.closest ? (el.closest('.form-group') || el.parentNode) : el.parentNode;
  }

  function mark(el, kind, tag) {
    if (!el || el.classList.contains(kind) || el.getAttribute('data-cm') === '1') return false;
    el.setAttribute('data-cm', '1');
    el.classList.add(kind);
    var t = document.createElement('span');
    t.className = 'cm-tag';
    t.textContent = tag;
    el.appendChild(t);
    return true;
  }

  var FAMILIES = [];
  fetch('/tendi-families-demo/assets/admin/prototype/families.json')
    .then(function (r) { return r.json(); })
    .then(function (d) { FAMILIES = d.families || []; })
    .catch(function () { FAMILIES = []; });

  // Active children, for the sibling view on the waiting list.
  var CHILDREN = [];
  fetch('/tendi-families-demo/assets/admin/prototype/children.json')
    .then(function (r) { return r.json(); })
    .then(function (d) { CHILDREN = d.children || []; if (window.cmRefreshSiblings) window.cmRefreshSiblings(); })
    .catch(function () { CHILDREN = []; });

  // The loose people on file — the pediatricians above all — who belong to no
  // derived household but are exactly the ones typed again and again (570 → 36).
  var LOOSE = [];
  fetch('/tendi-families-demo/assets/admin/prototype/people.json')
    .then(function (r) { return r.json(); })
    .then(function (d) { LOOSE = d.people || []; })
    .catch(function () { LOOSE = []; });

  /* The household block, in the order the question is actually answered.

     THE CHOICE COMES FIRST, and nothing is asked before it. The old shape asked for
     a household name and phone up front, which got the causation backwards: nobody
     types a household name. `families.name` is DERIVED — father_lname falling back
     to children.lname — and the phone is whatever the parents already gave. Asking
     for them first invents a household before knowing whether one exists.

     THEN A SEARCH, AND IT SEARCHES PEOPLE. What connects a child to a family is a
     person, not an address: the office knows "the mother is Leo Thornley" or a
     phone number, and that resolves to the household. Searching by surname is the
     MIGRATION's grouping rule, useful once, at import; it is not how anyone finds a
     family at the desk.

     The search runs on both branches. On "Family on file" it finds the household.
     On "New family" it is the same check the contact flow makes before creating a
     person: prove nobody is there before adding another one. */
  /* The typed-parent blocks, shown only when the family is new. Display is toggled,
     never the DOM: the inputs stay in #frmAddEditRecord so the form still posts
     them, exactly as the waitlist tabs do. */
  /* NOTHING IS ASKED BEFORE THE HOUSEHOLD QUESTION IS ANSWERED.

     The tab used to open with the reachability rule, the house phone, the parent
     email and both old contact lists already on screen, above a question that
     decides whether any of them apply. A form that asks for a household's phone
     before knowing which household is asking twice, and the second answer
     overwrites the first.

     So everything in the tab except the choice block is gated. Hidden, never
     removed: the inputs stay in #frmAddEditRecord and still post, which is what
     keeps a save from blanking a column that simply was not on screen.

       mode null       only the question
       mode new        the typed parent cards, the house phone, the old columns
       mode existing   the search, then the household's own people  */
  /* The contacts panel is built by contacts-ui.js on its own schedule, which is
     usually AFTER this gate has run. It therefore arrived unhidden, and the tab
     opened on a list of a household's people above the question of which household
     — the exact order B1 exists to stop. So the chosen mode is remembered and
     re-applied to the panel on every pass, whenever it turns up. */
  var FAMILY_MODE = null;
  /* FAMILY ON FILE: THE SEARCH FIRST, AND NOTHING ELSE. Until a family has been
     found, the household block, the reachability rule, More contacts and the old
     columns would all be asking about a family nobody has named yet — and anything
     typed into them would be overwritten, or worse, saved beside the family the
     search then finds. They wait for the pick. */
  var FAMILY_PICKED = false;
  var PICKED_FAMILY = null;

  function scopeFamilyLabel() {
    var f = PICKED_FAMILY;
    return f ? 'Whole ' + f.n + ' family \u00b7 ' + f.c + (f.c === 1 ? ' child' : ' children') : 'Whole family';
  }
  function refreshScopeLabels() {
    document.querySelectorAll('.cm-scope-fam').forEach(function (el2) { el2.textContent = scopeFamilyLabel(); });
  }

  function gatePanel() {
    var panel = document.querySelector('.pc-panel');
    if (!panel) return 0;
    /* Retired in both modes. Under a found household it was a second way to add
       people — its own list, its own Add contact modal — beside More contacts,
       which is how a new family adds them. Adding a contact is one gesture
       wherever the family came from, so the found household's own people are the
       checklist in the choice block, and anyone else comes through More contacts,
       exactly as in a new family. Hidden, not removed: contacts-ui.js still
       builds it. */
    var want = 'none';
    if (panel.style.display === want) return 0;
    panel.style.display = want;
    return 1;
  }

  function gateFamily(mode) {
    FAMILY_MODE = mode;
    var fam = sectionByHead('family');
    if (!fam) return;
    var host = fam.querySelector('.vB-editcard') || fam;
    var chosen = mode === 'new' || (mode === 'existing' && FAMILY_PICKED);

    Array.prototype.slice.call(host.children).forEach(function (el2) {
      if (el2.classList && el2.classList.contains('cm-newblock')) return;   // the question stays
      if (el2.tagName === 'LEGEND') return;                                  // a fieldset's own title
      el2.style.display = chosen ? '' : 'none';
    });

    // The reachability rule is about the parents, so it waits for them too.
    var hintRow = document.querySelector('#tndEnrollContactHint');
    if (hintRow) {
      var row = hintRow.closest ? (hintRow.closest('.tnd-enroll-hint-row') || hintRow) : hintRow;
      row.style.display = chosen ? '' : 'none';
    }

    document.querySelectorAll('[data-cm-parent]').forEach(function (el3) {
      el3.style.display = mode === 'new' ? '' : 'none';
    });

    /* A household found on file already HAS an address and a phone — the box in
       the choice block shows them. The Household block of fields exists to type
       those for a NEW family; under a found one it asks a second time for what the
       search just answered, and holds this child's old address besides. Hidden,
       never removed: its inputs still post, so a save cannot blank them. */
    var hb = host.querySelector('.cm-hblock');
    if (hb) hb.style.display = mode === 'new' ? '' : 'none';

    /* The reachability rule asks the office to NAME a parent and give a way to
       reach them. Under a household found on file the parents are already named,
       with their phones, in the checklist above — so the rule has nothing to ask.
       Marked on the host rather than set inline, because the app shows and hides
       the hint itself as its own validation runs. */
    host.setAttribute('data-cm-mode', mode || '');
    // The pediatrician card on Health asks "applies to" only when there is a
    // family on file to apply to.
    document.body.setAttribute('data-cm-family-mode', mode || '');
    gatePanel();
  }

  function showParentFields(show) { gateFamily(show ? 'new' : 'existing'); }

  function newBlock() {
    var b = document.createElement('div');
    b.className = 'cm-newblock';
    b.setAttribute('data-cm', '1');
    b.innerHTML =
      '<h4>Household <span class="cm-tag" style="position:static;margin-left:6px">new</span></h4>' +
      '<label class="cm-radio" data-choice="new"><span class="cm-dot"></span>New family</label>' +
      '<label class="cm-radio" data-choice="existing"><span class="cm-dot"></span>Family on file</label>' +
      '<div class="cm-find" hidden>' +
        '<input type="search" class="cm-findbox" aria-label="Search people on file">' +
        '<div class="cm-findout"></div>' +
      '</div>' +
      '<div class="cm-chosen" hidden></div>' +
      '<div class="cm-parents" hidden>' +
        '<p style="margin:13px 0 9px 0;font-weight:600;color:#1f1a2e;font-size:12px">' +
        'Which of this household\u2019s contacts apply to this child?</p>' +
        '<div class="cm-plist"></div>' +
      '</div>';

    var find    = b.querySelector('.cm-find');
    var box     = b.querySelector('.cm-findbox');
    var out     = b.querySelector('.cm-findout');
    var chosen  = b.querySelector('.cm-chosen');
    var parents = b.querySelector('.cm-parents');
    var mode    = null;
    setTimeout(function () { gateFamily(null); }, 0);

    b.querySelectorAll('.cm-radio[data-choice]').forEach(function (r) {
      r.addEventListener('click', function () {
        b.querySelectorAll('.cm-radio[data-choice]').forEach(function (x) { x.classList.remove('on'); });
        r.classList.add('on');
        mode = r.getAttribute('data-choice');
        FAMILY_PICKED = false;
        chosen.hidden = true;
        parents.hidden = true;
        out.innerHTML = '';
        box.value = '';

        /* NEW FAMILY: no search. There is nothing on file to look for, and the next
           thing the office does is type the father, then the mother. The parent
           blocks already in this tab ARE that form, so they are revealed rather
           than duplicated — one set of inputs, posting the real field names.

           FAMILY ON FILE: the opposite. The people already exist, so the search
           finds them and the typed blocks stay away; showing both would invite a
           second copy of a parent who is already a record. */
        var isNew = mode === 'new';
        find.hidden = isNew;
        showParentFields(isNew);
        /* No focus on New family: the father's first control sits ~600px down the
           panel, so focusing it scrolled the form away from the choice just made. */
        if (!isNew) {
          box.placeholder = 'e.g. Leo, Thornley, or 347\u2026';
          box.focus();
        }
      });
    });

    box.setAttribute('role', 'combobox');
    box.setAttribute('aria-expanded', 'false');
    box.setAttribute('aria-autocomplete', 'list');

    function people(q) {
      var hits = [];
      FAMILIES.forEach(function (f) {
        (f.contacts || []).forEach(function (c) {
          if (c.t !== 'Mother' && c.t !== 'Father') return;
          var hay = (c.n + ' ' + (c.p || '') + ' ' + f.n).toLowerCase();
          if (hay.indexOf(q) > -1) hits.push({ person: c, fam: f });
        });
      });
      return hits.slice(0, 6);
    }

    box.addEventListener('input', function () {
      var q = this.value.trim().toLowerCase();
      if (q.length < 2) { out.innerHTML = ''; box.setAttribute('aria-expanded', 'false'); return; }
      var hits = people(q);
      if (!hits.length) {
        out.innerHTML = '<div class="cm-findhint">Nobody on file matches' +
          (mode === 'new' ? ' \u2014 go ahead, this is a new family.' : '.') + '</div>';
        box.setAttribute('aria-expanded', 'false');
        return;
      }
      box.setAttribute('aria-expanded', 'true');
      out.innerHTML = hits.map(function (h, i) {
        return '<button type="button" class="cm-fhit' + (i === 0 ? ' act' : '') + '" data-i="' + i + '">' +
          '<b>' + esc(h.person.n) + '</b>' +
          '<span>' + esc(h.person.t) + (h.person.p ? ' \u00b7 ' + esc(h.person.p) : '') + '</span>' +
          '<i>' + esc(h.fam.n) + ' household \u00b7 ' + h.fam.c +
          (h.fam.c === 1 ? ' child' : ' children') + ' \u00b7 ' + esc(h.fam.a) + '</i></button>';
      }).join('');
      out.querySelectorAll('.cm-fhit').forEach(function (btn) {
        btn.addEventListener('click', function () { pick(hits[parseInt(btn.getAttribute('data-i'), 10)]); });
      });
    });

    box.addEventListener('keydown', function (e) {
      var items = out.querySelectorAll('.cm-fhit');
      if (!items.length) return;
      var cur = -1;
      for (var i = 0; i < items.length; i++) if (items[i].classList.contains('act')) cur = i;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        var nx = e.key === 'ArrowDown' ? cur + 1 : cur - 1;
        if (nx < 0) nx = items.length - 1;
        if (nx >= items.length) nx = 0;
        items.forEach(function (x) { x.classList.remove('act'); });
        items[nx].classList.add('act');
        items[nx].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        items[cur > -1 ? cur : 0].click();
      } else if (e.key === 'Escape') {
        out.innerHTML = '';
        box.setAttribute('aria-expanded', 'false');
      }
    });

    /* The household is SHOWN once a person resolves it, not asked for. Its name and
       phone are editable there, because a derived value still has to be correctable
       — but they arrive filled, as a consequence of the choice. */
    function pick(h) {
      var f = h.fam;
      out.innerHTML = '';
      FAMILY_PICKED = true;
      PICKED_FAMILY = f;
      refreshScopeLabels();
      if (window.cmRefreshSiblings) window.cmRefreshSiblings();
      // The search has done its job: the household box replaces it. Remove brings
      // it back if the pick was wrong.
      find.hidden = true;
      gateFamily('existing');
      chosen.hidden = false;
      /* A FOUND household is a record to read, not a form to fill. Its name and
         phone arrive as text in a box; a small Edit turns them into inputs for the
         rare correction, and Done turns them back. Two empty-looking boxes asked
         the office to type what the search had just told them. */
      chosen.innerHTML =
        '<div class="cm-chosenhead"><div><b class="cm-hname">' + esc(f.n) + '</b> <b>household</b>' +
        (h.current
          ? '<span>this child\u2019s household</span></div>'
          : '<span>found through ' + esc(h.person.n) + ' \u00b7 ' + esc(h.person.t.toLowerCase()) + '</span></div>') +
        '<div class="cm-hacts"><button type="button" class="cm-hedit">Edit</button>' +
        (h.current
          ? '<button type="button" class="cm-hexcl" title="Move this child to another household">Change</button>'
          : '<button type="button" class="cm-hexcl" title="Not this household \u2014 search again">Remove</button>') +
        '</div></div>' +
        '<dl class="cm-hread">' +
          '<dt>Household phone</dt><dd class="cm-hphone">' + (f.p ? esc(f.p) : '<i>none on file</i>') + '</dd>' +
          '<dt>Address</dt><dd class="cm-haddrtext">' + esc(f.a.replace(/,?\s*USA$/i, '')) + '</dd>' +
        '</dl>' +
        '<div class="cm-hfields" hidden>' +
          '<label class="cm-hf"><span>Name</span><input type="text" value="' + esc(f.n) +
          '" aria-label="Household name"></label>' +
          '<label class="cm-hf"><span>Household phone</span><input type="text" value="' +
          esc(f.p || '') + '" aria-label="Household phone"></label>' +
        '</div>' +
        // Edit opens the address too, in the same US postal shape as everywhere else.
        '<div class="cm-haddrfields" hidden>' + (function () {
          var a = parseAddr(f.a);
          return [['Address line 1', a.line1, 'line1'], ['Address line 2 (apartment)', a.line2, 'line2'],
                  ['City', a.city, 'city'], ['State', a.state, 'state'], ['ZIP code', a.zip, 'zip']]
            .map(function (x) {
              return '<label class="cm-hf"><span>' + x[0] + '</span><input type="text" data-a="' + x[2] +
                '" value="' + esc(x[1]) + '" aria-label="' + x[0] + '"></label>';
            }).join('');
        })() + '</div>';
      var editBtn = chosen.querySelector('.cm-hedit');
      var read = chosen.querySelector('.cm-hread');
      var edit = chosen.querySelector('.cm-hfields');
      var addrEdit = chosen.querySelector('.cm-haddrfields');

      /* REMOVE: the search found the wrong household (a namesake, a second
         marriage). It takes the pick back entirely — the box, the checklist and
         everything the pick revealed below — and returns to the search, empty and
         focused. Nothing about the household on file changes. */
      chosen.querySelector('.cm-hexcl').addEventListener('click', function () {
        chosen.hidden = true;
        chosen.innerHTML = '';
        parents.hidden = true;
        b.querySelector('.cm-plist').innerHTML = '';
        FAMILY_PICKED = false;
        PICKED_FAMILY = null;
        if (window.cmRefreshSiblings) window.cmRefreshSiblings();
        if (h.current) {
          // CHANGE, on the child's own household: back to the creation question —
          // new family or another family on file. Nothing is changed until Save.
          b.classList.remove('is-current');
          b.querySelectorAll('.cm-radio[data-choice]').forEach(function (x) { x.classList.remove('on'); });
          mode = null;
          gateFamily(null);
          return;
        }
        gateFamily('existing');
        find.hidden = false;
        box.value = '';
        out.innerHTML = '';
        box.focus();
      });

      /* The child's own household is edited through the REAL inputs: its phone is
         home_phone, its address is address / apartment_number / city / state / zip.
         So Edit opens the fields and stays open — no Done — and every keystroke
         lands in the input the form posts. Save saves it with everything else. The
         household's name is derived (the father's surname), so it has no column to
         write to: it is shown, not editable. */
      if (h.current) {
        var bindA = { line1: 'address', line2: 'apartment_number', city: 'city', state: 'state', zip: 'zip' };
        edit.querySelectorAll('input')[0].readOnly = true;
        var ph = edit.querySelectorAll('input')[1];
        ph.addEventListener('input', function () { writeReal('home_phone', ph.value); });
        addrEdit.querySelectorAll('input[data-a]').forEach(function (inp) {
          var real = bindA[inp.getAttribute('data-a')];
          inp.addEventListener('input', function () { writeReal(real, inp.value); });
        });
        editBtn.addEventListener('click', function () {
          edit.hidden = false; addrEdit.hidden = false; read.hidden = true;
          editBtn.remove();
          ph.focus();
        });
      } else editBtn.addEventListener('click', function () {
        var editing = edit.hidden;
        if (!editing) {
          // Done: write back what was typed, as text.
          var ins = edit.querySelectorAll('input');
          chosen.querySelector('.cm-hname').textContent = ins[0].value.trim() || f.n;
          chosen.querySelector('.cm-hphone').innerHTML = ins[1].value.trim()
            ? esc(ins[1].value.trim()) : '<i>none on file</i>';
          var v = function (k) { return addrEdit.querySelector('[data-a="' + k + '"]').value.trim(); };
          var line = [v('line1'), v('line2') ? 'Apt ' + v('line2').replace(/^apt\.?\s*/i, '') : '', v('city'),
                      [v('state'), v('zip')].filter(Boolean).join(' ')].filter(Boolean).join(', ');
          chosen.querySelector('.cm-haddrtext').innerHTML = line ? esc(line) : '<i>none on file</i>';
        }
        edit.hidden = !editing;
        addrEdit.hidden = !editing;
        // While editing, the fields replace the text lines they correct.
        read.hidden = editing;
        editBtn.textContent = editing ? 'Done' : 'Edit';
        if (editing) edit.querySelector('input').focus();
      });

      parents.hidden = false;
      // Father first, then mother, then everyone else in the order on file.
      var rank = function (c) { return /^father$/i.test(c.t || '') ? 0 : /^mother$/i.test(c.t || '') ? 1 : 2; };
      var list = (f.contacts || []).slice().sort(function (a, b) { return rank(a) - rank(b); });
      /* EACH TICKED PERSON OPENS WHAT THEY ARE TO THIS CHILD.

         A tick links a person already on file; it does not say what they may do.
         Permissions live on contact_links — per person AND per child — so a mother
         who is Main responsible for one child can be something else for her
         half-sibling. So a ticked row opens a short summary of the person (so the
         office can see WHO they just linked) and, under it, the same relationship
         dropdown, badge and permissions a card has. The relationship starts as the
         one they hold in this household; the permissions start from that
         relationship's defaults in the field map. Unticked, it folds away. */
      b.querySelector('.cm-plist').innerHTML = list.length
        ? list.map(function (c, ci) {
            return '<div class="cm-pickwrap">' +
              '<label class="cm-pick' + (c.on ? ' on' : '') + '" data-c="' + ci + '">' +
              '<span class="cm-box"></span>' +
              // The row names the person and their role; the phone is in the summary
              // that opens once they are ticked, not on every row of the list.
              '<span class="cm-pwho"><b>' + esc(c.n) + '</b>' +
              '<i>' + esc(c.t) + '</i></span>' +
              '<span class="cm-pnote">' + (c.on ? 'reaches every child' : 'not linked yet') + '</span>' +
              '</label><div class="cm-pickmore" hidden></div></div>';
          }).join('')
        : '<div class="cm-findhint">This household has no contacts on file yet.</div>';
      b.querySelectorAll('.cm-pickwrap').forEach(function (wrap) {
        var pk = wrap.querySelector('.cm-pick');
        var more = wrap.querySelector('.cm-pickmore');
        var c = list[+pk.getAttribute('data-c')];
        var built = false;
        var sync = function () {
          var on = pk.classList.contains('on');
          pk.querySelector('.cm-pnote').textContent = on ? 'reaches every child' : 'not linked yet';
          if (on && !built) { buildLinkPanel(more, c, f); built = true; }
          more.hidden = !on;
          wrap.classList.toggle('open', on);
        };
        pk.addEventListener('click', function () { pk.classList.toggle('on'); sync(); });
        sync();
      });
    }

    // A household handed over by the Families page ("Add a child to this
    // household"): answer the question for the office — Family on file, that
    // household picked — exactly as if they had searched for it.
    b._pickFound = function (f) {
      var r = b.querySelector('.cm-radio[data-choice="existing"]');
      if (r) r.click();
      var first = (f.contacts || []).filter(function (c) { return c.on; })[0] || (f.contacts || [])[0];
      pick({ person: first || { n: f.n, t: 'household' }, fam: f });
    };

    b._openCurrent = function () {
      var cur = migrateCurrent();
      if (!cur) return false;
      b.classList.add('is-current');
      pick({ current: true, person: { n: '', t: '' }, fam: cur });
      return true;
    };

    return b;
  }

  function writeReal(name, value) {
    var el2 = document.querySelector('#frmAddEditRecord [name="' + name + '"]');
    if (!el2) return;
    el2.value = value;
    el2.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* EDITING A CHILD OPENS ON THEIR OWN FAMILY — A QUICK MIGRATION ON OPEN.

     Creating a child asks "new family or family on file?". Editing one should not:
     the child already has parents, a phone and an address, written in the flat
     columns the old form used. So when the form is an EDIT (it posts to
     children/save/<id>), those columns are read and turned into the shape the new
     tab uses — the same household box and contact list a family found on file gets:

       household  name    the father's surname, else the mother's, else the child's
                  phone   children.home_phone
                  address the household address inputs
       father /   name    reg_*_fname + reg_*_lname, falling back to the legacy
       mother             children.father_name / mother_name
                  phone   reg_*_home_phone, falling back to children.father_phone /
                          mother_phone (the 1% column — the live number is reg_*)
                  email   reg_*_email, per parent (D2). children.parent_email has
                          no owner and is NOT assigned to either
                  address reg_*_address, shown only when it is NOT the household's
                          (688 of 688 are the same; the rare one is the fact)

     Each parent is ticked, opens as Mother / Father with Full permission, and its
     Edit fields write back into the reg_* inputs, so Save saves them exactly as
     before. A child with no parent named at all falls back to the creation
     question. Nothing is written until the office types something. */
  function migrateCurrent() {
    var form = document.querySelector('#frmAddEditRecord');
    if (!form || !/children\/save\/[1-9]\d*/.test(form.getAttribute('action') || '')) return null;
    var v = function (n) { return (((form.querySelector('[name="' + n + '"]') || {}).value) || '').trim(); };
    var childL = v('lname');
    var hLine1 = parseAddr(v('address')).line1;
    var norm = function (a) {
      return String(a || '').toLowerCase().replace(/[.,#]/g, ' ')
        .replace(/\broad\b/g, 'rd').replace(/\bstreet\b/g, 'st').replace(/\bavenue\b/g, 'ave')
        .replace(/\bdrive\b/g, 'dr').replace(/\blane\b/g, 'ln').replace(/\bcourt\b/g, 'ct')
        .replace(/\bplace\b/g, 'pl').replace(/\bboulevard\b/g, 'blvd').replace(/\s+/g, ' ').trim();
    };
    var parent = function (who, label) {
      var first = v('reg_' + who + '_fname') || v(who + '_name');
      var last = v('reg_' + who + '_lname');
      if (!first && !last) return null;
      var own = v('reg_' + who + '_address');
      var a1 = norm(own), h1 = norm(hLine1);
      var sameHome = !own || !h1 || a1.indexOf(h1) === 0 || h1.indexOf(a1) === 0;
      return {
        n: [first, last || childL].filter(Boolean).join(' '), t: label, on: true,
        p: v('reg_' + who + '_home_phone') || v(who + '_phone'),
        e: v('reg_' + who + '_email'),
        addr: sameHome ? '' : own,
        first: first, last: last || childL, phone2: v('reg_' + who + '_office_phone'),
        bind: { first: 'reg_' + who + '_fname', last: 'reg_' + who + '_lname',
                phone: 'reg_' + who + '_home_phone', phone2: 'reg_' + who + '_office_phone',
                email: 'reg_' + who + '_email', line1: 'reg_' + who + '_address' }
      };
    };
    var mother = parent('mother', 'Mother'), father = parent('father', 'Father');
    if (!mother && !father) return null;
    var surname = (father && father.last) || (mother && mother.last) || childL;
    var addrL = v('address').toLowerCase();
    var kids = CHILDREN.filter(function (c) {
      return c.l.toLowerCase() === childL.toLowerCase() && c.a.toLowerCase() === addrL;
    }).length || 1;
    return {
      n: surname, a: householdSummary(), p: v('home_phone'), c: kids,
      contacts: [father, mother].filter(Boolean)          // father first, as everywhere
    };
  }

  var LINK_N = 0;
  /* A household's person, opened on the child form: THE SAME CARD a contact is
     created with (extraCard) — relationship, what they may do, Link existing,
     first and last name, Phone and Phone 2 with their message setting, Email,
     Address and Work — filled with what is on file. One card wherever a person is
     added or edited (owner, 2026-10-05). The child form's Edit/Cancel/Save are the
     drawer's own; the card has none of its own.

     A parent migrated from this child's record (c.bind) still writes every field
     into the reg_* input it came from, so the form's Save saves it. */
  function buildLinkPanel(more, c, f) {
    var type = String(c.t || '').toLowerCase().replace(/\s+/g, '_');
    var card = extraCard();
    ['.cm-extra-remove', '.cm-scope'].forEach(function (s2) { var x = card.querySelector(s2); if (x) x.remove(); });
    card.classList.add('cm-linkcard');
    more.innerHTML = '';
    more.appendChild(card);

    var sel = card.querySelector('.cm-ptype select');
    if (sel && CONTACT_TYPES.indexOf(type) > -1) { sel.value = type; sel.dispatchEvent(new Event('change')); }

    var parts = String(c.n || '').trim().split(/\s+/);
    var lastN = parts.length > 1 ? parts.pop() : '';
    var first = c.bind ? (c.first || '') : parts.join(' ');
    var last = c.bind ? (c.last || '') : lastN;
    var inp = function (part, re) {
      var gs = card.querySelectorAll('[data-part="' + part + '"] .form-group');
      for (var i = 0; i < gs.length; i++) {
        var l = gs[i].querySelector('label');
        if (l && re.test((l.textContent || '').trim())) return gs[i].querySelector('input');
      }
      return null;
    };
    var fields = {
      first: inp('name', /^first name$/i), last: inp('name', /^last name$/i),
      phone: inp('reach', /^phone$/i), phone2: inp('reach', /^phone 2$/i), email: inp('reach', /^email$/i),
      line1: inp('addr', /^address line 1$/i)
    };
    var vals = { first: first, last: last, phone: c.p, phone2: c.phone2, email: c.e };
    Object.keys(vals).forEach(function (k) { if (fields[k]) fields[k].value = vals[k] || ''; });

    var same = card.querySelector('.cm-same input');
    if (same) { same.checked = !c.addr; same.dispatchEvent(new Event('change')); }
    if (c.addr) {
      var a = parseAddr(c.addr);
      if (fields.line1) fields.line1.value = a.line1;
      [[/^address line 2/i, a.line2], [/^city$/i, a.city], [/^state$/i, a.state], [/^zip/i, a.zip]].forEach(function (x) {
        var el2 = inp('addr', x[0]); if (el2) el2.value = x[1] || '';
      });
    }

    if (c.bind) {
      Object.keys(c.bind).forEach(function (k) {
        var el2 = fields[k];
        if (!el2) return;
        el2.addEventListener('input', function () {
          writeReal(c.bind[k], el2.value);
          if (k === 'first' || k === 'last') {
            var fn = fields.first.value.trim(), ln = fields.last.value.trim();
            var nm = more.parentNode.querySelector('.cm-pwho b');
            if (nm && (fn || ln)) nm.textContent = [fn, ln].filter(Boolean).join(' ');
          }
        });
      });
    }
  }

  /* "713 Valley Blvd, Lakewood, NJ 08701, USA" → the five US postal parts. The
     derived households carry one Places string; this is only for opening it in
     the edit fields. */
  function parseAddr(a) {
    var parts = String(a || '').replace(/,?\s*USA$/i, '').split(/\s*,\s*/);
    var out = { line1: parts[0] || '', line2: '', city: '', state: '', zip: '' };
    if (parts.length >= 3) {
      out.city = parts[parts.length - 2];
      var m = parts[parts.length - 1].match(/^(.*?)\s*(\d{5}(?:-\d{4})?)?$/);
      out.state = m ? m[1] : parts[parts.length - 1];
      out.zip = m && m[2] ? m[2] : '';
      if (parts.length > 3) out.line2 = parts.slice(1, parts.length - 2).join(', ');
    } else if (parts.length === 2) {
      out.city = parts[1];
    }
    return out;
  }

  function esc(t) {
    return String(t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* The tab strip, renamed to what each tab will hold once the fields are
     redistributed. "Parents Details" becomes "Family" because the tab carries the
     HOUSEHOLD too — address, house phone, billing contact, siblings — not just
     people. "Registration Form Details" is labelled for what is left of it: the
     paper is an action, not a place data lives. */
  var TABS = {
    'parents details': { to: 'Family', why: '' },
    'therapy': { to: 'Health', why: '' },
    'registration form details': { to: 'Enrollment', why: '' },
    // Names the mechanism, not the thing. These five columns say WHICH STAFF MEMBER
    // handles this child, overriding the class/branch default. Nothing to do with
    // the family module — a cheap, separate win.
    'contact assignment overrides': { to: 'Assigned Staff', why: '' },
    // Everything in it is money: voucher programme, HRA/ACS agency and case,
    // price per month, charge day, payment methods, charges, employer share.
    // "Privileges" named none of that. This is also where families.billing_contact_id
    // will land, so the tab is about to carry the statement's addressee too.
    'privileges': { to: 'Billing', why: '' }
  };

  // The waiting list is the first stage of enrolment, not a subject of its own, so
  // its section is FOLDED INTO Enrollment & Registration and its tab is dropped.
  // Renaming both to the same label would have left two tabs with one name — which
  // is what happened on the first attempt.
  function foldWaitlist() {
    var src = sectionByHead('wait list details');
    var dst = sectionByHead('enrollment');
    if (!src || !dst || src === dst || src.getAttribute('data-cm-folded') === '1') return 0;
    src.setAttribute('data-cm-folded', '1');
    var dstCard = dst.querySelector('.vB-editcard') || dst;

    // Tag what was ALREADY in Enrollment as the enrolled stage, before the waiting
    // list arrives, so the two stages can be told apart afterwards.
    dstCard.querySelectorAll('.form-group').forEach(function (g) {
      if (!g.getAttribute('data-cm-stage')) g.setAttribute('data-cm-stage', 'enrolled');
    });

    /* The folded fields keep a heading of their own. Voucher type, preferred branch,
       anticipated start and the transportation intention are questions of the WAITING
       LIST stage — asked before there is a place — and reading them under a bare
       "Enrollment" heading loses that. One tab, two named stages. */
    var head = document.createElement('div');
    head.className = 'tnd-subhead cm-subhead';
    head.textContent = 'Waiting list';
    dstCard.appendChild(head);

    head.setAttribute('data-cm-stage', 'waitlist-head');
    var groups = src.querySelectorAll('.form-group');
    for (var i = 0; i < groups.length; i++) {
      groups[i].setAttribute('data-cm-stage', 'waitlist');
      dstCard.appendChild(groups[i]);
    }
    bindStage();
    src.style.display = 'none';
    // Drop the now-empty tab from the strip.
    var nodes = document.querySelectorAll('button, a, span, li');
    for (var j = 0; j < nodes.length; j++) {
      if (nodes[j].children.length) continue;
      if ((nodes[j].textContent || '').trim().toLowerCase() === 'wait list details') {
        nodes[j].style.display = 'none';
      }
    }
    return 1;
  }

  function renameTabs() {
    var done = 0;
    var nodes = document.querySelectorAll('button, a, span, li');
    for (var i = 0; i < nodes.length; i++) {
      var el2 = nodes[i];
      if (el2.getAttribute('data-cm-tab') === '1') continue;
      if (el2.children.length) continue;                 // leaf nodes only
      var txt = (el2.textContent || '').trim().toLowerCase();
      var t = TABS[txt];
      if (!t) continue;
      el2.setAttribute('data-cm-tab', '1');
      el2.textContent = t.to;
      if (t.why) {
        var s = document.createElement('span');
        s.className = 'cm-tabwhy';
        s.textContent = t.why;
        el2.appendChild(s);
      }
      done++;
    }
    return done;
  }

  /* The edit form is ONE form of <section class="vB-group"> blocks, and the tab
     strip scrolls between them — so a field can be moved to another tab by moving
     its .form-group into another section. It is the same input node, still inside
     #frmAddEditRecord, so the form posts and saves exactly as before. */
  /* A "section" is a drawer group (section.vB-group) when editing, and a fieldset
     with a legend on the Add child page, which is one long form rather than tabs.
     Treating both the same is what lets every step below — Family, Health, the
     staff contacts, the waiting-list stage — run on creation as well as editing. */
  function sectionByHead(text) {
    var secs = document.querySelectorAll('#frmAddEditRecord section.vB-group');
    if (!secs.length) secs = document.querySelectorAll('#frmAddEditRecord fieldset');
    for (var i = 0; i < secs.length; i++) {
      var h = secs[i].querySelector('h1,h2,h3,h4,legend,.vB-grouphead');
      if (h && (h.textContent || '').trim().toLowerCase().indexOf(text) === 0) return secs[i];
    }
    return null;
  }

  function renameHead(from, to) {
    var s = sectionByHead(from);
    if (!s) return 0;
    var h = s.querySelector('h1,h2,h3,h4,legend,.vB-grouphead');
    if (!h || h.getAttribute('data-cm-head') === '1') return 0;
    h.setAttribute('data-cm-head', '1');
    h.textContent = to;
    return 1;
  }

  // A person's own details: name, how to reach them, where they live, what they do.
  // All of it is an attribute of the contact, so all of it sits with the people.
  var TO_FAMILY = [
    'reg_father_fname', 'reg_father_lname', 'reg_father_home_phone',
    'reg_father_office_phone', 'reg_father_email', 'reg_father_address',
    'reg_father_occupation', 'reg_father_employer', 'reg_father_work_address',
    'reg_mother_fname', 'reg_mother_lname', 'reg_mother_home_phone',
    'reg_mother_office_phone', 'reg_mother_email', 'reg_mother_address',
    'reg_mother_occupation', 'reg_mother_employer', 'reg_mother_work_address'
  ];

  /* The five staff overrides, sent to the tab each one is ABOUT. Only one of them
     is enrolment; folding all five into Enrollment would repeat the mistake this
     whole pass is undoing. And they are overrides of a cascade: 12 children of 751
     have any of them set, so 739 open a tab of five empty selects. */
  /* ALL FIVE STAFF CONTACTS SIT TOGETHER IN ENROLLMENT. The Transportation
     Department and Immunization contacts first went to the tab of their subject.
     But each names who in the office handles something for this child — a staff
     assignment like the enrollment contact, secretary and director — and the
     office sets those together, in one place. The Transportation and Health tabs
     are about the child, not the staff. */
  var STAFF_TO = {
    enrollment_contact_id:     'enrollment',
    secretary_contact_id:      'enrollment',
    director_contact_id:       'enrollment',
    transportation_contact_id: 'enrollment',
    // Same reasoning: who in the office chases this child's immunisations is a
    // staff assignment, set with the others, not a fact about the child's health.
    immunization_contact_id:   'enrollment'
  };

  /* HAS THERAPY GOES LAST ON HEALTH. The tab was the Therapy section, so its one
     question sat on top and everything clinical that moved in — allergies,
     conditions, the pediatrician — landed under it. The tab is Health now: the
     child's own health comes first, and whether they are on the Therapy module's
     list is the last thing on it. The explanation line that follows the checkbox
     goes with it. Moved on every pass, so nothing appended later lands below. */
  function therapyLast() {
    var cb = document.querySelector('#frmAddEditRecord [name="has_therapy"]');
    var g = cb ? group(cb) : null;
    if (!g || !g.parentNode) return 0;
    var card = g.parentNode;
    var help = g.nextElementSibling;
    var keep = help && help.classList.contains('form-group') && !help.querySelector('[name]') &&
      help.getAttribute('data-cm-moved') !== '1' ? help : null;
    var last = keep || g;
    if (card.lastElementChild === last && (!keep || keep.previousElementSibling === g)) return 0;
    card.appendChild(g);
    if (keep) card.appendChild(keep);
    return 1;
  }

  function distributeStaff() {
    var n = 0;
    Object.keys(STAFF_TO).forEach(function (name) {
      var e4 = document.querySelector('[name="' + name + '"]');
      if (!e4) return;
      var g4 = group(e4);
      var dst = sectionByHead(STAFF_TO[name]);
      if (!g4 || !dst || g4.getAttribute('data-cm-moved') === '1') return;
      var card = dst.querySelector('.vB-editcard') || dst;
      if (card.contains(g4)) return;
      g4.setAttribute('data-cm-moved', '1');
      card.appendChild(g4);
      mark(g4, 'cm-move', 'moved here');
      n++;
    });
    // The tab has nothing left of its own.
    var src = sectionByHead('assigned staff');
    if (src && src.style.display !== 'none' && !src.querySelector('.form-group')) {
      src.style.display = 'none';
      document.querySelectorAll('button, a, span, li').forEach(function (b) {
        if (b.children.length) return;
        if ((b.textContent || '').trim() === 'Assigned Staff') b.style.display = 'none';
      });
      n++;
    }
    return n;
  }

  // Everything clinical on one tab, whichever paper form it arrived on.
  var TO_HEALTH = [
    'allergies[]', 'other_allergy',
    'reg_medical_conditions', 'reg_allergy_special_instructions',
    'reg_pediatrician_name', 'reg_pediatrician_phone', 'reg_pediatrician_address'
  ];

  /* A PERSON, not twenty rows.

     The parent fields arrived as a flat run of .form-group nodes because that is how
     the paper form listed them. Twenty loose rows is not a structure: nothing says
     which five belong to the father, and the office reads the tab as a wall.

     So each parent becomes a card, and inside it the fields sit in the order someone
     actually needs them: who they are, how to reach them, where they live — one tick
     on the face of the card — and, folded away, what they do. Only work is folded:
     employer and work address are 0% filled and should not cost a screenful, while
     the address tick decides whether an address is asked for at all and so cannot
     sit behind a summary.

     The nodes are MOVED, never rebuilt: same inputs, same names, still posting. */
  /* Each part lists the children_additional_information suffixes it takes, and the
     LEGACY `children` columns that describe the same person.

     The legacy ones had to come in here too. They sat loose above the cards in the
     order the old form wrote them — father name, mother name, father phone, mother
     phone — so the tab alternated between two people and then showed two more
     properly grouped blocks below. Two sets of the same person on one screen is the
     duplication this module exists to end, and leaving it visible taught the wrong
     shape. One card per parent, everything about them inside it. */
  /* HOME AND WORK WERE ONE FOLD, AND THEY ARE NOT ONE SUBJECT.

     Where a person lives is answered by a tick on 688 of 688 rows; what they do for
     a living is four boxes nobody fills. Folding them together meant the tick —
     the thing that decides whether an address is asked for at all — was hidden
     behind a summary, and opening it to reach the tick also opened employer and
     work address.

     So they separate. The address is a checkbox on the face of the card, and work
     is its own fold that opens when someone clicks it. */
  /* What they may do comes straight after who they are to the child: the two answer
     one question together — a father who is Main responsible is a different card
     from a father who may only be notified — and the rest of the card (how to reach
     them, where they live) matters in the light of it. */
  var PERSON_PARTS = [
    { key: 'perms',  label: 'What they may do', fields: [], perms: true },
    { key: 'name',   label: '',              fields: ['fname', 'lname'] },
    { key: 'reach',  label: 'How to reach',  fields: ['home_phone', 'office_phone', 'email'] },
    { key: 'addr',   label: '',              fields: ['address'] },
    { key: 'work',   label: 'Work',          fields: ['occupation', 'employer', 'work_address'] },
    { key: 'legacy', label: 'Old columns',   fields: [],
      legacy: ['_name', '_phone'] }
  ];

  /* "Trusted contacts" and "Emergency contacts" were two blocks because they came
     from two features. They hold the same four fields and differ only in what the
     person is allowed to do — which is a permission on the link, not a list of its
     own. So they become ONE block, "Other contacts", and it goes at the END: the
     parents are who the office needs first, and the grandmother, the car service
     and the doctor come after them. */
  /* children.parent_email is ONE field with no owner: the office types an address
     once and the save copies it into father_email and mother_email. It matches
     father_email in 229 of 251 rows for that reason, not because the parents share
     an inbox.

     Going forward each parent keeps their own — reg_father_email and
     reg_mother_email already exist, both at 33% — so this column has no successor
     and is folded away with the rest of the old ones. What it leaves open is the
     migration: an address with no owner cannot be split by rule, so those 251 rows
     are a question for the tenant, not for a script. */
  function householdLegacy() {
    var fam = sectionByHead('family');
    if (!fam || fam.querySelector('.cm-hlegacy')) return 0;
    var famCard = fam.querySelector('.vB-editcard') || fam;
    var el2 = document.querySelector('#frmAddEditRecord [name="parent_email"]');
    if (!el2) return 0;
    var g = group(el2);
    if (!g) return 0;

    var box = document.createElement('details');
    box.className = 'cm-pmore cm-plegacy cm-hlegacy';
    box.innerHTML = '<summary>Old columns<em>the ones the migration removes</em></summary>' +
      '<div class="cm-pgrid"></div>';
    g.setAttribute('data-cm-moved', '1');
    box.querySelector('.cm-pgrid').appendChild(g);
    famCard.appendChild(box);
    return 1;
  }

  /* The household's own block: the complete address and the house phone, together,
     between the choice and the people.

     The address INPUTS move here; the address COLUMNS do not. Wave 2 is about not
     migrating children.address / latitude / longitude out of `children`, because bus
     routing reads them and the geocode cron writes them. Where the input sits on
     screen has nothing to do with that — it is the same input, in the same form,
     posting the same name. I had conflated the two and left the address mirrored
     read-only when it could simply live here. */
  function householdBlock() {
    var fam = sectionByHead('family');
    if (!fam || fam.querySelector('.cm-hblock')) return 0;
    var famCard = fam.querySelector('.vB-editcard') || fam;

    var box = document.createElement('div');
    box.className = 'cm-hblock';
    box.innerHTML = '<div class="cm-personhead">Household</div>' +
      '<div class="cm-plabel">Where the family lives</div>' +
      '<div class="cm-pgrid" data-part="addr"></div>' +
      '<div class="cm-plabel">House phone</div>' +
      '<div class="cm-pgrid" data-part="phone"></div>';

    var addr = box.querySelector('[data-part="addr"]');
    var phone = box.querySelector('[data-part="phone"]');
    var moved = 0;

    ['address', 'apartment_number', 'city', 'state', 'zip'].forEach(function (n2) {
      var el2 = document.querySelector('#frmAddEditRecord [name="' + n2 + '"]');
      if (!el2) return;
      var g = group(el2);
      if (!g) return;
      g.setAttribute('data-cm-moved', '1');
      addr.appendChild(g);
      moved++;
    });

    // Every group labelled "Home Phone Number" — the form renders more than one.
    Array.prototype.slice.call(famCard.querySelectorAll('.form-group')).forEach(function (g) {
      var lab = g.querySelector('label');
      if (!lab) return;
      if (!/^home phone/i.test((lab.textContent || '').trim())) return;
      g.setAttribute('data-cm-moved', '1');
      phone.appendChild(g);
      moved++;
    });

    /* ONE house phone. Two groups carried that label: the real one, with the
       home_phone input and its notification choice, and a second whose only input
       has no name at all — so it posts nothing and exists only to be typed into and
       lost. Keep the one the form actually saves. */
    var seen = false;
    Array.prototype.slice.call(phone.querySelectorAll('.form-group')).forEach(function (g) {
      var lab = g.querySelector('label');
      if (!lab || !/^home phone/i.test((lab.textContent || '').trim())) return;
      var real = !!g.querySelector('[name="home_phone"]');
      if (real && !seen) { seen = true; return; }
      if (!real) { g.remove(); }
    });

    if (!moved) return 0;
    // Straight after the choice block, before the people.
    var choice = famCard.querySelector('.cm-newblock');
    if (choice && choice.nextSibling) famCard.insertBefore(box, choice.nextSibling);
    else famCard.appendChild(box);
    return 1;
  }

  function otherContacts() {
    var fam = sectionByHead('family');
    if (!fam || fam.querySelector('.cm-others')) return 0;
    var famCard = fam.querySelector('.vB-editcard') || fam;

    var found = [];
    document.querySelectorAll('#frmAddEditRecord .form-group').forEach(function (g) {
      var lab = g.querySelector('label');
      if (!lab) return;
      var t = (lab.textContent || '').trim().toLowerCase();
      if (t === 'trusted contacts' || t === 'emergency contacts') found.push(g);
    });
    if (!found.length) return 0;

    var box = document.createElement('div');
    box.className = 'cm-others';
    box.innerHTML = '<div class="cm-personhead">More contacts' +
      '<span class="cm-tag" style="position:static;margin-left:8px">to contact_links</span></div>' +
      '<div class="cm-extras"></div>' +
      '<button type="button" class="cm-addcontact">+ Add contact</button>' +
      '<details class="cm-pmore cm-plegacy cm-oldlists"><summary>Old lists' +
        '<em>trusted and emergency, now permissions on one card</em></summary>' +
        '<div class="cm-otherbody"></div></details>';
    var body = box.querySelector('.cm-otherbody');
    var extras = box.querySelector('.cm-extras');
    box.querySelector('.cm-addcontact').addEventListener('click', function () {
      var c = extraCard();
      extras.appendChild(c);
      var sel = c.querySelector('select');
      if (sel) sel.focus();
    });
    /* The help text goes with the split. Both paragraphs exist to explain how the
       two lists DIFFER — one grants the CAR reply and a date range, the other grants
       nothing and is only to read and dial. Merged into one block where the
       permission is a tick on the row, that explanation describes a distinction the
       screen no longer makes, so it would be a paragraph teaching the old model. */
    var STALE = ['allowed to be messaged about this child',
                 'if the parents cannot be reached'];
    found.forEach(function (g) {
      g.setAttribute('data-cm-moved', '1');
      g.classList.remove('cm-out');
      var tag = g.querySelector('.cm-tag');
      if (tag) tag.remove();
      g.querySelectorAll('p, .tnd-hint, .help-block, small, div').forEach(function (n2) {
        if (n2.querySelector('input, select, textarea, label')) return;
        var t2 = (n2.textContent || '');
        for (var i = 0; i < STALE.length; i++) {
          if (t2.indexOf(STALE[i]) > -1) { n2.remove(); return; }
        }
      });
      body.appendChild(g);
    });

    /* The two "Add ..." buttons live outside the .form-group blocks their lists sit
       in, so moving the lists left the buttons stranded above the parent cards —
       an invitation to add a grandmother before naming the mother. They go into the
       Old lists fold with the lists they fill: hidden, never removed, so any rows
       a child already has still post on save (tc_present / ec_present tell the
       controller the lists were on the form). */
    Array.prototype.slice.call(famCard.children).forEach(function (el2) {
      if (!el2.classList) return;
      var isAdd = el2.classList.contains('tnd-prow-add') ||
                  el2.classList.contains('tnd-ec-container') ||
                  /add (trusted|emergency) contact/i.test((el2.textContent || ''));
      if (!isAdd) return;
      el2.setAttribute('data-cm-moved', '1');
      body.appendChild(el2);
    });

    famCard.appendChild(box);   // last in the tab, after both parent cards
    return 1;
  }

  /* Every contact carries a TYPE, and a parent is not a special case — they are a
     contact whose type happens to be mother or father. The dropdown says so, and
     pre-selects the obvious answer so nothing is typed for the common case while a
     step-father, a legal guardian or a foster parent has somewhere to go.

     The values are the enum from the design, grouped the way it groups them. */
  /* THE RELATIONSHIP LIST AND WHAT EACH ONE GRANTS BY DEFAULT are the field map's
     (Family Module — As-Is / To-Be Field Map, contact_type and contact_links), not
     this prototype's. Mother and father are offered first on every new family; the
     groups below were regrouped by the owner.

     The defaults are its table too: the six types that stand in for a parent —
     mother, father, step_mother, step_father, legal_guardian, foster_parent — get
     is_primary, receives_notification and may_collect_child; "every other type"
     gets none of them, and each has to be granted deliberately. is_primary is what
     this form calls Main responsible, and it defaults to full permissions. */
  /* ONE LIST, NO CATEGORIES (owner, 2026-10-02): parents first, then family, then
     everyone else, in this order. */
  var CONTACT_TYPES = ['mother', 'father', 'step_mother', 'step_father', 'grandmother', 'grandfather',
    'aunt', 'uncle', 'sibling', 'legal_guardian', 'foster_parent', 'family_friend', 'babysitter',
    'car_service', 'pediatrician', 'other_doctor', 'therapist', 'caseworker', 'other'];

  var STANDS_FOR_PARENT = ['mother', 'father', 'step_mother', 'step_father',
                           'legal_guardian', 'foster_parent'];

  function typeLabel(v) {
    return v.replace(/_/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); });
  }

  /* PERMISSIONS ARE ON THE LINK, AND THE LINK HAD NOWHERE TO SHOW THEM.

     "Trusted contacts" and "Emergency contacts" were two lists holding the same four
     fields, differing only in what the person was allowed to do. That difference is
     a permission on contact_links, not a list — so the lists merged, and the
     permissions have to appear somewhere. On the parent cards they were missing
     entirely: the office could name a mother and never say whether she may collect
     the child.

     contact_links.receives_notification is the sharp one. It is per CHILD, while
     family_contacts.notification_method is per PERSON — the uncle who is a father in
     another household needs both, and until now only the per-person half had a
     control. This is the per-child half.

     MAIN RESPONSIBLE IS ALL OF THEM. The main responsible adult is the person the
     school deals with first: they are notified, may collect, are called in an
     emergency and owe the fees. So ticking it ticks the other four and takes them
     off the screen —
     a main responsible adult who may not collect the child is not a state anyone
     means. Unticking it hands the four back as separate choices, as they were
     before, for everyone who is something less than that: the grandmother who
     collects on Tuesdays, the father who pays but is not called.

     ON by default for both parents — the father and the mother are the main
     responsible adults unless the office says otherwise. Unticking it on one of
     them is how a separated parent, or one who is not the first call, is recorded;
     the four then come back as separate choices, ALL OFF. Nothing is carried over:
     whatever that parent may still do is ticked on purpose.

     MAY COLLECT HAS A WINDOW. Ticking it opens Always / Specific dates — the
     contact_links valid_from / valid_to pair. Note the clock problem in the decisions
     doc (§1): "until the 14th" is evaluated against CURDATE() on the MySQL
     connection, a fourth clock. The window is hidden while Main responsible is on,
     because a main responsible adult may always collect. */
  var PERMS = [
    { key: 'main',      label: 'Main responsible',    on: true,
      why: 'The first adult for this child — includes every permission below' },
    { key: 'notify',    label: 'Notifications',       on: true,
      why: 'contact_links.receives_notification — for THIS child' },
    { key: 'collect',   label: 'May collect',         on: true,
      why: 'May take the child — always, or between two dates' },
    { key: 'emergency', label: 'Emergency contact',   on: false,
      why: 'Called when no responsible adult answers' },
    /* WHO PAYS IS A PERSON, AND THE FORM NEVER ASKED.

       Billing hangs off the CHILD — price per month, charge day, payment method,
       charges — with no column saying which adult owes it. In a separated family
       that is the whole question, and today it is answered in someone's head or in
       a comment field. On its own it is off: for a parent it comes with Main
       responsible, for anyone else it is an explicit tick. */
    { key: 'payer',     label: 'Payment responsible', on: false,
      why: 'Owes the fees for this child — nobody is assumed' }
  ];

  /* ONE ADDRESS STANDARD, EVERYWHERE AN ADDRESS IS ASKED FOR.

     The household address is structured: a line, an apartment number, a city, a
     state, a zip. The parent's own address and the work address are single free-text
     boxes — the same fact recorded in two different shapes on one tab. A free-text
     address cannot be matched against another, which is how 351 distinct addresses
     came out of 692 children; and when these become rows of their own, a one-line
     string has to be taken apart by guesswork before it can be stored.

     So the extra parts are added here and the existing box keeps its column and
     stays the address line. The added inputs are PROTOTYPE-ONLY: they carry no name
     attribute, so they post nothing and cannot write to a column that does not exist
     yet. They show the shape the migration has to produce. */
  /* THE US POSTAL SHAPE: line 1 (street), line 2, city, state, ZIP code — the order
     USPS and every US form use, so it matches what parents write on paper and what
     an address validator expects.

     Line 2 means different things by address. At home it is the apartment, and the
     label says so. At work it is a suite or a floor, never an apartment — so the
     work address says only "line 2". */
  var ADDRESS_PARTS = {
    home: { line1: 'Address line 1',      line2: 'Address line 2 (apartment)' },
    work: { line1: 'Work address line 1', line2: 'Work address line 2' }
  };

  function standardAddress(grid, anchor, kind) {
    if (!grid || !anchor || grid.getAttribute('data-cm-addr') === '1') return;
    grid.setAttribute('data-cm-addr', '1');
    var labels = ADDRESS_PARTS[kind || 'home'];
    // The existing box keeps its column and becomes line 1.
    var lab = anchor.querySelector('label');
    if (lab) { lab.textContent = labels.line1; lab.setAttribute('data-cm-role', '1'); }
    var after = anchor;
    [labels.line2, 'City', 'State', 'ZIP code'].forEach(function (text) {
      var g = document.createElement('div');
      g.className = 'form-group cm-new';
      g.setAttribute('data-cm', '1');
      g.innerHTML = '<label class="col-sm-3 control-label">' + text + '</label>' +
        '<div class="col-sm-4"><input type="text" class="form-control"></div>' +
        '<span class="cm-tag">new · US postal shape</span>';
      after.parentNode.insertBefore(g, after.nextSibling);
      after = g;
    });
  }

  /* Every input here is prototype-only. The checkboxes and dates have no name, and
     the two radios are tied to a form that does not exist (form="cm-proto-none") so
     they can share a name for grouping without posting it with the child. */
  function permToggles(who, noneGranted) {
    var mainOn = !noneGranted && PERMS[0].on;
    /* While Main responsible is on, the other four are ticked but off screen, and a
       "Full permission" badge beside it says so — the state has to be visible
       somewhere, or a hidden tick reads as no tick. The badge's title names what
       it covers. */
    return '<div class="cm-perms">' + PERMS.map(function (pm) {
      var on = mainOn || (pm.on && !noneGranted);
      return '<label class="cm-perm' + (pm.key === 'main' ? ' cm-perm-main' : '') +
        (on ? ' on' : '') + '" title="' + pm.why + '">' +
        '<input type="checkbox" data-perm="' + pm.key + '"' + (on ? ' checked' : '') + '>' +
        '<span>' + pm.label + '</span></label>' +
        (pm.key === 'main'
          ? '<span class="cm-permnote" hidden title="Notifications, may collect and emergency ' +
            'contact are all on">Full permission</span>'
          : '');
    }).join('') + '</div>' +
    '<div class="cm-collect" hidden>' +
      '<div class="cm-collect-head">May collect</div>' +
      '<div class="cm-collect-when">' +
        '<label><input type="radio" form="cm-proto-none" name="cm-collect-' + who + '" value="always" checked>' +
          '<span>Always</span></label>' +
        '<label><input type="radio" form="cm-proto-none" name="cm-collect-' + who + '" value="range">' +
          '<span>Specific dates</span></label>' +
      '</div>' +
      '<div class="cm-collect-range" hidden>' +
        '<label><span>From</span><input type="date" class="form-control"></label>' +
        '<label><span>To</span><input type="date" class="form-control"></label>' +
      '</div>' +
    '</div>';
  }

  /* ADDRESS AND WORK ARE BOTH FOLDS NOW, and inside Address the tick says WHICH
     address it means. "Lives at the household address" on its own asks the office
     to remember what that is; the summary under it reads the household block's own
     inputs, live, so a correction there shows here at once. */
  function householdSummary() {
    var val = function (n) {
      var el2 = document.querySelector('#frmAddEditRecord [name="' + n + '"]');
      return el2 ? (el2.value || '').trim() : '';
    };
    var line = val('address').replace(/,?\s*USA$/i, '');
    var apt = val('apartment_number'), city = val('city'), state = val('state'), zip = val('zip');
    if (apt) line += (line ? ', ' : '') + 'Apt ' + apt;
    // The address line is a Places string and usually carries the city already.
    if (city && line.toLowerCase().indexOf(city.toLowerCase()) < 0) {
      line += (line ? ', ' : '') + city + (state ? ', ' + state : '') + (zip ? ' ' + zip : '');
    }
    return line;
  }

  /* LINK BEFORE CREATE, ON EVERY CARD — EVEN IN A NEW FAMILY.

     "New family" means the household is new, not that its people are. A father
     remarrying, a grandmother who already collects three cousins, the pediatrician
     259 children share: each is on file already, and typing them into a new card
     makes the second copy C1 exists to stop. So every person card carries a small
     "Link existing contact" beside its name fields. It opens a search over the
     page — people, not households: name, phone or household surname — and picking
     someone brings their details into the card.

     What it does NOT bring is the relationship. The field map is explicit: type is
     a property of the link, not the person ("the same woman is a mother in one
     family and a grandmother in another"). So the dropdown stays as the office set
     it, and the result line shows what they are elsewhere only as context.

     Prototype: picking copies the name and phone into the card's inputs — on a
     parent card those are the real reg_* fields, so they post. The real model stores
     contact_id on the link instead. Unlink puts back what was there before. */
  function peopleIndex() {
    var seen = {}, out = [];
    var key = function (n, p) { return n.toLowerCase().replace(/\s+/g, ' ') + '|' + String(p || '').replace(/\D/g, ''); };
    FAMILIES.forEach(function (f) {
      (f.contacts || []).forEach(function (c) {
        // A doctor on a household's list is not a member of it: the pediatrician
        // comes from the loose list below, with the count of children they serve.
        if (c.t !== 'Mother' && c.t !== 'Father') return;
        var k = key(c.n, c.p);
        if (seen[k]) return;
        seen[k] = 1;
        out.push({ n: c.n, t: c.t, p: c.p || '', where: f.n + ' household', a: f.a || '', kids: f.c });
      });
    });
    LOOSE.forEach(function (c) {
      var k = key(c.n, c.p);
      if (seen[k]) return;
      seen[k] = 1;
      out.push({ n: c.n, t: typeLabel(c.k), p: c.p || '', where: '', a: '', kids: c.c });
    });
    return out;
  }

  function cardInput(card, re) {
    var groups = card.querySelectorAll('.cm-pgrid > .form-group');
    for (var i = 0; i < groups.length; i++) {
      var lab = groups[i].querySelector('label');
      if (lab && re.test((lab.textContent || '').trim())) {
        var inp = groups[i].querySelector('input');
        if (inp) return inp;
      }
    }
    return null;
  }

  function setVal(inp, v) {
    if (!inp) return;
    inp.value = v;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function linkExisting(card) {
    var nameGrid = card.querySelector('[data-part="name"]');
    if (!nameGrid || card.querySelector('.cm-lkrow')) return;
    var row = document.createElement('div');
    row.className = 'cm-lkrow';
    row.innerHTML = '<button type="button" class="cm-lklink">Link existing contact</button>';
    nameGrid.parentNode.insertBefore(row, nameGrid);
    var before = null;

    function fields() {
      return {
        first: cardInput(card, /^first name$/i),
        last:  cardInput(card, /^last name$/i),
        phone: cardInput(card, /^phone$/i)
      };
    }

    /* A LINKED PERSON READS LIKE A HOUSEHOLD CONTACT, NOT LIKE A FORM.

       Once the card points at someone on file, their name, phones, address and
       work are that record's — not the office's to retype. So the card shows what
       the household checklist shows for a ticked person: a summary (phone, where
       they live, what they are on file), with the relationship and permissions
       above it still editable, because those belong to THIS child's link. The
       fields fold away; Edit brings them back for a correction, Done folds them
       again and refreshes the summary. Unlink restores the card as it was. */
    function editable() {
      var reach = card.querySelector('[data-part="reach"]');
      var out = [nameGrid, reach];
      if (reach && reach.previousElementSibling && reach.previousElementSibling.classList.contains('cm-plabel')) {
        out.push(reach.previousElementSibling);
      }
      card.querySelectorAll(':scope > details.cm-pmore').forEach(function (d) { out.push(d); });
      return out.filter(Boolean);
    }
    function showFields(show) {
      editable().forEach(function (el2) { el2.style.display = show ? '' : 'none'; });
    }

    function summary(person) {
      var f = fields();
      var name = [f.first && f.first.value, f.last && f.last.value].filter(Boolean).join(' ') || person.n;
      var phone = (f.phone && f.phone.value) || person.p;
      return '<div class="cm-lkhead"><b>' + esc(name) + '</b>' +
          '<div class="cm-hacts"><button type="button" class="cm-lkedit">Edit</button>' +
          '<button type="button" class="cm-lkun">Unlink</button></div></div>' +
        '<dl class="cm-hread">' +
          '<dt>Phone</dt><dd>' + (phone ? esc(phone) : '<i>none on file</i>') + '</dd>' +
          (person.a ? '<dt>Lives at</dt><dd>' + esc(person.a.replace(/,?\s*USA$/i, '')) + '</dd>' : '') +
          '<dt>On file</dt><dd>' + esc(person.t) + (person.where ? ' in the ' + esc(person.where) : '') +
            (person.kids ? ' \u00b7 ' + person.kids + (person.kids === 1 ? ' child' : ' children') : '') + '</dd>' +
        '</dl>';
    }

    function linked(person) {
      var f = fields();
      before = { first: f.first && f.first.value, last: f.last && f.last.value, phone: f.phone && f.phone.value };
      var parts = person.n.trim().split(/\s+/);
      var last = parts.length > 1 ? parts.pop() : '';
      setVal(f.first, parts.join(' '));
      setVal(f.last, last);
      setVal(f.phone, person.p);
      card.classList.add('is-linked');
      showFields(false);
      card.dispatchEvent(new CustomEvent('cm-linked', { detail: person }));
      // Edit opens the card's fields and stays open — no Done. They are saved by
      // the form's Save with everything else.
      var editing = false;
      var paint = function () {
        row.innerHTML = '<div class="cm-linked">' + summary(person) + '</div>';
        var eb = row.querySelector('.cm-lkedit');
        row.querySelector('.cm-linked dl').style.display = editing ? 'none' : '';
        if (editing) eb.remove();
        else eb.addEventListener('click', function () {
          editing = true;
          showFields(true);
          paint();
        });
        row.querySelector('.cm-lkun').addEventListener('click', function () {
          var g = fields();
          if (before) { setVal(g.first, before.first || ''); setVal(g.last, before.last || ''); setVal(g.phone, before.phone || ''); }
          card.classList.remove('is-linked');
          showFields(true);
          card.dispatchEvent(new CustomEvent('cm-unlinked'));
          row.innerHTML = '<button type="button" class="cm-lklink">Link existing contact</button>';
          row.querySelector('.cm-lklink').addEventListener('click', open);
        });
      };
      paint();
    }

    function open() {
      if (document.querySelector('.cm-lk-back')) return;
      var back = document.createElement('div');
      back.className = 'cm-lk-back';
      back.innerHTML =
        '<div class="cm-lk" role="dialog" aria-modal="true" aria-label="Link an existing contact">' +
          '<div class="cm-lk-head"><b>Link an existing contact</b>' +
          '<button type="button" class="cm-lk-x" aria-label="Close">\u00d7</button></div>' +
          '<input type="search" class="cm-findbox" placeholder="Name, phone or household surname" ' +
          'aria-label="Search people on file">' +
          '<div class="cm-findout"></div>' +
        '</div>';
      document.body.appendChild(back);
      var box = back.querySelector('.cm-findbox'), out = back.querySelector('.cm-findout');
      var hits = [];
      var close = function () { back.remove(); document.removeEventListener('keydown', onKey, true); };

      function render() {
        var q = box.value.trim().toLowerCase(), qd = q.replace(/\D/g, '');
        if (q.length < 2) { out.innerHTML = ''; hits = []; return; }
        hits = peopleIndex().filter(function (h) {
          var hay = (h.n + ' ' + h.where).toLowerCase();
          return hay.indexOf(q) > -1 || (qd.length >= 3 && h.p.replace(/\D/g, '').indexOf(qd) > -1);
        }).slice(0, 8);
        out.innerHTML = hits.length ? hits.map(function (h, i) {
          return '<button type="button" class="cm-fhit' + (i === 0 ? ' act' : '') + '" data-i="' + i + '">' +
            '<b>' + esc(h.n) + '</b>' +
            '<span>' + esc(h.t) + (h.p ? ' \u00b7 ' + esc(h.p) : '') + '</span>' +
            '<i>' + (h.where ? esc(h.where) + ' \u00b7 ' : '') +
            (h.kids ? h.kids + (h.kids === 1 ? ' child' : ' children') : '') +
            (h.a ? ' \u00b7 ' + esc(h.a) : '') + '</i></button>';
        }).join('') : '<div class="cm-findhint">Nobody on file matches \u2014 fill the card in as a new person.</div>';
        out.querySelectorAll('.cm-fhit').forEach(function (b) {
          b.addEventListener('click', function () { linked(hits[+b.getAttribute('data-i')]); close(); });
        });
      }

      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(); return; }
        var items = out.querySelectorAll('.cm-fhit');
        if (!items.length) return;
        var cur = 0;
        items.forEach(function (x, i) { if (x.classList.contains('act')) cur = i; });
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          var nx = (cur + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
          items.forEach(function (x) { x.classList.remove('act'); });
          items[nx].classList.add('act');
          items[nx].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
          e.preventDefault();
          items[cur].click();
        }
      }

      box.addEventListener('input', render);
      document.addEventListener('keydown', onKey, true);
      back.addEventListener('click', function (e) { if (e.target === back) close(); });
      back.querySelector('.cm-lk-x').addEventListener('click', close);
      box.focus();
    }

    row.querySelector('.cm-lklink').addEventListener('click', open);
  }

  function wireSame(same, bucket, sum) {
    var cb = same.querySelector('input');
    var sync = function () {
      bucket.style.display = cb.checked ? 'none' : '';
      same.classList.toggle('on', cb.checked);
      if (!sum) return;
      var text = householdSummary();
      sum.textContent = text || 'No household address yet.';
      sum.classList.toggle('empty', !text);
      sum.style.display = cb.checked ? '' : 'none';
    };
    cb.addEventListener('change', sync);
    if (sum) {
      ['address', 'apartment_number', 'city', 'state', 'zip'].forEach(function (n) {
        var el2 = document.querySelector('#frmAddEditRecord [name="' + n + '"]');
        if (el2) { el2.addEventListener('input', sync); el2.addEventListener('change', sync); }
      });
    }
    sync();
  }

  /* ONE WAY TO ADD ANYONE WHO IS NOT A PARENT.

     The tab offered "Add trusted contact" and "Add emergency contact": two buttons,
     two lists, the same four fields. The difference between them is what the person
     may do, and that is now the row of toggles on every card — May collect is what
     "trusted" meant, Emergency contact is what "emergency" meant, and the
     grandmother who is both is one person with two ticks instead of a person typed
     into two lists.

     So there is one button, and it adds a card in exactly the parents' format. What
     differs is only the defaults, because a parent and a car service start from
     different places:
       - no relationship is pre-chosen — the office says who this is;
       - nothing is granted — every permission is an explicit tick;
       - "Lives at the household address" starts UNticked. 688 of 688 is about
         parents; a grandmother or a babysitter usually lives somewhere else.

     Every input on these cards is PROTOTYPE-ONLY (no name, radios tied to a form
     that does not exist). They show the shape of a contact_links row plus its
     family_contacts row; they do not save. */
  var EXTRA_N = 0;

  function fld(label, type) {
    return '<div class="form-group"><label class="col-sm-3 control-label">' + label + '</label>' +
      '<div class="col-sm-4"><input type="' + (type || 'text') + '" class="form-control"></div></div>';
  }

  function msgRow(key) {
    return '<div class="tnd-msg-opts cm-msg">' +
      ['None', 'SMS', 'Voice', 'SMS & Voice'].map(function (t, i) {
        return '<label class="tnd-msg-opt"><input type="radio" form="cm-proto-none" name="cm-msg-' +
          key + '"' + (i === 0 ? ' checked' : '') + '><span>' + t + '</span></label>';
      }).join('') + '</div>';
  }

  function extraCard() {
    var n = ++EXTRA_N, key = 'extra' + n;
    var card = document.createElement('div');
    card.className = 'cm-person cm-extra';
    card.setAttribute('data-cm-extra', String(n));
    card.innerHTML =
      '<button type="button" class="cm-extra-remove">Remove</button>' +
      typeSelect('') +
      /* WHO THIS LINK REACHES — contact_links.child_id. Under a household found on
         file there are other children already, so a contact added here is either
         the family's (child_id NULL: every child, and a sibling enrolled later) or
         this child's alone (child_id set). Starts at THIS CHILD: reaching every
         child in a household is a grant, and grants are made deliberately. Not
         offered for a new family, where this child is the only one there is. */
      '<div class="cm-scope">' +
        '<div class="cm-plabel">Applies to</div>' +
        '<div class="cm-scope-opts">' +
          '<label><input type="radio" form="cm-proto-none" name="cm-scope-' + key + '" value="child" checked>' +
            '<span>This child only</span></label>' +
          '<label><input type="radio" form="cm-proto-none" name="cm-scope-' + key + '" value="family">' +
            '<span class="cm-scope-fam">' + scopeFamilyLabel() + '</span></label>' +
        '</div>' +
      '</div>' +
      '<div class="cm-plabel">What they may do</div>' + permToggles(key, true) +
      '<div class="cm-pgrid" data-part="name">' + fld('First Name') + fld('Last Name') + '</div>' +
      '<div class="cm-plabel">How to reach</div>' +
      '<div class="cm-pgrid" data-part="reach">' + fld('Phone', 'tel') + fld('Phone 2', 'tel') +
        fld('Email', 'email') + '</div>' +
      '<details class="cm-pmore cm-paddr"><summary>Address</summary>' +
        '<label class="cm-same"><input type="checkbox"><span>Lives at the household address</span></label>' +
        '<div class="cm-hsum"></div>' +
        '<div class="cm-pgrid" data-part="addr">' + fld('Address') + '</div></details>' +
      '<details class="cm-pmore"><summary>Work</summary>' +
        '<div class="cm-pgrid" data-part="work">' + fld('Occupation') + fld('Employer') +
        fld('Work Address') + '</div></details>';

    // The notification choice sits under the first phone, as it does for a parent.
    var phone = card.querySelector('[data-part="reach"] .form-group');
    phone.insertAdjacentHTML('beforeend', msgRow(key));

    var addr = card.querySelector('[data-part="addr"]');
    standardAddress(addr, addr.querySelector('.form-group'));
    var work = card.querySelector('[data-part="work"]');
    var workGroups = work.querySelectorAll('.form-group');
    standardAddress(work, workGroups[workGroups.length - 1], 'work');

    wireSame(card.querySelector('.cm-same'), addr, card.querySelector('.cm-hsum'));
    wirePerms(card);
    linkExisting(card);
    card.querySelector('.cm-extra-remove').addEventListener('click', function () {
      card.remove();
    });
    return card;
  }

  /* Shared with the Families page: the same contact card "+ Add contact" builds,
     and a reader for what was typed into it. One card, wherever a contact is added. */
  window.cmExtraCard = function () { return extraCard(); };
  window.cmCardValues = function (card) {
    var val = function (re) { var i = cardInput(card, re); return i ? i.value.trim() : ''; };
    var sel = card.querySelector('.cm-ptype select');
    return {
      type: sel ? sel.value : '',
      typeLabel: sel && sel.value ? sel.options[sel.selectedIndex].text : '',
      first: val(/^first name$/i), last: val(/^last name$/i),
      phone: val(/^phone$/i), email: val(/^email$/i)
    };
  };

  function wirePerms(card) {
    var boxes = {};
    card.querySelectorAll('.cm-perm input').forEach(function (b) {
      boxes[b.getAttribute('data-perm')] = b;
    });
    var main = boxes.main;
    if (!main) return;
    var note    = card.querySelector('.cm-permnote');
    /* The badge sits beside the relationship, not among the pills: "Father · Full
       permission" is the one-line answer to who this person is to the child. */
    var ptype = card.querySelector('.cm-ptype-row');
    if (note && ptype && note.parentNode !== ptype) ptype.appendChild(note);
    var collect = card.querySelector('.cm-collect');
    var range   = card.querySelector('.cm-collect-range');
    var ranged  = card.querySelector('.cm-collect-when input[value="range"]');

    function paint() {
      var locked = main.checked;
      Object.keys(boxes).forEach(function (k) {
        var b = boxes[k];
        b.parentNode.classList.toggle('on', b.checked);
        if (k === 'main') return;
        // Payment is offered ONLY to a main responsible adult: who owes the fees is
        // decided among the people responsible for the child, not the babysitter or
        // the car service. It is its own choice there — two main responsible parents
        // can genuinely differ on it — and it is off and out of sight otherwise.
        if (k === 'payer') {
          if (!locked) b.checked = false;
          b.parentNode.classList.toggle('on', b.checked);
          b.parentNode.style.display = locked ? '' : 'none';
          return;
        }
        // The other three are part of Main responsible, so while it is on they are
        // not offered — still ticked underneath, just not on screen.
        b.disabled = locked;
        b.parentNode.style.display = locked ? 'none' : '';
      });
      /* ONE BADGE, THREE STATES, beside the relationship:
           Full permission     Main responsible is on.
           Limited permission  not main, but notified or allowed to collect.
           No permission       neither — nothing ticked, or Emergency contact alone.
         Emergency contact counts as no permission on purpose: the field map calls
         is_emergency_contact "a label, not a right", and the old list said it
         outright — "Contact list only: grants no permission." */
      var state = locked ? 'full'
        : (boxes.notify.checked || boxes.collect.checked) ? 'limited' : 'none';
      note.hidden = false;
      note.className = 'cm-permnote ' + state;
      note.textContent = { full: 'Full permission', limited: 'Limited permission',
                           none: 'No permission' }[state];
      note.title = {
        full: 'Notifications, may collect and emergency contact are all on',
        limited: [boxes.notify.checked ? 'Notifications' : '', boxes.collect.checked ? 'May collect' : '',
                  boxes.emergency.checked ? 'Emergency contact' : ''].filter(Boolean).join(' · '),
        none: boxes.emergency.checked
          ? 'Emergency contact only: called, but grants nothing'
          : 'Nothing granted'
      }[state];
      collect.hidden = locked || !boxes.collect.checked;
      range.hidden = !ranged.checked;
    }

    // On: all four on (payment included, but it stays visible and can be unticked).
    // Off: all four off — nothing is carried over from Main responsible; each
    // permission the person keeps is ticked on purpose.
    main.addEventListener('change', function () {
      Object.keys(boxes).forEach(function (k) {
        if (k !== 'main') boxes[k].checked = main.checked;
      });
      paint();
    });
    Object.keys(boxes).forEach(function (k) {
      if (k !== 'main') boxes[k].addEventListener('change', paint);
    });
    card.querySelectorAll('.cm-collect-when input').forEach(function (r) {
      r.addEventListener('change', paint);
    });

    // Choosing a relationship applies the field map's defaults for it: a type that
    // stands in for a parent starts as Main responsible (full); any other type
    // starts with nothing granted. Only on a change — what a card opens with is
    // already right.
    var sel = card.querySelector('.cm-ptype select');
    if (sel) sel.addEventListener('change', function () {
      var full = STANDS_FOR_PARENT.indexOf(sel.value) > -1;
      if (main.checked !== full) {
        main.checked = full;
        main.dispatchEvent(new Event('change'));
      } else if (!full) {
        Object.keys(boxes).forEach(function (k) { boxes[k].checked = false; });
        paint();
      }
    });
    paint();
  }

  /* The caption sits above a ROW holding the dropdown and, beside it, the Full
     permission badge. Centring the badge against the dropdown only works if the
     two share a row of their own; aligning it against a label that also holds the
     caption lands it wherever the fonts put the label's edge. */
  function typeSelect(selected) {
    return '<div class="cm-ptype"><div class="cm-ptype-cap">Relationship to the child</div>' +
      '<div class="cm-ptype-row">' +
      '<select aria-label="Relationship to the child">' +
      (selected ? '' : '<option value="" selected disabled>Choose\u2026</option>') +
      CONTACT_TYPES.map(function (v) {
        return '<option value="' + v + '"' + (v === selected ? ' selected' : '') + '>' + typeLabel(v) + '</option>';
      }).join('') + '</select></div></div>';
  }

  /* Labels that lie once the household exists.

     reg_father_home_phone is the father's own number — the live one, 78% filled,
     the one the office actually dials. It was called "home phone" back when the
     child's row carried everything and there was nowhere else for a number to be.
     Now that the house has a phone of its own in the household block, two fields
     called "home phone" on one tab mean two different things. */
  /* AND THE ROLE COMES OFF THE LABEL.

     Every field in a parent card was captioned with the role — "Father's First
     Name", "Mother's Phone". The role is now a dropdown the office can change: a
     father can be corrected to a step-father, a mother to a legal guardian. A
     caption that repeats a value which is editable three inches above it goes
     stale the moment anyone uses that control.

     Inside a card the owner is not in doubt — the card IS the person — so the
     fields say what they are: First Name, Phone, Email. */
  var LABEL_FIX = {
    reg_father_home_phone:   'Phone',
    reg_mother_home_phone:   'Phone',
    // The design calls this one phone2: "a second number of any kind — work, cell,
    // a relative's". "Office" narrows it to the one use it is least often put to,
    // and the column it migrates from is 51% filled on the father, 0% on the mother.
    reg_father_office_phone: 'Phone 2',
    reg_mother_office_phone: 'Phone 2',
    // The household address in the same US postal shape as everyone else's. Labels
    // only: the inputs, their names and their columns are untouched.
    address:          'Address line 1',
    apartment_number: 'Address line 2 (apartment)',
    zip:              'ZIP code'
  };

  /* Strip a leading "Father" / "Mother" / "Father's" from the captions inside one
     card. It edits the first text node rather than textContent, so the required
     asterisk and anything else the label carries survive. */
  function stripRole(card, word) {
    var re = new RegExp('^\\s*' + word + "(?:['\u2019]s)?\\s+", 'i');
    card.querySelectorAll('label').forEach(function (lab) {
      if (lab.classList.contains('tnd-msg-opt') || lab.classList.contains('cm-perm') ||
          lab.classList.contains('cm-same') || lab.getAttribute('data-cm-role') === '1') return;
      var nodes = lab.childNodes;
      for (var i = 0; i < nodes.length; i++) {
        var t = nodes[i];
        if (t.nodeType !== 3 || !(t.nodeValue || '').trim()) continue;
        if (!re.test(t.nodeValue)) break;
        t.nodeValue = t.nodeValue.replace(re, '');
        lab.setAttribute('data-cm-role', '1');
        break;
      }
    });
  }

  function fixLabels() {
    var n = 0;
    Object.keys(LABEL_FIX).forEach(function (name) {
      var el2 = document.querySelector('#frmAddEditRecord [name="' + name + '"]');
      if (!el2) return;
      var g = group(el2);
      var lab = g ? g.querySelector('label') : null;
      if (!lab || lab.getAttribute('data-cm-label') === '1') return;
      lab.setAttribute('data-cm-label', '1');
      lab.textContent = LABEL_FIX[name];
      n++;
    });
    return n;
  }

  /* The contacts panel is the tab's, not a person's. The sweep that pulls a parent's
     leftover groups was catching it, so it ended up inside the Father's "Old
     columns" fold — a list of the household's people, filed under a column that is
     being removed. */
  function rescuePanel() {
    var panel = document.querySelector('.pc-panel');
    if (!panel) return 0;
    var fam = sectionByHead('family');
    if (!fam) return 0;
    var host = fam.querySelector('.vB-editcard') || fam;
    if (panel.parentNode === host) return 0;
    var others = host.querySelector('.cm-others');
    if (others) host.insertBefore(panel, others);
    else host.appendChild(panel);
    return 1;
  }

  function personCards() {
    var fam = sectionByHead('family');
    if (!fam) return 0;
    var famCard = fam.querySelector('.vB-editcard') || fam;
    var made = 0;

    [['father', 'Father'], ['mother', 'Mother']].forEach(function (who) {
      if (famCard.querySelector('.cm-person[data-cm-parent="' + who[0] + '"]')) return;

      var card = document.createElement('div');
      card.className = 'cm-person';
      card.setAttribute('data-cm-parent', who[0]);
      /* THE HEADER SAID WHAT THE DROPDOWN SAYS.

         The card carried a fixed "Father" heading and, directly under it, a select
         whose value was Father. Two claims about the same thing, and only one of
         them can be changed — so the fixed one had to go. The dropdown is the
         header now: it names the person's relationship to the child AND is the
         control that sets it, which is the point of B8 (a parent is a contact whose
         type happens to be father). */
      card.innerHTML = typeSelect(who[0]) +
        PERSON_PARTS.map(function (part) {
          return part.key === 'work'
            ? '<details class="cm-pmore"><summary>' + part.label + '</summary>' +
              '<div class="cm-pgrid" data-part="work"></div></details>'
            : part.key === 'addr'
            ? '<details class="cm-pmore cm-paddr"><summary>Address</summary>' +
              '<div class="cm-pgrid" data-part="addr"></div></details>'
            : part.key === 'perms'
            ? '<div class="cm-plabel">' + part.label + '</div>' + permToggles(who[0]) +
              '<div data-part="perms" hidden></div>'
            : part.key === 'legacy'
            ? '<details class="cm-pmore cm-plegacy"><summary>' + part.label +
              '<em>the ones the migration removes</em></summary>' +
              '<div class="cm-pgrid" data-part="legacy"></div></details>'
            : (part.label ? '<div class="cm-plabel">' + part.label + '</div>' : '') +
              '<div class="cm-pgrid" data-part="' + part.key + '"></div>';
        }).join('');

      var moved = 0;
      PERSON_PARTS.forEach(function (part) {
        var bucket = card.querySelector('[data-part="' + part.key + '"]');
        // The legacy children.* column first: it is the one the old form showed, so
        // it keeps the top of the group and the reg_* value sits under it.
        (part.legacy || []).forEach(function (suffix) {
          var el3 = document.querySelector('#frmAddEditRecord [name="' + who[0] + suffix + '"]');
          if (!el3) return;
          var g3 = group(el3);
          if (!g3) return;
          g3.setAttribute('data-cm-moved', '1');
          bucket.appendChild(g3);
          moved++;
        });
        part.fields.forEach(function (suffix) {
          var el2 = document.querySelector('#frmAddEditRecord [name="reg_' + who[0] + '_' + suffix + '"]');
          if (!el2) return;
          var g = group(el2);
          if (!g) return;
          g.setAttribute('data-cm-moved', '1');
          bucket.appendChild(g);
          moved++;
        });
      });
      if (!moved) return;

      /* SAME ADDRESS AS THE HOUSEHOLD, ticked by default.

         father_address and mother_address are identical in 688 of 688 rows. They are
         not two facts about two people; they are the home, typed twice because the
         form offered two boxes. A blank address field next to a parent's name is an
         instruction to fill it, and filling it is how that duplication was made.

         So the box is ticked and the field is out of sight. Unticking it is the
         explicit statement "this person lives somewhere else" — a separated father,
         a grandmother at her own place — which is the only case the column was ever
         needed for. */
      /* THE NOTIFICATION CHOICE FOLLOWS THE PHONE IT CONTROLS.

         None / SMS / Voice / SMS & Voice belongs to children.father_phone, which is
         a legacy column filled on 3% of rows. The number people actually dial is
         reg_father_home_phone at 78%. So the setting sat on a phone nobody uses
         while the live one had no setting at all — which is exactly what the impact
         analysis found at the database level: "the settings and the numbers they
         control are in different tables, and the settings are off".

         The control moves to the primary phone. It is the same input, so it still
         posts use_father_phone_for_notification and the method. */
      var opts = card.querySelector('[data-part="legacy"] .tnd-msg-opts');
      var primary = card.querySelector('[name="reg_' + who[0] + '_home_phone"]');
      var pg = primary ? group(primary) : null;
      if (opts && pg) {
        opts.setAttribute('data-cm-moved', '1');
        pg.appendChild(opts);
      }

      wirePerms(card);
      linkExisting(card);

      var addrBucket = card.querySelector('[data-part="addr"]');
      if (addrBucket) {
        var same = document.createElement('label');
        same.className = 'cm-same';
        same.innerHTML = '<input type="checkbox" checked>' +
          '<span>Lives at the household address</span>';
        addrBucket.parentNode.insertBefore(same, addrBucket);
        var sum = document.createElement('div');
        sum.className = 'cm-hsum';
        addrBucket.parentNode.insertBefore(sum, addrBucket);
        wireSame(same, addrBucket, sum);
      }

      // The old sub-heading is gone: the card's own header says it now.
      document.querySelectorAll('#frmAddEditRecord .tnd-subhead').forEach(function (h) {
        var t = (h.textContent || '').toLowerCase();
        if (t.indexOf('parent') > -1 && t.indexOf(who[0]) > -1) h.remove();
      });

      famCard.appendChild(card);
      made++;

      /* SWEEP WHAT IS LEFT. The form renders more than one group per person — a
         value row and its channel row, for instance — so moving by field name alone
         left "Father phone" both inside the card and loose above it. Anything still
         sitting directly in the tab whose label starts with this parent's name
         belongs in this parent's card. */
      var re = new RegExp('^' + who[1] + "(['\u2019]s)?\\b", 'i');
      var spare = card.querySelector('[data-part="legacy"]');
      Array.prototype.slice.call(famCard.children).forEach(function (g4) {
        if (!g4.classList || !g4.classList.contains('form-group')) return;
        var lab = g4.querySelector('label');
        if (!lab || !re.test((lab.textContent || '').trim())) return;
        g4.setAttribute('data-cm-moved', '1');
        spare.appendChild(g4);
      });

      stripRole(card, who[1]);

      // Both of a person's addresses take the household's shape.
      var ownAddr = card.querySelector('[data-part="addr"] [name="reg_' + who[0] + '_address"]');
      if (ownAddr) standardAddress(card.querySelector('[data-part="addr"]'), group(ownAddr));
      var workAddr = card.querySelector('[data-part="work"] [name="reg_' + who[0] + '_work_address"]');
      if (workAddr) standardAddress(card.querySelector('[data-part="work"]'), group(workAddr), 'work');
    });
    return made;
  }

  /* THE PEDIATRICIAN IS A CONTACT, NOT THREE BOXES OF TEXT.

     570 children name a pediatrician; there are 36 of them. "Dr. Lane" and
     "lane" are one man typed 308 times. That is what free text produces, and it
     is the clearest case for C1: link before create. So Health gets the same card
     a family contact has — relationship (pediatrician), permissions, and above all
     Link existing contact, which searches the people on file and turns the card
     into a linked summary. It is the same record the household checklist shows,
     so a doctor linked here is the doctor linked there.

     The three free-text columns stay, inside the card under Old columns: hidden
     with the annotations, still posting. Linking a doctor writes their name, phone
     and address into them, and Unlink puts back what was there — the registration
     PDF reads those columns until the migration moves it (§4). */
  function pediatricianCard() {
    var nameIn = document.querySelector('#frmAddEditRecord [name="reg_pediatrician_name"]');
    var g0 = nameIn ? group(nameIn) : null;
    if (!g0 || !g0.parentNode || document.querySelector('.cm-pedi')) return 0;
    var host = g0.parentNode;

    var wrap = document.createElement('div');
    wrap.className = 'cm-others cm-pedi';
    wrap.innerHTML = '<div class="cm-personhead">Pediatrician' +
      '<span class="cm-tag" style="position:static;margin-left:8px">to contact_links</span></div>';
    host.insertBefore(wrap, g0);

    var card = extraCard();
    card.classList.add('cm-pedicard');
    var rm = card.querySelector('.cm-extra-remove');
    if (rm) rm.remove();
    wrap.appendChild(card);
    var sel = card.querySelector('.cm-ptype select');
    if (sel) { sel.value = 'pediatrician'; sel.dispatchEvent(new Event('change')); }

    var legacy = document.createElement('details');
    legacy.className = 'cm-pmore cm-plegacy';
    legacy.innerHTML = '<summary>Old columns<em>the ones the migration removes</em></summary>' +
      '<div class="cm-pgrid"></div>';
    card.appendChild(legacy);
    var cols = ['reg_pediatrician_name', 'reg_pediatrician_phone', 'reg_pediatrician_address'];
    cols.forEach(function (n2) {
      var e2 = document.querySelector('#frmAddEditRecord [name="' + n2 + '"]');
      var g2 = e2 ? group(e2) : null;
      if (!g2) return;
      g2.setAttribute('data-cm-moved', '1');
      legacy.querySelector('.cm-pgrid').appendChild(g2);
    });

    var before = null;
    var col = function (n2) { return document.querySelector('#frmAddEditRecord [name="' + n2 + '"]'); };

    // The card opens with what the child already has on file — typed, not yet
    // linked — so the office sees "Dr. Lane" and can link him to the record.
    var typed = (col('reg_pediatrician_name') || {}).value || '';
    var bits = typed.trim().split(/\s+/).filter(Boolean);
    var lastBit = bits.length > 1 ? bits.pop() : '';
    setVal(cardInput(card, /^first name$/i), bits.join(' '));
    setVal(cardInput(card, /^last name$/i), lastBit);
    setVal(cardInput(card, /^phone$/i), (col('reg_pediatrician_phone') || {}).value || '');
    setVal(cardInput(card, /^address line 1$/i), (col('reg_pediatrician_address') || {}).value || '');
    card.addEventListener('cm-linked', function (e) {
      var p2 = e.detail || {};
      before = cols.map(function (n2) { return col(n2) ? col(n2).value : ''; });
      setVal(col('reg_pediatrician_name'), p2.n || '');
      setVal(col('reg_pediatrician_phone'), p2.p || '');
      setVal(col('reg_pediatrician_address'), String(p2.a || '').replace(/,?\s*USA$/i, ''));
    });
    card.addEventListener('cm-unlinked', function () {
      if (!before) return;
      cols.forEach(function (n2, i) { setVal(col(n2), before[i]); });
    });
    return 1;
  }

  function relocateMedical() {
    var n = 0;
    n += renameHead('therapy', 'Health');
    n += renameHead('registration form details', 'Enrollment');
    n += renameHead('parents details', 'Family');
    n += renameHead('contact assignment overrides', 'Assigned Staff');
    n += renameHead('privileges', 'Billing');

    n += householdBlock();
    n += personCards();
    n += fixLabels();
    n += rescuePanel();
    n += otherContacts();
    n += reachability();
    n += householdLegacy();
    n += gatePanel();

    var target = sectionByHead('health');
    if (target) {
      var card = target.querySelector('.vB-editcard') || target;
      TO_HEALTH.forEach(function (name) {
        var el2 = document.querySelector('[name="' + name + '"]');
        if (!el2) return;
        var g = group(el2);
        if (!g || g.getAttribute('data-cm-moved') === '1' || card.contains(g)) return;
        g.setAttribute('data-cm-moved', '1');
        card.appendChild(g);
        var tag = g.querySelector('.cm-tag');
        if (tag) tag.textContent = 'moved here';
        else mark(g, 'cm-move', 'moved here');
        n++;
      });
    }

    // The paper form is an ACTION now, not a place data lives. The real button is
    // moved here rather than redrawn, so it still generates the real PDF.
    var enr = sectionByHead('enrollment');
    if (enr && !enr.querySelector('.cm-actions')) {
      var box = document.createElement('div');
      box.className = 'cm-actions';
      box.innerHTML = '<b>The registration form</b>' +
        '<div class="cm-actrow"></div>';
      var host = enr.querySelector('.vB-editcard') || enr;
      host.insertBefore(box, host.firstChild);
      var row = box.querySelector('.cm-actrow');

      var real = null, btns = document.querySelectorAll('#frmAddEditRecord button, #frmAddEditRecord a');
      for (var i = 0; i < btns.length; i++) {
        if (/generate registration pdf/i.test(btns[i].textContent || '')) { real = btns[i]; break; }
      }
      if (real) { row.appendChild(real); }
      var share = document.createElement('button');
      share.type = 'button';
      share.className = 'cm-share';
      share.textContent = 'Share enrolment with the family';
      row.appendChild(share);
      n++;
    }
    return n;
  }

  /* Tab ORDER, which is also what fixes the strip wrapping onto a lonely third
     line. The order follows the child's lifecycle rather than the order the
     sections happened to be written in: who they are, whose they are, how they got
     here, how they are cared for, how they travel, what it costs, who handles it.
     Billing sits sixth, so a 4/3 wrap keeps it on the second line with the rest. */
  var ORDER = ['Details', 'Family', 'Enrollment', 'Health',
               'Transportation', 'Billing'];

  function reorder() {
    var n = 0;

    // Every strip that holds these buttons — the drawer has one for reading and
    // one for editing, and both must agree.
    var strips = [];
    document.querySelectorAll('button').forEach(function (b) {
      if (ORDER.indexOf((b.textContent || '').trim()) < 0) return;
      var p = b.parentElement;
      if (p && strips.indexOf(p) < 0) strips.push(p);
    });
    strips.forEach(function (strip) {
      if (strip.getAttribute('data-cm-order') === '1') return;
      var found = {};
      Array.prototype.forEach.call(strip.children, function (c) {
        var t = (c.textContent || '').trim();
        if (ORDER.indexOf(t) > -1 && !found[t]) found[t] = c;
      });
      if (Object.keys(found).length < ORDER.length) return;   // not a full strip
      strip.setAttribute('data-cm-order', '1');
      ORDER.forEach(function (t) { strip.appendChild(found[t]); });
      n++;
    });

    // The sections themselves, so scrolling matches the strip.
    var form = document.querySelector('#frmAddEditRecord');
    if (form && form.getAttribute('data-cm-order') !== '1') {
      var secs = {}, all = 0;
      ORDER.forEach(function (t) {
        var s = sectionByHead(t.toLowerCase());
        if (s) { secs[t] = s; all++; }
      });
      if (all === ORDER.length) {
        form.setAttribute('data-cm-order', '1');
        ORDER.forEach(function (t) { form.appendChild(secs[t]); });
        n++;
      }
    }
    return n;
  }

  /* A child on the waiting list has no enrolment yet, so the enrolment fields are
     noise on their record. The toggle already exists and already drives
     children.enrollment_status; this makes the tab follow it. */
  // Kept out of sight while the child is queued, not taken out of the form.
  var STAGE_HIDDEN = ['Health', 'Transportation', 'Billing'];

  /* PICKUP AND DROP-OFF POINTS: THE REGISTERED ADDRESS BY DEFAULT, ANOTHER ONE
     IN THE SAME SHAPE AS EVERY OTHER ADDRESS.

     Each point was one free-text box, "Pickup point (if not home)", left blank to
     mean home. A blank box does not SAY home; it says nothing, and the office has
     to know the convention to read it. So each point now reads like "Lives at the
     household address": a tick, "Registered address", ticked by default, with the
     household address written under it — the actual address the bus goes to.
     Unticking opens the address in the US postal shape of B14.

     The existing input becomes Address line 1 and keeps its id, so the app's
     Google Places binding, its lat/lng and its column (pickup_address /
     dropoff_address) still work. Ticking "Registered address" empties it — which
     is exactly what "use home" meant before — and unticking puts back what was
     there. Line 2, city, state and ZIP are prototype-only: they post nothing. */
  function transportPoint(kind) {
    var input = document.querySelector('#frmAddEditRecord [name="' + kind + '_point_address"]');
    // The mark goes on the INPUT: it moves into a new "Address line 1" group below,
    // so a mark on its old group would not be found next pass and the point would
    // be rebuilt around itself, over and over.
    if (!input || input.getAttribute('data-cm-point') === '1') return 0;
    var g = group(input);
    if (!g) return 0;
    input.setAttribute('data-cm-point', '1');
    g.setAttribute('data-cm-point', '1');
    g.classList.add('cm-tpoint');
    var lat = document.querySelector('#frmAddEditRecord [name="' + kind + '_point_latitude"]');
    var lng = document.querySelector('#frmAddEditRecord [name="' + kind + '_point_longitude"]');
    var col = input.parentNode;
    var help = col.querySelector('.help-block');
    if (help) help.remove();
    // "Leave blank to use home address" is the convention the tick replaces. The
    // app keeps a copy in data-ph and restores it, so both are emptied.
    input.setAttribute('placeholder', '');
    input.setAttribute('data-ph', '');

    var lab = g.querySelector('label');
    if (lab) { lab.textContent = kind === 'pickup' ? 'Pickup point' : 'Drop-off point'; lab.className = 'cm-plabel'; }

    var same = document.createElement('label');
    same.className = 'cm-same';
    same.innerHTML = '<input type="checkbox"' + (input.value.trim() ? '' : ' checked') + '>' +
      '<span>Registered address</span>';
    var sum = document.createElement('div');
    sum.className = 'cm-hsum';
    var grid = document.createElement('div');
    grid.className = 'cm-pgrid';
    var line1 = document.createElement('div');
    line1.className = 'form-group';
    line1.innerHTML = '<label class="col-sm-3 control-label">Address line 1</label>';
    line1.appendChild(col);
    grid.appendChild(line1);
    g.appendChild(same);
    g.appendChild(sum);
    g.appendChild(grid);
    standardAddress(grid, line1, 'home');

    var saved = null;
    same.querySelector('input').addEventListener('change', function () {
      if (this.checked) {
        saved = [input.value, lat ? lat.value : '', lng ? lng.value : ''];
        input.value = ''; if (lat) lat.value = ''; if (lng) lng.value = '';
      } else if (saved) {
        input.value = saved[0]; if (lat) lat.value = saved[1]; if (lng) lng.value = saved[2];
      }
    });
    wireSame(same, grid, sum);
    return 1;
  }

  /* REGISTERING A FAMILY, CHILD BY CHILD, IN THE REGULAR CHILD PANEL.

     Started from the Families page's "New family" panel, which leaves a plan in
     sessionStorage: how many children, and enrollment or waiting list for each.
     Each child is the app's own New child form in the side panel, with three
     changes:
       - across the top, one tile per child — outlined for the current one, filled
         once done — from the first child to the end;
       - Save becomes Back / Next (Finish on the last child): moving between
         children keeps what was typed;
       - each child after the first starts from the family and from what the
         previous child had in common — parents, address, last name, branch,
         dates, tuition — so only what differs is typed: first name, birth date,
         class. The enrollment / waiting-list switch is set from the plan.
     Finish ends it with "Welcome to the X family" and the children registered.
     Prototype: moving on does not post the form; nothing is written. */
  var REG_SHARED = /^(lname|address|apartment_number|city|state|zip|latitude|longitude|home_phone|father_name|mother_name|father_phone|mother_phone|parent_email|branches|start_date|hra_acs|preferred_branch_id|anticipated_start|employee_type|voucher|transportation|reg_father_.*|reg_mother_.*|use_(father|mother)_phone_for_notification|notification_(father|mother)_phone_method)$/;
  var REG_HIDDEN_OK = /^(latitude|longitude)$/;

  function regPlan() {
    try {
      var p = JSON.parse(sessionStorage.getItem('cm-reg') || 'null');
      if (p && Date.now() - (p.at || 0) < 3600000) return p;
    } catch (e) {}
    return null;
  }
  function regSave(p) { try { sessionStorage.setItem('cm-reg', JSON.stringify(p)); } catch (e) {} }
  function regClear() { try { sessionStorage.removeItem('cm-reg'); } catch (e) {} }

  var REG_SVG = {
    kid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M5.5 20a7 7 0 0 1 13 0"></path></svg>',
    wait: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 7h11"></path><path d="M6.5 17h11"></path><path d="M6 20v-2a6 6 0 1 1 12 0v2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z"></path><path d="M6 4v2a6 6 0 1 0 12 0V4a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"></path></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"></path><path d="M5 21V8l7-5 7 5v13"></path><path d="M9 21v-5h6v5"></path></svg>'
  };

  function regSnapshot(form) {
    var fd = new FormData(form), entries = [];
    fd.forEach(function (v, k) { if (typeof v === 'string') entries.push([k, v]); });
    var cls = form.querySelector('[name="class"]');
    return {
      entries: entries,
      fname: ((form.querySelector('[name="fname"]') || {}).value || '').trim(),
      lname: ((form.querySelector('[name="lname"]') || {}).value || '').trim(),
      cls: cls && cls.selectedIndex > 0 ? cls.options[cls.selectedIndex].text : '',
      fam: FAMILY_MODE === 'existing' && PICKED_FAMILY ? { n: PICKED_FAMILY.n, a: PICKED_FAMILY.a } : null,
      father: ((form.querySelector('[name="reg_father_lname"]') || {}).value || '').trim()
    };
  }

  function regRestore(form, entries, onlyShared) {
    var byName = {};
    entries.forEach(function (e) { if (!onlyShared || REG_SHARED.test(e[0])) (byName[e[0]] = byName[e[0]] || []).push(e[1]); });
    var $ = window.jQuery;
    var fire = function (el) { if ($) $(el).trigger('change'); else el.dispatchEvent(new Event('change', { bubbles: true })); };
    var put = function (names) {
      names.forEach(function (name) {
        var vals = byName[name];
        form.querySelectorAll('[name="' + name.replace(/"/g, '\\"') + '"]').forEach(function (el) {
          if (el.type === 'file') return;
          if (el.type === 'hidden' && !REG_HIDDEN_OK.test(name)) return;
          if (el.type === 'checkbox' || el.type === 'radio') {
            var want = vals.indexOf(el.value) > -1;
            if (el.checked !== want) { el.checked = want; fire(el); }
          } else if (el.tagName === 'SELECT' && el.multiple) {
            Array.prototype.forEach.call(el.options, function (o) { o.selected = vals.indexOf(o.value) > -1; });
            fire(el);
          } else if (el.value !== vals[0]) {
            el.value = vals[0];
            fire(el);
          }
        });
      });
    };
    put(Object.keys(byName).filter(function (n) { return n !== 'class'; }));
    // A class list loads after its branch, so it is set once the branch has answered.
    if (byName['class']) setTimeout(function () { put(['class']); }, 900);
  }

  /* The children, small, in the panel's own head row — between its title and its
     buttons. Each is a tiny tile (person or hourglass) and its number; the name
     is in the tooltip once typed. More children than fit become a carousel with
     arrows, scrolled so the current child is always in view. */
  function regTrack(items, cur) {
    return '<button type="button" class="reg-nav" data-d="-1" aria-label="Earlier children">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"></path></svg></button>' +
      '<div class="reg-track">' + items.map(function (it, i) {
        var st = i === cur ? 'on' : (i < cur ? 'done' : '');
        // Every child is the same purple person tile; enrollment or waiting list is
        // said by the choice and the tooltip, not by a different colour or glyph.
        // No number: the tile alone, a little larger. "Child 2 · Clara · Enrollment"
        // is in the tooltip and the accessible name.
        var label = 'Child ' + (i + 1) + ' \u00b7 ' + it.title;
        return '<span class="reg-pi ' + st + '" title="' + esc(label) + '" aria-label="' + esc(label) + '">' +
          '<span class="reg-tile">' + REG_SVG.kid + '</span></span>';
      }).join('') + '</div>' +
      '<button type="button" class="reg-nav" data-d="1" aria-label="Later children">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"></path></svg></button>';
  }
  window.cmRegTrack = function (host, items, cur) {
    host.innerHTML = regTrack(items, cur);
    var track = host.querySelector('.reg-track');
    var navs = host.querySelectorAll('.reg-nav');
    var sync = function () {
      var over = track.scrollWidth > track.clientWidth + 2;
      host.classList.toggle('is-carousel', over);
      navs[0].disabled = track.scrollLeft <= 1;
      navs[1].disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 1;
    };
    navs.forEach(function (b) {
      b.addEventListener('click', function () { track.scrollBy({ left: +b.getAttribute('data-d') * 96, behavior: 'smooth' }); });
    });
    track.addEventListener('scroll', sync);
    // Bring the current child into view — measured against the track itself (it is
    // position:relative), and again once the panel has finished sliding in, because
    // a width measured mid-animation put child 1 out of sight.
    var centre = function () {
      var on = track.querySelector('.reg-pi.on');
      if (!on) { track.scrollLeft = cur < 0 ? track.scrollWidth : 0; sync(); return; }
      var left = on.offsetLeft, right = left + on.offsetWidth;
      if (left < track.scrollLeft || right > track.scrollLeft + track.clientWidth) {
        track.scrollLeft = Math.max(0, left - (track.clientWidth - on.offsetWidth) / 2);
      }
      sync();
    };
    requestAnimationFrame(centre);
    setTimeout(centre, 150);
    setTimeout(centre, 450);
  };

  function regStrip(plan) {
    var pane = document.getElementById('tndDrawer');
    if (!pane) return;
    var head = pane.querySelector('.tnd-pane-head');
    var strip = head.querySelector('.reg-strip');
    if (!strip) {
      strip = document.createElement('div');
      strip.className = 'reg-strip';
      var eb = head.querySelector('.up-head-eyebrow');
      head.insertBefore(strip, eb ? eb.nextSibling : head.firstChild);
    }
    window.cmRegTrack(strip, plan.kids.map(function (k, i) {
      var snap = plan.snaps[i];
      return { w: k.m === 'wait', title: (snap && snap.fname ? snap.fname + ' · ' : '') + (k.m === 'wait' ? 'Waiting list' : 'Enrollment') };
    }), plan.cur);
  }

  function regButtons(plan, form) {
    var pane = document.getElementById('tndDrawer');
    var acts = pane && pane.querySelector('.tnd-pane-head-actions');
    if (!acts) return;
    pane.classList.add('reg-active');
    acts.querySelectorAll('.reg-btn').forEach(function (b) { b.remove(); });
    var last = plan.cur === plan.kids.length - 1;
    var close = acts.querySelector('.tnd-pane-close');
    // RETURN, not Cancel: one child back — and from the first child, back to the
    // screen where the number of children and their choices are set. The drawer's
    // own Cancel is hidden while a family is being registered; × still leaves.
    var back = document.createElement('button');
    back.type = 'button'; back.className = 'btn-sm reg-btn reg-back'; back.textContent = 'Return';
    acts.insertBefore(back, close);
    back.addEventListener('click', function () { regMove(-1); });
    var next = document.createElement('button');
    next.type = 'button'; next.className = 'btn-sm primary reg-btn reg-next';
    next.textContent = last ? 'Finish' : 'Next';
    acts.insertBefore(next, close);
    next.addEventListener('click', function () { regMove(1); });
  }

  function regReopen(plan) {
    var snap = plan.snaps[plan.cur], prev = plan.snaps[plan.cur - 1];
    var fam = (snap && snap.fam) || (prev && prev.fam);
    try {
      sessionStorage.setItem('cm-add-family', JSON.stringify(fam ? { n: fam.n, a: fam.a } : { mode: 'new' }));
    } catch (e) {}
    if (window.TndListDrawer) window.TndListDrawer.open('children/add', 'Add child');
  }

  function regMove(dir) {
    var plan = regPlan(), form = document.querySelector('#tndDrawer #frmAddEditRecord');
    if (!plan || !form) return;
    var snap = regSnapshot(form);
    if (dir > 0 && !snap.fname) {
      if (window.tndToast) window.tndToast.error('Enter the child’s first name.');
      var f = form.querySelector('[name="fname"]'); if (f) f.focus();
      return;
    }
    plan.snaps[plan.cur] = snap;
    if (dir > 0 && plan.cur === plan.kids.length - 1) { regSave(plan); regWelcome(plan); return; }
    if (dir < 0 && plan.cur === 0) {
      // Back to the first screen, keeping what was typed for the children that stay.
      // The first screen opens on top, already in place, and the child panel closes unseen
      // under it: no slide out and back in.
      regSave(plan);
      var dr = document.getElementById('tndDrawer'), sc = document.getElementById('tndDrawerScrim');
      var still = [dr, sc].filter(Boolean);
      if (window.cmOpenFamilySetup) window.cmOpenFamilySetup(plan, { instant: true });
      still.forEach(function (el) { el.style.transition = 'none'; });
      if (window.TndListDrawer) window.TndListDrawer.close(true);
      regTidy();
      setTimeout(function () { still.forEach(function (el) { el.style.transition = ''; }); }, 50);
      return;
    }
    plan.cur += dir;
    regSave(plan);
    regReopen(plan);
  }

  function regWelcome(plan) {
    var pane = document.getElementById('tndDrawer'), body = document.getElementById('tndDrawerBody');
    if (!pane || !body) return;
    plan.cur = plan.kids.length;
    regStrip(plan);
    var s0 = plan.snaps[0] || {};
    var name = (s0.fam && s0.fam.n) || s0.father || s0.lname || '';
    var eb = pane.querySelector('.up-head-eyebrow');
    if (eb) eb.textContent = 'Registration complete';
    var acts = pane.querySelector('.tnd-pane-head-actions');
    acts.querySelectorAll('button:not(.tnd-pane-close)').forEach(function (b) { b.style.display = 'none'; });
    var done = document.createElement('button');
    done.type = 'button'; done.className = 'btn-sm primary reg-btn'; done.textContent = 'Done';
    acts.insertBefore(done, acts.querySelector('.tnd-pane-close'));
    done.addEventListener('click', function () {
      regClear();
      if (window.TndListDrawer) window.TndListDrawer.close(true);
      setTimeout(regTidy, 250);
    });
    Array.prototype.forEach.call(body.children, function (c) { c.style.display = 'none'; });
    var w = document.createElement('div');
    // Not .tnd-pane-view: the drawer hides that container while it is editing.
    w.className = 'reg-welcome';
    w.innerHTML =
      '<div class="reg-wtop"><span class="reg-tile big">' + REG_SVG.home + '</span>' +
      '<h2>Welcome to the ' + esc(name) + ' family</h2>' +
      '<p>' + plan.kids.length + (plan.kids.length === 1 ? ' child' : ' children') + ' registered</p></div>' +
      '<section class="vB-group"><h3 class="vB-group-label">Children</h3><div class="vB-list">' +
      plan.kids.map(function (k, i) {
        var sn = plan.snaps[i] || {};
        var what = k.m === 'wait' ? 'Waiting list' : 'Enrolled' + (sn.cls ? ' · ' + sn.cls : '');
        return '<div class="vB-row"><span class="vB-row-ico" aria-hidden="true">' + REG_SVG.kid +
          '</span><span class="vB-row-body"><span class="vB-row-label">' + esc(what) + '</span>' +
          '<span class="vB-row-value">' + esc([sn.fname, sn.lname].filter(Boolean).join(' ') || 'Child ' + (i + 1)) + '</span></span></div>';
      }).join('') + '</div></section>';
    body.appendChild(w);
    regClear();
  }

  function regTidy() {
    var pn = document.getElementById('tndDrawer');
    if (!pn) return;
    pn.classList.remove('reg-active');
    var st = pn.querySelector('.reg-strip');
    if (st) st.remove();
    pn.querySelectorAll('.reg-btn').forEach(function (b) { b.remove(); });
    // The welcome hid the drawer's own head buttons; give them back.
    pn.querySelectorAll('.tnd-pane-head-actions button').forEach(function (b) {
      if (b.style.display === 'none') b.style.display = '';
    });
  }

  // Runs on every pass; acts once per loaded New child form while a plan is live.
  // With no plan, any strip or Back/Next left from an earlier family is taken away,
  // so an ordinary New child panel is exactly the app's own.
  function regFlow() {
    var plan = regPlan();
    var form = document.querySelector('#tndDrawer #frmAddEditRecord');
    if (!plan) {
      var pn0 = document.getElementById('tndDrawer');
      if (pn0 && pn0.classList.contains('reg-active') && !pn0.querySelector('.reg-welcome')) regTidy();
      return 0;
    }
    if (!form || form.getAttribute('data-cm-reg') === '1') return 0;
    if (!/children\/save\/?$/.test(form.getAttribute('action') || '')) return 0;
    form.setAttribute('data-cm-reg', '1');
    regStrip(plan);
    regButtons(plan, form);
    var kid = plan.kids[plan.cur];
    setTimeout(function () {
      var mine = plan.snaps[plan.cur], prev = plan.snaps[plan.cur - 1];
      if (mine) regRestore(form, mine.entries, false);           // back to a child already typed
      else if (prev) regRestore(form, prev.entries, true);       // a new child: what the family shares
      var wl = form.querySelector('[name="is_waitlist"]');
      if (wl && wl.checked !== (kid.m === 'wait')) wl.click();
      var fn = form.querySelector('[name="fname"]');
      if (fn && !mine) fn.focus();
    }, 450);
    return 1;
  }

  // Leaving the panel mid-way ends the plan, so the next New child is a plain one.
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('#tndDrawerClose, #tndDrawerCancel, #tndDrawerScrim') : null;
    if (t && regPlan() && !(e.target.closest('.reg-welcome'))) regClear();
    if (t) setTimeout(regTidy, 250);
  }, true);

  /* THE ADD-CHILD PAGE IS NOT THE DRAWER. It is one long form of fieldsets, not
     tabbed sections, so none of the stage rules above reached it: a child being
     added TO THE WAITING LIST was still asked for their staff contacts, therapy,
     transportation and billing — for a child who has no branch, no class and no
     enrolment yet. The same rule, applied to its fieldsets by heading:
       waiting  → the waiting-list fieldset, plus Details and Parents; not the
                  staff overrides, therapy/health, transportation, billing
       enrolled → everything but the waiting-list fieldset.
     Hidden, never removed: every input still posts. */
  var ADD_WAIT_HIDES = ['therapy', 'health', 'transportation', 'contact assignment overrides',
                        'assigned staff', 'privileges', 'billing'];

  function stageFieldsets(waiting) {
    document.querySelectorAll('#frmAddEditRecord fieldset').forEach(function (fs) {
      if (fs.closest('section.vB-group')) return;      // the drawer handles its own
      if (fs.getAttribute('data-cm-folded') === '1') return;  // folded into Enrollment
      if (!fs.querySelector('.form-group')) return;           // emptied (staff moved out)
      var h = fs.querySelector('legend,h1,h2,h3,h4,h5');
      var t = h ? (h.textContent || '').trim().toLowerCase() : '';
      if (!t) return;
      var want = '';
      if (t.indexOf('wait list') === 0 || t.indexOf('waitlist') === 0) want = waiting ? '' : 'none';
      else if (ADD_WAIT_HIDES.some(function (x) { return t.indexOf(x) === 0; })) want = waiting ? 'none' : '';
      else return;
      if (fs.style.display !== want) fs.style.display = want;
    });
  }

  /* SIBLINGS: FROM THE FAMILY, NOT FROM MEMORY.

     waiting_list.sibling is a free-text box asking the office "any siblings here?"
     — exactly the question family_id answers. So the field becomes a list:

       household known  → its other children, each with where they are now:
                          "Enrolled · Kindergarten Girls" or "Waiting list".
                          Known means a family picked on the Family tab, or —
                          until then — the household this child already matches
                          by surname + address, the rule families.json uses.
       anything else    → "Link a sibling" searches the children on file, enrolled
                          or waiting, and adds the one picked, with the same status.

     The free-text input stays in the form, hidden, and posts: it holds what was
     typed before, and linking or removing a sibling writes the names shown into it,
     so the column still says something true until the migration replaces it with
     the family link. */
  function siblingHousehold() {
    if (FAMILY_PICKED && PICKED_FAMILY) return { n: PICKED_FAMILY.n, a: PICKED_FAMILY.a, how: 'picked' };
    var f = document.querySelector('#frmAddEditRecord');
    var ln = ((f.querySelector('[name="lname"]') || {}).value || '').trim().toLowerCase();
    var ad = ((f.querySelector('[name="address"]') || {}).value || '').trim().toLowerCase();
    if (!ln || !ad) return null;
    for (var i = 0; i < FAMILIES.length; i++) {
      if (FAMILIES[i].n.toLowerCase() === ln && String(FAMILIES[i].a).toLowerCase() === ad) {
        return { n: FAMILIES[i].n, a: FAMILIES[i].a, how: 'matched' };
      }
    }
    return null;
  }

  function childStatus(c) {
    return c.s === 'waitlist'
      ? '<span class="cm-sibst wait">Waiting list</span>'
      : '<span class="cm-sibst">Enrolled' + (c.cl ? ' \u00b7 ' + esc(c.cl) : '') + '</span>';
  }

  function siblingField() {
    var input = document.querySelector('#frmAddEditRecord [name="sibling"]');
    if (!input || input.getAttribute('data-cm-sib') === '1') return 0;
    var g = group(input);
    if (!g) return 0;
    input.setAttribute('data-cm-sib', '1');
    var lab = g.querySelector('label');
    if (lab) lab.textContent = 'Siblings';
    var col = input.parentNode;
    col.style.display = 'none';                      // the free text: hidden, still posting

    var box = document.createElement('div');
    box.className = 'cm-sibs';
    g.appendChild(box);
    var linked = [];                                 // siblings added by hand

    var self = function () {
      var f = document.querySelector('#frmAddEditRecord');
      return [((f.querySelector('[name="fname"]') || {}).value || '').trim().toLowerCase(),
              ((f.querySelector('[name="lname"]') || {}).value || '').trim().toLowerCase()];
    };
    var writeBack = function (list) {
      input.value = list.map(function (c) { return c.f + ' ' + c.l; }).join(', ');
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    function render() {
      var me = self();
      var hh = siblingHousehold();
      var fromFamily = hh ? CHILDREN.filter(function (c) {
        return c.l.toLowerCase() === hh.n.toLowerCase() && c.a.toLowerCase() === String(hh.a).toLowerCase() &&
          !(c.f.toLowerCase() === me[0] && c.l.toLowerCase() === me[1]);
      }) : [];
      var ids = fromFamily.map(function (c) { return c.id; });
      var extra = linked.filter(function (c) { return ids.indexOf(c.id) < 0; });

      var html = '';
      if (hh) {
        html += '<div class="cm-sibfrom">From the ' + esc(hh.n) + ' household' +
          (hh.how === 'matched' ? ' <i>(same surname and address)</i>' : '') + '</div>';
      }
      var row = function (c, removable) {
        return '<div class="cm-sibrow"><b>' + esc(c.f + ' ' + c.l) + '</b>' + childStatus(c) +
          (removable ? '<button type="button" class="cm-sibrm" data-id="' + c.id + '" aria-label="Remove">Remove</button>' : '') +
          '</div>';
      };
      html += fromFamily.map(function (c) { return row(c, false); }).join('');
      html += extra.map(function (c) { return row(c, true); }).join('');
      if (!fromFamily.length && !extra.length) {
        html += '<div class="cm-sibnone">' + (hh ? 'No other children in this household.' : 'No siblings linked.') +
          (input.value.trim() ? ' <span>Typed before: ' + esc(input.value.trim()) + '</span>' : '') + '</div>';
      }
      html += '<button type="button" class="cm-lklink cm-siblink">Link a sibling</button>';
      box.innerHTML = html;
      box.querySelector('.cm-siblink').addEventListener('click', openSearch);
      box.querySelectorAll('.cm-sibrm').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = +b.getAttribute('data-id');
          linked = linked.filter(function (c) { return c.id !== id; });
          writeBack(fromFamily.concat(linked));
          render();
        });
      });
      box._family = fromFamily;
    }

    function openSearch() {
      if (document.querySelector('.cm-lk-back')) return;
      var back = document.createElement('div');
      back.className = 'cm-lk-back';
      back.innerHTML =
        '<div class="cm-lk" role="dialog" aria-modal="true" aria-label="Link a sibling">' +
          '<div class="cm-lk-head"><b>Link a sibling</b>' +
          '<button type="button" class="cm-lk-x" aria-label="Close">\u00d7</button></div>' +
          '<input type="search" class="cm-findbox" placeholder="Child\u2019s name" aria-label="Search children on file">' +
          '<div class="cm-findout"></div>' +
        '</div>';
      document.body.appendChild(back);
      var sb = back.querySelector('.cm-findbox'), out = back.querySelector('.cm-findout'), hits = [];
      var close = function () { back.remove(); document.removeEventListener('keydown', onKey, true); };
      var me = self();
      sb.addEventListener('input', function () {
        var q = sb.value.trim().toLowerCase();
        if (q.length < 2) { out.innerHTML = ''; hits = []; return; }
        hits = CHILDREN.filter(function (c) {
          return (c.f + ' ' + c.l).toLowerCase().indexOf(q) > -1 &&
            !(c.f.toLowerCase() === me[0] && c.l.toLowerCase() === me[1]);
        }).slice(0, 8);
        out.innerHTML = hits.length ? hits.map(function (c, i) {
          return '<button type="button" class="cm-fhit' + (i === 0 ? ' act' : '') + '" data-i="' + i + '">' +
            '<b>' + esc(c.f + ' ' + c.l) + '</b>' +
            '<span>' + (c.s === 'waitlist' ? 'Waiting list' : 'Enrolled' + (c.cl ? ' \u00b7 ' + esc(c.cl) : '')) + '</span>' +
            '<i>' + esc(String(c.a).replace(/,?\s*USA$/i, '')) + '</i></button>';
        }).join('') : '<div class="cm-findhint">No child on file matches.</div>';
        out.querySelectorAll('.cm-fhit').forEach(function (b) {
          b.addEventListener('click', function () {
            var c = hits[+b.getAttribute('data-i')];
            if (!linked.some(function (x) { return x.id === c.id; })) linked.push(c);
            writeBack((box._family || []).concat(linked));
            close();
            render();
          });
        });
      });
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(); return; }
        var items = out.querySelectorAll('.cm-fhit');
        if (!items.length) return;
        var cur = 0;
        items.forEach(function (x, i) { if (x.classList.contains('act')) cur = i; });
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          var nx = (cur + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
          items.forEach(function (x) { x.classList.remove('act'); });
          items[nx].classList.add('act');
        } else if (e.key === 'Enter') { e.preventDefault(); items[cur].click(); }
      }
      document.addEventListener('keydown', onKey, true);
      back.addEventListener('click', function (e) { if (e.target === back) close(); });
      back.querySelector('.cm-lk-x').addEventListener('click', close);
      sb.focus();
    }

    window.cmRefreshSiblings = render;
    render();
    return 1;
  }

  /* FIELDS THE NEW FORM DOES NOT ASK. Marked, not removed: a CSS rule keeps them
     off screen whatever the stage logic does, and their inputs still post, so a
     save cannot blank what is stored.

     waiting_list.cell_number — "Cell Number" on the waiting list. A phone with no
     owner, the same shape as children.parent_email: it says a number, not whose.
     Today it is one of the six fields that can satisfy the reachability check on
     its own; D1 replaces that rule with a NAMED parent and their phone or email, so
     the family's number belongs on the mother or father in Family, not on the
     queue row. Empty on all 5 waiting-list rows of this tenant. */
  var NOT_ASKED = ['cell_number'];

  function hideNotAsked() {
    var n = 0;
    NOT_ASKED.forEach(function (name) {
      document.querySelectorAll('#frmAddEditRecord [name="' + name + '"]').forEach(function (el2) {
        var g = group(el2);
        if (g && g.getAttribute('data-cm-hide') !== '1') { g.setAttribute('data-cm-hide', '1'); n++; }
      });
    });
    return n;
  }

  /* THE READ-ONLY VIEW IN THE SAME SHAPE AS THE FORM.

     Opening a child shows a read-only copy of the form first (.tnd-pane-view), built
     by the app from the ORIGINAL sections: tab N shows panel N. The tab buttons had
     been renamed, but behind them the view still read "Parents Details / Father
     name / Mother name / Father phone / Parent email", kept the parents' registration
     details in a hidden "Registration Form Details" panel, and showed Therapy alone
     under Health. So the view is rearranged to match what Edit shows:

       Details         the child — plus Nickname and Comments; the address leaves
       Family          the household box and one card per parent, read from the same
                       quick migration editing uses (B0); the flat rows are hidden
       Enrollment      days enrolled and the five staff contacts; the parents'
                       registration rows are hidden, because Family now shows them
       Health          allergies, conditions, the pediatrician, Has Therapy last
       Transportation  unchanged
       Billing         unchanged, renamed

     Rows are moved between panels, never rewritten, so every value is the app's.
     Only the Family cards are drawn here, from the hidden form's own inputs. */
  function viewShape() {
    var view = document.querySelector('.tnd-pane-view');
    if (!view || view.getAttribute('data-cm-view') === '1') return 0;
    var panels = {};
    view.querySelectorAll('section.vB-group[data-panel]').forEach(function (sec) {
      var l = sec.querySelector('.vB-group-label');
      panels[((l && l.textContent) || '').trim().toLowerCase()] = sec;
    });
    var details = panels['details'], parents = panels['parents details'], reg = panels['registration form details'],
        therapy = panels['therapy'], staff = panels['contact assignment overrides'], priv = panels['privileges'];
    if (!details || !parents || !reg || !therapy) return 0;
    view.setAttribute('data-cm-view', '1');

    var label = function (sec, t) { var l = sec && sec.querySelector('.vB-group-label'); if (l) l.textContent = t; };
    var list = function (sec) { return sec.querySelector('.vB-list') || sec; };
    var rowsOf = function (sec) { return sec ? Array.prototype.slice.call(sec.querySelectorAll('.vB-row')) : []; };
    var rowLabel = function (r) { return ((r.querySelector('.vB-row-label') || {}).textContent || '').trim(); };
    var take = function (sec, re) { return rowsOf(sec).filter(function (r) { return re.test(rowLabel(r)); }); };
    var moveTo = function (rows, sec, beforeRow) {
      var l = list(sec);
      rows.forEach(function (r) { l.insertBefore(r, beforeRow || null); });
    };
    var hide = function (rows) { rows.forEach(function (r) { r.style.display = 'none'; }); };

    label(parents, 'Family'); label(reg, 'Enrollment'); label(therapy, 'Health'); label(priv, 'Billing');

    // Details: the child, with the nickname by their name and the comments.
    var lastName = take(details, /^last name$/i)[0];
    moveTo(take(reg, /^nickname$/i), details, lastName ? lastName.nextSibling : null);
    moveTo(take(reg, /^comments$/i), details);
    hide(take(details, /^(address|apartment number|city|state|zip code)$/i));

    // Health: the child's health first, therapy last.
    var hasTherapy = take(therapy, /^has therapy$/i);
    moveTo(take(details, /^(allergies|other allergy)$/i), therapy);
    moveTo(take(reg, /^(medical conditions|allergy special instructions|pediatrician)/i), therapy);
    moveTo(hasTherapy, therapy);

    // Enrollment: the five staff contacts join it; the parents' registration rows
    // are shown on Family instead.
    if (staff) { moveTo(rowsOf(staff), reg); }
    hide(take(reg, /^(father|mother)['\u2019]s /i));

    // Family: the household and its parents, as editing shows them.
    var cur = migrateCurrent();
    var msgs = {};
    rowsOf(parents).forEach(function (r) {
      var m = rowLabel(r).match(/^(father|mother) phone messages$/i);
      if (m) msgs[m[1].toLowerCase()] = ((r.querySelector('.vB-row-value') || {}).textContent || '').trim();
    });
    /* Drawn with the view's OWN parts, not new ones: a .vB-list card per group,
       .vB-row rows with the icon tile, label and value, .is-empty + .vB-muted for
       "Not set", and the tappable .vB-row--action row for a phone. The icons are
       cloned from the rows the view already drew, so they are the app's. */
    if (cur) {
      var all = rowsOf(view);
      var icon = function (re) {
        for (var i = 0; i < all.length; i++) {
          if (re.test(rowLabel(all[i]))) { var ic = all[i].querySelector('.vB-row-ico'); if (ic) return ic.innerHTML; }
        }
        return '';
      };
      var ICO = {
        person: icon(/^(father|mother) name$/i), phone: icon(/^(father|mother) phone$/i),
        mail: icon(/email$/i), msg: icon(/phone messages$/i), home: icon(/^address$/i),
        perm: icon(/^(branch|class)$/i) || icon(/^(father|mother) name$/i)
      };
      var ctaRow = all.filter(function (r) { return r.querySelector('.vB-row-cta'); })[0];
      var cta = ctaRow ? ctaRow.querySelector('.vB-row-cta').outerHTML : '';
      var row = function (ico, lab, val, href) {
        var empty = !val;
        var body = '<span class="vB-row-ico" aria-hidden="true">' + ico + '</span>' +
          '<span class="vB-row-body"><span class="vB-row-label">' + esc(lab) + '</span>' +
          '<span class="vB-row-value' + (empty ? ' vB-muted' : '') + '">' + (empty ? 'Not set' : esc(val)) + '</span></span>';
        return (href && !empty)
          ? '<a class="vB-row vB-row--action" href="' + href + '">' + body + cta + '</a>'
          : '<div class="vB-row' + (empty ? ' is-empty' : '') + '">' + body + '</div>';
      };
      var tel = function (v) { return v ? 'tel:' + String(v).replace(/[^\d+]/g, '') : ''; };
      var hhAddr = String(cur.a || '').replace(/,?\s*USA$/i, '');

      // The household card sits straight under the section's own label; only the
      // parents get a sub-label, because FAMILY already names the first card.
      var html = '<div class="cm-vfam">' +
        '<div class="vB-list">' +
          row(ICO.home, 'Household', cur.n + ' household') +
          row(ICO.phone, 'Household phone', cur.p, tel(cur.p)) +
          row(ICO.home, 'Address', hhAddr) +
        '</div>' +
        cur.contacts.map(function (c) {
          var key = c.t.toLowerCase();
          return '<div class="cm-vsub">' + esc(c.t) + '</div>' +
            '<div class="vB-list">' +
              row(ICO.person, 'Name', c.n) +
              row(ICO.perm, 'What they may do', 'Full permission') +
              row(ICO.phone, 'Phone', c.p, tel(c.p)) +
              row(ICO.mail, 'Email', c.e, c.e ? 'mailto:' + c.e : '') +
              (msgs[key] ? row(ICO.msg, 'Messages', msgs[key]) : '') +
              row(ICO.home, 'Lives at', c.addr ? c.addr + ' (not the household\u2019s)' : (hhAddr ? 'The household address' : '')) +
            '</div>';
        }).join('') + '</div>';

      // The flat rows' own card is emptied by this, so it goes; the new cards take
      // its place under the section's label.
      hide(rowsOf(parents));
      var oldList = parents.querySelector('.vB-list');
      if (oldList && !rowsOf(parents).some(function (r) { return r.style.display !== 'none'; })) oldList.style.display = 'none';
      var lab = parents.querySelector('.vB-group-label');
      if (lab) lab.insertAdjacentHTML('afterend', html);
      else parents.insertAdjacentHTML('afterbegin', html);
    }
    return 1;
  }

  /* THE ADD PAGE IN TAB ORDER. The drawer's tabs run Details, Family, Enrollment,
     Health, Transportation, Billing; the Add page's fieldsets ran Details, Wait List,
     Therapy, Transportation, Staff, Parents, Enrollment, Privileges — so a new
     child's parents came after the bus. Once the fieldsets carry the new names they
     are put in the tabs' order, straight after the Details fieldset. Moved, never
     rebuilt: the same fieldsets, the same inputs. */
  function orderAddPage() {
    var form = document.querySelector('#frmAddEditRecord');
    if (!form || form.querySelector('section.vB-group') || form.getAttribute('data-cm-addorder') === '1') return 0;
    var fam = sectionByHead('family');
    if (!fam || !sectionByHead('health')) return 0;          // not renamed yet: next pass
    var first = form.querySelector('fieldset');
    if (!first || first === fam) return 0;
    form.setAttribute('data-cm-addorder', '1');
    var after = first;
    ['family', 'enrollment', 'health', 'transportation', 'billing'].forEach(function (name) {
      var fs = sectionByHead(name);
      if (!fs || fs === first) return;
      after.parentNode.insertBefore(fs, after.nextSibling);
      after = fs;
    });
    return 1;
  }

  function applyStage() {
    var box = document.querySelector('[name="is_waitlist"]');
    if (box) stageFieldsets(!!box.checked);
    var dst = sectionByHead('waitlist') || sectionByHead('enrollment');
    if (!box || !dst) return;
    var waiting = !!box.checked;
    // Text is written only when it differs: applyStage now runs on every pass,
    // and an unconditional write is a DOM change that would trigger the next pass.
    var label = waiting ? 'Waitlist' : 'Enrollment';
    var h = dst.querySelector('h1,h2,h3,h4,legend,.vB-grouphead');
    if (h && h.textContent !== label) h.textContent = label;
    document.querySelectorAll('button, a, span, li').forEach(function (b) {
      if (b.children.length) return;
      var t = (b.textContent || '').trim();
      if ((t === 'Enrollment' || t === 'Waitlist') && t !== label) b.textContent = label;
    });
    /* ONE STAGE ON SCREEN AT A TIME. The tab holds two stages, and a child is in
       exactly one of them:
         on the waiting list  → only the waiting-list questions (voucher type,
                                preferred branch, anticipated start, transport
                                intention). Nothing of enrolment — class, start
                                date, the staff contacts, the registration PDF — is
                                answerable before there IS an enrolment.
         enrolled             → only the enrolment. The waiting-list answers are
                                history by then, not questions.
       Anything in the tab that is not tagged as waiting list counts as enrolment:
       fields that moved in later (the five staff contacts, the registration
       action) arrive untagged, and they are all enrolment facts. The stage
       sub-heading is never needed — the tab's own name says which stage it is.
       Hidden, never removed: every input still posts. */
    var dstCard = dst.querySelector('.vB-editcard') || dst;
    Array.prototype.slice.call(dstCard.children).forEach(function (g) {
      if (g.querySelector && g.querySelector('[name="is_waitlist"]')) return;
      var stage = g.getAttribute('data-cm-stage');
      if (stage === 'waitlist-head') { g.style.display = 'none'; return; }
      var isWait = stage === 'waitlist';
      var want = (isWait ? waiting : !waiting) ? '' : 'none';
      if (g.style.display !== want) g.style.display = want;
    });

    /* Tabs a child on the waiting list has no answer for yet. Measured on this
       tenant: of the 5 children in the queue, 0 have allergies, transport, therapy,
       a CIR id, a price, a voucher or a charge. An empty tab invites someone to
       invent a fact, so it is hidden until the child is actually enrolled.

       HIDDEN, NEVER REMOVED. The sections stay in #frmAddEditRecord, so every input
       still posts its current value on save — a display:none field is still
       submitted. Taking them out of the form would blank those columns the first
       time a waitlisted child was saved. */
    STAGE_HIDDEN.forEach(function (name) {
      var sec2 = sectionByHead(name.toLowerCase());
      var hide = waiting ? 'none' : '';
      if (sec2 && sec2.style.display !== hide) sec2.style.display = hide;
      document.querySelectorAll('button, a, span, li').forEach(function (b) {
        if (b.children.length) return;
        if ((b.textContent || '').trim() === name && b.style.display !== hide) b.style.display = hide;
      });
    });
  }

  function bindStage() {
    var box = document.querySelector('[name="is_waitlist"]');
    if (!box || box.getAttribute('data-cm-stage-bound') === '1') return;
    box.setAttribute('data-cm-stage-bound', '1');
    box.addEventListener('change', applyStage);
    applyStage();
  }

  /* THE REACHABILITY RULE, restated.
     Today: "at least one of father_phone, mother_phone, home_phone, parent_email".
     A bare house phone satisfies it with nobody attached to the number, and
     parent_email satisfies it without saying whose address it is — the same column
     the migration found copied into both parents in 229 of 251 rows.
     New: at least one PARENT, named, with a way to reach them.
     Measured on this tenant: 120 children satisfy today's rule, 139 satisfy the new
     one, and only 5 would newly fail. It is stricter about ownership and yet catches
     MORE children, because it reads the phone that is actually on file
     (children_additional_information.father_home_phone, 78%) which today's rule
     never looks at. */
  function reachability() {
    var hint = document.querySelector('#tndEnrollContactHint');
    if (!hint || hint.getAttribute('data-cm-reach') === '1') return 0;
    hint.setAttribute('data-cm-reach', '1');
    var want = '<strong>A parent must be reachable<span class="astric">*</span></strong> ' +
      'Name a mother or a father and give a phone or an email for them.';
    var write = function () { if (hint.innerHTML !== want) hint.innerHTML = want; };
    write();

    /* The rule names a mother or a father, so it belongs with them. It was rendering
       above the household block — before the question of which household, and before
       either parent had a box to be named in — where it reads as a complaint about
       something the form has not asked for yet. */
    var row = hint.closest ? (hint.closest('.tnd-enroll-hint-row') || hint) : hint;
    var firstPerson = document.querySelector('.cm-person');
    if (firstPerson && firstPerson.parentNode && row.parentNode) {
      row.classList.add('cm-reachrow');
      firstPerson.parentNode.insertBefore(row, firstPerson);
    }
    new MutationObserver(write).observe(hint, { childList: true, subtree: true, characterData: true });
    return 1;
  }

  function apply() {
    var n = 0;
    n += renameTabs();

    Object.keys(OUT).forEach(function (name) {
      var el = document.querySelector('[name="' + name + '"]');
      if (el && mark(group(el), 'cm-out', OUT[name])) n++;
    });

    Object.keys(WAVE2).forEach(function (name) {
      var el = document.querySelector('[name="' + name + '"]');
      if (el && mark(group(el), 'cm-wave2', WAVE2[name])) n++;
    });

    Object.keys(MOVE).forEach(function (name) {
      var el = document.querySelector('[name="' + name + '"]');
      if (el && mark(group(el), 'cm-move', MOVE[name])) n++;
    });

    BLOCKS.forEach(function (b) {
      var labels = document.querySelectorAll('.form-group label');
      for (var i = 0; i < labels.length; i++) {
        if ((labels[i].textContent || '').trim().toLowerCase() === b.text) {
          if (mark(group(labels[i]), b.kind, b.tag)) n++;
          break;
        }
      }
    });

    n += relocateMedical();
    n += foldWaitlist();
    n += distributeStaff();
    n += pediatricianCard();
    n += therapyLast();
    n += transportPoint('pickup');
    n += transportPoint('dropoff');
    n += hideNotAsked();
    n += siblingField();
    n += orderAddPage();
    n += viewShape();
    n += regFlow();
    // Fields that moved into Enrollment on this pass take the current stage too.
    if (document.querySelector('[name="is_waitlist"]')) applyStage();
    n += reorder();
    bindStage();

    // Nickname is MOVED, not copied: the same input node is relocated next to the
    // child's last name, so the form still posts reg_nickname and still saves. A
    // second field would be the mistake this module exists to remove.
    var nick = document.querySelector('[name="reg_nickname"]');
    var lname = document.querySelector('[name="lname"]');
    if (nick && lname) {
      var ng = group(nick), lg = group(lname);
      if (ng && lg && lg.parentNode && ng !== lg && ng.getAttribute('data-cm-moved') !== '1') {
        ng.setAttribute('data-cm-moved', '1');
        lg.parentNode.insertBefore(ng, lg.nextSibling);
        var tag = ng.querySelector('.cm-tag');
        if (tag) tag.textContent = 'moved here from Registration';
        n++;
      }
    }

    /* The household question sits at the TOP of the Family tab, because it is asked
       before anything about a person.

       It used to be anchored to the father_name field — "just before the first
       parent field" — which held only until personCards() moved that field into the
       Father card. The block then travelled with it and ended up inside the card,
       reading as one of the father's own fields. An anchor that moves is not an
       anchor: the section is. */
    var famSec = sectionByHead('family');
    if (famSec && !document.querySelector('.cm-newblock')) {
      var host = famSec.querySelector('.vB-editcard') || famSec;
      var nb = newBlock();
      // After a fieldset's legend, never above it.
      var first = host.firstElementChild;
      host.insertBefore(nb, first && first.tagName === 'LEGEND' ? first.nextSibling : host.firstChild);
      // Editing, not creating: open on the child's own household — after the
      // block's own reset (queued at build) and after the parent cards exist.
      setTimeout(function () {
        if (nb._openCurrent()) return;
        var want = null;
        try { want = JSON.parse(sessionStorage.getItem('cm-add-family') || 'null'); } catch (err) {}
        if (!want) return;
        try { sessionStorage.removeItem('cm-add-family'); } catch (err) {}
        // From the Families page head: "Add family" answers New family; "Add to
        // waiting list" does that and turns the waiting-list switch on as well.
        if (want.mode === 'new') {
          var rNew = nb.querySelector('.cm-radio[data-choice="new"]');
          if (rNew) rNew.click();
          if (want.waitlist) {
            var wl = document.querySelector('#frmAddEditRecord [name="is_waitlist"]');
            if (wl && !wl.checked) wl.click();
          }
          return;
        }
        var tries = 0;
        (function wait() {
          var f = FAMILIES.filter(function (x) { return x.n === want.n && x.a === want.a; })[0];
          if (f) { nb._pickFound(f); return; }
          if (++tries < 40) setTimeout(wait, 100);
        })();
      }, 60);
      n++;
    }

    if (n) legend();
    return n;
  }

  /* The legend, with the two things it was conflating pulled apart.

     ONE: is the panel open? It is a reference card, read once and then in the way —
     it sat fixed over the right of the drawer, which is where the form is. So it
     starts COLLAPSED, as a pill, and opens when asked.

     TWO: are the annotations on? That is about the page, not the panel, and it was
     wrong to fire it from the same button: closing the reference card should not
     strip the colours off the form, and turning the colours off should not leave a
     panel explaining colours that are no longer there.

     Collapsing is remembered per browser, so it does not have to be dismissed on
     every child. localStorage can throw in a private window, hence the try/catch. */
  function legend() {
    /* Clean view for the client: annotations always off, and no Change map pill or panel.
       body.cm-off is the same state the "Show the annotations" switch used to set. */
    document.body.classList.add('cm-off');
    if (CLEAN_VIEW) return;
    if (document.getElementById('cmLegend')) return;

    var open = false;
    try { open = localStorage.getItem('cm.legend.open') === '1'; } catch (e) { open = false; }

    var l = document.createElement('div');
    l.id = 'cmLegend';
    l.className = open ? '' : 'is-pill';
    l.innerHTML =
      '<button type="button" class="cm-pill" aria-expanded="' + (open ? 'true' : 'false') + '">' +
        '<span class="cm-pilldots"><i style="background:#d94538"></i><i style="background:#9d6b10"></i>' +
        '<i style="background:#3f6f99"></i><i style="background:#1f7a4d"></i></span>Change map</button>' +
      '<div class="cm-head"><b>Family module &middot; change map</b>' +
        '<button type="button" id="cmClose" aria-label="Collapse">&minus;</button></div>' +
      '<div class="cm-body">' +
        '<div class="cm-item"><span class="cm-sw" style="background:#d94538"></span>' +
        '<span><b>Leaves this form</b><span>Moves to families, family_contacts, ' +
        'contact_links or addresses.</span></span></div>' +
        '<div class="cm-item"><span class="cm-sw" style="background:#9d6b10"></span>' +
        '<span><b>Deferred &mdash; wave 2</b><span>Address and geocode. Read by bus routing and ' +
        'written by the geocode cron, so it is a project of its own.</span></span></div>' +
        '<div class="cm-item"><span class="cm-sw" style="background:#3f6f99"></span>' +
        '<span><b>Wrong tab</b><span>Stays in the product, belongs beside its own subject.</span></span></div>' +
        '<div class="cm-item"><span class="cm-sw" style="background:#1f7a4d"></span>' +
        '<span><b>New</b><span>Does not exist today.</span></span></div>' +
      '</div>' +
      '<label class="cm-switch"><input type="checkbox" id="cmAnnot" checked>' +
        '<span>Show the annotations</span></label>' +
      '<div class="cm-count">Nothing here is saved. The map is drawn over the real form and ' +
        'changes no data.</div>';
    document.body.appendChild(l);

    function setOpen(v) {
      l.classList.toggle('is-pill', !v);
      l.querySelector('.cm-pill').setAttribute('aria-expanded', v ? 'true' : 'false');
      try { localStorage.setItem('cm.legend.open', v ? '1' : '0'); } catch (e) {}
    }
    l.querySelector('.cm-pill').addEventListener('click', function () { setOpen(true); });
    l.querySelector('#cmClose').addEventListener('click', function () { setOpen(false); });
    l.querySelector('#cmAnnot').addEventListener('change', function () {
      document.body.classList.toggle('cm-off', !this.checked);
    });
  }

  var t = null;
  function schedule() { clearTimeout(t); t = setTimeout(apply, 120); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule);
  } else {
    schedule();
  }
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
