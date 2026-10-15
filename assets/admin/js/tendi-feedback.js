/* ==========================================================================
   Tendi Feedback widget
   Composer drawer + PII-safe repro-kit buffer + resilient (idempotent) submit.
   Self-scopes to #tndFeedbackBtn: a complete no-op when that button is absent
   (e.g. the demo, or logged-out shells). Vanilla JS; no jQuery dependency.
   See docs/FEEDBACK-PLAN.md.
   ========================================================================== */
(function () {
	'use strict';

	// ---- endpoints (built from the globals head.php already defines) --------
	var ADMIN = (window.SITE_ADMIN_DIR_NAME || 'admin');
	var BASE  = (window.SITE_URL || '/').replace(/\/+$/, '');
	function url(p) { return BASE + '/' + ADMIN + '/' + p; }
	var SUBMIT_URL = url('feedback/submit');
	var CATS_URL   = url('feedback/categories');
	var SNAPDOM_URL = BASE + '/tendi-families-demo/assets/' + ADMIN + '/plugins/snapdom/snapdom.min.js';

	// ---- limits (mirror the server; the server re-validates) ---------------
	var MAX_FILES = 10;
	var MAX_BYTES = 25 * 1024 * 1024;
	var BLOCKED = ['exe','bat','cmd','com','msi','scr','pif','cpl','lnk','reg','ps1','psm1','sh','bash','zsh','vbs','vbe','wsf','wsh','hta','js','mjs','jse','jar','dll','sys','drv','app','apk','deb','rpm','dmg','pkg','php','php3','php4','php5','php7','phtml','phar','py','pyc','pl','rb','asp','aspx','jsp','cgi','htaccess','htpasswd'];

	// ---- resilient queue bounds -------------------------------------------
	var QUEUE_KEY = 'tndFeedbackQueue';
	var QUEUE_MAX = 5;
	var QUEUE_TTL_MS = 24 * 60 * 60 * 1000;

	/* ======================================================================
	   PII-safe repro-kit buffer: installed immediately, before any UI.
	   Captures recent console errors, FAILED requests (URL path + status +
	   timing ONLY, never bodies, query strings stripped) and click breadcrumbs.
	   ====================================================================== */
	var MAX_ERR = 15, MAX_NET = 15, MAX_CRUMB = 25;
	var repro = { errors: [], network: [], breadcrumbs: [] };

	function stripUrl(u) { try { u = String(u); var i = u.search(/[?#]/); return i >= 0 ? u.slice(0, i) : u; } catch (e) { return ''; } }
	function ts() { try { return new Date().toISOString(); } catch (e) { return ''; } }
	function perfNow() { try { return (window.performance && performance.now) ? performance.now() : (+new Date()); } catch (e) { return +new Date(); } }
	function cap(arr, item, max) { arr.push(item); while (arr.length > max) { arr.shift(); } }
	function small(x) {
		try {
			if (x instanceof Error) { return (x.name + ': ' + x.message); }
			if (typeof x === 'object') { return JSON.stringify(x).slice(0, 300); }
			return String(x);
		} catch (e) { return ''; }
	}

	try {
		var origErr = window.console && console.error;
		if (origErr) {
			console.error = function () {
				try { cap(repro.errors, { t: ts(), msg: Array.prototype.map.call(arguments, small).join(' ').slice(0, 500) }, MAX_ERR); } catch (e) {}
				return origErr.apply(console, arguments);
			};
		}
	} catch (e) {}

	window.addEventListener('error', function (ev) {
		try { cap(repro.errors, { t: ts(), msg: String((ev && ev.message) || '').slice(0, 500), at: stripUrl(ev && ev.filename) + ':' + ((ev && ev.lineno) || 0) }, MAX_ERR); } catch (e) {}
	});
	window.addEventListener('unhandledrejection', function (ev) {
		try { cap(repro.errors, { t: ts(), msg: 'unhandledrejection: ' + small(ev && ev.reason).slice(0, 500) }, MAX_ERR); } catch (e) {}
	});

	// fetch wrapper: transparent; observes failures / non-2xx only.
	try {
		if (window.fetch) {
			var origFetch = window.fetch;
			window.fetch = function (input, init) {
				var u = stripUrl((input && input.url) ? input.url : input);
				var m = (init && init.method) ? init.method : 'GET';
				var t0 = perfNow();
				return origFetch.apply(this, arguments).then(function (res) {
					try { if (res && !res.ok) { cap(repro.network, { t: ts(), method: m, url: u, status: res.status, ms: Math.round(perfNow() - t0) }, MAX_NET); } } catch (e) {}
					return res;
				}, function (err) {
					try { cap(repro.network, { t: ts(), method: m, url: u, status: 0, error: small(err).slice(0, 160), ms: Math.round(perfNow() - t0) }, MAX_NET); } catch (e) {}
					throw err;
				});
			};
		}
	} catch (e) {}

	// XHR wrapper: transparent; observes failures / 4xx-5xx only.
	try {
		var XO = window.XMLHttpRequest && XMLHttpRequest.prototype.open;
		var XS = window.XMLHttpRequest && XMLHttpRequest.prototype.send;
		if (XO && XS) {
			XMLHttpRequest.prototype.open = function (method, u) {
				try { this.__fb = { method: method, url: stripUrl(u), t0: perfNow() }; } catch (e) {}
				return XO.apply(this, arguments);
			};
			XMLHttpRequest.prototype.send = function () {
				var self = this;
				try {
					self.addEventListener('loadend', function () {
						try { if (self.__fb && (self.status === 0 || self.status >= 400)) { cap(repro.network, { t: ts(), method: self.__fb.method, url: self.__fb.url, status: self.status, ms: Math.round(perfNow() - self.__fb.t0) }, MAX_NET); } } catch (e) {}
					});
				} catch (e) {}
				return XS.apply(this, arguments);
			};
		}
	} catch (e) {}

	document.addEventListener('click', function (ev) {
		try {
			var el = ev.target && ev.target.closest ? ev.target.closest('a,button,[role=button]') : null;
			if (!el) { return; }
			if (el.id === 'tndFeedbackBtn' || (el.closest && el.closest('#tndFbOverlay'))) { return; } // don't log the widget itself
			var label = (el.getAttribute('title') || el.textContent || el.getAttribute('aria-label') || el.tagName || '').trim().replace(/\s+/g, ' ').slice(0, 60);
			if (label) { cap(repro.breadcrumbs, { t: ts(), a: 'click', label: label }, MAX_CRUMB); }
		} catch (e) {}
	}, true);

	function snapshotRepro() {
		return { errors: repro.errors.slice(), network: repro.network.slice(), breadcrumbs: repro.breadcrumbs.slice(), captured_at: ts(), page: stripUrl(location.href) };
	}

	/* ======================================================================
	   Small utilities
	   ====================================================================== */
	function uuid() {
		try { if (window.crypto && crypto.randomUUID) { return crypto.randomUUID(); } } catch (e) {}
		return 'fb-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 10);
	}
	function extOf(name) { var p = String(name || '').toLowerCase().split('.'); return p.length > 1 ? p.pop() : ''; }
	function isBlocked(name) { var e = extOf(name); return e === '' || BLOCKED.indexOf(e) >= 0; }
	function sizeStr(b) { b = +b || 0; if (b >= 1048576) { return (b / 1048576).toFixed(1) + ' MB'; } if (b >= 1024) { return Math.round(b / 1024) + ' KB'; } return b + ' B'; }
	function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
	function el(id) { return document.getElementById(id); }

	/* ======================================================================
	   Resilient queue (text-only; files can't be persisted to localStorage)
	   ====================================================================== */
	function qRead() { try { var v = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
	function qWrite(a) { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(a.slice(-QUEUE_MAX))); } catch (e) {} }
	function qAdd(payload) {
		var a = qRead().filter(function (it) { return (Date.now() - (it.ts || 0)) < QUEUE_TTL_MS; });
		a.push({ ts: Date.now(), payload: payload });
		qWrite(a);
	}
	function qFlush() {
		var a = qRead().filter(function (it) { return (Date.now() - (it.ts || 0)) < QUEUE_TTL_MS; });
		if (!a.length) { qWrite(a); return; }
		var next = a.shift();
		var fd = new FormData();
		var p = next.payload || {};
		Object.keys(p).forEach(function (k) { fd.append(k, p[k]); });
		fetch(SUBMIT_URL, { method: 'POST', body: fd, credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
			.then(function (r) { return r.json().catch(function () { return {}; }); })
			.then(function (j) {
				if (j && j.success) { qWrite(a); if (a.length) { qFlush(); } }   // delivered → drop it, continue
				else if (j && j.retry) { /* keep for next load */ }
				else { qWrite(a); }                                              // permanent reject → drop (don't loop forever)
			})
			.catch(function () { /* still offline, leave the queue intact */ });
	}

	/* ======================================================================
	   UI
	   ====================================================================== */
	var built = false, els = {}, files = [], catsLoaded = false, submitting = false, submitToken = null, selectedCategory = null, ddDocBound = false;

	function buildDrawer(email) {
		if (built) { return; }
		built = true;
		var wrap = document.createElement('div');
		wrap.className = 'tnd-fb-overlay';
		wrap.id = 'tndFbOverlay';
		wrap.innerHTML =
			'<div class="tnd-fb-drawer" role="dialog" aria-modal="true" aria-label="Send feedback">' +
				'<div class="tnd-fb-head">' +
					'<div class="tnd-fb-icon"><i class="fa-regular fa-comment-dots"></i></div>' +
					'<div><h3>Send feedback</h3><p class="tnd-fb-sub">Bug, idea, or question. We read every one.</p></div>' +
					'<button type="button" class="tnd-fb-close" id="tndFbClose" aria-label="Close">&times;</button>' +
				'</div>' +
				'<div class="tnd-fb-body" id="tndFbBody">' +
					'<div class="tnd-fb-field" id="tndFbMsgField">' +
						'<label class="tnd-fb-label" for="tndFbMessage">Your message</label>' +
						'<textarea class="tnd-fb-textarea" id="tndFbMessage" placeholder="What happened, or what would help?"></textarea>' +
					'</div>' +
					'<div class="tnd-fb-field" id="tndFbCatField">' +
						'<label class="tnd-fb-label">Category <span class="tnd-fb-req">*</span></label>' +
						'<div class="tnd-fb-dd" id="tndFbDd">' +
							'<button type="button" class="tnd-fb-dd-btn" id="tndFbDdBtn" aria-haspopup="listbox" aria-expanded="false">' +
								'<span class="tnd-fb-dd-val is-placeholder" id="tndFbDdVal">Loading…</span>' +
								'<i class="fa-solid fa-chevron-down tnd-fb-dd-caret" aria-hidden="true"></i>' +
							'</button>' +
							'<div class="tnd-fb-dd-panel" id="tndFbDdPanel" role="listbox" hidden></div>' +
						'</div>' +
					'</div>' +
					'<div class="tnd-fb-field">' +
						'<label class="tnd-fb-label">Attachments</label>' +
						'<label class="tnd-fb-drop" id="tndFbDrop"><b>Click to attach</b> or drop files here. You can also paste a screenshot.' +
							'<input type="file" id="tndFbFileInput" multiple></label>' +
						'<button type="button" class="tnd-fb-ghost tnd-fb-capbtn" id="tndFbCapture"><i class="fa-solid fa-camera"></i> Capture this page</button>' +
						'<div class="tnd-fb-capstatus" id="tndFbCapStatus"></div>' +
						'<ul class="tnd-fb-files" id="tndFbFiles"></ul>' +
					'</div>' +
				'</div>' +
				'<div class="tnd-fb-foot">' +
					'<div class="tnd-fb-sending" id="tndFbSending"></div>' +
					'<div class="tnd-fb-foot-row"><button type="button" class="tnd-fb-submit" id="tndFbSubmit">Send feedback</button></div>' +
					'<div class="tnd-fb-status" id="tndFbStatus"></div>' +
				'</div>' +
			'</div>';
		document.body.appendChild(wrap);

		els.overlay = wrap;
		els.body = el('tndFbBody');
		els.message = el('tndFbMessage');
		els.catField = el('tndFbCatField');
		els.msgField = el('tndFbMsgField');
		els.dd = el('tndFbDd');
		els.ddBtn = el('tndFbDdBtn');
		els.ddVal = el('tndFbDdVal');
		els.ddPanel = el('tndFbDdPanel');
		els.drop = el('tndFbDrop');
		els.fileInput = el('tndFbFileInput');
		els.fileList = el('tndFbFiles');
		els.capStatus = el('tndFbCapStatus');
		els.sending = el('tndFbSending');
		els.submit = el('tndFbSubmit');
		els.status = el('tndFbStatus');

		els.sending.innerHTML = 'Sending as <b>' + esc(email || 'you') + '</b>';

		// close
		el('tndFbClose').addEventListener('click', closeDrawer);
		wrap.addEventListener('click', function (ev) { if (ev.target === wrap) { closeDrawer(); } });
		document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && wrap.classList.contains('is-open')) { closeDrawer(); } });

		// files
		els.fileInput.addEventListener('change', function () { addFiles(this.files); this.value = ''; });
		['dragenter', 'dragover'].forEach(function (e) { els.drop.addEventListener(e, function (ev) { ev.preventDefault(); els.drop.classList.add('is-drag'); }); });
		['dragleave', 'drop'].forEach(function (e) { els.drop.addEventListener(e, function (ev) { ev.preventDefault(); els.drop.classList.remove('is-drag'); }); });
		els.drop.addEventListener('drop', function (ev) { if (ev.dataTransfer && ev.dataTransfer.files) { addFiles(ev.dataTransfer.files); } });
		// paste a screenshot anywhere in the drawer
		wrap.addEventListener('paste', function (ev) {
			try {
				var items = (ev.clipboardData && ev.clipboardData.items) || [];
				var picked = [];
				for (var i = 0; i < items.length; i++) { if (items[i].kind === 'file') { var f = items[i].getAsFile(); if (f) { picked.push(f); } } }
				if (picked.length) { addFiles(picked); }
			} catch (e) {}
		});

		els.submit.addEventListener('click', doSubmit);
		var capBtn = el('tndFbCapture');
		if (capBtn) { capBtn.addEventListener('click', captureScreen); }

		// category custom dropdown
		els.ddBtn.addEventListener('click', function (ev) { ev.stopPropagation(); toggleDd(); });
		if (!ddDocBound) {
			document.addEventListener('click', function (ev) { if (els.dd && !els.dd.contains(ev.target)) { closeDd(); } });
			ddDocBound = true;
		}
	}

	function loadCategories() {
		if (catsLoaded) { return; }
		fetch(CATS_URL, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
			.then(function (r) { return r.json(); })
			.then(function (j) {
				var cats = (j && j.categories) ? j.categories : [];
				els.ddPanel.innerHTML = '';
				setDdVal(cats.length ? 'Select a category…' : 'No categories available', true);
				cats.forEach(function (c) {
					var o = document.createElement('button');
					o.type = 'button'; o.className = 'tnd-fb-dd-opt'; o.setAttribute('role', 'option');
					o.textContent = c.name;
					o.addEventListener('click', function () { chooseCategory(c.id, c.name); });
					els.ddPanel.appendChild(o);
				});
				catsLoaded = true;
			})
			.catch(function () { setDdVal('Categories unavailable', true); });
	}

	function setDdVal(text, placeholder) {
		els.ddVal.textContent = text;
		els.ddVal.className = 'tnd-fb-dd-val' + (placeholder ? ' is-placeholder' : '');
	}
	function openDd() { if (els.ddPanel && els.ddPanel.hidden) { els.ddPanel.hidden = false; els.dd.classList.add('is-open'); els.ddBtn.setAttribute('aria-expanded', 'true'); } }
	function closeDd() { if (els.ddPanel && !els.ddPanel.hidden) { els.ddPanel.hidden = true; els.dd.classList.remove('is-open'); els.ddBtn.setAttribute('aria-expanded', 'false'); } }
	function toggleDd() { if (els.ddPanel.hidden) { openDd(); } else { closeDd(); } }
	function chooseCategory(id, name) {
		selectedCategory = { id: id, name: name };
		setDdVal(name, false);
		closeDd();
		els.catField.classList.remove('is-invalid');
	}

	// View an attached file large, in-browser: image/video in a lightbox, anything
	// else opens in a new tab (the browser shows what it can, downloads the rest).
	function openLightbox(file) {
		var type = file.type || '';
		var u = URL.createObjectURL(file);
		if (/^image\//.test(type)) { showLightbox('<img alt="" src="' + u + '">', u); }
		else if (/^video\//.test(type)) { showLightbox('<video src="' + u + '" controls autoplay playsinline></video>', u); }
		else { window.open(u, '_blank', 'noopener'); setTimeout(function () { URL.revokeObjectURL(u); }, 60000); }
	}
	function showLightbox(inner, u) {
		var lb = document.createElement('div');
		lb.className = 'tnd-fb-lightbox';
		lb.innerHTML = '<button type="button" class="tnd-fb-lb-close" aria-label="Close">&times;</button><div class="tnd-fb-lb-stage">' + inner + '</div>';
		document.body.appendChild(lb);
		function close() { if (lb.parentNode) { lb.parentNode.removeChild(lb); } if (u) { URL.revokeObjectURL(u); } document.removeEventListener('keydown', onKey); }
		function onKey(e) { if (e.key === 'Escape') { close(); } }
		lb.addEventListener('click', function (e) { if (e.target === lb || (e.target.closest && e.target.closest('.tnd-fb-lb-close'))) { close(); } });
		document.addEventListener('keydown', onKey);
	}

	function addFiles(list) {
		var arr = Array.prototype.slice.call(list || []);
		for (var i = 0; i < arr.length; i++) {
			var f = arr[i];
			if (files.length >= MAX_FILES) { setStatus('You can attach up to ' + MAX_FILES + ' files.', 'error'); break; }
			if (isBlocked(f.name)) { setStatus('"' + f.name + '" is not an allowed file type.', 'error'); continue; }
			if (f.size > MAX_BYTES) { setStatus('"' + f.name + '" is too large (max 25 MB).', 'error'); continue; }
			files.push(f);
		}
		renderFiles();
	}

	function renderFiles() {
		els.fileList.innerHTML = '';
		files.forEach(function (f, idx) {
			var li = document.createElement('li');
			li.className = 'tnd-fb-chip is-clickable';
			li.title = 'Click to view';
			var isImg = /^image\//.test(f.type);
			li.innerHTML =
				'<span class="tnd-fb-chip-thumb">' + (isImg ? '' : '<i class="fa-regular fa-file"></i>') + '</span>' +
				'<span class="tnd-fb-chip-meta"><span class="tnd-fb-chip-name">' + esc(f.name) + '</span>' +
				'<span class="tnd-fb-chip-size">' + sizeStr(f.size) + '</span></span>' +
				'<button type="button" class="tnd-fb-chip-x" aria-label="Remove" data-i="' + idx + '">&times;</button>';
			els.fileList.appendChild(li);
			if (isImg) {
				(function (thumb) {
					var rd = new FileReader();
					rd.onload = function () { thumb.innerHTML = '<img alt="" src="' + rd.result + '">'; };
					rd.readAsDataURL(f);
				})(li.querySelector('.tnd-fb-chip-thumb'));
			}
			li.addEventListener('click', function (ev) {
				if (ev.target.closest && ev.target.closest('.tnd-fb-chip-x')) { return; }
				openLightbox(f);
			});
			li.querySelector('.tnd-fb-chip-x').addEventListener('click', function (ev) {
				ev.stopPropagation();
				files.splice(+this.getAttribute('data-i'), 1); renderFiles();
			});
		});
	}

	function setStatus(msg, kind) {
		els.status.textContent = msg || '';
		els.status.className = 'tnd-fb-status' + (kind ? ' is-' + kind : '');
	}
	function setCapStatus(msg, isErr) {
		if (!els.capStatus) { return; }
		els.capStatus.textContent = msg || '';
		els.capStatus.className = 'tnd-fb-capstatus' + (isErr ? ' is-error' : '');
	}

	function openDrawer() {
		var btn = el('tndFeedbackBtn');
		buildDrawer(btn ? btn.getAttribute('data-email') : '');
		loadCategories();
		els.overlay.classList.add('is-open');
		setTimeout(function () { els.message && els.message.focus(); }, 60);
	}
	function closeDrawer() { if (els.overlay) { els.overlay.classList.remove('is-open'); } }

	function resetForm() {
		files = []; submitToken = null; selectedCategory = null;
		if (els.body && els.message) {
			els.message.value = '';
			renderFiles(); setStatus('');
		}
	}

	function doSubmit() {
		if (submitting) { return; }
		els.catField.classList.remove('is-invalid');
		els.msgField.classList.remove('is-invalid');

		var message = (els.message.value || '').trim();

		// Category is required.
		if (!selectedCategory || !selectedCategory.id) {
			els.catField.classList.add('is-invalid');
			openDd();
			setStatus('Please choose a category.', 'error');
			return;
		}
		// Need a message or at least one attachment.
		if (message === '' && files.length === 0) {
			els.msgField.classList.add('is-invalid');
			setStatus('Please add a message or an attachment.', 'error');
			els.message.focus();
			return;
		}

		submitting = true;
		els.submit.disabled = true;
		els.submit.textContent = 'Sending…';
		setStatus('');

		if (!submitToken) { submitToken = uuid(); }   // stable across retries of THIS submission

		var viewport = (window.innerWidth || 0) + 'x' + (window.innerHeight || 0);
		var pageUrl = stripUrl(location.href);
		var hasFiles = files.length > 0;
		var queuePayload = { message: message, category_id: selectedCategory.id, client_token: submitToken, page_url: pageUrl, viewport: viewport };

		var fd = new FormData();
		fd.append('message', message);
		fd.append('category_id', selectedCategory.id);
		fd.append('client_token', submitToken);
		fd.append('page_url', pageUrl);
		fd.append('viewport', viewport);
		try { fd.append('diagnostics', JSON.stringify(snapshotRepro())); } catch (e) {}
		files.forEach(function (f) { fd.append('files[]', f, f.name); });

		fetch(SUBMIT_URL, { method: 'POST', body: fd, credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
			.then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }).catch(function () { return { ok: r.ok, status: r.status, j: {} }; }); })
			.then(function (res) {
				var j = res.j || {};
				if (j.success) { showDone(j.ref); return; }
				if (j.retry && !hasFiles) { qAdd(queuePayload); showQueued(); return; }   // registry down + text-only → queue it
				if (res.status === 401) { setStatus('Your session expired, please reload the page and sign in.', 'error'); }
				else if (j.field === 'category') { els.catField.classList.add('is-invalid'); setStatus(j.message || 'Please choose a category.', 'error'); }
				else { setStatus(j.message || 'Could not send. Please try again.', 'error'); }
				unlockSubmit();
			})
			.catch(function () {
				if (!hasFiles) { qAdd(queuePayload); showQueued(); }
				else { setStatus('You\'re offline and this has attachments, please try again when you\'re back online.', 'error'); unlockSubmit(); }
			});
	}

	function unlockSubmit() { submitting = false; els.submit.disabled = false; els.submit.textContent = 'Send feedback'; }

	function showDone(ref) {
		els.body.innerHTML =
			'<div class="tnd-fb-done">' +
				'<div class="tnd-fb-done-ring"><i class="fa-solid fa-check"></i></div>' +
				'<h3>Thanks. We got it.</h3>' +
				'<p>Logged as <span class="tnd-fb-ref">' + esc(ref || 'received') + '</span>.</p>' +
				'<p>The team reviews every report.</p>' +
				'<button type="button" class="tnd-fb-ghost" id="tndFbAnother"><i class="fa-regular fa-comment-dots"></i> Send another</button>' +
			'</div>';
		els.sending.textContent = ''; els.submit.style.display = 'none'; setStatus('');
		submitting = false;
		var again = el('tndFbAnother');
		if (again) { again.addEventListener('click', function () { rebuildForm(); }); }
	}

	function showQueued() {
		els.body.innerHTML =
			'<div class="tnd-fb-done">' +
				'<div class="tnd-fb-done-ring" style="background:#eeebff;color:#6d5df6;"><i class="fa-solid fa-cloud-arrow-up"></i></div>' +
				'<h3>Saved: we\'ll send it shortly.</h3>' +
				'<p>You appear to be offline. Your feedback is stored on this device and will be sent automatically.</p>' +
				'<button type="button" class="tnd-fb-ghost" id="tndFbAnother"><i class="fa-regular fa-comment-dots"></i> Done</button>' +
			'</div>';
		els.sending.textContent = ''; els.submit.style.display = 'none'; setStatus('');
		submitting = false;
		var again = el('tndFbAnother');
		if (again) { again.addEventListener('click', function () { closeDrawer(); setTimeout(rebuildForm, 250); }); }
	}

	// Rebuild the form markup after a confirmation screen (re-bind everything).
	function rebuildForm() {
		built = false;
		if (els.overlay && els.overlay.parentNode) { els.overlay.parentNode.removeChild(els.overlay); }
		els = {}; files = []; catsLoaded = false; submitting = false; submitToken = null; selectedCategory = null;
		openDrawer();
	}

	/* ======================================================================
	   Screenshot capture + redaction
	   Uses snapdom (lazy-loaded): renders the DOM extremely fast and supports the
	   modern CSS the reskin relies on (color-mix(), custom props, web fonts).
	   Chosen after html2canvas (throws on color-mix()) and modern-screenshot
	   (timed out >25s on heavy pages like the children list) both failed: snapdom
	   does that same page in well under a second.
	   ====================================================================== */
	var snapLoading = false, snapQueue = [];
	function flushSnap(ok) { var q = snapQueue.slice(); snapQueue = []; q.forEach(function (f) { try { f(ok); } catch (e) {} }); }
	function snapReady() { return !!(window.snapdom && window.snapdom.toCanvas); }
	function ensureSnap(cb) {
		if (snapReady()) { cb(true); return; }
		snapQueue.push(cb);
		if (snapLoading) { return; }
		snapLoading = true;
		var s = document.createElement('script');
		s.src = SNAPDOM_URL; s.async = true;
		s.onload = function () { snapLoading = false; flushSnap(snapReady()); };
		s.onerror = function () { snapLoading = false; flushSnap(false); };
		document.head.appendChild(s);
	}

	function blobToFile(blob, name) {
		try { return new File([blob], name, { type: blob.type || 'image/png' }); }
		catch (e) { try { blob.name = name; } catch (e2) {} return blob; }
	}
	function dataURLtoBlob(d) {
		var parts = d.split(','), mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/png';
		var bin = atob(parts[1]), n = bin.length, u8 = new Uint8Array(n);
		while (n--) { u8[n] = bin.charCodeAt(n); }
		return new Blob([u8], { type: mime });
	}

	function captureScreen() {
		if (submitting) { return; }
		var btn = el('tndFbCapture');
		if (btn && btn.disabled) { return; }
		if (btn) { btn.disabled = true; }     // disable while capturing
		setCapStatus('Preparing screenshot…');
		ensureSnap(function (ok) {
			var release = function () { if (btn) { btn.disabled = false; } };   // re-enable when done/errored
			if (!ok) { setCapStatus('Screenshot tool could not load.', true); release(); return; }
			var fail = function (err) {
				try { console.error('[feedback] capture failed:', err); } catch (e) {}
				setCapStatus('Could not capture this page, please attach a file instead.', true);
				release();
			};
			try {
				var p = window.snapdom.toCanvas(document.body, {
					backgroundColor: '#ffffff',
					exclude: ['#tndFbOverlay', '#tndFbRedactor'],   // never capture the widget itself
					// skip iframes/canvases: the Google-Maps embed renders cross-origin and
					// would otherwise blank/taint; everything else captures normally.
					filter: function (node) {
						try { if (node && node.tagName) { var t = node.tagName; if (t === 'IFRAME' || t === 'CANVAS') { return false; } } } catch (e) {}
						return true;
					}
				});
				// Safety net so a stuck render can never strand the user on "Preparing…".
				var timeout = new Promise(function (_, rej) { setTimeout(function () { rej(new Error('capture timed out')); }, 30000); });
				Promise.race([p, timeout]).then(function (canvas) {
					setCapStatus(''); release(); openRedactor(canvas);
				}).catch(fail);
			} catch (err) { fail(err); }
		});
	}

	function openRedactor(src) {
		var maxW = Math.min(window.innerWidth - 48, 1100);
		var maxH = window.innerHeight - 170;
		var scale = Math.min(maxW / src.width, maxH / src.height, 1);
		if (!(scale > 0)) { scale = 1; }
		var dispW = Math.max(1, Math.round(src.width * scale));
		var dispH = Math.max(1, Math.round(src.height * scale));

		var ov = document.createElement('div');
		ov.className = 'tnd-fb-redactor'; ov.id = 'tndFbRedactor';
		ov.innerHTML =
			'<div class="tnd-fb-red-panel">' +
				'<div class="tnd-fb-red-head"><i class="fa-solid fa-highlighter"></i> Drag over anything private to hide it ' +
					'<span class="tnd-fb-red-hint">(black boxes are baked into the image)</span>' +
					'<span class="tnd-fb-red-grow"></span>' +
					'<button type="button" class="tnd-fb-ghost" id="tndFbRedUndo"><i class="fa-solid fa-rotate-left"></i> Undo</button>' +
					'<button type="button" class="tnd-fb-ghost" id="tndFbRedClear">Clear</button>' +
				'</div>' +
				'<div class="tnd-fb-red-stage"><canvas id="tndFbRedCanvas" width="' + dispW + '" height="' + dispH + '"></canvas></div>' +
				'<div class="tnd-fb-red-foot">' +
					'<button type="button" class="tnd-fb-ghost" id="tndFbRedCancel">Cancel</button>' +
					'<button type="button" class="tnd-fb-submit" id="tndFbRedAttach" style="flex:0 0 auto;">Attach screenshot</button>' +
				'</div>' +
			'</div>';
		document.body.appendChild(ov);

		var cv = el('tndFbRedCanvas');
		var ctx = cv.getContext('2d');
		var rects = [], drawing = false, start = null, cur = null;

		function redraw() {
			ctx.clearRect(0, 0, dispW, dispH);
			ctx.drawImage(src, 0, 0, dispW, dispH);
			ctx.fillStyle = '#000';
			rects.forEach(function (r) { ctx.fillRect(r.x, r.y, r.w, r.h); });
			if (drawing && start && cur) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(start.x, start.y, cur.x - start.x, cur.y - start.y); }
		}
		function pos(ev) {
			var b = cv.getBoundingClientRect();
			var p = (ev.touches && ev.touches[0]) || ev;
			return { x: (p.clientX - b.left) * (dispW / b.width), y: (p.clientY - b.top) * (dispH / b.height) };
		}
		function down(ev) { ev.preventDefault(); drawing = true; start = pos(ev); cur = start; }
		function move(ev) { if (!drawing) { return; } cur = pos(ev); redraw(); }
		function up(ev) {
			if (!drawing) { return; }
			drawing = false;
			var e = pos(ev);
			var x = Math.min(start.x, e.x), y = Math.min(start.y, e.y), w = Math.abs(e.x - start.x), h = Math.abs(e.y - start.y);
			if (w > 4 && h > 4) { rects.push({ x: x, y: y, w: w, h: h }); }
			start = null; cur = null; redraw();
		}

		cv.addEventListener('mousedown', down);
		window.addEventListener('mousemove', move);
		window.addEventListener('mouseup', up);
		cv.addEventListener('touchstart', down, { passive: false });
		cv.addEventListener('touchmove', move, { passive: false });
		cv.addEventListener('touchend', up);

		function closeRed() {
			window.removeEventListener('mousemove', move);
			window.removeEventListener('mouseup', up);
			if (ov.parentNode) { ov.parentNode.removeChild(ov); }
		}
		el('tndFbRedUndo').addEventListener('click', function () { rects.pop(); redraw(); });
		el('tndFbRedClear').addEventListener('click', function () { rects = []; redraw(); });
		el('tndFbRedCancel').addEventListener('click', closeRed);
		el('tndFbRedAttach').addEventListener('click', function () {
			var out = document.createElement('canvas'); out.width = src.width; out.height = src.height;
			var octx = out.getContext('2d'); octx.drawImage(src, 0, 0);
			octx.fillStyle = '#000'; var inv = 1 / scale;
			rects.forEach(function (r) { octx.fillRect(r.x * inv, r.y * inv, r.w * inv, r.h * inv); });
			var done = function (blob) {
				if (blob) { addFiles([blobToFile(blob, 'screenshot-' + Date.now() + '.png')]); }
				closeRed();
			};
			if (out.toBlob) { out.toBlob(done, 'image/png'); }
			else { try { done(dataURLtoBlob(out.toDataURL('image/png'))); } catch (e) { closeRed(); } }
		});
		redraw();
	}

	/* ======================================================================
	   Boot
	   ====================================================================== */
	function init() {
		var btn = el('tndFeedbackBtn');
		if (!btn) { return; }                       // no button (demo / logged-out) → fully inert
		btn.addEventListener('click', function (ev) { ev.preventDefault(); openDrawer(); });
		// Flush any queued (offline) submissions from a previous visit.
		setTimeout(qFlush, 1500);
		window.addEventListener('online', function () { setTimeout(qFlush, 800); });
	}

	if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
	else { init(); }
})();
/* End of file tendi-feedback.js */
