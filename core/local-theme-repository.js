export function createLocalThemeRepository({
    storage,
    themeStorageKey,
    activeThemeKey,
    appleThemeId,
    getBuiltInThemes,
    normalizeTheme,
    normalizeThemeId = value => value,
    isRetiredTheme = () => false,
    translate = key => key,
    maxCustomThemes = 20,
}) {
    function readCustomThemes() {
        try {
            const themes = JSON.parse(storage.getItem(themeStorageKey) || '[]');
            const valid = Array.isArray(themes) ? themes.filter(item => item?.id && item?.theme) : [];
            const safe = valid.filter(item => !isRetiredTheme(item));
            if (safe.length !== valid.length) writeCustomThemes(safe);
            return safe;
        } catch {
            return [];
        }
    }

    function writeCustomThemes(themes) {
        storage.setItem(themeStorageKey, JSON.stringify(themes.slice(0, maxCustomThemes)));
    }

    function getRecords() {
        return [...getBuiltInThemes(), ...readCustomThemes()];
    }

    function getActiveId() {
        const requested = normalizeThemeId(storage.getItem(activeThemeKey) || 'default');
        return getRecords().some(item => item.id === requested) ? requested : 'default';
    }

    function response() {
        const records = getRecords();
        const activeId = getActiveId();
        const active = records.find(item => item.id === activeId) || records[0];
        return {
            ok: true,
            activeId,
            id: activeId,
            theme: active.theme,
            activeTheme: active.theme,
            themes: records.map(({ theme, ...summary }) => ({ ...summary, name: theme?.name || summary.name })),
        };
    }

    return async function localThemeRequest(path, options = {}) {
        const url = new URL(path, 'https://tavern-notes.local');
        const method = String(options.method || 'GET').toUpperCase();
        if ((url.pathname === '/theme' || url.pathname === '/themes') && method === 'GET') return response();

        const activation = url.pathname.match(/^\/themes\/([^/]+)\/activate$/);
        if (activation && method === 'POST') {
            const id = normalizeThemeId(decodeURIComponent(activation[1]));
            if (!getRecords().some(item => item.id === id)) throw new Error(translate('invalidThemeFile'));
            storage.setItem(activeThemeKey, id);
            return response();
        }

        if (url.pathname === '/themes' && method === 'POST') {
            const payload = typeof options.body === 'string' ? JSON.parse(options.body) : (options.body || {});
            const theme = normalizeTheme(payload.theme || {});
            const existingId = payload.id && !['default', appleThemeId].includes(payload.id) ? String(payload.id) : '';
            const id = existingId || `custom-${Date.now().toString(36)}`;
            if (isRetiredTheme({ id, name: theme.name, theme })) throw new Error(translate('invalidThemeFile'));
            const customThemes = readCustomThemes().filter(item => item.id !== id);
            customThemes.push({ id, name: theme.name || translate('unnamedTheme'), author: theme.author || '', builtIn: false, theme });
            writeCustomThemes(customThemes);
            if (payload.activate !== false) storage.setItem(activeThemeKey, id);
            return { ...response(), id };
        }

        const deletion = url.pathname.match(/^\/themes\/([^/]+)$/);
        if (deletion && method === 'DELETE') {
            const id = decodeURIComponent(deletion[1]);
            if (['default', appleThemeId].includes(id)) throw new Error(translate('builtInThemeCannotDelete'));
            writeCustomThemes(readCustomThemes().filter(item => item.id !== id));
            storage.setItem(activeThemeKey, 'default');
            return response();
        }
        return null;
    };
}
