export const DEFAULT_NOTE_PAGE = 1;
export const DEFAULT_NOTE_PAGE_SIZE = 50;
export const MAX_NOTE_PAGE_SIZE = 500;
export const NOTE_TAG_MATCH = 'and';
export const NOTE_TEXT_CASE = 'insensitive';

const TYPES = new Set(['all', 'user_input', 'excerpt', 'manual']);
const SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'seq', 'id']);
const SORT_ORDERS = new Set(['asc', 'desc']);

function normalizeNullableId(value) {
    if (value === null || value === undefined || value === '') return null;
    return String(value);
}

function normalizeTags(value) {
    const values = Array.isArray(value) ? value : (value ? [value] : []);
    const tags = [];
    for (const item of values) {
        const tag = String(item || '').trim();
        if (!tag || tags.some(existing => existing.toLocaleLowerCase() === tag.toLocaleLowerCase())) continue;
        tags.push(tag);
    }
    return tags;
}

function positiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 1) return fallback;
    return Math.min(Math.floor(number), maximum);
}

export function createDefaultNoteQuery() {
    return {
        search: '',
        type: 'all',
        characterId: null,
        chatId: null,
        tags: [],
        sortBy: 'createdAt',
        sortOrder: 'desc',
        page: DEFAULT_NOTE_PAGE,
        pageSize: DEFAULT_NOTE_PAGE_SIZE,
    };
}

export function normalizeNoteQuery(query = {}) {
    const source = query && typeof query === 'object' && !Array.isArray(query) ? query : {};
    return {
        search: String(source.search ?? '').trim(),
        type: TYPES.has(source.type) ? source.type : 'all',
        characterId: normalizeNullableId(source.characterId),
        chatId: normalizeNullableId(source.chatId),
        tags: normalizeTags(source.tags),
        sortBy: SORT_FIELDS.has(source.sortBy) ? source.sortBy : 'createdAt',
        sortOrder: SORT_ORDERS.has(source.sortOrder) ? source.sortOrder : 'desc',
        page: positiveInteger(source.page, DEFAULT_NOTE_PAGE),
        pageSize: positiveInteger(source.pageSize, DEFAULT_NOTE_PAGE_SIZE, MAX_NOTE_PAGE_SIZE),
    };
}

export function validateNoteQuery(query) {
    const normalized = normalizeNoteQuery(query);
    const errors = [];
    if (!query || typeof query !== 'object' || Array.isArray(query)) errors.push('query:not-object');
    else {
        if (query.type !== undefined && !TYPES.has(query.type)) errors.push('type:invalid');
        if (query.sortBy !== undefined && !SORT_FIELDS.has(query.sortBy)) errors.push('sortBy:invalid');
        if (query.sortOrder !== undefined && !SORT_ORDERS.has(query.sortOrder)) errors.push('sortOrder:invalid');
        if (query.page !== undefined && normalized.page !== Number(query.page)) errors.push('page:normalized');
        if (query.pageSize !== undefined && normalized.pageSize !== Number(query.pageSize)) errors.push('pageSize:normalized');
        if (query.tags !== undefined && !Array.isArray(query.tags)) errors.push('tags:normalized');
    }
    return { valid: errors.length === 0, errors, query: normalized };
}

export function buildNoteQueryKey(query) {
    const normalized = normalizeNoteQuery(query);
    return JSON.stringify({
        ...normalized,
        search: normalized.search.toLocaleLowerCase(),
        tags: normalized.tags.map(tag => tag.toLocaleLowerCase()).sort(),
    });
}
