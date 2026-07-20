define(['jquery'], function ($) {
    function init() {
        console.log("Initializing Creators Theme (Blue + Create Logo)");

        // Fix missing keys to prevent errors
        if (typeof Blockly !== 'undefined' && Blockly.Msg) {
            if (!Blockly.Msg.MENU_PYTHON_LIBRARY) Blockly.Msg.MENU_PYTHON_LIBRARY = "Python-Vorlagen";
            if (!Blockly.Msg.MENU_RIGHT_SYNC_TOOLTIP) Blockly.Msg.MENU_RIGHT_SYNC_TOOLTIP = "Sync";
        }

        // 1. Change Logo
        var logo = $('.img-beta');
        if (logo.length) {
            logo.attr('src', 'css/img/creator_logo.png');
            logo.css('height', '40px'); // Adjust as needed
        }

        // 2. Inject CSS for Blue Theme
        var style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = `
            :root {
                --main-color: #009EE3 !important;
                --main-dark: #0076A9 !important;
                --robot-main: #009EE3 !important;
                --blockly-workspace-bg: #F0F8FF !important;
            }
            .navbar { background-color: #009EE3 !important; }
            .btn-primary { background-color: #009EE3 !important; border-color: #0076A9 !important; }
            .modal-header { background-color: #009EE3 !important; }
            .dropdown-menu > li > a:hover { background-color: #E0F7FA !important; }
            
            /* Toolbox Category Backgrounds */
            .blocklyTreeRow.blocklyTreeSelected {
                background-color: #0076A9 !important;
            }

            /* Nested toolbox labels are created lazily when a category opens. */
            #program .blocklyTreeLabel.blocklyTreeSub,
            #program [role="treeitem"][aria-level="2"] > .blocklyTreeRow:not(.blocklyTreeSelected) > .blocklyTreeLabel {
                color: #4a4a4a !important;
            }
            #program [role="treeitem"][aria-level="2"] > .blocklyTreeRow.blocklyTreeSelected > .blocklyTreeLabel {
                color: #fff !important;
            }

            /* AI Buddy Sidebar Button */
            #ai-buddy-btn-sidebar {
                background: linear-gradient(145deg, #ffb348, #f28c28) !important;
                color: white !important;
                border-radius: 8px;
                margin-top: 5px;
                cursor: pointer;
                transition: transform 0.2s, box-shadow 0.2s;
            }
            #ai-buddy-btn-sidebar:hover { transform: translateX(-2px); }
            #ai-buddy-btn-sidebar:focus-visible { outline: 3px solid #062f5f; outline-offset: 2px; }
            #ai-buddy-btn-sidebar.active { box-shadow: 0 0 0 3px rgba(242,140,40,0.28); }

            /* AI Buddy Sliding Panel */
            .sidebar-panel {
                position: fixed;
                top: 0;
                right: -530px;
                width: 520px;
                max-width: 100vw;
                height: 100vh;
                background: #f7fafc;
                box-shadow: -12px 0 32px rgba(6,47,95,0.18);
                z-index: 1050;
                transition: right 0.3s ease-in-out;
                display: flex;
                flex-direction: column;
                font-family: inherit;
                color: #172033;
            }
            .sidebar-panel.active { right: 0; }

            .panel-header {
                min-height: 80px;
                padding: 14px 18px;
                background: #fff;
                border-bottom: 1px solid #dce6ee;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .ai-panel-title { display: flex; align-items: center; gap: 12px; min-width: 0; }
            .ai-buddy-mark {
                width: 44px;
                height: 44px;
                flex: 0 0 44px;
                display: grid;
                place-items: center;
                border-radius: 13px;
                background: linear-gradient(145deg, #062f5f, #0076a9);
                color: #00cfaa;
                font-weight: 800;
                letter-spacing: -1px;
            }
            .panel-header h3 { margin: 0 0 2px; font-size: 1.18rem; font-weight: 700; }
            #ai-model-badge { color: #607284; font-size: 0.76rem; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px; }
            .header-tools { display: flex; gap: 8px; }
            .ai-icon-button {
                width: 42px;
                height: 42px;
                padding: 9px;
                display: inline-grid;
                place-items: center;
                border: 1px solid #d6e0e8;
                border-radius: 11px;
                background: #fff;
                color: #30465c;
                cursor: pointer;
                transition: background 0.15s, color 0.15s, transform 0.15s;
            }
            .ai-icon-button svg { width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
            .ai-icon-button:hover { background: #e9f7fb; color: #0076a9; transform: translateY(-1px); }
            .ai-icon-button:focus-visible, #ai-buddy-panel button:focus-visible, #ai-buddy-panel input:focus-visible, #ai-buddy-panel select:focus-visible { outline: 3px solid rgba(0,158,227,0.32); outline-offset: 2px; }
            .close-panel { color: #65788a; }

            .panel-content {
                flex: 1;
                overflow-y: auto;
                padding: 18px;
                background: #f7fafc;
            }
            #ai-settings { max-width: 470px; margin: 0 auto; }
            .ai-settings-intro h4 { margin: 0 0 6px; font-weight: 700; color: #062f5f; }
            .ai-settings-intro p { color: #52677b; line-height: 1.45; }
            .ai-form-card {
                background: #fff;
                border: 1px solid #dce6ee;
                border-radius: 14px;
                padding: 16px;
                margin-top: 14px;
                box-shadow: 0 4px 14px rgba(6,47,95,0.05);
            }
            .ai-form-card > label:not(.ai-check-row) { display: block; margin: 12px 0 6px; font-weight: 650; color: #273d52; }
            .ai-form-card > label:first-child { margin-top: 0; }
            .ai-form-card .form-control { min-height: 44px; border-radius: 9px; border-color: #bfcdd8; }
            .ai-provider-explanation {
                margin-top: 10px;
                padding: 10px 12px;
                border-radius: 9px;
                background: #f2f7fa;
                color: #40586d;
                font-size: 0.8rem;
                line-height: 1.4;
            }
            .ai-status-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 7px; }
            .ai-status-dot.local { background: #00a67d; box-shadow: 0 0 0 3px rgba(0,166,125,0.13); }
            .ai-status-dot.cloud { background: #009ee3; box-shadow: 0 0 0 3px rgba(0,158,227,0.13); }
            .ai-secret-row { display: flex; gap: 8px; }
            .ai-secret-row .form-control { min-width: 0; }
            .ai-small-button { border: 1px solid #bfcdd8; border-radius: 9px; background: #f5f8fa; color: #30465c; padding: 0 12px; font-weight: 600; }
            .ai-field-help { display: block; color: #6b7f91; font-size: 0.75rem; line-height: 1.35; margin: 6px 0 0; }
            .ai-model-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 8px; }
            .ai-model-row .ai-field-help { flex: 1; margin: 0; }
            .ai-model-row .ai-small-button { min-height: 34px; flex: 0 0 auto; }
            .ai-check-row { display: flex; gap: 11px; align-items: flex-start; cursor: pointer; margin: 0; }
            .ai-check-row + .ai-check-row { margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5edf2; }
            .ai-check-row input { width: 20px; height: 20px; flex: 0 0 20px; margin-top: 1px; accent-color: #0076a9; }
            .ai-check-row span { display: flex; flex-direction: column; gap: 3px; }
            .ai-check-row small { color: #607284; line-height: 1.4; }
            .ai-notice { border-left: 4px solid #009ee3; background: #eaf7fd; color: #29455d; border-radius: 9px; padding: 11px 13px; font-size: 0.82rem; line-height: 1.42; }
            .ai-notice-warning { border-left-color: #e98b21; background: #fff5e8; color: #694315; margin-top: 12px; }
            .ai-notice-local { border-left-color: #00a67d; background: #eaf9f4; color: #174f40; margin-top: 14px; }
            .ai-inline-error { min-height: 22px; margin: 10px 2px 0; color: #b3261e; font-size: 0.84rem; font-weight: 600; }
            .ai-settings-actions { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 8px; }
            .ai-settings-actions .btn { min-height: 42px; border-radius: 9px; font-weight: 650; }
            .ai-settings-actions #btn-save-settings { flex: 1 1 190px; }
            #ai-chat { height: 100%; min-height: 0; flex-direction: column; gap: 12px; }
            .chat-area { flex: 1; min-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding: 2px 2px 12px; }
            .message {
                max-width: 85%;
                padding: 12px 16px;
                border-radius: 14px;
                line-height: 1.5;
                font-size: 0.95rem;
                overflow-wrap: anywhere;
            }
            .message.buddy {
                background: #fff;
                border: 1px solid #dce6ee;
                color: #202c38;
                align-self: flex-start;
                border-bottom-left-radius: 4px;
            }
            .message.user { background: #0076a9; color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; }
            .message.error { background: #fff0ef; color: #8c1d18; border: 1px solid #f0c8c5; align-self: stretch; max-width: 100%; }
            .msg-content p { margin: 0 0 8px; }
            .msg-content p:last-child { margin-bottom: 0; }
            .msg-content pre { white-space: pre-wrap; background: #0d2238; color: #e8f3fa; border-radius: 8px; padding: 10px; }
            .msg-content code { background: rgba(0,0,0,0.07); border-radius: 4px; padding: 2px 4px; }

            .panel-footer {
                padding-top: 12px;
                border-top: 1px solid #dce6ee;
            }
            .ai-compose-row { display: flex; align-items: stretch; gap: 9px; }
            #ai-input {
                min-width: 0;
                flex: 1;
                min-height: 46px;
                padding: 10px 14px;
                border: 1px solid #bfcdd8;
                border-radius: 12px;
                outline: none;
                background: #fff;
            }
            #btn-send { width: 48px; height: 46px; padding: 11px; border: 0; color: #fff; background: linear-gradient(145deg, #009ee3, #0076a9); box-shadow: 0 5px 12px rgba(0,118,169,0.22); }
            #btn-send:hover { color: #fff; background: #006c9b; }
            #btn-send:disabled { opacity: 0.55; cursor: wait; transform: none; }
            .ai-footer-actions { min-height: 46px; display: flex; align-items: center; gap: 10px; margin-top: 8px; }
            #btn-clear-chat { width: 42px; height: 42px; color: #b54a42; background: #fff; }
            #ai-request-status { color: #52677b; font-size: 0.82rem; }
            .ai-char-hint { margin-left: auto; color: #7b8c9b; font-size: 0.7rem; }
            @media (max-width: 760px) {
                .sidebar-panel { width: 100vw; right: -101vw; }
                #ai-model-badge { max-width: 180px; }
            }
        `;
        document.head.appendChild(style);
    }
    return { init: init };
});
