import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'index.js'), 'utf8');

for (const functionName of ['ensureSelectionCaptureButton', 'updateSelectionCaptureButton', 'scheduleSelectionCaptureButton']) {
    const match = source.match(new RegExp(`function ${functionName}\\([^)]*\\) \\{([\\s\\S]*?)\\n\\}`));
    assert.ok(match, `Missing ${functionName}.`);
    assert.match(match[1], /state\.disabledByFull/, `${functionName} must stop after Full takes priority.`);
}

const disableBody = source.match(/function disableLiteForFull\(\) \{([\s\S]*?)\n\}/)?.[1] || '';
assert.match(disableBody, /clearTimeout\(state\.selectionButtonTimer\)/);
assert.match(disableBody, /state\.lastSelection = null/);
console.log('Lite coexistence shutdown static smoke test passed.');
