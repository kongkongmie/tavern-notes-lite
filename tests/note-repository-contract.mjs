import assert from 'node:assert/strict';
import { assertNoteRepository, NoteRepositoryError } from '../core/note-repository-contract.js';
import { createLiteNoteRepository } from '../repositories/lite-note-repository.js';

const adapterFactories = [['lite', createLiteNoteRepository]];
try {
    const { createFullNoteRepository } = await import('../repositories/full-note-repository.js');
    adapterFactories.unshift(['full', createFullNoteRepository]);
} catch {
    // Standalone Lite does not ship the Full HTTP adapter.
}

const FIXTURE = [
    ['n1', 1, 'manual', 'Alpha opening', '2026-01-01T00:00:00.000Z', 'c1', 'chat-a', ['Story', 'Blue']],
    ['n2', 2, 'excerpt', 'Bravo quoted text', '2026-01-02T00:00:00.000Z', 'c1', 'chat-a', ['Story']],
    ['n3', 3, 'user_input', 'CHARLIE command', '2026-01-03T00:00:00.000Z', 'c2', 'chat-b', ['Command', 'Blue']],
    ['n4', 4, 'manual', 'Delta idea', '2026-01-04T00:00:00.000Z', 'c2', 'chat-b', ['Story', 'Mood']],
    ['n5', 5, 'excerpt', 'Echo special 你好 & <tag>', '2026-01-05T00:00:00.000Z', 'c3', 'chat-c', ['Mood']],
    ['n6', 6, 'manual', 'Foxtrot', '2026-01-06T00:00:00.000Z', 'c1', 'chat-c', ['Story', 'Mood']],
    ['n7', 7, 'manual', 'Stable first', '2026-01-07T00:00:00.000Z', 'c1', 'chat-a', ['Stable']],
    ['n8', 8, 'manual', 'Stable second', '2026-01-07T00:00:00.000Z', 'c1', 'chat-a', ['Stable']],
].map(([id, seq, type, content, createdAt, characterId, chatId, tags]) => ({
    id,
    seq,
    type,
    content,
    createdAt,
    updatedAt: createdAt,
    character: { id: characterId, name: `Character ${characterId}`, avatar: null },
    chat: { id: chatId, name: `Chat ${chatId}`, messageId: seq },
    source: '',
    tags,
}));

function clone(value) {
    return structuredClone(value);
}

function createMemoryBackend(initial = FIXTURE) {
    let notes = clone(initial);
    let next = notes.length + 1;

    async function request(path, options = {}) {
        const url = new URL(path, 'https://notes.test');
        const method = String(options.method || 'GET').toUpperCase();
        if (url.pathname === '/export.json') {
            return { format: 'tavern-notes-export', version: 1, notes: clone(notes) };
        }
        if (url.pathname === '/notes' && method === 'POST') {
            const input = JSON.parse(options.body || '{}');
            const createdAt = `2026-02-${String(next).padStart(2, '0')}T00:00:00.000Z`;
            const note = {
                ...input,
                id: `created-${next}`,
                seq: next,
                createdAt,
                updatedAt: createdAt,
            };
            next += 1;
            notes.push(note);
            return { note: clone(note) };
        }
        if (url.pathname.startsWith('/notes/')) {
            const id = decodeURIComponent(url.pathname.slice('/notes/'.length));
            const index = notes.findIndex(note => note.id === id);
            if (index < 0) {
                const error = new Error('Note not found.');
                error.status = 404;
                throw error;
            }
            if (method === 'PATCH') {
                const patch = JSON.parse(options.body || '{}');
                notes[index] = { ...notes[index], ...patch, updatedAt: '2026-03-01T00:00:00.000Z' };
                return { note: clone(notes[index]) };
            }
            if (method === 'DELETE') {
                notes.splice(index, 1);
                return { ok: true };
            }
        }
        if (url.pathname === '/import' && method === 'POST') {
            const payload = JSON.parse(options.body || '{}');
            notes.push(...clone(payload.notes || []));
            return { imported: payload.notes?.length || 0, skipped: 0 };
        }
        throw new Error(`Unsupported request: ${method} ${url.pathname}`);
    }

    async function importData(payload) {
        notes.push(...clone(payload.notes || []));
        return { imported: payload.notes?.length || 0, skipped: 0 };
    }

    return {
        request,
        getAllNotes: async () => clone(notes),
        importData,
        exportData: async user => ({ format: 'tavern-notes-export', version: 1, user, notes: clone(notes) }),
        requestFile: async () => 'plain text export',
        markExported: async () => {},
    };
}

