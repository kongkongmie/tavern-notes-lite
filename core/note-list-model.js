import { normalizeNoteQuery } from './note-query-model.js';

export const NOTE_UI_QUERY = Object.freeze({
    search: '',
    type: 'all',
    characterId: null,
    chatId: null,
    tags: [],
    sortBy: 'seq',
    sortOrder: 'desc',
    page: 1,
    pageSize: 15,
});

export const NOTE_LIST_INITIAL_STATE = Object.freeze({
    items: [],
    total: 0,
    counts: {},
    characters: [],
    tags: [],
    loading: false,
    error: null,
    loaded: false,
});

export const NOTE_UI_INITIAL_STATE = Object.freeze({
    editingId: null,
    submitting: false,
    importRunning: false,
    exportRunning: false,
});

export function createNoteUiQuery(patch = {}) {
    return normalizeNoteQuery({ ...NOTE_UI_QUERY, ...patch });
}

export function getNoteMaxPage(total, pageSize = NOTE_UI_QUERY.pageSize) {
    return Math.max(1, Math.ceil(Math.max(0, Number(total) || 0) / Math.max(1, Number(pageSize) || NOTE_UI_QUERY.pageSize)));
}

export function clampNotePage(page, total, pageSize) {
    return Math.min(Math.max(1, Math.floor(Number(page) || 1)), getNoteMaxPage(total, pageSize));
}

export function createNoteListCommit(result) {
    return {
        items: Array.isArray(result?.items) ? result.items : [],
        total: Math.max(0, Number(result?.total) || 0),
        counts: result?.counts && typeof result.counts === 'object' ? result.counts : {},
        characters: Array.isArray(result?.characters) ? result.characters : [],
        tags: Array.isArray(result?.tags) ? result.tags : [],
        loading: false,
        error: null,
        loaded: true,
    };
}
