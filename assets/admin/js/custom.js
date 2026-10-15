/* Popups are gated system-wide: a modal closes through its own X / Cancel control only,
   never on ESC and never on a click outside it.

   Bootstrap 3 reads these two defaults when it instantiates a modal, so setting them at
   the source covers every popup in the app — including the ~110 opened programmatically
   with .modal('show'), which no per-view edit would have reached.

   Per-modal opt-out still works and still wins: data-backdrop / data-keyboard on the
   modal (or the trigger) are merged OVER these defaults by Bootstrap. That is what keeps
   the Reports button modal's deliberate data-backdrop="false" (no overlay at all) intact.

   Runs at parse time, before any view calls jQuery.noConflict(), and head.php loads
   bootstrap.min.js ahead of this file — so jQuery.fn.modal is already defined here. The
   guard is belt-and-braces for the login/front pages that skip the admin bootstrap. */
if (window.jQuery && jQuery.fn.modal) {
	jQuery.fn.modal.Constructor.DEFAULTS.backdrop = 'static';
	jQuery.fn.modal.Constructor.DEFAULTS.keyboard = false;
}

document.addEventListener("click", (evt) => {
	const message_center = document.getElementById('message_center');
	let targetElement = evt.target; // clicked element
	const chkClickedLauncher = evt.target.closest("a");
	do {
		if (targetElement == message_center) {
			// This is a click inside. Do nothing, just return.
			// console.log("Clicked inside!");
			return;
		}
		// Go up the DOM
		targetElement = targetElement.parentNode;
	} while (targetElement);

	// This is a click outside.
	if(chkClickedLauncher !== null && chkClickedLauncher.classList.contains('alerts-notification')){
		// do nothing
	}else{
		// console.log("Clicked outside!");
		jqView('.message_center').removeClass('visible');
	}

	// Two app-level force-closers used to live here: a click on .modal / .modal-dialog and a
	// document-level ESC keydown, each calling jqView('.modal').modal('hide'). Both hid EVERY
	// open modal by direct API call, which bypasses a modal's own backdrop/keyboard settings —
	// so they overrode the gating above (and even the already-static #upload_file). Removed:
	// an opt-out belongs on the individual modal via data-backdrop / data-keyboard, not in a
	// blanket document handler. The message-center close just above is unrelated and stays.
});
let busAssignmentInterval = null;
function handleBusAssignment() {
    if (location.hash === "#route_playground") {
        if (!busAssignmentInterval) {
            busAssignmentInterval = setInterval(function () {
                // The sync tick blanks + redraws both lists. Doing that mid-interaction
                // detaches the element under the user's cursor (cancels an in-flight
                // drag) or redraws under an open dialog: skip and catch up next tick.
                if (document.querySelector('.ui-draggable-dragging, .ui-sortable-helper, .modal.in')) {
                    console.log("Skipped playground refresh (interaction in progress)");
                    return;
                }
                console.log("Running playground script");
                jqView('.children_wrapper').html('');
                applyFilters();
                applyFiltersBusRoutes();
            }, 10000);
        }
    } else {
        if (busAssignmentInterval) {
            clearInterval(busAssignmentInterval);
            busAssignmentInterval = null;
            console.log("Stopped playground script");
        }
    }
}
$(window).on("hashchange", handleBusAssignment);
$(document).ready(handleBusAssignment);

/**
 * LIVE class move -> what happens to TODAY's attendance?
 *
 * The classroom tablet roster (api/children/attendance_report) is keyed off today's ATTENDANCE row's
 * class, not children.class. The server only re-points that row while the child has not been checked
 * in or out yet, so a child moved after arriving would silently disappear from the new class's tablet
 * and stay on the old one until tomorrow. Rather than guess for the office, ask.
 *
 * ONE implementation, shared by every surface that moves a live class (Children form, Current
 * Enrollment grid) so no two surfaces can answer the question differently.
 *
 * cb(moveToday) gets 1 = move today's attendance too, 0 = leave today where it is. Never blocks the
 * move itself; on any error it falls through to 0 (today's behaviour before this prompt existed).
 */
function confirmTodayAttendanceMove(childId, newClassId, cb) {
	if (!childId || !newClassId) { cb(0); return; }
	jqView.ajax({
		url: "children/class_move_attendance_check",
		type: "POST",
		data: { child_id: childId, class_id: newClassId },
		dataType: "json",
		success: function (r) {
			if (!r || r.needs_confirm != 1 || !r.data) { cb(0); return; }
			var d = r.data;
			var arrived = (d.is_checked_out == 1)
				? "checked out of " + escapeAttendanceHtml(d.from_class_name) + " today at " + d.check_out_time
				: "checked in to " + escapeAttendanceHtml(d.from_class_name) + " today at " + d.check_in_time;
			var msg = "<strong>" + escapeAttendanceHtml(d.child_name) + "</strong> was " + arrived + "."
				+ "<br><br>Move today's attendance record to <strong>" + escapeAttendanceHtml(d.to_class_name) + "</strong> as well?"
				+ "<br><br><em>Move today too</em> &mdash; today's check-in (and its meal counts) move to "
				+ escapeAttendanceHtml(d.to_class_name) + ", and the child shows on that tablet right away."
				+ "<br><em>Leave today as is</em> &mdash; today stays on " + escapeAttendanceHtml(d.from_class_name)
				+ "; the child appears on the " + escapeAttendanceHtml(d.to_class_name) + " tablet tomorrow.";
			jCustomConfirm(msg, "Already checked in today", "warning", function (yes) {
				cb(yes ? 1 : 0);
			}, "Move today too", "Leave today as is");
		},
		error: function () { cb(0); }
	});
}

function escapeAttendanceHtml(s) {
	return jqView("<div>").text(s == null ? "" : s).html();
}