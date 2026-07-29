import assert from 'node:assert/strict';
import {
    buildNoteQueryKey,
    createDefaultNoteQuery,
    DEFAULT_NOTE_PAGE_SIZE,
    normalizeNoteQuery,
    NOTE_TAG_MATCH,
    NOTE_TEXT_CASE,
    validateNoteQuery,
} from '../core/note-query-model.js';

assert.deepEqual(createDefaultNoteQuery(), {
    search: '',
    type: 'all',
    characterId: null,
    chatId: null,
    tags: [],
    sortBy: 'createdAt',
    sortOrder: 'desc',
    page: 1,
    pageSize: 50,
});
assert.equal(DEFAULT_NOTE_PAGE_SIZE, 50);
assert.equal(NOTE_TAG_MATCH, 'and');
assert.equal(NOTE_TEXT_CASE, 'insensitive');

const normalized = normalizeNoteQuery({
    search: '  Hello  ',
    type: 'invalid',
    characterId: 7,
    chatId: '',
    tags: ['Story', 'story', '  Mood  '],
    sortBy: 'bad',
    sortOrder: 'up',
    page: 0,
    pageSize: 9999,
});
assert.deepEqual(normalized, {
    search: 'Hello',
    type: 'all',
    characterId: '7',
    chatId: null,
    tags: ['Story', 'Mood'],
    sortBy: 'createdAt',
    sortOrder: 'desc',
    page: 1,
    pageSize: 500,
});

const validation = validateNoteQuery({ page: -2, pageSize: 'bad', tags: 'Story' });
assert.equal(validation.valid, false);
assert.equal(validation.query.page, 1);
assert.equal(validation.query.pageSize, 50);
assert.deepEqual(validation.query.tags, ['Story']);

assert.equal(
    buildNoteQueryKey({ search: ' HELLO ', tags: ['B', 'a'] }),
    buildNoteQueryKey({ search: 'hello', tags: ['A', 'b'] }),
    'query keys are case-insensitive and tag-order independent',
);

console.log('note query model: ok');
