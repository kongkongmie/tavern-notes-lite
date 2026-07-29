export function readSettingsObject(storage, key) {
    try {
        const value = JSON.parse(storage.getItem(key) || '{}');
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
        return {};
    }
}

export function shouldResumeFullMode({ hasLegacySettings = false, totalNotes = 0 } = {}) {
    return Boolean(hasLegacySettings) || Number(totalNotes || 0) > 0;
}

export function prepareStorageModeSwitch({
    storage,
    currentSettingsKey,
    fullProfileKey,
    liteProfileKey,
    legacyLiteSettingsKey,
    currentMode,
    targetMode,
    persistCurrent = true,
}) {
    if (!['full', 'lite'].includes(targetMode)) throw new TypeError('Invalid storage mode.');
    const currentSettings = readSettingsObject(storage, currentSettingsKey);
    if (currentMode === 'full' || (!currentMode && Object.keys(currentSettings).length)) {
        storage.setItem(fullProfileKey, JSON.stringify(currentSettings));
    }
    if (currentMode === 'lite') {
        storage.setItem(liteProfileKey, JSON.stringify(currentSettings));
    }

    const profileKey = targetMode === 'lite' ? liteProfileKey : fullProfileKey;
    const legacySettings = targetMode === 'lite'
        ? readSettingsObject(storage, legacyLiteSettingsKey)
        : readSettingsObject(storage, currentSettingsKey);
    const targetSettings = {
        ...legacySettings,
        ...readSettingsObject(storage, profileKey),
        storageMode: targetMode,
    };
    if (persistCurrent) storage.setItem(currentSettingsKey, JSON.stringify(targetSettings));
    return targetSettings;
}
