/**
 * TendiSmsCost — shared SMS segment/cost meter (docs/SMS-COST-ESTIMATOR-PLAN.md).
 *
 * Twilio bills per SEGMENT, not per message: GSM-7 messages hold 160 chars
 * (153 each when split, extended chars ^{}\[]~|€ count double); ONE character
 * outside GSM-7 (emoji, Hebrew, unconverted symbols) flips the whole message
 * to UCS-2 where a segment holds 70 chars (67 when split, emoji = 2).
 * Surfaces marked smart:true send via the Messaging Service, where Twilio
 * Smart Encoding (ON for this account) converts fancy punctuation to plain
 * GSM before billing — those price the CONVERTED text.
 *
 * ZERO DEPENDENCIES — deliberately jQuery-free: this file attaches on both the
 * admin shell (has jQuery) and the platform console (vanilla page, no jQuery).
 * Composers are AJAX fragments / server pages that (re)render at any time, so
 * nothing binds to specific nodes up front: a MutationObserver attaches meters
 * to registered selectors as they appear; input/click handling is delegated.
 * The PHP mirror of the segment math is sms_cost_helper.php — keep in sync
 * (shared test vectors: reskin-qa/sms-segment-vectors.json).
 */
(function () {
	'use strict';
	if (window.TendiSmsCost) return;

	// ---------- segment math ----------
	var GSM_BASIC = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
	var GSM_EXT = "^{}\\[]~|€";
	var basicSet = {}, extSet = {};
	GSM_BASIC.split('').forEach(function (c) { basicSet[c] = 1; });
	GSM_EXT.split('').forEach(function (c) { extSet[c] = 1; });

	var CHAR_NAMES = {
		'’': 'curly apostrophe', '‘': 'curly quote', '“': 'curly double-quote',
		'”': 'curly double-quote', '—': 'em-dash', '–': 'en-dash',
		'•': 'bullet', '…': 'ellipsis', ' ': 'invisible space'
	};
	// Plain-text substitutes mirroring Twilio's Smart Encoding table
	// (twilio.com/docs/messaging/services/smart-encoding-char-list). This map is
	// what BOTH the "Use plain characters" fix and the smart-mode pricing use, so
	// the meter converts exactly what Twilio converts — anything NOT in the table
	// (emoji, Hebrew, …) genuinely stays expensive and is flagged as such.
	var REPLACEMENTS = {
		'’': "'", '‘': "'", 'ʻ': "'", 'ʼ': "'", 'ʽ': "'", 'ʹ': "'", '‛': "'", '´': "'", 'ˊ': "'", '`': "'", 'ˋ': "'", '❛': "'", '❜': "'", 'ˈ': "'",
		'“': '"', '”': '"', '«': '"', '»': '"', '„': '"', '‟': '"', '❝': '"', '❞': '"', '〝': '"', '〞': '"', 'ʺ': '"', 'ˮ': '"',
		'—': '-', '–': '-', '―': '-', '‐': '-', '•': '-', '⁃': '-', '‗': '_',
		'…': '...', ' ': ' ', '‚': ',', '、': ',',
		'‹': '<', '›': '>', '÷': '/', '⁄': '/', '∕': '/',
		'¼': '1/4', '½': '1/2', '¾': '3/4', '‼': '!!'
	};
	// Also smart-converted by Twilio: invisible/odd whitespace (removed) and
	// fullwidth ASCII (mapped to plain). Ranges, so handled by regex not map.
	var INVISIBLES = /[\u2000-\u200B\u202F\u205F\u3000\uFEFF\u2028\u2029\u2060]/g;
	var FULLWIDTH = /[\uFF01-\uFF5E]/g;
	function isConvertible(ch) {
		if (REPLACEMENTS[ch] !== undefined) return true;
		INVISIBLES.lastIndex = 0; FULLWIDTH.lastIndex = 0;
		return INVISIBLES.test(ch) || FULLWIDTH.test(ch);
	}

	function segCount(text) {
		var septets = 0, utf16 = 0, gsm = true, offenders = {}, ext = {}, fixable = true;
		for (var i = 0; i < text.length; i++) {
			var code = text.charCodeAt(i), ch = text.charAt(i);
			if (code >= 0xD800 && code <= 0xDBFF) { // surrogate pair (emoji etc.)
				utf16 += 2; i++;
				gsm = false; fixable = false;
				var pair = ch + text.charAt(i);
				offenders[pair] = (offenders[pair] || 0) + 1;
				continue;
			}
			utf16 += 1;
			if (basicSet[ch]) { septets += 1; }
			else if (extSet[ch]) { septets += 2; ext[ch] = (ext[ch] || 0) + 1; }
			else {
				gsm = false;
				offenders[ch] = (offenders[ch] || 0) + 1;
				if (!isConvertible(ch)) fixable = false;
			}
		}
		var segments;
		if (text.length === 0) segments = 0;
		else if (gsm) segments = septets <= 160 ? 1 : Math.ceil(septets / 153);
		else segments = utf16 <= 70 ? 1 : Math.ceil(utf16 / 67);
		return { segments: segments, gsm: gsm, utf16: utf16, septets: septets, offenders: offenders, ext: ext, fixableOnly: fixable };
	}

	function renderTokens(text, tokens, which) { // which: 'min'|'typ'|'max'
		if (!tokens) return { text: text, unbounded: false };
		var unbounded = false;
		if (tokens.blocks) {
			// [[ … ]] optional blocks (parent-SMS template syntax): the markers never
			// reach the phone; for the minimum the whole block may disappear.
			text = which === 'min'
				? text.replace(/\[\[[\s\S]*?\]\]/g, '')
				: text.replace(/\[\[|\]\]/g, '');
		}
		var out = text.replace(tokens.pattern, function (m, name) {
			var t = tokens.map[name];
			if (!t) return m; // unknown token stays literal (matches server behavior)
			if (t.unbounded) { unbounded = true; }
			var len = t.unbounded ? (which === 'min' ? 10 : which === 'max' ? 200 : 40) : t[which];
			return new Array(len + 1).join('x');
		});
		return { text: out, unbounded: unbounded };
	}

	function analyze(text, tokens, smart) {
		var smartApplied = false;
		if (smart) {
			// Surface sends via a Messaging Service with Smart Encoding ON: price
			// the converted text. Emoji/Hebrew are never converted.
			var converted = applyFix(text);
			smartApplied = converted !== text;
			text = converted;
		}
		var typR = renderTokens(text, tokens, 'typ');
		var typ = segCount(typR.text);
		var res = {
			chars: typR.text.length, gsm: typ.gsm, segments: typ.segments,
			segMin: typ.segments, segMax: typ.segments,
			offenders: typ.offenders, ext: typ.ext, fixableOnly: typ.fixableOnly,
			unbounded: typR.unbounded, empty: text.length === 0, smartApplied: smartApplied
		};
		if (tokens && tokens.pattern.test(text)) {
			res.segMin = segCount(renderTokens(text, tokens, 'min').text).segments;
			res.segMax = segCount(renderTokens(text, tokens, 'max').text).segments;
		}
		return res;
	}

	function applyFix(text) {
		var out = '';
		for (var i = 0; i < text.length; i++) {
			var ch = text.charAt(i);
			if (REPLACEMENTS[ch] !== undefined) { out += REPLACEMENTS[ch]; continue; }
			INVISIBLES.lastIndex = 0; FULLWIDTH.lastIndex = 0;
			if (INVISIBLES.test(ch)) { continue; }
			if (FULLWIDTH.test(ch)) { out += String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); continue; }
			out += ch;
		}
		return out;
	}

	// ---------- pricing (cached server-side; see Dashboard::sms_pricing) ----------
	var pricing = { base: 0.0083, carrier: 0.0041, checked: '', loaded: false };
	function rate() { return pricing.base + pricing.carrier; }
	// Twilio-style precision (owner, 2026-08-20): sub-dollar amounts show the real
	// fraction ($0.0124), never a rounded penny — the 1¢-vs-1.45¢ difference is the
	// whole point of the meter. Bigger totals round like an invoice.
	function money(v) {
		if (v >= 100) return '$' + Math.round(v);
		if (v >= 1) return '$' + v.toFixed(2);
		return '$' + v.toFixed(4).replace(/(\.\d\d[1-9]?)0+$/, '$1');
	}
	function fetchPricing() {
		try {
			// Pages outside the admin shell (e.g. the platform console) set their own
			// endpoint via window.TENDI_SMS_PRICING_URL before this script loads.
			fetch(window.TENDI_SMS_PRICING_URL || 'dashboard/sms_pricing', { credentials: 'same-origin' })
				.then(function (r) { return r.json(); })
				.then(function (d) {
					if (d && d.base > 0) {
						pricing.base = parseFloat(d.base);
						pricing.carrier = parseFloat(d.carrier) || 0;
						pricing.checked = d.checked_at || '';
						pricing.loaded = true;
						allMeters().forEach(refreshMeter);
					}
				})
				.catch(function () { /* keep built-in fallback */ });
		} catch (e) { /* fetch unavailable — fallback stands */ }
	}

	// ---------- surface registry ----------
	function braces(map) { return { pattern: /\{([a-z_]+)\}/g, map: map }; }
	function dblBraces(map) { return { pattern: /\{\{([a-z_]+)\}\}/g, map: map }; }
	var L = function (min, typ, max) { return { min: min, typ: typ, max: max }; };
	var UNB = { unbounded: true };
	var NAMEISH = { fname: L(3, 6, 12), lname: L(4, 7, 14), branch_name: L(8, 15, 30) };
	function merge() {
		var o = {};
		for (var i = 0; i < arguments.length; i++) {
			var a = arguments[i];
			for (var k in a) if (Object.prototype.hasOwnProperty.call(a, k)) o[k] = a[k];
		}
		return o;
	}

	// smart:true = sends via the Messaging Service (Smart Encoding ON — verified
	// 2026-08-20): every notifications_queue surface. The parent-SMS prompts
	// editor sends from a plain long code (no service) — no smart flag there.
	var SURFACES = [
		{ sel: '#sms_body', tokens: null, smart: true },                       // Notice / mass messages
		{ sel: '#scSmsBody', smart: true, tokens: braces(merge(NAMEISH, {      // Send Confirmation
			periods_list: UNB, enrollment_counselor_name: L(6, 12, 22),
			enrollment_counselor_phone: L(12, 12, 14), enrollment_counselor_email: L(15, 22, 35) })) },
		{ sel: '#cmSmsBody', smart: true, tokens: braces(merge(NAMEISH, {      // Compliance Messages
			branch_email: L(15, 22, 35), missing_items: UNB, immunization_contact_name: L(6, 12, 22),
			immunization_contact_phone: L(12, 12, 14), immunization_contact_email: L(15, 22, 35) })) },
		{ sel: '#ecSmsBody', smart: true, tokens: dblBraces({ fullname: L(8, 13, 25), branch_email: L(15, 22, 35) }) },
		{ sel: '#sms_text_edit', smart: true, tokens: dblBraces({ fullname: L(8, 13, 25), branch_email: L(15, 22, 35), vaccine_form_info: UNB }) },
		{ sel: '#sms_text_edit_up_to_date', smart: true, tokens: dblBraces({ fullname: L(8, 13, 25), branch_email: L(15, 22, 35) }) },
		{ sel: 'textarea.sms_notification', tokens: null, smart: true },       // ad-hoc child + employee SMS
		// Platform console: registry parent_sms_prompts editor (reskin line only —
		// the selector simply never matches on the legacy frontend). {token} +
		// [[optional block]] syntax. smart:true since 2026-08-20: the engine sends
		// from + messagingServiceSid together (proven billing 1 seg on a curly-quote
		// body), so Smart Encoding applies to every automated reply. Emoji still
		// costs full price — it is never converted.
		{ sel: 'textarea.psms-body', smart: true, tokens: merge(braces({
			child_first_name: L(3, 6, 12), parent_first_name: L(3, 6, 12),
			class_name: L(4, 10, 20), tenant_name: L(5, 12, 25),
			checkin_time: L(7, 8, 8), checkout_time: L(7, 8, 8), nap_started_at: L(7, 8, 8),
			nap_ago: L(5, 12, 20), last_meal_ago: L(5, 12, 20), last_diaper_ago: L(5, 12, 20),
			mood: L(4, 8, 15), bus_route_name: L(5, 12, 25), cap_per_hour: L(1, 2, 2),
			child_list: UNB
		}), { blocks: true }) }
	];
	var ALL_SURFACE_SEL = SURFACES.map(function (s) { return s.sel; }).join(',');

	// Send buttons that get the cost confirm. recipients() may return 0 = unknown.
	// #btnCmConfirmSend is NOT here: the compliance confirm overlay gets an inline
	// cost line instead (confirmLineHtml) — a second popup there would be noise.
	var SEND_BUTTONS = [
		{ sel: '.btnSendNotice', src: '#sms_body' },
		{ sel: '#btnScSend', src: '#scSmsBody' },
		{ sel: '#btnEcEmail', src: '#ecSmsBody' },
		{ sel: '.btn-send-edited-notification', src: '#sms_text_edit',
			recipients: function (btn) { return parseInt(btn.getAttribute('data-total-phones'), 10) || 0; } },
		{ sel: '.btn-send-edited-notification-up-to-date', src: '#sms_text_edit_up_to_date',
			recipients: function (btn) { return parseInt(btn.getAttribute('data-total-phones'), 10) || 0; } },
		{ sel: '.send_specific_child_notification_btn', src: 'textarea.sms_notification' },
		{ sel: '.send_specific_employee_notification_btn', src: 'textarea.sms_notification' }
	];

	var WARN_SEGMENTS = 4;   // per-message segments that trigger the confirm
	var WARN_TOTAL = 10;     // estimated total $ that triggers the confirm

	// ---------- styles ----------
	var CSS =
		'.tsc-meter{margin-top:4px;font-size:11.5px;line-height:1.5;color:#6b7280;}' +
		'.tsc-meter b{font-weight:600;}' +
		'.tsc-meter.tsc-warn .tsc-main{color:#b45309;}' +
		'.tsc-meter.tsc-bad .tsc-main{color:#b91c1c;font-weight:600;}' +
		'.tsc-offenders{color:#b45309;}' +
		'.tsc-offenders .tsc-ch,.tsc-meter .tsc-ch{background:#fef3c7;border-radius:3px;padding:0 3px;margin-right:2px;font-family:monospace;}' +
		'.tsc-fix{display:inline-block;margin-left:6px;padding:0 7px;border:1px solid #d1d5db;border-radius:4px;background:#f9fafb;color:#374151;cursor:pointer;font-size:11px;line-height:18px;}' +
		'.tsc-fix:hover{background:#eef2ff;border-color:#6366f1;color:#3730a3;}' +
		'.tsc-overlay{position:fixed;inset:0;background:rgba(17,24,39,.55);z-index:20000;display:flex;align-items:center;justify-content:center;padding:16px;}' +
		'.tsc-box{background:#fff;border-radius:8px;max-width:430px;width:100%;padding:18px 20px;box-shadow:0 12px 40px rgba(0,0,0,.25);font-size:13px;color:#111827;}' +
		'.tsc-box h5{margin:0 0 10px;font-size:15px;color:#b45309;}' +
		'.tsc-box table{width:100%;border-collapse:collapse;margin:8px 0 12px;}' +
		'.tsc-box th,.tsc-box td{text-align:left;padding:3px 6px;border-bottom:1px solid #f3f4f6;font-size:12.5px;}' +
		'.tsc-box th{color:#6b7280;font-weight:500;white-space:nowrap;}' +
		'.tsc-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;}' +
		'.tsc-actions .btn,.tsc-actions button{min-height:34px;padding:6px 14px;border-radius:6px;border:1px solid #d1d5db;background:#fff;cursor:pointer;}' +
		'.tsc-actions .tsc-send{background:#dc2626;border-color:#dc2626;color:#fff;}' +
		'.tsc-note{font-size:11px;color:#6b7280;margin-top:8px;}' +
		'.tsc-preview-cost{font-weight:600;color:#3730a3;}';

	// ---------- helpers ----------
	function surfaceFor(el) {
		for (var i = 0; i < SURFACES.length; i++) {
			if (el.matches && el.matches(SURFACES[i].sel)) return SURFACES[i];
		}
		return null;
	}

	function escH(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

	function allMeters() {
		return Array.prototype.slice.call(document.querySelectorAll('.tsc-meter'));
	}

	function offendersHtml(offenders, max) {
		var keys = Object.keys(offenders);
		keys.sort(function (a, b) { return offenders[b] - offenders[a]; });
		var parts = [];
		for (var i = 0; i < keys.length && i < (max || 4); i++) {
			var c = keys[i], code = c.codePointAt(0);
			var name = CHAR_NAMES[c] || (code >= 0x0590 && code <= 0x05FF ? 'Hebrew' : 'emoji/symbol');
			parts.push('<span class="tsc-ch">' + (c === ' ' ? '·' : escH(c)) + '</span>' + name + ' ×' + offenders[c]);
		}
		if (keys.length > (max || 4)) parts.push('+' + (keys.length - (max || 4)) + ' more');
		return parts.join(', ');
	}

	// ---------- meter ----------
	function meterHtml(a) {
		if (a.empty) return '<span class="tsc-main">SMS cost meter — start typing to see segments & price</span>';
		var segTxt = a.segMin === a.segMax ? a.segments + (a.segments === 1 ? ' segment' : ' segments')
			: a.segMin + '–' + a.segMax + ' segments';
		var enc = a.gsm ? 'plain alphabet (160/segment)' : '<b>emoji/special characters (70/segment)</b>';
		var per = a.segMin === a.segMax ? money(a.segments * rate())
			: money(a.segMin * rate()) + '–' + money(a.segMax * rate());
		var html = '<span class="tsc-main">' + a.chars + ' chars · ' + enc + ' · <b>' + segTxt + '</b> · ≈' + per + '/recipient</span>';
		if (!a.gsm) {
			html += '<br><span class="tsc-offenders">Price-doubling characters: ' + offendersHtml(a.offenders) + '</span>';
			if (a.fixableOnly) html += '<span class="tsc-fix" role="button">Use plain characters</span>';
			if (a.smartApplied) html += '<br><span>✓ Fancy punctuation is auto-converted to plain by Twilio Smart Encoding; the characters above are the ones it cannot convert.</span>';
		} else if (a.smartApplied) {
			html += '<br><span>✓ Fancy punctuation (curly quotes, dashes…) is auto-converted to plain by Twilio Smart Encoding — priced as plain.<span class="tsc-fix" role="button">Use plain characters</span></span>';
		} else if (a.ext) {
			// Third tier: these stay in the cheap alphabet but each one bills as TWO
			// characters (GSM extended table) — worth knowing near the 160 boundary.
			var extKeys = Object.keys(a.ext);
			if (extKeys.length) {
				var extParts = [];
				for (var i = 0; i < extKeys.length && i < 5; i++) extParts.push('<span class="tsc-ch">' + escH(extKeys[i]) + '</span>×' + a.ext[extKeys[i]]);
				html += '<br><span>These count as 2 characters each: ' + extParts.join(', ') + '</span>';
			}
		}
		if (a.unbounded) html += '<br><span>⚠ contains a list variable — length varies per child; use Preview for exact totals</span>';
		return html;
	}

	function refreshMeter(meterEl) {
		var ta = meterEl.__tscSrc;
		if (!ta || !document.documentElement.contains(ta)) {
			if (meterEl.parentNode) meterEl.parentNode.removeChild(meterEl);
			return;
		}
		var surface = surfaceFor(ta);
		var a = analyze(ta.value || '', surface && surface.tokens, surface && surface.smart);
		meterEl.innerHTML = meterHtml(a);
		meterEl.classList.toggle('tsc-warn', !a.empty && a.segments >= 2 && a.segments < WARN_SEGMENTS);
		meterEl.classList.toggle('tsc-bad', !a.empty && (a.segments >= WARN_SEGMENTS || (!a.gsm && a.fixableOnly)));
	}

	function meterOf(ta) {
		var sib = ta.nextElementSibling;
		while (sib) {
			if (sib.classList && sib.classList.contains('tsc-meter')) return sib;
			sib = sib.nextElementSibling;
		}
		return null;
	}

	function ensureMeters() {
		var nodes = document.querySelectorAll(ALL_SURFACE_SEL);
		for (var i = 0; i < nodes.length; i++) {
			var ta = nodes[i];
			if (ta.__tscMetered) continue;
			ta.__tscMetered = true;
			var m = document.createElement('div');
			m.className = 'tsc-meter';
			m.__tscSrc = ta;
			ta.insertAdjacentElement('afterend', m);
			refreshMeter(m);
		}
	}

	// ---------- cost confirm on send ----------
	function findSendConf(el) {
		if (!el || !el.closest) return null;
		for (var i = 0; i < SEND_BUTTONS.length; i++) {
			var hit = el.closest(SEND_BUTTONS[i].sel);
			if (hit) return { conf: SEND_BUTTONS[i], btn: hit };
		}
		return null;
	}

	function showConfirm(a, recipients, onSend) {
		var perSeg = a.segMin === a.segMax ? String(a.segments) : a.segMin + '–' + a.segMax;
		var rows =
			'<tr><th>Message size</th><td>' + perSeg + ' billed segments' + (a.gsm ? '' : ' (special-character encoding)') + '</td></tr>' +
			'<tr><th>Cost per recipient</th><td>≈' + money(a.segments * rate()) + '</td></tr>';
		if (recipients > 0) rows += '<tr><th>Recipients</th><td>' + recipients + '</td></tr>' +
			'<tr><th>Estimated total</th><td><b>≈' + money(a.segments * rate() * recipients) + '</b></td></tr>';
		if (!a.gsm) rows += '<tr><th>Expensive chars</th><td>' + offendersHtml(a.offenders, 3) + '</td></tr>';
		var ov = document.createElement('div');
		ov.className = 'tsc-overlay';
		ov.innerHTML =
			'<div class="tsc-box">' +
				'<h5>⚠ This is an expensive SMS</h5>' +
				'<table>' + rows + '</table>' +
				'<div class="tsc-actions">' +
					'<button type="button" class="btn btn-default tsc-cancel">Go back &amp; edit</button>' +
					'<button type="button" class="btn btn-danger tsc-send">Send anyway</button>' +
				'</div>' +
				'<div class="tsc-note">Rate ' + money(rate()) + '/segment incl. carrier fees' + (pricing.checked ? ' · checked ' + escH(pricing.checked) : '') + '. Estimate — list variables and per-child data can change the exact count.</div>' +
			'</div>';
		document.body.appendChild(ov);
		ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
		ov.querySelector('.tsc-cancel').addEventListener('click', function () { ov.remove(); });
		ov.querySelector('.tsc-send').addEventListener('click', function () { ov.remove(); onSend(); });
	}

	document.addEventListener('click', function (e) {
		var hit = findSendConf(e.target);
		if (!hit) return;
		var btn = hit.btn;
		if (btn.getAttribute('data-tsc-ok') === '1') { btn.removeAttribute('data-tsc-ok'); return; }
		// resolve the source textarea nearest to the button (ad-hoc composers repeat per-row)
		var scope = btn.closest('.modal, .row, form') || document;
		var src = scope.querySelector(hit.conf.src) || document.querySelector(hit.conf.src);
		if (!src) return;
		var text = src.value || '';
		if (!text.trim()) return; // no SMS content — nothing to warn about
		var surface = surfaceFor(src);
		var a = analyze(text, surface && surface.tokens, surface && surface.smart);
		var recipients = hit.conf.recipients ? hit.conf.recipients(btn) : 0;
		var total = recipients > 0 ? a.segments * rate() * recipients : 0;
		var expensive = a.segments >= WARN_SEGMENTS || total >= WARN_TOTAL || (!a.gsm && !a.smartApplied && a.fixableOnly && a.segments >= 2);
		if (!expensive) return;
		e.preventDefault();
		e.stopImmediatePropagation();
		showConfirm(a, recipients, function () {
			btn.setAttribute('data-tsc-ok', '1');
			btn.click();
		});
	}, true);

	// ---------- hooks for view integrations ----------
	/** Exact totals line for preview summaries (per-child rendered bodies). */
	function previewSummaryHtml(children) {
		var segs = 0, n = 0;
		for (var i = 0; i < (children || []).length; i++) {
			var b = children[i] && children[i].sms_body;
			if (!b || !String(b).trim()) continue;
			// Preview bodies go out via the Messaging Service → Smart Encoding applies
			segs += segCount(applyFix(String(b))).segments; n++;
		}
		if (!n) return '';
		return ' · <span class="tsc-preview-cost">SMS cost: ' + segs + ' segments ≈ ' + money(segs * rate()) + '</span>';
	}

	/** Segment/cost line for an already-RENDERED body (live previews, sample data).
	 *  Prices the smart-converted text — every current sender (queue AND the
	 *  parent-SMS engine since 2026-08-20) rides the Messaging Service. */
	function inlineInfoHtml(text) {
		text = String(text || '');
		if (!text.trim()) return '';
		var r = segCount(applyFix(text));
		return '<span class="tsc-main">' + r.segments + (r.segments === 1 ? ' segment' : ' segments') +
			' · ' + (r.gsm ? 'plain alphabet' : '<b>emoji/special characters (70/segment)</b>') +
			' · ≈' + money(r.segments * rate()) + '/msg</span>' +
			(r.gsm ? '' : '<br><span class="tsc-offenders">Price-doubling characters: ' + offendersHtml(r.offenders) + '</span>');
	}

	/** One-line cost estimate for a template textarea × recipient count (compliance confirm overlay). */
	function confirmLineHtml(srcSel, recipients) {
		var src = document.querySelector(srcSel);
		if (!src) return '';
		var text = src.value || '';
		if (!text.trim() || !recipients) return '';
		var surface = surfaceFor(src);
		var a = analyze(text, surface && surface.tokens, surface && surface.smart);
		return '<div class="tsc-note" style="font-size:12.5px;color:#3730a3;font-weight:600;">' +
			'Estimated SMS cost: ' + a.segments + ' segment' + (a.segments === 1 ? '' : 's') + ' × ' + recipients +
			' recipients ≈ ' + money(a.segments * rate() * recipients) +
			' <span style="font-weight:400;color:#6b7280;">(' + money(rate()) + '/segment incl. carrier fees)</span></div>';
	}

	// ---------- boot ----------
	function boot() {
		var style = document.createElement('style');
		style.textContent = CSS;
		document.head.appendChild(style);

		document.addEventListener('input', function (e) {
			var t = e.target;
			if (!t || !t.matches || !t.matches(ALL_SURFACE_SEL)) return;
			var m = meterOf(t);
			if (m) refreshMeter(m);
		});
		document.addEventListener('click', function (e) {
			var chip = e.target && e.target.closest ? e.target.closest('.tsc-fix') : null;
			if (!chip) return;
			var meter = chip.closest('.tsc-meter');
			var ta = meter && meter.__tscSrc;
			if (ta) {
				ta.value = applyFix(ta.value || '');
				ta.dispatchEvent(new Event('input', { bubbles: true }));
				ta.focus();
			}
		});

		var pending = null;
		new MutationObserver(function () {
			if (pending) return;
			pending = setTimeout(function () { pending = null; ensureMeters(); }, 120);
		}).observe(document.body, { childList: true, subtree: true });

		ensureMeters();
		fetchPricing();
	}

	window.TendiSmsCost = {
		analyze: analyze, segCount: segCount, applyFix: applyFix,
		previewSummaryHtml: previewSummaryHtml, confirmLineHtml: confirmLineHtml,
		inlineInfoHtml: inlineInfoHtml, pricing: pricing, rate: rate
	};

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
	else boot();
})();
