export function shouldShowBackupReminder(info, {
    now = Date.now(),
    storageNoticeBytes = 20 * 1024 * 1024,
    backupNoticeDays = 30,
    minimumNotes = 50,
} = {}) {
    const noteCount = Number(info?.count ?? info?.totalNotes ?? 0);
    if (!noteCount) return false;
    const reminderInterval = backupNoticeDays * 24 * 60 * 60 * 1000;
    const lastReminderTime = Date.parse(info.lastReminderAt || '');
    if (Number.isFinite(lastReminderTime) && now - lastReminderTime < reminderInterval) return false;
    const lastExportTime = Date.parse(info.lastExportAt || '');
    const backupOverdue = noteCount >= minimumNotes
        && (!Number.isFinite(lastExportTime) || now - lastExportTime > reminderInterval);
    return Number(info.approximateBytes || 0) >= storageNoticeBytes || backupOverdue;
}

export function normalizeSystemStatus(status = {}) {
    return {
        user: status.user || '',
        version: status.version || '',
        totalNotes: Number(status.totalNotes || status.count || 0),
        approximateBytes: Number(status.approximateBytes || 0),
        lastExportAt: status.lastExportAt || '',
        lastReminderAt: status.lastReminderAt || '',
        backendAvailable: status.backendAvailable !== false,
        healthy: status.healthy !== false,
    };
}