function createRepository(kind, factory, initial = FIXTURE) {
    const backend = createMemoryBackend(initial);
    return kind === 'full'
        ? assertNoteRepository(factory({
            request: backend.request,
            requestFile: backend.requestFile,
        }))
        : assertNoteRepository(factory({
            request: backend.request,
            getAllNotes: backend.getAllNotes,
            importData: backend.importData,
            exportData: backend.exportData,
            markExported: backend.markExported,
        }));
}

const queryCases = [
    ['all', {}, result => assert.equal(result.total, 8)],
    ['search', { search: 'charlie' }, result => assert.deepEqual(result.items.map(note => note.id), ['n3'])],
    ['type', { type: 'excerpt' }, result => assert.deepEqual(result.items.map(note => note.id), ['n5', 'n2'])],
    ['character', { characterId: 'c2' }, result => assert.deepEqual(result.items.map(note => note.id), ['n4', 'n3'])],
    ['chat', { chatId: 'chat-c' }, result => assert.deepEqual(result.items.map(note => note.id), ['n6', 'n5'])],
    ['single tag', { tags: ['story'] }, result => assert.deepEqual(result.items.map(note => note.id), ['n6', 'n4', 'n2', 'n1'])],
    ['multiple tags AND', { tags: ['story', 'mood'] }, result => assert.deepEqual(result.items.map(note => note.id), ['n6', 'n4'])],
    ['ascending', { sortOrder: 'asc' }, result => assert.equal(result.items[0].id, 'n1')],
    ['descending', { sortOrder: 'desc' }, result => assert.deepEqual(result.items.slice(0, 2).map(note => note.id), ['n7', 'n8'])],
    ['first page', { sortBy: 'seq', page: 1, pageSize: 3 }, result => assert.deepEqual(result.items.map(note => note.id), ['n8', 'n7', 'n6'])],
    ['middle page', { sortBy: 'seq', page: 2, pageSize: 3 }, result => assert.deepEqual(result.items.map(note => note.id), ['n5', 'n4', 'n3'])],
    ['last page', { sortBy: 'seq', page: 3, pageSize: 3 }, result => {
        assert.deepEqual(result.items.map(note => note.id), ['n2', 'n1']);
        assert.equal(result.hasMore, false);
    }],
    ['invalid pagination repaired', { page: -10, pageSize: 0 }, result => {
        assert.equal(result.page, 1);
        assert.equal(result.pageSize, 50);
    }],
    ['special characters', { search: '你好 & <TAG>' }, result => assert.deepEqual(result.items.map(note => note.id), ['n5'])],
];

