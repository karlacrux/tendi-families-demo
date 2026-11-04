/* ---------------------------------------------------------------------------
   PROTOTYPE — Families, Version B: Version A's panel, fields and text in a calmer
   skin (family-b.css). Only sets the class the skin hangs on; nothing else changes.

   On by default here; ?b=0 in the address shows Version A for the visit.
--------------------------------------------------------------------------- */
(function () {
  'use strict';

  var q = /[?&]b=([01])/.exec(window.location.search);
  try {
    if (q) sessionStorage.setItem('fam-b', q[1]);
    if (sessionStorage.getItem('fam-b') === '0') return;
  } catch (err) { if (q && q[1] !== '1') return; }
  document.documentElement.classList.add('fam-b');

  // Version A's labels are shouted in capitals, which hid "First Name" beside "Family name".
  var KEEP = /^(Hebrew|SMS|ACS|HRA|ID|ZIP|ACH|DOB|Voice)$/;
  var LABELS = '.tnd-drawer label.control-label, .tnd-drawer .cm-mlabel, .tnd-drawer .cm-ptype-cap';
  function calm(root) {
    (root.querySelectorAll ? root : document).querySelectorAll(LABELS).forEach(function (l) {
      if (l.children.length) return;
      var t = l.textContent, n = t.replace(/(\s)(\S+)/g, function (m, s, w) { return s + (KEEP.test(w) ? w : w.toLowerCase()); });
      if (n !== t) l.textContent = n;
    });
  }
  // An opened "What they may do" comes fully into view.
  document.addEventListener('toggle', function (e) {
    var fold = e.target;
    if (fold.open && fold.matches && fold.matches('.fam-portal .cm-permfold')) {
      var pop = fold.querySelector('.cm-permpop');
      if (pop) pop.scrollIntoView({ block: 'nearest' });
    }
  }, true);

  /* The circle: a person icon until a name is typed, then the name's first letter. Beside
     it the person's name as it is typed, and their relationship. */
  var RAMP = ['#4574b5', '#a84d6a', '#45805a', '#6b54a3', '#8a5a30', '#357f6d', '#9c4f80', '#836a2b'];
  var SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.500-3.500"/></svg>';
  var PERSON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  function paintCircle(el, name) {
    var letter = String(name || '').trim().charAt(0).toUpperCase();
    el.classList.add('fb-av');
    el.classList.toggle('is-empty', !letter);
    if (letter) {
      if (el.textContent !== letter) el.textContent = letter;
      el.style.background = RAMP[letter.charCodeAt(0) % RAMP.length];
    } else {
      if (!el.querySelector('svg')) el.innerHTML = PERSON;
      el.style.background = '';
    }
  }
  function paintHead(card) {
    var head = card.querySelector(':scope > .fb-phead') || card._fbHead;
    if (!head) return;
    var names = card.querySelectorAll('[data-part="name"] .form-group input');
    var first = names[0] ? names[0].value.trim() : '', last = names[1] ? names[1].value.trim() : '';
    var sel = card.querySelector('.cm-ptype select');
    var role = sel && sel.selectedIndex > 0 ? sel.options[sel.selectedIndex].text : (card.closest('.fam-cnew') ? 'New contact' : '');
    paintCircle(head.querySelector('.fb-phead-av'), first);
    head.querySelector('b').textContent = first ? first + (last ? ' ' + last : '') : role;
    var sub = head.querySelector('small');
    sub.textContent = first ? role : '';
    sub.hidden = !first;
  }
  function people(root) {
    if (!root.querySelectorAll || !(root.closest && root.closest('.fam-portal'))) return;
    var cards = root.matches('.cm-extra') ? [root] : root.querySelectorAll('.cm-extra');
    Array.prototype.forEach.call(cards, function (card) {
      if (card.closest('.fam-crow') || card._fbHead) { return; }
      var head = document.createElement('div');
      head.className = 'fb-phead';
      head.innerHTML = '<span class="fb-phead-av"></span><span class="fb-who"><b></b><small></small></span>';
      card._fbHead = head;
      var wrap = card.closest('.fam-cnew');
      if (wrap) { var old = wrap.querySelector('.fam-cnew-head > b'); old.parentNode.replaceChild(head, old); }
      else card.insertBefore(head, card.firstChild);
      paintHead(card);
    });
    Array.prototype.forEach.call(root.querySelectorAll('.fb-payview'), function (row) {
      paintCircle(row.querySelector('.fb-phead-av'), row.getAttribute('data-name'));
    });
    contactSearch(root);
    billingBlocks(root);
    Array.prototype.forEach.call(root.querySelectorAll('.fam-clist:not(.fam-clist-parents) .fam-cadd, .fam-caddview'), function (b) {
      b.textContent = '+ Add new contact';
    });
    // Rows already saved: the same circle in place of their icon or initials.
    Array.prototype.forEach.call(root.querySelectorAll('.fam-toperson, .vB-group:has(.fam-kidadd) .vB-row'), function (row) {
      var ico = row.querySelector('.vB-row-ico'), val = row.querySelector('.vB-row-value');
      if (ico && val) paintCircle(ico, val.textContent);
    });
    Array.prototype.forEach.call(root.querySelectorAll('.fam-crow'), function (row) {
      var av = row.querySelector('.fam-sub-av'), who = row.querySelector('.fam-crow-who b');
      if (av && who) paintCircle(av, who.textContent);
    });
  }
  /* Other contacts: search everyone on file before adding someone new. Picking a person adds
     their card through Add contact and links it the way the card's Find existing does. */
  function contactSearch(root) {
    var lists = root.matches('.fam-clist') ? [root] : root.querySelectorAll('.fam-clist');
    Array.prototype.forEach.call(lists, function (list) {
      if (list.classList.contains('fam-clist-parents') || list.parentNode.querySelector('.fb-csearch')) return;
      var box = document.createElement('div');
      box.className = 'fb-csearch';
      box.innerHTML = '<div class="fb-csearch-in">' + SEARCH + '<input type="search" class="form-control" placeholder="Search existing by name or phone" aria-label="Search existing by name or phone" autocomplete="off"></div><div class="fb-csearch-out"></div>';
      list.parentNode.insertBefore(box, list);
      var input = box.querySelector('input'), out = box.querySelector('.fb-csearch-out'), hits = [];
      var draw = function () {
        var q = input.value.trim().toLowerCase(), digits = q.replace(/\D/g, '');
        out.innerHTML = '';
        hits = [];
        if (q.length < 2 || !window.cmPeopleIndex) return;
        var fam = (list.closest('.fam-portal') || {})._fam || {};
        var mine = (fam.contacts || []).map(function (c) { return c.n; });
        hits = window.cmPeopleIndex().filter(function (h) {
          if (mine.indexOf(h.n) > -1) return false;
          return (h.n + ' ' + h.where).toLowerCase().indexOf(q) > -1 || (digits.length >= 3 && h.p.replace(/\D/g, '').indexOf(digits) > -1);
        }).slice(0, 6);
        if (!hits.length) { out.innerHTML = '<p>Nobody on file matches.</p>'; return; }
        hits.forEach(function (h) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'fb-phead';
          b.innerHTML = '<span></span><span class="fb-who"><b></b><small></small></span><em>+ Link</em>';
          paintCircle(b.firstChild, h.n);
          b.querySelector('b').textContent = h.n;
          b.querySelector('small').textContent = [h.t, h.where, h.p].filter(Boolean).join(' \u00b7 ');
          b.addEventListener('click', function () { pick(h); });
          out.appendChild(b);
        });
      };
      var pick = function (h) {
        var add = list.querySelector('.fam-cadd');
        if (!add) return;
        add.click();
        var cards = list.querySelectorAll('.fam-cnew .cm-extra'), card = cards[cards.length - 1];
        if (card && card._cmLink) card._cmLink(h);
        input.value = '';
        draw();
        repaintAll();
        if (card) card.closest('.fam-cnew').scrollIntoView({ block: 'nearest' });
      };
      input.addEventListener('input', draw);
      input.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (hits[0]) pick(hits[0]);
      });
    });
  }
  /* Billing in three blocks: who pays, how, and to what address. The two original selects stay
     in the form, hidden, and are what gets saved; the card fields keep their own wiring. */
  function billingBlocks(root) {
    var method = root.querySelector('.fam-editform [data-k="method"]') || (root.matches('.fam-editform') ? root.querySelector('[data-k="method"]') : null);
    var form = method && method.closest('.fam-editform');
    if (!form || form.querySelector('.fb-pays')) return;
    var payer = form.querySelector('[data-k="payer"]'), group = method.closest('.vB-group');
    var f = (form.closest('.fam-portal') || {})._fam || {}, b = f.billing || {}, p = b.parts || {};
    var section = function (title) {
      var s = document.createElement('section');
      s.className = 'vB-group';
      s.innerHTML = '<h3 class="vB-group-label">' + title + '</h3>';
      return s;
    };

    var who = section('Who pays');
    var pays = document.createElement('div');
    pays.className = 'fb-pays';
    who.appendChild(pays);
    var people = Array.prototype.filter.call(payer.options, function (o) { return o.value !== ''; });
    var drawPays = function () {
      Array.prototype.forEach.call(pays.children, function (c) { c.classList.toggle('on', c.getAttribute('data-v') === payer.value); });
    };
    people.forEach(function (o) {
      var c = document.createElement('button'), bits = o.text.split(' \u00b7 ');
      c.type = 'button';
      c.setAttribute('data-v', o.value);
      c.innerHTML = '<i></i><span class="fb-who"><b></b><small></small></span>';
      c.querySelector('b').textContent = bits[0];
      c.querySelector('small').textContent = bits[1] || '';
      c.addEventListener('click', function () { payer.value = o.value; payer.dispatchEvent(new Event('change', { bubbles: true })); drawPays(); });
      pays.appendChild(c);
    });
    if (!people.length) pays.innerHTML = '<p class="fb-paynone">Nobody with payment permission yet</p>';
    if (people.length === 1 && !payer.value) payer.value = people[0].value;
    drawPays();
    payer.closest('.form-group').classList.add('fb-orig');
    who.appendChild(payer.closest('.form-group'));
    group.parentNode.insertBefore(who, group);

    group.querySelector('.vB-group-label').textContent = 'Payment method';
    var row = method.closest('.form-group');
    row.classList.add('fb-orig');
    var seg = document.createElement('div');
    seg.className = 'fb-seg fb-methods';
    var drawSeg = function () {
      Array.prototype.forEach.call(seg.children, function (c) { c.classList.toggle('on', c.textContent === method.value); });
    };
    ['ACH', 'Credit Card', 'Cash'].forEach(function (m) {
      var c = document.createElement('button');
      c.type = 'button';
      c.textContent = m;
      c.addEventListener('click', function () { method.value = m; method.dispatchEvent(new Event('change', { bubbles: true })); drawSeg(); });
      seg.appendChild(c);
    });
    row.parentNode.insertBefore(seg, row);
    drawSeg();

    var addr = section('Billing address');
    var home = String(f.a || '').replace(/,?\s*USA$/i, '');
    addr.insertAdjacentHTML('beforeend',
      '<label class="fb-samecard"><span class="fb-cb"><input type="checkbox" data-k="billsame"></span><span class="fb-who"><b>Same as the home address</b><small></small></span></label>' +
      '<div class="fb-billaddr">' + [['bill1', 'Address line 1', 'line1'], ['bill2', 'Address line 2', 'line2'], ['billcity', 'City', 'city'], ['billstate', 'State', 'state'], ['billzip', 'ZIP code', 'zip']].map(function (x) {
        return '<input type="text" class="form-control" data-k="' + x[0] + '" placeholder="' + x[1] + '" autocomplete="off">';
      }).join('') + '</div>');
    var small = addr.querySelector('small');
    small.textContent = home;
    small.hidden = !home;
    [['bill1', 'line1'], ['bill2', 'line2'], ['billcity', 'city'], ['billstate', 'state'], ['billzip', 'zip']].forEach(function (x) {
      addr.querySelector('[data-k="' + x[0] + '"]').value = p[x[1]] || '';
    });
    var same = addr.querySelector('[data-k="billsame"]'), card = addr.querySelector('.fb-samecard'), fields = addr.querySelector('.fb-billaddr');
    var drawSame = function () { card.classList.toggle('on', same.checked); fields.hidden = same.checked; };
    same.checked = b.same !== false;
    same.addEventListener('change', drawSame);
    drawSame();
    group.parentNode.insertBefore(addr, group.nextSibling);
  }
  function repaintAll() {
    document.querySelectorAll('.fam-portal .cm-extra').forEach(paintHead);
  }
  /* No family name typed: the father's last name is the family's, or the mother's if there is
     no father. Typing a family name ends this; emptying it starts it again. */
  var fillingName = false;
  function nameFromParents(t) {
    var form = t.closest && t.closest('.fam-portal .fam-editform');
    var nm = form && form.querySelector('[data-k="name"]');
    if (!nm || !form.querySelector('.fam-newparent')) return;
    if (t === nm) { if (!fillingName) nm.setAttribute('data-fb-typed', nm.value.trim() ? '1' : ''); return; }
    if (nm.getAttribute('data-fb-typed') === '1') return;
    var last = '';
    form.querySelectorAll('.fam-newparent').forEach(function (host) {
      var names = host.querySelectorAll('[data-part="name"] .form-group input'), x = names[1];
      if (!last && !host.hidden && x && x.getAttribute('data-auto') !== '1') last = x.value.trim();
    });
    if (nm.value === last) return;
    fillingName = true;
    nm.value = last;
    nm.dispatchEvent(new Event('input', { bubbles: true }));
    fillingName = false;
  }
  ['input', 'change'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      if (!fillingName) nameFromParents(e.target);
      var childForm = e.target.closest && e.target.closest('#tndDrawer .fb-fold');
      if (childForm) paintChild(childForm);
      // Other allergy opens under the choices, wherever it now sits.
      if (childForm && e.target.name === 'allergies[]' && e.target.value === '0') {
        var other = childForm.querySelector('.other_allergy_wrapper');
        if (other) { other.hidden = !e.target.checked; other.style.display = e.target.checked ? 'block' : 'none'; }
      }
      if (e.target.closest && e.target.closest('.fam-portal')) repaintAll();
    });
  });
  // "Find existing" fills a card's name without typing.
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.fam-portal .cm-extra, .cm-lkpop, .cm-lkresult')) setTimeout(repaintAll, 60);
  });

  /* A new family's Father and Mother as two tabs of one Parents block. Both cards stay in the
     form, one hidden, so saving reads them exactly as it does in Version A. */
  function parentTabs(host) {
    var form = host.closest('form');
    if (!form || form.querySelector('.fb-parents')) return;
    var groups = Array.prototype.map.call(form.querySelectorAll('.fam-newparent'), function (h) { return h.closest('.vB-group'); });
    var box = document.createElement('section');
    box.className = 'vB-group fb-parents';
    box.innerHTML = '<h3 class="vB-group-label">Parents</h3><div class="fb-parentbar"><div class="fb-seg" role="tablist"></div></div>';
    groups[0].parentNode.insertBefore(box, groups[0]);
    var seg = box.querySelector('.fb-seg'), bar = box.querySelector('.fb-parentbar');
    var show = function (i) {
      groups.forEach(function (g, n) {
        g.hidden = n !== i;
        seg.children[n].classList.toggle('on', n === i);
        seg.children[n].setAttribute('aria-selected', n === i);
        g._fbNone.hidden = n !== i;
      });
    };
    groups.forEach(function (g, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.textContent = g.querySelector('.vB-group-label').textContent;
      b.addEventListener('click', function () { show(i); });
      seg.appendChild(b);
      g._fbNone = g.querySelector('.fb-none');
      bar.appendChild(g._fbNone);
      box.appendChild(g);
    });
    show(0);
  }

  /* "No father on file" on a new family's parent. Version A already skips a parent left
     without a first name, so ticking it hides the card and empties that name. */
  function noParent(root) {
    var hosts = root.matches && root.matches('.fam-newparent') ? [root] : root.querySelectorAll ? root.querySelectorAll('.fam-newparent') : [];
    if (hosts.length) window.setTimeout(function () { parentTabs(hosts[0]); }, 0);
    Array.prototype.forEach.call(hosts, function (host) {
      var group = host.closest('.vB-group');
      if (!group || group.querySelector('.fb-none') || group._fbNone) return;
      var who = host.getAttribute('data-rel');
      var label = document.createElement('label');
      label.className = 'fb-none';
      label.innerHTML = '<span class="fb-cb"><input type="checkbox"></span><span>No ' + who + ' on file</span>';
      group.appendChild(label);
      label.querySelector('input').addEventListener('change', function () {
        host.hidden = this.checked;
        group.classList.toggle('fb-isnone', this.checked);
        if (!this.checked) return;
        var first = host.querySelector('[data-part="name"] .form-group input');
        if (first) { first.value = ''; first.dispatchEvent(new Event('input', { bubbles: true })); }
      });
    });
  }
  /* The child form: areas that open instead of tabs. The tab bar stays in the page, hidden,
     because it still decides which areas this child has (a waiting child has fewer) and a
     refused save still names the area to go to, by switching tab: that area opens here. */
  var foldTimer = null;
  function fold() {
    foldTimer = null;
    var bar = document.querySelector('#tndDrawer .tnd-pane-edit > .tnd-tabs[data-cm-order]');
    if (!bar) return;
    var form = bar.parentNode;
    form.classList.add('fb-fold');
    var at = 0, first = !form.querySelector('.fb-sec');
    var card = childCard(form);
    var waiting = form.querySelector('[name="is_waitlist"]');
    waiting = !!(waiting && waiting.checked);
    Array.prototype.forEach.call(bar.querySelectorAll('.tnd-tab'), function (tab) {
      var sec = form.querySelector('section.vB-group[data-panel="' + tab.getAttribute('data-tab') + '"]');
      if (!sec) return;
      var on = !tab.hidden && window.getComputedStyle(tab).display !== 'none';
      sec.classList.toggle('fb-off', !on);
      if (!on) return;
      if (!sec.classList.contains('fb-sec')) {
        sec.classList.add('fb-sec');
        sec.classList.toggle('fb-closed', !(first && at === 0));
      }
      at++;
      if (sec.style.order !== String(at * 10)) sec.style.order = at * 10;
      if (tab.getAttribute('data-tab-name') === 'Details') splitDetails(form, card, sec, at);
      var name = tab.cloneNode(true);
      name.querySelectorAll('.tnd-tab-req, .tnd-tab-opt, .cm-tabwhy').forEach(function (x) { x.remove(); });
      var h = sec.querySelector(':scope > .vB-group-label'), text = name.textContent.trim(), req = tab.querySelector('.tnd-tab-req');
      var count = req ? req.textContent : '';
      if (h && (h.getAttribute('data-fb') !== text + '|' + count)) {
        h.setAttribute('data-fb', text + '|' + count);
        h.innerHTML = '';
        h.appendChild(document.createTextNode(text));
        if (count) { var c = document.createElement('span'); c.className = 'fb-seccount'; c.textContent = count; h.appendChild(c); }
      }
      var active = tab.classList.contains('is-active');
      if (active && !tab._fbActive && !first) {
        sec.classList.remove('fb-closed');
        var bad = sec.querySelector('.has-error input, .has-error select, .tnd-field-missing input, .tnd-field-missing select, input.error, select.error');
        (bad || sec).scrollIntoView({ block: 'center' });
        if (bad) bad.focus({ preventScroll: true });
      }
      tab._fbActive = active;
    });
    var tuition = form.querySelector('.form-group[data-fb-moved]');
    if (tuition) tuition.hidden = waiting;
    paintChild(form);
  }

  // The child as one card: their circle and name, then what is needed, then the areas.
  function childCard(form) {
    var card = form.querySelector(':scope > .fb-childcard');
    if (card) return card;
    card = document.createElement('div');
    card.className = 'fb-childcard';
    card.innerHTML = '<div class="fb-phead fb-childhead"><span class="fb-phead-av"></span><span class="fb-who"><b></b><small></small></span></div>';
    Array.prototype.forEach.call(form.querySelectorAll(':scope > section.vB-group[data-panel]'), function (sec) { card.appendChild(sec); });
    form.appendChild(card);
    if (html.classList.contains('fb-child')) {
      // Whoever was already added, above; another child, below.
      var done = document.createElement('div');
      done.className = 'fb-donekids';
      Array.prototype.forEach.call(document.querySelectorAll('.fam-portal .fam-fview .vB-list.fam-headed .vB-row'), function (row) {
        var name = row.querySelector('.vB-row-value'), what = row.querySelector('.vB-row-label');
        if (!name) return;
        var kid = document.createElement('div');
        kid.className = 'fb-phead fb-donekid';
        kid.innerHTML = '<span></span><span class="fb-who"><b></b><small></small></span><span class="fb-stagepill"></span>';
        paintCircle(kid.firstChild, name.textContent);
        kid.querySelector('b').textContent = name.textContent;
        var parts = (what ? what.textContent : '').split(' \u00b7 ');
        kid.querySelector('small').textContent = parts.slice(1).join(' \u00b7 ');
        kid.querySelector('small').hidden = parts.length < 2;
        var pill = kid.querySelector('.fb-stagepill');
        pill.textContent = parts[0];
        pill.classList.toggle('is-wait', /wait/i.test(parts[0]));
        done.appendChild(kid);
      });
      if (done.children.length) form.insertBefore(done, card);
      var adds = document.createElement('div');
      adds.className = 'reg-more fb-kidadds';
      adds.innerHTML = '<button type="button" class="reg-add" data-fb-more="enroll">+ Enroll another child</button><button type="button" class="reg-add" data-fb-more="wait">+ Add to waiting list</button>';
      form.appendChild(adds);
    }
    return card;
  }
  function paintChild(form) {
    var head = form.querySelector('.fb-childhead');
    if (!head) return;
    var get = function (n) { var i = form.querySelector('[name="' + n + '"]'); return i ? i.value.trim() : ''; };
    var first = get('fname'), box = form.querySelector('[name="is_waitlist"]'), cls = form.querySelector('[name="class"]');
    var waiting = !!(box && box.checked);
    paintCircle(head.querySelector('.fb-phead-av'), first);
    head.querySelector('b').textContent = first ? first + ' ' + get('lname') : 'New child';
    var where = !waiting && cls && cls.selectedIndex > 0 ? cls.options[cls.selectedIndex].text : '';
    var sub = head.querySelector('small');
    sub.textContent = where;
    sub.hidden = !where;
    // "This child is", beside the name: two choices in place of the original switch, which
    // stays in the form, hidden, and still drives what a waiting child is asked.
    if (box) {
      var row = box.closest('.form-group'), stage = head.querySelector('.fb-stagerow');
      if (!stage) {
        stage = document.createElement('div');
        stage.className = 'fb-stagerow';
        stage.innerHTML = '<span>This child is</span><div class="fb-seg" role="tablist"><button type="button" role="tab" data-fb-stage="enroll">Enrolling now</button><button type="button" role="tab" data-fb-stage="wait">On the waiting list</button></div>';
        row.classList.add('fb-stagegroup');
        head.appendChild(stage);
      }
      stage.children[1].children[0].classList.toggle('on', !waiting);
      stage.children[1].children[1].classList.toggle('on', waiting);
    }
  }
  /* The first block is what a registration asks for first: the child's names and birth, where
     and when, allergies and tuition type. The rest of Details goes to an area of its own. Moved
     inside the form, so every field still posts. Run each pass: other scripts place some of
     these fields a moment after the form loads. */
  var TO_FIRST = ['reg_nickname', 'allergies[]', 'other_allergy', 'hra_acs'], TO_OTHER = ['end_date', 'cir_id', 'nfc_card_uid', 'note'];
  function splitDetails(form, card, details, at) {
    details.classList.add('fb-first');
    details.classList.remove('fb-closed');
    var other = card.querySelector('.fb-other');
    if (!other) {
      other = document.createElement('section');
      other.className = 'vB-group fb-sec fb-other fb-closed';
      other.innerHTML = '<h3 class="vB-group-label">Other details</h3><div class="vB-editcard"></div>';
      card.appendChild(other);
    }
    var place = function (names, into) {
      names.forEach(function (n) {
        var f = card.querySelector('.form-group [name="' + n + '"]'), g = f && f.closest('.form-group');
        if (g && g.parentNode !== into) into.appendChild(g);
      });
    };
    place(TO_FIRST, details.querySelector('.vB-editcard'));
    place(TO_OTHER, other.querySelector('.vB-editcard'));
    var type = card.querySelector('.form-group [name="hra_acs"]');
    if (type) type.closest('.form-group').setAttribute('data-fb-moved', '1');
    other.style.order = at * 10 + 5;
  }

  new MutationObserver(function (list) {
    list.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) { calm(n); noParent(n); people(n); } }); });
    if (!foldTimer && document.querySelector('#tndDrawer .tnd-pane-edit > .tnd-tabs[data-cm-order]')) foldTimer = setTimeout(fold, 30);
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });

  /* A child added from the family keeps the family's head and tabs (swapToChild): its Save
     and Cancel, and a change of tab, act on the child first. Saving goes through the child
     form's own steps; a child left without a first name is simply not added. */
  var html = document.documentElement;
  function dropChild() {
    try { sessionStorage.removeItem('cm-reg'); } catch (err) {}
    html.classList.remove('fb-child');
    if (window.TndListDrawer) window.TndListDrawer.close(true);
  }
  function saveChild(tab) {
    var next = document.querySelector('#tndDrawer .reg-next');
    if (!next) return false;
    html.setAttribute('data-fb-tab', tab);
    next.click();
    var done = Array.prototype.filter.call(document.querySelectorAll('#tndDrawer .reg-btn'), function (b) { return /back to family/i.test(b.textContent); })[0];
    if (!done) { html.removeAttribute('data-fb-tab'); return false; }
    html.classList.remove('fb-child');
    done.click();
    return true;
  }
  document.addEventListener('click', function (e) {
    if (!html.classList.contains('fb-child')) return;
    var b = e.target.closest && e.target.closest('.fam-portal .fam-tsave, .fam-portal .fam-tcancel, .fam-portal .tnd-pane-close, .fam-portal [data-ftab]');
    if (!b) return;
    if (b.classList.contains('tnd-pane-close')) { dropChild(); return; }
    e.stopPropagation();
    e.preventDefault();
    if (b.classList.contains('fam-tcancel')) { dropChild(); return; }
    if (b.classList.contains('fam-tsave')) { saveChild(/continue/i.test(b.textContent) ? 'contacts' : 'children'); return; }
    var first = document.querySelector('#tndDrawer [name="fname"]');
    var tab = b.getAttribute('data-ftab');
    if (first && first.value.trim()) saveChild(tab);
    else { dropChild(); setTimeout(function () { b.click(); }, 0); }
  }, true);

  // Open a section from its title.
  document.addEventListener('click', function (e) {
    var h = e.target.closest && e.target.closest('#tndDrawer .fb-sec > .vB-group-label');
    if (h && !h.parentNode.classList.contains('fb-first')) h.parentNode.classList.toggle('fb-closed');
    var choice = e.target.closest && e.target.closest('#tndDrawer [data-fb-stage]');
    if (choice) {
      var sw = document.querySelector('#tndDrawer [name="is_waitlist"]');
      if (sw && sw.checked !== (choice.getAttribute('data-fb-stage') === 'wait')) sw.click();
    }
    // Another child: this one is saved first, through the same refusal if it has no first name.
    var more = e.target.closest && e.target.closest('#tndDrawer [data-fb-more]');
    if (more && saveChild('children')) {
      var mode = more.getAttribute('data-fb-more');
      setTimeout(function () {
        var b = document.querySelector('.fam-portal .fam-kidadd[data-m="' + mode + '"]');
        if (b) b.click();
      }, 320);
    }
    // Next or Finish refuses a child with no first name and focuses it: it has to be showing.
    if (e.target.closest && e.target.closest('#tndDrawer .reg-next')) {
      var first = document.querySelector('#tndDrawer [name="fname"]');
      if (first && !first.value.trim()) {
        first.closest('.fb-sec').classList.remove('fb-closed');
        first.scrollIntoView({ block: 'center' });
        first.focus({ preventScroll: true });
      }
    }
  });
})();
