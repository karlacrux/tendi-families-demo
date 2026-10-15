//
//    Main script of DevOOPS v1.0 Bootstrap Theme
//
// "use strict";
/*-------------------------------------------
	Dynamically load plugin scripts
---------------------------------------------*/
//
// Dynamically load Fullcalendar Plugin Script
// homepage: http://arshaw.com/fullcalendar
// require moment.js
//

var jqDevoops=jQuery.noConflict();
var isPageLoading=false;
// Page part (no ?params) of the fragment currently in (or entering) #ajax-content.
// The hashchange handler uses it to tell a self-inflicted hash sync from a real
// back/forward navigation.
var currentAjaxPage='';
// Navigation generation. Two clicks in quick succession used to leave two fragment
// requests in flight with nothing deciding between them, so whichever response came back
// LAST won #ajax-content. Click a slow page and then a fast one and the slow one landed
// on top of it: the address bar named the page you asked for while the screen still
// showed the previous one, and the page you clicked never appeared. Measured on local,
// Children then Employees 100ms apart: 3 of 6 attempts ended on Children with the hash
// reading "employee". Every navigation now takes the next number and only the current
// number may write to the page.
var ajaxNavSeq=0;
// The fragment request currently in flight, so a new navigation can abort the one it
// supersedes instead of racing it.
var ajaxNavXHR=null;
// Poll handle for a record deep link (#children/edit/688) waiting for its list page to
// render. Module-level so a second deep link cancels the first one's poll: two running at
// once and the loser opens its pane over the winner's.
var tndDeepLinkPoll=null;

/*-------------------------------------------
	Main scripts used by theme
---------------------------------------------*/
//
//  Normalize a LoadAjaxContent url to its hash form: strip an absolute
//  SITE_URL/admin/ prefix (some views pass base_url()-built urls) so the hash
//  stays relative and reload/back resolve it against the shell.
//
function AdminAjaxPageKey(url){
	var u = String(url || '');
	try {
		var adminBase = String(SITE_URL).replace(/\/+$/, '') + '/' + SITE_ADMIN_DIR_NAME + '/';
		if (u.indexOf(adminBase) === 0) { u = u.slice(adminBase.length); }
	} catch(e) {}
	return u.replace(/^\/+/, '');
}

