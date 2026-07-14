# Lite architecture

This repository is intentionally independent from `tavern-notes` Full.

## Isolation boundaries

| Area | Full | Lite |
| --- | --- | --- |
| Extension folder | `tavern-notes` | `tavern-notes-lite` |
| DOM prefix | `tavern-notes-*`, `tn-*` | `tavern-notes-lite-*`, `tnl-*` |
| Settings | `tavern-notes-settings` | `tavern-notes-lite-settings` |
| Note storage | Server Plugin files | IndexedDB `tavern-notes-lite` |
| Font storage | `tavern-notes-fonts` | `tavern-notes-lite-fonts` |
| Updates | `kongkongmie/tavern-notes` | `kongkongmie/tavern-notes-lite` |

The only shared contract is JSON with `format: "tavern-notes-export"` and `version: 1`.

## Source ownership

- `storage.js` owns IndexedDB, note normalization, filtering, grouping, import, export, and storage estimates.
- `index.js` owns SillyTavern integration, capture behavior, UI, localization, share cards, and browser-local themes.
- `style.css` uses only the Lite `tnl-` and `tavern-notes-lite-` namespaces.

## Coexistence rule

Full has priority. Lite checks for Full before initializing and continues watching for a later Full mount. When detected, Lite removes its controls and stops capture observers so one message cannot be saved twice.

## Bug-fix rule

Fix storage bugs in the owning repository only. Shared interaction fixes may be ported manually between repositories after testing; never copy a backend call into Lite or an IndexedDB assumption into Full.
