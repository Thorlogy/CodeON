#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const runtimeRoot = path.join(ROOT, 'OpenRobertaServer/staticResources');
const packagedRoot = path.join(ROOT, 'application/staticResources');
const diagnosticsRuntimePath = path.join(runtimeRoot, 'js/app/roberta/models/connectionDiagnostics.js');
const diagnosticsPackagedPath = path.join(packagedRoot, 'js/app/roberta/models/connectionDiagnostics.js');
const bridgeRuntimePath = path.join(runtimeRoot, 'js/app/roberta/models/robotBridge.js');
const bridgePackagedPath = path.join(packagedRoot, 'js/app/roberta/models/robotBridge.js');

function loadAmd(filePath, dependencies = {}, extraSandbox = {}) {
    let moduleExports;
    const sandbox = {
        console,
        Date,
        Map,
        Promise,
        Number,
        String,
        ...extraSandbox,
        define(names, factory) {
            const exports = {};
            const values = names.map((name) => {
                if (name === 'require') return () => { throw new Error('Dynamic loading is not allowed in diagnostics tests.'); };
                if (name === 'exports') return exports;
                if (Object.prototype.hasOwnProperty.call(dependencies, name)) return dependencies[name];
                throw new Error(`Unexpected AMD dependency: ${name}`);
            });
            factory(...values);
            moduleExports = exports;
        },
    };
    vm.runInNewContext(fs.readFileSync(filePath, 'utf8'), sandbox, { filename: filePath });
    assert.ok(moduleExports, `${filePath} must register an AMD module.`);
    return moduleExports;
}

assert.ok(fs.existsSync(diagnosticsRuntimePath), 'The generated diagnostics runtime must exist.');
const diagnostics = loadAmd(diagnosticsRuntimePath);

const genericDisconnected = diagnostics.buildConnectionDiagnosticView(
    {
        connectionKind: 'generic',
        connectionName: 'RcxConnection',
        bridgeState: 'not-applicable',
        robotConnected: false,
        connecting: false,
        retryScheduled: false,
        healthMonitorActive: false,
        heartbeatActive: false,
    },
    'DE',
    'rcx'
);
assert.strictEqual(genericDisconnected.bridgeValue, 'Nicht zutreffend');
assert.match(genericDisconnected.recommendationValue, /Menü „Roboter“/);

const closedCozmo = diagnostics.buildConnectionDiagnosticView(
    {
        connectionKind: 'local-bridge',
        connectionName: 'Cozmo · CodeON Robot Bridge',
        endpoint: 'ws://127.0.0.1:2223',
        bridgeState: 'closed',
        robotConnected: false,
        connecting: false,
        retryScheduled: true,
        healthMonitorActive: false,
        heartbeatActive: false,
    },
    'de',
    'cozmo'
);
assert.strictEqual(closedCozmo.bridgeValue, 'Nicht erreichbar');
assert.match(closedCozmo.recommendationValue, /CodeON-Starten\.command/);
assert.match(closedCozmo.recommendationValue, /127\.0\.0\.1:2223/);

const reachableCozmo = diagnostics.buildConnectionDiagnosticView(
    {
        connectionKind: 'local-bridge',
        connectionName: 'Cozmo · CodeON Robot Bridge',
        endpoint: 'ws://127.0.0.1:2223',
        bridgeState: 'open',
        robotConnected: false,
        connecting: false,
        retryScheduled: false,
        healthMonitorActive: true,
        heartbeatActive: false,
        lastResponseAt: Date.now(),
    },
    'de',
    'cozmo'
);
assert.match(reachableCozmo.recommendationValue, /WLAN/);

const connectedApitor = diagnostics.buildConnectionDiagnosticView(
    {
        connectionKind: 'local-bridge',
        connectionName: 'Apitor Robot X · CodeON Robot Bridge',
        endpoint: 'ws://127.0.0.1:2224',
        bridgeState: 'open',
        robotConnected: true,
        connecting: false,
        retryScheduled: false,
        healthMonitorActive: false,
        heartbeatActive: true,
        lastResponseAt: Date.now(),
        lastHeartbeatAt: Date.now(),
        lastError: { code: 'OLD_ERROR', message: '<script>\n'.repeat(100), at: Date.now() },
    },
    'en',
    'apitor'
);
assert.strictEqual(connectedApitor.robotValue, 'Connected');
assert.match(connectedApitor.recommendationValue, /No action is required/);
assert.ok(connectedApitor.errorValue.length < 340, 'Displayed diagnostics errors must remain bounded.');
assert.doesNotMatch(connectedApitor.errorValue, /\n/, 'Control characters must be removed from diagnostics output.');

class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    static instances = [];
    constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        FakeWebSocket.instances.push(this);
    }
    send(message) {
        this.sent.push(JSON.parse(message));
    }
    open() {
        this.readyState = 1;
        this.onopen();
    }
    respond(id, result) {
        this.onmessage({ data: JSON.stringify({ id, ok: true, result }) });
    }
    reject(id, code, message) {
        this.onmessage({ data: JSON.stringify({ id, ok: false, error: { code, message } }) });
    }
    close() {
        this.readyState = 3;
        this.onclose();
    }
}

