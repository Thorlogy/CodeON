const { test, expect } = require('@playwright/test');

test('test robot physics', async ({ page }) => {
    await page.goto('http://localhost:8080/mission.html');

    // Wait for the simulation and MissionSim3D to load
    await page.waitForFunction(() => typeof window.MissionSim3D !== 'undefined');
    await page.waitForFunction(() => typeof window.__GET_ROBOT_STATE__ !== 'undefined');

    console.log('--- MISSION APP LOADED ---');

    // Test 1: Friction & Momentum
    console.log('\n--- Test 1: Driving and braking ---');
    await page.evaluate(() => {
        window.MissionSim3D.reset();
        window.MissionSim3D.runCommands([{ type: 'drive', distance: 10, speed: 100 }]);
    });

    // Wait for it to start moving
    await new Promise(r => setTimeout(r, 200));
    let state = await page.evaluate(() => window.__GET_ROBOT_STATE__());
    console.log(`[Mid-Drive] vx: ${state.vx.toFixed(3)}, vz: ${state.vz.toFixed(3)}, isFalling: ${state.isFalling}`);
    expect(Math.abs(state.vz)).toBeGreaterThan(0.5);

    // Wait for drive to finish
    await new Promise(r => setTimeout(r, 600));
    state = await page.evaluate(() => window.__GET_ROBOT_STATE__());
    console.log(`[Drive End] vx: ${state.vx.toFixed(3)}, vz: ${state.vz.toFixed(3)}`);

    // Wait for friction to stop it
    await new Promise(r => setTimeout(r, 300));
    state = await page.evaluate(() => window.__GET_ROBOT_STATE__());
    console.log(`[After Friction 1] vx: ${state.vx.toFixed(3)}, vz: ${state.vz.toFixed(3)}`);

    await new Promise(r => setTimeout(r, 400));
    state = await page.evaluate(() => window.__GET_ROBOT_STATE__());
    console.log(`[After Friction 2] vx: ${state.vx.toFixed(3)}, vz: ${state.vz.toFixed(3)}`);

    // Test 2: Gravity & Edge Detection
    console.log('\n--- Test 2: Driving off a platform ---');
    await page.evaluate(() => {
        window.MissionSim3D.reset();

        // Spawn platform at Z=3
        window.MissionSim3D.addObstacle({ x: 0, z: 3, width: 4.5, depth: 5.0, height: 2.2 });
        // Manually force the robot onto the platform
        const s = window.__GET_ROBOT_STATE__();
        s.x = 0;
        s.z = 3;
    });

    // Wait for gravity to pull it down since it might be hovering
    await new Promise(r => setTimeout(r, 500));
    state = await page.evaluate(() => window.__GET_ROBOT_STATE__());
    console.log(`[On Platform] y (falling speed): ${state.vy.toFixed(3)}, isFalling: ${state.isFalling}`);

    // Drive off the edge ! 
    await page.evaluate(() => {
        window.MissionSim3D.runCommands([{ type: 'drive', distance: 30, speed: 100 }]);
    });

    await new Promise(r => setTimeout(r, 400));
    state = await page.evaluate(() => window.__GET_ROBOT_STATE__());
    console.log(`[Falling] vy: ${state.vy.toFixed(3)}, isFalling: ${state.isFalling}`);

});
