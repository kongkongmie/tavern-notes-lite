import { prepareUserInputCapture } from '../core/user-input-model.js';

export function createUserInputCaptureController({
    events,
    eventSource,
    eventTypes,
    noteMutationController,
    getSettings,
    getContext,
    notify = () => {},
    delay = 100,
}) {
    let mounted = false;
    let generation = 0;
    const captured = {};
    const timers = new Set();
    const handlers = [];

    async function handleUserMessage(messageId) {
        if (!mounted) return { ok: false, inactive: true };
        const context = getContext(messageId);
        const prepared = prepareUserInputCapture(context.message, context, getSettings(), captured);
        if (!prepared) return { ok: false, skipped: true };
        const token = generation;
        captured[prepared.key] = prepared.content;
        const result = await noteMutationController.createNote(prepared.input);
        if (token !== generation) return { ok: false, cancelled: true };
        if (!result.ok) {
            delete captured[prepared.key];
            notify('error', result.error);
        }
        return result;
    }

    function schedule(messageId) {
        const timer = setTimeout(() => {
            timers.delete(timer);
            handleUserMessage(messageId);
        }, delay);
        timers.add(timer);
    }

    function mount() {
        destroy();
        mounted = true;
        generation += 1;
        if (events) {
            for (const subscribe of [events.onMessageSent, events.onMessageEdited, events.onMessageUpdated]) {
                if (typeof subscribe === 'function') handlers.push([null, null, subscribe(messageId => schedule(messageId))]);
            }
        } else {
            for (const type of [eventTypes.MESSAGE_SENT, eventTypes.MESSAGE_EDITED, eventTypes.MESSAGE_UPDATED]) {
                const handler = messageId => schedule(messageId);
                eventSource.on(type, handler);
                handlers.push([type, handler]);
            }
        }
    }

    function destroy() {
        mounted = false;
        generation += 1;
        timers.forEach(clearTimeout);
        timers.clear();
        handlers.splice(0).forEach(([type, handler, unsubscribe]) => {
            if (unsubscribe) unsubscribe();
            else eventSource?.off?.(type, handler);
        });
    }

    return { mount, handleUserMessage, refreshSettings() {}, destroy };
}
