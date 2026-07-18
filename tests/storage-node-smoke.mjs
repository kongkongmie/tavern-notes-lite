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
const userBase = { type: 'user_input', content: '/qr fixed', character: { id: 1, name: 'Alpha' }, chat: { id: 'chat-b', name: 'Chat B', messageId: 10 } };
const firstInput = await storage.liteApi('/notes', { method: 'POST', body: JSON.stringify(userBase) });
const repeatedInput = await storage.liteApi('/notes', { method: 'POST', body: JSON.stringify({ ...userBase, chat: { ...userBase.chat, messageId: 11 } }) });
await storage.liteApi('/notes', { method: 'POST', body: JSON.stringify({ ...userBase, content: 'break', chat: { ...userBase.chat, messageId: 12 } }) });
const afterBreak = await storage.liteApi('/notes', { method: 'POST', body: JSON.stringify({ ...userBase, chat: { ...userBase.chat, messageId: 13 } }) });
await storage.liteApi('/notes', { method: 'POST', body: JSON.stringify({ ...userBase, content: 'legacy', collapseRepeated: false, chat: { ...userBase.chat, messageId: 14 } }) });
await storage.liteApi('/notes', { method: 'POST', body: JSON.stringify({ ...userBase, content: 'legacy', collapseRepeated: false, chat: { ...userBase.chat, messageId: 15 } }) });
await storage.liteApi('/notes', { method: 'POST', body: JSON.stringify({ ...userBase, content: 'legacy two', collapseRepeated: false, chat: { ...userBase.chat, messageId: 16 } }) });
await storage.liteApi('/notes', { method: 'POST', body: JSON.stringify({ ...userBase, content: 'legacy two', collapseRepeated: false, chat: { ...userBase.chat, messageId: 17 } }) });
const dedupePreview = await storage.liteApi('/user-input-dedupe');
const legacyPreview = dedupePreview.items.find(item => item.content === 'legacy');
const dedupeResult = await storage.liteApi('/user-input-dedupe', { method: 'POST', body: JSON.stringify({ ids: [legacyPreview.id] }) });
const legacy = await storage.liteApi('/notes?q=legacy&limit=15&offset=0');
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
    consecutiveCollapsed: firstInput.deduplicated === false && repeatedInput.deduplicated === true && repeatedInput.note.repeatCount === 2 && repeatedInput.note.latestMessageId === 11,
    breakStopsCollapse: afterBreak.deduplicated === false,
    historicalDedupe: dedupePreview.duplicateNotes === 2 && legacyPreview?.occurrences === 2 && dedupeResult.duplicateNotes === 1 && legacy.totalNotes === 3 && legacy.notes.find(note => note.content === 'legacy')?.repeatCount === 2 && legacy.notes.filter(note => note.content === 'legacy two').length === 2,
    compatibleExport: exported.format === 'tavern-notes-export'
        && exported.notes.length === 9
        && exported.notes.find(note => note.id === 'full-1')?.content === 'alpha excerpt edited'
        && exported.notes.find(note => note.id === 'full-1')?.tags.join(',') === 'plot',
    storageCount: info.count === 9 && info.approximateBytes > 0,
};

console.log(JSON.stringify({ first, duplicate, checks }, null, 2));
if (!Object.values(checks).every(Boolean)) process.exitCode = 1;
