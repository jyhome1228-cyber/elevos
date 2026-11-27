# ELEVOS Q10 operational QA

## Diagnostics
- In-game: My Account → save/recovery → export error diagnostics. Public signup/login: export diagnostics below status.
- Admin: Error diagnostics → select exported JSON. No remote telemetry and no automatic upload. Entries limited to 200 / seven days; no raw errors, user identifiers, URLs, or career data.

## Live regression checklist (not executed by Q10 mock tests)
- Q01: save, logout, reopen; compare wallet, cards, squad; verify failed upload retains prior revision.
- Q02–Q03: first full save, identical save, partial changed group, restore in a second browser, legacy schema 1, simultaneous sessions and conflict protection.
- Q04: offline change, reconnect, browser close/reopen, storage quota, export pending backup.
- Q05: fresh signup, duplicate username, interrupted profile creation, same-email retry, coach name claim, first career save.
- Q06: repeat summary and profile reads, ensure admin counts remain correct.
- Q07: navigation, dropdowns, reward auto-claim, tactics save, match resume, light/dark.
- Q08: 1,000 and 5,000 cards, pagination/search, cross-page selection, enhancement materials, trade, locked-card protection and burn rollback.
- Q09: separate remaining work; network interruption and reconnect end-to-end.
- Q10: induce offline/local save error, export diagnostics, import as authorized admin, check no personal data.
