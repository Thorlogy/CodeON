define(['jquery'], function ($) {
    function init() {
        console.log("Initializing Creators Theme (Blue + Create Logo)");

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

            /* AI Buddy Sidebar Button */
            #ai-buddy-btn-sidebar {
                background-color: #f0ad4e !important; /* Orange from screen */
                color: white !important;
                border-radius: 4px;
                margin-top: 5px;
                cursor: pointer;
                transition: transform 0.2s;
            }
            #ai-buddy-btn-sidebar:hover { transform: scale(1.1); }
            #ai-buddy-btn-sidebar.active { box-shadow: 0 0 10px #f0ad4e; }

            /* AI Buddy Sliding Panel */
            .sidebar-panel {
                position: fixed;
                top: 0;
                right: -510px;
                width: 500px;
                height: 100vh;
                background: white;
                box-shadow: -5px 0 15px rgba(0,0,0,0.1);
                z-index: 1050;
                transition: right 0.3s ease-in-out;
                display: flex;
                flex-direction: column;
                font-family: 'Inter', sans-serif;
            }
            .sidebar-panel.active { right: 0; }

            /* Sidebar Synchronization */
            #rightMenuDiv, #sliderBorder {
                transition: right 0.3s ease-in-out !important;
            }
            body.ai-buddy-active #rightMenuDiv,
            body.ai-buddy-active #sliderBorder {
                right: 500px !important;
            }

            .panel-header {
                padding: 15px 20px;
                background: #f8f9fa;
                border-bottom: 1px solid #eee;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .panel-header h3 { margin: 0; font-size: 1.2rem; font-weight: 600; }
            .close-panel { cursor: pointer; font-size: 1.5rem; opacity: 0.5; }
            .close-panel:hover { opacity: 1; }

            .panel-content {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                background: #fff;
            }
            .chat-area { display: flex; flex-direction: column; gap: 15px; }
            .message {
                max-width: 85%;
                padding: 12px 16px;
                border-radius: 12px;
                line-height: 1.5;
                font-size: 0.95rem;
            }
            .message.buddy {
                background: #f1f3f4;
                color: #202124;
                align-self: flex-start;
                border-bottom-left-radius: 2px;
            }

            .panel-footer {
                padding: 15px;
                background: #fff;
                border-top: 1px solid #eee;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            #ai-input {
                width: 100%;
                padding: 10px 15px;
                border: 1px solid #ddd;
                border-radius: 24px;
                outline: none;
                background: #f8f9fa;
            }
            .footer-icons {
                display: flex;
                gap: 15px;
                padding: 0 10px;
                color: #f0ad4e;
                font-size: 1.2rem;
            }
            .footer-icons .send-btn { margin-left: auto; cursor: pointer; }
        `;
        document.head.appendChild(style);
    }
    return { init: init };
});
