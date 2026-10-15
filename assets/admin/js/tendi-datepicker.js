/* ============================================================
   TndDate -- the app's date / time picker (flatpickr under the hood)
   ------------------------------------------------------------
   OPT-IN, one attribute:

     data-tnd-picker="date"                      a date
     data-tnd-picker="datetime"                  date + time
     data-tnd-picker="time"                      time only
     data-min_date_for="<id>"                    this field is a range START
     data-max_date_for="<id>"                    this field is a range END
     data-date-format="mm/dd/yy"                 jQuery-UI style, defaults to the app's
     data-time-format="hh:mm A"                  see FORMATS below
     data-min-today="1"                          no past dates

   FORMATS -- why this file does its own formatting and parsing
   ------------------------------------------------------------
   The value a field submits MUST stay byte-identical to what it submitted before,
   because every controller parses what it already parses. Two things make that
   impossible to delegate:

     - flatpickr has no 12-hour-with-leading-zero token, and the legacy time fields
       used jquery-ui-timepicker's "hh:mm TT", i.e. "07:30 AM", not "7:30 AM".
     - flatpickr's PARSER is deliberately lenient and rolls overflow over silently:
          "9/1/27"     -> Sep 1 2026   (the typed year is discarded!)
          "13/45/2027" -> Feb 14 2028
          "2/30/2027"  -> Mar 2 2027
          "99/99/9999" -> Jun 7 10007
       Each of those saves a date nobody typed, without a word.

   So both directions are ours: tndFormat() writes the value, parseStrict() reads it,
   and flatpickr is handed BOTH as its formatDate/parseDate config. It stays the
   calendar and the state, never the interpreter.

   Tokens: YYYY YY MM M DD D hh h HH H mm A a
   ============================================================ */
