export class TagRepositoryError extends Error {
    constructor(code, message, options = {}) {
        super(message, options);
        this.name = 'TagRepositoryError';
        this.code = code;
    }
}

function validate(value) {
    const name = String(value || '').trim();
    if (!name || name.length > 40) throw new TagRepositoryError('INVALID_TAG', 'Invalid tag');
    return name;
}

function convert(error, fallback) {
    if (error instanceof TagRepositoryError) return error;
    const status = Number(error?.status || 0);
    if (status === 404) return new TagRepositoryError('TAG_NOT_FOUND', error.message, { cause: error });
    if (status === 409) return new TagRepositoryError('TAG_CONFLICT', error.message, { cause: error });
    return new TagRepositoryError(fallback, error?.message || fallback, { cause: error });
}

export function createFullTagRepository({ request }) {
    return {
        async renameTag(oldName, newName) {
            const oldTag = validate(oldName);
            const next = validate(newName);
            try {
                const result = await request(`/tags/${encodeURIComponent(oldTag)}`, { method: 'PATCH', body: JSON.stringify({ name: next }) });
                return { affectedNotes: Number(result.updated || 0), oldName: oldTag, newName: result.newTag || next };
            } catch (error) { throw convert(error, 'TAG_WRITE_FAILED'); }
        },
        async deleteTag(tagName) {
            const tag = validate(tagName);
            try {
                const result = await request(`/tags/${encodeURIComponent(tag)}`, { method: 'DELETE' });
                return { affectedNotes: Number(result.updated || 0), deletedTag: tag };
            } catch (error) { throw convert(error, 'TAG_DELETE_FAILED'); }
        },
    };
}
