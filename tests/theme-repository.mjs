import assert from 'node:assert/strict';
import { runThemeRepositoryContract } from './theme-repository-contract.mjs';

const calls = [];
const request = async (path, options = {}) => {
    calls.push({ path, options });
    return {
        themes: [{ id: 'default', name: 'Default' }],
        activeId: 'default',
        theme: { name: 'Default' },
    };
};

await runThemeRepositoryContract('Lite', request);
assert.equal(calls[2].path, '/themes/apple%20glass%2F%E5%A4%9C/activate');
assert.deepEqual(JSON.parse(calls[3].options.body), {
    theme: { name: 'Imported' },
    id: 'custom-id',
    activate: true,
});
assert.equal(calls[4].options.method, 'DELETE');
console.log('theme repository contract: ok');
