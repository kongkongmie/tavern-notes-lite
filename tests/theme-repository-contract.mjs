import assert from 'node:assert/strict';
import { createThemeRepository } from '../core/theme-repository.js';

export async function runThemeRepositoryContract(label, request) {
    const repository = createThemeRepository({ request });
    const expectedKeys = ['activeId', 'activeTheme', 'themes'];

    for (const [name, operation] of [
        ['list', () => repository.listThemes()],
        ['active', () => repository.getActiveTheme()],
        ['activate', () => repository.activateTheme('apple glass/夜')],
        ['import', () => repository.importTheme({ name: 'Imported' }, { id: 'custom-id' })],
        ['delete', () => repository.deleteTheme('custom-id')],
    ]) {
        const result = await operation();
        assert.deepEqual(Object.keys(result).sort(), expectedKeys, `${label}: ${name} must use the unified state shape`);
        assert.ok(Array.isArray(result.themes), `${label}: ${name} themes must be an array`);
        assert.equal(typeof result.activeId, 'string', `${label}: ${name} activeId must be a string`);
        assert.equal(typeof result.activeTheme, 'object', `${label}: ${name} activeTheme must be an object`);
    }
}

