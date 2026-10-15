/* ============================================================
   TendiTime -- "now" and "today" as the ORGANISATION sees them
   ------------------------------------------------------------
   The server is New York end to end: the box runs America/New_York, php.ini and
   every per-environment constants.php set America/New_York, and MySQL runs
   time_zone=SYSTEM on nodes whose clocks are all EDT. Everything PHP writes and
   every NOW() / CURDATE() is New York wall-clock.

   The browser is the odd one out, in two ways:

   1. `new Date().toISOString().split('T')[0]` is a UTC date, not a local one. In
      New York that is TOMORROW every evening after 8pm EDT (7pm EST). The
      attendance board's default date, the meals "Today" button and the CAPS
      report all read the date that way, so an evening user was silently working
      on the next day.

   2. `new Date()` is the VIEWER's timezone. Staff logging in from outside New
      York (there are already users on a Panama IP) get their own midnight, not
      the centre's, so "today" disagrees with what the server just wrote.

   Both are answered the same way: ask for New York explicitly. Intl is built in
   and handles DST without a table to maintain. Modelled on the nyNowLocal()
   helper already living in notice_manage.php, which solved this once locally.

   IMPORTANT: now() returns a Date whose LOCAL fields carry New York wall-clock
   time. That is what the rest of the app wants, because every value it formats
   and submits is naive wall-clock (mm/dd/yyyy, hh:mm AM) with no zone attached.
   Do not call .toISOString() on it -- that would undo the whole point.
   ============================================================ */
(function (window) {
  'use strict';

  var ZONE = (window.TENDI_TIMEZONE || 'America/New_York');

  function partsInZone(date) {
    var out = {};
    try {
      new Intl.DateTimeFormat('en-CA', {
        timeZone: ZONE,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).formatToParts(date || new Date()).forEach(function (p) { out[p.type] = p.value; });
    } catch (e) { return null; }        // no Intl / bad zone -> caller falls back
    if (out.hour === '24') out.hour = '00';   // some engines report midnight as 24
    return out;
  }

  // A Date whose local fields ARE the New York wall clock.
  function now() {
    var p = partsInZone(new Date());
    if (!p) return new Date();
    return new Date(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second, 0);
  }

  // Midnight today, New York.
  function startOfToday() {
    var d = now();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // 'YYYY-MM-DD' for New York today. The safe replacement for
  // new Date().toISOString().split('T')[0], which is a UTC date.
  function today() {
    var p = partsInZone(new Date());
    if (!p) { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    return p.year + '-' + p.month + '-' + p.day;
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // 'YYYY-MM-DDTHH:MM', the shape <input type="datetime-local"> wants.
  function nowLocalInput() {
    var p = partsInZone(new Date());
    if (!p) { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
    return p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute;
  }

  // Is the viewer's own clock in a different zone from the organisation's? Useful
  // when deciding whether to say so in the UI.
  function viewerIsElsewhere() {
    var n = now(), local = new Date();
    return Math.abs(n.getTime() - local.getTime()) > 60000;
  }

  window.TendiTime = {
    zone: ZONE,
    now: now,
    today: today,
    startOfToday: startOfToday,
    nowLocalInput: nowLocalInput,
    viewerIsElsewhere: viewerIsElsewhere
  };
})(window);
