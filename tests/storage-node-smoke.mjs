import { indexedDB } from 'fake-indexeddb';

Object.defineProperty(globalThis, 'indexedDB', { value: indexedDB, configurable: true });
Object.defineProperty(globalThis, 'navigator', {
    value: { storage: { estimate: async () => ({ usage: 2048, quota: 1024 * 1024 }) } },
    configurable: true,
});

const storage = await import('../storage.js');
const backup = {
    format: 'tavern-notes-export',
    version: 1,
    notes: [
        { id: 'full-1', seq: 1, type: 'excerpt', content: 'alpha excerpt', createdAt: '2026-07-14T01:00:00.000Z', character: { id: 1, name: 'Alpha' }, chat: { id: 'chat-a', messageId: 3 } },
        { id: 'full-2', seq: 2, type: 'user_input', content: 'first draft', createdAt: '2026-07-14T01:01:00.000Z', character: { id: 1, name: 'Alpha' }, chat: { id: 'chat-a', messageId: 4 } },
        { id: 'full-3', seq: 3, type: 'user_input', content: 'second draft', createdAt: '2026-07-14T01:02:00.000Z', character: { id: 1, name: 'Alpha' }, chat: { id: 'chat-a', messageId: 4 } },
    ],
};

const first = await storage.importLiteExport(backup);
const duplicate = await storage.importLiteExport(backup);
const updated = await storage.liteApi('/notes/full-1', {
    method: 'PATCH',
    body: JSON.stringify({ content: 'alpha excerpt edited', tags: ['Favorite', 'plot', 'favorite'] }),
});
const list = await storage.liteApi('/notes?limit=15&offset=0');
const tagged = await storage.liteApi('/notes?tag=favorite&limit=15&offset=0');
const tags = await storage.liteApi('/tags');
const removedTag = await storage.liteApi('/tags/favorite', { method: 'DELETE' });
const afterTagDelete = await storage.liteApi('/notes?limit=15&offset=0');
const characters = await storage.liteApi('/characters');
const exported = await storage.getLiteExport('smoke-user');
const info = await storage.getLiteStorageInfo();

const checks = {
    firstImport: first.imported === 3,
    duplicateSkipped: duplicate.imported === 0 && duplicate.skipped === 3,
    variantsGrouped: list.totalNotes === 2 && list.notes.some(note => note.variantCount === 2),
    noteUpdated: updated.note.content === 'alpha excerpt edited' && updated.note.tags.join(',') === 'Favorite,plot',
    exactTagFilter: tagged.totalNotes === 1 && tagged.notes[0].id === 'full-1',
    tagSummary: tags.tags.some(tag => tag.name === 'Favorite' && tag.count === 1),
    tagDeletedEverywhere: removedTag.updated === 1 && afterTagDelete.notes.find(note => note.id === 'full-1')?.tags.join(',') === 'plot',
    characterSummary: characters.characters.length === 1 && characters.characters[0].name === 'Alpha',
    compatibleExport: exported.format === 'tavern-notes-export'
        && exported.notes.length === 3
        && exported.notes.find(note => note.id === 'full-1')?.content === 'alpha excerpt edited'
        && exported.notes.find(note => note.id === 'full-1')?.tags.join(',') === 'plot',
    storageCount: info.count === 3 && info.approximateBytes > 0,
};

console.log(JSON.stringify({ first, duplicate, checks }, null, 2));
if (!Object.values(checks).every(Boolean)) process.exitCode = 1;
