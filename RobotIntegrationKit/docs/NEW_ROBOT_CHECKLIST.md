# New robot integration checklist

1. Copy the reference adapter and choose a stable robot identifier.
2. Publish capabilities and conservative physical limits in the manifest.
3. Implement connect, disconnect, status, stop, commands and sensors.
4. Keep vendor libraries optional and isolated inside the adapter.
5. Pass the shared conformance tests with the fake and real adapter.
6. Verify repeated connection, emergency stop and network-loss behavior.
7. Map CodeON stack-machine operations; add robot-specific operations only
   where no neutral operation exists.
8. Use the same stack-machine program for hardware and simulation.
9. Document supported operating systems, firmware, Python and dependencies.
10. Preserve all third-party license and copyright notices.
