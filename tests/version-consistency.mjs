import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const packageLock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const frontend = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const storage = fs.readFileSync(path.join(root, 'storage.js'), 'utf8');
const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
const annotationChangelog = fs.readFileSync(path.join(root, 'CHANGELOG.zh-CN.md'), 'utf8');

const frontendVersion = frontend.match(/const EXTENSION_VERSION = '([^']+)'/)?.[1];
const storageVersion = storage.match(/const LITE_VERSION = '([^']+)'/)?.[1];

assert.ok(frontendVersion, 'Missing frontend version constant.');
assert.ok(storageVersion, 'Missing storage version constant.');
assert.equal(packageJson.version, manifest.version);
assert.equal(packageLock.version, manifest.version);
assert.equal(packageLock.packages[''].version, manifest.version);
assert.equal(frontendVersion, manifest.version);
assert.equal(storageVersion, manifest.version);
assert.match(changelog, new RegExp(`^## ${manifest.version.replaceAll('.', '\\.')}\\s*$`, 'm'));
assert.match(annotationChangelog, new RegExp(`^## ${manifest.version.replaceAll('.', '\\.')}\\s*$`, 'm'));
console.log(`Lite version consistency test passed (${manifest.version}).`);
