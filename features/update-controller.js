import { shouldShowUpdateNotice } from '../core/update-model.js';

export function createUpdateController({ repository, view, fallbackVersion, notify = () => {}, setStatus = () => {}, today = () => new Date().toDateString() }) {
    let mounted = false;
    let generation = 0;
    let info = null;
    let checking = false;

    function render() {
        if (mounted) view.render({ info, checking, fallbackVersion });
    }

    async function check({ notifyAvailable = true, throwOnError = false } = {}) {
        const request = ++generation;
        checking = true;
        render();
        try {
            const result = await repository.check();
            if (!mounted || request !== generation) return { stale: true };
            info = result;
            if (result.hasUpdate && notifyAvailable) {
                const previous = repository.readNotice();
                const date = today();
                if (shouldShowUpdateNotice(previous, result.latestVersion, date)) {
                    repository.writeNotice({ version: result.latestVersion, date });
                    if (!notify(result)) setStatus(result);
                }
            }
            return result;
        } catch (error) {
            if (mounted && request === generation) {
                info = { error: true, installedVersion: await repository.getInstalledVersion(), changelog: [] };
                if (throwOnError) throw error;
            }
            return info;
        } finally {
            if (mounted && request === generation) {
                checking = false;
                render();
            }
        }
    }

    return {
        mount() {
            if (mounted) return;
            mounted = true;
            view.mount({
                onCheck: () => check({ notifyAvailable: false, throwOnError: true }),
                onOpen: () => { render(); if (!info && !checking) check({ notifyAvailable: false }); },
            });
        },
        check,
        open() { view.open(); },
        close() { view.close(); },
        getState: () => ({ info, checking }),
        destroy() {
            mounted = false;
            generation += 1;
            checking = false;
            view.destroy();
        },
    };
}
