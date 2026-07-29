import assert from 'node:assert/strict';
import {
    normalizeNote,
    normalizeNoteInput,
    normalizeNotePatch,
    normalizeNoteTags,
    NoteValidationError,
} from '../core/note-model.js';

assert.deepEqual(normalizeNoteTags([' Story ', 'story', '#Mood', '', 'MOOd']), ['Story', 'Mood']);

const input = normalizeNoteInput({
    content: '  hello  ',
    type: 'invalid',
    tags: ['One', 'one', 'Two'],
});
assert.equal(input.id, '');
assert.equal(input.content, 'hello');
assert.equal(input.type, 'manual');
assert.deepEqual(input.tags, ['One', 'Two']);
assert.deepEqual(input.character, { id: null, name: '未命名角色', avatar: null, isUser: false });
assert.deepEqual(input.chat, { id: null, name: '', messageId: null });

const note = normalizeNote({
    ...input,
    id: 42,
    seq: '7',
    createdAt: '2026-01-01T00:00:00.000Z',
    variants: [
        { ...input, id: 'variant', content: 'variant' },
    ],
});
assert.equal(note.id, '42');
assert.equal(note.seq, 7);
assert.equal(note.updatedAt, note.createdAt);
assert.equal(note.variants[0].id, 'variant');

assert.deepEqual(normalizeNotePatch({ content: ' edited ', tags: ['A', 'a'] }), {
    content: 'edited',
    tags: ['A'],
});
assert.throws(() => normalizeNote({ content: 'missing id' }), NoteValidationError);
assert.throws(() => normalizeNoteInput({ content: '   ' }), NoteValidationError);

console.log('note model: ok');
