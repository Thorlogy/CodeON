define(["require", "exports", "message", "util.roberta", "guiState.controller", "program.model", "program.controller", "progRun.controller", "import.controller", "blockly", "jquery", "aceEditor"], (function (o, e, t, r, i, n, a, d, c, u, s, l) {
    var currentTemplate = null;
    var isSplitView = false;

    function g(o) {
        // Force close any old right view (legacy code)
        if (s("#blocklyDiv").hasClass("rightActive")) {
            s("#blocklyDiv").closeRightView();
        }

        if (!isSplitView) {
            toggleSplitView(true);
        } else {
            // If already in split view, and this was triggered by button (o=true), close it.
            if (o === true) {
                toggleSplitView(false);
                return;
            }
        }

        var e = i.getBlocklyWorkspace(), r = u.Xml.workspaceToDom(e), d = u.Xml.domToText(r), c = !i.isConfigurationStandard() && !i.isConfigurationAnonymous() ? i.getConfigurationName() : void 0, g = i.isConfigurationAnonymous() ? i.getConfigurationXML() : void 0, m = i.getLanguage();
        n.showSourceProgram(i.getProgramName(), c, d, g, a.getSSID(), a.getPassword(), m, (function (e) {
            a.reloadProgram(e);
            "ok" == e.rc ? (
                // CHANGED: Do NOT call tabWrapShow here if in split view
                // o && s("#tabSourceCodeEditor").tabWrapShow(), 
                i.setState(e),
                l.setEditorCode(e.sourceCode)
            ) : t.displayInformation(e, e.message, e.message, e.parameters)
        }))
    }

    function toggleSplitView(enable) {
        isSplitView = enable;
        var $body = s("body");
        var $pane = s("#sourceCodeEditorPane");
        var $prog = s("#tabProgram");

        if (enable) {
            // Animation Prep
            $pane.css({
                "display": "block",
                "width": "0%",
                "opacity": "0"
            });

            // Force reflow to ensure transition processes
            $pane[0].offsetHeight;

            $body.addClass("split-view-active");

            // Allow CSS to take over for final state (width: 50%, opacity: 1)
            // We clear inline styles after a slight delay or rely on !important in CSS
            // but !important in CSS overrides inline style width, so simply adding the class triggers it.
            // However, we set width 0 inline, which might have specificity issues vs CSS not having !important on width?
            // In my CSS I put width: 50%. ID selector + Class has high specificity.
            // Element style (inline) has higher specificity than ID+Class.
            // So we must remove the inline style to let CSS take over, BUT we need the transition.

            // Let's rely on the class adding the "target" state.
            // To ensure transition, we should set the "start" state via inline, then "end" state via inline or class.

            $pane.css("width", "40%").css("opacity", "1");

            // Ensure tabProgram is active 
            s("#tabProgram").tabWrapShow();

            // Resize events after animation
            setTimeout(function () {
                Blockly.svgResize(i.getBlocklyWorkspace());
                if (l.resize) {
                    l.resize();
                }
                // Clear inline styles so CSS resizing (e.g. window resize) continues to work if we used percentages
                $pane.css({ "width": "", "opacity": "", "display": "" });
            }, 500); // Match CSS transition time
        } else {
            // Animate out
            // Set current state explicitly to ensure transition from 40 -> 0
            $pane.css({ "width": "40%", "opacity": "1", "display": "block" });
            $pane[0].offsetHeight; // Reflow

            $body.removeClass("split-view-active");
            $pane.css({ "width": "0%", "opacity": "0" });

            setTimeout(function () {
                $pane.css({ "width": "", "opacity": "", "display": "" }); // Reset to default (hidden via bootstrap fade)
                Blockly.svgResize(i.getBlocklyWorkspace());
            }, 500); // Match CSS transition time
        }
    }

    Object.defineProperty(e, "__esModule", { value: !0 }), e.clickSourceCodeEditor = e.init = void 0, e.init = function () {
        // Debug check removed to fix ReferenceError

        // --- Template Integration Removed ---




        s("#backSourceCodeEditor").onWrap("click", (function () {
            // If in split view, this button acts as "Close Split View"
            if (isSplitView) {
                toggleSplitView(false);
                return false;
            }
            return l.wasEditedByUser() ? (s("#show-message-confirm").oneWrap("shown.bs.modal", (function () { s("#confirm").off(), s("#confirm").on("click", (function (o) { o.preventDefault(), l.setWasEditedByUser(!1), s("#tabProgram").tabWrapShow() })), s("#confirmCancel").off(), s("#confirmCancel").on("click", (function (o) { o.preventDefault(), s(".modal").modal("hide") })) })), t.displayMessage("SOURCE_CODE_EDITOR_CLOSE_CONFIRMATION", "POPUP", "", !0, !1)) : (l.setWasEditedByUser(!1), s("#tabProgram").tabWrapShow()), !1
        }), "back to previous view"), s("#runSourceCodeEditor").onWrap("click", (function () { return d.runNative(l.getEditorCode()), !1 }), "run button clicked"), s("#buildSourceCodeEditor").onWrap("click", (function () { return i.setRunEnabled(!1), s("#buildSourceCodeEditor").addClass("disabled"), n.compileN(i.getProgramName(), l.getEditorCode(), i.getLanguage(), (function (o) { "ok" == o.rc ? t.displayMessage(o.message, "POPUP", "", !1, !1) : t.displayInformation(o, o.message, o.message, i.getProgramName()), i.setRunEnabled(!0), s("#buildSourceCodeEditor").removeClass("disabled") })), !1 }), "build button clicked"), s("#downloadSourceCodeEditor").onWrap("click", (function () { var o = i.getProgramName() + "." + i.getSourceCodeFileExtension(); return r.download(o, l.getEditorCode()), t.displayMessage("MENU_MESSAGE_DOWNLOAD", "TOAST", o), !1 }), "download source code button clicked"), s("#uploadSourceCodeEditor").onWrap("click", (function () { return c.importSourceCode((function (o, e) { l.setEditorCode(e) })), !1 }), "upload source code button clicked"),
            s("#importSourceCodeEditor").off("click"),
            s("#importSourceCodeEditor").onWrap("click", (function () {
                console.log("Import Source Code Editor clicked");
                return g(!1), !1
            }), "import from blockly button clicked"), s("#tabSourceCodeEditor").onWrap("show.bs.tab", (function () { "python" !== l.getCurrentLanguage() && "json" !== l.getCurrentLanguage() || s("#buildSourceCodeEditor").addClass("disabled"), s("#main-section").css("background-color", "#EEE") }), "in show source code aceEditorController"), s("#tabSourceCodeEditor").onWrap("shown.bs.tab", (function () { i.setView("tabSourceCodeEditor") }), "after show source code aceEditorController"), s("#tabSourceCodeEditor").on("hide.bs.tab", (function () { s("#buildSourceCodeEditor").removeClass("disabled"), s("#main-section").css("background-color", "#FFF") })), s("#sourceCodeEditorPane").find('button[name="rightMostButton"]').attr("title", "").attr("rel", "tooltip").attr("data-bs-placement", "left").attr("lkey", "Blockly.Msg.SOURCE_CODE_EDITOR_IMPORT_TOOLTIP").attr("data-bs-original-title", u.Msg.SOURCE_CODE_EDITOR_IMPORT_TOOLTIP).tooltip("_fixTitle");

        // Hijack the main view switcher button
        s("#codeButton").off("click touchend");
        s("#codeButton").onWrap("click touchend", function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            g(true); // Toggle Split View
            return false;
        }, "toggle split view from main button");
    }, e.clickSourceCodeEditor = function () { g(!0) }
}));
//# sourceMappingURL=sourceCodeEditor.controller.js.map
//# sourceMappingURL=sourceCodeEditor.controller.js.map
