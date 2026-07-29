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
assert.equal(createAppleGlassSharedVariables('--tnl-')['--tnl-note-dot-display'], 'none');
assert.equal(defaultTheme.variables['--tn-radius-panel'], undefined, 'preset creation must not mutate its input');

console.log('Shared theme presets test passed.');
