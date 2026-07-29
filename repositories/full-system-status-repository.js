import { normalizeSystemStatus } from '../core/system-status-model.js';

export function createFullSystemStatusRepository({ request }) {
    return {
        async getStatus() {
            return normalizeSystemStatus(await request('/status'));
        },
    };
}
