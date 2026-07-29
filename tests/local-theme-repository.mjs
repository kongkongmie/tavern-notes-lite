import assert from 'node:assert/strict';
import { createLocalThemeRepository } from '../core/local-theme-repository.js';

const values = new Map();
const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
const request = createLocalThemeRepository({
    storage,
    themeStorageKey: 'themes',
    activeThemeKey: 'active',
    appleThemeId: 'apple-glass',
    getBuiltInThemes: () => [{ id: 'default', name: 'Default', builtIn: true, theme: { id: 'default', name: 'Default' } }],
    normalizeTheme: theme => theme,
    isRetiredTheme: record => record.id === 'archive',
    translate: key => key,
});

assert.equal((await request('/theme')).activeId, 'default');
const saved = await request('/themes', { method: 'POST', body: JSON.stringify({ theme: { name: 'Custom' } }) });
assert.equal(saved.activeId, saved.id);
assert.equal((await request(`/themes/${saved.id}`, { method: 'DELETE' })).activeId, 'default');
await assert.rejects(() => request('/themes', { method: 'POST', body: JSON.stringify({ id: 'archive', theme: { name: 'Retired' } }) }));

console.log('Local theme repository test passed.');
