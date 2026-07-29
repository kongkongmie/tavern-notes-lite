import assert from 'node:assert/strict';
import { createAppStore } from '../core/app-store.js';
import { createThemeController } from '../features/theme-controller.js';

function createHarness(overrides = {}) {
    const store = createAppStore({ theme: {
        themes: [{ id: 'default', name: 'Default' }],
        activeId: 'default',
        theme: { name: 'Official', variables: {}, assets: {} },
        previewTheme: null,
        previewActive: false,
        draft: false,
        appleMode: 'day',
        defaultMode: 'day',
    } });
    const getThemeState = () => store.getSlice('theme');
    let handlers = null;
    let mountCount = 0;
    let destroyCount = 0;
    let persistCount = 0;
    let downloadCount = 0;
    const view = {
        mount(nextHandlers) { handlers = nextHandlers; mountCount += 1; },
        destroy() { handlers = null; destroyCount += 1; },
        render() {},
        applyTheme(theme) { return structuredClone(theme); },
        getSelectedThemeId() { return 'custom'; },
        isOpen() { return false; },
        open() {},
        close() {},
        downloadTheme() { downloadCount += 1; },
    };
    const repository = {
        async listThemes() {
            const themeState = getThemeState();
            return { themes: themeState.themes, activeId: 'default', activeTheme: themeState.theme };
        },
        async getActiveTheme() {
            const themeState = getThemeState();
            return { themes: themeState.themes, activeId: 'default', activeTheme: themeState.theme };
        },
        async activateTheme(id) {
            const themeState = getThemeState();
            return { themes: themeState.themes, activeId: id, activeTheme: { name: id, variables: {}, assets: {} } };
        },
        async importTheme(theme) {
            const themeState = getThemeState();
            return { themes: [...themeState.themes, { id: 'custom' }], activeId: 'custom', activeTheme: theme };
        },
        async deleteTheme() {
            const themeState = getThemeState();
            return { themes: themeState.themes, activeId: 'default', activeTheme: { name: 'Default', variables: {}, assets: {} } };
        },
        async openThemeFolder() {},
        ...overrides.repository,
    };
    const themeModel = {
        normalizeTheme: theme => structuredClone(theme),
        normalizeAppleThemeId: id => id,
        isAppleThemeId: id => id === 'apple-glass',
    };
    const controller = createThemeController({
        repository,
        view,
        themeModel,
        defaultTheme: { name: 'Default', variables: {}, assets: {} },
        appleThemeId: 'apple-glass',
        capabilities: overrides.capabilities || { exportTheme: true, openThemeFolder: true, themeStudio: false },
        getThemeState: () => store.getSlice('theme'),
        patchThemeState: patch => store.patch('theme', patch),
        persistThemeSettings: () => { persistCount += 1; },
        translate: key => key,
        notify: () => {},
        confirm: () => true,
    });
    return {
        controller,
        view,
        getState: getThemeState,
        getHandlers: () => handlers,
        counts: () => ({ mountCount, destroyCount, persistCount, downloadCount }),
    };
}

{
    const harness = createHarness();
    harness.controller.mount();
    const firstHandlers = harness.getHandlers();
    harness.controller.mount();
    assert.notEqual(harness.getHandlers(), firstHandlers, 'second mount replaces the old event bindings');
    assert.equal(harness.counts().destroyCount, 1);
    harness.controller.destroy();
    assert.equal(harness.getHandlers(), null, 'destroy disables view events');
}

{
    const harness = createHarness();
    const official = harness.getState().theme;
    harness.controller.previewTheme({ name: 'Preview', variables: {}, assets: {} });
    assert.equal(harness.getState().theme.name, official.name, 'preview does not replace the official theme');
    assert.equal(harness.counts().persistCount, 0, 'preview is never persisted');
    harness.controller.revertThemePreview();
    assert.equal(harness.getState().theme.name, 'Official');
    assert.equal(harness.getState().previewTheme, null);
}

{
    const harness = createHarness({
        repository: { activateTheme: async () => { throw new Error('failed'); } },
    });
    const before = structuredClone(harness.getState());
    await assert.rejects(() => harness.controller.activateTheme('broken'), /failed/);
    assert.deepEqual(harness.getState(), before, 'repository failure leaves controller state untouched');
}

{
    const harness = createHarness({ capabilities: { exportTheme: false, openThemeFolder: false, themeStudio: false } });
    harness.controller.exportTheme();
    await harness.controller.openThemeFolder();
    assert.equal(harness.counts().downloadCount, 0, 'Lite capabilities suppress Full-only actions');
}

console.log('theme controller: ok');
