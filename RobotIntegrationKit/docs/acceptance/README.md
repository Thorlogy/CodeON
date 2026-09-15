# Robot hardware acceptance records

The guarded scaffold writer places one review worksheet named `<robot-id>.md`
in this directory. Keeping the directory in version control is intentional:
write mode never creates directories and therefore behaves identically in a
fresh checkout.

An acceptance record is evidence supplied by a human tester, not proof created
by the checker. Do not record a capability as verified until it has been tested
on the exact hardware and host described in the worksheet. Never include Wi-Fi
passwords, tokens, device credentials, captured user programs, biometric data
or redistributable vendor material without a confirmed licence.

Existing integrations may keep their established acceptance documents in the
locations referenced by their manifests and integration documentation. New
scaffolds use this directory consistently.
