import assert from 'node:assert/strict';
import { normalizeThemeFlavor, replaceThemeVariables } from '../core/theme-runtime.js';

const values = new Map([
    ['--tn-old-extra', 'stale'],
    ['--tn-background-image', 'url(test)'],
    ['--host-value', 'keep'],
]);
const style = {
    get length() { return values.size; },
    item(index) { return Array.from(values.keys())[index] || ''; },
    setProperty(key, value) { values.set(key, value); },
    removeProperty(key) { values.delete(key); },
};
replaceThemeVariables({ style }, { '--tn-paper': '#fff', '--tn-ink': '#111' }, '--tn-');
assert.equal(values.has('--tn-old-extra'), false);
assert.equal(values.get('--tn-background-image'), 'url(test)');
assert.equal(values.get('--host-value'), 'keep');
assert.equal(values.get('--tn-paper'), '#fff');
assert.equal(normalizeThemeFlavor('ARCHIVE'), 'default');
assert.equal(normalizeThemeFlavor('apple'), 'apple');
console.log('Shared theme runtime test passed.');
