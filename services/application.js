export function createApplication({ modules = [], shell, onPause = () => {}, onError = () => {} } = {}) {
    let phase = 'idle';
    let error = null;
    let generation = 0;
    let startPromise = null;
    let mounted = [];
    const status = () => ({ phase, error });
    async function start() {
        if (phase === 'running') return status();
        if (phase === 'starting') return startPromise;
        if (phase === 'destroyed') return status();
        const token = ++generation;
        phase = 'starting';
        error = null;
        startPromise = (async () => {
            try {
                await shell?.mount?.();
                if (token !== generation || phase === 'destroyed') {
                    await shell?.destroy?.();
                    return status();
                }
                if (shell) mounted.push(shell);
                for (const module of modules) {
                    await module?.mount?.();
                    if (token !== generation || phase === 'destroyed' || phase === 'paused') {
                        await module?.destroy?.();
                        return status();
                    }
                    if (module) mounted.push(module);
                }
                if (token === generation) phase = 'running';
            } catch (cause) {
                error = cause;
                while (mounted.length) {
                    try { await mounted.pop()?.destroy?.(); } catch {}
                }
                if (token === generation) phase = 'idle';
                onError(cause);
            } finally {
                if (token === generation) startPromise = null;
            }
            return status();
        })();
        return startPromise;
    }
    async function destroy() {
        if (phase === 'destroyed') return;
        generation += 1;
        phase = 'destroyed';
        startPromise = null;
        while (mounted.length) {
            try { await mounted.pop()?.destroy?.(); } catch {}
        }
    }
    return {
        start,
        mount: start,
        open: () => shell?.open?.(),
        close: () => shell?.close?.(),
        pause(reason) {
            if (phase === 'paused' || phase === 'destroyed') return;
            generation += 1;
            phase = 'paused';
            onPause(reason);
            while (mounted.length) {
                try { mounted.pop()?.destroy?.(); } catch {}
            }
        },
        destroy,
        getStatus: status,
    };
}
