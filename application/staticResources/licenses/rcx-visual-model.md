# RCX visual model — attribution and licence

`js/app/simulation/simulationLogic/robot.rcx.visual.js` is an adaptation of
Thorlogy / 3D-RoboMission, function `buildEV3Robot`:
https://github.com/Thorlogy/3D-RoboMission/blob/08747705dd366590a10692d4215a82f4537581fc/js/app/mission/mission-sim3d.js

Source commit: 08747705dd366590a10692d4215a82f4537581fc.
Original repository licence: Creative Commons Attribution-ShareAlike 4.0 International.
The adapted model file is distributed under the same CC BY-SA 4.0 licence:
https://creativecommons.org/licenses/by-sa/4.0/legalcode
The material is provided without warranties, subject to the licence terms.

Changes for CodeON: yellow RCX-style shell, top controls and connection sockets;
removed fixed ultrasonic/colour sensor, strip and LED; grouped tyre/hub geometry;
normalization to CodeON's existing visual footprint. No RoboMission physics,
interpreter or hardware transport is included.

This model file is separately licensed and is not covered by the Apache-2.0
licence of the surrounding CodeON source. Three.js remains under its own MIT
licence. The model is illustrative, not a dimensionally exact hardware replica.
