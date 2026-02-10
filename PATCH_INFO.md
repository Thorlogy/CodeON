# Patch Information: interaction_fix_clean.patch

This patch file fixes two critical interaction issues in the Open Roberta Lab:
1.  **Robot Selection Overlay**: Fixes the issue where multiple clicks were required to select a robot due to invisible overlays from inactive tabs.
2.  **Drag and Drop Failure**: Restores drag-and-drop functionality for Blockly blocks by enabling a pointer-to-mouse event proxy required for older Blockly versions.

## Files Modified
- `OpenRobertaServer/staticResources/css/roberta.css`: Added CSS to hide inactive tab panes (`.tab-pane:not(.active) { display: none !important; }`).
- `OpenRobertaServer/staticResources/js/main.js`: Uncommented/Enabled the "ANTIGRAVITY PATCH" to proxy pointer events.

## How to Apply
To apply this patch to your source code, run the following command from this directory:

```bash
git apply interaction_fix_clean.patch
```

Or if you want to see the changes without applying them:

```bash
git apply --stat interaction_fix_clean.patch
```