(function (window, document) {
  'use strict';

  var DAY = 86400000;
  var MARGIN = 8;                 // keep the popup this far off the viewport edge

  /* ---- formatting -------------------------------------------------------- */

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function tndFormat(date, spec) {
    if (!date) return '';
    var h24 = date.getHours(), h12 = h24 % 12 || 12;
    var map = {
      YYYY: String(date.getFullYear()),
      YY: pad2(date.getFullYear() % 100),
      MM: pad2(date.getMonth() + 1),
      M: String(date.getMonth() + 1),
      DD: pad2(date.getDate()),
      D: String(date.getDate()),
      hh: pad2(h12),
      h: String(h12),
      HH: pad2(h24),
      H: String(h24),
      mm: pad2(date.getMinutes()),
      A: h24 < 12 ? 'AM' : 'PM',
      a: h24 < 12 ? 'am' : 'pm'
    };
    return String(spec).replace(/YYYY|YY|MM|M|DD|D|hh|h|HH|H|mm|A|a/g, function (t) { return map[t]; });
  }

  // jQuery-UI date format -> our tokens. mm=02 m=2 dd=05 d=5 yy=2026 y=26
  function uiToSpec(uiFormat) {
    return String(uiFormat || 'mm/dd/yy').replace(/mm|m|dd|d|yy|y/g, function (t) {
      return { 'mm': 'MM', 'm': 'M', 'dd': 'DD', 'd': 'D', 'yy': 'YYYY', 'y': 'YY' }[t];
    });
  }

  function humanHint(spec) {
    return String(spec)
      .replace(/YYYY/g, 'yyyy').replace(/YY/g, 'yy')
      .replace(/MM|M/g, 'mm').replace(/DD|D/g, 'dd')
      .replace(/hh|h|HH|H/g, 'h').replace(/mm/g, 'mm');
  }

  /* The order the format asks for its three parts, e.g. mm/dd/yyyy -> ['m','d','y'].
     Shared by the parser and the typing mask so the two can never disagree. */
  function specOrder(spec) {
    var order = [];
    String(spec).replace(/YYYY|YY|MM|M|DD|D/g, function (t) {
      order.push(t.charAt(0) === 'Y' ? 'y' : (t.charAt(0) === 'M' ? 'm' : 'd'));
      return t;
    });
    return order;
  }

  // How many digits each part takes when it is typed without separators.
  function specWidths(spec, order) {
    var yw = /YYYY/.test(String(spec)) ? 4 : 2;
    return order.map(function (o) { return o === 'y' ? yw : 2; });
  }

  function specSep(spec) {
    var m = String(spec).match(/[^A-Za-z0-9]/);
    return m ? m[0] : '/';
  }

  /* ---- strict parsing ---------------------------------------------------- */

  function parseStrict(raw, kind, spec) {
    var s = String(raw == null ? '' : raw).trim(), time = null;
    if (s === '') return null;

    if (kind === 'time' || kind === 'datetime') {
      // 1-or-2 digit minutes: "7:5 am" can only mean 7:05, and refusing it is just prim.
      // Seconds are optional and ignored: a MySQL TIME column renders "14:45:00", and the
      // bus route Schedule Time field is fed exactly that, straight from the column.
      var tm = s.match(/(\d{1,2}):(\d{1,2})(?::\d{1,2})?\s*([AaPp])\.?[Mm]?\.?\s*$/);
      if (!tm) tm = s.match(/(\d{1,2}):(\d{1,2})(?::\d{1,2})?\s*$/);   // 24-hour, no meridiem
      if (!tm) return null;
      var hh = parseInt(tm[1], 10), mi = parseInt(tm[2], 10), ap = (tm[3] || '').toUpperCase();
      if (mi > 59) return null;
      if (ap) {
        if (hh < 1 || hh > 12) return null;
        if (ap === 'P' && hh !== 12) hh += 12;
        if (ap === 'A' && hh === 12) hh = 0;
      } else if (hh > 23) return null;
      time = { h: hh, m: mi };
      s = s.slice(0, s.length - tm[0].length).trim();
      if (kind === 'time') {
        // a time-only value still needs a day to hang on; use the organisation's, so a
        // viewer in another timezone does not anchor it to their own date
        var only = (window.TendiTime && TendiTime.now()) || new Date();
        only.setHours(hh, mi, 0, 0);
        return only;
      }
    }

    var order = specOrder(spec);
    if (order.length < 3) return null;

    var got = {};
    // ISO first: yyyy-mm-dd is unambiguous whatever the display format is, and it is what
    // reports, exports and the database itself show — so it is what people paste back in.
    var iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
      got.y = iso[1]; got.m = iso[2]; got.d = iso[3];
    } else {
      var nums = s.match(/\d+/g);
      if (!nums) return null;
      // Typed straight through, no separators: "06012026" is one run of digits, which used to
      // be refused outright even though it says exactly one thing. Split it by the widths the
      // format implies (8 digits = 4-digit year, 6 = 2-digit) instead of turning it away.
      if (nums.length === 1 && /^\d+$/.test(s)) {
        var widths = specWidths(spec, order);
        var total = widths[0] + widths[1] + widths[2];
        if (s.length !== total && s.length !== 6) return null;
        if (s.length === 6) widths = [2, 2, 2];
        var pos = 0, parts = [];
        for (var w = 0; w < 3; w++) { parts.push(s.substr(pos, widths[w])); pos += widths[w]; }
        nums = parts;
      }
      if (nums.length < 3) return null;
      for (var i = 0; i < 3; i++) got[order[i]] = nums[i];
    }
    if (got.d === undefined || got.m === undefined || got.y === undefined) return null;

    var y = parseInt(got.y, 10), mo = parseInt(got.m, 10), da = parseInt(got.d, 10);
    // a 2-digit year resolves the way PHP's strtotime will, so screen and database agree
    if (got.y.length <= 2) y += (y <= 69 ? 2000 : 1900);
    if (mo < 1 || mo > 12 || da < 1 || da > 31 || y < 1000 || y > 9999) return null;

    var dt = new Date(y, mo - 1, da, time ? time.h : 0, time ? time.m : 0, 0, 0);
    // the round-trip catches overflow a bare Date accepts (Feb 30, Apr 31, Feb 29 off-cycle)
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== da) return null;
    return dt;
  }

  /* ---- the "we could not read that" mark --------------------------------- */

  function clearBad(el) {
    el.classList.remove('tnd-date-bad');
    el.removeAttribute('aria-invalid');
    var host = el.closest ? el.closest('.tnd-datewrap') : null;
    var note = (host || el.parentNode) && (host || el.parentNode).parentNode
      ? (host || el.parentNode).parentNode.querySelector('.tnd-date-note') : null;
    if (note) note.parentNode.removeChild(note);
  }

  function markBad(el, hint) {
    el.classList.add('tnd-date-bad');
    el.setAttribute('aria-invalid', 'true');
    var host = el.closest ? (el.closest('.tnd-datewrap') || el) : el;
    if (host.parentNode && host.parentNode.querySelector('.tnd-date-note')) return;
    var note = document.createElement('div');
    note.className = 'tnd-date-note';
    note.setAttribute('role', 'alert');
    note.textContent = 'Use ' + hint + ', or pick it from the calendar.';
    if (host.parentNode) host.parentNode.insertBefore(note, host.nextSibling);
  }

  /* ---- the time panel ----------------------------------------------------
     flatpickr's stock time UI is two number spinners and a text toggle
     ("12 : 00  PM"): fiddly to hit, no sense of the range, nothing like the app.
     Three columns you click instead. flatpickr still owns the value.
     ---------------------------------------------------------------------- */

  // "now" is the ORGANISATION's, never the viewer's: staff logging in from another
  // timezone must not get their own midnight. See assets/admin/js/tendi-time.js.
  function orgNow() { return (window.TendiTime && TendiTime.now()) || new Date(); }
  function orgToday() { var d = orgNow(); d.setHours(0, 0, 0, 0); return d; }

  function draftOf(fp) {
    var d = fp.selectedDates && fp.selectedDates.length ? new Date(fp.selectedDates[0].getTime()) : null;
    if (!d) { d = orgNow(); d.setHours(9, 0, 0, 0); }
    return d;
  }

  function minuteValues(step, current) {
    var out = [], m;
    for (m = 0; m < 60; m += step) out.push(m);
    if (out.indexOf(current) === -1) { out.push(current); out.sort(function (a, b) { return a - b; }); }
    return out;
  }

  function installTimePanel(fp, el, step) {
    var panel = document.createElement('div');
    panel.className = 'tnd-timepanel';
    fp.calendarContainer.classList.add('tnd-hastime');
    fp.calendarContainer.appendChild(panel);

    function commit(part, value) {
      var d = draftOf(fp);
      var h24 = d.getHours(), h12 = h24 % 12 || 12, isPM = h24 >= 12;
      if (part === 'h') h12 = value;
      if (part === 'm') d.setMinutes(value);
      if (part === 'a') isPM = (value === 'PM');
      d.setHours((h12 % 12) + (isPM ? 12 : 0));
      clearBad(el);
      fp.setDate(d, true);
      render();
    }

    function column(part, values, labelFor, isOn) {
      var col = document.createElement('div');
      col.className = 'tnd-timecol' + (part === 'a' ? ' tnd-timecol-ampm' : '');
      values.forEach(function (v) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'tnd-timecell' + (isOn(v) ? ' is-on' : '');
        b.textContent = labelFor(v);
        b.addEventListener('mousedown', function (ev) { ev.preventDefault(); });  // don't blur the input
        b.addEventListener('click', function (ev) { ev.preventDefault(); commit(part, v); });
        col.appendChild(b);
      });
      return col;
    }

    function render() {
      var d = draftOf(fp);
      var h24 = d.getHours(), h12 = h24 % 12 || 12, mins = d.getMinutes(), pm = h24 >= 12;
      var has = !!(fp.selectedDates && fp.selectedDates.length);
      panel.innerHTML = '';
      panel.appendChild(column('h', [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], String, function (v) { return has && v === h12; }));
      panel.appendChild(column('m', minuteValues(step, mins), pad2, function (v) { return has && v === mins; }));
      panel.appendChild(column('a', ['AM', 'PM'], String, function (v) { return has && (v === 'PM') === pm; }));

      // Centre the choice and decide the fades on the NEXT frame: called from onOpen this
      // runs mid-layout, where clientHeight is 0 and the scroll lands nowhere near it.
      window.requestAnimationFrame(function () {
        Array.prototype.forEach.call(panel.querySelectorAll('.tnd-timecol'), function (col) {
          if (!col.clientHeight) return;
          var on = col.querySelector('.tnd-timecell.is-on');
          if (on) {
            // rects, not offsetTop: the column is not a positioned ancestor, so offsetTop
            // is measured against the whole popup and scrolls to the wrong place.
            var cr = col.getBoundingClientRect(), br = on.getBoundingClientRect();
            col.scrollTop += (br.top - cr.top) - (col.clientHeight / 2 - on.offsetHeight / 2);
          }
          col.classList.toggle('is-scrollable', col.scrollHeight > col.clientHeight + 1);
        });
      });
    }

    render();
    return render;
  }

  /* ---- placement --------------------------------------------------------- */

  /* flatpickr positions absolutely in DOCUMENT coordinates and only flips top/bottom.
     Inside the side drawer, or near the foot of a short window, that leaves the popup
     half off-screen with no way to reach the days. Ours is fixed-positioned and placed
     by hand: preferred below, flipped above when that fits better, and clamped into the
     viewport when neither does. Re-run on scroll and resize while open. */
  function place(fp, el) {
    var cal = fp.calendarContainer;
    if (!cal || !fp.isOpen) return;
    cal.style.position = 'fixed';
    cal.style.right = 'auto';
    cal.style.bottom = 'auto';

    var r = el.getBoundingClientRect();
    var w = cal.offsetWidth, h = cal.offsetHeight;
    var vw = window.innerWidth, vh = window.innerHeight;

    var left = Math.max(MARGIN, Math.min(r.left, vw - w - MARGIN));
    var below = vh - r.bottom - MARGIN;
    var above = r.top - MARGIN;
    var top;
    if (h <= below) top = r.bottom + 4;
    else if (h <= above) top = r.top - h - 4;
    else top = Math.max(MARGIN, Math.min(below >= above ? vh - h - MARGIN : MARGIN, vh - h - MARGIN));

    cal.style.left = Math.round(left) + 'px';
    cal.style.top = Math.round(top) + 'px';
    cal.classList.remove('arrowTop', 'arrowBottom');
  }

  /* ---- field decoration -------------------------------------------------- */

  var CAL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
  var CLOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>';

  function decorate(el, kind) {
    if (!el.parentNode || el.parentNode.classList.contains('tnd-datewrap')) return;
    var wrap = document.createElement('span');
    wrap.className = 'tnd-datewrap';
    el.parentNode.insertBefore(wrap, el);
    wrap.appendChild(el);
    var icon = document.createElement('span');
    icon.className = 'tnd-datewrap-icon';
    icon.innerHTML = (kind === 'time' ? CLOCK_SVG : CAL_SVG);
    wrap.appendChild(icon);
  }

  /* The browser's own autofill list floats over the picker and offers junk it once saw
     in a field with the same name (a stray "600" over the minutes column). autocomplete
     alone is widely ignored, so the password managers get told too. */
  function silenceAutofill(el) {
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('autocapitalize', 'off');
    el.setAttribute('spellcheck', 'false');
    el.setAttribute('data-form-type', 'other');   // 1Password / Dashlane
    el.setAttribute('data-lpignore', 'true');     // LastPass
    el.setAttribute('data-1p-ignore', 'true');
  }

  function partner(id) { return id ? document.getElementById(id) : null; }

  function pairNote(el, msg) {
    var host = el.closest ? (el.closest('.tnd-datewrap') || el) : el;
    if (!host.parentNode) return;
    var note = host.parentNode.querySelector('.tnd-date-note');
    if (!note) {
      note = document.createElement('div');
      note.className = 'tnd-date-note';
      note.setAttribute('role', 'status');
      host.parentNode.insertBefore(note, host.nextSibling);
    }
    note.textContent = msg;
  }

  /* A start/end pair keeps the other end honest.
     This used to hand the partner a HARD minDate/maxDate, which meant that once both ends
     were filled in, a start later than the current end was silently thrown away -- the box
     just emptied, the calendar's next-month arrow was disabled, and the only way to move a
     period later was to know to edit the end first. Nothing said so.
     Now the bound is advisory: nothing the user enters is ever discarded.
       - the partner's calendar still OPENS on the sensible month (jumpToDate), and
       - if the pair ends up inverted we say so, and on a field marked
         data-pair-autoshift="1" we carry the partner along, keeping the original gap,
         and tell the user what moved. */
  function applyPairBounds(el, dates) {
    var d = dates && dates.length ? dates[0] : null;
    var endEl   = partner(el.getAttribute('data-min_date_for'));   // el is the START of a pair
    var startEl = partner(el.getAttribute('data-max_date_for'));   // el is the END of a pair
    var mate = endEl || startEl;
    if (!mate || !mate._flatpickr || !d) return;

    var mateDate = mate._flatpickr.selectedDates[0] || null;
    try { mate._flatpickr.jumpToDate(d); } catch (e) {}
    if (!mateDate) return;

    var inverted = endEl ? (mateDate.getTime() <= d.getTime())    // end must come after start
                         : (mateDate.getTime() >= d.getTime());   // start must come before end
    // Clear the flag off BOTH ends, not just the partner: the field flagged earlier is the
    // one the user is now correcting, and only the other end was ever being cleaned up --
    // so a fixed range stayed marked (and unsaveable).
    if (!inverted) {
      mate.classList.remove('tnd-pair-invalid');
      el.classList.remove('tnd-pair-invalid');
      clearBad(mate);
      return;
    }

    if (el.getAttribute('data-pair-autoshift') === '1') {
      // Measure the period's length from where this field WAS, not from where it has just
      // landed: recomputing against the new value compounds every time the handler runs and
      // walks the partner further away (03/01→06/30 became 10/31 instead of 06/30).
      var prev = el._tndPrevDate || null;
      var gap = prev ? Math.abs(mateDate.getTime() - prev.getTime()) : Math.abs(mateDate.getTime() - d.getTime());
      if (gap < DAY) gap = DAY;
      var moved = new Date(d.getTime() + (endEl ? gap : -gap));
      mate._flatpickr.setDate(moved, false);
      mate._tndBadRaw = null;
      mate.classList.remove('tnd-pair-invalid');
      pairNote(mate, (endEl ? 'End date' : 'Start date') + ' moved to ' +
        tndFormat(moved, mate._tndSpec || 'MM/DD/YYYY') + ' to keep the same length.');
    } else {
      // Flagged, NOT blanked. The pages that own their own copy of this used to clear the
      // partner outright, which is the same "my date vanished" complaint from the other end.
      // Keeping it and refusing the save is the honest version.
      mate.classList.add('tnd-pair-invalid');
      pairNote(mate, endEl ? 'The end date must be after the start date.'
                           : 'The start date must be before the end date.');
    }
  }

  /* ---- enhance ----------------------------------------------------------- */

  function enhance(el, overrides) {
    if (!el || el._flatpickr || !window.flatpickr) return null;
    /* A hidden input is a value CARRIER, not a field, and must never be enhanced.
       flatpickr rewrites whatever element it is handed to type="text" (it stashes the
       original in `_type`), so handing it a hidden input turns an invisible carrier into a
       real box on the page, and decorate() below then gives that box a calendar icon.
       That is what put a second, Gregorian, date field under "Hebrew dob" on the child form:
       jewishluach/script.js has always run .datepicker() over the hidden .greg-date carrier,
       and the jQuery-UI bridge at the foot of this file now answers that call with a
       flatpickr. jQuery-UI left a hidden input hidden, which is why the legacy app shows one
       field there and this one showed two. Worse than the duplicate: the exposed box is
       editable, so the Gregorian date behind the Hebrew one could be typed over directly and
       saved while the Hebrew date on screen still said something else.
       There is no picker to open on a field nobody can see, so refuse it. */
    if (el.tagName === 'INPUT' && el.type === 'hidden') return null;
    overrides = overrides || {};
    var kind = (overrides.kind || el.getAttribute('data-tnd-picker') || 'date').toLowerCase();
    delete overrides.kind;

    var uiFormat = overrides.__ui || el.getAttribute('data-date-format') || window.SITE_DATE_PICKER_FORMAT || 'mm/dd/yy';
    delete overrides.__ui;
    var dateSpec = uiToSpec(uiFormat);
    var timeSpec = overrides.__time || el.getAttribute('data-time-format') || 'h:mm A';
    delete overrides.__time;
    var spec = kind === 'time' ? timeSpec
             : kind === 'datetime' ? (dateSpec + ' ' + timeSpec)
             : dateSpec;

    var opts = {
      allowInput: true,                 // typing is a first-class way in
      enableTime: (kind === 'time' || kind === 'datetime'),
      noCalendar: (kind === 'time'),
      monthSelectorType: 'static',      // no bare native <select> in the popup
      disableMobile: true,              // keep OUR picker on tablets, not the OS one
      minuteIncrement: 5,
      static: false,
      // ours in both directions: flatpickr never interprets or writes the value
      formatDate: function (date) { return tndFormat(date, spec); },
      parseDate: function (str) { return parseStrict(str, kind, spec) || undefined; },
      nextArrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
      prevArrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>',
      // A date the user actually PICKED supersedes whatever unreadable text was in the box.
      // Forgetting it here is what makes the calendar work as an escape route: onClose below
      // used to paste the old text straight back over the pick, so clicking a day looked like
      // it did nothing at all and the only way out was to select-all and retype.
      onChange: function (dates) {
        if (dates && dates.length) { el._tndBadRaw = null; el._tndPicked = true; el._tndLastTyped = null; }
        if (!el._tndBadRaw) clearBad(el);
        applyPairBounds(el, dates);
        el._tndPrevDate = (dates && dates.length) ? dates[0] : null;
      },
      onReady: function (dates) {
        applyPairBounds(el, dates);
        el._tndPrevDate = (dates && dates.length) ? dates[0] : null;
      },
      onOpen: function () { window.requestAnimationFrame(function () { place(el._flatpickr, el); }); },
      // flatpickr rewrites the field from its (empty) selection when it closes, which
      // happens AFTER blur -- so text it could not read was being wiped a moment after
      // we had put it back. Restoring here is the last word -- but only while the text is
      // still the last thing the user expressed; a pick clears the flag above.
      // Clicking a day fires onClose BEFORE onChange, so restoring the old text here directly
      // overwrote the date the user had just picked -- the calendar looked completely inert.
      // Settle on the next tick, once the pick (if any) has landed, and let a selection win.
      onClose: function () {
        el._tndInCal = false;
        setTimeout(function () {
          if (el._flatpickr && el._flatpickr.selectedDates.length) {
            el._tndBadRaw = null; el._tndLastTyped = null; clearBad(el);
            return;
          }
          if (el._tndBadRaw) { el.value = el._tndBadRaw; markBad(el, humanHint(spec)); return; }
          // Typed something unreadable then dismissed the calendar without picking: say so,
          // instead of leaving them with a box flatpickr has quietly emptied.
          var typed = String(el._tndLastTyped == null ? '' : el._tndLastTyped).trim();
          if (typed && !parseStrict(typed, kind, spec)) {
            el._tndBadRaw = typed;
            el.value = typed;
            markBad(el, humanHint(spec));
          }
        }, 0);
      }
    };
    // 'today' would be flatpickr's idea of today, i.e. the VIEWER's; pin it to the org's
    if (el.getAttribute('data-min-today') === '1') opts.minDate = orgToday();
    opts.now = orgNow();          // what flatpickr rings as "today" in the grid

    // a page's own onSelect (the range pages link their partner field through it) keeps
    // running, and now runs for a TYPED date too, not only a clicked one
    var pageOnSelect = overrides.__onSelect; delete overrides.__onSelect;
    if (typeof pageOnSelect === 'function') {
      var baseChange = opts.onChange;
      opts.onChange = function (dates, str, inst) {
        baseChange(dates, str, inst);
        try { pageOnSelect.call(el, el.value, inst); } catch (e) {}
      };
    }
    // jQuery-UI's beforeShowDay greys out days a page considers invalid; flatpickr's
    // `disable` is the same idea with the boolean flipped.
    var bsd = overrides.__beforeShowDay; delete overrides.__beforeShowDay;
    if (typeof bsd === 'function') {
      opts.disable = [function (date) {
        try { var r = bsd.call(el, date); return !(r && r[0]); } catch (e) { return false; }
      }];
    }

    var k, ov = overrides;
    for (k in ov) { if (Object.prototype.hasOwnProperty.call(ov, k)) opts[k] = ov[k]; }

    el.classList.add('tnd-dateinput');
    silenceAutofill(el);

    // What the SERVER put in the field, before flatpickr touches it.
    var incoming = String(el.value == null ? '' : el.value);

    var fp = window.flatpickr(el, opts);
    decorate(el, kind);

    /* data-tnd-value="iso": show the org's format, POST yyyy-mm-dd.
       This is what lets a field move off <input type="date"> without touching the controller
       behind it -- a native date input already posts ISO, so we keep posting ISO from a hidden
       twin carrying the original name, and the visible box becomes an ordinary Tendi picker.
       Anything reading the field server-side sees exactly what it saw before. */
    if (el.getAttribute('data-tnd-value') === 'iso' && el.name) {
      var mirror = document.createElement('input');
      mirror.type = 'hidden';
      mirror.name = el.name;
      el.removeAttribute('name');                       // only the mirror posts
      (el.parentNode || document.body).insertBefore(mirror, el.nextSibling);
      el._tndMirror = mirror;
      var syncMirror = function () {
        var d = fp.selectedDates[0];
        mirror.value = d ? tndFormat(d, 'YYYY-MM-DD') : '';
      };
      syncMirror();
      fp.config.onChange.push(syncMirror);
      fp.config.onClose.push(function () { setTimeout(syncMirror, 0); });
      el.addEventListener('blur', function () { setTimeout(syncMirror, 0); });
    }

    // A press inside this field's own popup is part of answering the field, not leaving it.
    // The blur handler below uses this to tell "reached into the calendar" from "walked away".
    if (fp && fp.calendarContainer) {
      fp.calendarContainer.addEventListener('mousedown', function () { el._tndInCal = true; }, true);
    }

    if (opts.enableTime) {
      var repaint = installTimePanel(fp, el, opts.minuteIncrement);
      var prevChange = opts.onChange, prevOpen = opts.onOpen;
      fp.set('onChange', function (d, s, i) { if (prevChange) prevChange(d, s, i); repaint(); });
      fp.set('onOpen', function (d, s, i) { if (prevOpen) prevOpen(d, s, i); repaint(); });
    }

    el._tndKind = kind;
    el._tndSpec = spec;

    /* Type-as-you-go separators. Someone typing 06012026 gets 06/01/2026 as they go, so the
       "that is not a date I can read" state is never reached by typing at all. Deliberately
       hands off the moment the user types their own separator (6/1/26 stays theirs), while
       deleting, or when the caret is not at the end -- a mask that fights the caret is worse
       than no mask. Dates only; times have their own shape. */
    var maskOrder = specOrder(spec), maskWidths = specWidths(spec, maskOrder), maskSep = specSep(spec);
    function applyMask() {
      if (el.selectionStart !== el.value.length) return;      // editing mid-string: leave it alone
      var digits = el.value.replace(/\D/g, '');
      if (!digits) return;
      var max = maskWidths[0] + maskWidths[1] + maskWidths[2];

      /* When may the FIRST separator appear? As soon as the month is complete -- that is what
         you expect while typing, and waiting until the whole date was in felt broken.
         The catch is ISO: "2026-06-01" also opens with digits, and turning "2026" into
         "20/26" mangled it before the user reached the dash. Months settle it: an ISO year
         begins 19xx or 20xx, and neither 19 nor 20 is a month, so from the second keystroke
         the two are already telling apart. Where the format leads with the DAY that test is
         no good (20 is a fine day), so there we still hold off until the 5th digit. */
      var head = parseInt(digits.slice(0, 2), 10);
      var earlyOk = (maskOrder[0] === 'm') && head >= 1 && head <= 12;
      if (!earlyOk && digits.length < 5) return;

      digits = digits.slice(0, max);
      var out = '', pos = 0;
      for (var i = 0; i < 3 && pos < digits.length; i++) {
        if (i) out += maskSep;
        out += digits.substr(pos, maskWidths[i]);
        pos += maskWidths[i];
      }
      // A part just filled up and another is still to come: show the separator now, so the
      // next part is typed into a clean slot rather than appearing to run on.
      if (digits.length < max) {
        if (digits.length === maskWidths[0] || digits.length === maskWidths[0] + maskWidths[1]) out += maskSep;
      }
      if (out === el.value) return;
      el.value = out;
      try { el.setSelectionRange(out.length, out.length); } catch (e) {}
    }

    el.addEventListener('focus', function () { el._tndUserSep = false; });
    el.addEventListener('input', function (e) {
      clearBad(el);
      // flatpickr dispatches its OWN input event after it writes a picked date into the box.
      // Treating that as typing cleared the "they picked it" flag a moment after it was set,
      // so the blur below could still resurrect the old bad text. Only real keystrokes count.
      if (e && e.isTrusted === false) return;
      el._tndPicked = false;                                  // typing supersedes an earlier pick
      el._tndLastTyped = el.value;                            // what onClose should judge
      if (kind !== 'date') return;
      var typed = e && e.data;
      if (typed && /\D/.test(typed)) {                     // their separators, their format
        el._tndUserSep = true;
        // ...but the mask may have just put one there itself, and typing "02/30/2026" over
        // the top of an auto-inserted slash produced "02//30/2026". One separator is enough.
        // Strictly a separator landing on a separator the MASK added -- an earlier, looser
        // version ate any two non-digits in a row and reduced "not a date" to "n".
        if (/[^0-9a-zA-Z]/.test(typed) && el.selectionStart === el.value.length &&
            el.value.length >= 2 && el.value.charAt(el.value.length - 2) === maskSep) {
          el.value = el.value.slice(0, -1);
          try { el.setSelectionRange(el.value.length, el.value.length); } catch (e2) {}
        }
        return;
      }
      if (e && typeof e.inputType === 'string' && e.inputType.indexOf('delete') === 0) {
        // deleting back through a separator the mask added leaves it dangling ("06/01/")
        if (el.selectionStart === el.value.length && /\D$/.test(el.value)) {
          el.value = el.value.replace(/\D+$/, '');
          try { el.setSelectionRange(el.value.length, el.value.length); } catch (e2) {}
        }
        return;
      }
      if (el._tndUserSep) return;
      applyMask();
    });

    // flatpickr parses with OUR parser now, so text it cannot read simply clears the field.
    // Put the text back and say what is wrong, rather than leaving them staring at an empty
    // box wondering where their typing went. `_tndRawAtBlur` is captured on the way down
    // (see below) because by the time this runs flatpickr has already emptied the field.
    el.addEventListener('blur', function () {
      // Reaching INTO the calendar blurs the input, but the user has not finished with the
      // field -- they are mid-answer. Judging the text now (and pinning it as "bad") is what
      // fought the pick that was about to arrive. Defer to onClose, which settles it either
      // way. Note this is specifically a press inside the popup, not merely "popup is open":
      // tabbing away with the calendar still showing must still be judged.
      if (el._tndInCal) { el._tndInCal = false; el._tndRawAtBlur = null; return; }
      var raw = String(el._tndRawAtBlur == null ? el.value : el._tndRawAtBlur).trim();
      el._tndRawAtBlur = null;
      if (raw === '' || parseStrict(raw, kind, spec)) { el._tndBadRaw = null; clearBad(el); return; }
      // A date picked from the calendar outranks text the parser could not read. Clicking a
      // day moves focus out of the input, so this handler runs holding the OLD text and used
      // to paste it back over the pick -- which is why the calendar looked completely dead
      // once a field had gone bad. The picker's selection is the newer statement of intent.
      var picked = el._flatpickr && el._flatpickr.selectedDates[0];
      if (picked && (el._tndPicked || el.value === tndFormat(picked, spec))) {
        el._tndPicked = false;
        el._tndBadRaw = null;
        el.value = tndFormat(picked, spec);
        clearBad(el);
        return;
      }
      el._tndBadRaw = raw;
      el.value = raw;
      markBad(el, humanHint(spec));
    });

    /* NEVER empty a field we merely failed to read.
       flatpickr rewrites the input from its own (empty) selection, so a stored value our
       parser did not understand came back as an empty box -- and the next save of that
       record would write the blank back to the database. Nobody typed anything; the value
       would just be gone. Whatever we cannot parse is put back exactly as the server sent
       it, so an untouched field saves back unchanged.
       This runs LAST on purpose: for a time field the panel install and the fp.set() calls
       above each redraw the input, so restoring any earlier gets undone. */
    if (incoming !== '' && el.value === '') el.value = incoming;

    return fp;
  }

  /* data-tnd-value="iso-keep" -- the conversion path off <input type="date">.

     A native date input holds, posts and reports yyyy-mm-dd, and pages lean on that:
     jqView('#x').val() to read a filter, .val('').trigger('change') to clear one, and change
     handlers bound to that id. Turning such a field into an ordinary picker would quietly
     start handing all of that "06/01/2026" instead.

     So the original element STAYS, keeping its id, name, value and events -- it just goes
     hidden and carries ISO exactly as before. A visible Tendi picker is put beside it and the
     two are kept in step, with a `change` fired on the original so existing handlers still
     run. Converting a field is then a markup-only change: type="date" becomes type="text"
     plus these two attributes, and not a line of that page's JS has to move. */
  function installIsoKeep(orig) {
    if (!orig || orig._tndIsoTwin) return null;
    var vis = document.createElement('input');
    vis.type = 'text';
    /* Deliberately NOT a copy of the original's classes. Pages select these fields by class
       and read them -- jqView('.next_due_date').val(), '.clearanceDate', '.cleared_due_date' --
       and a twin wearing the same class would join those collections and answer with the
       display format. The twin takes the layout class only; anything else a page needs on it
       is named explicitly in data-tnd-twin-class. */
    vis.className = ('tnd-iso-twin ' +
      (/(^|\s)form-control(\s|$)/.test(orig.className) ? 'form-control ' : '') +
      (orig.getAttribute('data-tnd-twin-class') || '')).trim();
    vis.setAttribute('placeholder', orig.getAttribute('placeholder') || humanHint(uiToSpec(window.SITE_DATE_PICKER_FORMAT || 'mm/dd/yy')));
    if (orig.disabled) vis.disabled = true;
    if (orig.readOnly) vis.readOnly = true;
    if (orig.getAttribute('required') !== null) vis.setAttribute('aria-required', 'true');
    // carry the picker's own configuration across, then stop the original looking like a field
    ['data-tnd-picker', 'data-min_date_for', 'data-max_date_for', 'data-pair-autoshift', 'data-min-today', 'data-date-format']
      .forEach(function (a) { if (orig.hasAttribute(a)) { vis.setAttribute(a, orig.getAttribute(a)); orig.removeAttribute(a); } });
    if (orig.id) {
      vis.id = orig.id + '__tnd';
      var lbl = document.querySelector('label[for="' + orig.id + '"]');
      if (lbl) lbl.setAttribute('for', vis.id);
    }
    vis.value = orig.value || '';              // ISO in; the parser reads ISO, so it displays right
    orig.type = 'hidden';
    orig._tndIsoTwin = vis;
    // AFTER the original, not before: should a class ever be shared anyway, jQuery's .val()
    // reads the FIRST match in document order, and that must stay the ISO carrier.
    (orig.parentNode || document.body).insertBefore(vis, orig.nextSibling);

    var fp = enhance(vis);
    if (!fp) return null;
    vis._tndIsoOwner = orig;

    var syncing = false;
    var pushToOrig = function () {
      if (syncing) return;
      var d = fp.selectedDates[0];
      var iso = d ? tndFormat(d, 'YYYY-MM-DD') : '';
      if (orig.value === iso) return;
      syncing = true;
      orig.value = iso;
      // BOTH events on purpose. A native date input fires `input` as well as `change`, and
      // pages bound to either -- route_playground filters on jqView('input#end_date').on('input')
      // -- would otherwise go quiet, since a hidden input fires nothing on its own.
      ['input', 'change'].forEach(function (type) {
        try {
          orig.dispatchEvent(new Event(type, { bubbles: true }));
        } catch (e) {
          var ev = document.createEvent('HTMLEvents'); ev.initEvent(type, true, false); orig.dispatchEvent(ev);
        }
      });
      syncing = false;
    };
    fp.config.onChange.push(pushToOrig);
    fp.config.onClose.push(function () { setTimeout(pushToOrig, 0); });
    vis.addEventListener('blur', function () { setTimeout(pushToOrig, 0); });

    // The other direction: page code doing .val(x).trigger('change') on the original.
    // Bound BOTH ways on purpose -- jQuery's .trigger() runs jQuery-bound handlers and does
    // not dispatch a real DOM event for 'change', so an addEventListener alone never hears
    // the pages that clear a filter with .val('').trigger('change'). Re-entry is guarded, and
    // the body is idempotent, so being called twice is harmless.
    var pullFromOrig = function () {
      if (syncing) return;
      syncing = true;
      var d = orig.value ? parseStrict(orig.value, 'date', 'YYYY-MM-DD') : null;
      fp.setDate(d || null, false);
      if (!d) vis.value = '';
      vis._tndBadRaw = null; vis._tndLastTyped = null; clearBad(vis);
      syncing = false;
    };
    orig.addEventListener('change', pullFromOrig);
    if (window.jQuery) { try { window.jQuery(orig).on('change.tndIsoKeep', pullFromOrig); } catch (e) {} }

    /* AND the case with no event at all, which is the one that actually bit.
       `jqView('#brcDate').val('2026-09-10')` assigns elem.value and fires NOTHING -- jQuery's
       .val() is a plain assignment. Several pages do exactly that, deliberately: setting a
       filter must not re-trigger the change handler that would reload the report. On a native
       <input type="date"> that was harmless, because the element the page wrote to was also the
       element the operator could see. Once the visible field is a TWIN, a write nobody announces
       leaves the twin showing the old value -- or, on first load, showing nothing at all while
       the carrier holds a real date. Worse, the twin's blur handler then pushes its own empty
       value back over the good one, so clicking into the box and out DESTROYS the date.
       (Route Report Cards and the Therapy Board both did this; docs/MAIN-TO-RESKIN-PARITY-PLAN.md.)

       So intercept the assignment itself. The native getter/setter are taken from
       HTMLInputElement.prototype and still do all the real work -- this only adds a notification
       after the value has landed, so `orig.value` behaves exactly as before for every reader,
       including the form serialiser that posts it. pushToOrig's own write is covered by the
       `syncing` guard it already sets, so the two directions cannot loop.

       Any page that CAN fire change should still do so; this is the safety net that means a page
       which does not is merely undecorated rather than broken. */
    try {
      var nativeValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      if (nativeValue && nativeValue.get && nativeValue.set) {
        Object.defineProperty(orig, 'value', {
          configurable: true,
          enumerable: true,
          get: function () { return nativeValue.get.call(this); },
          set: function (v) {
            nativeValue.set.call(this, v);
            if (!syncing) { try { pullFromOrig(); } catch (e) {} }
          }
        });
      }
    } catch (e) { /* no defineProperty on this element: the change-event paths above still work */ }

    return fp;
  }

  function enhanceAll(root) {
    var scope = root || document;
    if (scope.querySelectorAll) {
      Array.prototype.slice.call(scope.querySelectorAll('[data-tnd-value="iso-keep"]'))
        .forEach(function (n) { try { installIsoKeep(n); } catch (e) {} });
    }
    var nodes = scope.querySelectorAll ? scope.querySelectorAll('[data-tnd-picker]') : [];
    // starts before ends, so a pair's bounds settle in one pass
    Array.prototype.slice.call(nodes)
      .sort(function (a, b) { return (a.getAttribute('data-min_date_for') ? 0 : 1) - (b.getAttribute('data-min_date_for') ? 0 : 1); })
      .forEach(function (n) { try { enhance(n); } catch (e) {} });
  }

  /* yyyy-mm-dd out of any picker, whatever it is showing. The remaining
     <input type="date"> fields are read by their own page's JS as ISO
     (jqView('#x').val()); this is the one-line swap that lets such a field move onto the
     Tendi picker without its page having to learn a new format:
         jqView('#x').val()   ->   TndDate.isoVal('#x')
     Returns '' when the field is empty or holds something unreadable. */
  function isoVal(sel) {
    var el = typeof sel === 'string' ? document.querySelector(sel) : (sel && sel.jquery ? sel[0] : sel);
    if (!el) return '';
    if (el._tndMirror) return el._tndMirror.value || '';
    var fp = el._flatpickr;
    if (fp && fp.selectedDates.length) return tndFormat(fp.selectedDates[0], 'YYYY-MM-DD');
    var d = parseStrict(el.value, el._tndKind || 'date', el._tndSpec || 'MM/DD/YYYY');
    return d ? tndFormat(d, 'YYYY-MM-DD') : '';
  }

  window.TndDate = {
    enhance: enhance,
    enhanceAll: enhanceAll,
    format: tndFormat,
    parse: parseStrict,
    uiToSpec: uiToSpec,
    isoVal: isoVal,
    isoKeep: installIsoKeep
  };

  /* ---- one picker at a time, and keep it where it can be seen ------------- */

  /* Grab what the field holds BEFORE anything else reacts to the blur. flatpickr's own
     blur handler runs first, empties a field it could not parse, and dispatches a
     synthetic `input` event while doing it -- so anything that tracked the user's typing
     from `input` was already overwritten with "" by the time we looked. Capture phase on
     the way down beats every listener on the element itself. */
  document.addEventListener('blur', function (e) {
    var el = e.target;
    if (el && el.classList && el.classList.contains('tnd-dateinput')) el._tndRawAtBlur = el.value;
  }, true);

  // Opening a second field used to leave the first popup on screen, the two overlapping.
  document.addEventListener('mousedown', function (e) {
    var cal = e.target.closest ? e.target.closest('.flatpickr-calendar') : null;
    var field = e.target.closest ? e.target.closest('[data-tnd-picker]') : null;
    Array.prototype.forEach.call(document.querySelectorAll('[data-tnd-picker]'), function (el) {
      if (!el._flatpickr || !el._flatpickr.isOpen) return;
      if (el === field) return;
      if (cal && el._flatpickr.calendarContainer === cal) return;   // a click inside its own popup
      el._flatpickr.close();
    });
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' && e.which !== 27) return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-tnd-picker]'), function (el) {
      if (el._flatpickr && el._flatpickr.isOpen) el._flatpickr.close();
    });
  }, true);

  function repositionOpen() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-tnd-picker]'), function (el) {
      if (el._flatpickr && el._flatpickr.isOpen) place(el._flatpickr, el);
    });
  }
  window.addEventListener('scroll', repositionOpen, true);   // capture: also drawer/panel scrolling
  window.addEventListener('resize', repositionOpen);

  /* ---- the jQuery-UI bridge ----------------------------------------------
     Eighteen views call $(...).datepicker({...}) or .timepicker({...}), some on a
     class, some on an id, some on rows they build at runtime. Rather than hand-edit
     every one of those call sites and hope none was missed, the calls are answered
     here: the same call now builds a TndDate picker, carrying the page's own
     dateFormat, minDate/maxDate, onSelect and beforeShowDay across.

     The read/write API those pages use is served from the flatpickr instance:
     getDate, setDate, option get/set, destroy, hide -- and timepicker's setTime.
     Anything unrecognised falls through to the original widget, so nothing that
     relied on a corner of jQuery-UI silently loses it.
     ---------------------------------------------------------------------- */
  function uiBound(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return v;
    // jQuery-UI counts days from today; that has to be the org's today, not the viewer's
    if (typeof v === 'number') { var d = orgToday(); d.setDate(d.getDate() + v); return d; }
    if (v === 'today') return orgToday();
    return v;
  }

  function installBridge($) {
    if (!$ || !$.fn || $.fn.__tndBridged) return;
    var origDate = $.fn.datepicker, origTime = $.fn.timepicker;

    function api(el, args, orig) {
      var fp = el._flatpickr;
      if (!fp) return orig ? orig.apply($(el), args) : undefined;
      var m = args[0];
      if (m === 'getDate') return (fp.selectedDates && fp.selectedDates[0]) || null;
      if (m === 'setDate' || m === 'setTime') { fp.setDate(args[1] || null, false); return null; }
      if (m === 'destroy') { fp.destroy(); return null; }
      if (m === 'hide' || m === 'close') { fp.close(); return null; }
      if (m === 'show' || m === 'open') { fp.open(); return null; }
      if (m === 'option') {
        var name = args[1];
        if (args.length < 3) {                       // a getter
          if (name === 'dateFormat') return el.getAttribute('data-date-format') || window.SITE_DATE_PICKER_FORMAT || 'mm/dd/yy';
          if (name === 'onSelect') return fp.config.onSelectProxy || null;
          return fp.config[name];
        }
        if (name === 'minDate' || name === 'maxDate') fp.set(name, uiBound(args[2]));
        else if (name === 'onSelect') fp.config.onSelectProxy = args[2];
        else try { fp.set(name, args[2]); } catch (e) {}
        return null;
      }
      return null;
    }

    $.fn.datepicker = function (opts) {
      var args = Array.prototype.slice.call(arguments);
      if (typeof opts === 'string') {
        var first = this[0];
        var res = first ? api(first, args, origDate) : undefined;
        return (args[0] === 'getDate' || (args[0] === 'option' && args.length < 3)) ? res : this;
      }
      var o = opts || {};
      this.each(function () {
        try {
          enhance(this, {
            kind: 'date',
            __ui: o.dateFormat,
            __onSelect: o.onSelect,
            __beforeShowDay: o.beforeShowDay,
            minDate: uiBound(o.minDate),
            maxDate: uiBound(o.maxDate)
          });
        } catch (e) { if (origDate) origDate.call($(this), o); }
      });
      return this;
    };

    $.fn.timepicker = function (opts) {
      var args = Array.prototype.slice.call(arguments);
      if (typeof opts === 'string') {
        var first = this[0];
        var res = first ? api(first, args, origTime) : undefined;
        return args[0] === 'getDate' ? res : this;
      }
      var o = opts || {};
      // jquery-ui-timepicker's "hh:mm TT" is 07:30 AM, leading zero and all
      var spec = String(o.timeFormat || 'hh:mm TT')
        .replace(/TT/g, 'A').replace(/tt/g, 'a').replace(/HH|hh/g, function (m) { return m === 'HH' ? 'HH' : 'hh'; });
      this.each(function () {
        try { enhance(this, { kind: 'time', __time: spec }); }
        catch (e) { if (origTime) origTime.call($(this), o); }
      });
      return this;
    };

    $.fn.__tndBridged = true;
  }

  /* Nothing typed is thrown away any more -- an unreadable date stays on screen and an
     inverted range keeps both ends. The other half of that bargain is that neither can be
     saved by accident: catch the submit, put the cursor on the offending field and let its
     own note explain. Capture phase so it lands before a page's own submit handler. */
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || !form.querySelector) return;
    var bad = form.querySelector('.tnd-pair-invalid, .tnd-date-bad');
    if (!bad) return;
    e.preventDefault();
    e.stopPropagation();
    try { bad.focus({ preventScroll: false }); } catch (e2) { try { bad.focus(); } catch (e3) {} }
    try { bad.scrollIntoView({ block: 'center' }); } catch (e4) {}
  }, true);

  function boot() { installBridge(window.jQuery); enhanceAll(document); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // The admin is a hash-routed SPA and forms also load into the side drawer, so fields
  // arrive long after DOMContentLoaded. Re-scan after every AJAX load; enhance() no-ops
  // on anything already wired.
  if (window.jQuery) window.jQuery(document).on('ajaxComplete.tndDate', function () { setTimeout(boot, 0); });

  /* ...and rows added by a plain "add another" button never touch the network, so the hook
     above never hears about them. Watch the document instead: a date field is wired wherever
     it comes from. Debounced, and enhance()/installIsoKeep() both no-op on anything already
     done, so this costs one query per burst of DOM changes. */
  if (window.MutationObserver) {
    var rescan = null;
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        if (records[i].addedNodes && records[i].addedNodes.length) {
          if (rescan) clearTimeout(rescan);
          rescan = setTimeout(function () { rescan = null; try { enhanceAll(document); } catch (e) {} }, 60);
          return;
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})(window, document);