let timerSequence = 0;
const intervals = new Map();
const fakeWindow = {
    setTimeout() {
        return ++timerSequence;
    },
    clearTimeout() {},
    setInterval(callback) {
        const id = ++timerSequence;
        intervals.set(id, callback);
        return id;
    },
    clearInterval(id) {
        intervals.delete(id);
    },
};

const bridgeModule = loadAmd(bridgeRuntimePath, { connectionDiagnostics: diagnostics }, { window: fakeWindow, WebSocket: FakeWebSocket });

(async () => {
    const client = new bridgeModule.RobotBridgeClient('ws://127.0.0.1:2299', 3000, 400);
    assert.strictEqual(client.getDiagnostics().bridgeState, 'closed');
    const opening = client.open();
    const socket = FakeWebSocket.instances[0];
    assert.strictEqual(client.getDiagnostics().bridgeState, 'connecting');
    socket.open();
    await opening;
    assert.strictEqual(client.getDiagnostics().bridgeState, 'open');

    const statusPromise = client.status();
    const statusRequest = socket.sent.pop();
    socket.respond(statusRequest.id, { connected: true, robot: 'test' });
    await statusPromise;
    assert.ok(client.getDiagnostics().lastResponseAt > 0);

    const commandPromise = client.command('drive', { speed: 20 });
    const commandRequest = socket.sent.pop();
    socket.respond(commandRequest.id, {});
    await commandPromise;
    assert.strictEqual(client.getDiagnostics().heartbeatActive, true);

    const heartbeatCallback = Array.from(intervals.values())[0];
    heartbeatCallback();
    const heartbeatRequest = socket.sent.pop();
    assert.strictEqual(heartbeatRequest.type, 'heartbeat');
    socket.respond(heartbeatRequest.id, {});
    await Promise.resolve();
    assert.ok(client.getDiagnostics().lastHeartbeatAt > 0);

    const failingStatus = client.status();
    const failingRequest = socket.sent.pop();
    socket.reject(failingRequest.id, 'TEST_ERROR', 'bounded failure');
    await assert.rejects(failingStatus, /bounded failure/);
    assert.strictEqual(client.getDiagnostics().lastError.code, 'TEST_ERROR');

    client.close();
    assert.strictEqual(client.getDiagnostics().bridgeState, 'closed');

    const sourceDiagnostics = fs.readFileSync(path.join(ROOT, 'OpenRobertaWeb/src/app/roberta/models/connectionDiagnostics.ts'), 'utf8');
    const sourceBridge = fs.readFileSync(path.join(ROOT, 'OpenRobertaWeb/src/app/roberta/models/robotBridge.ts'), 'utf8');
    const sourceConnections = fs.readFileSync(path.join(ROOT, 'OpenRobertaWeb/src/app/roberta/controller/connections/connections.ts'), 'utf8');
    const sourceAbstract = fs.readFileSync(path.join(ROOT, 'OpenRobertaWeb/src/app/roberta/controller/connections/abstract.connections.ts'), 'utf8');
    assert.match(sourceDiagnostics, /replace\(\/\[\\u0000-\\u001f\\u007f\]\//);
    assert.match(sourceBridge, /pending\.type === 'heartbeat'/);
    assert.match(sourceConnections, /class CozmoConnection[\s\S]*override getDiagnostics\(\)/);
    assert.match(sourceConnections, /class ApitorConnection[\s\S]*override getDiagnostics\(\)/);
    assert.match(sourceAbstract, /connectionDiagnostic.*\.text\(fields\[name\]\)/);
    assert.doesNotMatch(sourceAbstract, /connectionDiagnostic.*\.html\(/);

    const serverIndex = fs.readFileSync(path.join(runtimeRoot, 'index.html'), 'utf8');
    const packagedIndex = fs.readFileSync(path.join(packagedRoot, 'index.html'), 'utf8');
    assert.strictEqual(packagedIndex, serverIndex, 'Packaged and server entry pages must stay byte-identical.');
    assert.match(serverIndex, /id='connectionDiagnostics'/);
    assert.match(serverIndex, /id='connectionDiagnosticRecommendationValue'/);
    assert.match(serverIndex, /codeon-live-20260916-39/);

    assert.ok(fs.existsSync(diagnosticsPackagedPath), 'The packaged diagnostics runtime must exist.');
    assert.ok(fs.existsSync(bridgePackagedPath), 'The packaged bridge runtime must exist.');
    assert.strictEqual(fs.readFileSync(diagnosticsPackagedPath, 'utf8'), fs.readFileSync(diagnosticsRuntimePath, 'utf8'));
    assert.strictEqual(fs.readFileSync(bridgePackagedPath, 'utf8'), fs.readFileSync(bridgeRuntimePath, 'utf8'));

    const mainSource = fs.readFileSync(path.join(ROOT, 'OpenRobertaWeb/src/main.js'), 'utf8');
    const mainRuntime = fs.readFileSync(path.join(runtimeRoot, 'js/main.js'), 'utf8');
    const packagedMain = fs.readFileSync(path.join(packagedRoot, 'js/main.js'), 'utf8');
    for (const main of [mainSource, mainRuntime, packagedMain]) {
        assert.match(main, /connectionDiagnostics: 'js\/app\/roberta\/models\/connectionDiagnostics'/);
    }
    assert.strictEqual(packagedMain, mainRuntime);

    console.log('CodeON connection diagnostics checks passed.');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
