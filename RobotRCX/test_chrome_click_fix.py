#!/usr/bin/env python3
"""Regression checks for the Chrome toolbox/run-button click fix."""

from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class ChromeClickFixTest(unittest.TestCase):
    def test_click_fix_is_shipped_in_both_runtime_trees(self):
        for runtime in ("OpenRobertaServer/staticResources", "application/staticResources"):
            css = (ROOT / runtime / "css/rcx-click-fix.css").read_text(encoding="utf-8")
            index = (ROOT / runtime / "index.html").read_text(encoding="utf-8")
            self.assertIn(".tab-pane:not(.active)", css)
            self.assertIn("display: none !important", css)
            self.assertIn("pointer-events: none !important", css)
            self.assertIn("css/rcx-click-fix.css", index)

    def test_pointer_proxy_does_not_capture_html_toolbox(self):
        for main in ("OpenRobertaWeb/src/main.js", "OpenRobertaServer/staticResources/js/main.js"):
            javascript = (ROOT / main).read_text(encoding="utf-8")
            selector_line = next(line for line in javascript.splitlines() if "var blocklySelector" in line)
            self.assertNotIn("blocklyToolboxDiv", selector_line)
            self.assertNotIn("blocklyTreeRow", selector_line)
            self.assertIn("blocklyFlyout", selector_line)

    def test_rcx_background_uses_the_rcx_brick(self):
        source = ROOT / "OpenRobertaServer/staticResources/css/img/rcx-brick.png"
        runtime = ROOT / "application/staticResources/css/img/rcx-brick.png"
        self.assertEqual(source.read_bytes(), runtime.read_bytes())
        for controller in (
            "OpenRobertaWeb/src/app/roberta/controller/guiState.controller.js",
            "OpenRobertaServer/staticResources/js/app/roberta/controller/guiState.controller.js",
        ):
            javascript = (ROOT / controller).read_text(encoding="utf-8")
            self.assertIn("css/img/rcx-brick.png", javascript)
            self.assertNotIn("system_preview/rcx.jpg", javascript)

        for actuator in (
            "OpenRobertaServer/staticResources/js/app/simulation/simulationLogic/robot.actuators.js",
            "application/staticResources/js/app/simulation/simulationLogic/robot.actuators.js",
        ):
            javascript = (ROOT / actuator).read_text(encoding="utf-8")
            self.assertIn("/css/img/rcx-brick.png", javascript)

    def test_nqc_roundtrip_is_shipped_in_application(self):
        runtime = ROOT / "application/staticResources"
        checks = {
            "js/helper/codeToBlocks.js": ("task main()", "parseNqcBody", "robControls_if"),
            "js/helper/aceEditor.js": ("NQC ↔ Block", "snippet", "${1:SENSOR_1}"),
            "js/app/roberta/controller/progCode.controller.js": ("codeImportToBlocks", "CodeToBlocksConverter", "setViewCode"),
            "js/app/roberta/controller/program.controller.js": ("codeSynchronize", "syncTimeout", "setEditorCode"),
        }
        for relative, markers in checks.items():
            javascript = (runtime / relative).read_text(encoding="utf-8")
            for marker in markers:
                self.assertIn(marker, javascript, f"{marker} fehlt in {relative}")

        for runtime in ("OpenRobertaServer/staticResources", "application/staticResources"):
            index = (ROOT / runtime / "index.html").read_text(encoding="utf-8")
            self.assertNotIn("id='codeImportToBlocks'", index)
            self.assertNotIn("id='codeRun'", index)
            self.assertIn("id='codeSynchronize'", index)


if __name__ == "__main__":
    unittest.main()
