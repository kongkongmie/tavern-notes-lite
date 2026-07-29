import assert from 'node:assert/strict';
import { createThemeModel } from '../core/theme-model.js';

const defaultTheme = { name: 'Default', variables: { '--tn-paper': '#fff', '--tn-theme-flavor': 'default' }, assets: { brandIcon: 'book' } };
const model = createThemeModel({
    defaultTheme,
    defaultNightVariables: { '--tn-paper': '#111' },
    appleDayVariables: { '--tn-paper': '#eee' },
    appleNightVariables: { '--tn-paper': '#000' },
});

assert.equal(model.normalizeAppleThemeId('apple-glass-night'), 'apple-glass');
assert.equal(model.isAppleThemeId('apple-glass-day'), true);
assert.equal(model.resolveTheme(defaultTheme, { activeThemeId: 'default', defaultMode: 'night' }).variables['--tn-paper'], '#111');
const apple = { variables: { '--tn-theme-flavor': 'apple' } };
assert.equal(model.resolveTheme(apple, { activeThemeId: 'apple-glass', appleMode: 'night' }).variables['--tn-paper'], '#000');
assert.equal(defaultTheme.variables['--tn-paper'], '#fff');

console.log('Shared theme model test passed.');
