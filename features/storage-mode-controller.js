export function createStorageModeController({ view, getMode, prepareSwitch, replaceSettings, confirmSwitch, reload }) {
    let mounted = false;
    let switching = false;
    return {
        mount() {
            if (mounted) return;
            mounted = true;
            view.mount(mode => this.select(mode));
        },
        async select(mode) {
            if (!mounted || switching || !['full', 'lite'].includes(mode)) return;
            const previous = getMode();
            if (previous === mode) { view.close(); return; }
            if (previous && !await confirmSwitch(previous, mode)) return;
            switching = true;
            view.setLoading?.(true);
            try {
                const result = await replaceSettings(prepareSwitch(previous, mode));
                if (result?.ok === false) {
                    view.showError?.(result.error);
                    view.render?.(previous);
                    return result;
                }
                reload();
                return result;
            } finally {
                switching = false;
                if (mounted) view.setLoading?.(false);
            }
        },
        open(options) { view.open(getMode(), options); },
        close() { view.close(); },
        destroy() { mounted = false; switching = false; view.destroy(); },
    };
}
