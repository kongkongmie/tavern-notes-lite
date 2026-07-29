export function bootstrapApplication({ createApplication, events, isReady = () => false, onError = console.error } = {}) {
    let application = null;
    let starting = null;
    let destroyed = false;
    const start = async () => {
        if (destroyed) return null;
        if (application) return application;
        if (starting) return starting;
        starting = Promise.resolve().then(async () => {
            const next = await createApplication();
            if (destroyed) { await next?.destroy?.(); return null; }
            application = next;
            await application?.start?.();
            return application;
        }).catch(error => { onError(error); return null; }).finally(() => { starting = null; });
        return starting;
    };
    const unsubscribeReady = isReady() ? (start(), () => {}) : events?.onAppReady?.(start) || (() => {});
    const unsubscribeUnload = events?.onUnload?.(() => api.destroy()) || (() => {});
    const api = {
        start,
        getApplication: () => application,
        async destroy() {
            if (destroyed) return;
            destroyed = true;
            unsubscribeReady();
            unsubscribeUnload();
            events?.destroy?.();
            await application?.destroy?.();
            application = null;
        },
    };
    return api;
}
