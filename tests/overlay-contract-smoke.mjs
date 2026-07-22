import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const dialogIds = [
    'tavern-notes-lite-new-note-menu',
    'tavern-notes-lite-modal',
    'tavern-notes-lite-edit-menu',
    'tavern-notes-lite-tag-library',
    'tavern-notes-lite-export-menu',
    'tavern-notes-lite-floor-capture-menu',
    'tavern-notes-lite-user-input-cleanup-menu',
    'tavern-notes-lite-theme-menu',
    'tavern-notes-lite-share-menu',
];

for (const id of dialogIds) assert.match(source, new RegExp(`['"]${id}['"]`));
assert.match(source, /setAttribute\('data-tn-overlay', 'dialog'\)/);
assert.match(source, /setAttribute\('data-tn-overlay', 'popover'\)/);
assert.match(css, /#tavern-notes-lite-panel > \[data-tn-overlay="dialog"\]/);
assert.match(css, /#tavern-notes-lite-panel\[data-theme-flavor="archive"\] > \[data-tn-overlay="dialog"\]/);
assert.doesNotMatch(css, /:not\(#tavern-notes-lite-modal\)/, 'Archive must not require an overlay ID whitelist.');
for (const token of ['--_tnl-z-dialog', '--_tnl-z-popover', '--_tnl-z-archive-dialog']) assert.match(css, new RegExp(token));
for (const closer of ['closeNewNoteMenu', 'closeFullNote', 'closeEditNote', 'closeTagLibrary', 'closeExportMenu', 'closeFloorCaptureMenu', 'closeUserInputCleanupMenu', 'closeThemeMenu', 'closeShareCard']) {
    assert.match(source, new RegExp(`function closePanel\\(\\) \\{[\\s\\S]*?${closer}\\(\\)`, 'm'));
}
console.log('Lite overlay contract smoke test passed.');
