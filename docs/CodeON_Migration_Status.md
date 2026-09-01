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
