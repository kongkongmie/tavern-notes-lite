export function createUserInputMaintenanceController({ repository, listController, confirmApply, notify = () => {} }) {
    let mounted = false;
    let busy = false;
    let preview = null;
    let abortController = null;

    async function runPreview(options = {}) {
        if (!mounted || busy) return { ok: false, busy };
        busy = true;
        try {
            abortController = new AbortController();
            preview = await repository.preview({ ...options, signal: abortController.signal });
            notify('preview', preview);
            return { ok: true, value: preview };
        } catch (error) {
            notify('error', error);
            return { ok: false, error };
        } finally { busy = false; }
    }

    async function applyCleanup(options = {}) {
        if (!mounted || busy || !preview) return { ok: false, busy };
        if (confirmApply && !(await confirmApply(preview))) return { ok: false, cancelled: true };
        busy = true;
        try {
            const result = await repository.apply({ ...options, ids: options.ids || preview.items.map(item => item.id) });
            preview = null;
            await listController.refresh();
            notify('applied', result);
            return { ok: true, value: result };
        } catch (error) {
            notify('error', error);
            return { ok: false, error };
        } finally { busy = false; }
    }

    return {
        mount() { mounted = true; },
        runPreview,
        applyCleanup,
        getPreview: () => preview,
        clearPreview() { preview = null; },
        destroy() { mounted = false; preview = null; abortController?.abort(); abortController = null; busy = false; },
    };
}
