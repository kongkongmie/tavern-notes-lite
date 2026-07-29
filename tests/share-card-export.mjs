import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canvasToBlob } from '../features/share-card-renderer.js';

const pngBytes = Buffer.from('png-result');
const rendererSource = await readFile(new URL('../features/share-card-renderer.js', import.meta.url), 'utf8');
const drawShareCardSource = rendererSource.slice(
    rendererSource.indexOf('async function drawShareCard'),
    rendererSource.indexOf('function dataUrlToBlob'),
);
assert.equal((drawShareCardSource.match(/return canvas;/g) || []).length, 4);
assert.doesNotMatch(drawShareCardSource, /^\s*return;\s*$/m);

const direct = await canvasToBlob({
    toBlob(callback) {
        callback(new Blob([pngBytes], { type: 'image/png' }));
    },
}, 'image/png');
assert.ok(direct instanceof Blob);
assert.ok(direct.size > 0);

let fallbackCalls = 0;
const fallback = await canvasToBlob({
    toBlob(callback) {
        callback(null);
    },
    toDataURL() {
        fallbackCalls += 1;
        return `data:image/png;base64,${pngBytes.toString('base64')}`;
    },
}, 'image/png');
assert.ok(fallback instanceof Blob);
assert.ok(fallback.size > 0);
assert.equal(fallbackCalls, 1);

await assert.rejects(
    canvasToBlob({
        toBlob(callback) {
            callback(null);
        },
        toDataURL() {
            return 'data:image/png;base64,';
        },
    }),
    /share-card-export-empty-result/,
);

await assert.rejects(
    canvasToBlob({
        toBlob(callback) {
            callback(new Blob([], { type: 'image/png' }));
        },
        toDataURL() {
            return 'data:image/png;base64,';
        },
    }),
    /share-card-export-empty-result/,
);

console.log('share-card export tests passed');
