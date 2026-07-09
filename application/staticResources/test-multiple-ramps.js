MissionSim3D.clearWorldObjects();
MissionSim3D.spawnRamp(-5, -5, 'up'); // Left
MissionSim3D.spawnRamp(5, -5, 'down'); // Right
// Drive towards the LEFT ramp (up)
window.robotState = window.robotState || {};
MissionSim3D.reset();
MissionSim3D.runProgram([{type: 'drive', distance: 100, speed: 100}], function() {
    console.log("TEST FINISHED", window.myLogs);
});
