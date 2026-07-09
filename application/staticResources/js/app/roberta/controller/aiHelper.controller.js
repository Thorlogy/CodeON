/**
 * @fileOverview Helper for AI integration (Code Buddy & Missions).
 * @author (User/Gemini)
 */
define(['jquery', 'comm', 'message', 'log', 'util.roberta', 'guiState.controller', 'program.controller', 'blockly'], function ($, COMM, MSG, LOG, UTIL, GUI, PROG, Blockly) {

    var DEFAULT_MODEL = 'gemini-2.0-flash';

    function init() {
        console.log("AI Helper initialized");
        injectSidebarButton();
        injectPanel();

        // Coordinate with standard right views using capture phase to bypass stopPropagation
        document.addEventListener('click', function (event) {
            var $target = $(event.target).closest('#simButton, #simDebugButton, #codeButton');
            if ($target.length > 0) {
                togglePanel(false);
            }
        }, true);
    }

    function injectSidebarButton() {
        if ($('#ai-buddy-btn-sidebar').length === 0) {
            var $buddyBtn = $('<div id="ai-buddy-btn-sidebar" class="rightMenuButton" rel="tooltip" title="Code Buddy">' +
                '<span class="typcn typcn-flash"></span>' +
                '</div>');
            $('#rightMenuDiv').append($buddyBtn);

            $buddyBtn.on('click', function () {
                togglePanel();
            });
        }

        // 2. Remove old navbar button if exists
        $('#ai-buddy-btn').remove();
    }

    function injectPanel() {
        if ($('#ai-buddy-panel').length === 0) {
            var apiKey = localStorage.getItem("gemini_api_key") || "";
            var selectedModel = localStorage.getItem("gemini_model") || DEFAULT_MODEL;
            var setupStyle = apiKey ? 'display:none;' : 'display:block;';
            var chatStyle = apiKey ? 'display:flex;' : 'display:none;';

            $('body').append(
                '<div id="ai-buddy-panel" class="sidebar-panel">' +
                '  <div class="panel-header">' +
                '    <h3>Code Buddy 🤖</h3>' +
                '    <div class="header-tools">' +
                '      <span class="typcn typcn-cog settings-toggle" title="Einstellungen"></span>' +
                '      <span class="typcn typcn-times close-panel" title="Schließen"></span>' +
                '    </div>' +
                '  </div>' +
                '  <div class="panel-content">' +
                '    <div id="ai-setup" style="' + setupStyle + '">' +
                '       <p>Gib deinen Gemini API-Key ein, um zu starten:</p>' +
                '       <input type="password" id="ai-key-input" class="form-control" value="' + apiKey + '" placeholder="API Key...">' +
                '       <button id="btn-save-key" class="btn btn-primary" style="margin-top:10px; width:100%;">Verbinden</button>' +
                '       <p style="font-size:10px; color:#888; margin-top:10px;">Der Key wird nur lokal in deinem Browser gespeichert.</p>' +
                '    </div>' +
                '    <div id="ai-settings" style="display:none; padding: 15px;">' +
                '       <h4 style="margin-top:0;">Einstellungen</h4>' +
                '       <div class="form-group">' +
                '         <label>API-Key:</label>' +
                '         <input type="password" id="settings-key-input" class="form-control" value="' + apiKey + '">' +
                '       </div>' +
                '       <div class="form-group" style="margin-top:15px;">' +
                '         <label>Modell:</label>' +
                '         <select id="settings-model-select" class="form-control">' +
                '           <option value="gemini-2.0-flash">Gemini 2.0 Flash (Schnell)</option>' +
                '           <option value="gemini-2.5-flash">Gemini 2.5 Flash (Empfohlen)</option>' +
                '           <option value="gemini-2.0-pro">Gemini 2.0 Pro (Intelligent)</option>' +
                '           <option value="gemini-1.5-flash">Gemini 1.5 Flash (Legacy)</option>' +
                '         </select>' +
                '       </div>' +
                '       <button id="btn-save-settings" class="btn btn-success" style="margin-top:20px; width:100%;">Speichern</button>' +
                '       <button id="btn-cancel-settings" class="btn btn-default" style="margin-top:10px; width:100%;">Abbrechen</button>' +
                '    </div>' +
                '    <div id="ai-chat" style="' + chatStyle + '; height: 100%; flex-direction: column;">' +
                '        <div class="chat-area" id="ai-chat-area">' +
                '          <div class="message buddy">' +
                '            <p>Hallo! Ich bin dein AI Code Buddy. ✨ Wie kann ich dir heute beim Programmieren helfen?</p>' +
                '          </div>' +
                '        </div>' +
                '        <div class="panel-footer">' +
                '          <input type="text" placeholder="Nachricht..." id="ai-input">' +
                '          <div class="footer-icons">' +
                '            <span class="typcn typcn-trash" id="btn-clear-chat" title="Chat leeren"></span>' +
                '            <span class="typcn typcn-location-arrow send-btn" id="btn-send"></span>' +
                '          </div>' +
                '        </div>' +
                '    </div>' +
                '  </div>' +
                '</div>'
            );

            $('#settings-model-select').val(selectedModel);

            $('.close-panel').on('click', function () {
                togglePanel(false);
            });

            $('.settings-toggle').on('click', function () {
                $('#ai-chat').hide();
                $('#ai-setup').hide();
                $('#ai-settings').show();
            });

            $('#btn-save-settings').on('click', function () {
                var key = $('#settings-key-input').val().trim();
                var model = $('#settings-model-select').val();
                localStorage.setItem("gemini_api_key", key);
                localStorage.setItem("gemini_model", model);
                $('#ai-key-input').val(key);
                $('#ai-settings').hide();
                if (key) {
                    $('#ai-chat').css('display', 'flex');
                } else {
                    $('#ai-setup').show();
                }
            });

            $('#btn-cancel-settings').on('click', function () {
                $('#ai-settings').hide();
                if (localStorage.getItem("gemini_api_key")) {
                    $('#ai-chat').css('display', 'flex');
                } else {
                    $('#ai-setup').show();
                }
            });

            $('#btn-save-key').on('click', function () {
                var key = $('#ai-key-input').val().trim();
                if (key) {
                    localStorage.setItem("gemini_api_key", key);
                    $('#settings-key-input').val(key);
                    $('#ai-setup').hide();
                    $('#ai-chat').css('display', 'flex');
                }
            });

            $('#btn-clear-chat').on('click', function () {
                if (confirm("Möchtest du den Chat wirklich leeren?")) {
                    $('#ai-chat-area').html('<div class="message buddy"><p>Hallo! Ich bin dein AI Code Buddy. ✨ Wie kann ich dir heute beim Programmieren helfen?</p></div>');
                }
            });

            $('#btn-send').on('click', function () {
                sendMessage();
            });

            $('#ai-input').on('keypress', function (e) {
                if (e.which == 13) sendMessage();
            });
        }
    }

    function sendMessage() {
        var txt = $('#ai-input').val().trim();
        if (txt) {
            addChat("user", txt);
            $('#ai-input').val('');
            callGemini(txt);
        }
    }

    function addChat(role, text) {
        var buddyClass = role === 'user' ? 'user' : 'buddy';
        var name = role === 'user' ? 'Du' : 'Buddy';
        var formattedText = role === 'user' ? text : formatMessage(text);
        var $msg = $('<div class="message ' + buddyClass + '"><div class="msg-content">' + formattedText + '</div></div>');
        $('#ai-chat-area').append($msg);
        var d = $('#ai-chat-area');
        if (d.length > 0) {
            d.scrollTop(d[0].scrollHeight);
        }
    }

    function formatMessage(text) {
        if (!text) return "";

        // Escape HTML
        text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // Code blocks
        text = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

        // Inline code
        text = text.replace(/`([^`]+)`/g, '<code style="background:#eee; padding:2px 4px; border-radius:3px; font-family:monospace;">$1</code>');

        // Bold
        text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Italic
        text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // Lists
        var lines = text.split('\n');
        var output = [];
        var inList = false;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.trim().match(/^[\-\*]\s/)) {
                if (!inList) {
                    output.push('<ul>');
                    inList = true;
                }
                output.push('<li>' + line.trim().substring(2) + '</li>');
            } else {
                if (inList) {
                    output.push('</ul>');
                    inList = false;
                }
                if (line.trim().length > 0) {
                    output.push(line + '<br>');
                }
            }
        }
        if (inList) output.push('</ul>');

        return output.join('');
    }

    function getWorkspaceContext() {
        try {
            var workspace = GUI.getBlocklyWorkspace();
            if (!workspace) return "No workspace found.";
            var blocks = workspace.getAllBlocks();
            if (blocks.length === 0) return "The programming stage is currently empty.";

            var context = "Current blocks on the stage:\n";
            blocks.forEach(function (block) {
                if (block.type === 'robControls_start') return;
                context += "- " + block.type;
                var values = [];
                block.inputList.forEach(function (input) {
                    input.fieldRow.forEach(function (field) {
                        if (field.getValue) {
                            var val = field.getValue();
                            if (val !== null && val !== undefined && val !== "") {
                                values.push(field.name + ": " + val);
                            }
                        }
                    });
                });
                if (values.length > 0) {
                    context += " (" + values.join(", ") + ")";
                }
                context += "\n";
            });
            return context;
        } catch (e) {
            console.error("Error scanning workspace", e);
            return "Error scanning workspace.";
        }
    }

    function callGemini(userText) {
        var key = localStorage.getItem("gemini_api_key");
        var model = localStorage.getItem("gemini_model") || DEFAULT_MODEL;

        if (!key) {
            addChat("System", "Bitte konfiguriere zuerst deinen API-Key.");
            return;
        }

        var systemInstruction = "Du bist der 'AI Code Buddy' im Open Roberta Lab. Deine Aufgabe ist es, Schülerinnen und Schülern (ab 10 Jahren) beim Programmieren zu helfen. " +
            "Antworte immer freundlich, motivierend und in einfacher, verständlicher deutscher Sprache. " +
            "Fasse dich kurz und komm schnell auf den Punkt. Nutze Formatierungen wie Absätze und Aufzählungszeichen (Bullet Points), um deine Erklärungen übersichtlich zu gestalten. Vermeide lange Fließtexte. " +
            "Gib hilfreiche Tipps und erkläre Konzepte kindgerecht, anstatt sofort die gesamte Lösung zu verraten. Ermutige sie zum Ausprobieren! " +
            "Du siehst unten den aktuellen Stand ihrer Blöcke auf der Bühne.";

        var context = getWorkspaceContext();
        var fullPrompt = systemInstruction + "\n\n" + context + "\n\nNachricht des Kindes: " + userText;

        var url = "https://generativelanguage.googleapis.com/v1/models/" + model + ":generateContent?key=" + key;
        var proxy = "https://corsproxy.io/?" + encodeURIComponent(url);

        var data = {
            contents: [{
                parts: [{
                    text: fullPrompt
                }]
            }]
        };

        fetch(proxy, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
            .then(r => r.json())
            .then(json => {
                if (json.error) throw new Error(json.error.message);
                var reply = json.candidates && json.candidates[0] && json.candidates[0].content ? json.candidates[0].content.parts[0].text : "(Keine Antwort vom Model erhalten)";
                addChat("Buddy", reply);
            })
            .catch(err => {
                addChat("Error", "Fehler: " + err.message);
            });
    }

    function togglePanel(show) {
        var $panel = $('#ai-buddy-panel');
        var $btn = $('#ai-buddy-btn-sidebar');
        var $body = $('body');
        if (show === undefined) {
            show = !$panel.hasClass('active');
        }

        if (show) {
            // Close any standard right views (SIM, Code)
            $('#blocklyDiv').closeRightView();

            $panel.addClass('active');
            $btn.addClass('active');
            $body.addClass('ai-buddy-active');
        } else {
            $panel.removeClass('active');
            $btn.removeClass('active');
            $body.removeClass('ai-buddy-active');
        }
    }

    return {
        init: init
    };
});
