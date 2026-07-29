import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = [
    fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8'),
    fs.readFileSync(new URL('../repositories/lite-app-shell-markup.js', import.meta.url), 'utf8'),
    fs.readFileSync(new URL('../features/app-shell-markup.js', import.meta.url), 'utf8'),
].join('\n');
const controller = fs.readFileSync(new URL('../features/note-detail-controller.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
for (const action of ['fill', 'copy', 'share', 'edit', 'delete']) {
    assert.match(source, new RegExp(`data-modal-action="${action}"`));
}
assert.match(source, /createNoteDetailController/);
assert.doesNotMatch(source, /state\.detailNote = note/);
for (const action of ['copy', 'fill', 'share', 'edit', 'delete']) {
    assert.match(controller, new RegExp(`name === '${action}'`));
}
assert.match(css, /\.tnl-modal-actions\s*\{/);
assert.match(css, /grid-template-columns:\s*repeat\(5/);
console.log('Lite detail-card actions test passed.');
