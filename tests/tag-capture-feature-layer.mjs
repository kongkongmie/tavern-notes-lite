import assert from 'node:assert/strict';
import { normalizeTagName, isSameTag, replaceTagInFilter, removeTagFromFilter } from '../core/tag-model.js';
import { shouldCaptureUserInput, buildExcerptNoteInput, createCaptureDedupeKey } from '../core/capture-model.js';
import { prepareUserInputCapture } from '../core/user-input-model.js';
import { createTagController } from '../features/tag-controller.js';
import { createCaptureController } from '../features/capture-controller.js';
import { createUserInputCaptureController } from '../features/user-input-capture-controller.js';
import { createUserInputMaintenanceController } from '../features/user-input-maintenance-controller.js';
import { createFullTagRepository, TagRepositoryError } from '../repositories/full-tag-repository.js';
import { createLiteTagRepository } from '../repositories/lite-tag-repository.js';

assert.equal(normalizeTagName('  Plot  '), 'Plot');
assert.equal(isSameTag('Plot', 'plot'), true);
assert.deepEqual(replaceTagInFilter(['Plot', 'x'], 'plot', 'Story'), ['Story', 'x']);
assert.deepEqual(removeTagFromFilter(['Plot', 'x'], 'PLOT'), ['x']);
assert.equal(shouldCaptureUserInput({ is_user: true, mes: 'hello' }, { enabled: true }), true);
assert.equal(shouldCaptureUserInput({ is_user: true, mes: '/help' }, { enabled: true, ignorePrefixes: ['/'] }), false);
assert.equal(createCaptureDedupeKey('chat', 2), 'chat::2');
assert.equal(buildExcerptNoteInput({ content: ' x ', character: {}, chat: 'c', messageId: 1 }).content, 'x');
assert.equal(prepareUserInputCapture({ is_user: true, mes: 'x' }, { chatId: 'c', messageId: 1, character: {} }, { enabled: true }, { 'c::1': 'x' }), null);

for (const factory of [createFullTagRepository, createLiteTagRepository]) {
    const calls = [];
    const repository = factory({ request: async (path, options) => {
        calls.push([path, options]);
        return options.method === 'PATCH' ? { updated: 2, newTag: 'Story' } : { updated: 3 };
    } });
    assert.deepEqual(await repository.renameTag('Plot', 'Story'), { affectedNotes: 2, oldName: 'Plot', newName: 'Story' });
    assert.deepEqual(await repository.deleteTag('Plot'), { affectedNotes: 3, deletedTag: 'Plot' });
    assert.equal(calls.length, 2);
}
await assert.rejects(
    createFullTagRepository({ request: async () => { const error = new Error('missing'); error.status = 404; throw error; } }).deleteTag('x'),
    error => error instanceof TagRepositoryError && error.code === 'TAG_NOT_FOUND',
);

let query = { tags: ['Plot'], page: 4 };
let refreshes = 0;
let recent = ['Plot'];
const tagController = createTagController({
    repository: {
        renameTag: async () => ({ affectedNotes: 1, oldName: 'Plot', newName: 'Story' }),
        deleteTag: async tag => ({ affectedNotes: 1, deletedTag: tag }),
    },
    listController: { refresh: async () => { refreshes += 1; } },
    getQueryState: () => structuredClone(query),
    replaceQueryState: value => { query = structuredClone(value); },
    getRecentTags: () => recent,
    updateRecentTags: async value => { recent = value; },
    confirmDelete: async () => true,
});
tagController.mount();
assert.equal((await tagController.renameTag('Plot', 'Story')).ok, true);
assert.deepEqual(query.tags, ['Story']);
assert.equal((await tagController.deleteTag('Story')).ok, true);
assert.deepEqual(query.tags, []);
assert.equal(query.page, 1);
assert.equal(refreshes, 2);
tagController.destroy();
assert.equal((await tagController.deleteTag('x')).ok, false);

let creates = 0;
const captureController = createCaptureController({
    noteMutationController: { createNote: async input => { creates += 1; return { ok: true, value: input }; } },
    getCaptureSettings: () => ({}),
    getSillyTavernContext: () => ({ character: {}, chatId: 'c' }),
    getSelectionSnapshot: () => ({ text: 'excerpt', messageId: 2, source: 'selected_text' }),
    getFloorText: async () => ({ content: 'floor', messageId: 3, character: {} }),
});
captureController.mount();
assert.equal((await captureController.handleManualCapture()).ok, true);
assert.equal((await captureController.captureWholeFloor({})).ok, true);
assert.equal(creates, 2);
captureController.destroy();
assert.equal((await captureController.handleManualCapture()).ok, false);

const listeners = new Map();
const source = {
    on(type, handler) { listeners.set(type, handler); },
    off(type, handler) { if (listeners.get(type) === handler) listeners.delete(type); },
};
const userController = createUserInputCaptureController({
    eventSource: source,
    eventTypes: { MESSAGE_SENT: 'sent', MESSAGE_EDITED: 'edited', MESSAGE_UPDATED: 'updated' },
    noteMutationController: { createNote: async () => ({ ok: true }) },
    getSettings: () => ({ enabled: true }),
    getContext: messageId => ({ messageId, chatId: 'c', character: {}, message: { is_user: true, mes: 'hello' } }),
    delay: 0,
});
userController.mount();
assert.equal(listeners.size, 3);
userController.mount();
assert.equal(listeners.size, 3);
assert.equal((await userController.handleUserMessage(1)).ok, true);
assert.equal((await userController.handleUserMessage(1)).skipped, true);
userController.destroy();
assert.equal(listeners.size, 0);

let maintenanceRefreshes = 0;
const maintenance = createUserInputMaintenanceController({
    repository: {
        preview: async () => ({ removed: 1, items: [{ id: 'n1' }] }),
        apply: async options => ({ removed: options.ids.length }),
    },
    listController: { refresh: async () => { maintenanceRefreshes += 1; } },
});
maintenance.mount();
assert.equal((await maintenance.runPreview()).ok, true);
assert.equal((await maintenance.applyCleanup()).value.removed, 1);
assert.equal(maintenanceRefreshes, 1);
maintenance.destroy();

console.log('tag/capture feature layer tests passed');
