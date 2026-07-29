export function createCoexistenceController({ isFullActive, application, removeLiteUi = () => {}, createObserver, getTarget, schedule = callback => callback() } = {}) {
    let mounted = false;
    let paused = false;
    let observer = null;
    let pending = false;
    const pause = reason => {
        if (paused) return false;
        paused = true;
        observer?.disconnect?.();
        observer = null;
        application?.pause?.(reason);
        removeLiteUi();
        return true;
    };
    const check = () => {
        if (!mounted || paused || !isFullActive?.()) return false;
        return pause('full-detected');
    };
    return {
        mount() {
            if (mounted) return;
            mounted = true;
            if (check()) return;
            const target = getTarget?.();
            if (target && createObserver) {
                observer = createObserver(() => {
                    if (pending || paused) return;
                    pending = true;
                    schedule(() => { pending = false; check(); });
                });
                observer.observe(target, { childList: true, subtree: true });
            }
        },
        check,
        pause,
        destroy() { mounted = false; observer?.disconnect?.(); observer = null; pending = false; },
        isPaused: () => paused,
    };
}
