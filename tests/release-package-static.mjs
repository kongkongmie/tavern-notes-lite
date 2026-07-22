import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, manifest.js), 'utf8');

assert.ok(fs.existsSync(path.join(root, manifest.js)), `Missing manifest JS: ${manifest.js}`);
assert.ok(fs.existsSync(path.join(root, manifest.css)), `Missing manifest CSS: ${manifest.css}`);
assert.ok(fs.existsSync(path.join(root, 'CHANGELOG.md')), 'Missing default changelog.');
assert.ok(fs.existsSync(path.join(root, 'CHANGELOG.zh-CN.md')), 'Missing author annotation changelog.');

const localImports = [...source.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g)].map(match => match[1]);
assert.ok(localImports.length >= 5, 'Expected Lite local module imports were not found.');
localImports.forEach(relativePath => {
    assert.ok(fs.existsSync(path.resolve(root, relativePath)), `Missing imported release file: ${relativePath}`);
});

assert.equal(manifest.version, '0.2.0');
assert.equal(manifest.homePage, 'https://github.com/kongkongmie/tavern-notes-lite');
assert.equal(manifest.auto_update, true);
console.log('Lite release package static test passed.');