//
//  Function for load content from url and put in jqDevoops('.ajax-content') block
//
function LoadAjaxContent(url){
	jqDevoops(window).trigger('pageContentWillLoad');
	isPageLoading=true;
	var mySeq = ++ajaxNavSeq;
	// Drop the request this navigation replaces. abort() fires the error handler below with
	// textStatus 'abort', which that handler ignores on purpose.
	if (ajaxNavXHR) { try { ajaxNavXHR.abort(); } catch(e) {} ajaxNavXHR = null; }
	// Keep the ADDRESS BAR in sync with the content. Most in-page navigations (save ->
	// back to list, post-create edit, audit deep links) call LoadAjaxContent() without
	// touching location.hash, so reload/back/bookmark landed on whatever page the hash
	// last happened to name. Sync it here — but only when the PAGE part differs: pages
	// that keep their own state in hash params (#caps_registry?view=data) must not have
	// those params clobbered by a same-page refresh.
	var target = AdminAjaxPageKey(url);
	currentAjaxPage = target.split('?')[0];
	try {
		if (location.hash.replace(/^#/, '').split('?')[0] !== currentAjaxPage) {
			location.hash = target; // hashchange fires -> suppressed (self-inflicted)
		}
	} catch(e) {}
	// Open every AJAX-loaded page at the TOP. The old line scrolled #main (overflow:hidden — not the
	// real scroll container); the WINDOW is what scrolls (the left nav is taller than the viewport),
	// so pages inherited the previous scroll position and appeared to "open at the bottom". Reset the
	// window here, and again after the new content + its select2/datatables init (in success below).
	try { window.scrollTo(0, 0); } catch(e) {}
	jqDevoops('#main').animate({scrollTop: 0}, 250);
	jqDevoops('.preloader').show();
	setTimeout(function(){
		// Superseded during the 10ms delay, before this one ever reached the network.
		if (mySeq !== ajaxNavSeq) { return; }
		ajaxNavXHR = jqDevoops.ajax({
		mimeType: 'text/html; charset=utf-8', // ! Need set mimeType only when run from local file
		url: url,
		type: 'GET',
		dataType: "html",
		async: true,
		cache: false,
		success: function(data) {
			// A newer navigation has already started. This response belongs to a page the
			// user has moved on from, so it must not paint over the one they asked for.
			if (mySeq !== ajaxNavSeq) { return; }
			// A FULL document coming back for a fragment request means the session expired
			// and the redirect chain ended on the login page — injecting that inside the
			// shell leaves a dead half-page. Hard-reload instead: the server sends the user
			// to the real login screen.
			if (/^\s*(<!doctype|<html)/i.test(String(data))) {
				window.location.reload();
				return;
			}
			jqDevoops(window).trigger('pageContentDidLoad');
			// .html() evaluates the fragment's inline <script> SYNCHRONOUSLY (jQuery.globalEval, no
			// try/catch), and jQuery 2.1 runs a $(document).ready() callback synchronously once the
			// document is already ready. So an uncaught error in ANY page's init used to unwind
			// straight out of this handler and skip the .hide() below — the loading veil then sat
			// there forever with the fully-rendered page underneath it, and nothing on screen was
			// clickable (Enrollment Periods with no children did exactly this). Take the veil down
			// in a finally: a page that fails to initialise must still be a page you can see, read
			// and navigate away from. Same rule as the error handler below.
			try {
				jqDevoops('#ajax-content').html(data);
			} catch(e) {
				if (window.console && console.error) console.error('[LoadAjaxContent] page init failed for "' + url + '"', e);
			} finally {
				jqDevoops('.preloader').hide();
				isPageLoading=false;
			}
			// Re-pin the window to the top after the new content and its init run. .html() runs inline
			// scripts, and $(document).ready()/select2/datatables init fire async and can scroll the
			// window, so reset immediately and again on short delays to land at the top.
			var _pinTop = function(){ try { window.scrollTo(0, 0); } catch(e) {} };
			_pinTop(); setTimeout(_pinTop, 0); setTimeout(_pinTop, 200);
		},
		error: function (jqXHR, textStatus, errorThrown) {
			// Aborted by a newer navigation, or otherwise superseded by one. That newer
			// request owns the page and the veil now, so leave both of them alone: showing
			// the "could not be loaded" box here would replace a page that is loading fine.
			if (textStatus === 'abort' || mySeq !== ajaxNavSeq) { return; }
			// Without this, a 404/500/network drop left the spinner up forever and the
			// only way out was retyping the url (the "stuck after reload" bug — a stale
			// hash like the old #live tab tokens 404s right here). Recover in place.
			isPageLoading=false;
			jqDevoops('.preloader').hide();
			var why = (jqXHR && jqXHR.status) ? ('Error ' + jqXHR.status) : 'Connection problem';
			var $err = jqDevoops(
				'<div class="box"><div class="box-content" style="text-align:center;padding:48px 16px;">' +
					'<i class="fa fa-exclamation-triangle" style="font-size:30px;color:#f0ad4e;"></i>' +
					'<h4 style="margin:14px 0 6px;">This page could not be loaded <small>(' + why + ')</small></h4>' +
					'<p style="color:#6b7280;margin-bottom:18px;">The link may be outdated, or the connection dropped.</p>' +
					'<a href="javascript:void(0);" class="btn btn-default ajax-error-retry" style="margin-right:8px;">Try again</a>' +
					'<a href="javascript:void(0);" class="btn btn-primary ajax-error-home">Go to Dashboard</a>' +
				'</div></div>');
			$err.find('.ajax-error-retry').on('click', function(){ LoadAjaxContent(url); });
			$err.find('.ajax-error-home').on('click', function(){ LoadAjaxContent('dashboard'); });
			jqDevoops('#ajax-content').empty().append($err);
		},
		complete: function () {
			// Only the current navigation may clear the handle. A superseded request
			// finishing later must not wipe the pointer to the one that replaced it.
			if (mySeq === ajaxNavSeq) { ajaxNavXHR = null; }
		}
	});
	},10);
}

//
//  A deep link to ONE record (#children/edit/688: bookmarked, shared, mailed, or just
//  reloaded) used to land on the LEGACY full-page form. The side pane is only ever opened
//  by a click (tendi-list.js binds a capture-phase handler on the list's own edit links and
//  on row clicks), so arriving by URL never went through it and you got the old view with
//  none of the tabs and none of the read-only summary. Load the entity's LIST instead, then
//  open that record in the pane, which is exactly what clicking its row does.
//
//  Returns true when it has taken the navigation over, false to let the caller route normally.
//
function TndOpenDeepLinkedRecord(page){
	var m = /^([a-z_]+)\/edit\/(\d+)$/.exec(String(page || ''));
	if (!m) { return false; }
	var listPage = m[1], recordId = m[2], deepHash = page;

	// Only one deep link may be polling at a time.
	if (tndDeepLinkPoll) { clearInterval(tndDeepLinkPoll); tndDeepLinkPoll = null; }

	// Close an open pane FIRST. tendi-list.js wraps LoadAjaxContent for in-place saves, and that
	// wrapper swallows the call entirely (refresh the table, close the pane, return) whenever a
	// drawer is open over a DataTable. Deep-linking from one record straight to another then never
	// navigated: the previous entity's list stayed on screen and the new record opened on top of it.
	try {
		if (window.TndListDrawer && typeof window.TndListDrawer.close === 'function') {
			window.TndListDrawer.close(true);
		}
	} catch(e) {}

	LoadAjaxContent(listPage);
	// The navigation generation this deep link belongs to. LoadAjaxContent takes the next
	// number and aborts the request it supersedes; if the user navigates again while we wait
	// for the list to render, that navigation owns the page and this pane must not open over
	// it. Read AFTER the call so we hold our own number, not the previous page's.
	var mySeq = ajaxNavSeq, tries = 0;
	// TndListDrawer is published by tendi-list.js, which is deferred and may not have run when
	// a cold deep link gets here. So the drawer is required at OPEN time, not at match time:
	// waiting for it costs a few ticks, testing for it up front would silently fall through to
	// the legacy page on exactly the cold-load case this fixes.
	tndDeepLinkPoll = setInterval(function(){
		if (mySeq !== ajaxNavSeq) {                       // superseded: the newer page owns the screen
			clearInterval(tndDeepLinkPoll); tndDeepLinkPoll = null;
			return;
		}
		var drawer = window.TndListDrawer;
		// currentAjaxPage must name THIS entity's list, not merely "some list". A generic list from
		// the page we arrived from satisfies the DOM check on its own, and the record then opens
		// over the wrong entity's table.
		if (currentAjaxPage === listPage && document.querySelector('.tendi-skin.tnd-list-generic') && drawer && typeof drawer.openRecord === 'function') {
			clearInterval(tndDeepLinkPoll); tndDeepLinkPoll = null;
			drawer.openRecord(listPage + '/edit/' + recordId, { id: recordId });
			// LoadAjaxContent synced the address bar to the LIST page, so a reload would drop the
			// record and leave you on the bare list. Put the deep link back. replaceState does not
			// fire hashchange, so this cannot re-enter the router; currentAjaxPage deliberately
			// still names the list, which is the fragment actually in #ajax-content.
			try { history.replaceState(null, '', '#' + deepHash); } catch(e) {}
			return;
		}
		// The list finished loading and still has no generic-list root, so this entity has no
		// pane to open (admin_users is the only one left) and waiting cannot change that. Hand
		// the navigation straight back to the legacy full-page form: sitting out the ceiling
		// below would stall that link for ten seconds to reach the same place.
		if (currentAjaxPage === listPage && !isPageLoading && !document.querySelector('.tendi-skin.tnd-list-generic')) {
			clearInterval(tndDeepLinkPoll); tndDeepLinkPoll = null;
			LoadAjaxContent(page);
			return;
		}
		// Backstop: a list that never loads at all (404, dropped connection) must not spin under
		// the veil forever either.
		if (++tries > 40) {
			clearInterval(tndDeepLinkPoll); tndDeepLinkPoll = null;
			LoadAjaxContent(page);
		}
	}, 250);
	return true;
}

function loadAjaxContentByHash() {
	var hash = location.hash.replace(/^#/, '');
	if (hash.length <= 0) {
		hash = 'dashboard';
	}
	// Strip query-string style params from hash (used for in-page state like caps_registry?view=data&...)
	var page = hash.split('?')[0];
	SyncMenuActiveState(page);
	if (TndOpenDeepLinkedRecord(page)) { return; }
	LoadAjaxContent(page);
}

//
//  On reload / deep link / back-forward the sidebar had no highlight (only the menu
//  click handler managed the classes). Mirror the restored page into the menu: exact
//  href match first, else first-segment match (children_manage/5 -> children).
//
function SyncMenuActiveState(page){
	try {
		var seg = String(page || '').split('/')[0];
		var $links = jqDevoops('.main-menu a.ajax-menu-link');
		var $match = $links.filter(function(){
			return (jqDevoops(this).attr('href') || '') === page;
		}).first();
		if (!$match.length) {
			$match = $links.filter(function(){
				return ((jqDevoops(this).attr('href') || '').split('/')[0] === seg);
			}).first();
		}
		if (!$match.length) return; // page not in the menu (account, alerts...) — leave as is
		jqDevoops('.main-menu a').removeClass('active').removeClass('active-parent');
		var $ownMenus = $match.parents('ul.dropdown-menu');
		jqDevoops('.main-menu ul.dropdown-menu').not($ownMenus).slideUp('fast');
		$match.addClass('active');
		$ownMenus.slideDown('fast');
		$match.parents('li.dropdown').children('a.dropdown-toggle').addClass('active-parent');
	} catch(e) {}
}

//
//  Beauty tables plugin (navigation in tables with inputs in cell)
//  Created by DevOOPS.
//
(function( $ ){
	jqDevoops.fn.beautyTables = function() {
		var table = this;
		var string_fill = false;
		this.on('keydown', function(event) {
		var target = event.target;
		var tr = jqDevoops(target).closest("tr");
		var col = jqDevoops(target).closest("td");
		if (target.tagName.toUpperCase() == 'INPUT'){
			if (event.shiftKey === true){
				switch(event.keyCode) {
					case 37: // left arrow
						col.prev().children("input[type=text]").focus();
						break;
					case 39: // right arrow
						col.next().children("input[type=text]").focus();
						break;
					case 40: // down arrow
						if (string_fill==false){
							tr.next().find('td:eq('+col.index()+') input[type=text]').focus();
						}
						break;
					case 38: // up arrow
						if (string_fill==false){
							tr.prev().find('td:eq('+col.index()+') input[type=text]').focus();
						}
						break;
				}
			}
			if (event.ctrlKey === true){
				switch(event.keyCode) {
					case 37: // left arrow
						tr.find('td:eq(1)').find("input[type=text]").focus();
						break;
					case 39: // right arrow
						tr.find('td:last-child').find("input[type=text]").focus();
						break;
				case 40: // down arrow
					if (string_fill==false){
						table.find('tr:last-child td:eq('+col.index()+') input[type=text]').focus();
					}
					break;
				case 38: // up arrow
					if (string_fill==false){
						table.find('tr:eq(1) td:eq('+col.index()+') input[type=text]').focus();
					}
						break;
				}
			}
			if (event.keyCode == 13 || event.keyCode == 9 ) {
				event.preventDefault();
				col.next().find("input[type=text]").focus();
			}
			if (string_fill==false){
				if (event.keyCode == 34) {
					event.preventDefault();
					table.find('tr:last-child td:last-child').find("input[type=text]").focus();}
				if (event.keyCode == 33) {
					event.preventDefault();
					table.find('tr:eq(1) td:eq(1)').find("input[type=text]").focus();}
			}
		}
		});
		table.find("input[type=text]").each(function(){
			jqDevoops(this).on('blur', function(event){
			var target = event.target;
			var col = jqDevoops(target).parents("td");
			if(table.find("input[name=string-fill]").prop("checked")==true) {
				col.nextAll().find("input[type=text]").each(function() {
					jqDevoops(this).val(jqDevoops(target).val());
				});
			}
		});
	})
};
})( jQuery );
//
// Beauty Hover Plugin (backlight row and col when cell in mouseover)
//
//
(function( $ ){
	jqDevoops.fn.beautyHover = function() {
		var table = this;
		table.on('mouseover','td', function() {
			var idx = jqDevoops(this).index();
			var rows = jqDevoops(this).closest('table').find('tr');
			rows.each(function(){
				jqDevoops(this).find('td:eq('+idx+')').addClass('beauty-hover');
			});
		})
		.on('mouseleave','td', function(e) {
			var idx = jqDevoops(this).index();
			var rows = jqDevoops(this).closest('table').find('tr');
			rows.each(function(){
				jqDevoops(this).find('td:eq('+idx+')').removeClass('beauty-hover');
			});
		});
	};
})( jQuery );
//
//  Function convert values of inputs in table to JSON data
//
//
function Table2Json(table) {
	var result = {};
	table.find("tr").each(function () {
		var oneRow = [];
		var varname = jqDevoops(this).index();
		jqDevoops("td", this).each(function (index) { if (index != 0) {oneRow.push(jqDevoops("input", this).val());}});
		result[varname] = oneRow;
	});
	var result_json = JSON.stringify(result);
	OpenModalBox('Table to JSON values', result_json);
}
//
//  Dynamically load jQuery Select2 plugin
//  homepage: https://github.com/ivaynberg/select2  v3.4.5  license - GPL2
//
function LoadSelect2Script(callback){
	if (!jqDevoops.fn.select2){
		jqDevoops.getScript('../assets/'+SITE_ADMIN_DIR_NAME+'/plugins/select2/select2.min.js', callback);
	}
	else {
		if (callback && typeof(callback) === "function") {
			callback();
		}
	}
}
//
//  Dynamically load DataTables plugin
//  homepage: http://datatables.net v1.9.4 license - GPL or BSD
//
function LoadDataTablesScripts(callback){
	function LoadDatatables(){
		jqDevoops.getScript('../assets/'+SITE_ADMIN_DIR_NAME+'/plugins/datatables/jquery.dataTables.js', function(){
			jqDevoops.getScript('../assets/'+SITE_ADMIN_DIR_NAME+'/plugins/datatables/ZeroClipboard.js', function(){
				jqDevoops.getScript('../assets/'+SITE_ADMIN_DIR_NAME+'/plugins/datatables/TableTools.js', function(){
					//jqDevoops.getScript('../assets/'+SITE_ADMIN_DIR_NAME+'/plugins/datatables/dataTables.bootstrap.js', callback);
					jqDevoops.getScript('../assets/'+SITE_ADMIN_DIR_NAME+'/plugins/datatables/dataTables.bootstrap.js');
					if (callback && typeof(callback) === "function") {
						callback();
					}
				});
			});
		});
	}
	if (!jqDevoops.fn.dataTables){
		LoadDatatables();
	}
	else {
		if (callback && typeof(callback) === "function") {
			callback();
		}
	}
}
/*-------------------------------------------
	Scripts for DataTables page (tables_datatables.html)
---------------------------------------------*/
//
// Function for dataTable
//
function DataTable(dataTableSelector,dataTableOptionsArgs={},serverSideFilters={}){
	
	var defaultURL=jqDevoops(dataTableSelector).data("default_url");
	var srcGet=jqDevoops(dataTableSelector).data("src_get");
	var allowReorder=jqDevoops(dataTableSelector).data("allow_reorder");
	var srcReorder=jqDevoops(dataTableSelector).data("src_reorder");
	var pageLength=jqDevoops(dataTableSelector).data("length") ?? 50;
	var columnDefs=[];
	jqDevoops(dataTableSelector).find("thead tr th").each(function(i){
		var colsClasses=jqDevoops(this).data("cols_classes");
		if(colsClasses!=null && typeof(colsClasses)!="undefined"){
			columnDefs.push({ className: colsClasses, targets: [i] });
		}
	});
	var dataTableOptions={
		"destroy": true,
		"language": {
			"search": "Search &nbsp;",
			"lengthMenu": '_MENU_',
			"infoEmpty": "No result found.",
			"processing": '<div class="tnd-dt-spinner" role="status" aria-label="Loading"></div>'
		},
		"dom": "<'box-content'<'col-sm-6'f><'col-sm-6 text-right'l><'clearfix'>>rt<'box-content'<'col-sm-5'i><'col-sm-7 text-right no-padding'p><'clearfix'>>",
		"order": [],
		"columnDefs": columnDefs,
		"pagingType":"full_numbers",
	};
	if(allowReorder==false && jqDevoops(window).width() < 768)
	{
		dataTableOptions["responsive"]=true;
	}
	if(srcGet!=null && typeof srcGet !== "undefined" && srcGet!=""){
		dataTableOptions["processing"]=true;
		dataTableOptions["serverSide"]=true;
		dataTableOptions["pageLength"]=pageLength;
		dataTableOptions["lengthMenu"]=[ 50, 100, 200, 500 ];
		if(allowReorder || (dataTableOptionsArgs.paging != undefined && dataTableOptionsArgs.paging==false)) {
			dataTableOptions["ajax"]={
				"url": defaultURL+"/"+srcGet,
				"data": {"filters":serverSideFilters},
				"type":"post"
			};
		}
		else {
			dataTableOptions["ajax"]=jqDevoops.fn.dataTable.pipeline({
				"url": defaultURL+"/"+srcGet,
				"data": {"filters":serverSideFilters},
				"method": "post",
				"pages": 3 // number of pages to cache
			});
		}
	}
	// Tendi reskin: reskinned list pages (.tendi-skin.tnd-list-page) get the flat layout:
	// search in a top toolbar, the table inside its own scroll container (sticky header), and a
	// pinned foot with info/pager/length. Scoped so legacy pages keep the original dom; an explicit
	// dom passed by a page (e.g. the Users side-pane build) still wins via the Object.assign below.
	if(jqDevoops(dataTableSelector).closest(".tendi-skin.tnd-list-page").length){
		dataTableOptions["dom"]="<'tnd-dt-toolbar2'f>r<'tnd-table-scroll't><'tnd-dt-foot'<'tnd-dt-info'i><'tnd-dt-pages'p><'tnd-dt-controls'l>>";
		dataTableOptions["language"]["search"]="_INPUT_";              // drop the "Search" label text
		dataTableOptions["language"]["searchPlaceholder"]="Search…";
		dataTableOptions["language"]["lengthMenu"]="_MENU_";          // just the select (no "Show … entries")
		// a page's legacy oLanguage (e.g. a custom "Search …" label) would otherwise wipe the clean
		// language above and revert the length/placeholder: drop it on reskinned pages.
		delete dataTableOptionsArgs["oLanguage"];
	}
	// Tendi reskin: SCOPE the stateSave key PER ENTITY. DataTables' default state key is
	// `DataTables_<tableId>_<pathname>`, but every reskinned generic list is rendered as a SPA
	// fragment under the SAME pathname (/tendi-families-demo/admin/dashboard#branches, #classes, …) and shares the SAME
	// table id (datatable-1), so ALL lists collided on ONE localStorage key. A search / page-offset /
	// sort left on one list then leaked into the next (e.g. Branches showed "No result found." because
	// another list's search was restored). Key by the entity (data-default_url: "branches", "classes")
	// so each list keeps its OWN state. The col-count guard also drops a stale state from before a
	// column was added/removed (e.g. the new Neighborhood column) instead of mis-restoring it.
	(function(){
		var tndStateKey = 'DataTables_' + (jqDevoops(dataTableSelector).attr('id') || 'dt') + '_' + (defaultURL || location.pathname);
		dataTableOptions["stateSaveCallback"] = function(settings, data){
			try { localStorage.setItem(tndStateKey, JSON.stringify(data)); } catch(e){}
		};
		dataTableOptions["stateLoadCallback"] = function(settings){
			try {
				var s = JSON.parse(localStorage.getItem(tndStateKey));
				if (s && s.columns && settings.aoColumns && s.columns.length !== settings.aoColumns.length) return null;
				return s;
			} catch(e){ return null; }
		};
	})();
	dataTableOptions=Object.assign(dataTableOptions, dataTableOptionsArgs);

	var objDataTable=jqDevoops(dataTableSelector).dataTable(dataTableOptions);
	
	if(allowReorder)
	{
		objDataTable.rowReordering({		
			sURL: defaultURL+"/"+srcReorder,
			sRequestType: "GET"
		});
	}
	
}
//
//  Function maked all .box selector is draggable, to disable for concrete element add class .no-drop
//
function WinMove(){
	jqDevoops( "div.box").not('.no-drop')
		.draggable({
			revert: true,
			zIndex: 2000,
			cursor: "crosshair",
			handle: '.box-name',
			opacity: 0.8
		})
		.droppable({
			tolerance: 'pointer',
			drop: function( event, ui ) {
				var draggable = ui.draggable;
				var droppable = jqDevoops(this);
				var dragPos = draggable.position();
				var dropPos = droppable.position();
				draggable.swap(droppable);
				setTimeout(function() {
					var dropmap = droppable.find('[id^=map-]');
					var dragmap = draggable.find('[id^=map-]');
					if (dragmap.length > 0 || dropmap.length > 0){
						dragmap.resize();
						dropmap.resize();
					}
					else {
						draggable.resize();
						droppable.resize();
					}
				}, 50);
				setTimeout(function() {
					draggable.find('[id^=map-]').resize();
					droppable.find('[id^=map-]').resize();
				}, 250);
			}
		});
}
//
// Swap 2 elements on page. Used by WinMove function
//
jQuery.fn.swap = function(b){
	b = jQuery(b)[0];
	var a = this[0];
	var t = a.parentNode.insertBefore(document.createTextNode(''), a);
	b.parentNode.insertBefore(a, b);
	//t.parentNode.insertBefore(b, t);
	t.parentNode.removeChild(t);
	return this;
};

//
//  Function set min-height of window (required for this theme)
//
function SetMinBlockHeight(elem){
	elem.css('min-height', window.innerHeight - 49)
}
//
//  Helper for correct size of Messages page
//
function MessagesMenuWidth(){
	var W = window.innerWidth;
	var W_menu = jqDevoops('#sidebar-left').outerWidth();
	var w_messages = (W-W_menu)*16.666666666666664/100;
	jqDevoops('#messages-menu').width(w_messages);
}
//
// Helper for run TinyMCE editor with textarea's
//
function TinyMCEStart(elem, mode){
	//jqDevoops(".mce-widget").remove();
	var plugins = [];
	if (mode == 'extreme'){
		plugins = [ "advlist anchor autolink autoresize autosave bbcode charmap code contextmenu directionality ",
			"emoticons fullpage fullscreen hr image insertdatetime layer legacyoutput",
			"link lists media nonbreaking noneditable pagebreak paste preview print save searchreplace",
			"tabfocus table template textcolor visualblocks visualchars wordcount"]
	}
	else{
		plugins = [ "anchor charmap code",
			"emoticons fullscreen hr image insertdatetime",
			"link lists media nonbreaking pagebreak paste preview print save searchreplace",
			"table template textcolor visualblocks visualchars wordcount"]
	}
	tinymce.init({selector: elem,
		forced_root_block : "",
		theme: "modern",
		plugins: plugins,
		//content_css: "css/style.css",
		toolbar: "insertfile undo redo | styleselect | bold italic | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image | print preview media fullpage | forecolor backcolor emoticons",
		style_formats: [
			{title: 'Header 2', block: 'h2', classes: 'page-header'},
			{title: 'Header 3', block: 'h3', classes: 'page-header'},
			{title: 'Header 4', block: 'h4', classes: 'page-header'},
			{title: 'Header 5', block: 'h5', classes: 'page-header'},
			{title: 'Header 6', block: 'h6', classes: 'page-header'},
			{title: 'Bold text', inline: 'b'},
			{title: 'Red text', inline: 'span', styles: {color: '#ff0000'}},
			{title: 'Red header', block: 'h1', styles: {color: '#ff0000'}},
			{title: 'Example 1', inline: 'span', classes: 'example1'},
			{title: 'Example 2', inline: 'span', classes: 'example2'},
			{title: 'Table styles'},
			{title: 'Table row 1', selector: 'tr', classes: 'tablerow1'}
		],
		image_title: true,
		// enable automatic uploads of images represented by blob or data URIs
		automatic_uploads: true,
		// URL of our upload handler (for more details check: https://www.tinymce.com/docs/configure/file-image-upload/#images_upload_url)
		images_upload_url: SITE_URL+'/'+SITE_ADMIN_DIR_NAME+'/dashboard/upload_editor_images',
		// here we add custom filepicker only to Image dialog
		file_picker_types: 'image',
		relative_urls : false,
		remove_script_host : false,
		convert_urls : true,
		// and here's our custom image picker
		file_picker_callback: function(cb, value, meta) {
		  var input = document.createElement('input');
		  input.setAttribute('type', 'file');
		  input.setAttribute('accept', 'image/*');

		  // Note: In modern browsers input[type="file"] is functional without 
		  // even adding it to the DOM, but that might not be the case in some older
		  // or quirky browsers like IE, so you might want to add it to the DOM
		  // just in case, and visually hide it. And do not forget do remove it
		  // once you do not need it anymore.

		  input.onchange = function() {
			var file = this.files[0];

			// Note: Now we need to register the blob in TinyMCEs image blob
			// registry. In the next release this part hopefully won't be
			// necessary, as we are looking to handle it internally.
			var id = 'blobid' + (new Date()).getTime();
			var blobCache = tinymce.activeEditor.editorUpload.blobCache;
			var blobInfo = blobCache.create(id, file);
			blobCache.add(blobInfo);

			// call the callback and populate the Title field with the file name
			cb(blobInfo.blobUri(), { title: file.name });
		  };

		  input.click();
		}
	});
}

//
//  Helper for open ModalBox with requested header, content and bottom
//
//
function OpenModalBox(header, inner, bottom){
	var modalbox = jqDevoops('#modalbox');
	modalbox.find('.modal-header-name span').html(header);
	modalbox.find('.devoops-modal-inner').html(inner);
	modalbox.find('.devoops-modal-bottom').html(bottom);
	modalbox.fadeIn('fast');
	jqDevoops('body').addClass("body-expanded");
}
//
//  Close modalbox
//
//
function CloseModalBox(){
	var modalbox = jqDevoops('#modalbox');
	modalbox.fadeOut('fast', function(){
		modalbox.find('.modal-header-name span').children().remove();
		modalbox.find('.devoops-modal-inner').children().remove();
		modalbox.find('.devoops-modal-bottom').children().remove();
		jqDevoops('body').removeClass("body-expanded");
	});
}

/*-------------------------------------------
	Function for File upload page (form_file_uploader.html)
---------------------------------------------*/
function FileUpload(){
	jqDevoops('#bootstrapped-fine-uploader').fineUploader({
		template: 'qq-template-bootstrap',
		classes: {
			success: 'alert alert-success',
			fail: 'alert alert-error'
		},
		thumbnails: {
			placeholders: {
				waitingPath: "assets/waiting-generic.png",
				notAvailablePath: "assets/not_available-generic.png"
			}
		},
		request: {
			endpoint: 'server/handleUploads'
		},
		validation: {
			allowedExtensions: ['jpeg', 'jpg', 'gif', 'png']
		}
	});
}
/*-------------------------------------------
	Function for OpenStreetMap page (maps.html)
---------------------------------------------*/
//
// Load GeoIP JSON data and draw 3 maps
//
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////
//
//      MAIN DOCUMENT READY SCRIPT OF DEVOOPS THEME
//
//      In this script main logic of theme
//
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////
jqDevoops(document).ready(function () {
	
	jqDevoops('.show-sidebar').on('click', function () {
		jqDevoops('div#main').toggleClass('sidebar-show');
		setTimeout(MessagesMenuWidth, 250);
	});
	
	// Restore a deep-link hash captured on the login page (common/login.php) so a direct URL like
	// .../dashboard#branches lands on that page after sign-in instead of Home (replaceState avoids a double load).
	try {
		var tndPLH = sessionStorage.getItem('tndPostLoginHash');
		if (tndPLH) { sessionStorage.removeItem('tndPostLoginHash'); if (!location.hash || location.hash.length <= 1) { history.replaceState(null, '', '#' + tndPLH); } }
	} catch (e) {}

	// A directly-opened URL / hard reload must never inherit a stale DataTables search or page-offset that
	// hides every record (the "shows no records on a direct #hash" report). On a cold load, reset search +
	// page in any persisted list state; sort/length still persist, and in-session SPA navigation re-saves
	// its own state afterward. The per-entity col-count guard only catches column changes, not this.
	try {
		for (var _ti = 0; _ti < localStorage.length; _ti++) {
			var _tk = localStorage.key(_ti);
			if (_tk && _tk.indexOf('DataTables_') === 0) {
				var _ts = JSON.parse(localStorage.getItem(_tk) || 'null');
				if (_ts && ((_ts.search && _ts.search.search) || _ts.start)) {
					if (_ts.search) { _ts.search.search = ''; }
					_ts.start = 0;
					localStorage.setItem(_tk, JSON.stringify(_ts));
				}
			}
		}
	} catch (e) {}

	loadAjaxContentByHash();

	jqDevoops(window).bind('hashchange',function(){
		// LoadAjaxContent syncs the hash itself, which fires this handler once per
		// navigation — suppress only that self-inflicted event (same page, load in
		// flight). A hashchange to a DIFFERENT page (back/forward, even mid-load)
		// always navigates; the old boolean swallow ate back-presses during a load.
		var page = location.hash.replace(/^#/, '').split('?')[0] || 'dashboard';
		if (isPageLoading && page === currentAjaxPage) {
			return;
		}
		loadAjaxContentByHash();
	});
	
	jqDevoops(document).delegate('.ajax-page-link','click',function(e){
		
		e.preventDefault();
		
		var url = jqDevoops(this).attr('href');
		if(e.ctrlKey || e.shiftKey || e.altKey) {
			var win = window.open(SITE_URL+'/'+SITE_ADMIN_DIR_NAME+'#'+url, '_blank');
			if (win) {
				 win.focus();
			} else {
				 alert('Please allow popups!');
			}
		}
		else {
			window.location.hash = url;
			LoadAjaxContent(url);
			var height = window.innerHeight - 49;
			jqDevoops('#main').css('min-height', height);
		}
	
	});
	
	jqDevoops('.main-menu').on('click', 'a', function (e) {
		var parents = jqDevoops(this).parents('li');
		var li = jqDevoops(this).closest('li.dropdown');
		var another_items = jqDevoops('.main-menu li').not(parents);
		another_items.find('a').removeClass('active');
		another_items.find('a').removeClass('active-parent');
		if (jqDevoops(this).hasClass('dropdown-toggle') || jqDevoops(this).closest('li').find('ul').length == 0) {
			jqDevoops(this).addClass('active-parent');
			var current = jqDevoops(this).next();
			if (current.is(':visible')) {
				li.find("ul.dropdown-menu").slideUp('fast');
				li.find("ul.dropdown-menu a").removeClass('active')
			}
			else {
				another_items.find("ul.dropdown-menu").slideUp('fast');
				current.slideDown('fast');
			}
		}
		else {
			if (li.find('a.dropdown-toggle').hasClass('active-parent')) {
				var pre = jqDevoops(this).closest('ul.dropdown-menu');
				pre.find("li.dropdown").not(jqDevoops(this).closest('li')).find('ul.dropdown-menu').slideUp('fast');
			}
		}
		if (jqDevoops(this).hasClass('active') == false) {
			jqDevoops(this).parents("ul.dropdown-menu").find('a').removeClass('active');
			jqDevoops(this).addClass('active')
		}
		if (jqDevoops(this).hasClass('ajax-menu-link')) {
			e.preventDefault();
			if (jqDevoops(this).hasClass('add-full')) {
				jqDevoops('#content').addClass('full-content');
			}
			else {
				jqDevoops('#content').removeClass('full-content');
			}
			
			var url = jqDevoops(this).attr('href');
			if(e.ctrlKey || e.shiftKey || e.altKey) {
				var win = window.open(SITE_URL+'/'+SITE_ADMIN_DIR_NAME+'#'+url, '_blank');
				if (win) {
					 win.focus();
				} else {
					 alert('Please allow popups!');
				}
			}
			else {
				window.location.hash = url;
				LoadAjaxContent(url);
			}
		}
		if (jqDevoops(this).attr('href') == '#') {
			e.preventDefault();
		}
	});
	
	var height = window.innerHeight - 49;
	jqDevoops('#main').css('min-height', height)
		.on('click', '.expand-link', function (e) {
			var body = jqDevoops('body');
			e.preventDefault();
			var box = jqDevoops(this).closest('div.box');
			var button = jqDevoops(this).find('i');
			button.toggleClass('fa-expand').toggleClass('fa-compress');
			box.toggleClass('expanded');
			body.toggleClass('body-expanded');
			var timeout = 0;
			if (body.hasClass('body-expanded')) {
				timeout = 100;
			}
			setTimeout(function () {
				box.toggleClass('expanded-padding');
			}, timeout);
			setTimeout(function () {
				box.resize();
				box.find('[id^=map-]').resize();
			}, timeout + 50);
		})
		.on('click', '.collapse-link', function (e) {
			e.preventDefault();
			var box = jqDevoops(this).closest('div.box');
			var button = jqDevoops(this).find('i');
			var content = box.find('div.box-content');
			content.slideToggle('fast');
			button.toggleClass('fa-chevron-up').toggleClass('fa-chevron-down');
			setTimeout(function () {
				box.resize();
				box.find('[id^=map-]').resize();
			}, 50);
		})
		.on('click', '.close-link', function (e) {
			e.preventDefault();
			var content = jqDevoops(this).closest('div.box');
			content.remove();
		});
	jqDevoops('body').on('click', 'a.close-link', function(e){
		e.preventDefault();
		CloseModalBox();
	});
	jqDevoops('#top-panel').on('click','a', function(e){
		if (jqDevoops(this).hasClass('ajax-link')) {
			e.preventDefault();
			if (jqDevoops(this).hasClass('add-full')) {
				jqDevoops('#content').addClass('full-content');
			}
			else {
				jqDevoops('#content').removeClass('full-content');
			}
			var url = jqDevoops(this).attr('href');
			window.location.hash = url;
			LoadAjaxContent(url);
		}
	});
	
	//
	// Pipelining function for DataTables. To be used to the `ajax` option of DataTables
	//
	jqDevoops.fn.dataTable.pipeline = function ( opts ) {
		// Configuration options
		var conf = jqDevoops.extend( {
			pages: 5,     // number of pages to cache
			url: '',      // script url
			data: null,   // function or object with parameters to send to the server
						  // matching how `ajax.data` works in DataTables
			method: 'GET' // Ajax HTTP method
		}, opts );
	 
		// Private variables for storing the cache
		var cacheLower = -1;
		var cacheUpper = null;
		var cacheLastRequest = null;
		var cacheLastJson = null;
	 
		return function ( request, drawCallback, settings ) {
			var ajax          = false;
			var requestStart  = request.start;
			var drawStart     = request.start;
			var requestLength = request.length;
			var requestEnd    = requestStart + requestLength;
			 
			if ( settings.clearCache ) {
				// API requested that the cache be cleared
				ajax = true;
				settings.clearCache = false;
				/* Drop the CACHED ROWS with the flag, not just force one request.
				   The flag was consumed by this single call while cacheLastJson stayed live, and
				   cacheLower/cacheUpper below are written at REQUEST time rather than when the
				   response lands. So a click that arrived inside that window (page 2, while the
				   filter change was still in flight) fell through to the cached branch and was
				   served the rows of the query we had just been told to forget. It painted them
				   with the NEW draw number, which then made the correct response look stale and
				   be discarded. Forgetting the rows here costs one extra request in that window
				   and cannot serve a superseded query. */
				cacheLastJson = null;
			}
			else if ( cacheLastJson === null || cacheLower < 0 || requestStart < cacheLower || requestEnd > cacheUpper ) {
				// outside cached data - need to make a request
				ajax = true;
			}
			else if ( JSON.stringify( request.order )   !== JSON.stringify( cacheLastRequest.order ) ||
					  JSON.stringify( request.columns ) !== JSON.stringify( cacheLastRequest.columns ) ||
					  JSON.stringify( request.search )  !== JSON.stringify( cacheLastRequest.search )
			) {
				// properties changed (ordering, columns, searching)
				ajax = true;
			}
			 
			// Store the request for checking next time around
			cacheLastRequest = jqDevoops.extend( true, {}, request );
	 
			if ( ajax ) {
				// Need data from the server
				if ( requestStart < cacheLower ) {
					requestStart = requestStart - (requestLength*(conf.pages-1));
	 
					if ( requestStart < 0 ) {
						requestStart = 0;
					}
				}
				 
				cacheLower = requestStart;
				cacheUpper = requestStart + (requestLength * conf.pages);
	 
				request.start = requestStart;
				request.length = requestLength*conf.pages;
	 
				// Provide the same `data` options as DataTables.
				if ( typeof conf.data === 'function' ) {
					// As a function it is executed with the data object as an arg
					// for manipulation. If an object is returned, it is used as the
					// data object to submit
					var d = conf.data( request );
					if ( d ) {
						jqDevoops.extend( request, d );
					}
				}
				else if ( jqDevoops.isPlainObject( conf.data ) ) {
					// As an object, the data given extends the default
					jqDevoops.extend( request, conf.data );
				}
	 
				settings.jqXHR = jqDevoops.ajax( {
					"type":     conf.method,
					"url":      conf.url,
					"data":     request,
					"dataType": "json",
					"cache":    false,
					"success":  function ( json ) {
						cacheLastJson = jqDevoops.extend(true, {}, json);
	 
						if ( cacheLower != drawStart ) {
							json.data.splice( 0, drawStart-cacheLower );
						}
						if ( requestLength >= -1 ) {
							json.data.splice( requestLength, json.data.length );
						}
						 
						drawCallback( json );
					}
				} );
			}
			else {
				json = jqDevoops.extend( true, {}, cacheLastJson );
				json.draw = request.draw; // Update the echo for each response
				json.data.splice( 0, requestStart-cacheLower );
				json.data.splice( requestLength, json.data.length );
	 
				drawCallback(json);
			}
		}
	};
	 
	// Register an API method that will empty the pipelined data, forcing an Ajax
	// fetch on the next draw (i.e. `table.clearPipeline().draw()`)
	jqDevoops.fn.dataTable.Api.register( 'clearPipeline()', function () {
		return this.iterator( 'table', function ( settings ) {
			settings.clearCache = true;
		} );
	} );
	
	WinMove();
});