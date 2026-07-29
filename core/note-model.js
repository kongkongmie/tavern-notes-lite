export const NOTE_TYPES = Object.freeze(['user_input', 'excerpt', 'manual']);
export const MAX_NOTE_CONTENT_LENGTH = 200000;
export const MAX_NOTE_TAGS = 20;
export const MAX_NOTE_TAG_LENGTH = 40;

export class NoteValidationError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'NoteValidationError';
        this.code = 'INVALID_NOTE';
        this.details = details;
    }
}

function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
}

function optionalNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

export function normalizeNoteTags(tags) {
    const values = Array.isArray(tags) ? tags : String(tags || '').split(/[,，\n]/);
    const normalized = [];
    for (const value of values) {
        const tag = String(value || '').trim().replace(/^#+/, '').slice(0, MAX_NOTE_TAG_LENGTH);
        if (!tag || normalized.some(item => item.toLocaleLowerCase() === tag.toLocaleLowerCase())) continue;
        normalized.push(tag);
        if (normalized.length >= MAX_NOTE_TAGS) break;
    }
    return normalized;
}

export function normalizeNote(raw, {
    allowMissingId = false,
    allowMissingContent = false,
} = {}) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new NoteValidationError('Note must be an object.');
    }
    const id = raw.id === null || raw.id === undefined ? '' : String(raw.id);
    const content = String(raw.content || '').trim();
    if (!allowMissingId && !id) throw new NoteValidationError('Note id is required.', { field: 'id' });
    if (!allowMissingContent && !content) throw new NoteValidationError('Note content is required.', { field: 'content' });

    const note = {
        ...clone(raw),
        id,
        seq: optionalNumber(raw.seq),
        type: NOTE_TYPES.includes(raw.type) ? raw.type : 'manual',
        content: content.slice(0, MAX_NOTE_CONTENT_LENGTH),
        createdAt: raw.createdAt ? String(raw.createdAt) : '',
        updatedAt: raw.updatedAt ? String(raw.updatedAt) : (raw.createdAt ? String(raw.createdAt) : ''),
        character: {
            id: raw.character?.id ?? null,
            name: String(raw.character?.name || '未命名角色'),
            avatar: raw.character?.avatar ?? null,
            isUser: raw.character?.isUser === true,
        },
        chat: {
            id: raw.chat?.id ?? null,
            name: String(raw.chat?.name || ''),
            messageId: optionalNumber(raw.chat?.messageId),
        },
        source: String(raw.source || ''),
        tags: normalizeNoteTags(raw.tags),
        repeatCount: Math.max(1, Number.isFinite(Number(raw.repeatCount)) ? Number(raw.repeatCount) : 1),
        lastRepeatedAt: raw.lastRepeatedAt ? String(raw.lastRepeatedAt) : null,
        latestMessageId: optionalNumber(raw.latestMessageId ?? raw.chat?.messageId),
    };
    if (Array.isArray(raw.variants)) {
        note.variants = raw.variants.map(variant => normalizeNote(variant));
        note.variantCount = Number.isFinite(Number(raw.variantCount))
            ? Number(raw.variantCount)
            : note.variants.length;
    }
    return note;
}

export function normalizeNoteInput(raw) {
    return normalizeNote(raw, { allowMissingId: true });
}

export function normalizeNotePatch(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new NoteValidationError('Note patch must be an object.');
    }
    const patch = clone(raw);
    if ('content' in patch) {
        const content = String(patch.content || '').trim();
        if (!content) throw new NoteValidationError('Note content is required.', { field: 'content' });
        patch.content = content.slice(0, MAX_NOTE_CONTENT_LENGTH);
    }
    if ('tags' in patch) patch.tags = normalizeNoteTags(patch.tags);
    return patch;
}
