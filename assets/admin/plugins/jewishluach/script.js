function GetEdateJewish() {
    var base_url = window.location.origin;
    var Url = base_url + "/Calendar/EDate?date=" + jqView("#HebDate").val() + "&callback=?";
    jQuery.getJSON(Url, function (data) {
        jqView(".greg-date").val(data.html);
    });
}
(function ($) {

    $.fn.jewishluach = function (options) {

        var _this = this;
        var curent_herb_day = "-1";
        function _getUrl(date, herb_day) {
            let viewName = "GetMonthWidget";
           

            var lat = $("#txtLat").val();
            var lng = $("#txtLng").val();            

            if (lat && lng) {
                //return "https://localhost:44333/Calendar/" + viewName + "?date=" + date + "&herb_day=" + herb_day + "&lat=" + lat + "&lng=" + lng + "&callback=?";
                return "https://dtpicker.jewishluach.com/Calendar/" + viewName + "?date=" + date + "&herb_day=" + herb_day + "&lat=" + lat + "&lng=" + lng + "&callback=?";
            }

            //return "https://localhost:44333/Calendar/" + viewName + "?date=" + date + "&herb_day=" + herb_day + "&callback=?";
            return "https://dtpicker.jewishluach.com/Calendar/" + viewName + "?date=" + date + "&herb_day=" + herb_day + "&callback=?";
        }

        function _setDataToContainers() {
            let $active_cel = $(".ui-state-active", _this).parent();
            curent_herb_day = $active_cel.attr("data-herb-day");
            let herb_date = $active_cel.attr("data-herb-yiddishdate");
            let date_short = $active_cel.attr("data-short");
            let date_long = $active_cel.attr("data-long");
            let data_herb_yiddishdate = $active_cel.attr("data-herb-yiddishdate");
            let data_herb_parsheday = $active_cel.attr("data-herb-parsheday");
            let data_herb_hebrewdate = $active_cel.attr("data-herb-hebrewdate");
            _setValue(settings.hebrewDateLongContainer, herb_date);
            _setValue(settings.gregorianDateContainer, date_short);
            _setValue(settings.gregorianDateContainer, date_long, true);
            _setValue(settings.yiddishDateContainer, data_herb_yiddishdate);
            _setValue(settings.parsheDateContainer, data_herb_parsheday);
            _setValue(settings.hebrewDateContainer, data_herb_hebrewdate);

            if ($("#zmanim-container").length) {
                GotoZmanim();
                fillWeekendZmanim();
            }

            if ($("#date-converter-container").length) {
                let txtHday = $(".ui-state-active", _this).html();
                let txtHyear = $("#selectHYear option:selected", _this).text();
                let txtHmonth = $("#selectHMonth option:selected", _this).text();
                $("#iHMonthDay").val(txtHday);
                $("#iSelectMonth").val(txtHmonth);
                $("#iHYear").val(txtHyear);
            }

            let result = {
                curent_herb_day: curent_herb_day,
                herb_date: herb_date,
                date_short: date_short,
                date_long: date_long,
                data_herb_yiddishdate: data_herb_yiddishdate,
                data_herb_parsheday: data_herb_parsheday,
                data_herb_hebrewdate: data_herb_hebrewdate
            };

            return result;
        }

        function _setEventsHover() {
            $("[data-handler=selectDay]", _this).hover(function () {
                $("a", this).addClass("ui-state-hover");
            }, function () {
                $("a", this).removeClass("ui-state-hover");
            });
            $(".ui-datepicker-prev", _this).hover(function () {
                $(this).addClass("ui-state-hover");
                $(this).addClass("ui-datepicker-prev-hover");
            }, function () {
                $(this).removeClass("ui-state-hover");
                $(this).removeClass("ui-datepicker-prev-hover");
            });
            $(".ui-datepicker-next", _this).hover(function () {
                $(this).addClass("ui-state-hover");
                $(this).addClass("ui-datepicker-next-hover");
            }, function () {
                $(this).removeClass("ui-state-hover");
                $(this).removeClass("ui-datepicker-next-hover");
            });
        }

        function _setEventsClick() {

            $("[data-handler=selectDay]", _this).click(function (e) {
                _stopBubbleEvents(e);
                $("a", "[data-handler=selectDay]", _this).removeClass("ui-state-active");
                $("a", this).addClass("ui-state-active");
                if ($("#zmanim-container").length) {
                    //showZmanim();
                }
                else {
                    if (settings.hideAfterClick === true) {
                        _this.hide();
                    }
                }
                let resultSelection = _setDataToContainers();
                _this.trigger("change", resultSelection);
            });


            $(".ui-datepicker-prev", _this).click(function (e) {
                _stopBubbleEvents(e);
                let next_date = $(this).attr("data-next");
                _retriveData(next_date, function () { });
            });

            $(".ui-datepicker-next", _this).click(function (e) {
                _stopBubbleEvents(e);
                let next_date = $(this).attr("data-next");
                _retriveData(next_date, function () { });
            });
        }

        function _offEvents() {
            _this.off();
            $(".ui-datepicker-next", _this).off();
            $(".ui-datepicker-prev", _this).off();
            $("[data-handler=selectDay]", _this).off();
        }

        function _setEventsSelect() {
            $("select", ".ui-datepicker-month", _this).change(function () {
                let date = $(this).val();
                _retriveData(date, function () { });
            });
            $("select", ".ui-datepicker-year", _this).change(function () {
                let date = $(this).val();
                _retriveData(date, function () { });
            });
        }

        function _retriveData(date, callback) {
            let url = _getUrl(date, curent_herb_day);
            jQuery.getJSON(url, function (data) {
                _this.html(data.html);
                if (!settings.onlyLoadData) {
                    _setEventsHover();
                    _setEventsClick();
                    _setEventsSelect();
                }
                let resultSelection = _setDataToContainers();
                callback(resultSelection);
            });
        }

        function _init() {
            _offEvents();
            _retriveData(settings.date, function (data) {
                if (settings.loaded) {
                    settings.loaded(data);
                }
            });
        }

        function _stopBubbleEvents(event) {
            event.preventDefault();
            event.stopImmediatePropagation();
            event.stopPropagation();
        }

        function _setValue(selector, value, isOnlyHtml) {
            if (selector) {
                $(selector).each(function () {
                    let $elm = $(this);
                    if ($elm.is('input, select, textarea')) {
                        if (!isOnlyHtml) {
                            $elm.prop("value", value);
                        }
                    }
                    else {
                        $elm.html(value);
                    }
                });
            }
        }

        var settings = $.extend({
            date: null,
            hebrewDateLongContainer: null,
            gregorianDateContainer: null,
            yiddishDateContainer: null,
            parsheDateContainer: null,
            hebrewDateContainer: null,
            calendarType: null,
            loaded: null,
            onlyLoadData: false,
            hideAfterClick: false
        }, options);

        _init();

        return this;
    };
}(jQuery));
let shouldIgnoreBodyClick = false;
let calendarInitialized = false;
function openCalJewish() {
    shouldIgnoreBodyClick = true;

    var sdate;
    var today = new Date();
    var todayString = (today.getMonth() + 1) + '/' + today.getDate() + '/' + today.getFullYear();
    const gregValue = jqView(".greg-date").val();

    /* With no Hebrew dob stored yet the carrier is empty, and this used to open the calendar
       on TODAY. Every pick then landed in the current month, years away from the child's date
       of birth, which is where rows like dob 2023-06-14 with hebrew_dob 2026-06-10 came from.
       The DOB is the only sensible starting point: the Hebrew date of birth is that day, or
       the one after it for a child born after sunset. Today is kept as the last resort, for
       the add form before a DOB has been entered. */
    const dobValue = jqView("#dob").val();
    const fallback = isNaN(Date.parse(dobValue)) ? todayString : dobValue;

    sdate = isNaN(Date.parse(gregValue)) ? fallback : gregValue;

    if (!calendarInitialized) {
        jQuery('body').on('click', function (e) {
            if (shouldIgnoreBodyClick) {
                shouldIgnoreBodyClick = false;
                return;
            }

            if (
                jqView("#calendar").is(":visible") &&
                !jQuery(e.target).is('#calendar') &&
                !jQuery(e.target).is('#HebDate') &&
                !jQuery(e.target).is('#cal') &&
                !jQuery(e.target).is('.fa-calendar') &&
                !jQuery(e.target).closest('#calendar').length
            ) {
                jqView('#calendar').hide();
            }
        });

        calendarInitialized = true;
    }

    /* ONE writer for the pair, shared by both paths below, so the visible box and the hidden
       carrier can never end up holding different days. `hebrew_dob` stores a GREGORIAN date
       (data-short) and the box only ever shows the Hebrew reading of that same day, so the two
       are written together or not at all. tndFormatHebDate keeps the gershayim in the year, and
       an active cell with no date attribute writes nothing rather than blanking what is there. */
    function setHebDobPair(dateShort, yiddish) {
        if (!dateShort) return;
        jqView(".greg-date").val(dateShort);
        if (yiddish) {
            jqView(".yiddish-date").val(window.tndFormatHebDate ? window.tndFormatHebDate(yiddish) : yiddish);
        }
    }

    /* Opening the calendar FILLS the field, which is what the legacy app did and what was asked
       for again on card WQHaF59a: click the box, the date from the service appears, and saving
       stores it.
       It used to be only half of that. The plugin's yiddishDateContainer wrote the visible box
       the moment the calendar finished loading and nothing wrote the hidden hebrew_dob carrier,
       so the box showed a Hebrew date that was never going to be saved, and with nothing stored
       the calendar opened on TODAY, which is where rows like dob 2023-06-14 with hebrew_dob
       2026-06-10 came from. Dropping the container stopped the lie by showing nothing at all,
       and that is what came back as "clicking into the field should insert the value from the
       service, and when it saves it should save to the db".
       Writing the PAIR is the whole answer. The calendar opens on the date already stored, else
       on the child's DOB, else on today (see sdate above), and whichever of those it is, the box
       and the carrier both get that same day, so what is on screen is what gets saved.
       `loaded` fires once per open, from _init() only. Paging months goes through _retriveData()
       with the plugin's own empty callback, so browsing still writes nothing until a day is
       actually clicked.
       Not the only writer in the FORM, though: children.php puts onchange="GetEdateJewish()" on
       both #HebDate and the .greg-date carrier, and that function writes the carrier too. It is
       inert today only because it builds its URL from the Tendi app's own origin, so the request
       404s and the callback never runs. Whether it gets repointed or removed is still open on
       card WQHaF59a; until that is answered it is left exactly as it is. */
    jqView("#calendar").jewishluach({
        date: sdate,
        hideAfterClick: true,
        loaded: function (data) {
            if (data) {
                setHebDobPair(data.date_short, data.data_herb_yiddishdate);
            }
        }
    });

    jqView("#calendar").on("change", (e, data) => {
        setHebDobPair(data.date_short, data.data_herb_yiddishdate);
    });

    jqView("#calendar").show();
}


jqView(document).ready(function () {

    jqView(".greg-date").each(function () {
        jqView(this).datepicker({
            changeMonth: true,
            changeYear: true
        });
    });
     const gregValue = jqView(".greg-date").val();

    if (gregValue && gregValue.trim() !== "") {
        jqView("#calendar").jewishluach({
            yiddishDateContainer: ".yiddish-date",
            date: gregValue,
            hideAfterClick: true,
            loaded: function () {
                // Manually simulate click/selection to fill .yiddish-date
                const $activeCell = jqView("#calendar").find(".ui-state-active").parent();
                const yiddishDate = $activeCell.attr("data-herb-yiddishdate");

                if (yiddishDate) {
                    jqView(".yiddish-date").val(window.tndFormatHebDate ? window.tndFormatHebDate(yiddishDate) : yiddishDate);
                }
            }
        });
    }
});