const semanticResults = new Map();
for (const [kind, factory] of adapterFactories) {
    const empty = createRepository(kind, factory, []);
    assert.deepEqual(await empty.listNotes({}), {
        items: [],
        total: 0,
        page: 1,
        pageSize: 50,
        hasMore: false,
        counts: { all: 0, user_input: 0, excerpt: 0, manual: 0 },
        characters: [],
        tags: [],
    });

    const legacyCalls = [];
    const legacyRequest = async path => {
        legacyCalls.push(path);
        const pathname = new URL(path, 'https://notes.test').pathname;
        if (pathname === '/notes') return { notes: [FIXTURE[0]], totalNotes: 9, counts: { all: 9 } };
        if (pathname === '/characters') return { characters: [{ id: 'c1', name: 'Character c1', total: 9 }] };
        if (pathname === '/tags') return { tags: [{ name: 'Story', count: 4 }] };
        throw new Error(`Unexpected legacy path: ${path}`);
    };
    const legacyRepository = kind === 'full'
        ? factory({ request: legacyRequest })
        : factory({
            request: legacyRequest,
            getAllNotes: async () => [],
            importData: async () => ({}),
            exportData: async () => ({ notes: [] }),
        });
    const legacy = await legacyRepository.listNotes({
        search: ' Alpha ',
        type: 'manual',
        characterId: 'c1',
        tags: ['Story'],
        sortBy: 'seq',
        page: 2,
        pageSize: 15,
    }, {
        legacy: true,
        currentCharacterId: 'current',
    });
    assert.equal(legacy.total, 9);
    assert.equal(legacy.page, 2);
    assert.equal(legacy.items[0].id, 'n1');
    assert.equal(legacy.characters[0].id, 'c1');
    assert.equal(legacy.tags[0].name, 'Story');
    assert.match(legacyCalls[0], /\/notes\?/);
    assert.match(legacyCalls[0], /limit=15/);
    assert.match(legacyCalls[0], /offset=15/);
    assert.match(legacyCalls[0], /q=Alpha/);
    assert.match(legacyCalls[0], /tag=Story/);
    assert.match(legacyCalls[0], /type=manual/);
    assert.match(legacyCalls[0], /characterId=c1/);
    assert.match(legacyCalls[0], /currentCharacterId=current/);

    const repository = createRepository(kind, factory);
    await assert.rejects(
        () => repository.listNotes([]),
        error => error instanceof NoteRepositoryError && error.code === 'INVALID_QUERY',
    );
    const results = [];
    for (const [name, query, verify] of queryCases) {
        const result = await repository.listNotes(query);
        verify(result);
        results.push([name, result]);
    }
    semanticResults.set(kind, results);

    const created = await repository.createNote({ content: 'Created without optional fields' });
    assert.ok(created.id);
    assert.equal(created.type, 'manual');
    assert.equal(created.character.id, null);
    assert.equal(created.chat.id, null);

    const updated = await repository.updateNote(created.id, { content: 'Updated', tags: ['One', 'one', 'Two'] });
    assert.equal(updated.content, 'Updated');
    assert.deepEqual(updated.tags, ['One', 'Two']);

    assert.deepEqual(await repository.deleteNote(updated.id), { id: updated.id });
    assert.deepEqual(await repository.deleteNotes(['n1', 'n2', 'n2']), { ids: ['n1', 'n2'], count: 2 });

    await assert.rejects(
        () => repository.getNote('missing'),
        error => error instanceof NoteRepositoryError && error.code === 'NOTE_NOT_FOUND',
    );

    const imported = await repository.importNotes({
        format: 'tavern-notes-export',
        version: 1,
        notes: [{ ...FIXTURE[0], id: 'imported', content: 'Imported' }],
    });
    assert.deepEqual(imported, { imported: 1, skipped: 0 });
    const exported = await repository.exportNotes({ format: 'json', user: 'Tester' });
    assert.equal(exported.data.format, 'tavern-notes-export');
    assert.ok(exported.data.notes.every(note => note.id && note.content));
}

if (semanticResults.has('full') && semanticResults.has('lite')) {
    assert.deepEqual(
        semanticResults.get('full'),
        semanticResults.get('lite'),
        'Full and Lite list semantics must be identical',
    );
}

for (const [kind, factory] of adapterFactories) {
    const unavailable = new Error('IndexedDB storage unavailable.');
    unavailable.code = kind === 'full' ? 'backend_unreachable' : undefined;
    const repository = kind === 'full'
        ? factory({ request: async () => { throw unavailable; } })
        : factory({
            request: async () => { throw unavailable; },
            getAllNotes: async () => { throw unavailable; },
            importData: async () => { throw unavailable; },
            exportData: async () => { throw unavailable; },
        });
    await assert.rejects(
        () => repository.listNotes({}),
        error => error instanceof NoteRepositoryError && error.code === 'STORAGE_UNAVAILABLE',
    );
}

console.log(`note repository contract: ok (${adapterFactories.map(([name]) => name).join(' + ')})`);
