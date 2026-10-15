/* ============================================================
   Tendi NAV behaviour: icon rail + sliding sub-pane.

   Pairs with template.php (#sidebar-left.tnd-rail-shell) + tendi-nav.css.
   Responsibilities:
     · rail group click  → open/toggle that group's sub-pane (Dashboard navigates)
     · collapse button    → close the sub-pane
     · hash → active sync → highlight the current page's group (rail) + leaf
                            (sub-item), and auto-open that group's sub-pane.

   SPA navigation itself is NOT handled here: leaf items + the Dashboard rail
   item carry the legacy `.ajax-page-link` class, so devoops.js's document-level
   handler does the LoadAjaxContent + hash update. We only react to the result.

   Self-scoping + defensive: a no-op on any page that lacks the rail markup.
   ============================================================ */
(function () {
  "use strict";

  function onReady(fn) {
    if (document.readyState !== "loading") { fn(); }
    else { document.addEventListener("DOMContentLoaded", fn); }
  }

  onReady(function () {
    var rail = document.querySelector(".tnd-rail");
    var pane = document.getElementById("tndSubpane");
    if (!rail || !pane) { return; }

    var titleEl = document.getElementById("tndSubpaneTitle");
    var collapseBtn = document.getElementById("tndSubpaneCollapse");
    var railItems = Array.prototype.slice.call(rail.querySelectorAll(".tnd-rail-item"));
    var subnavs = Array.prototype.slice.call(pane.querySelectorAll(".tnd-subnav"));

    function setPaneOpen(open) {
      pane.setAttribute("data-open", open ? "true" : "false");
      pane.setAttribute("aria-hidden", open ? "false" : "true");
      document.body.classList.toggle("tnd-pane-open", !!open);
    }

    // Show the sub-pane for `key` (reveal its .tnd-subnav, hide the rest, set the
    // header title, mark the rail item .open). Returns false if no such group.
    function showGroup(key) {
      var match = null;
      subnavs.forEach(function (nav) {
        var isMatch = nav.getAttribute("data-group") === key;
        nav.hidden = !isMatch;
        if (isMatch) { match = nav; }
      });
      if (!match) { return false; }
      if (titleEl) { titleEl.textContent = match.getAttribute("data-title") || ""; }
      railItems.forEach(function (item) {
        var on = item.getAttribute("data-group") === key;
        item.classList.toggle("open", on);
        if (!item.classList.contains("tnd-rail-nav")) {
          item.setAttribute("aria-expanded", on ? "true" : "false");
        }
      });
      setPaneOpen(true);
      return true;
    }

    function closePane() {
      setPaneOpen(false);
      railItems.forEach(function (item) {
        item.classList.remove("open");
        if (!item.classList.contains("tnd-rail-nav")) {
          item.setAttribute("aria-expanded", "false");
        }
      });
    }

    // Current SPA page key, e.g. "branches", "bus_routes/report" (hash, minus any
    // ?state params). Defaults to dashboard when there's no hash.
    function currentPage() {
      var hash = (window.location.hash || "").replace(/^#/, "");
      if (!hash.length) { hash = "dashboard"; }
      return hash.split("?")[0];
    }

    // Find the best-matching leaf for the current page: exact url, else the
    // longest leaf url that is a path-prefix of the page (so children/edit/5 →
    // Children, and bus_routes/report beats bus_routes for that page).
    function matchLeaf(page) {
      var best = null, bestLen = -1, bestGroup = null;
      subnavs.forEach(function (nav) {
        var grp = nav.getAttribute("data-group");
        var items = nav.querySelectorAll(".tnd-sub-item");
        Array.prototype.forEach.call(items, function (a) {
          var url = a.getAttribute("data-url") || "";
          if (!url) { return; }
          var hit = (page === url) || (page.indexOf(url + "/") === 0);
          if (hit && url.length > bestLen) {
            best = a; bestLen = url.length; bestGroup = grp;
          }
        });
      });
      return { leaf: best, group: bestGroup };
    }

    // Mark the rail group + leaf for the current page. Returns the match.
    function syncActive() {
      var page = currentPage();
      var m = matchLeaf(page);

      pane.querySelectorAll(".tnd-sub-item.active").forEach(function (a) {
        a.classList.remove("active");
      });
      railItems.forEach(function (item) {
        var key = item.getAttribute("data-group");
        var on = m.group ? (key === m.group)
                         : (key === "dashboard" && page === "dashboard");
        item.classList.toggle("active", !!on);
      });
      if (m.leaf) { m.leaf.classList.add("active"); }
      return { page: page, group: m.group, leaf: m.leaf };
    }

    // ---- rail clicks -----------------------------------------------------
    railItems.forEach(function (item) {
      item.addEventListener("click", function (e) {
        // Dashboard (and any direct-nav rail item): let .ajax-page-link navigate;
        // we only collapse the pane. Do NOT preventDefault.
        if (item.classList.contains("tnd-rail-nav")) {
          closePane();
          return;
        }
        e.preventDefault();
        var key = item.getAttribute("data-group");
        var alreadyOpen = pane.getAttribute("data-open") === "true" && item.classList.contains("open");
        if (alreadyOpen) { closePane(); }
        else { showGroup(key); }
      });
    });

    if (collapseBtn) {
      collapseBtn.addEventListener("click", closePane);
    }

    // ---- react to SPA navigation ----------------------------------------
    window.addEventListener("hashchange", function () {
      var state = syncActive();
      if (state.group) { showGroup(state.group); }
      else { closePane(); }
    });

    // ---- initial state ---------------------------------------------------
    var initial = syncActive();
    if (initial.group) { showGroup(initial.group); } // land showing where you are
    else { setPaneOpen(false); }                      // dashboard → pane closed
  });
})();
