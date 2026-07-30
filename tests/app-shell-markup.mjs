import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderLiteAppShellMarkup } from '../repositories/lite-app-shell-markup.js';

const html = renderLiteAppShellMarkup({
    state: {
        storageMode: 'lite',
        launcherMode: 'toolbar',
        language: 'auto',
        showSelectionCaptureButton: true,
        showFloorCaptureButton: true,
        autoCaptureUserInput: true,
        collapseRepeatedUserInput: true,
    },
    translate: key => key,
    escapeHtml: value => String(value),
    languageOptions: [{ id: 'auto', label: 'auto' }],
    getVisibleFilters: () => [{ id: 'all', icon: 'fa-book', label: 'all', hint: 'allHint' }],
    getFloorCaptureTagName: () => 'floor',
    extensionVersion: 'test',
    renderThemeViewMarkup: options => `<div data-theme-view="${options.idPrefix}">${options.studioMarkup}</div>`,
    renderThemeStudioMarkup: options => `<div data-theme-studio="${options.idPrefix}:${options.classPrefix}"></div>`,
    themeCapabilities: { openThemeFolder: false },
    shareCardThemes: [{ id: 'test-theme', labelKey: 'testTheme' }],
    shareCardBackgrounds: [{ id: 'test-background', labelKey: 'testBackground', value: '#fff' }],
    brandIconMarkup: '<img data-lite-brand>',
});

assert.match(html, /id="tavern-notes-lite-panel"/);
assert.doesNotMatch(html, /soft notes · character memory/);
assert.match(html, /id="tavern-notes-lite-notice"/);
assert.match(html, /id="tavern-notes-lite-share-custom-background"/);
assert.match(html, /id="tavern-notes-lite-share-custom-text-color"/);
assert.match(html, /class="tn-header tnl-header"/);
assert.match(html, /class="tn-brand-mark tnl-brand-mark"><img data-lite-brand>/);
assert.doesNotMatch(html, /id="tavern-notes-lite-storage-mode"/);
assert.doesNotMatch(html, /id="tavern-notes-lite-storage-mode-open"/);
assert.match(html, /class="tnl-lite-full-info"/);
assert.doesNotMatch(html, /class="tn-lite-full-info tnl-lite-full-info"/);
assert.match(html, /data-theme-view="tavern-notes-lite"/);
assert.match(html, /data-theme-studio="tavern-notes-lite:tnl"/);
assert.match(html, /id="tavern-notes-lite-input-dedupe-scan"[\s\S]*?<span>clearHistoryDuplicates<\/span>/);
assert.ok(html.indexOf('id="tavern-notes-lite-search"') < html.indexOf('id="tavern-notes-lite-list"'));
assert.ok(html.indexOf('id="tavern-notes-lite-list"') < html.indexOf('class="tn-footer tnl-footer"'));
for (const classValue of html.matchAll(/class="([^"]*)"/g)) {
    const tokens = classValue[1].split(/\s+/).filter(Boolean);
    assert.equal(new Set(tokens).size, tokens.length, `duplicate class token in: ${classValue[0]}`);
    for (const token of tokens.filter(value => value.startsWith('tn-'))) {
        assert.equal(tokens.includes(`tnl-${token.slice(3)}`), true, `missing Lite compatibility class for ${token}`);
    }
}
for (const name of ['header', 'brand-mark', 'window-actions', 'header-actions', 'search-row', 'tag-shelf', 'filters', 'filter', 'list', 'footer', 'modal-card', 'icon-button', 'soft-button', 'dedupe-preview-list', 'dedupe-preview-summary', 'edit-save', 'export-choice', 'export-scope-choice', 'new-note-save', 'share-bg', 'share-choice']) {
    assert.match(html, new RegExp(`class="[^"]*\\btn-${name}\\b[^"]*\\btnl-${name}\\b`), `Lite must keep both classes for ${name}`);
}
const runtimeSource = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
for (const name of ['brand-mark', 'close', 'edit-close', 'filter', 'floor-capture-close', 'header-actions', 'header-popover', 'new-note-close', 'user-input-cleanup-card', 'user-input-cleanup-close']) {
    assert.match(runtimeSource, new RegExp(`\\.tn-${name}\\b`), `runtime must query the canonical class for ${name}`);
    assert.doesNotMatch(runtimeSource, new RegExp(`\\.tnl-${name}\\b`), `runtime must not query the legacy class for ${name}`);
}
for (const name of ['dedupe-preview-list', 'dedupe-preview-summary', 'edit-save', 'export-choice', 'export-scope-choice', 'floor-capture', 'floor-capture-advanced', 'new-note-save', 'note', 'share-bg', 'share-choice', 'tag-filter']) {
    assert.match(runtimeSource, new RegExp(`\\.tn-${name}\\b`), `runtime must query the canonical class for ${name}`);
    assert.doesNotMatch(runtimeSource, new RegExp(`\\.tnl-${name}\\b`), `runtime must not query the legacy class for ${name}`);
}

console.log('Lite app shell markup test passed.');
