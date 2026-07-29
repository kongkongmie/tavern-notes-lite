import { buildExcerptNoteInput, normalizeCapturedText } from '../core/capture-model.js';

export function createCaptureController({
    noteMutationController,
    getCaptureSettings,
    getSillyTavernContext,
    getSelectionSnapshot,
    getFloorText,
    notify = () => {},
}) {
    let mounted = false;
    let generation = 0;
    const pending = new Set();

    async function submit(input, key) {
        if (!mounted || !input.content || pending.has(key)) return { ok: false, duplicate: pending.has(key) };
        const token = generation;
        pending.add(key);
        try {
            if (token !== generation) return { ok: false, cancelled: true };
            const result = await noteMutationController.createNote(input);
            if (token !== generation) return { ok: false, cancelled: true };
            if (!result.ok) throw result.error;
            notify('captured', result.value);
            return result;
        } catch (error) {
            notify('error', error);
            return { ok: false, error };
        } finally { pending.delete(key); }
    }

    function captureMessage(message, options = {}) {
        const context = getSillyTavernContext();
        const input = buildExcerptNoteInput({
            content: options.content ?? message?.content,
            character: options.character ?? context.character,
            chat: context.chatId,
            messageId: options.messageId ?? message?.messageId,
            source: options.source || 'message_floor',
        });
        return submit(input, `${input.source}:${context.chatId}:${input.chat.messageId}:${input.content}`);
    }

    async function captureWholeFloor(messageElement, options = {}) {
        const captured = await getFloorText(messageElement, getCaptureSettings());
        if (!normalizeCapturedText(captured?.content)) {
            notify('empty');
            return { ok: false, empty: true };
        }
        return captureMessage(captured, { ...options, ...captured, source: 'message_floor' });
    }

    async function handleManualCapture(target, options = {}) {
        const snapshot = target?.text ? target : getSelectionSnapshot();
        if (!snapshot?.text) {
            notify('selection-empty');
            return { ok: false, empty: true };
        }
        return captureMessage(snapshot, { ...options, content: snapshot.text, messageId: snapshot.messageId, source: snapshot.source || 'selected_text' });
    }

    function handleAutomaticCapture(message, options = {}) {
        if (!getCaptureSettings().automatic) return Promise.resolve({ ok: false, disabled: true });
        return captureMessage(message, options);
    }

    return {
        mount() { generation += 1; mounted = true; },
        captureMessage,
        captureWholeFloor,
        handleManualCapture,
        handleAutomaticCapture,
        refreshSettings() {},
        destroy() { mounted = false; generation += 1; pending.clear(); },
    };
}
