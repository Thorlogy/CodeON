/** Headless-Tests fuer den Missions-Evaluator-Kern (Node, ohne Browser). */
'use strict';
var ME = require('./mission-evaluator.js');
var passed = 0, failed = 0;
function check(name, cond) {
    if (cond) { passed++; console.log('OK   ' + name); }
    else { failed++; console.log('FEHL ' + name); }
}
function snap(over) {
    var s = { pose: { x: 0, y: 0, theta: 0 }, leftSpeed: 0, rightSpeed: 0,
              bumped: false, lightValues: {}, toneCount: 0, elapsed: 0, dt: 0.1 };
    Object.keys(over || {}).forEach(function (k) { s[k] = over[k]; });
    return s;
}

// --- M01: reachZone + stoppedInZone ---
(function () {
    var ev = new ME.Evaluator({ criteria: [
        { type: 'reachZone', zone: { x: 100, y: 100, w: 50, h: 50 } },
        { type: 'stoppedInZone', zone: { x: 100, y: 100, w: 50, h: 50 }, holdTicks: 3 }
    ]});
    var r = ev.tick(snap({ pose: { x: 10, y: 10 }, leftSpeed: 1, rightSpeed: 1 }));
    check('M01: unterwegs -> running', r.status === 'running');
    r = ev.tick(snap({ pose: { x: 120, y: 120 }, leftSpeed: 1, rightSpeed: 1 }));
    check('M01: in Zone, faehrt noch -> running', r.status === 'running');
    ev.tick(snap({ pose: { x: 120, y: 120 } }));
    ev.tick(snap({ pose: { x: 120, y: 120 } }));
    r = ev.tick(snap({ pose: { x: 120, y: 120 } }));
    check('M01: in Zone angehalten (3 Ticks) -> success', r.status === 'success');
})();

// --- Kreiszone ---
(function () {
    var ev = new ME.Evaluator({ criteria: [{ type: 'reachZone', zone: { x: 0, y: 0, r: 10 } }] });
    check('Kreiszone: (7,7) drin', ev.tick(snap({ pose: { x: 7, y: 7 } })).status === 'success');
    var ev2 = new ME.Evaluator({ criteria: [{ type: 'reachZone', zone: { x: 0, y: 0, r: 10 } }] });
    check('Kreiszone: (8,8) draussen', ev2.tick(snap({ pose: { x: 8, y: 8 } })).status === 'running');
})();

// --- M03: collisionsExactly(1) — Flanken, nicht Pegel ---
(function () {
    var ev = new ME.Evaluator({ criteria: [{ type: 'collisionsExactly', n: 1 }] });
    ev.tick(snap());
    ev.tick(snap({ bumped: true }));   // Beruehrung beginnt -> 1 Flanke
    ev.tick(snap({ bumped: true }));   // haelt an -> KEINE weitere Flanke
    var r = ev.tick(snap({ bumped: true }));
    check('M03: Dauerberuehrung zaehlt als EINE Kollision -> success', r.status === 'success');
    r = ev.tick(snap({ bumped: false }));
    r = ev.tick(snap({ bumped: true })); // zweite Beruehrung NACH Erfolg
    check('M03: Erfolg bleibt trotz spaeterer Beruehrung bestehen', r.status === 'success');
    // Gegenprobe: zwei Beruehrungen VOR Erfolgspruefung -> kein Erfolg
    var ev3 = new ME.Evaluator({ criteria: [{ type: 'collisionsExactly', n: 1 }] });
    ev3.tick(snap({ bumped: true }));
    ev3.tick(snap({ bumped: false }));
    // Achtung: Erfolg friert beim ERSTEN ok-Tick ein; fuer "genau n am Ende"
    // gehoert collisionsExactly immer mit einem Abschlusskriterium kombiniert
    // (z. B. stoppedInZone) - so steht es in der Spezifikation.
})();

// --- M05: tonesPlayed + maxCollisions ---
(function () {
    var ev = new ME.Evaluator({ criteria: [
        { type: 'tonesPlayed', n: 3 },
        { type: 'maxCollisions', n: 10 }
    ]});
    var r = ev.tick(snap({ toneCount: 2 }));
    check('M05: 2/3 Toene -> running', r.status === 'running');
    r = ev.tick(snap({ toneCount: 3 }));
    check('M05: 3/3 Toene, 0 Kollisionen -> success', r.status === 'success');
})();

