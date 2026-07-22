# Changelog

## 0.2.0

- Introduced shared note-card, theme-runtime, and update-center modules aligned with Tavern Notes Full while preserving the existing Lite repository, install path, and IndexedDB storage.
- Redesigned note cards for denser previews, clear User/excerpt color distinction, expandable full-detail reading, and direct actions from the detail view.
- Reworked the header into consistent icon controls with width-aware overflow: more actions appear when the panel is wide and move into the More menu when space is limited.
- Moved theme access into the top window toolbar and retired the built-in Secret Files theme, including cleanup of legacy active-theme selections and blocked re-import of the retired built-in file.
- Added whole-message exclusion tags and a directly visible body-tag editor for removing configured tagged blocks before capture.
- Added an in-app update center with version checks, the default changelog, and optional author-maintained Chinese annotations from `CHANGELOG.zh-CN.md`.
- Kept manual USER inspiration notes visible when automatic User input recording is disabled; the recording switch now controls capture only, not visibility.
- Reduced broad DOM rescans during selection, message, and toolbar observation to improve responsiveness while messages stream.
- Completed Simplified Chinese, Traditional Chinese, English, and Korean coverage for the new controls and states.
- Existing Lite notes remain in the same IndexedDB database and keep the Full-compatible export/import format.

## 0.1.4

- Added draggable floating launcher positioning with reset support.
- Added manual USER inspiration notes and global tag renaming.
- Reorganized the responsive toolbar into primary actions and an adaptive More menu.
- Added a day/night switch for the default theme with a redesigned Twilight Blue night mode.
- Refined narrow-screen icons, modal controls, note actions, tags, pagination, and Secret Files menu layering.

## 0.1.3

- Added automatic collapsing for consecutive identical User inputs with preserved repeat counts.
- Added searchable exact-match and prefix ignore-rule management for fixed Quick Reply commands.
- Added a review-first historical duplicate cleanup that shows every affected entry before confirmation.
- Limited cleanup confirmation to the groups shown in the preview.
- Refined the cleanup panel across desktop, mobile, light, and archive themes.

## 0.1.2

- Fixed mobile viewport drift that could move the top toolbar outside the visible screen.
- Kept Tavern Notes Lite toolbar controls contained within the SillyTavern input bar on narrow screens.
- Replaced incompatible masked launcher icons with adaptive high-contrast PNG icons for light and dark themes.
- Isolated imported share-card font CSS so third-party styles cannot affect the SillyTavern interface.
- Completed localized export and share-card notifications in Simplified Chinese, Traditional Chinese, English, and Korean.

## 0.1.1

- Added editable note text and removable per-note tag chips.
- Added tag search, filtering, recent/common tags, and a dedicated tag library for large collections.
- Added a guided empty state that explains how to create the first tag.
- Added safe global tag deletion without deleting notes.
- Preserved edited text and tags in IndexedDB, JSON/TXT exports, imports, search, counts, and character views.
- Refined tag-library and edit-dialog layouts across built-in themes and isolated controls from SillyTavern theme styles.

## 0.1.0

- First independent frontend-only edition.
- Stores notes in IndexedDB without a Server Plugin.
- Supports selected-text capture, whole-message capture, optional User input capture, search, character grouping, pagination, copy, re-input, delete, and share cards.
- Supports JSON import/export compatible with Tavern Notes Full and clean TXT export.
- Adds browser storage and backup reminders without automatic deletion.
- Pauses automatically when Tavern Notes Full is active.
- Includes Soft Neomorphism and Apple Glass themes, plus imported Tavern Notes theme compatibility.
