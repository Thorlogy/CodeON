const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('OpenRobertaServer/staticResources/index.html');
assert.equal(html, read('application/staticResources/index.html'));
assert.match(html, /id='head-navigation-robot-status'/);
assert.match(html, /lkey='Blockly.Msg.MENU_ROBOT_STATUS'/);
for (const id of ['head-navigation-gallery', 'tabGalleryList', 'galleryList', 'share-with-gallery']) {
    assert.ok(!html.includes("id='" + id + "'"), id + ' must not be exposed');
}
assert.doesNotMatch(read('OpenRobertaWeb/src/main.js'), /galleryListController\.init\(/);
assert.doesNotMatch(read('OpenRobertaWeb/src/app/roberta/controller/menu.controller.ts'), /tabGalleryList|head-navigation-gallery/);
assert.doesNotMatch(read('OpenRobertaWeb/src/app/roberta/controller/progList.controller.ts'), /class="gallery|click \.gallery|share-with-gallery/);
assert.doesNotMatch(read('OpenRobertaWeb/src/app/roberta/controller/guiState.controller.js'), /GALLERYLIST_C_switchLanguage/);
const behaviour = read('OpenRobertaWeb/src/app/nepostackmachine/interpreter.robotBridgeBehaviour.ts');
const toggle = behaviour.slice(behaviour.indexOf('public static toggleStatus('), behaviour.indexOf('private readonly maxWheelSpeed'));
assert.doesNotMatch(toggle, /\.command\(|\.sensor\(|\.open\(|connectBridge|new RobotBridge/);
assert.match(behaviour, /panel.hidden = !RobotBridgeBehaviour.statusVisible/);
for (const file of [
    'main.js',
    'app/nepostackmachine/interpreter.robotBridgeBehaviour.js',
    'app/roberta/controller/connection.controller.js',
    'app/roberta/controller/menu.controller.js',
    'app/roberta/controller/guiState.controller.js',
    'app/roberta/controller/progList.controller.js',
]) {
    assert.equal(read('OpenRobertaServer/staticResources/js/' + file), read('application/staticResources/js/' + file), file);
}
for (const language of ['de', 'en']) {
    const file = 'blockly/msg/js/' + language + '.js';
    assert.equal(read('OpenRobertaServer/staticResources/' + file), read('application/staticResources/' + file));
    assert.match(read('OpenRobertaServer/staticResources/' + file), /MENU_ROBOT_STATUS/);
}
console.log('Robot status menu and gallery-removal checks passed.');
