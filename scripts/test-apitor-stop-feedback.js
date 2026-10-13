#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const runtime = path.join(root, 'OpenRobertaServer/staticResources/js/app/nepostackmachine/interpreter.apitorRobotBridgeBehaviour.js');
const packaged = path.join(root, 'application/staticResources/js/app/nepostackmachine/interpreter.apitorRobotBridgeBehaviour.js');
const connectionsRuntime = path.join(root, 'OpenRobertaServer/staticResources/js/app/roberta/controller/connections/connections.js');
const connectionsPackaged = path.join(root, 'application/staticResources/js/app/roberta/controller/connections/connections.js');
const connectionsSource = fs.readFileSync(path.join(root, 'OpenRobertaWeb/src/app/roberta/controller/connections/connections.ts'), 'utf8');
const apitorStart = connectionsSource.indexOf('export class ApitorConnection');
const apitorSource = connectionsSource.slice(apitorStart);
const cozmoSource = connectionsSource.slice(0, apitorStart);

assert.ok(apitorStart >= 0, 'Apitor connection must exist.');
assert.ok(/Motorstopp nicht bestätigt/.test(apitorSource), 'Apitor must warn when stopping is unconfirmed.');
assert.ok(!/Apitor wurde sicher gestoppt/.test(apitorSource), 'Apitor errors must not claim a safe stop.');
assert.ok(!/Motorstopp nicht bestätigt/.test(cozmoSource), 'Cozmo must not receive Apitor-only warnings.');
assert.ok(/warning\.id = 'codeon-apitor-stop-warning'/.test(apitorSource), 'Apitor errors must display a separate persistent warning.');
assert.ok((apitorSource.match(/getElementById\('codeon-apitor-stop-warning'\)\?\.remove\(\)/g) || []).length === 1,
    'The warning must stay visible across program retries and clear only after a confirmed stop on robot switch.');
assert.strictEqual(fs.readFileSync(runtime, 'utf8'), fs.readFileSync(packaged, 'utf8'));
assert.strictEqual(fs.readFileSync(connectionsRuntime, 'utf8'), fs.readFileSync(connectionsPackaged, 'utf8'));
const connectionCode = fs.readFileSync(connectionsRuntime, 'utf8');
const errorStart = connectionCode.indexOf('        ApitorConnection.prototype.hardwareError = function (error) {');
const errorEnd = connectionCode.indexOf('        ApitorConnection.prototype.clearRetry =', errorStart);
assert.ok(errorStart >= 0 && errorEnd > errorStart, 'Compiled Apitor hardware error handler must exist.');
const terminateStart = connectionCode.indexOf('        ApitorConnection.prototype.terminate = function () {');
const terminateEnd = connectionCode.indexOf('        ApitorConnection.prototype.setState =', terminateStart);
assert.ok(terminateStart >= 0 && terminateEnd > terminateStart, 'Compiled Apitor termination handler must exist.');

const elements = new Map();
const fakeDocument = {
    documentElement: { lang: 'de' },
    body: { appendChild(element) { elements.set(element.id, element); } },
    getElementById(id) { return elements.get(id) || null; },
    createElement() { return { id: '', style: {}, textContent: '', attributes: {}, setAttribute(name, value) { this.attributes[name] = value; }, remove() { elements.delete(this.id); } }; },
};

function RobotSimBehaviour() {}
RobotSimBehaviour.prototype.getSample = function () {};
let exportsValue;
vm.runInNewContext(fs.readFileSync(runtime, 'utf8'), {
    Map, Math, Number, Object, Promise, String, Error, console,
    document: fakeDocument,
    navigator: { language: 'de' },
    window: { setInterval() { return 1; }, clearInterval() {} },
    define(names, factory) {
        const exports = {};
        factory(...names.map((name) => name === 'exports' ? exports : name === './interpreter.robotSimBehaviour' ? { RobotSimBehaviour } : undefined));
        exportsValue = exports;
    },
}, { filename: runtime });

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

function makeBridge(stopPromise, commandPromise = Promise.resolve({})) {
    return {
        sensor() { return Promise.resolve({ value: {} }); },
        stopAll() { return stopPromise; },
        command() { return commandPromise; },
    };
}

