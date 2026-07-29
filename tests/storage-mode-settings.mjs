import assert from 'node:assert/strict';
import { prepareStorageModeSwitch, readSettingsObject, shouldResumeFullMode } from '../core/storage-mode-settings.js';

const values = new Map([
    ['current', JSON.stringify({ language: 'en', storageMode: 'full' })],
    ['legacy-lite', JSON.stringify({ language: 'ko' })],
]);
const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
const keys = { storage, currentSettingsKey: 'current', fullProfileKey: 'full', liteProfileKey: 'lite', legacyLiteSettingsKey: 'legacy-lite' };

prepareStorageModeSwitch({ ...keys, currentMode: 'full', targetMode: 'lite' });
assert.equal(readSettingsObject(storage, 'current').language, 'ko');
prepareStorageModeSwitch({ ...keys, currentMode: 'lite', targetMode: 'full' });
assert.equal(readSettingsObject(storage, 'current').language, 'en');
assert.equal(readSettingsObject(storage, 'legacy-lite').language, 'ko');
assert.equal(shouldResumeFullMode({ hasLegacySettings: true, totalNotes: 0 }), true);
assert.equal(shouldResumeFullMode({ hasLegacySettings: false, totalNotes: 2 }), true);
assert.equal(shouldResumeFullMode({ hasLegacySettings: false, totalNotes: 0 }), false);

console.log('Storage mode settings test passed.');
