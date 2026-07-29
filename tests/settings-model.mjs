import assert from 'node:assert/strict';
import {
    DEFAULT_SETTINGS,
    SETTINGS_SCHEMA_VERSION,
    mergeSettingsWithDefaults,
    migrateSettings,
    normalizeSettings,
    pickPersistedSettings,
    validateSettings,
} from '../core/settings-model.js';

const legacy = {
    language: 'en',
    launcherMode: 'floating',
    autoCaptureUserInput: false,
    shareCard: { theme: 'jianshu', fontScale: 0.9 },
};
const migrated = migrateSettings(legacy);
assert.equal(migrated.schemaVersion, SETTINGS_SCHEMA_VERSION);
assert.equal(migrated.language, 'en');
assert.equal(legacy.schemaVersion, undefined, 'migration does not mutate input');

const merged = mergeSettingsWithDefaults(legacy);
assert.equal(merged.shareCard.theme, 'jianshu');
assert.equal(merged.shareCard.showDate, true);

const normalized = normalizeSettings({
    language: 'invalid',
    launcherMode: 'sideways',
    floatingPosition: { x: 'bad', y: 3 },
    userInputIgnoreExact: [' a ', 'a', '', 7],
    floorCaptureExcludedTags: ['<THINKING>', 'bad tag', 'thinking'],
    appleGlassMode: 'invalid',
    recentTags: 'not-an-array',
    shareCard: {
        theme: 'invalid',
        fontScale: 'NaN',
        importedFonts: [{ id: 'font', name: 'Font', css: '@font-face{}', dataUrl: 'large-data' }],
    },
});
assert.equal(normalized.language, DEFAULT_SETTINGS.language);
assert.equal(normalized.launcherMode, DEFAULT_SETTINGS.launcherMode);
assert.equal(normalized.floatingPosition, null);
assert.deepEqual(normalized.userInputIgnoreExact, ['a', '7']);
assert.deepEqual(normalized.floorCaptureExcludedTags, ['thinking']);
assert.equal(normalized.appleGlassMode, 'day');
assert.deepEqual(normalized.recentTags, []);
assert.equal(normalized.shareCard.theme, 'calendar');
assert.equal(normalized.shareCard.fontScale, 0.8);
assert.equal(normalized.shareCard.importedFonts[0].dataUrl, '');

const persisted = pickPersistedSettings({ settings: legacy });
assert.equal(persisted.schemaVersion, SETTINGS_SCHEMA_VERSION);
assert.equal(persisted.language, 'en');
assert.equal(validateSettings(persisted).valid, true);
console.log('settings model: ok');
