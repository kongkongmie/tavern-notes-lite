import assert from 'node:assert/strict';
import { createSettingsRepository } from '../core/settings-repository.js';

function createStorage() {
    const values = new Map();
    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
        removeItem(key) {
            values.delete(key);
        },
        values,
    };
}

const storage = createStorage();
const repository = createSettingsRepository({ storage, key: 'existing-settings-key' });
assert.equal(await repository.load(), null);

const settings = { schemaVersion: 1, language: 'zh-CN' };
assert.deepEqual(await repository.save(settings), settings);
assert.equal(storage.values.get('existing-settings-key'), JSON.stringify(settings));
assert.deepEqual(await repository.load(), settings);

await repository.remove();
assert.equal(await repository.load(), null);

storage.setItem('existing-settings-key', '{invalid');
await assert.rejects(() => repository.load(), SyntaxError);

console.log('settings repository contract: ok');
