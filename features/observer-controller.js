export const createMutationObserverFactory = globalRef => callback => new globalRef.MutationObserver(callback);
export const createResizeObserverFactory = globalRef => callback => new globalRef.ResizeObserver(callback);

export function createObserverController({ createObserver, getTarget, onRefresh, schedule = callback => queueMicrotask(callback) } = {}) {
    let observer = null;
    let mounted = false;
    let pending = false;
    const refresh = () => {
        if (!mounted || pending) return;
        pending = true;
        schedule(() => {
            pending = false;
            if (mounted) onRefresh?.();
        });
    };
    return {
        mount() {
            if (mounted) return;
            mounted = true;
            const target = getTarget?.();
            if (target) {
                observer = createObserver(refresh);
                observer?.observe?.(target, { childList: true, subtree: true });
            }
            refresh();
        },
        refresh,
        destroy() {
            mounted = false;
            pending = false;
            observer?.disconnect?.();
            observer = null;
        },
    };
}
