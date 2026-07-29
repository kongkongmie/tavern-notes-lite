export function createLifecycleRegistry({ clearTimeoutFn = clearTimeout, clearIntervalFn = clearInterval } = {}) {
    let entries = [];
    const register = callback => {
        if (typeof callback !== 'function') return callback;
        entries.push(callback);
        return callback;
    };
    return {
        registerDestroy: register,
        registerAbortController: controller => (register(() => controller?.abort?.()), controller),
        registerObserver: observer => (register(() => observer?.disconnect?.()), observer),
        registerTimeout: id => (register(() => clearTimeoutFn(id)), id),
        registerInterval: id => (register(() => clearIntervalFn(id)), id),
        registerUnsubscribe: register,
        destroyAll() {
            const current = entries;
            entries = [];
            for (let index = current.length - 1; index >= 0; index -= 1) {
                try { current[index](); } catch (error) { console.error('[Tavern Notes] cleanup failed', error); }
            }
        },
        reset() { entries = []; },
        get size() { return entries.length; },
    };
}
