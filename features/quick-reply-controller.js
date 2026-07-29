export function createQuickReplyController({ view, getMode, saveSettings, findToolbar, notify = () => {}, createObserverController, capabilities = {} } = {}) {
    let mounted = false;
    let paused = false;
    const refresh = () => {
        if (!mounted || paused) return;
        const mode = getMode?.() === 'floating' && capabilities.floatingLauncher !== false ? 'floating' : 'toolbar';
        view.updateModeButton?.(mode);
        if (mode === 'floating') view.ensureFloatingButton?.();
        else view.ensureToolbarButton?.(findToolbar?.());
    };
    const observer = createObserverController?.(refresh);
    const setMode = async mode => {
        const result = await saveSettings({ launcherMode: mode });
        if (!result?.ok) return result;
        refresh();
        notify(mode);
        return result;
    };
    return {
        mount() {
            if (mounted) return;
            mounted = true; paused = false;
            view.mount?.({ open: capabilities.open, capture: capabilities.capture, getPosition: capabilities.getPosition, iconsChanged: capabilities.iconsChanged });
            observer?.mount?.();
            refresh();
        },
        refresh,
        show() { paused = false; view.setVisible?.(true); refresh(); },
        hide() { paused = true; view.setVisible?.(false); },
        toggle: () => setMode(getMode?.() === 'floating' ? 'toolbar' : 'floating'),
        resetPosition: async () => { const result = await saveSettings({ floatingPosition: null }); if (result?.ok) view.resetPosition?.(); return result; },
        destroy() { mounted = false; paused = true; observer?.destroy?.(); view.destroy?.(); },
    };
}
