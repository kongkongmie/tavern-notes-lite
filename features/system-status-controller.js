import { shouldShowBackupReminder } from '../core/system-status-model.js';

export function createSystemStatusController({ repository, view, capabilities, formatStatus, notifyReminder = () => {}, reminderOptions, onStatus = () => {}, onError = () => {} }) {
    let mounted = false;
    let generation = 0;
    let lastStatus = null;
    async function refresh({ showReminder = false } = {}) {
        const request = ++generation;
        view.setLoading?.(true);
        try {
            const status = await repository.getStatus();
            if (!mounted || request !== generation) return { stale: true };
            lastStatus = status;
            onStatus(status);
            view.renderStatus?.(formatStatus(status));
            if (capabilities.storageQuota && showReminder && shouldShowBackupReminder(status, reminderOptions)) notifyReminder(status);
            return status;
        } catch (error) {
            if (mounted && request === generation) onError(error, capabilities);
            throw error;
        } finally {
            if (mounted && request === generation) view.setLoading?.(false);
        }
    }
    return {
        mount() { if (!mounted) { mounted = true; view.mount?.(); } },
        refresh,
        showInstallGuide: () => capabilities.installGuide && view.showInstallGuide?.(),
        getStatus: () => lastStatus,
        destroy() { mounted = false; generation += 1; lastStatus = null; view.destroy?.(); },
    };
}
