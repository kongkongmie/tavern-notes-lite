import assert from 'node:assert/strict';
import { createAppStore } from '../core/app-store.js';
import { DEFAULT_SETTINGS } from '../core/settings-model.js';
import { createSettingsRepository } from '../core/settings-repository.js';
import { createSettingsService } from '../services/settings-service.js';

function memoryStorage(initial = null) {
    let value = initial;
    return {
        getItem: () => value,
        setItem: (key, next) => { value = next; },
        removeItem: () => { value = null; },
        value: () => value,
    };
}

{
    const storage = memoryStorage(JSON.stringify({ language: 'ko', launcherMode: 'floating' }));
    const store = createAppStore({ settings: DEFAULT_SETTINGS });
    const service = createSettingsService({
        store,
        repository: createSettingsRepository({ storage, key: 'settings' }),
    });
    const loaded = await service.load();
    assert.equal(loaded.ok, true);
    assert.equal(store.getSlice('settings').language, 'ko');
    const updated = await service.update({ shareCard: { fontScale: 1.1 } });
    assert.equal(updated.ok, true);
    assert.equal(store.getSlice('settings').shareCard.fontScale, 1.1);
    assert.equal(store.getSlice('settings').shareCard.theme, 'calendar');
    assert.equal(JSON.parse(storage.value()).schemaVersion, 1);
}

{
    const store = createAppStore({ settings: { ...DEFAULT_SETTINGS, language: 'en' } });
    const service = createSettingsService({
        store,
        repository: { load: async () => { throw new Error('load failed'); }, save: async () => {} },
    });
    const result = await service.load();
    assert.equal(result.ok, false);
    assert.equal(store.getSlice('settings').language, DEFAULT_SETTINGS.language);
}

{
    const store = createAppStore({ settings: { ...DEFAULT_SETTINGS, language: 'en' } });
    const service = createSettingsService({
        store,
        repository: { load: async () => null, save: async () => { throw new Error('disk full'); } },
    });
    const before = store.getSlice('settings');
    const result = await service.update({ language: 'ko' });
    assert.equal(result.ok, false);
    assert.deepEqual(store.getSlice('settings'), before, 'save failure rolls Store back');
}

{
    const savedLanguages = [];
    const store = createAppStore({ settings: DEFAULT_SETTINGS });
    const service = createSettingsService({
        store,
        repository: {
            load: async () => null,
            save: async settings => {
                await Promise.resolve();
                savedLanguages.push(settings.language);
            },
        },
    });
    const first = service.update({ language: 'en' });
    const second = service.update({ language: 'ko' });
    await Promise.all([first, second]);
    assert.deepEqual(savedLanguages, ['en', 'ko'], 'concurrent updates persist in call order');
    assert.equal(store.getSlice('settings').language, 'ko');
}

console.log('settings service: ok');
