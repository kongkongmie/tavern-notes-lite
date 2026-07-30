export const SETTINGS_SCHEMA_VERSION = 1;

const DEFAULT_FLOOR_CAPTURE_SELECTOR = 'content, .content, [data-tavern-notes-content], [data-note-content], .comment, .mes_text';
const LEGACY_FLOOR_CAPTURE_SELECTOR = '.comment, [data-tavern-notes-content], [data-note-content], .mes_text';
const LANGUAGES = new Set(['auto', 'zh-CN', 'zh-TW', 'en', 'ko']);
const SHARE_THEMES = new Set(['calendar', 'jianshu', 'dialogue', 'mobai']);

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
}

function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
}

export const DEFAULT_SETTINGS = deepFreeze({
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    storageMode: null,
    language: 'auto',
    launcherMode: 'toolbar',
    floatingPosition: null,
    autoCaptureUserInput: true,
    collapseRepeatedUserInput: true,
    userInputIgnoreExact: [],
    userInputIgnorePrefixes: [],
    showSelectionCaptureButton: true,
    showFloorCaptureButton: true,
    floorCaptureSelector: DEFAULT_FLOOR_CAPTURE_SELECTOR,
    floorCaptureExcludedTags: [],
    appleGlassMode: 'day',
    defaultThemeMode: 'day',
    currentUserName: '',
    recentTags: [],
    shareCard: {
        theme: 'calendar',
        background: '#eef7f2',
        textColor: '',
        fontFamily: 'system-ui',
        fontImport: '',
        importedFonts: [],
        fontScale: 0.8,
        showCharacter: true,
        showDate: true,
    },
});

function uniqueStrings(value, limit, { trim = false } = {}) {
    if (!Array.isArray(value)) return [];
    const result = [];
    for (const item of value) {
        const text = trim ? String(item || '').trim() : String(item);
        if (!text || result.includes(text)) continue;
        result.push(text);
        if (result.length >= limit) break;
    }
    return result;
}

function normalizeInputRules(value) {
    const items = Array.isArray(value) ? value : String(value || '').split(/\r?\n/);
    return uniqueStrings(items.map(item => String(item || '').trim()).filter(Boolean), 1000);
}

function normalizeExcludedTags(value) {
    const items = Array.isArray(value) ? value : String(value || '').split(/[\s,，、;；]+/);
    const result = [];
    for (const item of items) {
        const tag = String(item || '')
            .trim()
            .replace(/^<\s*\/?\s*/, '')
            .replace(/\s*\/?>$/, '')
            .toLowerCase();
        if (!/^[a-z][a-z0-9-]*$/.test(tag) || result.includes(tag)) continue;
        result.push(tag);
        if (result.length >= 32) break;
    }
    return result;
}

function normalizeImportedFonts(fonts) {
    if (!Array.isArray(fonts)) return [];
    return fonts
        .filter(font => font && typeof font === 'object' && font.id && font.name && (font.css || font.type === 'local'))
        .map(font => ({
            ...clone(font),
            id: String(font.id),
            name: String(font.name),
            dataUrl: '',
        }))
        .slice(0, 16);
}

