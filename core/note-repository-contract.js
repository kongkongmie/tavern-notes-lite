import { normalizeNote } from './note-model.js';
import { normalizeNoteQuery } from './note-query-model.js';

export const NOTE_REPOSITORY_ERROR_CODES = Object.freeze({
    NOTE_NOT_FOUND: 'NOTE_NOT_FOUND',
    INVALID_NOTE: 'INVALID_NOTE',
    INVALID_QUERY: 'INVALID_QUERY',
    STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
    REQUEST_FAILED: 'REQUEST_FAILED',
    WRITE_FAILED: 'WRITE_FAILED',
    DELETE_FAILED: 'DELETE_FAILED',
    IMPORT_FAILED: 'IMPORT_FAILED',
});

export const NOTE_REPOSITORY_METHODS = Object.freeze([
    'listNotes',
    'getNote',
    'createNote',
    'updateNote',
    'deleteNote',
    'deleteNotes',
    'importNotes',
    'exportNotes',
]);

export class NoteRepositoryError extends Error {
    constructor(code, message, options = {}) {
        super(message, options.cause ? { cause: options.cause } : undefined);
        this.name = 'NoteRepositoryError';
        this.code = NOTE_REPOSITORY_ERROR_CODES[code] || NOTE_REPOSITORY_ERROR_CODES.REQUEST_FAILED;
        this.operation = options.operation || '';
        this.status = options.status ?? null;
        this.details = options.details || null;
    }
}

export function assertNoteRepository(repository) {
    if (!repository || typeof repository !== 'object') {
        throw new TypeError('Note Repository must be an object.');
    }
    for (const method of NOTE_REPOSITORY_METHODS) {
        if (typeof repository[method] !== 'function') {
            throw new TypeError(`Note Repository is missing ${method}().`);
        }
    }
    return repository;
}

export function resolveNoteRepositoryQuery(query = {}) {
    if (!query || typeof query !== 'object' || Array.isArray(query)) {
        throw new NoteRepositoryError('INVALID_QUERY', 'Note query must be an object.', {
            operation: 'listNotes',
        });
    }
    return normalizeNoteQuery(query);
}

function noteMatchesSearch(note, search) {
    if (!search) return true;
    const needle = search.toLocaleLowerCase();
    return [
        note.content,
        note.character?.name,
        note.chat?.name,
        ...(note.tags || []),
    ].join('\n').toLocaleLowerCase().includes(needle);
}

function noteMatchesTags(note, tags) {
    if (!tags.length) return true;
    const noteTags = new Set((note.tags || []).map(tag => tag.toLocaleLowerCase()));
    return tags.every(tag => noteTags.has(tag.toLocaleLowerCase()));
}

function noteMatchesId(value, expected) {
    return expected === null || String(value ?? '') === expected;
}

function countTypes(notes) {
    return {
        all: notes.length,
        user_input: notes.filter(note => note.type === 'user_input').length,
        excerpt: notes.filter(note => note.type === 'excerpt').length,
        manual: notes.filter(note => note.type === 'manual').length,
    };
}

function summarizeCharacters(notes) {
    const summaries = new Map();
    for (const note of notes) {
        const character = note.character || {};
        const key = [character.id ?? '', character.avatar ?? '', character.name ?? ''].join('|');
        if (!summaries.has(key)) {
            summaries.set(key, {
                id: character.id ?? null,
                name: character.name || '未命名角色',
                avatar: character.avatar ?? null,
                isUser: character.isUser === true,
                total: 0,
                userInput: 0,
                excerpt: 0,
                manual: 0,
                latestAt: note.createdAt || '',
            });
        }
        const summary = summaries.get(key);
        summary.total += 1;
        if (note.type === 'user_input') summary.userInput += 1;
        else if (note.type === 'excerpt') summary.excerpt += 1;
        else summary.manual += 1;
        if (String(note.createdAt || '') > summary.latestAt) summary.latestAt = note.createdAt;
    }
    return [...summaries.values()].sort((left, right) => (
        Number(right.isUser) - Number(left.isUser)
        || String(right.latestAt).localeCompare(String(left.latestAt))
        || left.name.localeCompare(right.name)
    ));
}

function summarizeTags(notes) {
    const summaries = new Map();
    for (const note of notes) {
        for (const tag of note.tags || []) {
            const key = tag.toLocaleLowerCase();
            const summary = summaries.get(key) || { name: tag, count: 0 };
            summary.count += 1;
            summaries.set(key, summary);
        }
    }
    return [...summaries.values()].sort((left, right) => (
        right.count - left.count || left.name.localeCompare(right.name)
    ));
}

