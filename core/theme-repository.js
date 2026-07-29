function normalizeThemeState(data = {}, fallback = {}) {
    const themes = Array.isArray(data.themes)
        ? data.themes
        : (Array.isArray(fallback.themes) ? fallback.themes : []);
    const activeId = String(data.activeId || data.id || fallback.activeId || 'default');
    const activeTheme = data.activeTheme
        || data.theme
        || fallback.activeTheme
        || {};
    return { themes, activeId, activeTheme };
}

export function createThemeRepository({ request }) {
    if (typeof request !== 'function') {
        throw new TypeError('Theme Repository requires a request adapter.');
    }

    async function listThemes() {
        return normalizeThemeState(await request('/themes'));
    }

    async function getActiveTheme() {
        return normalizeThemeState(await request('/theme'));
    }

    async function activateTheme(id) {
        return normalizeThemeState(await request(`/themes/${encodeURIComponent(id || 'default')}/activate`, {
            method: 'POST',
        }));
    }

    async function importTheme(theme, options = {}) {
        return normalizeThemeState(await request('/themes', {
            method: 'POST',
            body: JSON.stringify({
                theme,
                id: options.id || null,
                activate: options.activate !== false,
            }),
        }));
    }

    async function deleteTheme(id) {
        return normalizeThemeState(await request(`/themes/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        }));
    }

    async function openThemeFolder() {
        return request('/themes/folder/open', { method: 'POST' });
    }

    return {
        listThemes,
        getActiveTheme,
        activateTheme,
        importTheme,
        deleteTheme,
        openThemeFolder,
    };
}

export function createModeThemeRepository({ getMode, repositories }) {
    if (typeof getMode !== 'function') {
        throw new TypeError('Mode Theme Repository requires getMode().');
    }

    function current() {
        const repository = repositories?.[getMode()];
        if (!repository) throw new Error('Theme Repository is unavailable for the current storage mode.');
        return repository;
    }

    return {
        listThemes: () => current().listThemes(),
        getActiveTheme: () => current().getActiveTheme(),
        activateTheme: id => current().activateTheme(id),
        importTheme: (theme, options) => current().importTheme(theme, options),
        deleteTheme: id => current().deleteTheme(id),
        openThemeFolder: () => {
            const repository = current();
            if (typeof repository.openThemeFolder !== 'function') {
                throw new Error('Theme folder access is unavailable.');
            }
            return repository.openThemeFolder();
        },
    };
}
