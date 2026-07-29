export class UserInputMaintenanceError extends Error {
    constructor(code, message, options = {}) {
        super(message, options);
        this.name = 'UserInputMaintenanceError';
        this.code = code;
    }
}

function normalize(result = {}) {
    return {
        ...result,
        scanned: Number(result.scanned || result.totalNotes || 0),
        groups: Number(result.groups || result.duplicateGroups || 0),
        removed: Number(result.removed || result.duplicateNotes || 0),
        updated: Number(result.updated || 0),
        items: Array.isArray(result.items) ? result.items : [],
    };
}

export function createFullUserInputMaintenanceRepository({ request }) {
    return {
        async preview(options = {}) {
            try { return normalize(await request('/user-input-dedupe', { signal: options.signal })); }
            catch (error) { throw new UserInputMaintenanceError('MAINTENANCE_FAILED', error.message, { cause: error }); }
        },
        async apply(options = {}) {
            try {
                return normalize(await request('/user-input-dedupe', {
                    method: 'POST',
                    body: JSON.stringify({ ids: options.ids || [] }),
                    signal: options.signal,
                }));
            } catch (error) { throw new UserInputMaintenanceError('MAINTENANCE_FAILED', error.message, { cause: error }); }
        },
    };
}
