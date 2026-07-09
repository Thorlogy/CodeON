const fs = require('fs');
let content = fs.readFileSync('OpenRobertaServer/staticResources/js/main.js', 'utf8');
content = content.replace(
    "var blocklySelector = '.blocklySvg, .blocklyToolboxDiv, .blocklyTreeRow';",
    "var blocklySelector = '.blocklySvg, .blocklyToolboxDiv, .blocklyTreeRow, .blocklyBlockDragSurface, .blocklyWidgetDiv, .blocklyTooltipDiv, .blocklyDragSurface';"
);
fs.writeFileSync('OpenRobertaServer/staticResources/js/main.js', content);