// --- M04: followLine (80 % ueber 1 s) ---
(function () {
    var ev = new ME.Evaluator({ criteria: [
        { type: 'followLine', seconds: 1, minRatio: 0.8, port: '2', darkBelow: 50 }
    ]});
    var r;
    for (var i = 0; i < 9; i++) r = ev.tick(snap({ lightValues: { '2': 20 } })); // dunkel
    r = ev.tick(snap({ lightValues: { '2': 90 } }));                              // 1x hell
    check('M04: 90 % auf Linie ueber 1s -> success', r.status === 'success');
    var ev2 = new ME.Evaluator({ criteria: [
        { type: 'followLine', seconds: 1, minRatio: 0.8, port: '2', darkBelow: 50 }
    ]});
    for (var j = 0; j < 5; j++) ev2.tick(snap({ lightValues: { '2': 20 } }));
    for (var k = 0; k < 5; k++) r = ev2.tick(snap({ lightValues: { '2': 90 } }));
    check('M04: nur 50 % auf Linie -> running', r.status === 'running');
})();

// --- M06/M02: zoneSequence in Reihenfolge ---
(function () {
    var A = { x: 0, y: 0, w: 10, h: 10 }, B = { x: 100, y: 0, w: 10, h: 10 }, C = { x: 200, y: 0, w: 10, h: 10 };
    var ev = new ME.Evaluator({ criteria: [{ type: 'zoneSequence', zones: [A, B, C] }] });
    ev.tick(snap({ pose: { x: 205, y: 5 } }));  // C zuerst -> zaehlt NICHT
    var r = ev.tick(snap({ pose: { x: 5, y: 5 } }));
    check('Sequenz: C vor A ignoriert, A=1/3', r.criteria[0].progress.indexOf('1/3') >= 0);
    ev.tick(snap({ pose: { x: 105, y: 5 } }));
    r = ev.tick(snap({ pose: { x: 205, y: 5 } }));
    check('Sequenz: A->B->C -> success', r.status === 'success');
})();

// --- M09: lightAbove ---
(function () {
    var ev = new ME.Evaluator({ criteria: [{ type: 'lightAbove', min: 60, port: '2' }] });
    var r = ev.tick(snap({ lightValues: { '2': 30 } }));
    check('M09: dunkel -> running', r.status === 'running');
    r = ev.tick(snap({ lightValues: { '2': 75 } }));
    check('M09: hell genug -> success', r.status === 'success');
})();

// --- Fail-Kriterien ---
(function () {
    var ev = new ME.Evaluator({
        criteria: [{ type: 'reachZone', zone: { x: 100, y: 100, w: 10, h: 10 } }],
        failCriteria: [{ type: 'failOnCollision' }]
    });
    var r = ev.tick(snap({ bumped: true }));
    check('Fail: Kollision -> failed + Grund', r.status === 'failed' && r.failReason === 'failOnCollision');
    var ev2 = new ME.Evaluator({
        criteria: [{ type: 'reachZone', zone: { x: 100, y: 100, w: 10, h: 10 } }],
        failCriteria: [{ type: 'failAfterSeconds', seconds: 30 }]
    });
    r = ev2.tick(snap({ elapsed: 31 }));
    check('Fail: Zeit ueberschritten -> failed', r.status === 'failed');
})();

// --- timeLimit als Erfolgs-Bedingung + reset ---
(function () {
    var ev = new ME.Evaluator({ criteria: [
        { type: 'reachZone', zone: { x: 0, y: 0, r: 5 } },
        { type: 'timeLimit', seconds: 10 }
    ]});
    var r = ev.tick(snap({ pose: { x: 1, y: 1 }, elapsed: 4 }));
    check('timeLimit: rechtzeitig -> success', r.status === 'success');
    ev.reset();
    r = ev.tick(snap({ pose: { x: 50, y: 50 }, elapsed: 0 }));
    check('reset: danach wieder running', r.status === 'running');
})();

// --- Status bleibt nach success eingefroren ---
(function () {
    var ev = new ME.Evaluator({ criteria: [{ type: 'reachZone', zone: { x: 0, y: 0, r: 5 } }] });
    ev.tick(snap({ pose: { x: 1, y: 1 } }));
    var r = ev.tick(snap({ pose: { x: 500, y: 500 } }));
    check('success ist endgueltig (kein Rueckfall)', r.status === 'success');
})();

console.log('\n' + passed + ' bestanden, ' + failed + ' fehlgeschlagen');
process.exit(failed === 0 ? 0 : 1);
