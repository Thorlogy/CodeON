#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourceControllerPath = path.join(root, 'OpenRobertaServer/staticResources/js/app/roberta/controller/aiHelper.controller.js');
const runtimeControllerPath = path.join(root, 'application/staticResources/js/app/roberta/controller/aiHelper.controller.js');
const sourceThemePath = path.join(root, 'OpenRobertaServer/staticResources/js/creators_theme.js');
const runtimeThemePath = path.join(root, 'application/staticResources/js/creators_theme.js');
const sourceIndexPath = path.join(root, 'OpenRobertaServer/staticResources/index.html');
const runtimeIndexPath = path.join(root, 'application/staticResources/index.html');
const sourceMainPath = path.join(root, 'OpenRobertaServer/staticResources/js/main.js');
const runtimeMainPath = path.join(root, 'application/staticResources/js/main.js');
const sourceManifestPath = path.join(root, 'OpenRobertaServer/staticResources/manifest.webapp.json');
const runtimeManifestPath = path.join(root, 'application/staticResources/manifest.webapp.json');
const sourceIconPath = path.join(root, 'OpenRobertaServer/staticResources/css/img/codeon-favicon.svg');
const runtimeIconPath = path.join(root, 'application/staticResources/css/img/codeon-favicon.svg');

const sourceController = fs.readFileSync(sourceControllerPath, 'utf8');
const runtimeController = fs.readFileSync(runtimeControllerPath, 'utf8');
const sourceTheme = fs.readFileSync(sourceThemePath, 'utf8');
const runtimeTheme = fs.readFileSync(runtimeThemePath, 'utf8');
const sourceIndex = fs.readFileSync(sourceIndexPath, 'utf8');
const runtimeIndex = fs.readFileSync(runtimeIndexPath, 'utf8');
const sourceMain = fs.readFileSync(sourceMainPath, 'utf8');
const runtimeMain = fs.readFileSync(runtimeMainPath, 'utf8');
const sourceManifest = fs.readFileSync(sourceManifestPath, 'utf8');
const runtimeManifest = fs.readFileSync(runtimeManifestPath, 'utf8');

assert.strictEqual(sourceController, runtimeController, 'Code-Buddy-Quell- und Laufzeitcontroller unterscheiden sich.');
assert.strictEqual(sourceTheme, runtimeTheme, 'Code-Buddy-Quell- und Laufzeittheme unterscheiden sich.');
assert.strictEqual(sourceIndex, runtimeIndex, 'Quell- und Laufzeitindex unterscheiden sich.');
assert.strictEqual(sourceMain, runtimeMain, 'Quell- und Laufzeit-RequireJS-Konfiguration unterscheiden sich.');
assert.strictEqual(sourceManifest, runtimeManifest, 'Quell- und Laufzeitmanifest unterscheiden sich.');
assert.strictEqual(fs.readFileSync(sourceIconPath, 'utf8'), fs.readFileSync(runtimeIconPath, 'utf8'), 'Quell- und Laufzeitfavicon unterscheiden sich.');

[
    "sessionStorage.getItem(KEY_SESSION_PREFIX + providerId)",
    "sessionStorage.setItem(KEY_SESSION_PREFIX + providerId, key)",
    "localStorage.removeItem('gemini_api_key')",
    "OLLAMA_BASE_URL = 'http://127.0.0.1:11434'",
    "fetchJson(OLLAMA_BASE_URL + '/api/tags'",
    "fetchJson(OLLAMA_BASE_URL + '/api/chat'",
    "fetchJson('https://openrouter.ai/api/v1/models'",
    "https://api.openai.com/v1/chat/completions",
    "https://api.anthropic.com/v1/messages",
    "https://api.mistral.ai/v1/chat/completions",
    "https://generativelanguage.googleapis.com/v1beta/models/",
    "https://openrouter.ai/api/v1/chat/completions",
    "'Authorization': 'Bearer ' + key",
    "payload.provider = { data_collection: 'deny', zdr:",
    "'x-goog-api-key': key",
    "'x-api-key': key",
    "'anthropic-dangerous-direct-browser-access': 'true'",
    'var MAX_MESSAGE_LENGTH = 4000',
    'var MAX_CONTEXT_LENGTH = 7000',
    "$content.text(text)",
    "label: 'Ollama (lokal)'",
    "label: 'Google Gemini'",
    "label: 'OpenAI / GPT'",
    "label: 'Anthropic / Claude'",
    "label: 'Mistral AI'",
    "label: 'OpenRouter (viele Anbieter)'"
].forEach((feature) => assert.ok(sourceController.includes(feature), 'Sicherheits- oder Modellmerkmal fehlt: ' + feature));

[
    'corsproxy.io',
    ':generateContent?key=',
    'localStorage.setItem("gemini_api_key"',
    'localStorage.setItem(\'gemini_api_key\'',
    'console.log(key)',
    'console.error(key)'
].forEach((forbidden) => assert.ok(!sourceController.includes(forbidden), 'Verbotener Credential-Pfad gefunden: ' + forbidden));

assert.ok(sourceTheme.includes('.ai-icon-button'), 'Große, zugängliche Code-Buddy-Iconbuttons fehlen.');
assert.ok(sourceTheme.includes('#btn-clear-chat { width: 42px; height: 42px;'), 'Der Löschbutton ist nicht ausreichend groß.');
assert.ok(sourceTheme.includes('#btn-send { width: 48px; height: 46px;'), 'Der Sendebutton ist nicht ausreichend groß.');
assert.ok(sourceIndex.includes("codeon-favicon.svg?v=20260715"), 'Das CodeON-Favicon fehlt im Index.');
const indexCacheVersion = sourceIndex.match(/var require = \{ urlArgs: 'v=([^']+)' \}/);
const mainCacheVersion = sourceMain.match(/urlArgs: 'v=([^']+)'/);
assert.ok(indexCacheVersion && /^codeon-[a-z0-9-]+$/.test(indexCacheVersion[1]), 'Der Index braucht eine gültige CodeON-Cacheversion.');
assert.ok(mainCacheVersion && /^codeon-[a-z0-9-]+$/.test(mainCacheVersion[1]), 'RequireJS braucht eine gültige CodeON-Cacheversion.');
assert.ok(sourceMain.includes("'aiHelper.controller': 'js/app/roberta/controller/aiHelper.controller'"), 'Der Code-Buddy-Controller fehlt in RequireJS.');
assert.strictEqual(JSON.parse(sourceManifest).short_name, 'CodeON', 'Das Web-App-Manifest ist nicht auf CodeON umgestellt.');

console.log('CodeON-Code-Buddy-Sicherheitsprüfung erfolgreich.');