(async () => {
    const stop = deferred();
    const behaviour = new exportsValue.ApitorRobotBridgeBehaviour(makeBridge(stop.promise));
    behaviour.close();
    const panel = elements.get('codeon-apitor-status');
    assert.match(panel.textContent, /Bestätigung ausstehend/);
    assert.doesNotMatch(panel.textContent, /Alle Motoren gestoppt/);
    stop.resolve();
    await Promise.resolve();
    await Promise.resolve();
    assert.match(panel.textContent, /Bridge bestätigt/);

    const failure = deferred();
    const errors = [];
    const failingBehaviour = new exportsValue.ApitorRobotBridgeBehaviour(makeBridge(failure.promise), (error) => errors.push(error));
    failingBehaviour.close();
    failure.reject(new Error('BLE stop unconfirmed'));
    await Promise.resolve();
    await Promise.resolve();
    assert.match(panel.textContent, /Stopp nicht bestätigt/);
    assert.strictEqual(panel.attributes.role, 'alert');
    assert.strictEqual(errors.length, 1);

    const motorStop = deferred();
    const motorBehaviour = new exportsValue.ApitorRobotBridgeBehaviour(makeBridge(Promise.resolve(), motorStop.promise));
    motorBehaviour.motorStopAction('', 'M1');
    assert.match(panel.textContent, /Bestätigung ausstehend/);
    motorStop.resolve();
    await Promise.resolve();
    await Promise.resolve();
    assert.match(panel.textContent, /Bridge bestätigt/);

    const motorWrite = deferred();
    const motorErrors = [];
    const motorWriteBehaviour = new exportsValue.ApitorRobotBridgeBehaviour(makeBridge(Promise.resolve(), motorWrite.promise), (error) => motorErrors.push(error));
    motorWriteBehaviour.motorOnAction('', 'M1', '', 0, 4, 0);
    motorWrite.reject(new Error('motor write unconfirmed'));
    await Promise.resolve();
    await Promise.resolve();
    assert.match(panel.textContent, /Stopp nicht bestätigt/);
    assert.strictEqual(panel.attributes.role, 'alert');
    assert.strictEqual(motorErrors.length, 1);

    let closeCalls = 0;
    let stopCalls = 0;
    let retryCalls = 0;
    const recoveryStop = deferred();
    const connectionPrototype = vm.runInNewContext(
        `function ApitorConnection() {}\n${connectionCode.slice(errorStart, errorEnd)}\nApitorConnection.prototype`,
        {
            document: fakeDocument,
            GUISTATE_C: {
                getBlocklyWorkspace() { return { robControls: { switchToStart() {} } }; },
                setConnectionState() {}, setRunEnabled() {},
            },
            $() { return { removeClass() { return this; }, addClass() { return this; }, attr() { return this; } }; },
            window: { setTimeout() { retryCalls++; return retryCalls; } },
            console: { error() {} },
            Object, String,
        });
    const connection = Object.assign(Object.create(connectionPrototype), {
        bridge: {
            stopAll() { stopCalls++; return recoveryStop.promise; },
            close() { closeCalls++; },
        },
        connected: true,
        retryTimer: undefined,
        errorRecoveryPending: false,
        recoveryEpoch: 0,
        recordConnectionError() {}, clearRetry() {}, connectBridge() {},
    });
    connection.hardwareError(new Error('unconfirmed motor stop'));
    connection.hardwareError(new Error('duplicate error'));
    assert.strictEqual(stopCalls, 1, 'Concurrent errors must not launch competing stop/retry flows.');
    assert.strictEqual(closeCalls, 0, 'The bridge must remain open while stop confirmation is pending.');
    assert.strictEqual(retryCalls, 0, 'Reconnect must wait for the stop attempt to finish.');
    assert.match(elements.get('codeon-apitor-stop-warning').textContent, /Motorstopp nicht bestätigt/);
    recoveryStop.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    assert.strictEqual(closeCalls, 1);
    assert.strictEqual(retryCalls, 1);

    const terminate = vm.runInNewContext(
        `function ApitorConnection() {}\n${connectionCode.slice(terminateStart, terminateEnd)}\nApitorConnection.prototype.terminate`,
        { document: fakeDocument, _super: { prototype: { terminate() {} } } });
    const makeConnection = (stopPromise) => ({
        bridge: { stopAll() { return stopPromise; }, close() { closeCalls++; } },
        recoveryEpoch: 0, errorRecoveryPending: true, clearRetry() {},
        showStopWarning: connectionPrototype.showStopWarning,
    });
    const confirmedStop = deferred();
    const confirmedConnection = makeConnection(confirmedStop.promise);
    terminate.call(confirmedConnection);
    assert.ok(elements.has('codeon-apitor-stop-warning'), 'Old warning must remain until stop is confirmed.');
    confirmedStop.resolve();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    assert.ok(!elements.has('codeon-apitor-stop-warning'), 'Confirmed stop may clear the warning.');

    const rejectedStop = deferred();
    terminate.call(makeConnection(rejectedStop.promise));
    rejectedStop.reject(new Error('no stop acknowledgement'));
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    assert.match(elements.get('codeon-apitor-stop-warning').textContent, /Motorstopp nicht bestätigt/);

    console.log('Apitor stop feedback checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
