# CodeON migration status

This document records the implementation status of the Open Roberta to CodeON
migration. It complements `LICENSE` and `NOTICE`; those files remain the
authoritative legal and attribution documents.

## Implemented

- CodeON browser title, manifest identity, favicon, header and About branding
- CodeON start page, footer, project, documentation, support and release links
- CodeON password-reset and account-activation wording
- CodeON news feed and feedback destination
- corrected CodeON source logo and dedicated touch icon
- German and English as the only selectable and distributed UI languages
- English fallback for browsers configured to any other language
- removal of obsolete runtime translation files from source, packaged
  application and legacy backup copies
- migration of visible Open Roberta wording and links in German/English help
- CodeON-focused root and frontend documentation and build metadata
- removal of obsolete upstream support contacts, publishing workflows and
  unreferenced brand assets from the delivered application
- removal of tracked diagnostic artifacts and legacy backup copies, with
  repository ignore rules preventing their accidental return
- verified inventory of delivered browser, Python bridge and Java dependencies,
  including a reproducible build description for the checked-in JAR directory

## Intentionally retained for compatibility

The following names are technical compatibility identifiers, not product
branding. They remain until a separately tested data/API migration is available:

- Java namespace `de.fhg.iais.roberta`
- Maven artifact IDs such as `OpenRobertaServer` and `OpenRobertaRobot`
- XML namespace `http://de.fhg.iais.roberta.blockly`
- database name `openroberta-db`
- native webview bridge name `OpenRoberta`
- internal classes, CSS selectors and serialization properties containing
  `Roberta`, `Nepo` or `IAIS`

Changing these identifiers without aliases could invalidate saved programs,
database upgrades, robot plugins, native app bridges and third-party APIs.

## Required before a public production launch

- provide operator-owned imprint, privacy policy and terms of use in German and
  English through the server's `legalTexts` configuration
- configure an operator-owned SMTP relay and sender address; the repository
  defaults to `localhost` and no sender to prevent accidental use of upstream
  infrastructure
- obtain legal review of trademark use, NOTICE attribution and the completed
  third-party license inventory
- test both languages on start page, editor, simulator, account flows and help
- decide whether the historical term NEPO may remain in purely technical APIs;
  the user interface no longer depends on it as a product label

## Language policy

CodeON supports `de` and `en`. Translation metadata (`qqq.json`) and synonym
metadata (`synonyms.json`) are retained because they are build resources rather
than selectable languages.

## Cleanup verification

The Part A repository cleanup was completed and re-verified on 2026-09-01.
Automated checks confirmed that the repository contains no former support
address, no references to the removed upstream brand assets and no upstream
publishing targets in the remaining GitHub workflows. The architecture graph,
code graph, robot sensor toolboxes, Cozmo and Apitor simulation checks, 3D
simulation check, Code Buddy security check and RCX program-end semantics check
all passed.

The running local application was also checked on the start page, in the Cozmo
editor, in the Cozmo simulator and in the About dialog. CodeON branding and
assets loaded in all four views, and the browser console reported no warnings
or errors.

## Cozmo UI follow-up

The following issues were reported on 2026-09-01 and addressed on 2026-09-02.

| ID | Resolution | Regression criterion |
| --- | --- | --- |
| `COZMO-UI-01` | The RCX-only mission control is hidden whenever a non-RCX robot is selected. | No RCX-specific label is visible in a Cozmo workspace; the RCX keeps its mission control. |
| `COZMO-UI-02` | The `Quellcodes` control uses a delegated click handler and therefore survives replacement of the program controls. | A single click reliably opens the source-code view after initialisation and robot changes. |
| `COZMO-UI-03` | The fixed Cozmo system supplies no editable configuration XML. Its read-only configuration workspace is initialized without a toolbox and with a valid empty CodeON `block_set`. Program-tab activation and bridge initialization now run in one ordered lifecycle after all controllers are ready; the former competing start-view polling loop was removed. | One click on Cozmo's `loslegen` control selects Cozmo, opens its workspace and starts the bridge connection. Other robots continue to load their supplied configuration XML. |

Browser acceptance was repeated on 2026-09-02 with cache version
`codeon-live-20260902-22`: one Cozmo selection click opened the program view,
the RCX mission control remained hidden, and one source-code click opened the
generated code view without console errors. A separate RCX selection opened
the program view and retained the visible `RCX-Missionen` control.

The first-selection path was rechecked and corrected on 2026-09-14 with cache
version `codeon-live-20260914-35`. The root cause was a combination of a
competing tab-opening loop and Cozmo's fixed configuration resource beginning
with an XML comment. The legacy CodeON Blockly parser accepts only a single
`block_set` or `toolbox_set` root and therefore aborted the first controller
initialization before the program tab and bridge were activated.

Acceptance was repeated in fresh browser sessions. A single first selection of
Cozmo opened the program view and immediately attempted the local bridge
connection. RCX and Apitor also opened their program views with a single first
selection. The Cozmo hardware commands, transport protocol and bridge adapter
were not changed by this correction.

The physical acceptance test was completed successfully on 2026-09-14. After
switching the Mac to Cozmo's Wi-Fi, one Cozmo selection established the local
connection and a block program was transferred to the real robot. This closes
the first-selection regression for the current release candidate.

## Deferred Cozmo hardware issue

Physical lifting of a Light Cube remains deliberately deferred. The unloaded
lift raises and lowers reliably, but under cube load the arm only starts to
rise and then stalls. Further power or closed-loop tuning is frozen until a
separate hardware investigation can distinguish load, gearing, battery and
position-feedback causes. The current lift implementation must not be tuned as
part of unrelated UI work.
