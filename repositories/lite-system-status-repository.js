import { normalizeSystemStatus } from '../core/system-status-model.js';

export function createLiteSystemStatusRepository({ getStorageInfo, estimateStorage = async () => ({}) }) {
    return {
        async getStatus() {
            const [info, estimate] = await Promise.all([getStorageInfo(), estimateStorage().catch(() => ({}))]);
            return normalizeSystemStatus({
                ...info,
                approximateBytes: Math.max(Number(info.approximateBytes || 0), Number(estimate.usage || 0)),
                quota: Number(estimate.quota || 0),
                backendAvailable: false,
            });
        },
    };
}
