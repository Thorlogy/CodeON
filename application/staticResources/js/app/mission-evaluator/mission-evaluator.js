/**
 * CodeON Missions-Evaluator (2D-Simulation, RCX)
 * ------------------------------------------------
 * Wertet deklarative Erfolgskriterien einer Mission gegen den laufenden
 * Simulationszustand aus. Kern ist PUR (Node-testbar); der Browser-Teil
 * (attach) liest die verifizierten Sim-Eigenschaften und pollt.
 *
 * Verifizierte Sim-Anker (Stand Branch feature/rcx-local-transfer-stable):
 *   SimulationRoberta.Instance                      (simulation.roberta.js Z. 65)
 *   robot.pose.{x,y,theta}                          (robot.base.mobile.js)
 *   robot.chassis.left.speed / right.speed          (robot.actuators.js Z. 71 ff.)
 *   robot.chassis.wheelFrontLeft/FrontRight/
 *                 BackLeft/BackRight .bumped        (robot.actuators.js Z. 73-76)
 *   robot.webAudio.playTone(cb, tone)               (robot.actuators.js Z. 2732)
 *   LightSensor.lightValue                          (robot.sensors.js:
 *     wird in BEIDEN Modi gesetzt - ground analog 0-100 (Z. 911),
 *     ambient per Lampen-Falloff (Z. 852). Die 0/100-Binaerisierung in
 *     Z. 1071 gehoert zum OpticalSensor (andere Sensorfamilie, mbot/
 *     rob3rta) und betrifft den RCX-LightSensor NICHT - er erbt den
 *     ColorSensor-Pfad unveraendert.)
 *
 * Einbindung (Browser):
 *   var handle = MissionEvaluator.attach(missionDef, {
 *       onUpdate:  function (result) { ... HUD aktualisieren ... },
 *       onSuccess: function (result) { ... Banner ... },
 *       onFail:    function (result, reason) { ... Banner ... }
 *   });
 *   handle.reset();   // Neustart der Wertung (z. B. nach Sim-Reset)
 *   handle.detach();  // Missionsmodus beenden
 *
 * Kriterien (criteria: [...], UND-verknuepft) — Zonen: {x,y,w,h} oder {x,y,r}
 *   { type:'reachZone',       zone:Z }
 *   { type:'stoppedInZone',   zone:Z, holdTicks:20 }
 *   { type:'zoneSequence',    zones:[Z,Z,...] }
 *   { type:'maxCollisions',   n:2 }              // erfuellt solange <= n
 *   { type:'collisionsExactly', n:1 }            // am Ende genau n
 *   { type:'followLine',      seconds:10, minRatio:0.8, port:'2', darkBelow:50 }
 *   { type:'tonesPlayed',     n:5 }
 *   { type:'lightAbove',      min:60, port:'2' } // ambient-Wert (M09)
 *   { type:'timeLimit',       seconds:60 }       // erfuellt solange darunter
 * Fail-Kriterien (failCriteria: [...], EIN Treffer = gescheitert):
 *   { type:'failOnCollision' }
 *   { type:'failOutsideZone', zone:Z }
 *   { type:'failAfterSeconds', seconds:120 }
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();            // Node (Tests)
    } else {
        root.MissionEvaluator = factory();     // Browser
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // ---------- Geometrie ----------
    function inZone(pose, zone) {
        if (!pose || !zone) return false;
        if (typeof zone.r === 'number') {
            var dx = pose.x - zone.x, dy = pose.y - zone.y;
            return dx * dx + dy * dy <= zone.r * zone.r;
        }
        return pose.x >= zone.x && pose.x <= zone.x + zone.w &&
               pose.y >= zone.y && pose.y <= zone.y + zone.h;
    }

    // ---------- Kriterien-Zustandsmaschinen ----------
    // Jedes Kriterium: init() -> state, step(state, snap, mission) -> void,
    // ok(state, snap) -> bool, progress(state) -> String (fuers HUD)
    var CRITERIA = {
        reachZone: {
            init: function () { return { reached: false }; },
            step: function (st, snap, c) { if (inZone(snap.pose, c.zone)) st.reached = true; },
            ok: function (st) { return st.reached; },
            progress: function (st) { return st.reached ? 'Zone erreicht' : 'Zone noch nicht erreicht'; }
        },
        stoppedInZone: {
            init: function () { return { hold: 0, done: false }; },
            step: function (st, snap, c) {
                var still = Math.abs(snap.leftSpeed) < 0.01 && Math.abs(snap.rightSpeed) < 0.01;
                if (inZone(snap.pose, c.zone) && still) {
                    st.hold++;
                    if (st.hold >= (c.holdTicks || 20)) st.done = true;
                } else if (!st.done) {
                    st.hold = 0;
                }
            },
            ok: function (st) { return st.done; },
            progress: function (st, c) {
                return st.done ? 'In der Zone angehalten'
                    : (st.hold > 0 ? 'Anhalten: ' + st.hold + '/' + (c.holdTicks || 20) : 'Noch nicht in der Zone angehalten');
            }
        },
        zoneSequence: {
            init: function () { return { idx: 0 }; },
            step: function (st, snap, c) {
                if (st.idx < c.zones.length && inZone(snap.pose, c.zones[st.idx])) st.idx++;
            },
            ok: function (st, snap, c) { return st.idx >= c.zones.length; },
            progress: function (st, c) { return 'Checkpoint ' + st.idx + '/' + c.zones.length; }
        },
        maxCollisions: {
            init: function () { return { count: 0, prev: false }; },
            step: stepCollisionCounter,
            ok: function (st, snap, c) { return st.count <= c.n; },
            progress: function (st, c) { return 'Kollisionen: ' + st.count + '/' + c.n; }
        },
        collisionsExactly: {
            init: function () { return { count: 0, prev: false }; },
            step: stepCollisionCounter,
            ok: function (st, snap, c) { return st.count === c.n; },
            progress: function (st, c) { return 'Beruehrungen: ' + st.count + ' (Ziel: ' + c.n + ')'; }
        },
        followLine: {
            init: function () { return { onLine: 0, total: 0 }; },
            step: function (st, snap, c) {
                var v = snap.lightValues && snap.lightValues[c.port || '2'];
                if (typeof v !== 'number') return;
                st.total += snap.dt;
                if (v < (c.darkBelow || 50)) st.onLine += snap.dt;
            },
            ok: function (st, snap, c) {
                return st.total >= c.seconds - 1e-9 && st.onLine / st.total >= (c.minRatio || 0.8);
            },
            progress: function (st, c) {
                var pct = st.total > 0 ? Math.round((st.onLine / st.total) * 100) : 0;
                return 'Auf der Linie: ' + pct + ' % von ' + Math.round(st.total) + 's/' + c.seconds + 's';
            }
        },
        tonesPlayed: {
            init: function () { return {}; },
            step: function () {},
            ok: function (st, snap, c) { return snap.toneCount >= c.n; },
            progress: function (st, c, snap) { return 'Toene: ' + (snap ? snap.toneCount : 0) + '/' + c.n; }
        },
        lightAbove: {
            init: function () { return { best: 0 }; },
            step: function (st, snap, c) {
                var v = snap.lightValues && snap.lightValues[c.port || '2'];
                if (typeof v === 'number' && v > st.best) st.best = v;
            },
            ok: function (st, snap, c) {
                var v = snap.lightValues && snap.lightValues[c.port || '2'];
                return typeof v === 'number' && v >= c.min;
            },
            progress: function (st, c) { return 'Hellster Wert bisher: ' + Math.round(st.best) + ' (Ziel: ' + c.min + ')'; }
        },
        timeLimit: {
            init: function () { return {}; },
            step: function () {},
            ok: function (st, snap, c) { return snap.elapsed <= c.seconds; },
            progress: function (st, c, snap) {
                return 'Zeit: ' + (snap ? Math.round(snap.elapsed) : 0) + 's/' + c.seconds + 's';
            }
        }
    };

    function stepCollisionCounter(st, snap) {
        var now = snap.bumped;             // beliebiges Rad beruehrt?
        if (now && !st.prev) st.count++;   // FLANKE zaehlen, nicht Pegel
        st.prev = now;
    }

    var FAIL = {
        failOnCollision: function (st, snap) { return snap.bumped; },
        failOutsideZone: function (st, snap, c) { return !inZone(snap.pose, c.zone); },
        failAfterSeconds: function (st, snap, c) { return snap.elapsed > c.seconds; }
    };

    // ---------- Purer Kern ----------
    function Evaluator(missionDef) {
        this.def = missionDef || {};
        this.reset();
    }
    Evaluator.prototype.reset = function () {
        var d = this.def;
        this.states = (d.criteria || []).map(function (c) {
            if (!CRITERIA[c.type]) throw new Error('Unbekanntes Kriterium: ' + c.type);
            return CRITERIA[c.type].init();
        });
        this.status = 'running';
        this.failReason = null;
    };
    /** snapshot: { pose:{x,y,theta}, leftSpeed, rightSpeed, bumped:Bool,
     *              lightValues:{port:zahl}, toneCount, elapsed, dt } */
    Evaluator.prototype.tick = function (snap) {
        var d = this.def, self = this;
        if (this.status !== 'running') return this.result(snap);

        (d.failCriteria || []).some(function (c) {
            if (FAIL[c.type] && FAIL[c.type](null, snap, c)) {
                self.status = 'failed';
                self.failReason = c.type;
                return true;
            }
            return false;
        });
        if (this.status === 'failed') return this.result(snap);

        var allOk = (d.criteria || []).length > 0;
        (d.criteria || []).forEach(function (c, i) {
            var impl = CRITERIA[c.type];
            impl.step(self.states[i], snap, c);
            if (!impl.ok(self.states[i], snap, c)) allOk = false;
        });
        if (allOk) this.status = 'success';
        return this.result(snap);
    };
    Evaluator.prototype.result = function (snap) {
        var self = this;
        return {
            status: this.status,
            failReason: this.failReason,
            elapsed: snap ? snap.elapsed : 0,
            criteria: (this.def.criteria || []).map(function (c, i) {
                var impl = CRITERIA[c.type];
                return {
                    type: c.type,
                    ok: impl.ok(self.states[i], snap, c),
                    progress: impl.progress(self.states[i], c, snap)
                };
            })
        };
    };

    // ---------- Browser-Adapter ----------
    /**
     * @param instanceGetter optional: Funktion, die SimulationRoberta.Instance
     *        liefert. EMPFOHLEN: aus dem Panel-Controller hineinreichen
     *        (dort ist das SIM-Modul ohnehin importiert):
     *          MissionEvaluator.attach(def, cbs, 100, function(){ return SIM; })
     *        Ohne Getter wird ein require('simulation.roberta')-Fallback
     *        versucht (AMD-Modul-Id kann je nach Build abweichen).
     */
    function attach(missionDef, callbacks, pollMs, instanceGetter) {
        var ev = new Evaluator(missionDef);
        var toneCount = 0;
        var startWall = Date.now();
        var patched = null;
        var timer = null;
        var cb = callbacks || {};

        function getInstance() {
            if (typeof instanceGetter === 'function') {
                var g = instanceGetter();
                return g && (g.default || g);
            }
            // Fallback: AMD-Modul (default-Export, simulation.roberta.js Z. 1383)
            try {
                var mod = window.require('simulation.roberta');
                return mod && (mod.default || mod);
            } catch (e) { return null; }
        }
        function getRobot(inst) {
            return inst && inst.scene && inst.scene.robots && inst.scene.robots[0];
        }
        function patchTone(robot) {
            if (!robot || !robot.webAudio || patched) return;
            var orig = robot.webAudio.playTone;
            if (typeof orig !== 'function') return;
            robot.webAudio.playTone = function () {
                toneCount++;
                return orig.apply(this, arguments);
            };
            patched = { obj: robot.webAudio, orig: orig };
        }
        function snapshotOf(inst, robot, dt) {
            var ch = robot.chassis || {};
            var bumped = !!((ch.wheelFrontLeft && ch.wheelFrontLeft.bumped) ||
                            (ch.wheelFrontRight && ch.wheelFrontRight.bumped) ||
                            (ch.wheelBackLeft && ch.wheelBackLeft.bumped) ||
                            (ch.wheelBackRight && ch.wheelBackRight.bumped));
            var lightValues = {};
            Object.keys(robot).forEach(function (k) {
                var s = robot[k];
                if (s && typeof s.lightValue === 'number' && s.port) {
                    lightValues[s.port] = s.lightValue;
                }
            });
            return {
                pose: robot.pose,
                leftSpeed: ch.left ? ch.left.speed : 0,
                rightSpeed: ch.right ? ch.right.speed : 0,
                bumped: bumped,
                lightValues: lightValues,
                toneCount: toneCount,
                elapsed: (Date.now() - startWall) / 1000,
                dt: dt
            };
        }
        var lastResult = null;
        function pollTick() {
            var inst = getInstance();
            var robot = getRobot(inst);
            if (!robot) return;
            patchTone(robot);
            var res = ev.tick(snapshotOf(inst, robot, (pollMs || 100) / 1000));
            lastResult = res;
            if (cb.onUpdate) cb.onUpdate(res);
            if (res.status === 'success' && cb.onSuccess) { cb.onSuccess(res); stop(); }
            if (res.status === 'failed' && cb.onFail) { cb.onFail(res, res.failReason); stop(); }
        }
        function start() {
            stop();
            timer = setInterval(pollTick, pollMs || 100);
        }
        function stop() {
            if (timer) { clearInterval(timer); timer = null; }
        }
        start();

        return {
            reset: function () {
                ev.reset(); toneCount = 0; startWall = Date.now(); lastResult = null;
                start();
            },
            detach: function () {
                stop();
                if (patched) { patched.obj.playTone = patched.orig; patched = null; }
            },
            evaluator: ev,
            lastResult: function () { return lastResult; }
        };
    }

    return { Evaluator: Evaluator, attach: attach, _inZone: inZone };
});
