export function createThemeController({
    repository,
    view,
    renderer = view,
    themeModel,
    defaultTheme,
    appleThemeId,
    capabilities = {},
    getThemeState,
    patchThemeState,
    persistThemeSettings,
    translate,
    notify,
    confirm,
    beforeOpen = () => {},
}) {
    const t = translate;
    let mounted = false;
    let studio = null;

    const isAppleThemeId = id => themeModel.isAppleThemeId(themeModel.normalizeAppleThemeId(id));
    const normalizeId = id => themeModel.normalizeAppleThemeId(id || 'default');
    const hasTheme = theme => theme && typeof theme === 'object' && Object.keys(theme).length > 0;

    function state() {
        return getThemeState();
    }

    function renderState(nextState, options = {}) {
        view.render(nextState, {
            isAppleThemeId,
            labelKey: options.labelKey || 'currentTheme',
        });
    }

    function applyResolved(theme, nextState) {
        return renderer.applyTheme(theme || defaultTheme, nextState, themeModel);
    }

    function commitRepositoryState(result, fallbackTheme = defaultTheme) {
        const previous = state();
        const activeId = normalizeId(result?.activeId || previous.activeId);
        const themes = Array.isArray(result?.themes) ? result.themes : previous.themes;
        const sourceTheme = hasTheme(result?.activeTheme) ? result.activeTheme : fallbackTheme;
        const provisional = {
            ...previous,
            themes,
            activeId,
            previewTheme: null,
            previewActive: false,
            draft: false,
        };
        const theme = applyResolved(sourceTheme, provisional);
        const nextState = { ...provisional, theme };
        patchThemeState({
            themes,
            activeId,
            theme,
            previewTheme: null,
            previewActive: false,
            draft: false,
        });
        renderState(nextState);
        studio?.syncEditor(theme);
        return nextState;
    }

    async function load() {
        try {
            return commitRepositoryState(await repository.listThemes());
        } catch {
            try {
                return commitRepositoryState(await repository.getActiveTheme());
            } catch {
                const previous = state();
                const fallback = applyResolved(defaultTheme, { ...previous, activeId: 'default' });
                patchThemeState({
                    activeId: 'default',
                    theme: fallback,
                    previewTheme: null,
                    previewActive: false,
                    draft: false,
                });
                const nextState = {
                    ...previous,
                    activeId: 'default',
                    theme: fallback,
                    previewTheme: null,
                    previewActive: false,
                    draft: false,
                };
                renderState(nextState);
                studio?.syncEditor(fallback);
                return nextState;
            }
        }
    }

    async function refresh() {
        return commitRepositoryState(await repository.listThemes());
    }

    async function activateTheme(id, options = {}) {
        const nextState = commitRepositoryState(
            await repository.activateTheme(normalizeId(id)),
            defaultTheme,
        );
        if (options.notify !== false) notify(t('switchedTheme'), 'success');
        return nextState;
    }

    async function saveTheme(theme, options = {}) {
        const clean = themeModel.normalizeTheme(theme);
        const current = state();
        const activate = options.activate !== false;
        const requestedId = options.id;
        const id = !requestedId || requestedId === 'default' || isAppleThemeId(requestedId)
            ? null
            : requestedId;
        const nextState = commitRepositoryState(
            await repository.importTheme(clean, { id, activate }),
            clean,
        );
        if (options.notifyKey) notify(t(options.notifyKey), 'success');
        return nextState;
    }

    async function importThemeFile(file) {
        const theme = JSON.parse(await file.text());
        if (theme.format && theme.format !== 'tavern-notes-theme') {
            throw new Error(t('invalidThemeFile'));
        }
        const nextState = await saveTheme(theme, { id: null });
        notify(t('importedTheme'), 'success');
        return nextState;
    }

    async function deleteSelectedTheme() {
        const current = state();
        const id = view.getSelectedThemeId() || current.activeId;
        if (!id || id === 'default' || isAppleThemeId(id)) {
            notify(t(id === 'default' ? 'defaultThemeCannotDelete' : 'builtInThemeCannotDelete'), 'warning');
            return current;
        }
        const selected = current.themes.find(theme => theme.id === id);
        if (!confirm(t('confirmDeleteTheme', { name: selected?.name || id }))) return current;
        const nextState = commitRepositoryState(
            await repository.deleteTheme(id),
            current.theme || defaultTheme,
        );
        notify(t('deletedTheme'), 'success');
        return nextState;
    }

    function previewTheme(theme, options = {}) {
        const previous = state();
        const provisional = {
            ...previous,
            previewActive: true,
            draft: options.draft === true || previous.draft,
        };
        const preview = applyResolved(theme, provisional);
        const nextState = { ...provisional, previewTheme: preview };
        patchThemeState({
            previewTheme: preview,
            previewActive: true,
            draft: provisional.draft,
        });
        renderState(nextState, { labelKey: options.labelKey || 'previewTheme' });
        if (options.notifyKey) notify(t(options.notifyKey), 'success');
        return preview;
    }

    function revertThemePreview() {
        const current = state();
        if (!current.previewActive) return current.theme;
        const restored = applyResolved(current.theme || defaultTheme, current);
        const nextState = {
            ...current,
            theme: restored,
            previewTheme: null,
            previewActive: false,
            draft: false,
        };
        patchThemeState({
            theme: restored,
            previewTheme: null,
            previewActive: false,
            draft: false,
        });
        renderState(nextState);
        return restored;
    }

    async function toggleAppleThemeMode() {
        const previous = state();
        if (normalizeId(previous.activeId) === 'default') {
            const defaultMode = previous.defaultMode === 'night' ? 'day' : 'night';
            const provisional = { ...previous, defaultMode };
            try {
                const theme = applyResolved(defaultTheme, provisional);
                patchThemeState({ defaultMode, theme });
                await persistThemeSettings();
                renderState({ ...provisional, theme });
                studio?.syncEditor(theme);
                notify(t(defaultMode === 'night' ? 'defaultThemeNightOn' : 'defaultThemeDayOn'), 'success');
                return;
            } catch (error) {
                patchThemeState({ defaultMode: previous.defaultMode, theme: previous.theme });
                applyResolved(previous.theme || defaultTheme, previous);
                throw error;
            }
        }
        if (!isAppleThemeId(previous.activeId)) {
            await activateTheme(appleThemeId);
            return;
        }
        const appleMode = previous.appleMode === 'night' ? 'day' : 'night';
        const provisional = { ...previous, appleMode };
        try {
            const theme = applyResolved(previous.theme || defaultTheme, provisional);
            patchThemeState({ appleMode, theme });
            await persistThemeSettings();
            renderState({ ...provisional, theme });
            studio?.syncEditor(theme);
            notify(t('appleThemeEnabled'), 'success');
        } catch (error) {
            patchThemeState({ appleMode: previous.appleMode, theme: previous.theme });
            applyResolved(previous.theme || defaultTheme, previous);
            throw error;
        }
    }

    async function openThemeFolder() {
        if (!capabilities.openThemeFolder) return;
        await repository.openThemeFolder();
        notify(t('requestedThemeFolder'), 'success');
    }

    function exportTheme() {
        if (!capabilities.exportTheme) return;
        const theme = studio?.getThemeFromEditor() || state().theme || defaultTheme;
        view.downloadTheme(theme);
    }

    async function open() {
        beforeOpen();
        if (view.isOpen()) {
            close();
            return;
        }
        studio?.syncEditor(state().theme || defaultTheme);
        refresh().catch(() => {});
        view.open();
    }

    function close() {
        revertThemePreview();
        view.close();
    }

    function report(promiseOrValue) {
        Promise.resolve(promiseOrValue).catch(error => notify(error.message, 'error'));
    }

    function mount() {
        if (mounted) destroy();
        view.mount({
            toggle: () => report(open()),
            close,
            activate: id => report(activateTheme(id)),
            import: file => report(importThemeFile(file)),
            delete: () => report(deleteSelectedTheme()),
            export: exportTheme,
            openFolder: () => report(openThemeFolder()),
            reset: () => report(activateTheme('default')),
            toggleMode: () => report(toggleAppleThemeMode()),
        });
        studio?.mount();
        mounted = true;
    }

    function destroy() {
        view.destroy();
        studio?.destroy();
        mounted = false;
    }

    function attachStudio(nextStudio) {
        if (studio === nextStudio) return;
        studio?.destroy();
        studio = capabilities.themeStudio ? nextStudio : null;
        if (mounted) studio?.mount();
    }

    function setDraft(draft) {
        patchThemeState({ draft: Boolean(draft) });
    }

    function render() {
        renderState(state());
    }

    return {
        mount,
        destroy,
        isMounted: () => mounted,
        attachStudio,
        load,
        refresh,
        open,
        close,
        activateTheme,
        saveTheme,
        importThemeFile,
        deleteSelectedTheme,
        previewTheme,
        revertThemePreview,
        toggleAppleThemeMode,
        exportTheme,
        openThemeFolder,
        getThemeState: state,
        setDraft,
        render,
        isAppleThemeId,
    };
}
