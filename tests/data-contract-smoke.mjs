import assert from 'node:assert/strict';
import fs from 'node:fs';
import { indexedDB } from 'fake-indexeddb';

Object.defineProperty(globalThis, 'indexedDB', { value: indexedDB, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: { storage: { estimate: async () => ({ usage: 1, quota: 1024 }) } }, configurable: true });

const fixture = JSON.parse(fs.readFileSync(new URL('./data-contract-fixture.json', import.meta.url), 'utf8'));
const storage = await import('../storage.js');
const first = await storage.importLiteExport(fixture);
const duplicate = await storage.importLiteExport(fixture);
const exported = await storage.getLiteExport('contract-test');

assert.deepEqual(first, { imported: 3, skipped: 0 });
assert.deepEqual(duplicate, { imported: 0, skipped: 3 });
assert.equal(exported.format, fixture.format);
assert.equal(exported.version, fixture.version);
assert.equal(exported.notes.length, 3);
const excerpt = exported.notes.find(note => note.id === 'contract-excerpt');
const repeat = exported.notes.find(note => note.id === 'contract-repeat');
const manual = exported.notes.find(note => note.id === 'contract-manual');
assert.deepEqual(excerpt.tags, ['Plot', 'clue']);
assert.equal(repeat.repeatCount, 3);
assert.equal(repeat.latestMessageId, 10);
assert.equal(manual.type, 'manual');
assert.equal(manual.character.isUser, true);
console.log('Lite data contract test passed.');
