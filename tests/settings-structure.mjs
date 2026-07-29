import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const indexSource = read('index.js');
const storeSource = read('core/app-store.js');
const modelSource = read('core/settings-model.js');
const repositorySource = read('core/settings-repository.js');
const serviceSource = read('services/settings-service.js');

assert.doesNotMatch(indexSource, /function\s+(?:load|save)LocalSettings\s*\(/);
assert.doesNotMatch(indexSource, /localStorage\.(?:getItem|setItem|removeItem)\(\s*SETTINGS_KEY\b/);
assert.match(indexSource, /getThemeState:\s*\(\)\s*=>\s*appStore\.getSlice\('theme'\)/);
assert.match(indexSource, /patchThemeState:\s*patch\s*=>\s*appStore\.patch\('theme',\s*patch\)/);
assert.match(indexSource, /createSettingsService\(\{\s*store:\s*appStore,\s*repository:\s*settingsRepository\s*\}\)/);

const persistedStateFields = [
    'language',
    'currentUserName',
    'recentTags',
    'launcherMode',
    'floatingPosition',
    'autoCaptureUserInput',
    'collapseRepeatedUserInput',
    'userInputIgnoreExact',
    'userInputIgnorePrefixes',
    'showSelectionCaptureButton',
    'showFloorCaptureButton',
    'floorCaptureSelector',
    'floorCaptureExcludedTags',
    'shareCardSettings',
];
for (const field of persistedStateFields) {
    assert.doesNotMatch(indexSource, new RegExp(`state\\.${field}\\s*=(?!=)`), `${field} must be updated through Settings Service`);
}

for (const [name, source] of [
    ['App Store', storeSource],
    ['Settings Model', modelSource],
    ['Settings Service', serviceSource],
]) {
    assert.doesNotMatch(source, /\b(?:document|localStorage|indexedDB|fetch)\b/i, `${name} must not access runtime storage or the DOM`);
}
assert.doesNotMatch(storeSource, /\bstorageMode\s*===|\bstorageMode\s*!==/, 'App Store must not branch on Full/Lite mode');
assert.doesNotMatch(serviceSource, /\bstorageMode\s*===|\bstorageMode\s*!==/, 'Settings Service must not branch on Full/Lite mode');

assert.doesNotMatch(repositorySource, /\b(?:document|indexedDB|fetch)\b/i);
assert.doesNotMatch(repositorySource, /\bstore\.(?:patch|replace|subscribe)\b/);
assert.doesNotMatch(repositorySource, /\bnotify\b/);

console.log('settings structure: ok');
