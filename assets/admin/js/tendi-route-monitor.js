/* ============================================================================
   Live Route Monitor: front-end for admin/bus_routes/report (reskin).
   ADDITIVE + non-destructive:
     • Renders the dark "wallboard" bus cards from get_report's new `cards` payload
       (own 60s poll, in-flight-guarded, stops on hashchange).
     • The LEGACY DataTable + its 60s poll keep running (hidden) so every card
       action PROXY-CLICKS the exact legacy row anchor (edit_route_time /
       view_children / edit_attendent / edit_driver): identical behaviour, real
       data, existing modals. Inspection reuses window.inspection_popup.
     • Detail drawer pulls the REAL roster from <default_url>/get_child_detail.
   Nothing legacy is renamed or removed. Init is called from the view once the
   fragment (and the legacy functions) are in the DOM: TndRouteMonitor.init({...})
   ============================================================================ */
(function () {
  var jq = window.jQuery;
  if (!jq) return;
  var TRM = window.TndRouteMonitor = window.TndRouteMonitor || {};

  var baseUrl = '', pollTimer = null, inFlight = false, lastCards = [], drawerBuilt = false, rosterCache = {};
  var serverToday = '';   // the server-rendered default #start_date == "today" (avoids browser-clock skew)
  function parseMDY(s) { var p = (s || '').trim().split('/'); if (p.length !== 3) return null; return new Date(+p[2], +p[0] - 1, +p[1]).getTime(); }

  function q(s, r) { return (r || document).querySelector(s); }
  function val(s) { var e = q(s); return e ? (e.value || '') : ''; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function cap(t) { t = (t || '').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; }
  var AV = ['--lavender-deep', '--plum-deep', '--rose-deep', '--coral-deep', '--apricot-deep', '--sun-deep', '--sage-deep', '--mint-deep', '--teal-deep', '--sky-deep'];
  function initials(n) { n = (n || '').trim(); if (!n) return '?'; var p = n.split(/\s+/); return ((p[0] && p[0][0] || '') + (p[1] && p[1][0] || '')).toUpperCase(); }
  function avColor(n) { n = n || ''; var h = 0; for (var i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0; return 'var(' + AV[h % AV.length] + ')'; }
  function tfmt(dt) { if (!dt) return ''; var m = String(dt).match(/(\d{1,2}):(\d{2})/); if (!m) return ''; var h = +m[1], mm = m[2], ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + mm + ' ' + ap; }
  function dirLabel(d) { d = (d || ''); return d === 'pick_up' ? 'Pick-up' : d === 'drop_off' ? 'Drop-off' : cap(d.replace('_', ' ')); }
  function isBad(dt) { return !dt || /^0000/.test(dt); }

  var SVG = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';
  var IC = {
    enroute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4 4 10-10"/></svg>',
    done: '<svg ' + SVG + '><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>',
    cancel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    clock: '<svg ' + SVG + '><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    warn: '<svg ' + SVG + '><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    bus: '<svg ' + SVG + '><path d="M8 6v6M16 6v6M2 12h20M18 18h2a1 1 0 0 0 1-1v-5l-2-4H5L3 12v5a1 1 0 0 0 1 1h2"/><circle cx="7" cy="18" r="1.7"/><circle cx="17" cy="18" r="1.7"/></svg>',
    pin: '<svg ' + SVG + '><path d="M12 21s-7-4.4-7-10a7 7 0 0 1 14 0c0 5.6-7 10-7 10Z"/><circle cx="12" cy="11" r="2.5"/></svg>',
    user: '<svg ' + SVG + '><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    users: '<svg ' + SVG + '><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
    bell: '<svg ' + SVG + '><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    /* the two Upcoming row actions. They were the only Font Awesome glyphs left in this file,
       so View and Export drew a filled eye and a filled tray next to the stroke icons every
       other control here uses. */
    eye: '<svg ' + SVG + '><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.6"/></svg>',
    download: '<svg ' + SVG + '><path d="M12 3v11"/><path d="m7.5 10 4.5 4.5 4.5-4.5"/><path d="M4 20h16"/></svg>'
  };
  var FLAG = {
    wb: { c: 'wb', t: 'Boarded the wrong bus', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' },
    bc: { c: 'bc', t: 'Bus change scheduled', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l3 3-3 3"/><path d="M20 5H8"/><path d="M7 22l-3-3 3-3"/><path d="M4 19h12"/></svg>' },
    dl: { c: 'dl', t: 'Different / unexpected location', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.4-7-10a7 7 0 0 1 14 0c0 5.6-7 10-7 10Z"/></svg>' }
  };

  function statusMeta(card) {
    var s = (card.status || '').toLowerCase();
    if (s === 'completed') return { cls: 'done', label: 'Completed', card: 'is-done' };
    if (s === 'cancelled') return { cls: 'cancel', label: 'Cancelled', card: 'is-cancel' };
    return { cls: 'enroute', label: 'En route', card: '' };
  }

  /* ---------------- cards ---------------- */
  function cardHtml(c) {
    var m = statusMeta(c);
    var pct = c.total > 0 ? Math.round((+c.attended) / (+c.total) * 100) : 0;
    var exc = c.exceptions || [];
    var hasWb = exc.some(function (e) { return e.type === 'wb'; });
    var cardCls = m.card;
    var flag = m.cls === 'cancel' ? '<div class="flag crit">' + IC.cancel + 'Route cancelled</div>' : '';
    if (m.cls !== 'cancel' && exc.length) {
      cardCls = hasWb ? 'is-exc' : 'is-warn';
      var lbl = exc.length === 1 ? (cap(exc[0].name) + ', ' + (exc[0].type === 'wb' ? 'wrong bus' : 'different bus')) : (exc.length + ' children need attention');
      flag = '<div class="flag' + (hasWb ? ' crit' : '') + '">' + IC.warn + esc(lbl) + '</div>';
    }
    var timeLabel = m.cls === 'done' ? 'Completed' : m.cls === 'cancel' ? 'Cancelled' : 'Started';
    var timeVal = m.cls === 'done' ? (tfmt(c.completed_at) || '-') : m.cls === 'cancel' ? '-' : (tfmt(c.started_at) || '-');
    var unit = m.cls === 'done' ? 'home' : 'aboard';
    var driver = c.driver ? '<span class="dvr"><span class="av" style="background:' + avColor(c.driver) + '">' + esc(initials(c.driver)) + '</span><b>' + esc(cap(c.driver)) + '</b></span>' : '<span class="dvr"><b>No driver</b></span>';
    return '<article class="rmon-bus ' + cardCls + '" role="listitem" tabindex="0" data-id="' + esc(c.id) + '" aria-label="' + esc(c.route) + ': open details">' +
      '<div class="bt"><span class="av" style="background:' + avColor(c.bus || c.route) + '">' + esc(initials(c.bus || c.route)) + '</span><span class="nm">' + esc(c.route || '(Untitled)') + '</span>' +
      '<span class="st st--' + m.cls + '">' + IC[m.cls] + m.label + '</span></div>' +
      '<div class="bg"><div class="cnt">' + (m.cls === 'cancel' ? '-' : esc(c.attended)) + '<span> / ' + esc(c.total) + ' ' + unit + '</span></div>' +
      '<div class="eta"><div class="l">' + timeLabel + '</div><div class="t">' + esc(timeVal) + '</div></div></div>' +
      '<div class="bar"><i style="width:' + (m.cls === 'cancel' ? 0 : Math.min(100, pct)) + '%"></i></div>' +
      '<div class="sub">' + esc(dirLabel(c.direction)) + ' · ' + esc(c.bus || '') + driver + '</div>' +
      flag +
      '</article>';
  }

  function renderCards(cards) {
    lastCards = cards || [];
    var wrap = q('#rmonFleet'); if (!wrap) return;
    wrap.innerHTML = lastCards.length ? lastCards.map(cardHtml).join('') : '<div class="rmon-empty">No routes are running right now.</div>';
    var en = 0, done = 0, aboard = 0, tot = 0;
    lastCards.forEach(function (c) { var s = (c.status || '').toLowerCase(); if (s === 'started') en++; if (s === 'completed') done++; aboard += (+c.attended || 0); tot += (+c.total || 0); });
    var cnt = q('#rmonBusCount'); if (cnt) cnt.textContent = lastCards.length + (lastCards.length === 1 ? ' route' : ' routes');
    // Needs attention: every flagged child across all runs
    var attn = [];
    lastCards.forEach(function (c) { (c.exceptions || []).forEach(function (e) { attn.push({ card: c, name: e.name, type: e.type }); }); });
    var block = q('#rmonAttnBlock'), list = q('#rmonAttn');
    if (block && list) {
      if (attn.length) {
        block.hidden = false;
        var ac = q('#rmonAttnCount'); if (ac) ac.textContent = attn.length;
        list.innerHTML = attn.map(function (a) {
          var crit = a.type === 'wb';
          return '<div class="rmon-attn-row' + (crit ? ' crit' : '') + '"><div class="ai" aria-hidden="true">' + IC.warn + '</div>' +
            '<div class="atx"><b>' + esc(cap(a.name) || 'A child') + '</b>, ' + (crit ? 'boarded the wrong bus' : 'on a different bus') +
            '<small>on ' + esc(a.card.route) + '</small></div>' +
            '<div class="aact"><a class="rmon-mini" href="javascript:void(0)" data-open="' + esc(a.card.id) + '">Review</a></div></div>';
        }).join('');
      } else { block.hidden = true; }
    }
    var sum = q('#rmonSummary');
    if (sum) sum.innerHTML = '<b>' + lastCards.length + '</b> ' + (lastCards.length === 1 ? 'route' : 'routes') + ' today <span class="sep">·</span> <b>' + aboard + '</b> of ' + tot + ' children aboard <span class="sep">·</span> <b>' + en + '</b> en route, <b>' + done + '</b> completed' +
      (attn.length ? ' <span class="sep">·</span> <span class="attn">' + IC.warn + '<b>' + attn.length + '</b>&nbsp;need attention</span>' : '');
  }

  function cardById(id) { for (var i = 0; i < lastCards.length; i++) if (String(lastCards[i].id) === String(id)) return lastCards[i]; return null; }

  /* ---------------- poll ---------------- */
  function currentFilters() { return { route_type: val('#route_type'), child_id: val('#hdn_child_id'), start_date: val('#start_date'), bus: val('#bus'), route_id: val('#route_id') }; }
  function fetchAndRender() {
    if (inFlight) return; inFlight = true;
    var fd = new FormData();
    fd.append('filters', JSON.stringify([currentFilters()]));
    fd.append('order', JSON.stringify([{ column: null, dir: null }]));
    jq.ajax({
      url: baseUrl + '/get_report', type: 'POST', data: fd, dataType: 'json', contentType: false, processData: false, mimeType: 'multipart/form-data',
      complete: function () { inFlight = false; },
      success: function (res) { renderCards((res && res.cards) || []); }
    });
  }
  function startPoll() { stopPoll(); pollTimer = setInterval(fetchAndRender, 60000); }
  function stopPoll() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }
  // a non-today date → not live: recolour the chip + STOP polling (a past/future day doesn't live-update)
  function updateLiveState() {
    var live = q('.rmon .rmon-live'); if (!live) return;
    var dt = (val('#start_date') || '').trim();
    var a = parseMDY(dt), b = parseMDY(serverToday);
    var other = a !== null && b !== null && a !== b;
    live.classList.toggle('is-hist', !!other);
    var lt = live.querySelector('.lt');
    if (lt) lt.innerHTML = other ? ((a < b ? 'Historical' : 'Scheduled') + ' <small>&middot; ' + esc(dt) + '</small>') : 'Live <small>&middot; auto-updates every 60s</small>';
    if (other) stopPoll(); else startPoll();
  }

  /* ---------------- upcoming routes (reskinned list) ---------------- */
  function dateGteToday() { var a = parseMDY(val('#start_date')), b = parseMDY(serverToday); if (a === null || b === null) return true; return a >= b; }
  var upInFlight = false;
  function fetchUpcoming() {
    var sec = q('#rmonUpcomingSec');
    if (!dateGteToday()) { if (sec) sec.hidden = true; return; }   // legacy hides upcoming for a past day
    if (upInFlight) return; upInFlight = true;
    var fd = new FormData();
    fd.append('filters', JSON.stringify([currentFilters()]));
    fd.append('search[value]', '');
    fd.append('order[0][column]', '4'); fd.append('order[0][dir]', 'asc');
    fd.append('start', '0'); fd.append('length', '1000'); fd.append('draw', '1');
    jq.ajax({
      url: baseUrl + '/get_upcoming_bus_routes', type: 'POST', data: fd, dataType: 'json', contentType: false, processData: false, mimeType: 'multipart/form-data',
      complete: function () { upInFlight = false; },
      success: function (res) { renderUpcoming((res && res.cards) || []); }
    });
  }
  function upRow(c) {
    var dir = esc(c.direction_label || dirLabel(c.direction));
    var d = 'data-attendance_id="' + esc(c.id) + '" data-bus_route_id="' + esc(c.id) + '" data-bus_direction="' + dir + '" data-bus_route_name="' + esc(c.route) + '"';
    return '<div class="rmon-up-row">' +
      '<span class="ut">' + esc(c.schedule_time_fmt) + '</span>' +
      '<div class="ux"><div class="un">' + esc(c.route) + '</div><div class="um">Bus ' + esc(c.bus) + ' · ' + dir + '</div></div>' +
      '<span class="uact">' +
      '<button type="button" class="view-child-btn" ' + d + ' data-display_child_count="false" data-is_use_for_upcoming="true" onclick="openChildrenPopup(this)">' + IC.eye + 'View</button>' +
      '<button type="button" class="export-upcoming-routes" ' + d + ' data-is_use_for_upcoming="true" data-schedule_time="' + esc(c.schedule_time) + '" data-bus_name="' + esc(c.bus) + '">' + IC.download + 'Export</button>' +
      '</span></div>';
  }
  function renderUpcoming(cards) {
    var sec = q('#rmonUpcomingSec'), el = q('#rmonUpcoming'); if (!sec || !el) return;
    sec.hidden = false;
    var cnt = q('#rmonUpCount'); if (cnt) cnt.textContent = cards.length;
    el.innerHTML = cards.length ? ('<div class="rmon-up-list">' + cards.map(upRow).join('') + '</div>') : '<div class="rmon-up-empty">No upcoming routes.</div>';
  }
  TRM._exportAll = function () { var b = q('#export_all_upcoming_route'); if (b) b.click(); };

  /* ---------------- proxy the legacy row anchors (exact behaviour + data) ---------------- */
  function proxyClick(id, anchorId) {
    var a = q('#report_data tr[id="' + id + '"] [id="' + anchorId + '"]');
    if (a) { a.click(); return true; }
    return false;
  }

  /* ---------------- drawer ---------------- */
  function drawerShell() {
    return '<div class="rmon-dw-hd">' +
      '<div class="di" aria-hidden="true">' + IC.bus + '</div>' +
      '<div class="dh-t"><h3><span id="rmonDwName">Route</span> <span class="st" id="rmonDwStatus"></span></h3><div class="dsub" id="rmonDwSub"></div></div>' +
      '<button class="rmon-dw-x" id="rmonDwClose" type="button" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
      '</div>' +
      '<div class="rmon-dw-bd" id="rmonDwBody"></div>' +
      '<div class="rmon-dw-ft">' +
      '<button class="rmon-btn rmon-btn--primary" id="rmonActEdit" type="button">' + IC.clock + 'Edit time / status</button>' +
      '<button class="rmon-btn" id="rmonActChildren" type="button">' + IC.users + 'All children</button>' +
      '<button class="rmon-btn" id="rmonActMap" type="button">' + IC.pin + 'Map</button>' +
      '</div>';
  }
  function ensureDrawer() {
    if (drawerBuilt) return; drawerBuilt = true;
    var host = document.createElement('div'); host.className = 'tendi-skin';
    host.innerHTML = '<div class="rmon-scrim" id="rmonScrim"></div><aside class="rmon-drawer" id="rmonDrawer" role="dialog" aria-modal="true" aria-hidden="true">' + drawerShell() + '</aside>';
    document.body.appendChild(host);
    jq(document).on('click.rmon', '#rmonScrim, #rmonDwClose', closeDrawer);
    jq(document).on('keydown.rmon', function (e) { if (e.key === 'Escape') { var d = q('#rmonDrawer'); if (d && d.classList.contains('is-open')) closeDrawer(); } });
    // chip → per-child timeline, inspection play
    jq(document).on('click.rmon', '#rmonDrawer .rmon-dw-chip[data-cid]', function () { openChild(this.getAttribute('data-cid')); });
    jq(document).on('click.rmon', '#rmonDrawer #rmonChildBack', function (e) { e.preventDefault(); var s = q('#rmonChildSec'); if (s) s.hidden = true; });
    jq(document).on('click.rmon', '#rmonDrawer #rmonInspPlay', function (e) { e.preventDefault(); var c = curCard(); if (c && c.inspection_videos && window.inspection_popup) window.inspection_popup(c.route, btoa(c.inspection_videos)); });
    // footer actions → proxy legacy anchors / existing modals
    jq(document).on('click.rmon', '#rmonActEdit', function () { var c = curCard(); if (c) proxyClick(c.id, 'edit_route_time'); });
    jq(document).on('click.rmon', '#rmonActChildren', function () { var c = curCard(); if (c) proxyClick(c.id, 'view_children'); });
    jq(document).on('click.rmon', '#rmonActMap', function () { var c = curCard(); if (c && c.lat && c.lng) window.open('https://maps.google.com/?q=' + c.lat + ',' + c.lng, '_blank'); });
  }
  var _curId = null;
  function curCard() { return _curId != null ? cardById(_curId) : null; }

  function openDrawer(id) {
    var c = cardById(id); if (!c) return;
    _curId = id; ensureDrawer();
    var m = statusMeta(c);
    q('#rmonDwName').textContent = c.route || 'Route';
    var pill = q('#rmonDwStatus'); pill.className = 'st st--' + m.cls; pill.innerHTML = IC[m.cls] + m.label;
    q('#rmonDwSub').textContent = 'Bus ' + (c.bus || '-') + ' · ' + dirLabel(c.direction) + (c.date ? ' · ' + c.date : '');
    q('#rmonDwBody').innerHTML = bodyHtml(c);
    var scrim = q('#rmonScrim'), dr = q('#rmonDrawer');
    scrim.classList.add('is-open'); dr.classList.add('is-open'); dr.setAttribute('aria-hidden', 'false');
    q('#rmonDwBody').scrollTop = 0;
    loadRoster(c);
  }
  function closeDrawer() {
    var scrim = q('#rmonScrim'), dr = q('#rmonDrawer');
    if (scrim) scrim.classList.remove('is-open');
    if (dr) { dr.classList.remove('is-open'); dr.setAttribute('aria-hidden', 'true'); }
    _curId = null;
  }

  function bodyHtml(c) {
    var m = statusMeta(c);
    var secondL = m.cls === 'done' ? 'Completed' : m.cls === 'cancel' ? 'Cancelled' : 'Started';
    var secondV = m.cls === 'done' ? (tfmt(c.completed_at) || '-') : m.cls === 'cancel' ? '-' : (tfmt(c.started_at) || '-');
    var times = m.cls === 'done' ? (IC.clock + 'Started <b>' + (tfmt(c.started_at) || '-') + '</b> · Completed <b>' + (tfmt(c.completed_at) || '-') + '</b>')
      : m.cls === 'cancel' ? (IC.clock + 'Route was cancelled')
      : (IC.clock + 'Started <b>' + (tfmt(c.started_at) || '-') + '</b>');
    var crew = '<div class="rmon-dw-sec"><div class="h">Crew</div>' +
      crewRow('Driver', c.driver, 'edit_driver', c.id) +
      crewRow('Attendant', c.attendant, 'edit_attendent', c.id) + '</div>';
    var insp = '<div class="rmon-dw-sec"><div class="h">Pre-trip inspection</div>' +
      (c.inspection === 'passed'
        ? '<div class="rmon-dw-note">' + IC.enroute + 'Inspection recorded<a class="insp-play" id="rmonInspPlay" href="#">' + IC.play + 'Watch video</a></div>'
        : '<div class="rmon-dw-note skip">' + IC.warn + 'No pre-trip inspection recorded</div>') + '</div>';
    var loc = (c.lat && c.lng)
      ? '<div class="rmon-dw-sec"><div class="h">Current location</div><div class="rmon-dw-row" style="border:0;padding-top:0"><span class="rv">' + IC.pin + 'Last known position</span><a class="rmon-mini redit" target="_blank" href="https://maps.google.com/?q=' + esc(c.lat) + ',' + esc(c.lng) + '">View on map</a></div></div>'
      : '';
    return '<div class="rmon-dw-sec"><div class="rmon-dw-stats">' +
      '<div class="rmon-dw-stat"><div class="l">Aboard</div><div class="v">' + (m.cls === 'cancel' ? '-' : (esc(c.attended) + ' / ' + esc(c.total))) + '</div></div>' +
      '<div class="rmon-dw-stat"><div class="l">' + secondL + '</div><div class="v">' + esc(secondV) + '</div></div>' +
      '</div><div class="rmon-dw-bar"><i style="width:' + (m.cls === 'cancel' || !c.total ? 0 : Math.min(100, Math.round(c.attended / c.total * 100))) + '%"></i></div>' +
      '<div class="rmon-dw-times">' + times + '</div></div>' +
      crew +
      '<div class="rmon-dw-sec" id="rmonRosterSec"><div class="h">Roster <span style="text-transform:none;letter-spacing:0;font-weight:500;color:var(--ink-5)">· tap a child for details</span></div><div id="rmonRoster"><div class="rmon-dw-loading"><span class="rmon-spin"></span></div></div></div>' +
      '<div class="rmon-dw-sec" id="rmonChildSec" hidden><div class="h"><a class="rmon-mini" id="rmonChildBack" href="#" style="height:24px">‹ Back</a> <span id="rmonChildName" style="margin-left:8px;color:var(--ink);text-transform:none;letter-spacing:0"></span></div><div id="rmonChildBody"></div></div>' +
      insp + loc;
  }
  function crewRow(label, name, anchorId, id) {
    var av = name ? '<span class="av" style="background:' + avColor(name) + '">' + esc(initials(name)) + '</span>' : '';
    return '<div class="rmon-dw-row"><span class="rl">' + label + '</span><span class="rv">' + av + (name ? esc(cap(name)) : '-') + '</span>' +
      '<a class="rmon-mini redit" href="javascript:void(0)" onclick="TndRouteMonitor._proxy(' + id + ',\'' + anchorId + '\')">Edit</a></div>';
  }

  /* ---------------- roster (real data) ---------------- */
  function loadRoster(c) {
    rosterCache = {};
    var el = q('#rmonRoster'); if (!el) return;
    jq.ajax({
      url: baseUrl + '/get_child_detail', type: 'POST', dataType: 'json',
      data: { date: val('#start_date') || c.date, bus_route_id: c.bus_route_id, bus_attendance_id: c.id, order: 'route' },
      success: function (res) {
        if (!res || res.success != 1) { el.innerHTML = '<div class="rmon-dw-chip empty">Could not load the roster.</div>'; return; }
        var kids = res.route_children || [], aboard = [], waiting = [];
        kids.forEach(function (k) {
          k._name = ((k.fname || '') + ' ' + (k.lname || '')).trim();
          rosterCache[k.child_id] = k;
          if (String(k.listing_type) === 'attendance') aboard.push(k); else waiting.push(k);
        });
        var waitLabel = statusMeta(c).cls === 'done' ? 'Not boarded' : 'Still to board';
        el.innerHTML =
          group('acc', IC.enroute, 'Aboard', aboard, 'None boarded yet') +
          (waiting.length ? group('wait', IC.clock, waitLabel, waiting, '') : '');
      },
      error: function () { el.innerHTML = '<div class="rmon-dw-chip empty">Could not load the roster.</div>'; }
    });
  }
  function flagOf(k) {
    if (+k.is_wrong_bus === 1) return 'wb';
    if (+k.is_diff_location === 1) return 'dl';
    if (+k.bus_route_change_id > 0) return 'bc';
    return '';
  }
  function chip(k) {
    var name = k._name || 'Child', fl = flagOf(k);
    var badge = (fl && FLAG[fl]) ? '<span class="cf ' + FLAG[fl].c + '" title="' + FLAG[fl].t + '">' + FLAG[fl].ic + '</span>' : '';
    return '<span class="rmon-dw-chip" data-cid="' + esc(k.child_id) + '" tabindex="0"><span class="av" style="background:' + avColor(name) + '">' + esc(initials(name)) + '</span>' + esc(name) + badge + '</span>';
  }
  function group(cls, ic, label, arr, empty) {
    var chips = arr.length ? arr.map(chip).join('') : '<span class="rmon-dw-chip empty">' + esc(empty || 'None') + '</span>';
    return '<div class="rmon-dw-group ' + cls + '"><div class="gh">' + ic + label + ' · ' + arr.length + '</div><div class="rmon-dw-chips">' + chips + '</div></div>';
  }
  function openChild(cid) {
    var k = rosterCache[cid]; if (!k) return;
    q('#rmonChildName').textContent = k._name;
    var rows = [];
    var board = k.formatted_boarding_time || tfmt(k.boarding_time);
    var arr = k.formatted_arrival_time || tfmt(k.arrival_time);
    if (board) rows.push(tlRow(board, 'Boarded' + (k.schedule_direction === 'drop_off' ? ' the bus' : ''), 'geo'));
    if (arr) rows.push(tlRow(arr, 'Arrival recorded', 'geo'));
    var fl = flagOf(k);
    if (fl && FLAG[fl]) rows.push(tlRow('now', FLAG[fl].t, 'man'));
    if (!rows.length) rows.push('<div class="rmon-dw-chip empty" style="margin:2px 0">No events yet for this child.</div>');
    q('#rmonChildBody').innerHTML = '<div class="rmon-dw-chips" style="margin-bottom:8px"><span class="rmon-dw-chip empty" style="cursor:default">Status: ' + esc(cap(k.status || '-')) + '</span></div>' + rows.join('');
    q('#rmonChildSec').hidden = false;
    q('#rmonChildSec').scrollIntoView({ block: 'nearest' });
  }
  function tlRow(t, label, kind) {
    return '<div style="display:flex;align-items:center;gap:10px;padding:5px 0;font-size:12px;color:var(--ink-2)"><span style="font-variant-numeric:tabular-nums;font-weight:700;color:var(--ink);width:70px;flex:none">' + esc(t) + '</span>' + esc(label) +
      '<span style="margin-left:auto;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;padding:1px 7px;border-radius:999px;' + (kind === 'man' ? 'color:var(--primary);background:var(--primary-tint)' : 'color:var(--ok);background:var(--ok-tint)') + '">' + (kind === 'man' ? 'Flag' : 'Scan') + '</span></div>';
  }

  /* ---------------- init ---------------- */
  TRM._proxy = proxyClick;
  TRM.refresh = fetchAndRender;
  TRM.init = function (cfg) {
    cfg = cfg || {};
    baseUrl = cfg.baseUrl || '';
    if (!q('.rmon') || !baseUrl) return;
    serverToday = (val('#start_date') || '').trim();   // the view rendered this as date('m/d/Y') == today
    ensureDrawer();
    // card click → drawer (delegated so it survives re-renders)
    jq(document).off('click.rmonCard keydown.rmonCard');
    jq(document).on('click.rmonCard', '.rmon-fleet .rmon-bus', function (e) { if (jq(e.target).closest('a,button').length) return; openDrawer(this.getAttribute('data-id')); });
    jq(document).on('keydown.rmonCard', '.rmon-fleet .rmon-bus', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDrawer(this.getAttribute('data-id')); } });
    jq(document).on('click.rmonCard', '#rmonAttn [data-open]', function () { openDrawer(this.getAttribute('data-open')); });
    // refetch cards when the legacy filters change (they already refresh the hidden table)
    jq('#route_type, #hdn_child_id, #start_date, #bus, #route_id').off('change.rmon').on('change.rmon', function () { setTimeout(function () { fetchAndRender(); fetchUpcoming(); updateLiveState(); }, 60); });
    jq('#rmonRefresh').off('click.rmon').on('click.rmon', function () { fetchAndRender(); fetchUpcoming(); });
    jq('#rmonExportAll').off('click.rmon').on('click.rmon', function (e) { e.preventDefault(); TRM._exportAll(); });
    fetchAndRender();
    fetchUpcoming();
    startPoll();
    updateLiveState();
    jq(window).off('hashchange.rmon').on('hashchange.rmon', stopPoll);
  };
})();
