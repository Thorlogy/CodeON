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

    def test_rcx_background_is_shipped_in_application(self):
        source = ROOT / "OpenRobertaServer/staticResources/css/img/rcxBackground.jpg"
        runtime = ROOT / "application/staticResources/css/img/rcxBackground.jpg"
        self.assertEqual(source.read_bytes(), runtime.read_bytes())


if __name__ == "__main__":
    unittest.main()
