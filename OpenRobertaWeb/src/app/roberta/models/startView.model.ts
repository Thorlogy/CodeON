import * as $ from 'jquery';

/**
 * Fetch CodeON release news
 */
export function fetchRSS(successFn, errorFn) {
    $.ajax({
        url: 'https://github.com/Thorlogy/CodeON/releases.atom',
        dataType: 'xml',
        error: errorFn,
        success: successFn,
    });
}
