import assert from 'node:assert/strict';
import { createAppleGlassSharedVariables, createBuiltInThemeRecords } from '../core/theme-presets.js';

const normalizeTheme = theme => structuredClone(theme);
const defaultTheme = {
    format: 'tavern-notes-theme',
    version: 1,
    name: 'Soft Neomorphism',
    author: 'Tavern Notes',
    variables: { '--tn-paper': '#fff' },
    assets: { brandIcon: 'fa-book-open' },
};
const records = createBuiltInThemeRecords({
    defaultTheme,
    appleDayVariables: { '--tn-paper': '#f5f5f7', '--tn-apple-mode': 'day' },
    normalizeTheme,
});

assert.deepEqual(records.map(record => record.id), ['default', 'apple-glass']);
assert.equal(records[1].theme.variables['--tn-theme-flavor'], 'apple');
assert.equal(records[1].theme.variables['--tn-radius-panel'], '26px');
assert.equal(records[1].theme.variables['--tn-paper'], '#f5f5f7');
const appleSharedVariables = createAppleGlassSharedVariables('--tnl-');
assert.equal(appleSharedVariables['--tnl-note-padding'], undefined, 'themes must not change note geometry');
assert.equal(appleSharedVariables['--tnl-note-topline-margin'], undefined, 'themes must not change note header alignment');
assert.equal(appleSharedVariables['--tnl-note-dot-display'], undefined, 'themes must not change note dot visibility');
assert.equal(defaultTheme.variables['--tn-radius-panel'], undefined, 'preset creation must not mutate its input');

console.log('Shared theme presets test passed.');
