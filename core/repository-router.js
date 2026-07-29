export const STORAGE_MODES = Object.freeze({
    FULL: 'full',
    LITE: 'lite',
});

export function isStorageMode(value) {
    return value === STORAGE_MODES.FULL || value === STORAGE_MODES.LITE;
}

export function createRepositoryRouter({
    getMode,
    serverRequest,
    liteRequest,
    localThemeRequest,
    getLiteUser,
    getRuntimeVersion,
}) {
    if (typeof getMode !== 'function' || typeof serverRequest !== 'function' || typeof liteRequest !== 'function') {
        throw new TypeError('Repository router requires mode, server, and Lite adapters.');
    }

    return async function repositoryRequest(path, options = {}) {
        if (getMode() !== STORAGE_MODES.LITE) return serverRequest(path, options);
        if (String(path).startsWith('/theme') && typeof localThemeRequest === 'function') {
            const themed = await localThemeRequest(path, options);
            if (themed) return themed;
        }
        return liteRequest(
            path,
            options,
            typeof getLiteUser === 'function' ? getLiteUser() : 'default-user',
            typeof getRuntimeVersion === 'function' ? getRuntimeVersion() : undefined,
        );
    };
}
