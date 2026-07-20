define(["require", "exports", "log", "jquery", "guiState.controller", "blockly", "bootstrap"], function (require, exports, LOG, $, GUISTATE_C, Blockly) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.translate = exports.init = void 0;
    /**
     * Initialize language switching
     */
    function init() {
        var ready = new $.Deferred();
        var language = navigator.language.toLowerCase().indexOf('de') === 0 ? 'de' : 'en';
        if (language === 'de') {
            $('.EN').css('display', 'none');
            $('.DE').css('display', 'inline');
            $('li>a.DE').css('display', 'block');
        }
        else {
            $('.DE').css('display', 'none');
            $('.EN').css('display', 'inline');
            $('li>a.EN').css('display', 'block');
        }
        $('#language li a[lang=' + language + ']')
            .parent()
            .addClass('disabled');
        var url = 'blockly/msg/js/' + language + '.js';
        getCachedScript(url).done(function (data) {
            translate();
            ready.resolve(language);
        });
        initEvents();
        return ready.promise(language);
    }
    exports.init = init;
    function initEvents() {
        $('#language').onWrap('click', 'li a', function () {
            LOG.info('language clicked');
            var language = $(this).attr('lang');
            switchLanguage(language);
        }),
            'switch language clicked';
    }
    function switchLanguage(language) {
        language = language && language.toLowerCase() === 'de' ? 'de' : 'en';
        if (GUISTATE_C.getLanguage() === language) {
            return;
        }
        var url = 'blockly/msg/js/' + language + '.js?v=2';
        getCachedScript(url).done(function (data) {
            GUISTATE_C.setLanguage(language);
            translate();
        });
        LOG.info('language switched to ' + language);
    }
    /**
     * Translate the web page
     */
    function translate($domElement) {
        if (!$domElement || typeof $domElement !== 'object' || !$domElement.length) {
            $domElement = $(document.body);
        }
        $domElement.find('[lkey]').each(function (index) {
            var lkey = $(this).attr('lkey');
            var key, value;
            if (lkey.toString().indexOf('+') > -1) {
                key = lkey.split('+').map(function (k) { return k.trim().replace('Blockly.Msg.', ''); }); //.forEach((k) => k.replace('Blockly.Msg.', ''));
                value = key.map(function (k) { return Blockly.Msg[k]; }).join('');
            }
            else {
                key = lkey.replace('Blockly.Msg.', '');
                value = Blockly.Msg[key];
            }
            if (value == undefined) {
                console.error('UNDEFINED    key : value = ' + key + ' : ' + value);
                return true;
            }
            if ($(this).attr('rel') === 'tooltip') {
                $(this).attr('data-bs-original-title', value);
                $(this).attr('aria-label', value);
                $(this).attr('title', value);
            }
            else {
                $(this).html(value);
                $(this).attr('value', value);
            }
        });
        $('#start input.form-control.search-input').attr('placeholder', Blockly.Msg.START_FORMATSEARCH);
    }
    exports.translate = translate;
    /**
     * $.getScript() will append a timestamped query parameter to the url to
     * prevent caching. The cache control should be handled using http-headers.
     * see https://api.jquery.com/jquery.getscript/#caching-requests
     */
    function getCachedScript(url, options) {
        // Allow user to set any option except for dataType, cache, and url
        options = $.extend(options || {}, {
            dataType: 'script',
            cache: true,
            url: url,
        });
        // Use $.ajax() since it is more flexible than $.getScript
        // Return the jqXHR object so we can chain callbacks
        return jQuery.ajax(options);
    }
});
