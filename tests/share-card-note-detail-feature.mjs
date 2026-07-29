import assert from 'node:assert/strict';
import { createShareCardFilename, normalizeShareCardSettings } from '../core/share-card-model.js';
import { createNoteDetailModel } from '../core/note-detail-model.js';
import { createShareCardController } from '../features/share-card-controller.js';
import { createNoteDetailController } from '../features/note-detail-controller.js';

assert.equal(normalizeShareCardSettings({ fontScale: 5 }).fontScale, 1.1);
assert.equal(normalizeShareCardSettings({ fontScale: 0.1 }).fontScale, 0.65);
assert.equal(createShareCardFilename({ character: { name: 'A/B' } }, {
    brand: 'TN',
    date: new Date('2026-07-28T00:00:00Z'),
}), 'TN-A_B-2026-07-28.png');

const detail = createNoteDetailModel({
    id: 'group',
    activeVariantId: 'v2',
    variants: [
        { id: 'v1', content: 'one', character: { name: 'A' } },
        { id: 'v2', content: 'two', character: { name: 'B' } },
    ],
}, { formatType: value => value || 'note' });
assert.equal(detail.content, 'two');
assert.equal(detail.variants.length, 2);

let settings = normalizeShareCardSettings();
let renders = [];
let resolver = [];
const shareView = {
    mount() {}, destroy() {}, open() {}, close() {}, sync() {},
    getCanvas: () => ({}),
};
const exportBlob = new Blob(['png'], { type: 'image/png' });
const shareController = createShareCardController({
    view: shareView,
    renderer: {
        renderPreview: () => new Promise(resolve => resolver.push(resolve)),
        renderExport: async () => ({ blob: exportBlob, mimeType: 'image/png', width: 900, height: 1400 }),
        destroy() {},
    },
    getSettings: () => settings,
    updateSettings: async patch => { settings = { ...settings, ...patch }; return { ok: true }; },
    resetSettings: async () => ({ ok: true }),
    downloadBlob: blob => renders.push(blob),
    brand: 'TN',
});
shareController.mount();
shareController.open({ id: 'n1', content: 'note' });
const latest = shareController.preview();
resolver[1]('latest');
assert.equal(await latest, 'latest');
resolver[0]('stale');
await Promise.resolve();
await Promise.all([shareController.exportImage(), shareController.exportImage()]);
assert.equal(renders.length, 1);
assert.equal(renders[0], exportBlob);
shareController.destroy();

const calls = [];
const detailView = { mount() {}, open(model) { calls.push(model.content); }, close() {}, destroy() {} };
const detailController = createNoteDetailController({
    view: detailView,
    formatType: value => value || 'note',
    copyText: async value => calls.push(`copy:${value}`),
    fillInput: async value => calls.push(`fill:${value}`),
    editNote: note => calls.push(`edit:${note.id}`),
    confirmDelete: async () => true,
    deleteNote: async id => { calls.push(`delete:${id}`); return { ok: true }; },
    shareNote: note => calls.push(`share:${note.id}`),
});
detailController.mount();
detailController.open({ id: 'n1', content: 'hello' });
await detailController.copyContent();
assert.deepEqual(calls.slice(0, 2), ['hello', 'copy:hello']);
detailController.destroy();

console.log('share card and note detail feature: ok');
