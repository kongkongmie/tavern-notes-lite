import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const controller = fs.readFileSync(path.join(root, 'features/theme-controller.js'), 'utf8');
const model = fs.readFileSync(path.join(root, 'core/theme-model.js'), 'utf8');

for (const name of [
    'normalizeTheme',
    'paintTheme',
    'applyTheme',
    'revertThemePreview',
    'renderThemeSelect',
    'refreshThemeList',
    'activateTheme',
    'saveTheme',
    'importThemeFile',
    'deleteSelectedTheme',
    'toggleAppleThemeMode',
]) {
    assert.doesNotMatch(source, new RegExp(`function\\s+${name}\\s*\\(`), `${name} must stay out of index.js`);
}
assert.doesNotMatch(source, /\/themes(?:\/|['"`])/, 'theme API paths must stay in the Repository');
assert.doesNotMatch(source, /state\.(?:theme|activeThemeId|previewTheme)\s*=/, 'theme state writes must use patchThemeState');
assert.doesNotMatch(source, /querySelector(?:All)?\([^)]*(?:theme-select|theme-file|theme-delete|theme-import|apple-mode)/, 'theme controls belong to Theme View');
assert.doesNotMatch(controller, /\bstorageMode\b|localStorage|indexedDB|\bfetch\s*\(/i, 'Controller must be storage-agnostic');
assert.doesNotMatch(model, /\bdocument\b|\bwindow\b|localStorage|indexedDB|\bfetch\s*\(/i, 'Theme Model must stay pure');
console.log('theme structure: ok');