function normalizeFloatingPosition(value) {
    if (!value || typeof value !== 'object') return null;
    const x = Number(value.x);
    const y = Number(value.y);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function normalizeShareCard(raw = {}) {
    const fontScale = Number(raw.fontScale);
    return {
        theme: SHARE_THEMES.has(raw.theme) ? raw.theme : DEFAULT_SETTINGS.shareCard.theme,
        background: typeof raw.background === 'string' && raw.background ? raw.background : DEFAULT_SETTINGS.shareCard.background,
        textColor: typeof raw.textColor === 'string' ? raw.textColor : DEFAULT_SETTINGS.shareCard.textColor,
        fontFamily: typeof raw.fontFamily === 'string' && raw.fontFamily ? raw.fontFamily : DEFAULT_SETTINGS.shareCard.fontFamily,
        fontImport: typeof raw.fontImport === 'string' ? raw.fontImport : DEFAULT_SETTINGS.shareCard.fontImport,
        importedFonts: normalizeImportedFonts(raw.importedFonts),
        fontScale: Number.isFinite(fontScale) && fontScale > 0 ? fontScale : DEFAULT_SETTINGS.shareCard.fontScale,
        showCharacter: raw.showCharacter !== false,
        showDate: raw.showDate !== false,
    };
}

export function migrateSettings(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? clone(raw) : {};
    const version = Number.isInteger(source.schemaVersion) ? source.schemaVersion : 0;
    if (version < 1) source.schemaVersion = SETTINGS_SCHEMA_VERSION;
    if (version > SETTINGS_SCHEMA_VERSION) source.schemaVersion = SETTINGS_SCHEMA_VERSION;
    return source;
}

export function mergeSettingsWithDefaults(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    return {
        ...clone(DEFAULT_SETTINGS),
        ...clone(source),
        shareCard: {
            ...clone(DEFAULT_SETTINGS.shareCard),
            ...(source.shareCard && typeof source.shareCard === 'object' ? clone(source.shareCard) : {}),
        },
    };
}

export function normalizeSettings(raw) {
    const settings = mergeSettingsWithDefaults(migrateSettings(raw));
    const storageMode = ['full', 'lite'].includes(settings.storageMode) ? settings.storageMode : null;
    const floorCaptureSelector = typeof settings.floorCaptureSelector === 'string'
        && settings.floorCaptureSelector.trim()
        && settings.floorCaptureSelector !== LEGACY_FLOOR_CAPTURE_SELECTOR
        ? settings.floorCaptureSelector
        : DEFAULT_FLOOR_CAPTURE_SELECTOR;
    return {
        schemaVersion: SETTINGS_SCHEMA_VERSION,
        storageMode,
        language: LANGUAGES.has(settings.language) ? settings.language : DEFAULT_SETTINGS.language,
        launcherMode: ['toolbar', 'floating'].includes(settings.launcherMode) ? settings.launcherMode : DEFAULT_SETTINGS.launcherMode,
        floatingPosition: normalizeFloatingPosition(settings.floatingPosition),
        autoCaptureUserInput: settings.autoCaptureUserInput !== false,
        collapseRepeatedUserInput: settings.collapseRepeatedUserInput !== false,
        userInputIgnoreExact: normalizeInputRules(settings.userInputIgnoreExact),
        userInputIgnorePrefixes: normalizeInputRules(settings.userInputIgnorePrefixes),
        showSelectionCaptureButton: settings.showSelectionCaptureButton !== false,
        showFloorCaptureButton: settings.showFloorCaptureButton !== false,
        floorCaptureSelector,
        floorCaptureExcludedTags: normalizeExcludedTags(settings.floorCaptureExcludedTags),
        appleGlassMode: settings.appleGlassMode === 'night' ? 'night' : 'day',
        defaultThemeMode: settings.defaultThemeMode === 'night' ? 'night' : 'day',
        currentUserName: typeof settings.currentUserName === 'string' ? settings.currentUserName : '',
        recentTags: uniqueStrings(settings.recentTags, 100),
        shareCard: normalizeShareCard(settings.shareCard),
    };
}

export function validateSettings(raw) {
    const normalized = normalizeSettings(raw);
    const migrated = migrateSettings(raw);
    const errors = [];
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
        if (key !== 'storageMode' && !(key in migrated)) errors.push(`missing:${key}`);
    }
    if (JSON.stringify(mergeSettingsWithDefaults(migrated)) !== JSON.stringify(mergeSettingsWithDefaults(normalized))) {
        errors.push('invalid-values');
    }
    return { valid: errors.length === 0, errors, settings: normalized };
}

export function pickPersistedSettings(state) {
    const settings = normalizeSettings(state?.settings || state);
    const persisted = clone(settings);
    if (persisted.storageMode === null) delete persisted.storageMode;
    return persisted;
}
