define(["require", "exports", "jquery"], function (require, exports, $) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.fetchRSS = void 0;
    /**
     * Fetch CodeON release news
     */
    function fetchRSS(successFn, errorFn) {
        $.ajax({
            url: 'https://github.com/Thorlogy/CodeON/releases.atom',
            dataType: 'xml',
            error: errorFn,
            success: successFn,
        });
    }
    exports.fetchRSS = fetchRSS;
});
