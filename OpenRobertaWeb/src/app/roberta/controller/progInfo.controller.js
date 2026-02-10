import * as GUISTATE_C from 'guiState.controller';
import * as Blockly from 'blockly';
import * as $ from 'jquery';
import 'jquery-validate';
import 'jquery-hotkeys';
import 'bootstrap-tagsinput';
import 'bootstrap.wysiwyg';

const INITIAL_WIDTH = 0.3;
var blocklyWorkspace;
/**
 *
 */
function init() {
    blocklyWorkspace = GUISTATE_C.getBlocklyWorkspace();
    initView();
    initEvents();
}
export { init };

function initView() {
    $('#infoContent').wysiwyg();
    $('#infoTags').tagsinput('removeAll');
    $('#infoContent').attr('data-placeholder', Blockly.Msg.INFO_DOCUMENTATION_HINT || 'Document your program here ...');
    $('.bootstrap-tagsinput input').attr('placeholder', Blockly.Msg.INFO_TAGS || 'Tags');
}

export function switchLanguage() {
    $('#infoContent').attr('data-placeholder', Blockly.Msg.INFO_DOCUMENTATION_HINT || 'Document your program here ...');
    $('.bootstrap-tagsinput input').attr('placeholder', Blockly.Msg.INFO_TAGS || 'Tags');
}

function initEvents() {
    $('#infoButton').off('click touchend');
    $('#infoButton').onWrap('click touchend', function (event) {
        toggleInfo($(this));
        return false;
    });
    $(window).on('resize', function (e) {
        if ($('#infoDiv').hasClass('rightActive')) {
            $('#infoContainer').css({
                width: $('#infoDiv').outerWidth(),
                height: $('#infoDiv').outerHeight() - $('.btn-toolbar.editor').outerHeight() - 57,
            });
        }
    });
    $('#infoContent, #infoTags').on('change', function () {
        // TODO: here should be an onWrap. But this change is called during a run of another wrapped callback
        blocklyWorkspace.description = $('#infoContent').html();
        blocklyWorkspace.tags = $('#infoTags').val();
        if (GUISTATE_C.isProgramSaved()) {
            GUISTATE_C.setProgramSaved(false);
        }
        if (typeof $('#infoContent').html() === 'string' && $('#infoContent').html().length) {
            $('#infoButton').addClass('notEmpty');
        } else {
            $('#infoButton').removeClass('notEmpty');
        }
    });
    // prevent to copy eg ms word formatting!
    $('[contenteditable]#infoContent').onWrap('paste', function (e) {
        e.preventDefault();
        var text = '';
        if (e.clipboardData || e.originalEvent.clipboardData) {
            text = (e.originalEvent || e).clipboardData.getData('text/plain');
        } else if (window.clipboardData) {
            text = window.clipboardData.getData('Text');
        }
        if (document.queryCommandSupported('insertText')) {
            document.execCommand('insertText', false, text);
        } else {
            document.execCommand('paste', false, text);
        }
        $('#infoContent').trigger('change');
    });
}

function toggleInfo($button) {
    if ($('#infoButton').hasClass('rightActive')) {
        $('#blocklyDiv').closeRightView();
    } else {
        // AI Suggestions Interface
        var chatHtml =
            '<div id="aiChat" style="padding: 10px; display: flex; flex-direction: column; height: 100%;">' +
            '<h4 style="margin-top: 0;">AI Code Buddy</h4>' +
            '<div id="aiChatOutput" style="flex-grow: 1; overflow-y: auto; border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; background: #f9f9f9; border-radius: 4px;">' +
            '<div class="ai-msg" style="margin-bottom: 10px;"><strong>Buddy:</strong> Hi! I can help you with your code. Click "Get Suggestions" to analyze your blocks!</div>' +
            '</div>' +
            '<button id="aiAskBtn" class="btn btn-primary" style="width: 100%;">Get Suggestions</button>' +
            '</div>';

        $('#infoContent').html(chatHtml);
        // Remove wysiwyg binding to prevent interference
        $('#infoContent').off();

        $('#aiAskBtn').on('click', function () {
            var msgs = [
                "Try adding a loop to repeat actions!",
                "Check your variable names, they should be descriptive.",
                "Looks like you're driving the robot. Make sure to stop it at the end!",
                "Great start! Have you tried using a sensor?"
            ];
            var randomMsg = msgs[Math.floor(Math.random() * msgs.length)];
            $('#aiChatOutput').append('<div class="ai-msg" style="margin-bottom: 10px;"><strong>Buddy:</strong> ' + randomMsg + '</div>');
            var chatOut = document.getElementById("aiChatOutput");
            chatOut.scrollTop = chatOut.scrollHeight;
        });

        $button.openRightView($('#infoDiv'), INITIAL_WIDTH);
    }
}
