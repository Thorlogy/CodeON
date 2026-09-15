# New robot integration checklist

Read `INTEGRATION_CONTRACT.md` first and choose one scope:

- **Bridge prototype:** hardware discovery, adapter and safety tests without a
  selectable CodeON robot system.
- **Complete system:** robot card, plugin, toolbox, browser connection and
  optional simulation after the bridge safety gates pass.

Create a draft manifest under `RobotIntegrationKit/manifests/<id>.json`, based
on the schema rather than by changing a reference robot. Run
`npm run robot:check -- --id <id>` after each registration step. Keep its scope
as `bridge` until every complete-system field exists. A draft must never be
added to the active robot whitelist.

## Bridge prototype

1. Choose a stable lowercase robot identifier.
2. Document model, firmware, host operating systems, protocol evidence and
   third-party licensing.
3. Publish only demonstrated capabilities and conservative physical limits.
4. Implement connect, disconnect, status, idempotent stop, commands and
   sensors through `RobotAdapter`.
5. Keep vendor libraries optional and isolated inside the adapter.
6. Add a deterministic fake or recorded test double.
7. Pass the shared conformance tests without hardware or vendor dependencies.
8. Verify repeated connection, emergency stop, watchdog, transport loss and
   process shutdown on real hardware.

## Complete system

9. Register the Maven module, server dependency and plugin resources.
10. Map neutral stack-machine operations; add robot-specific operations only
    where no neutral operation exists.
11. Add the browser connection, behavior, robot card and optional local
    launcher entry.
12. Use the same stack-machine program for hardware and simulation.
13. Add the robot and its required checks to the architecture model.
14. Pass the active robot reactor, server package and robot-specific tests
    before adding the robot to the active whitelist.
15. Record the physical hardware acceptance and known limitations separately.
