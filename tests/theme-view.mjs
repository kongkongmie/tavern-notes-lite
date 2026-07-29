import assert from 'node:assert/strict';
import { createThemeView, renderThemeViewMarkup } from '../features/theme-view.js';

const listeners = new Map();
const document = {
    addEventListener(type, listener) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
        listeners.get(type)?.delete(listener);
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return {}; },
    createTextNode(value) { return value; },
};
const view = createThemeView({
    document,
    window: {},
    getComputedStyle: () => ({}),
    requestAnimationFrame: callback => callback(),
    idPrefix: 'test',
    classPrefix: 'tn',
    variablePrefix: '--tn-',
    translate: key => key,
    exportFile: () => {},
});
view.mount({});
view.mount({});
assert.equal(listeners.get('click').size, 1, 'repeated mount keeps one click delegate');
assert.equal(listeners.get('change').size, 1, 'repeated mount keeps one change delegate');
view.destroy();
assert.equal(listeners.get('click').size, 0, 'destroy removes click delegate');
assert.equal(listeners.get('change').size, 0, 'destroy removes change delegate');

const liteMarkup = renderThemeViewMarkup({
    idPrefix: 'lite',
    classPrefix: 'tnl',
    translate: key => key,
    escapeHtml: value => value,
    capabilities: { themeStudio: false, exportTheme: false, openThemeFolder: false },
});
assert.doesNotMatch(liteMarkup, /theme-export|theme-open-folder|data-theme-studio/);
console.log('theme view: ok');
