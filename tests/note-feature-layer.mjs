import assert from 'node:assert/strict';
import { createNoteUiQuery, NOTE_LIST_INITIAL_STATE, NOTE_UI_INITIAL_STATE } from '../core/note-list-model.js';
import { createNoteListController } from '../features/note-list-controller.js';
import { createNoteFilterController } from '../features/note-filter-controller.js';
import { createNoteMutationController } from '../features/note-mutation-controller.js';
import { createNoteExportController } from '../features/note-export-controller.js';
import { createNoteListView } from '../features/note-list-view.js';

const clone = value => structuredClone(value);

function harness(repository) {
    let list = clone(NOTE_LIST_INITIAL_STATE);
    let query = createNoteUiQuery();
    let ui = clone(NOTE_UI_INITIAL_STATE);
    const commits = [];
    const adapter = {
        getListState: () => clone(list),
        patchListState(patch) { list = { ...list, ...clone(patch) }; commits.push(clone(list)); },
        getQueryState: () => clone(query),
        replaceQueryState(value) { query = clone(value); },
        getNoteUiState: () => clone(ui),
        patchNoteUiState(patch) { ui = { ...ui, ...clone(patch) }; },
    };
    const listController = createNoteListController({ repository, ...adapter });
    listController.mount();
    return { adapter, listController, get list() { return list; }, get query() { return query; }, get ui() { return ui; }, commits };
}

{
    let resolveA;
    const repository = {
        listNotes(query) {
            if (query.search === 'a') return new Promise(resolve => { resolveA = resolve; });
            return Promise.resolve({ items: [{ id: 'b' }], total: 1, counts: { all: 1 }, characters: [], tags: [] });
        },
    };
    const h = harness(repository);
    const a = h.listController.load({ ...createNoteUiQuery(), search: 'a' });
    const b = h.listController.load({ ...createNoteUiQuery(), search: 'b' });
    await b;
    resolveA({ items: [{ id: 'a' }], total: 1, counts: {}, characters: [], tags: [] });
    assert.equal((await a).stale, true);
    assert.equal(h.list.items[0].id, 'b', 'older request must not overwrite newer data');
}

{
    let resolve;
    const h = harness({ listNotes: () => new Promise(done => { resolve = done; }) });
    const pending = h.listController.refresh();
    h.listController.destroy();
    resolve({ items: [{ id: 'late' }], total: 1 });
    assert.equal((await pending).stale, true);
    assert.equal(h.list.items.length, 0);
}

{
    const old = { items: [{ id: 'old' }], total: 1, counts: {}, characters: [], tags: [], loaded: true };
    const h = harness({ listNotes: async () => { throw new Error('down'); } });
    h.adapter.patchListState(old);
    const result = await h.listController.refresh();
    assert.equal(result.ok, false);
    assert.deepEqual(h.list.items, old.items);
    assert.equal(h.list.loading, false);
    assert.equal(h.list.error.message, 'down');
}

{
    let loads = 0;
    const timers = [];
    const h = harness({ listNotes: async query => ({ items: [], total: 0, counts: {}, characters: [], tags: [], query }) });
    const filter = createNoteFilterController({
        ...h.adapter,
        listController: { load: async () => { loads += 1; } },
        debounceMs: 300,
        setTimer: callback => { timers.push(callback); return timers.length; },
        clearTimer: () => {},
    });
    filter.mount();
    const pending = filter.setSearch('  hello  ');
    assert.equal(h.query.search, 'hello');
    assert.equal(h.query.pageSize, 15);
    await timers.pop()();
    await pending;
    assert.equal(loads, 1);
    await filter.setType('excerpt');
    assert.equal(h.query.page, 1);
    assert.equal(h.query.type, 'excerpt');
    filter.destroy();
}

{
    const calls = [];
    const repository = {
        listNotes: async () => ({ items: [], total: 0, counts: {}, characters: [], tags: [] }),
        createNote: async input => ({ id: 'new', ...input }),
        updateNote: async (id, patch) => ({ id, ...patch }),
        deleteNote: async id => ({ id }),
        deleteNotes: async ids => ({ ids, count: ids.length }),
    };
    const h = harness(repository);
    h.listController.reloadCurrentPage = async () => { calls.push('refresh'); return { ok: true }; };
    const mutation = createNoteMutationController({ repository, listController: h.listController, ...h.adapter });
    mutation.mount();
    assert.equal((await mutation.createNote({ content: 'x' })).ok, true);
    assert.equal((await mutation.updateNote('new', { content: 'y' })).ok, true);
    assert.equal((await mutation.deleteNote('new')).ok, true);
    assert.equal((await mutation.deleteNotes(['a', 'b'])).ok, true);
    assert.equal(calls.length, 4);
    assert.equal(h.ui.submitting, false);
}

{
    let exported = 0;
    const downloads = [];
    const repository = {
        listNotes: async () => ({ items: [], total: 0 }),
        importNotes: async data => ({ imported: data.notes.length, skipped: 0 }),
        exportNotes: async ({ format }) => {
            exported += 1;
            return { source: 'full', data: format === 'json' ? { notes: [] } : 'txt', notes: [] };
        },
    };
    const h = harness(repository);
    h.adapter.patchListState({ items: [{ id: 'visible', content: 'one', character: { name: 'A' } }], total: 20 });
    const controller = createNoteExportController({
        repository,
        listController: h.listController,
        ...h.adapter,
        download: (...args) => downloads.push(args),
        now: () => new Date('2026-07-26T00:00:00.000Z'),
    });
    controller.mount();
    assert.equal((await controller.exportCurrentPageJson()).ok, true);
    assert.equal(exported, 0, 'current-page export must not access repository');
    assert.match(downloads[0][0], /"visible"/);
    assert.equal((await controller.exportAllJson()).ok, true);
    assert.equal(exported, 1);
    assert.equal((await controller.importJson({ format: 'tavern-notes-export', notes: [{ id: 'x' }] })).ok, true);
    assert.equal(h.query.page, 1);
}

{
    const root = new EventTarget();
    let actions = 0;
    const view = createNoteListView({
        root,
        selectors: { edit: '.edit', delete: '.delete', share: '.share', previous: '.prev', next: '.next' },
        renderContent: () => {},
        onAction: () => { actions += 1; },
    });
    const target = { closest: () => null };
    const click = () => {
        const event = new Event('click');
        Object.defineProperty(event, 'target', { value: target });
        root.dispatchEvent(event);
    };
    view.mount();
    view.mount();
    click();
    assert.equal(actions, 1, 'repeated mount must not duplicate event bindings');
    view.destroy();
    click();
    assert.equal(actions, 1, 'destroy must disable events');
}

console.log('note feature layer tests passed');
