import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const application = read('../services/application.js');
const bootstrap = read('../services/application-bootstrap.js');
const lifecycle = read('../services/lifecycle-registry.js');
const quickView = read('../features/quick-reply-view.js');
const coexistence = read('../features/coexistence-controller.js');
const entry = read('../index.js');

assert.doesNotMatch(application, /querySelector|createElement|Repository|fetch\(/);
assert.doesNotMatch(bootstrap, /querySelector|createElement|indexedDB|canvas/i);
assert.doesNotMatch(lifecycle, /querySelector|createElement|storageMode|Repository/);
assert.doesNotMatch(quickView, /Repository|appStore|storageMode/);
assert.doesNotMatch(coexistence, /noteController|themeController|fontController|Repository/);
assert.doesNotMatch(entry, /new\s+(?:globalThis\.)?MutationObserver/);
assert.doesNotMatch(entry, /new\s+(?:globalThis\.)?ResizeObserver/);
assert.doesNotMatch(entry, /\bfetch\(/);
assert.doesNotMatch(entry, /insertAdjacentHTML/);
assert.doesNotMatch(entry, /globalThis\.indexedDB/);
assert.doesNotMatch(entry, /eventSource\.(?:on|off)/);
assert.doesNotMatch(entry, /event_types\.APP_READY/);
assert.doesNotMatch(entry, /setInterval\(/);
assert.match(entry, /function updateArchiveReadingMode\(\)/);
assert.match(entry, /#tavern-notes-lite-list[\s\S]*updateArchiveReadingMode/);
assert.match(entry, /#tavern-notes-lite-panel/);
assert.match(entry, /function formatBytes\(bytes\)/);
assert.match(entry, /formatBytes\(status\.approximateBytes\)/);

console.log('application structure tests passed');
