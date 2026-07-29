import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = path => readFileSync(resolve(path), 'utf8');
const index = read('index.js');
assert.doesNotMatch(index, /\/tags\/|user-input-dedupe/);
assert.doesNotMatch(index, /function (?:deleteTagEverywhere|renameTagEverywhere|captureUserMessage|captureMessageFloor|captureSelection|watchSelectionFrames|watchChatMessages)/);
assert.doesNotMatch(index, /(?:capturedUserInputs|lastCapturedMessageId|floorCaptureObserver|selectionFrameObserver|boundSelectionRoots)/);

const tagController = read('features/tag-controller.js');
const tagView = read('features/tag-view.js');
const captureController = read('features/capture-controller.js');
const userCapture = read('features/user-input-capture-controller.js');
const maintenanceController = read('features/user-input-maintenance-controller.js');
for (const source of [tagController, captureController, userCapture, maintenanceController]) {
    assert.doesNotMatch(source, /querySelector|storageMode/);
}
assert.doesNotMatch(tagView, /repository|storageMode/);
assert.doesNotMatch(captureController, /noteRepository|\/notes|fetch\(|storageMode/);
assert.doesNotMatch(userCapture, /user-input-dedupe|noteRepository|storageMode/);
assert.doesNotMatch(maintenanceController, /querySelector|deleteNotes|storageMode/);
for (const model of ['core/tag-model.js', 'core/capture-model.js', 'core/user-input-model.js']) {
    assert.doesNotMatch(read(model), /document|localStorage|indexedDB|querySelector|fetch\(/);
}
console.log('tag/capture structure tests passed');
