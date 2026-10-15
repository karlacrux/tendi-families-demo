// jQuery Alert Dialogs Plugin
//
// Version 1.1
//
// Cory S.N. LaViska
// A Beautiful Site (http://abeautifulsite.net/)
// 14 May 2009
//
// Visit http://abeautifulsite.net/notebook/87 for more information
//
// Usage:
//		jAlert( message, [title, callback] )
//		jConfirm( message, [title, callback] )
//		jPrompt( message, [value, title, callback] )
// 
// History:
//
//		1.00 - Released (29 December 2008)
//
//		1.01 - Fixed bug where unbinding would destroy all resize events
//
// License:
// 
// This plugin is dual-licensed under the GNU General Public License and the MIT License and
// is copyright 2008 A Beautiful Site, LLC. 
//
(function($) {
	
	$.alerts = {
		
		// These properties can be read/written by accessing $.alerts.propertyName from your scripts at any time
		
		verticalOffset: -75,                // vertical offset of the dialog from center screen, in pixels
		horizontalOffset: 0,                // horizontal offset of the dialog from center screen, in pixels/
		repositionOnResize: true,           // re-centers the dialog on window resize
		overlayOpacity: .01,                // transparency level of overlay
		overlayColor: '#FFF',               // base color of overlay
		draggable: true,                    // make the dialogs draggable (requires UI Draggables plugin)
		okButton: '&nbsp;OK&nbsp;',         // text for the OK button
		cancelButton: '&nbsp;Cancel&nbsp;', // text for the Cancel button
		dialogClass: null,                  // if specified, this class will be applied to all dialogs
		
		// Public methods
		
		alert: function(message, title, dialogClass, callback) {
			if( title == null ) title = 'Alert';
			if( dialogClass == null ) dialogClass = 'success';
			$.alerts._show(title, message, null, 'alert', dialogClass, function(result) {
				if( callback ) callback(result);
			});
		},
		
		confirm: function(message, title, dialogClass, callback) {
			if( title == null ) title = 'Confirm';
			if( dialogClass == null ) dialogClass = 'success';
			$.alerts._show(title, message, null, 'confirm', dialogClass, function(result) {
				if( callback ) callback(result);
			});
		},

		customConfirm: function(message, title, dialogClass, callback, yesLabel, noLabel) {
			if( title == null ) title = 'Confirm';
			if( dialogClass == null ) dialogClass = 'success';
			$.alerts._show(title, message, null, 'customConfirm', dialogClass, function(result) {
				if( typeof callback === 'function' ) callback(result);
			}, yesLabel, noLabel);
		},
		
		prompt: function(message, value, title, dialogClass, callback) {
			if( title == null ) title = 'Prompt';
			if( dialogClass == null ) dialogClass = 'success';
			$.alerts._show(title, message, value, 'prompt', dialogClass, function(result) {
				if( callback ) callback(result);
			});
		},
		
		_show: function(title, msg, value, type, dialogClass, callback, yesLabel, noLabel) {
			var jqAlertBox = jQuery.noConflict();
			jqAlertBox.alerts._hide();
			jqAlertBox.alerts._overlay('show');
			
			jqAlertBox("BODY").append(
				'<div id="popup_container">' +
					'<h1 id="popup_title"></h1>' +
					'<div id="popup_content">' +
						'<div id="popup_message"></div>' +
				'</div>' +
				'</div>');
			
			if( dialogClass ) jqAlertBox("#popup_container").addClass("alert-" + dialogClass);
			
			var pos = (jqAlertBox.browser.msie && parseInt(jqAlertBox.browser.version) <= 6 ) ? 'absolute' : 'fixed'; 
			
			jqAlertBox("#popup_container").css({
				position: pos,
				zIndex: 99999,
				padding: 0,
				margin: 0
			});
			
			jqAlertBox("#popup_title").text(title);
			jqAlertBox("#popup_content").addClass(type);
			jqAlertBox("#popup_message").text(msg);
			jqAlertBox("#popup_message").html(jqAlertBox("#popup_message").text().replace(/\n/g, '<br />'));
			
			jqAlertBox("#popup_container").css({
				minWidth: jqAlertBox("#popup_container").outerWidth(),
				maxWidth: jqAlertBox("#popup_container").outerWidth()
			});
			
			jqAlertBox.alerts._reposition();
			jqAlertBox.alerts._maintainPosition(true);
			
			switch( type ) {
				case 'alert':
					jqAlertBox("#popup_message").after('<div id="popup_panel"><input type="button" value="' + jqAlertBox.alerts.okButton + '" id="popup_ok" /></div>');
					jqAlertBox("#popup_ok").click( function() {
						jqAlertBox.alerts._hide();
						callback(true);
					});
					jqAlertBox("#popup_ok").focus().keypress( function(e) {
						if( e.keyCode == 13 || e.keyCode == 27 ) jqAlertBox("#popup_ok").trigger('click');
					});
				break;
				case 'confirm':
					jqAlertBox("#popup_message").after('<div id="popup_panel"><input type="button" value="' + jqAlertBox.alerts.okButton + '" id="popup_ok" /> <input type="button" value="' + jqAlertBox.alerts.cancelButton + '" id="popup_cancel" /></div>');
					jqAlertBox("#popup_ok").click( function() {
						jqAlertBox.alerts._hide();
						if( callback ) callback(true);
					});
					jqAlertBox("#popup_cancel").click( function() {
						jqAlertBox.alerts._hide();
						if( callback ) callback(false);
					});
					jqAlertBox("#popup_ok").focus();
					jqAlertBox("#popup_ok, #popup_cancel").keypress( function(e) {
						if( e.keyCode == 13 ) jqAlertBox("#popup_ok").trigger('click');
						if( e.keyCode == 27 ) jqAlertBox("#popup_cancel").trigger('click');
					});
				break;
				case 'customConfirm':
					jqAlertBox("#popup_message").after('<div id="popup_panel"><input type="button" value="' + (yesLabel || jqAlertBox.alerts.okButton) + '" id="popup_ok" /> <input type="button" value="' + (noLabel || jqAlertBox.alerts.cancelButton) + '" id="popup_cancel" /></div>');
					jqAlertBox("#popup_ok").click( function() {
						jqAlertBox.alerts._hide();
						if( callback ) callback(true);
					});
					jqAlertBox("#popup_cancel").click( function() {
						jqAlertBox.alerts._hide();
						if( callback ) callback(false);
					});
					jqAlertBox("#popup_ok").focus();
					jqAlertBox("#popup_ok, #popup_cancel").keypress( function(e) {
						if( e.keyCode == 13 ) jqAlertBox("#popup_ok").trigger('click');
						if( e.keyCode == 27 ) jqAlertBox("#popup_cancel").trigger('click');
					});
				break;
				case 'prompt':
					jqAlertBox("#popup_message").append('<br /><input type="text" size="30" id="popup_prompt" />').after('<div id="popup_panel"><input type="button" value="' + jqAlertBox.alerts.okButton + '" id="popup_ok" /> <input type="button" value="' + jqAlertBox.alerts.cancelButton + '" id="popup_cancel" /></div>');
					jqAlertBox("#popup_prompt").width(jqAlertBox("#popup_message").width());
					jqAlertBox("#popup_ok").click( function() {
						var val = jqAlertBox("#popup_prompt").val();
						jqAlertBox.alerts._hide();
						if( callback ) callback(val);
					});
					jqAlertBox("#popup_cancel").click( function() {
						jqAlertBox.alerts._hide();
						if( callback ) callback(null);
					});
					jqAlertBox("#popup_prompt, #popup_ok, #popup_cancel").keypress( function(e) {
						if( e.keyCode == 13 ) jqAlertBox("#popup_ok").trigger('click');
						if( e.keyCode == 27 ) jqAlertBox("#popup_cancel").trigger('click');
					});
					if( value ) jqAlertBox("#popup_prompt").val(value);
					jqAlertBox("#popup_prompt").focus().select();
				break;
			}
			
			if( jqAlertBox.alerts.draggable ) {
				try {
					jqAlertBox("#popup_container").draggable({ handle: jqAlertBox("#popup_title") });
					jqAlertBox("#popup_title").css({ cursor: 'move' });
				} catch(e) { /* requires jQuery UI draggables */ }
			}
		},
		
		_hide: function() {
			jQuery.noConflict()("#popup_container").remove();
			jQuery.noConflict().alerts._overlay('hide');
			jQuery.noConflict().alerts._maintainPosition(false);
		},
		
		_overlay: function(status) {
			switch( status ) {
				case 'show':
					jQuery.noConflict().alerts._overlay('hide');
					jQuery.noConflict()("BODY").append('<div id="popup_overlay"></div>');
					jQuery.noConflict()("#popup_overlay").css({
						position: 'absolute',
						zIndex: 99998,
						top: '0px',
						left: '0px',
						width: '100%',
						height: jQuery.noConflict()(document).height(),
						background: jQuery.noConflict().alerts.overlayColor,
						opacity: jQuery.noConflict().alerts.overlayOpacity
					});
				break;
				case 'hide':
					jQuery.noConflict()("#popup_overlay").remove();
				break;
			}
		},
		
		_reposition: function() {
			var top = ((jQuery.noConflict()(window).height() / 2) - (jQuery.noConflict()("#popup_container").outerHeight() / 2)) + jQuery.noConflict().alerts.verticalOffset;
			var left = ((jQuery.noConflict()(window).width() / 2) - (jQuery.noConflict()("#popup_container").outerWidth() / 2)) + jQuery.noConflict().alerts.horizontalOffset;
			if( top < 0 ) top = 0;
			if( left < 0 ) left = 0;
			
			// IE6 fix
			if( jQuery.noConflict().browser.msie && parseInt(jQuery.noConflict().browser.version) <= 6 ) top = top + jQuery.noConflict()(window).scrollTop();
			
			jQuery.noConflict()("#popup_container").css({
				top: top + 'px',
				left: left + 'px'
			});
			jQuery.noConflict()("#popup_overlay").height( jQuery.noConflict()(document).height() );
		},
		
		_maintainPosition: function(status) {
			if( jQuery.noConflict().alerts.repositionOnResize ) {
				switch(status) {
					case true:
						jQuery.noConflict()(window).bind('resize', jQuery.noConflict().alerts._reposition);
					break;
					case false:
						jQuery.noConflict()(window).unbind('resize', jQuery.noConflict().alerts._reposition);
					break;
				}
			}
		}
		
	}
	
	// Shortuct functions
	jAlert = function(message, title, dialogClass, callback) {
		jQuery.noConflict().alerts.alert(message, title, dialogClass, callback);
	}
	
	jConfirm = function(message, title, dialogClass, callback) {
		jQuery.noConflict().alerts.confirm(message, title, dialogClass, callback);
	};
		
	jPrompt = function(message, value, title, dialogClass, callback) {
		jQuery.noConflict().alerts.prompt(message, value, title, dialogClass, callback);
	};

	jCustomConfirm = function(message, title, dialogClass, callback, yesLabel, noLabel) {
		jQuery.noConflict().alerts.customConfirm(message, title, dialogClass, callback, yesLabel, noLabel);
	};

})(jQuery);