function compareSortValues(left, right, field) {
    if (field === 'seq') return Number(left.seq ?? 0) - Number(right.seq ?? 0);
    return String(left[field] ?? '').localeCompare(String(right[field] ?? ''));
}

export function createNoteListResult(raw, query) {
    const normalizedQuery = normalizeNoteQuery(query);
    const items = (raw?.items || raw?.notes || []).map(note => normalizeNote(note));
    const total = Math.max(0, Number(raw?.total ?? raw?.totalNotes ?? items.length) || 0);
    return {
        items,
        total,
        page: normalizedQuery.page,
        pageSize: normalizedQuery.pageSize,
        hasMore: normalizedQuery.page * normalizedQuery.pageSize < total,
        counts: raw?.counts && typeof raw.counts === 'object' ? { ...raw.counts } : {},
        characters: Array.isArray(raw?.characters) ? raw.characters.map(item => ({ ...item })) : [],
        tags: Array.isArray(raw?.tags) ? raw.tags.map(item => ({ ...item })) : [],
    };
}

export function queryNoteCollection(rawNotes, query, options = {}) {
    const normalizedQuery = normalizeNoteQuery(query);
    const notes = (Array.isArray(rawNotes) ? rawNotes : []).map((note, index) => ({
        note: normalizeNote(note),
        index,
    }));
    const visible = options.includeUserInput === false
        ? notes.filter(({ note }) => note.type !== 'user_input' || note.source === 'manual_inspiration')
        : notes;
    const base = visible.filter(({ note }) => (
        noteMatchesSearch(note, normalizedQuery.search)
        && noteMatchesTags(note, normalizedQuery.tags)
    ));
    const tagScope = visible.filter(({ note }) => (
        noteMatchesId(note.character?.id, normalizedQuery.characterId)
        && noteMatchesId(note.chat?.id, normalizedQuery.chatId)
    ));
    const filtered = base.filter(({ note }) => (
        (normalizedQuery.type === 'all' || note.type === normalizedQuery.type)
        && noteMatchesId(note.character?.id, normalizedQuery.characterId)
        && noteMatchesId(note.chat?.id, normalizedQuery.chatId)
    ));
    const direction = normalizedQuery.sortOrder === 'asc' ? 1 : -1;
    filtered.sort((left, right) => (
        compareSortValues(left.note, right.note, normalizedQuery.sortBy) * direction
        || left.index - right.index
    ));
    const offset = (normalizedQuery.page - 1) * normalizedQuery.pageSize;
    return createNoteListResult({
        items: filtered.slice(offset, offset + normalizedQuery.pageSize).map(item => item.note),
        total: filtered.length,
        counts: countTypes(base.map(item => item.note)),
        characters: summarizeCharacters(base.map(item => item.note)),
        tags: summarizeTags(tagScope.map(item => item.note)),
    }, normalizedQuery);
}

export function normalizeDeleteResult(id) {
    return { id: String(id) };
}

export function normalizeDeleteManyResult(ids) {
    const normalized = [...new Set((Array.isArray(ids) ? ids : []).map(id => String(id)).filter(Boolean))];
    return { ids: normalized, count: normalized.length };
}

export function toNoteRepositoryError(error, {
    operation = '',
    fallbackCode = 'REQUEST_FAILED',
} = {}) {
    if (error instanceof NoteRepositoryError) return error;
    const status = Number(error?.status);
    const name = String(error?.name || '');
    const message = String(error?.message || 'Note Repository operation failed.');
    let code = fallbackCode;
    if (error?.code === 'INVALID_NOTE' || /content is empty|content is required|invalid note/i.test(message)) code = 'INVALID_NOTE';
    else if (status === 404 || /note not found/i.test(message)) code = 'NOTE_NOT_FOUND';
    else if (error?.code === 'backend_unreachable' || error?.code === 'backend_missing' || /indexeddb.*(?:unavailable|blocked)|storage.*unavailable/i.test(message)) code = 'STORAGE_UNAVAILABLE';
    else if (name === 'QuotaExceededError' || /quota|disk full|capacity/i.test(message)) {
        code = operation === 'importNotes' ? 'IMPORT_FAILED' : 'WRITE_FAILED';
    }
    return new NoteRepositoryError(code, message, {
        cause: error,
        operation,
        status: Number.isFinite(status) ? status : null,
    });
}
