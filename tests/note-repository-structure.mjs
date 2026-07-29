import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const indexSource = read('index.js');
const modelSource = read('core/note-model.js');
const querySource = read('core/note-query-model.js');
const contractSource = read('core/note-repository-contract.js');

assert.doesNotMatch(indexSource, /['"`]\/notes(?:\/|\?|['"`])/);
assert.doesNotMatch(indexSource, /\b(?:getListPath|getCharactersPath|getTagsPath)\s*\(/);
assert.doesNotMatch(indexSource, /\b(?:getAllLiteNotes|getLiteExport|importLiteExport|markLiteExported)\s*\(/);
assert.doesNotMatch(indexSource, /\bdata\.(?:notes|totalNotes)\b/);
assert.doesNotMatch(indexSource, /noteRepository\.(?:listNotes|createNote|updateNote|deleteNote|deleteNotes|importNotes|exportNotes)\(/);
for (const factory of ['createNoteListController', 'createNoteFilterController', 'createNoteMutationController', 'createNoteExportController']) {
    assert.match(indexSource, new RegExp(`${factory}\\(`));
}

const controllers = [
    read('features/note-list-controller.js'),
    read('features/note-filter-controller.js'),
    read('features/note-mutation-controller.js'),
    read('features/note-export-controller.js'),
];
const views = [
    read('features/note-list-view.js'),
    read('features/note-filter-view.js'),
    read('features/note-editor-view.js'),
    read('features/note-import-export-view.js'),
];
controllers.forEach(source => {
    assert.doesNotMatch(source, /\bdocument\.(?:querySelector|querySelectorAll|getElementById)/);
    assert.doesNotMatch(source, /\bstorageMode\b/);
    assert.doesNotMatch(source, /\/api\/|['"`]\/notes/);
});
views.forEach(source => assert.doesNotMatch(source, /\brepository\b|noteRepository\./));
assert.doesNotMatch(read('features/note-mutation-controller.js'), /\/tags|user-input-dedupe/);
assert.doesNotMatch(indexSource, /\bfunction\s+(?:refreshNotes|renderNotes|renderPagination|handleNoteAction|openEditNote|closeEditNote|saveEditedNote|importNotesJson|exportNotes|getNoteQuery)\b/);
assert.doesNotMatch(indexSource, /state\.(?:notes|totalNotes|counts|characters|tags|query|page|pageSize)\s*=/);
assert.doesNotMatch(indexSource, /searchTimer|setTimeout\s*\(\s*refreshNotes/);

for (const [name, source] of [
    ['Note Model', modelSource],
    ['Note Query Model', querySource],
    ['Note Repository Contract', contractSource],
]) {
    assert.doesNotMatch(source, /\b(?:document|localStorage|indexedDB|fetch)\s*(?:\.|\()/, `${name} must remain runtime independent`);
    assert.doesNotMatch(source, /\bstorageMode\b/, `${name} must not branch on Full/Lite mode`);
}

assert.doesNotMatch(indexSource, /state\.storageMode\s*===\s*['"](?:full|lite)['"][\s\S]{0,200}noteRepository\./);

console.log('note repository structure: ok');
