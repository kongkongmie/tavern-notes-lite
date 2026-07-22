import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const storage = fs.readFileSync(new URL('../storage.js', import.meta.url), 'utf8');

assert.doesNotMatch(source, /root\.addEventListener\('keyup', scheduleSelectionCaptureButton\)/);
assert.match(source, /new MutationObserver\(records =>/);
assert.match(source, /messages\.forEach\(ensureFloorCaptureButton\)/);
assert.doesNotMatch(source, /new MutationObserver\(\(\) => addFloorCaptureButtons\(chatContainer\)\)/);
assert.match(source, /document\.addEventListener\('pointerdown', closeHeaderPopoverFromOutside, true\)/);
assert.match(source, /class="tnl-floor-content-tag-section"/);
assert.doesNotMatch(source, /<details class="tnl-floor-capture-advanced">/);
assert.match(css, /#tavern-notes-lite-tag-search[\s\S]*?background: var\(--tnl-input-bg\) !important/);
assert.match(css, /\.tnl-floor-exclude-tag code[\s\S]*?background: transparent/);
assert.doesNotMatch(css, /\.tnl-header-secondary\s*\{\s*display:\s*contents/);
assert.match(css, /\.tnl-header-actions\s*\{[^}]*grid-column:\s*1\s*\/\s*-1[^}]*grid-template-columns:\s*repeat\(var\(--tnl-header-action-columns/);
assert.match(css, /#tavern-notes-lite-more-open\s*\{\s*display:\s*inline-flex/);
assert.match(source, /<div class="tnl-window-actions">[\s\S]*?id="tavern-notes-lite-theme"[\s\S]*?<div class="tnl-header-actions">/);
assert.match(source, /new ResizeObserver\(scheduleHeaderActionLayout\)/);
assert.match(source, /const directLimit = [^;]*panelWidth[^;]*;/);
assert.match(css, /repeat\(var\(--tnl-header-action-columns, 5\)/);
assert.match(css, /\.tnl-window-actions > \.tnl-language-select[\s\S]*?border-radius:\s*50% !important/);
assert.match(storage, /note\.source === 'manual_inspiration'/);
assert.doesNotMatch(source, /params\.set\('includeUserInput'/, 'recording toggle must not hide stored notes');
assert.match(source, /async function captureUserMessage[\s\S]*?if \(!state\.autoCaptureUserInput\) return;/, 'recording toggle must still stop automatic capture');
console.log('Lite follow-up regression test passed.');
