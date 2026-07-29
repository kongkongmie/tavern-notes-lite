export function normalizeShareCardSettings(settings = {}) {
    return {
        ...settings,
        theme: settings.theme || 'calendar',
        background: settings.background || '#eef7f2',
        fontFamily: settings.fontFamily || 'system-ui',
        fontScale: Math.min(Math.max(Number(settings.fontScale || 0.8), 0.65), 1.1),
        showCharacter: settings.showCharacter !== false,
        showDate: settings.showDate !== false,
        importedFonts: Array.isArray(settings.importedFonts) ? settings.importedFonts : [],
    };
}

export function normalizeShareCardContent(note) {
    return {
        ...note,
        content: String(note?.content || '').trim(),
        character: note?.character || { name: '未命名角色' },
        tags: Array.isArray(note?.tags) ? note.tags : [],
    };
}

export function createShareCardFilename(note, { brand, date = new Date() }) {
    const stamp = date.toISOString().slice(0, 10);
    const character = (note?.character?.name || '未命名角色').replace(/[\\/:*?"<>|]/g, '_');
    return `${brand}-${character}-${stamp}.png`;
}
