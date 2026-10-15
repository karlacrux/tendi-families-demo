/*
 * Tendi ready guard.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Every AJAX page fragment in this app initialises itself with
 *
 *     jqView = jQuery.noConflict();
 *     jqView(document).ready(function () { ... build this page ... });
 *
 * and jQuery 2.1.0 runs that callback through ONE shared readyList Deferred. Its
 * jQuery.Callbacks firing loop has no try/finally: when a callback throws, the
 * list's internal "firing" flag stays set for good. Every callback added after
 * that, by every LATER page in the tab, is appended to a queue that nothing will
 * ever drain again. The queue is wedged for the rest of the session.
 *
 * What the user sees is the bug this file fixes: navigate to any list page after
 * one page's init has thrown, and the fragment's HTML paints (header, toolbar,
 * empty table) while its script never runs. No DataTables init, so no request is
 * ever sent, no spinner, no error, no "No data available" row. Just a permanently
 * empty page, on all or many pages, until the tab is reloaded. Measured on local:
 * one throw on Children, and the next three pages visited sent ZERO requests.
 *
 * THE FIX
 * -------
 * Contain each ready callback so a failing page fails alone. The document is
 * already ready for every SPA fragment, which is the case that matters, and jQuery
 * fires those synchronously straight off the resolved Deferred. So call the
 * callback directly instead, wrapped, and the throw never reaches the Callbacks
 * firing loop at all. Before the document is ready the callback still goes through
 * jQuery, wrapped, so the initial page load cannot wedge the queue either.
 *
 * Errors are reported to the console rather than swallowed: a broken page must stay
 * visibly broken, it just may no longer break every page that follows it.
 *
 * Loaded synchronously, immediately after jquery-2.1.0.min.js in
 * application/views/admin/common/inc/head.php, so the patch is in place before any
 * other script registers a ready callback.
 */
(function (jq) {
	'use strict';

	if (!jq || !jq.fn || typeof jq.fn.ready !== 'function' || jq.fn.ready.__tndGuarded) { return; }

	var origReady = jq.fn.ready;

	function contain(fn) {
		return function () {
			try {
				return fn.apply(this, arguments);
			} catch (e) {
				// Kept loud on purpose. This used to take down every subsequent page silently.
				if (window.console && console.error) {
					console.error('[ready-guard] a page init threw; contained so later pages still load', e);
				}
				// Re-throw on a fresh task so window.onerror still receives the original error with
				// its file, line and stack. The feedback widget's repro kit listens there, and a
				// console.error alone reaches it as a bare "name: message". The timeout is what makes
				// this safe: the throw lands outside jQuery's Callbacks firing loop, so it cannot
				// wedge the ready queue, which is the whole point of this file.
				setTimeout(function () { throw e; }, 0);
			}
		};
	}

	jq.fn.ready = function (fn) {
		if (typeof fn !== 'function') { return origReady.apply(this, arguments); }

		if (jq.isReady) {
			// jQuery would fire this synchronously off the resolved readyList, with the
			// document as `this` and jQuery as the argument. Same call, minus the shared
			// queue that a throw would poison.
			contain(fn).call(document, jq);
			return this;
		}

		return origReady.call(this, contain(fn));
	};

	jq.fn.ready.__tndGuarded = true;
	jq.fn.ready.__tndOrig = origReady;
})(window.jQuery);
