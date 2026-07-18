# Changelog

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
