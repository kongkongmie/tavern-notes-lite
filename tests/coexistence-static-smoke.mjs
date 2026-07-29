import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const captureView = fs.readFileSync(path.join(root, 'features', 'capture-view.js'), 'utf8');
const coexistence = fs.readFileSync(path.join(root, 'features', 'coexistence-controller.js'), 'utf8');
const application = fs.readFileSync(path.join(root, 'services', 'application.js'), 'utf8');

assert.match(source, /createCoexistenceController/);
assert.match(coexistence, /application\?\.pause\?\.\(reason\)/);
assert.match(coexistence, /removeLiteUi\(\)/);
assert.match(application, /while \(mounted\.length\)/);
assert.match(source, /const applicationLifecycle = createLifecycleRegistry\(\)/);
assert.match(source, /applicationLifecycle\.destroyAll\(\)/);
assert.match(source, /const noteFeatureLifecycle = createLifecycleRegistry\(\)/);
assert.match(source, /noteFeatureLifecycle\.destroyAll\(\)/);
assert.match(captureView, /function destroy\(\)[\s\S]*?observer\?\.disconnect\(\)/);
console.log('Lite coexistence shutdown static smoke test passed.');
