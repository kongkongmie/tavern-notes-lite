export function shouldShowBackupReminder(info, {
    now = Date.now(),
    storageNoticeBytes = 20 * 1024 * 1024,
    backupNoticeDays = 30,
    minimumNotes = 50,
} = {}) {
    if (!info?.count) return false;
    const lastExportTime = Date.parse(info.lastExportAt || '');
    const backupOverdue = info.count >= minimumNotes
        && (!Number.isFinite(lastExportTime) || now - lastExportTime > backupNoticeDays * 24 * 60 * 60 * 1000);
    return Number(info.approximateBytes || 0) >= storageNoticeBytes || backupOverdue;
}

export function normalizeSystemStatus(status = {}) {
    return {
        user: status.user || '',
        version: status.version || '',
        totalNotes: Number(status.totalNotes || status.count || 0),
        approximateBytes: Number(status.approximateBytes || 0),
        lastExportAt: status.lastExportAt || '',
        backendAvailable: status.backendAvailable !== false,
        healthy: status.healthy !== false,
    };
}
