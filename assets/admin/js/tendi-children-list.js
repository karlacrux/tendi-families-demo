/* ============================================================
   TENDI CHILDREN LIST: command bar behaviour
   ------------------------------------------------------------
   Drives the reskinned Children list: view switcher (built-in + saved, with a default and a
   delete), inline Branch/Class filters, the Filters popover, active-filter chips, the Columns /
   density picker, row-action kebabs and the bulk selection dock.

   CONTRACT WITH THE PAGE
   The view (children_manage.php) owns the DataTable and exposes three hooks on window.TndChildren:
     · applyFilters()        re-draw the table with the current filter state
     · readFilters()         the current filter state as a plain object (what a saved view stores)
     · writeFilters(obj)     push a saved view's state back into the controls
   Everything below only touches the dom and those three hooks, so the DataTables wiring stays in
   one place.

   SPA SAFETY
   Each fragment's inline script re-runs on every visit, so delegated handlers pile up (see the
   duplicate-handler class of bug this codebase has hit before). init() is therefore idempotent:
   it tears down its own document-level listeners before re-binding, and all in-page handlers are
   bound to elements inside the fragment, which the SPA replaces wholesale.
   ============================================================ */
(function () {
	'use strict';

	var $doc = document;
	var state = null;          // the live module state, rebuilt per page visit
	var docBound = false;      // document-level listeners bound exactly once per page life

	/* ---------------- small helpers ---------------- */
	function esc(s) {
		return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
		});
	}
	function el(sel, root) { return (root || $doc).querySelector(sel); }
	function els(sel, root) { return Array.prototype.slice.call((root || $doc).querySelectorAll(sel)); }
	function num(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
	/* YYYY-MM-DD, the shape window.child_timeline expects in `data-date` before it reformats it.
	   The SERVER's date wins: get_child_timeline filters against server time, so a date computed
	   from the browser clock is simply wrong for anyone whose local day has already rolled over.
	   From New York at 21:30 EDT the browser says tomorrow and the timeline comes back empty, under
	   a menu item that promises "(today)". children_manage.php stamps it on the page root. The
	   browser clock is only the fallback for a page rendered before that attribute existed. */
	function todayYmd() {
		var page = el('.tnd-children-page');
		var stamped = page && page.getAttribute('data-today');
		if (stamped && /^\d{4}-\d{2}-\d{2}$/.test(stamped)) return stamped;
		var d = new Date(), m = d.getMonth() + 1, day = d.getDate();
		return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
	}

	var ICO = {
		tick: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
		blank: '<span style="width:15px;flex:none"></span>',
		// A MULTI menu draws a checkbox on every row instead of tick-or-nothing. With the tick, an
		// untouched Branch list looked exactly like a single-select: nothing on screen said more
		// than one was allowed until you had already picked two. Colour comes from
		// `.tnd-chl-mi > svg` in tendi-children.css (ink-4 idle, primary on .is-active); the size is
		// stated inline as well so the box stays 15px if this ever renders without that bundle.
		cbox: function (on) {
			return '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden="true">'
				+ '<rect x="2.5" y="2.5" width="15" height="15" rx="4.5" stroke="currentColor" stroke-width="1.6"'
				+ (on ? ' fill="currentColor"' : ' stroke-opacity="0.55"') + '/>'
				+ (on ? '<path d="M6.3 10.2 8.8 12.7 13.8 7.5" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>' : '')
				+ '</svg>';
		},
		star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 2.7 5.6 6.3.9-4.5 4.3 1 6.2-5.5-3-5.5 3 1-6.2L3 9.5l6.3-.9z"/></svg>',
		x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
		lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
		saved: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16l-8-5-8 5z"/></svg>'
	};
	var VIEW_ICONS = {
		enrolled: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
		pending: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
		waitlist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
		ended: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>',
		archived: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>',
		future: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
		noclass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H4z"/><path d="M8 20h8M12 16v4"/><path d="m4 4 16 16"/></svg>',
		past: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/><path d="m4 4 16 16"/></svg>',
		trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>'
	};

	/* ---------------- built-in views ----------------
	   Each built-in is a named preset over the SAME filter fields the popover writes. They are
	   states of a record (archived / pending / trashed), which is why they are views and not
	   checkboxes: they are not things you combine, they are which population you are looking at.
	   FALLBACK_KEY must stay a built-in, because it is what every fallback lands on. */
	var FALLBACK_KEY = 'enrolled';
	/* B3/B5/B6. "Starting later" and "Leaving date passed" are NEW entries, and they are the reason
	   this list grew. The Enrolled view runs three date windows, so on the legacy copy it shows
	   1,325 of 3,873 enrolled children; the other 2,548 were reachable only through a Past/Current/
	   Future segmented control that named none of them and appeared to be a report filter. A
	   population you can only reach by guessing which segment hides it is a population that, to the
	   person looking, has disappeared. Each is now a named view with a count, driven by the SAME
	   tabFilter the segment always wrote, so the server behaviour is unchanged.

	   Ordered as the lifecycle runs: waiting, then the enrolled group, then gone, then the two
	   record states. "Pending / unconfirmed" was neither pending nor unconfirmed and is renamed to
	   what it is. */
	var BUILTINS = [
		{ key: 'enrolled', label: 'Enrolled',              filters: {} },
		{ key: 'future',   label: 'Starting later',        filters: { tabFilter: 'future' } },
		{ key: 'pending',  label: 'No start date',         filters: { pendingUnconfirmed: '1' } },
		// The 1,432 children whose leaving date has passed while nothing has ended them yet: the
		// nightly sweep has not caught up, or has never run. They were in NO view at all.
		{ key: 'past',     label: 'Leaving date passed',   filters: { tabFilter: 'past' } },
		// A13. Enrolled on paper with no room. They were in NO view at all, because every
		// enrolled view reaches the branch through ch.class and these children have none.
		{ key: 'noclass',  label: 'No class',               filters: { showNoClass: '1' } },
		// §7B. `showWaitlist` is a real filter now (Children::get() reads enrollment_status), so
		// this view finally shows the waiting list rather than every child. The old entry also
		// force-ticked "include children with no start date", which was a workaround for the
		// server applying date filters to children who have no dates: the server skips those
		// filters on this view now, so the workaround is gone and the chip row stays honest.
		{ key: 'waitlist', label: 'Waiting list',          filters: { showWaitlist: '1' } },
		// Where a child goes when they are taken off the queue without a place. Without this view
		// they would be status 'ended', in no view at all, and gone from the product.
		{ key: 'ended',    label: 'Left',                  filters: { showEnded: '1' } },
		{ key: 'archived', label: 'Archived',              filters: { showArchived: '1' } },
		{ key: 'trash',    label: 'Trash',                 filters: { includeTrash: '1' } }
	];

	/* ---------------- columns ----------------
	   `locked` columns are structural: selection, identity and the row menu are what make the table
	   usable at all, so they render as LOCKED rather than as a ticked checkbox someone can untick.
	   `idx` is the DataTables column index, filled in at init from the rendered <th> order. */
	function defaultColumns() {
		return [
			{ key: 'select', label: 'Selection',          locked: true,  on: true },
			{ key: 'child',  label: 'Child',              locked: true,  on: true },
			// Notes sits beside the child and is ON by default. This order has to match the rendered
			// <th> order in children_manage.php, which is where `idx` is read from below.
			{ key: 'note',   label: 'Notes',              locked: false, on: true },
			{ key: 'class',  label: 'Class & branch',     locked: false, on: true },
			{ key: 'age',    label: 'Age',                locked: false, on: true },
			{ key: 'enroll', label: 'Enrollment',         locked: false, on: true },
			{ key: 'prog',   label: 'Programs',           locked: false, on: true },
			{ key: 'trans',  label: 'Transportation',     locked: false, on: true },
			{ key: 'status', label: 'Status',             locked: false, on: true },
			{ key: 'recid',  label: 'Record ID',          locked: false, on: false },
			{ key: 'cir',    label: 'CIR ID',             locked: false, on: false },
			{ key: 'lp',     label: 'LP grade',           locked: false, on: false },
			{ key: 'vouch',  label: 'Voucher program ID', locked: false, on: false },
			{ key: 'tag',    label: 'Tag',                locked: false, on: false },
			{ key: 'act',    label: 'Row actions',        locked: true,  on: true }
		];
	}

	/* Written into the stored prefs blob the first time this build reads one, and checked before that
	   blob is applied. Notes changed from off-by-default to on-by-default, and persistDisplay() writes
	   EVERY unlocked key on every save, so anyone who had ever opened the Columns picker or changed the
	   row height already had `note:false` frozen in the database. Honouring that would have hidden the
	   column this card is about from exactly the people who use the page most, and it would have looked
	   like the change had not shipped. The stored value is ignored once, then the marker is written so a
	   deliberate hide from here on sticks.
	   Presence is the whole signal: List_views_model::set_display() coerces every value to a boolean,
	   so a version NUMBER would not survive the round trip. */
	var COLS_MIGRATED_KEY = 'notecol2';

	/* The last columns blob the server gave us, kept verbatim so persistDisplay() can write back the
	   keys it cannot see. init() drops any column whose <th> was not rendered (`c.idx != null`), and
	   Transportation is not rendered at all when the bus feature is off, so a save built only from
	   state.columns silently DELETES that user's stored `trans` choice. That was survivable while a
	   save only happened when someone opened the Columns picker. The one-time migration below calls
	   persistDisplay() on page load, which would have made it happen to every admin on a tenant with
	   transportation switched off, the first time they opened the page after the deploy. */
	var storedColsRaw = null;
	/* Whether the stored prefs have actually come back yet. The density buttons are bound before the
	   prefs GET resolves, so a fast click can reach persistDisplay() while storedColsRaw is still
	   null. That save was always lossy; what must not happen as well is it stamping the migration
	   marker, because that would spend the one-time skip on a blob built from defaults and leave the
	   Notes column hidden for the very users the skip exists to rescue. */
	var colsLoaded = false;

	/* ---------------- server calls ---------------- */
	function post(url, data, done, fail) {
		if (!window.jQuery) { return; }
		jQuery.ajax({
			url: url, type: 'POST', data: data, dataType: 'json',
			success: function (r) { if (done) done(r); },
			// Every AJAX button on this codebase needs an error branch: without one a failed call
			// looks identical to a slow one and the user clicks again.
			error: function () {
				if (fail) { fail(); }
				else if (window.jAlert) { jAlert('That did not save. Please try again.', 'Failed', 'danger'); }
			}
		});
	}

	/* ============================================================
	   VIEWS
	   ============================================================ */
	function allViews() { return BUILTINS.concat(state.saved); }
	function findView(key) {
		var all = allViews();
		for (var i = 0; i < all.length; i++) { if (all[i].key === key) return all[i]; }
		return null;
	}

	/**
	 * Which view to open. Mirrors List_views_model::resolve_default() so the client agrees with the
	 * server: stored default if it still exists, then the built-in fallback, then the first built-in.
	 * Never null.
	 */
	function resolveDefault() {
		return findView(state.defaultKey) || findView(FALLBACK_KEY) || allViews()[0];
	}

	/* B4. The size of the view, beside its name. Absent for a saved view (its filter set is
	   arbitrary, so counting it would mean running the user's whole query just to label a menu row)
	   and absent until the counts arrive, which is why the markup collapses to nothing rather than
	   rendering a zero: a zero that means "not counted yet" is worse than no number. */
	function viewCountHtml(key) {
		if (!state.counts || !(key in state.counts)) return '';
		var n = state.counts[key];
		return '<span class="viewcount" aria-hidden="true">' + Number(n).toLocaleString() + '</span>';
	}
	function viewRowHtml(v, isSaved) {
		var isDefault = state.defaultKey === v.key;
		return '<button type="button" class="tnd-chl-mi viewrow' + (state.currentKey === v.key ? ' is-active' : '') + '" data-view="' + esc(v.key) + '">'
			+ (VIEW_ICONS[v.key] || ICO.saved)
			+ '<span class="sp">' + esc(v.label) + (isSaved ? '' : viewCountHtml(v.key)) + '</span>'
			+ '<span class="rowacts">'
			+ '<span class="ra star' + (isDefault ? ' is-on' : '') + '" data-star="' + esc(v.key) + '" role="button" tabindex="0"'
			+ ' title="' + (isDefault ? 'Opens by default. Click to unset.' : 'Open this view by default') + '"'
			+ ' aria-label="' + (isDefault ? 'Unset as default view' : 'Set as default view') + '">' + ICO.star + '</span>'
			+ (isSaved ? '<span class="ra del" data-del="' + esc(v.key) + '" role="button" tabindex="0" title="Delete this view" aria-label="Delete view ' + esc(v.label) + '">' + ICO.x + '</span>' : '')
			+ '</span></button>';
	}

	function renderViews() {
		var b = el('#tndViewsBuiltin'), s = el('#tndViewsSaved');
		if (!b || !s) return;
		b.innerHTML = BUILTINS.map(function (v) { return viewRowHtml(v, false); }).join('');
		s.innerHTML = state.saved.map(function (v) { return viewRowHtml(v, true); }).join('');
		var note = el('#tndViewsEmpty');
		if (note) note.style.display = state.saved.length ? 'none' : 'block';
	}

	/** Switch to a view: write its filters into the controls, then redraw. */
	function applyView(key, redraw) {
		var v = findView(key) || resolveDefault();
		state.currentKey = v.key;
		/* B1. Which view am I in, answered without opening the menu. The button showed the name in
		   a 60px slot and nothing else, so on a list of thousands "why is this child here" had no
		   answer on screen. Name plus size, and the button carries the key so CSS can mark a view
		   that is not the roster. */
		var nameEl = el('#tndViewName');
		if (nameEl) nameEl.textContent = v.label;
		var trg = el('.tnd-viewsw-trg');
		if (trg) trg.setAttribute('data-view', v.key);
		renderViewCountChip();
		renderViews();
		if (window.TndChildren && typeof window.TndChildren.writeFilters === 'function') {
			window.TndChildren.writeFilters(v.filters || {});
		}
		syncChips();
		if (redraw !== false && window.TndChildren && typeof window.TndChildren.applyFilters === 'function') {
			window.TndChildren.applyFilters();
		}
	}

	/* ---------------- landing on a view somebody else picked ----------------
	   The child form is what uses this: after a CREATE it knows which view holds the child that was
	   just made, and the user has to end up there rather than on whichever view they happened to be
	   standing on. Two routes in, because the form has two ways of being open:

	   - the side pane, where the list is already up: showView() below, called directly.
	   - the full-page editor, which NAVIGATES back to the list: the key travels in sessionStorage
	     and init() picks it up. It cannot travel in the url, because the SPA addresses pages by
	     hash and a hash carries no query string.

	   PENDING_KEY is read once per init and removed as it is read, and it carries the time it was
	   written. A key left behind (the user clicks another nav item while the list is still loading,
	   so no init ever runs) would otherwise hijack the next ordinary visit to this list, and that
	   looks exactly like the starred default view being ignored. A handoff is only ever a second or
	   two old, so anything older than PENDING_TTL is somebody's leftover and is dropped. */
	var PENDING_KEY = 'tndChildrenView';
	var PENDING_TTL = 60000;

	/** Read and CONSUME the view the child form asked us to land on. '' when there is none. */
	function takePendingView() {
		var raw = '';
		try {
			raw = window.sessionStorage.getItem(PENDING_KEY) || '';
			if (raw) { window.sessionStorage.removeItem(PENDING_KEY); }
		} catch (e) { return ''; }
		if (!raw) { return ''; }
		var bits = raw.split('|');
		var key = bits[0];
		var at = parseInt(bits[1], 10);
		if (!isNaN(at) && (Date.now() - at) > PENDING_TTL) { return ''; }
		// Only a built-in: the form computes these server-side, and a saved view's key is per admin.
		for (var i = 0; i < BUILTINS.length; i++) { if (BUILTINS[i].key === key) return key; }
		return '';
	}

	/**
	 * Land the live list on a named view, for the child form's post-create redirect.
	 *
	 * Returns TRUE only when it actually switched view, because that is what tells the caller not
	 * to redraw the table itself. FALSE covers three cases and all three want the caller's own
	 * in-place redraw instead:
	 *
	 *  - not the children list. The child form opens in the side pane over OTHER lists too (the
	 *    retired Waiting List page still links `children/add?page=waitlist`), and `state` survives
	 *    SPA navigation, so without the dom check this would happily rewrite a different page's
	 *    table through a stale closure. Checked against the dom, which cannot be stale.
	 *  - a key we do not know.
	 *  - ALREADY ON THAT VIEW, which is the common case: an enrolled child created from the
	 *    Enrolled roster. Switching to the view you are on is not a no-op here, because writing a
	 *    view RESETS every filter it does not name (see writeFilters). Somebody adding eight
	 *    children to one class would have had their Branch and Class cleared and been thrown back
	 *    to page 1 eight times, for a "redirect" to the list already on screen.
	 *
	 * The search box is cleared either way, and that is deliberate: the flow this exists for is
	 * "search for a child, do not find them, add them", and a term still in the box would filter
	 * the new child straight back off the list we have just brought the user to.
	 */
	function showView(key) {
		if (!key || !state || !el('.tnd-children-page') || !findView(key)) { return false; }
		var search = el('#tndSearch'), wrap = el('#tndSearchWrap');
		if (search && search.value !== '') {
			search.value = '';
			if (wrap) { wrap.classList.remove('has-val'); }
			var t = dt();
			// State only: the redraw that follows (here or in the caller) is the one that fetches,
			// and two draws in flight against one table is how this page shows the older answer.
			if (t) { t.search(''); }
		}
		if (key === state.currentKey) { return false; }
		applyView(key);
		return true;
	}

	/* The count beside the view name in the button itself. Rebuilt rather than patched so it cannot
	   be left showing the previous view's number while the new one loads. */
	function renderViewCountChip() {
		var trg = el('.tnd-viewsw-trg');
		if (!trg) return;
		var old = trg.querySelector('.cnt');
		if (old) old.parentNode.removeChild(old);
		if (!state.counts || !(state.currentKey in state.counts)) return;
		var chip = document.createElement('span');
		chip.className = 'cnt';   // the pill tendi-children.css already styles for this button
		chip.textContent = Number(state.counts[state.currentKey]).toLocaleString();
		var car = trg.querySelector('.car');
		if (car) trg.insertBefore(chip, car); else trg.appendChild(chip);
	}

	/* One request, every view's size. Fired once per page visit and again after any action that
	   moves a child between views, because a stale count is a lie told with authority. Failure is
	   silent on purpose: counts are an aid, and a page that will not render its list because a
	   badge could not be drawn is a worse page. */
	function loadCounts() {
		if (!state.urls || !state.urls.viewCounts) return;
		post(state.urls.viewCounts, {}, function (r) {
			if (!r || r.success !== 1 || !r.data) return;
			state.counts = r.data;
			renderViewCountChip();
			renderViews();
		}, function () { /* silent: see above */ });
	}

	function bindViewMenu() {
		var menu = el('#tndViewMenu');
		if (!menu) return;
		menu.addEventListener('click', function (e) {
			var star = e.target.closest('[data-star]');
			if (star) {
				e.stopPropagation();
				var sk = star.getAttribute('data-star');
				var next = (state.defaultKey === sk) ? '' : sk;   // clicking the current default unsets it
				state.defaultKey = next;
				renderViews();
				post(state.urls.setDefault, { key: next }, function (r) {
					// Trust the server's resolved answer: it is the one that survives a reload.
					if (r && r.success === 1 && r.data) state.defaultKey = r.data['default'] === FALLBACK_KEY && next === '' ? '' : (next === '' ? '' : next);
					renderViews();
				});
				return;
			}
			var del = e.target.closest('[data-del]');
			if (del) {
				e.stopPropagation();
				var dk = del.getAttribute('data-del');
				var v = findView(dk);
				if (!v || !v.id) return;
				var go = function (ok) {
					if (!ok) return;
					post(state.urls.deleteView, { id: v.id }, function (r) {
						if (!r || r.success !== 1) {
							if (window.jAlert) jAlert((r && r.message) || 'That view could not be deleted.', 'Failed', 'danger');
							return;
						}
						state.saved = state.saved.filter(function (x) { return x.key !== dk; });
						if (state.defaultKey === dk) state.defaultKey = '';
						// Deleting the view you are ON must not strand the page: fall back.
						if (state.currentKey === dk) applyView(resolveDefault().key);
						else renderViews();
						if (window.tndToast) tndToast.success('View deleted');
					});
				};
				if (window.jConfirm) jConfirm('Delete the view "' + v.label + '"? The children in it are not affected.', 'Delete view', 'danger', go);
				else go(window.confirm('Delete the view "' + v.label + '"?'));
				return;
			}
			var row = e.target.closest('[data-view]');
			if (row) { applyView(row.getAttribute('data-view')); closeAllMenus(); }
		});
		// the star / delete affordances are spans inside a button, so give them keyboard parity
		menu.addEventListener('keydown', function (e) {
			if (e.key !== 'Enter' && e.key !== ' ') return;
			var hit = e.target.closest('[data-star],[data-del]');
			if (!hit) return;
			e.preventDefault();
			hit.click();
		});
	}

	function saveCurrentAsView() {
		var suggested = suggestViewName();
		var go = function (name) {
			name = (name || '').trim();
			if (!name) return;
			var filters = (window.TndChildren && window.TndChildren.readFilters) ? window.TndChildren.readFilters() : {};
			post(state.urls.saveView, { name: name, filters: filters }, function (r) {
				if (!r || r.success !== 1) {
					if (window.jAlert) jAlert((r && r.message) || 'That view could not be saved.', 'Failed', 'danger');
					return;
				}
				// Upsert locally too: saving over an existing name updates that row, it does not add one.
				var existing = null;
				state.saved.forEach(function (v) { if (v.key === r.data.key) existing = v; });
				if (existing) { existing.label = r.data.name; existing.filters = filters; }
				else state.saved.push({ key: r.data.key, id: r.data.id, label: r.data.name, filters: filters });
				state.currentKey = r.data.key;
				var nameEl = el('#tndViewName');
				if (nameEl) nameEl.textContent = r.data.name;
				renderViews();
				closeFilterPop();
				if (window.tndToast) tndToast.success('View saved');
			});
		};
		// jPrompt takes FIVE args: (message, value, title, dialogClass, callback). Passing four put
		// the callback in dialogClass, so the dialog opened, OK did nothing, and the view never saved.
		if (typeof window.jPrompt === 'function') jPrompt('Name this view', suggested, 'Save view', 'primary', go);
		else go(window.prompt('Name this view', suggested));
	}

	/** A name built from what is actually filtered, so the prompt is never blank. */
	function suggestViewName() {
		var bits = [];
		els('#tndAfChips .tnd-afchip').forEach(function (c) {
			var v = c.getAttribute('data-label');
			if (v) bits.push(v);
		});
		return bits.length ? bits.slice(0, 3).join(', ') : 'My view';
	}

	/* ============================================================
	   ACTIVE FILTER CHIPS
	   ============================================================ */
	/**
	 * Rebuild the chip row from the live controls. Each chip carries the id of the control it
	 * represents, so removing it just resets that control and redraws: there is no second copy of
	 * the filter state to drift.
	 */
	function syncChips() {
		var wrap = el('#tndAfChips'), bar = el('#tndAfBar');
		if (!wrap || !bar) return;
		var chips = [];
		var hiddenCount = 0;

		els('[data-chipsrc]').forEach(function (node) {
			var label = node.getAttribute('data-chiplabel') || '';
			var inPopover = node.getAttribute('data-chiphidden') === '1';
			var value = '';

			if (node.tagName === 'INPUT' && node.type === 'checkbox') {
				if (node.checked) value = node.getAttribute('data-chipvalue') || 'On';
			} else if (node.tagName === 'INPUT') {
				value = (node.value || '').trim();
			} else if (node.tagName === 'SELECT') {
				// Works for multi as well as single: the placeholder option (value "") is the unset
				// state, so it is never a chip.
				var picked = chosenOptions(node);
				if (picked.length === 1) value = picked[0].text.trim();
				else if (picked.length > 1) value = picked.length + ' selected';
			}
			if (value === '') return;
			chips.push(
				'<span class="tnd-afchip" data-chip="' + esc(node.id) + '" data-label="' + esc(value) + '">'
				+ '<span class="k">' + esc(label) + '</span>' + esc(value)
				+ '<button type="button" aria-label="Remove the ' + esc(label) + ' filter">' + ICO.x + '</button></span>'
			);
			if (inPopover) hiddenCount++;
		});

		wrap.innerHTML = chips.join('');
		bar.classList.toggle('is-on', chips.length > 0);

		// The badge counts only what is HIDDEN behind the Filters button. Branch and Class are
		// visible in the bar, so counting them would be telling the user about something they can
		// already see.
		var btn = el('#tndFiltBtn'), badge = el('#tndFiltBadge');
		if (btn && badge) {
			badge.textContent = hiddenCount;
			btn.classList.toggle('has-n', hiddenCount > 0);
		}
	}

	function bindChips() {
		var wrap = el('#tndAfChips');
		if (!wrap) return;
		wrap.addEventListener('click', function (e) {
			var btn = e.target.closest('button');
			if (!btn) return;
			var id = btn.closest('.tnd-afchip').getAttribute('data-chip');
			clearControl(id);
			syncChips();
			if (window.TndChildren) window.TndChildren.applyFilters();
		});
		var clear = el('#tndAfClear');
		if (clear) clear.addEventListener('click', function () { clearAllFilters(); });
	}

	function clearControl(id) {
		var node = $doc.getElementById(id);
		if (!node) return;
		if (node.tagName === 'INPUT' && node.type === 'checkbox') node.checked = false;
		else if (node.tagName === 'SELECT') { node.value = ''; refreshSelectUi(node); }
		else node.value = '';
		syncPillsFromInputs();
		syncInlineSelects();
	}

	function clearAllFilters() {
		els('[data-chipsrc]').forEach(function (node) {
			if (node.tagName === 'INPUT' && node.type === 'checkbox') node.checked = false;
			else if (node.tagName === 'SELECT') { deselectAll(node); refreshSelectUi(node); }
			else node.value = '';
		});
		syncPillsFromInputs();
		syncInlineSelects();
		syncChips();
		if (window.TndChildren) window.TndChildren.applyFilters();
	}

	/** Reset a select to its unset state. `.value = ''` alone does not clear a multi-select. */
	function deselectAll(sel) {
		Array.prototype.forEach.call(sel.options, function (o) { o.selected = (o.value === '' && !sel.multiple); });
		if (!sel.multiple) sel.value = '';
	}

	/** Nudge the custom dropdown component to redraw a native select we changed behind its back. */
	function refreshSelectUi(sel) {
		if (window.jQuery) jQuery(sel).trigger('change.tndsilent');
		if (window.TndSelect && typeof window.TndSelect.sync === 'function') window.TndSelect.sync(sel);
	}

	/* ============================================================
	   INLINE SELECTS (Branch + Class): the two hot filters stay in the bar
	   ============================================================ */
	/** The chosen <option>s, ignoring the "All …" placeholder (value ""). */
	function chosenOptions(sel) {
		return Array.prototype.filter.call(sel.options, function (o) { return o.selected && o.value !== ''; });
	}

	/**
	 * Label for an inline filter face. Branch is a MULTI select (it always was, it just looked
	 * single), so one pick shows the name and several show a count rather than a truncated list.
	 */
	function inlineLabel(wrap, sel) {
		var picked = chosenOptions(sel);
		if (!picked.length) return { text: wrap.getAttribute('data-empty'), set: false };
		if (picked.length === 1) return { text: picked[0].text.trim(), set: true };
		return { text: picked.length + ' ' + (wrap.getAttribute('data-plural') || 'selected'), set: true };
	}

	function syncInlineSelects() {
		els('.tnd-chl-sel').forEach(function (wrap) {
			var sel = $doc.getElementById(wrap.getAttribute('data-src'));
			if (!sel) return;
			var info = inlineLabel(wrap, sel);
			var lbl = el('.lbl', wrap);
			if (lbl) lbl.textContent = info.text;
			wrap.classList.toggle('is-set', info.set);
		});
	}

	function renderInlineMenu(wrap, menu, sel) {
		var multi = sel.multiple;
		menu.innerHTML = Array.prototype.map.call(sel.options, function (o) {
			var isAll = o.value === '';
			var label = isAll ? wrap.getAttribute('data-empty') : o.text.trim();
			// With nothing picked, the "All" row is the active one.
			var on = isAll ? chosenOptions(sel).length === 0 : o.selected;
			// The "All" row is a reset, not a co-selectable value: clicking it CLEARS the others and
			// there is no way to click it off again. Drawing it as a checkbox would promise a toggle
			// the handler does not implement, so it keeps the tick even on a multi.
			var box = (multi && !isAll) ? ICO.cbox(on) : (on ? ICO.tick : ICO.blank);
			return '<button type="button" class="tnd-chl-mi' + (on ? ' is-active' : '') + '" data-val="' + esc(o.value) + '">'
				+ box + '<span class="sp">' + esc(label) + '</span></button>';
		}).join('');
		if (multi) {
			menu.insertAdjacentHTML('beforeend', '<p class="tnd-chl-mnote">Pick more than one to combine them.</p>');
		}
	}

	function bindInlineSelects() {
		els('.tnd-chl-sel').forEach(function (wrap) {
			var srcId = wrap.getAttribute('data-src');
			var menu = el('.tnd-chl-menu', wrap);
			var trg = el('.trg', wrap);
			if (!menu || !trg) return;

			// Built from the LIVE <select> each time it opens, so a Class list repopulated by the
			// Branch change handler is picked up with no extra wiring.
			trg.addEventListener('click', function (e) {
				e.stopPropagation();
				var open = wrap.classList.contains('is-open');
				closeAllMenus();
				if (open) return;
				var sel = $doc.getElementById(srcId);
				if (!sel) return;
				renderInlineMenu(wrap, menu, sel);
				wrap.classList.add('is-open');
				menu.classList.add('is-open');
			});

			menu.addEventListener('click', function (e) {
				var opt = e.target.closest('[data-val]');
				if (!opt) return;
				e.stopPropagation();
				var sel = $doc.getElementById(srcId);
				if (!sel) return;
				var val = opt.getAttribute('data-val');

				if (sel.multiple) {
					if (val === '') {
						// "All branches" clears the selection instead of being a value of its own.
						Array.prototype.forEach.call(sel.options, function (o) { o.selected = false; });
					} else {
						Array.prototype.forEach.call(sel.options, function (o) {
							if (o.value === val) o.selected = !o.selected;
							if (o.value === '') o.selected = false;
						});
					}
				} else {
					sel.value = val;
				}

				// A real change event: the page's own Branch handler repopulates Class from it.
				if (window.jQuery) jQuery(sel).trigger('change');
				else sel.dispatchEvent(new Event('change', { bubbles: true }));

				syncInlineSelects();
				syncChips();
				// Multi stays open so several can be picked in one visit; single closes.
				if (sel.multiple) renderInlineMenu(wrap, menu, sel);
				else closeAllMenus();
			});
		});
	}

	/* ============================================================
	   FILTER POPOVER
	   ============================================================ */
	function closeFilterPop() {
		var pop = el('#tndFiltPop');
		if (pop) pop.classList.remove('is-open');
	}

	function bindPopover() {
		var btn = el('#tndFiltBtn'), pop = el('#tndFiltPop');
		if (!btn || !pop) return;
		btn.addEventListener('click', function (e) {
			e.stopPropagation();
			var open = pop.classList.contains('is-open');
			closeAllMenus();
			closeFilterPop();
			if (!open) pop.classList.add('is-open');
		});
		pop.addEventListener('click', function (e) { e.stopPropagation(); });

		var done = el('#tndPopDone');
		if (done) done.addEventListener('click', function () {
			closeFilterPop();
			if (window.TndChildren) window.TndChildren.applyFilters();
		});
		var clear = el('#tndPopClear');
		if (clear) clear.addEventListener('click', function (e) { e.stopPropagation(); clearAllFilters(); });
		var save = el('#tndSaveView');
		if (save) save.addEventListener('click', function (e) { e.stopPropagation(); saveCurrentAsView(); });

		// Program pills are a nicer face on the real checkboxes; the checkbox stays the source of
		// truth so the page's existing applyFilters() keeps reading exactly what it always read.
		els('.tnd-fpill').forEach(function (pill) {
			pill.addEventListener('click', function () {
				var box = $doc.getElementById(pill.getAttribute('data-for'));
				if (!box) return;
				box.checked = !box.checked;
				syncPillsFromInputs();
				syncChips();
				if (window.TndChildren) window.TndChildren.applyFilters();
			});
		});
	}

	function syncPillsFromInputs() {
		els('.tnd-fpill').forEach(function (pill) {
			var box = $doc.getElementById(pill.getAttribute('data-for'));
			pill.classList.toggle('is-on', !!(box && box.checked));
			pill.setAttribute('aria-pressed', box && box.checked ? 'true' : 'false');
		});
	}

	/* ============================================================
	   COLUMNS + DENSITY
	   ============================================================ */
	function dt() {
		if (!window.jQuery || !jQuery.fn.dataTable || !jQuery.fn.dataTable.isDataTable('#datatable-1')) return null;
		return jQuery('#datatable-1').DataTable();
	}

	/**
	 * A new search supersedes whatever is still on the wire.
	 *
	 * The table is built once and keeps one server-side page cache for the life of the page, and
	 * nothing in DataTables sequences its requests. Without this, a slow response for the PREVIOUS
	 * term can land after the newer one, repaint the rows and seed that cache, and the next page
	 * click then reads the wrong rows out of it without issuing a request at all.
	 */
	function abortInflight() {
		if (window.TndChildren && typeof window.TndChildren.abortInflight === 'function') {
			try { window.TndChildren.abortInflight(); } catch (e) {}
		}
	}

	function renderCols() {
		var list = el('#tndColList');
		if (!list) return;
		list.innerHTML = state.columns.map(function (c) {
			if (c.locked) {
				return '<div class="tnd-chl-mi colrow is-locked">' + ICO.blank
					+ '<span class="sp">' + esc(c.label) + '</span>'
					+ '<span class="lockwrap">' + ICO.lock + '<span class="lock">Always</span></span></div>';
			}
			return '<button type="button" class="tnd-chl-mi colrow' + (c.on ? ' is-active' : '') + '" data-col="' + esc(c.key) + '" aria-pressed="' + (c.on ? 'true' : 'false') + '">'
				+ (c.on ? ICO.tick : ICO.blank) + '<span class="sp">' + esc(c.label) + '</span></button>';
		}).join('');
	}

	/**
	 * Apply column visibility as CSS classes on the page root.
	 *
	 * NOT DataTables' column().visible(): that removes the <th> from the dom, and this page re-inits
	 * the table with `destroy: true` on every filter change, so the rebuilt table saw fewer header
	 * cells than the columns the server returns and threw mid-draw, leaving the list empty. Toggling
	 * a class keeps the column COUNT constant, which is the thing the header/row contract cares about.
	 *
	 * Locked columns are forced visible whatever a stored pref says, so a prefs blob written before a
	 * column became structural cannot hide it.
	 */
	function applyCols() {
		var page = el('.tnd-children-page');
		if (!page) return;
		state.columns.forEach(function (c) {
			page.classList.toggle('tnd-hide-' + c.key, !c.locked && !c.on);
		});
		// Showing or hiding a column re-lays out the table, so the frozen offset has to be re-measured.
		syncFrozenOffset();
	}

	function persistDisplay() {
		// Seed from what was stored so a column this tenant does not render keeps its saved value
		// (see storedColsRaw), then let the on-screen state win for everything we DO render.
		var map = {};
		if (storedColsRaw) {
			Object.keys(storedColsRaw).forEach(function (k) { map[k] = !!storedColsRaw[k]; });
		}
		state.columns.forEach(function (c) { if (!c.locked) map[c.key] = !!c.on; });
		if (colsLoaded) { map[COLS_MIGRATED_KEY] = true; }   // see the notes on both vars
		// Keep the local copy in step, so a second save in the same visit does not resurrect a value
		// this one just changed.
		storedColsRaw = map;
		post(state.urls.saveDisplay, { columns: map, density: state.density }, null, function () { /* non-critical */ });
	}

	function bindColumns() {
		var list = el('#tndColList');
		if (list) {
			list.addEventListener('click', function (e) {
				var b = e.target.closest('[data-col]');
				if (!b) return;
				e.stopPropagation();
				var key = b.getAttribute('data-col');
				state.columns.forEach(function (c) { if (c.key === key && !c.locked) c.on = !c.on; });
				renderCols();
				applyCols();
				persistDisplay();
			});
		}
		els('[data-density]').forEach(function (b) {
			b.addEventListener('click', function () {
				state.density = b.getAttribute('data-density');
				applyDensity();
				els('[data-density]').forEach(function (x) {
					var on = x === b;
					x.classList.toggle('is-active', on);
					var first = x.firstElementChild;
					if (first) first.outerHTML = on ? ICO.tick : ICO.blank;
				});
				persistDisplay();
				closeAllMenus();
			});
		});
	}

	/**
	 * Pin the frozen Child column at the checkbox column's ACTUAL width.
	 *
	 * The width is declared 40px but auto table layout negotiates it (it measured 38px), and the
	 * difference is a slot the scrolling columns show through, just left of the avatar. Measuring is
	 * the only reliable answer, because the real width moves with density, padding and font.
	 * Rounded UP so the columns overlap by a sub-pixel rather than leaving a hairline.
	 */
	function syncFrozenOffset() {
		var table = el('#datatable-1');
		if (!table) return;
		var f1 = el('thead th.tnd-f1', table) || el('tbody td.tnd-f1', table);
		if (!f1) return;
		var w = f1.getBoundingClientRect().width;
		if (!w) return;
		table.style.setProperty('--tnd-f1w', Math.ceil(w) + 'px');
	}

	function applyDensity() {
		var page = el('.tnd-children-page');
		if (!page) return;
		page.classList.remove('tnd-dens-compact', 'tnd-dens-comfortable', 'tnd-dens-roomy');
		page.classList.add('tnd-dens-' + state.density);
	}

	/**
	 * Put the page back where it belongs after the browser has scrolled it sideways.
	 *
	 * The list shell is `overflow: hidden auto` (tendi-skin.css, `body:has(.tnd-list-page) #content`).
	 * That still makes it a scroll container on BOTH axes: hidden suppresses the scrollbar, it does
	 * not stop the box from scrolling. So whenever a focusable control sits past its right edge, and
	 * the command bar puts several there whenever the page is narrower than the bar needs (the nav
	 * subpane open at 1280 leaves the bar 831px for 1040px of controls), focusing one of them makes
	 * the browser scroll the container sideways to reveal it. Nothing ever scrolls it back, because
	 * there is no scrollbar to scroll back with.
	 *
	 * The result is the reported defect: clicking Past / Current / Future leaves the ENTIRE page
	 * painted at a horizontal offset, and a different one per tab, because each button needs a
	 * different amount of scrolling to come into view (0px, 33px, 151.5px at 1280). Every margin,
	 * padding and column position on the page then reads as changed, and the page no longer matches
	 * a fresh load of the same tab.
	 *
	 * An axis whose overflow is hidden is by definition one the user cannot scroll, so any offset on
	 * it was the browser's doing and is always safe to undo. Bound to focusin, which fires inside the
	 * same synchronous focus() the scroll happens in, so the offset never reaches a paint.
	 *
	 * NOTE this treats the symptom. The cause is that the bar cannot wrap here: its wrap rule
	 * (tendi-children.css, `@media (max-width: 1180px)`) tests the VIEWPORT width, while the width
	 * the bar actually gets is the viewport minus the 88px rail, the 232px nav subpane and 48px of
	 * gutter. At a 1280 viewport that is 831px, well under the 1180 the rule was written for, but the
	 * media query does not fire and the bar stays nowrap and overflows.
	 */
	function unscrollHiddenAxis() {
		var node = el('.tnd-children-page');
		if (!node) return;
		for (; node && node !== document.documentElement; node = node.parentElement) {
			// scrollLeft first: it is a plain integer read, and it is 0 on every element every time
			// but the one that got scrolled, so getComputedStyle almost never runs.
			if (node.scrollLeft && getComputedStyle(node).overflowX === 'hidden') node.scrollLeft = 0;
		}
	}

	/* ============================================================
	   ROW ACTIONS (kebab) + BULK DOCK
	   ============================================================ */
	function rowMenuHtml(btn) {
		var trashed = btn.getAttribute('data-trashed') === '1';
		var active = btn.getAttribute('data-status') === 'active';
		// §7B: which lifecycle actions this row gets. The server puts the child's real
		// enrollment_status on the kebab; anything unrecognised reads as 'enrolled', matching
		// Enrollment_model::status_of(), so a half-migrated tenant sees the menu it had before.
		var enrollment = btn.getAttribute('data-enrollment_status') || 'enrolled';
		var out = '<div class="tnd-chl-menu r is-open" data-rowmenu>';
		out += '<button type="button" class="tnd-chl-mi" data-act="edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>Edit details</button>';
		// The two things the product never had. They lead the menu on a waiting row because they
		// are the only reason anyone opens it there.
		if (enrollment === 'waitlist') {
			out += '<div class="tnd-chl-msep"></div>';
			out += '<button type="button" class="tnd-chl-mi" data-act="enroll"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/></svg>Enroll</button>';
			out += '<button type="button" class="tnd-chl-mi" data-act="unwaitlist"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h6M3 6h.01M3 12h.01M3 18h.01"/><path d="m17 16 5 5m0-5-5 5"/></svg>Remove from waiting list</button>';
			out += '<div class="tnd-chl-msep"></div>';
		}
		out += '<button type="button" class="tnd-chl-mi" data-act="enrollhistory"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 8v4l3 2"/></svg>Enrollment history</button>';
		/* Bus timeline is a BUS feature, so on a tenant with transportation switched off it has
		   nothing to show and is greyed out rather than silently doing nothing. The header is the
		   signal: children_manage.php renders the Transportation `th` only under `$tndBusOn`, and
		   hiding a column is done with a class rather than by removing it, so an absent `th` means
		   the feature is off and not merely a column the user has hidden. Disabled instead of
		   removed on purpose: the item vanishing entirely reads as a bug of its own, and the reason
		   it cannot be used is worth stating. */
		var busOn = !!el('#datatable-1 thead th[data-colkey="trans"]');
		out += '<button type="button" class="tnd-chl-mi' + (busOn ? '' : ' is-disabled') + '" data-act="timeline"'
			+ (busOn ? '' : ' aria-disabled="true" title="Transportation is switched off for this account"')
			+ '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>Bus timeline (today)</button>';
		/* "Add a note" on a child who already has one is a small lie, and this card is about the
		   note control not saying what it does. The row's own cell already knows which state it is
		   in, so read it: `tnd-note-empty` marks "no note yet". The cell is in the dom even when the
		   Notes column is hidden, because hiding is done with a class rather than by removing the
		   cells, so this reads correctly either way. */
		var noteRow = btn.closest ? btn.closest('tr') : null;
		var noteCell = noteRow ? noteRow.querySelector('.child_note[data-note]') : null;
		var hasNote = !!(noteCell && !noteCell.classList.contains('tnd-note-empty'));
		out += '<button type="button" class="tnd-chl-mi" data-act="note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M9 13h6M9 17h4"/></svg>' + (hasNote ? 'View or edit note' : 'Add a note') + '</button>';
		if (!trashed) {
			/* NO Archive on a waiting row (asked for on https://trello.com/c/xhzraqrG).
			   Archiving is the "off every roster and report" state, and a waiting child is on none of
			   those yet, so the action had nothing to take away from them: what it did instead was
			   move the record into a view where the waiting list no longer counted it, with no
			   enrollment change to explain why the count dropped. "Remove from waiting list" above is
			   the action that actually means this, and Move to trash stays for the record itself.

			   Gated on `active`, not on the enrollment status alone, so the OTHER label this same
			   button carries survives: the Archived view lists every archived child whatever their
			   enrollment (Children.php, $onRecordStateView), waiting ones included, and dropping the
			   button there would leave those rows with no way back out of the archive. */
			// Named for the button, not for the verb: on an archived row this same item says
			// Unarchive, so a `canArchive` here would read as false exactly where it is true.
			var showStatusItem = !(active && enrollment === 'waitlist');
			out += '<div class="tnd-chl-msep"></div>';
			if (showStatusItem) {
				out += '<button type="button" class="tnd-chl-mi" data-act="status"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/></svg>' + (active ? 'Archive' : 'Unarchive') + '</button>';
			}
			out += '<button type="button" class="tnd-chl-mi danger" data-act="delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>Move to trash</button>';
		} else {
			out += '<div class="tnd-chl-msep"></div>';
			out += '<button type="button" class="tnd-chl-mi" data-act="untrash"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10H9"/></svg>Restore from trash</button>';
		}
		return out + '</div>';
	}

	/* Find the panel by its OWN attribute, never by `.tnd-rowmenu.is-open`.
	   tendi-list.js hangs a generic row flyout off that same `.tnd-rowmenu` class, and its
	   tndCloseFlyouts() does a blanket `$('.tnd-rowmenu').removeClass('is-open')` on every outside
	   click. That bundle loads first, so its document handler ran first and stripped the class, and
	   the lookup here then matched nothing and removed nothing. The panel stayed in the dom still
	   carrying its own `is-open` (which is what `display: flex` keys off), so the menu sat there
	   through click after click: the "flyout menu not closing when clicking away" report. Keying off
	   `[data-rowmenu]` makes the close independent of who cleared the wrap's class first, and it also
	   sweeps up any panel orphaned by an earlier pass. */
	/* Timestamp of the last open, and the cheap early-out for the scroll listener below.
	   Read it as: 0 means definitely nothing open, non-zero means MAYBE. A DataTables redraw
	   (applyView, or the shared list layer) replaces the tbody wholesale and takes the panel with
	   it without coming through closeRowMenus(), and so does leaving the page, either of which
	   leaves the timestamp behind. That costs one wasted closeRowMenus() on the next scroll, which
	   removes nothing and resets this to 0, so it self-corrects and cannot wedge. */
	var rowMenuOpenedAt = 0;
	function closeRowMenus() {
		rowMenuOpenedAt = 0;
		els('[data-rowmenu]').forEach(function (m) {
			var w = m.parentNode;
			if (!w) return;
			if (w.classList) w.classList.remove('is-open');
			w.removeChild(m);
		});
		els('.tnd-rowmenu.is-open').forEach(function (w) { w.classList.remove('is-open'); });
		// Reset here rather than only in closeAllMenus(), because the scroll and action paths call
		// this one directly and would otherwise leave the kebab claiming aria-expanded="true".
		els('.tnd-kebab[aria-expanded="true"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
	}

	/* Place the panel so it is never cut off by the table's scroll box.
	   The css anchors it with `position: absolute; top: calc(100% + 7px)` inside the cell, which two
	   ancestors then clip: `.tnd-table-scroll` (overflow:auto) and `.tnd-table-clip`
	   (overflow:hidden). On the last rows of a page the whole menu therefore rendered below the
	   visible bottom of the table and could not be reached at all. Switching to `position: fixed`
	   escapes both clips (plain overflow does not clip a fixed descendant) and is the same trick
	   tendi-list.js already uses for its generic `.tnd-rowmenu-pop`.

	   Then measure, against the bottom of the scroll box, which is the edge the card is about: when
	   the panel does not fit below the kebab, open it upward. The flip is conditional on it actually
	   FITTING above, not merely on there being more room above than below. Once the panel is fixed
	   the container has stopped clipping it, so "does not fit inside the container" no longer means
	   "will be invisible": on a short table (the clip is floored at 320px on this page) a tall
	   waiting-row menu fits neither way, and flipping it then would push it up over the sticky
	   command bar for no gain, when leaving it below and clamping to the viewport shows all of it. */
	var ROWMENU_GAP = 7;      // matches the `calc(100% + 7px)` offset the css uses when anchored
	var ROWMENU_EDGE = 8;     // keep this much clear of the viewport edges
	function placeRowMenu(menu, kebab) {
		if (!menu || !kebab) return;
		var r = kebab.getBoundingClientRect();
		var scroller = kebab.closest ? kebab.closest('.tnd-table-scroll') : null;
		var cr = scroller ? scroller.getBoundingClientRect() : null;
		// Pin FIRST, then measure. `is-fixed` carries the max-height, so measuring before it would
		// read the panel's unclamped natural height and place a shorter element by it.
		menu.classList.add('is-fixed');
		// Measured, not assumed: the panel's height depends on which actions this row offers
		// (a waiting row carries two extra items, a trashed row two fewer).
		var mh = menu.offsetHeight, mw = menu.offsetWidth;
		var limitBottom = Math.min(cr ? cr.bottom : Infinity, window.innerHeight - ROWMENU_EDGE);
		var limitTop = Math.max(cr ? cr.top : 0, ROWMENU_EDGE);
		var up = mh > (limitBottom - (r.bottom + ROWMENU_GAP))   // does not fit below
			&& mh <= ((r.top - ROWMENU_GAP) - limitTop);         // and genuinely fits above
		var top = up ? (r.top - ROWMENU_GAP - mh) : (r.bottom + ROWMENU_GAP);
		top = Math.max(ROWMENU_EDGE, Math.min(top, window.innerHeight - ROWMENU_EDGE - mh));
		// Right-aligned to the kebab, which is what the css `.r` variant did while anchored.
		var left = Math.max(ROWMENU_EDGE, Math.min(r.right - mw, window.innerWidth - ROWMENU_EDGE - mw));
		menu.style.top = Math.round(top) + 'px';
		menu.style.left = Math.round(left) + 'px';
	}

	function bindRowActions() {
		var table = el('#datatable-1');
		if (!table) return;

		table.addEventListener('click', function (e) {
			/* NO note handler here any more. The note affordance was `.tnd-noteflag`, a pill under the
			   child's name; it is a real Notes column beside the name now and `.child_note` is bound
			   once, with .off(), in children_manage.php next to the modal it opens. Routing it from
			   both places meant one click ran openNote twice. tendi-list.js already excludes
			   `.child_note` from "click the row to open the child", so the cell does not also open the
			   side pane. */
			var kebab = e.target.closest('.tnd-kebab');
			if (kebab) {
				e.stopPropagation();
				var wrap = kebab.closest('.tnd-rowmenu');
				var wasOpen = wrap.classList.contains('is-open');
				closeAllMenus();
				if (wasOpen) return;
				wrap.insertAdjacentHTML('beforeend', rowMenuHtml(kebab));
				wrap.classList.add('is-open');
				kebab.setAttribute('aria-expanded', 'true');
				// Position only after it is in the dom and painted, so offsetHeight is the real height.
				placeRowMenu(el('[data-rowmenu]', wrap), kebab);
				rowMenuOpenedAt = Date.now();
				return;
			}

			var item = e.target.closest('[data-act]');
			if (item) {
				e.stopPropagation();
				// An action this account cannot use is inert: it neither runs nor dismisses the menu,
				// so the click reads as "this one does nothing" instead of as a mis-click. Marked
				// with aria-disabled rather than the `disabled` attribute because Chrome and Edge
				// swallow pointer events on a disabled control, and its title tooltip never appears:
				// the item would be greyed with no way to find out why.
				if (item.getAttribute('aria-disabled') === 'true') return;
				var btn = el('.tnd-kebab', item.closest('.tnd-rowmenu'));
				// The close runs in a `finally` so an action that throws cannot leave the panel
				// stranded on screen, which is how the dead Bus timeline item used to leave one
				// behind on every attempt: it threw on the way out of runRowAction and the close
				// never ran. (The separate reason a menu would not close on an outside click is the
				// tndCloseFlyouts ordering described above closeRowMenus.)
				try {
					runRowAction(item.getAttribute('data-act'), btn);
				} finally {
					closeRowMenus();
				}
				return;
			}

			/* NO row-click handler here on purpose.
			   tendi-list.js already owns "click the row → open the read-only side pane with its
			   tabs, then Edit flips it editable", which is the behaviour this page had before and
			   the one the rest of the reskinned lists share. An `edit` handler here as well meant
			   both fired: the pane opened AND the full-page editor loaded behind it. */
		});
	}

	function runRowAction(act, btn) {
		if (!btn) return;
		var id = btn.getAttribute('data-child_id');
		var name = btn.getAttribute('data-child_name');
		switch (act) {
			case 'edit':
				// Open the side pane in EDIT mode, the same thing the old row pencil did (its
				// .ajax-page-link was intercepted by tendi-list.js). LoadAjaxContent would instead
				// navigate the whole SPA to the full-page editor, losing the list behind it.
				var url = btn.getAttribute('data-edit_url');
				if (window.TndListDrawer && window.TndListDrawer.open) window.TndListDrawer.open(url, 'Edit');
				else if (window.LoadAjaxContent) window.LoadAjaxContent(url);
				break;
			case 'timeline':
				// The BUS timeline for one day, which is what window.child_timeline has always been.
				// It is handed a purpose-built source element: not null, and not the kebab.
				//
				// Not null, because child_timeline's first line is
				// `jqView(event.target).parents('a.child-location-link')` (its bail-out for clicks on
				// the location link in a bus report row). `null` threw "Cannot read properties of
				// null (reading 'target')" before it did anything at all: nothing opened and nothing
				// was requested, which is why the item read as dead.
				//
				// Not the kebab, because once the modal is up child_timeline copies EVERY attribute
				// off the element it was given onto the modal's refresh button (all but id / href /
				// data-date), and that copied `onclick` IS the refresh wiring: nothing in the app
				// binds #refresh_child_timeline. Both legacy callers are markup carrying
				// `onclick="child_timeline(event, this)"`. The kebab carries no onclick, so refresh
				// and the modal's date picker (which fires that same click) would both be dead, and
				// the kebab's `class` would be copied too, painting the refresh control as a row
				// kebab inside the modal header.
				//
				// data-date is stated rather than left out: the menu item promises "(today)", and
				// with it unset child_timeline falls back to reading `#filtr_date`, which on a second
				// open still holds the date last picked for the PREVIOUS child.
				if (!window.child_timeline) break;
				var src = $doc.createElement('span');
				src.setAttribute('data-child_id', id || '');
				src.setAttribute('data-child_name', name || '');
				src.setAttribute('data-date', todayYmd());
				src.setAttribute('onclick', 'child_timeline(event, this)');
				window.child_timeline({ target: src }, src);
				break;
			// §7B lifecycle actions. The page owns the modals and the POSTs (children_manage.php),
			// this module only routes the click, the same split every other row action uses.
			case 'enroll':
				if (window.TndChildren && window.TndChildren.openEnroll) window.TndChildren.openEnroll(id, name);
				break;
			case 'unwaitlist':
				if (window.TndChildren && window.TndChildren.openUnwaitlist) window.TndChildren.openUnwaitlist(id, name);
				break;
			case 'enrollhistory':
				if (window.TndChildren && window.TndChildren.openEnrollHistory) window.TndChildren.openEnrollHistory(id, name);
				break;
			case 'note':
				if (window.TndChildren && window.TndChildren.openNote) window.TndChildren.openNote(id, null);
				break;
			case 'status':
				if (window.TndChildren && window.TndChildren.setStatus) window.TndChildren.setStatus(id, btn.getAttribute('data-status') !== 'active');
				break;
			case 'delete':
				if (window.deleteConfirm) window.deleteConfirm(id);
				break;
			case 'untrash':
				if (window.unTrashConfirm) window.unTrashConfirm(id);
				break;
		}
	}

	/* ============================================================
	   BULK SELECTION DOCK
	   ------------------------------------------------------------
	   The header checkbox used to tick `#datatable-1 tbody .inputBatchOperations` and stop there, and
	   the dock counted the same nodes. That is every row DataTables has PAINTED, which on a
	   server-side table is one page: on a view holding 1,325 children, "select all" selected 50, the
	   dock said 50, and Delete trashed 50. Nothing was wrong on screen, which is what made it
	   dangerous, because the operator had asked for all of them and been given a page.

	   So selection now has two modes and the dock always says which one it is in:

	     PAGE      the rows the user ticked by hand. The checkboxes are the state.
	     MATCHING  every child the current filters + search return, fetched from Children::allIds(),
	               which is built on the same query body get() uses. The id list is the state, and the
	               visible checkboxes are only its shadow.

	   Three rules keep the number honest, and each one exists because the alternative lies:

	     · The count shown is the count that will be acted on. In MATCHING mode that is
	       selAll.ids.length, not the ticks on screen, and the actions read the same list through
	       selectedIds().
	     · MATCHING is pinned to the filter signature it was fetched for. Change a filter, the search
	       or the view and it drops back to PAGE rather than carrying 1,325 ids belonging to a list
	       nobody is looking at any more.
	     · While the fetch is in flight the dock is BUSY and the actions are disabled. Without that
	       there is a window of a few hundred milliseconds in which the dock still says 50 and Delete
	       would act on 50, right after the user asked for everything.
	   ============================================================ */
	/* `token` is the generation counter, and it is what the filter signature cannot do on its own.
	   Untick a row while the ids are still on the wire and the selection has been cancelled BY THE
	   USER, with the filters completely unchanged: the signature still matches, so without this the
	   response would land, set MATCHING and re-tick the very row they had just cleared. Every
	   clearSelectAll() moves the counter, and a response whose counter has moved is discarded. */
	var selAll = { on: false, pending: false, ids: [], sig: '', token: 0 };
	// Set only by selVoidIfStale(), read once by the actions. See the note there.
	var staleVoid = false;

	function selQuery() {
		var q = (state && typeof state.getQuery === 'function') ? state.getQuery() : null;
		return {
			filters: (q && q.filters) ? q.filters : {},
			search: (q && typeof q.search === 'string') ? q.search : ''
		};
	}
	/* What "the same list" means. Anything that changes which children come back has to change this
	   string, or a stale id set survives into a list it does not describe. Unserialisable filters
	   return a unique value so the comparison fails closed (drop MATCHING) rather than open. */
	function selSig() {
		var q = selQuery();
		try { return JSON.stringify(q.filters) + ' ' + q.search; }
		catch (e) { return 'nosig:' + Date.now() + ':' + Math.random(); }
	}
	function pageBoxes() { return els('#datatable-1 tbody .inputBatchOperations'); }

	/* THE SIGNATURE IS CHECKED ON EVERY READ, not only on redraw.
	   onDraw() used to be the only place it was re-checked, and a redraw is not instant: measured a
	   1,616 ms window after switching view in which the ids were still the old view's, the count
	   still matched them, and the dock still read "every child in this view" over a view that now
	   held 3,010 different children. The count was true and the SENTENCE was the lie, which is the
	   harder kind to notice.

	   Fails CLOSED. A signature that has moved does not fall back to the ticks on screen, because
	   those rows belong to the outgoing list too: it voids the selection outright. The user asked
	   for "everything matching X" and is now looking at Y, and there is no honest way to turn the
	   first into an answer about the second. */
	function selStale() {
		return (selAll.on || selAll.pending) && selSig() !== selAll.sig;
	}
	function selVoidIfStale() {
		if (!selStale()) { return false; }
		clearSelectAll();
		pageBoxes().forEach(function (c) { c.checked = false; });
		var m = el('#markAll');
		if (m) { m.checked = false; m.indeterminate = false; }
		/* REMEMBER WHY IT WENT, not just that it went. Set AFTER clearSelectAll(), which resets it,
		   so a deliberate clear (the dock's X, unticking a row) never leaves it standing.

		   Without this the user gets the wrong sentence at the wrong moment: the void usually
		   happens on the first read after the filters move, which is some syncDock() deep in a
		   redraw, so by the time they press Delete the selection is merely EMPTY and the action says
		   "Please select to delete record". That is true and useless. They picked 1,335 children and
		   are owed the reason those are gone, which is that the list moved underneath them. */
		staleVoid = true;
		return true;
	}
	function selCount() {
		selVoidIfStale();
		return selAll.on ? selAll.ids.length : pageBoxes().filter(function (c) { return c.checked; }).length;
	}
	/** The ids a bulk action must act on, whichever mode the dock is in. Strings, as the checkboxes hold them. */
	function selectedIds() {
		selVoidIfStale();
		if (selAll.on) return selAll.ids.slice();
		return pageBoxes().filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
	}
	function clearSelectAll() {
		selAll.on = false;
		selAll.pending = false;
		selAll.ids = [];
		selAll.sig = '';
		selAll.token++;
		// A clear is a clear. Only selVoidIfStale() re-raises this, immediately after calling here.
		staleVoid = false;
	}
	/** Untick everything and drop back to PAGE. Used by the dock's X and after a bulk action. */
	function clearSelection() {
		clearSelectAll();
		pageBoxes().forEach(function (c) { c.checked = false; });
		var m = el('#markAll');
		if (m) { m.checked = false; m.indeterminate = false; }
		syncDock();
	}
	/** Fetch every id matching the filters currently applied and switch the dock to MATCHING. */
	function selectAllMatching() {
		var sig = selSig();
		// The page binds this to click AND change on one checkbox, so a single user click arrives
		// twice. Answering the second one with a second request would also let the slower response
		// win. Same signature, already asked: nothing to do.
		if (selAll.pending && selAll.sig === sig) return;
		if (selAll.on && selAll.sig === sig) { syncDock(); return; }
		if (!state || !state.urls || !state.urls.allIds) { syncDock(); return; }

		var q = selQuery();
		selAll.pending = true;
		selAll.sig = sig;
		var token = selAll.token;
		syncDock();
		jQuery.ajax({
			url: state.urls.allIds, type: 'POST', dataType: 'json',
			data: { filters: q.filters, search: q.search },
			success: function (r) {
				// Cancelled while it was on the wire: the user unticked a row, cleared the dock or
				// left. Say nothing and change nothing; they have already told us what they meant.
				if (selAll.token !== token) return;
				// A response for filters that have since changed describes a list nobody is looking
				// at. Drop it rather than select by it.
				if (selSig() !== sig) { clearSelectAll(); syncDock(); return; }
				selAll.pending = false;
				if (!r || r.success !== 1 || !r.ids) {
					clearSelectAll();
					syncDock();
					if (window.tndToast) tndToast.error('Only the children on this page are selected: the full list could not be read.');
					return;
				}
				/* Nothing to select. Left as MATCHING it would leave the header box ticked over an
				   empty list with a hidden dock, which reads as a selection the user cannot see or
				   clear.

				   TWO DIFFERENT REASONS, and the second one has to be said out loud. Either the list
				   really is empty, or the list has rows the server will not let this account act on:
				   allIds() counts what a bulk action may touch, and a branch-scoped user has no
				   claim to a child who sits in no branch at all (the No-class, Archived and Trash
				   views carry those). Ticking select-all over 981 visible rows and silently getting
				   nothing is exactly the sort of quiet nothing this card exists to remove. */
				if (!r.ids.length) {
					var hadRows = pageBoxes().length > 0;
					/* Untick the page too. The header click ticked the visible rows on the way in for
					   the immediate feedback, and clearing only the id list left those 50 ticks
					   standing under a dock reading "50 selected" beside a message saying nothing was
					   selected. The message is the true one, so the checkboxes have to agree with it. */
					clearSelection();
					if (hadRows) {
						var msg = 'None of the children in this view can be changed from your account, so nothing was selected. '
							+ 'They are not in a branch you manage.';
						if (window.tndToast) tndToast.error(msg);
						else if (window.jAlert) jAlert(msg, 'Nothing selected', 'danger');
					}
					return;
				}
				selAll.on = true;
				selAll.ids = r.ids.map(String);
				pageBoxes().forEach(function (c) { c.checked = true; });
				syncDock();
			},
			/* FAIL LOUDLY AND SMALL. Silence here would leave the page ticked and the dock reading
			   50 after the user asked for 1,325, which is the exact confusion this whole change is
			   about. The rows on screen stay selected, because the user did tick them, and the
			   sentence says that is all this is. */
			error: function () {
				if (selAll.token !== token) return;
				clearSelectAll();
				syncDock();
				if (window.tndToast) tndToast.error('Only the children on this page are selected: the full list could not be read.');
				else if (window.jAlert) jAlert('Only the children on this page are selected: the full list could not be read.', 'Partly selected', 'danger');
			}
		});
	}

	function syncDock() {
		var dock = el('#tndSelDock');
		if (!dock) return;
		var all = pageBoxes();
		var checked = all.filter(function (c) { return c.checked; }).length;
		var n = selCount();

		var cnt = el('#tndSelN');
		if (cnt) cnt.textContent = n.toLocaleString();
		// The Delete button carries the same number as the count, because it is the button that acts
		// on it. tendi-list.js writes `.tnd-sel-count` on a `#btnDelete` inside any .tnd-list-generic
		// page from the ticks on screen; this page's button is deliberately NOT called that, so the
		// two cannot write different numbers into the same bar.
		var delN = el('#tndDelN');
		if (delN) delN.textContent = n > 0 ? ' (' + n.toLocaleString() + ')' : '';

		var scope = el('#tndSelScope');
		if (scope) {
			scope.textContent = selAll.pending ? 'reading the full list…'
				: (selAll.on ? 'every child in this view' : '');
		}
		dock.classList.toggle('is-busy', !!selAll.pending);
		// Disabled as well as pointer-blocked, so the keyboard cannot reach them either while the
		// count on the bar is not yet the count the action would use.
		els('#tndSelDock .tnd-dockbtn').forEach(function (b) { b.disabled = !!selAll.pending; });
		dock.classList.toggle('is-on', n > 0 || !!selAll.pending);

		var markAll = el('#markAll');
		if (markAll) {
			markAll.checked = selAll.on || (all.length > 0 && checked === all.length);
			markAll.indeterminate = !selAll.on && checked > 0 && checked < all.length;
		}
	}

	/* A redraw replaces every <tr>, so the ticks are gone even though the selection is not. In
	   MATCHING mode the new page's rows belong to the same selection and are re-ticked; if the
	   filters moved under it, the id list is stale and the mode drops. Called from the page's own
	   draw.dt handler, which is already bound once with .off(). */
	function onDraw() {
		// selVoidIfStale() is the same check every other reader makes now; this is the one that also
		// re-ticks, because a redraw of the SAME list is a page change and the new rows belong to
		// the selection that survived it.
		if (!selVoidIfStale() && selAll.on) {
			pageBoxes().forEach(function (c) { c.checked = true; });
		}
		syncDock();
	}

	function bindDock() {
		var dock = el('#tndSelDock');
		if (!dock) return;
		var x = el('#tndDockX');
		if (x) x.addEventListener('click', clearSelection);
	}

	/* ============================================================
	   MENUS (generic open/close)
	   ============================================================ */
	function closeAllMenus() {
		els('[data-menu].is-open').forEach(function (w) {
			w.classList.remove('is-open');
			var b = el('[data-menu-body]', w);
			if (b) b.classList.remove('is-open');
		});
		els('.tnd-chl-sel.is-open').forEach(function (w) {
			w.classList.remove('is-open');
			var m = el('.tnd-chl-menu', w);
			if (m) m.classList.remove('is-open');
		});
		// The kebab aria sweep lives in closeRowMenus() now, so that the scroll, resize and action
		// paths (which call it directly) reset it too. Calling it here as well would be a second
		// pass over the same nodes for nothing.
		closeRowMenus();
	}

	function bindMenus(root) {
		root.addEventListener('click', function (e) {
			var trg = e.target.closest('[data-menu-trg]');
			if (!trg) return;
			e.stopPropagation();
			var wrap = trg.closest('[data-menu]');
			var open = wrap.classList.contains('is-open');
			closeAllMenus();
			closeFilterPop();
			if (!open) {
				wrap.classList.add('is-open');
				var body = el('[data-menu-body]', wrap);
				if (body) body.classList.add('is-open');
			}
		});
	}

	/* ---------------- document-level listeners, bound once ---------------- */
	function onDocClick(e) {
		if (!e.target.closest('.tnd-children-page') && !e.target.closest('[data-rowmenu]')) {
			closeAllMenus();
			closeFilterPop();
			return;
		}
		if (!e.target.closest('[data-menu]') && !e.target.closest('.tnd-chl-sel') && !e.target.closest('#tndFiltPop') && !e.target.closest('.tnd-rowmenu')) {
			closeAllMenus();
			closeFilterPop();
		}
	}
	/* Dismiss the pinned row menu when anything scrolls under it. Four guards, in this order, and
	   each one is load-bearing:
	   · `rowMenuOpenedAt` first, because it is a plain number and this is the hot path. This
	     listener is bound in capture phase on the document, it is never unbound, and the module
	     re-evaluates on every SPA visit to this page (verified: window.TndChildrenList is a
	     different object after navigating away and back), so copies accumulate and every one of
	     them runs on every scroll frame of every list page. Without a cheap first check each copy
	     would pay for document-wide queries per frame.
	   · Opening the menu can itself produce a scroll: unscrollHiddenAxis() writes scrollLeft on
	     focusin, and focus lands on the kebab (mousedown) before the click that opens the panel
	     completes (mouseup). A scroll arriving in that same beat is the open, not the user scrolling
	     away, and closing on it would make the menu unopenable on a narrow, horizontally scrolled
	     table, which is exactly the case unscrollHiddenAxis exists for.
	   · Self-heal, because the flag can outlive the panel: a DataTables redraw replaces the tbody
	     wholesale and takes the panel with it without coming through closeRowMenus(). Open a row
	     menu, press "/" and type, and the draw wipes the panel while the timestamp stays set.
	     Clearing it here costs nothing and keeps the two checks above honest.
	   · The page guard LAST, because closeRowMenus() also clears `.tnd-rowmenu.is-open`, which is
	     tendi-list.js's generic flyout state on every `.tnd-list-generic` page. A leaked copy of
	     this listener still holding a stale timestamp would otherwise close somebody else's flyout
	     on scroll. It sits after the cheap checks, so the query only runs when something is
	     genuinely believed to be open on this page. */
	function onDocScroll() {
		if (!rowMenuOpenedAt) return;
		if (Date.now() - rowMenuOpenedAt < 250) return;
		if (!el('[data-rowmenu]')) { rowMenuOpenedAt = 0; return; }
		if (!el('.tnd-children-page')) return;
		closeRowMenus();
	}
	function onDocKey(e) {
		if (!el('.tnd-children-page')) return;
		if (e.key === 'Escape') { closeAllMenus(); closeFilterPop(); return; }
		// "/" focuses search, the way every list-heavy tool does it
		if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
			var s = el('#tndSearch');
			if (s) { e.preventDefault(); s.focus(); s.select(); }
		}
	}

	/* ============================================================
	   INIT
	   ============================================================ */
	function init(cfg) {
		var page = el('.tnd-children-page');
		if (!page) return;

		state = {
			urls: cfg.urls,
			counts: null,          // B4: filled by loadCounts(); null = not counted yet, never 0
			saved: [],
			defaultKey: '',
			currentKey: '',
			columns: defaultColumns(),
			density: 'comfortable',
			/* The page owns the filter payload (`tndFilters`, rewritten in place so the ajax config
			   keeps pointing at it) and the DataTables search term. Select-all has to ask for the
			   ids matching THOSE, not a second copy assembled here, or the selection and the list
			   answer to different filters. */
			getQuery: (cfg && typeof cfg.getQuery === 'function') ? cfg.getQuery : null
		};

		// A fresh page: nothing carried over from the last visit's selection.
		clearSelectAll();

		// Map each column key to its real DataTables index from the rendered <th> order, so the
		// picker never has to hardcode positions that shift when Transportation is off.
		els('#datatable-1 thead th').forEach(function (th, i) {
			var key = th.getAttribute('data-colkey');
			if (!key) return;
			state.columns.forEach(function (c) { if (c.key === key) c.idx = i; });
		});
		// Any column the header did not render (Transportation with the feature off) is dropped
		// from the picker: offering to show a column that does not exist is worse than omitting it.
		state.columns = state.columns.filter(function (c) { return c.idx != null; });

		bindMenus(page);
		bindViewMenu();
		bindChips();
		bindInlineSelects();
		bindPopover();
		bindColumns();
		bindRowActions();
		bindDock();

		// search: drives DataTables directly (the stock search box is not rendered on this page)
		/* The search box changes WHICH CHILDREN the list holds, so it ends a selection the moment it
		   is applied rather than leaving the dock to notice on the redraw. It does not go through
		   the page's applyFilters(), which is where every other filter is cleared, so it clears
		   itself. Clearing on APPLY, not on keypress: typing with a debounce running has not changed
		   the list yet, and wiping the selection on the first character typed would be its own
		   surprise. */
		var search = el('#tndSearch'), searchWrap = el('#tndSearchWrap');
		if (search) {
			var timer = null;
			search.addEventListener('input', function () {
				searchWrap.classList.toggle('has-val', search.value.trim() !== '');
				clearTimeout(timer);
				timer = setTimeout(function () {
					var t = dt();
					if (t) { clearSelection(); abortInflight(); t.search(search.value.trim()).draw(); }
				}, 260);
			});
			search.addEventListener('keydown', function (e) {
				if (e.key !== 'Enter') return;
				e.preventDefault();
				clearTimeout(timer);
				var t = dt();
				if (t) { clearSelection(); abortInflight(); t.search(search.value.trim()).draw(); }
			});
			var clr = el('#tndSearchClear');
			if (clr) clr.addEventListener('click', function () {
				search.value = '';
				searchWrap.classList.remove('has-val');
				var t = dt();
				if (t) { clearSelection(); abortInflight(); t.search('').draw(); }
				search.focus();
			});
		}

		/* A search term must not outlive the visit that typed it.
		   children_manage.php seeds the rebuilt table's search off `dataTableManageChildren`, a
		   global it declares with `var`. At global scope that is a no-op re-declaration once the
		   variable already holds a value, so on an SPA revisit the handle is still the PREVIOUS
		   visit's (detached) table and still carries its search term. The new table therefore came
		   back filtered while this freshly rendered input was empty: rows missing, nothing on screen
		   saying why. Note this is NOT DataTables stateSave, which is off on this page.

		   The input is the visible truth, so a term the box does not show is a leftover and goes.
		   A deep link (children/<keyword>) is not a leftover: the controller renders that term into
		   the input server-side, so box and table agree and this leaves it alone. Nothing else puts
		   the two out of step, saved views do not carry a search term.

		   Done at preInit, before the first request is built, so the stale term is never sent and no
		   second round trip is needed to undo it. Bound once per table node (the SPA replaces that
		   node every visit, so the marker resets with it) and `.one`, so a repeated init cannot
		   stack handlers. */
		var tblNode = el('#datatable-1');
		if (tblNode && window.jQuery && !tblNode.getAttribute('data-tnd-searchguard')) {
			tblNode.setAttribute('data-tnd-searchguard', '1');
			jQuery(tblNode).one('preInit.dt', function (e, settings) {
				if (search && search.value.trim() !== '') { return; }
				if (settings && settings.oPreviousSearch) { settings.oPreviousSearch.sSearch = ''; }
			});
		}

		// enrollment window segmented control
		els('#tndSegWin button').forEach(function (b) {
			b.addEventListener('click', function () {
				els('#tndSegWin button').forEach(function (x) { x.classList.toggle('is-active', x === b); });
				var hidden = el('#tab_filter');
				if (hidden) hidden.value = b.getAttribute('data-win');
				if (window.TndChildren && window.TndChildren.onWindowChange) window.TndChildren.onWindowChange(b.getAttribute('data-win'));
			});
		});

		// filter controls feed the chip row
		els('[data-chipsrc]').forEach(function (node) {
			node.addEventListener('change', function (e) {
				if (e && e.namespace === 'tndsilent') return;
				syncChips();
				syncInlineSelects();
				syncPillsFromInputs();
			});
		});

		if (!docBound) {
			$doc.addEventListener('click', onDocClick);
			$doc.addEventListener('keydown', onDocKey);
			// The row menu is pinned to the viewport (see placeRowMenu), so it does not travel with
			// the rows: scrolling the table would leave it hanging over a row it no longer belongs
			// to. Capture phase on the document, because scroll does not bubble and so a delegated
			// handler never sees it, and because `.tnd-table-scroll` is a wrapper tendi-list.js
			// creates at runtime: binding to that element directly is a race that was silently lost
			// on some visits, leaving the menu pinned in mid-air. Capture needs no element to exist.
			$doc.addEventListener('scroll', onDocScroll, true);
			// Any focus can drag the shell sideways, not only the tab buttons, so this sits on
			// focusin rather than on the segmented control: the columns button and the row kebabs
			// on the far right of a narrow page do it too. It no-ops on every other page, and on
			// this one it no-ops unless something is actually offset.
			$doc.addEventListener('focusin', unscrollHiddenAxis);
			// The frozen offset is a measured pixel value, so it has to be re-taken whenever the
			// table can re-lay out. Debounced: resize fires continuously while dragging a window.
			var rzTimer = null;
			window.addEventListener('resize', function () {
				// Same reason as the scroll listener: the row menu is pinned at measured pixel
				// coordinates, so a resize leaves it sitting away from the row it belongs to.
				// Undebounced, because the panel should go on the first resize event rather than
				// 120ms into the drag. Gated on the flag rather than calling straight through:
				// closeRowMenus() is three document-wide queries and resize fires continuously
				// while a window is being dragged, so with nothing open this has to cost one read.
				if (rowMenuOpenedAt) closeRowMenus();
				clearTimeout(rzTimer);
				rzTimer = setTimeout(syncFrozenOffset, 120);
			});
			docBound = true;
		}

		syncPillsFromInputs();
		syncInlineSelects();
		syncChips();
		renderCols();
		applyCols();      // hide the off-by-default columns on the FIRST paint, not after the ajax
		renderViews();
		loadCounts();     // B4: independent of the views request, so neither waits on the other

		// A child was just created in the full-page editor and this is the list it sent us to. It
		// outranks the stored default for this one visit: the default is what this list looks like
		// when you come to it, and this is a view the user's own action just asked for. Read (and
		// cleared) before the ajax below, so it cannot be consumed twice by two responses.
		var landOn = takePendingView();

		// Load the saved views and prefs, then open the resolved default.
		jQuery.ajax({
			url: cfg.urls.listViews, type: 'GET', dataType: 'json',
			success: function (r) {
				if (!r || r.success !== 1) { applyView(landOn || FALLBACK_KEY, !!landOn); return; }
				state.saved = (r.data.saved || []).map(function (v) {
					return { key: 'saved:' + v.id, id: v.id, label: v.name, filters: v.filters || {} };
				});
				state.defaultKey = r.data.stored || '';
				if (r.data.density) { state.density = r.data.density; applyDensity(); }
				colsLoaded = true;
				if (r.data.columns) {
					var stored = r.data.columns;
					storedColsRaw = stored;
					var migrated = !!stored[COLS_MIGRATED_KEY];
					state.columns.forEach(function (c) {
						if (c.locked) return;
						// A blob written before Notes became a default column carries note:false for
						// everyone, whether or not they ever chose to hide it. Skip it exactly once.
						if (!migrated && c.key === 'note') return;
						if (Object.prototype.hasOwnProperty.call(stored, c.key)) c.on = !!stored[c.key];
					});
					// Stamp the blob so the skip above happens once and never again. Fire-and-forget:
					// the column state on screen is already right, and a failed write just means the
					// next visit re-applies the same one-time skip.
					if (!migrated) persistDisplay();
				}
				renderCols();
				applyCols();
				// Boot through the SAME chain the server used, so a deleted or unstarred default
				// lands on Enrolled instead of nothing.
				applyView(landOn || resolveDefault().key, true);
			},
			// Views are a convenience layer: if the endpoint is unreachable the list must still work.
			// A pending view redraws even here: the table's first load ran with the page's own
			// default filters, so writing this view's filters without a redraw would name one view
			// on the button while listing another's rows.
			error: function () { applyView(landOn || FALLBACK_KEY, !!landOn); renderCols(); applyCols(); }
		});
	}

	window.TndChildrenList = {
		init: init,
		// Exposed so the page can re-count after an action that moves a child between views
		// (enroll, remove from the waiting list, archive, trash, restore). A count left stale by
		// the very action the user just took is a lie told with authority.
		refreshCounts: loadCounts,
		// Land the list on a named view. Used by the child form after a create (children.php),
		// which is told server-side which view actually holds the child that was just made.
		showView: showView,
		syncChips: syncChips,
		syncDock: syncDock,
		/* The selection API the page's bulk actions read. selectedIds() is the ONLY thing an action
		   should ask: it answers with the visible ticks or with the whole matching set, whichever
		   the dock is currently counting, so the number on the bar and the number acted on cannot
		   come apart. */
		selectedIds: selectedIds,
		selectionCount: selCount,
		isSelectAllMatching: function () { return !!selAll.on; },
		isSelectionPending: function () { return !!selAll.pending; },
		/* Asked by both bulk actions immediately before they submit. A selection made against one
		   list and submitted against another is refused rather than translated; the action says so
		   and the user re-picks against what is now on screen. */
		isSelectionStale: selStale,
		voidIfStale: function () { var v = selVoidIfStale(); if (v) syncDock(); return v; },
		/* True once if the selection was thrown away because the list moved under it. Read ONCE and
		   cleared, because it is the explanation for a single refusal, not a state: leaving it set
		   would make the next perfectly ordinary "nothing selected" also blame the list. */
		consumeStaleVoid: function () { var v = staleVoid; staleVoid = false; return v; },
		/* The exact filters + search the selection was made against, so the SERVER can re-derive the
		   permitted set instead of trusting the ids in the request. */
		selectionQuery: selQuery,
		selectAllMatching: selectAllMatching,
		clearSelectAll: function () { clearSelectAll(); syncDock(); },
		clearSelection: clearSelection,
		onDraw: onDraw,
		applyCols: applyCols,
		syncFrozen: syncFrozenOffset,
		closeMenus: closeAllMenus
	};
})();
