import assert from 'node:assert/strict';
import { createRepositoryRouter, isStorageMode } from '../core/repository-router.js';

let mode = 'full';
const calls = [];
const request = createRepositoryRouter({
    getMode: () => mode,
    serverRequest: async path => { calls.push(['server', path]); return { adapter: 'server' }; },
    liteRequest: async (path, options, user, version) => { calls.push(['lite', path, options, user, version]); return { adapter: 'lite' }; },
    localThemeRequest: async path => path === '/themes' ? { adapter: 'local-theme' } : null,
    getLiteUser: () => 'Tester',
    getRuntimeVersion: () => '9.9.9',
});

assert.equal((await request('/notes')).adapter, 'server');
mode = 'lite';
assert.equal((await request('/notes')).adapter, 'lite');
assert.equal((await request('/themes')).adapter, 'local-theme');
assert.equal(calls[1][3], 'Tester');
assert.equal(calls[1][4], '9.9.9');
assert.equal(isStorageMode('full'), true);
assert.equal(isStorageMode('lite'), true);
assert.equal(isStorageMode('other'), false);

console.log('Repository router test passed.');
