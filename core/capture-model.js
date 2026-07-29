export function normalizeCapturedText(value) {
    return String(value || '').trim();
}

export function normalizeInputIgnoreRules(value) {
    const source = Array.isArray(value) ? value : String(value || '').split(/\r?\n/);
    return [...new Set(source.map(item => String(item || '').trim()).filter(Boolean))].slice(0, 1000);
}

export function shouldCaptureUserInput(message, settings = {}) {
    const content = normalizeCapturedText(message?.mes);
    if (!settings.enabled || !message?.is_user || !content) return false;
    if (normalizeInputIgnoreRules(settings.ignoreExact).includes(content)) return false;
    return !normalizeInputIgnoreRules(settings.ignorePrefixes).some(prefix => content.startsWith(prefix));
}

export function buildExcerptNoteInput({ content, character, chat, messageId, source = 'selected_text' }) {
    return { type: 'excerpt', content: normalizeCapturedText(content), character, chat: { id: chat, name: chat, messageId }, source };
}

export function buildUserInputNoteInput({ message, character, chat, messageId, collapseRepeated }) {
    return {
        type: 'user_input',
        content: normalizeCapturedText(message?.mes),
        character,
        chat: { id: chat, name: chat, messageId },
        source: 'message_sent',
        collapseRepeated: Boolean(collapseRepeated),
    };
}

export function createCaptureDedupeKey(chatId, messageId) {
    return `${String(chatId || '')}::${String(messageId ?? '')}`;
}
