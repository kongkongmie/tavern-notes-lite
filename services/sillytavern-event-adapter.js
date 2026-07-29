export function createSillyTavernEventAdapter({ eventSource, eventTypes, windowRef = globalThis.window } = {}) {
    const subscriptions = new Set();
    const subscribe = (type, handler) => {
        if (!type || typeof handler !== 'function') return () => {};
        eventSource?.on?.(type, handler);
        const unsubscribe = () => {
            eventSource?.off?.(type, handler);
            subscriptions.delete(unsubscribe);
        };
        subscriptions.add(unsubscribe);
        return unsubscribe;
    };
    const on = name => handler => subscribe(eventTypes?.[name], handler);
    return {
        onAppReady: on('APP_READY'),
        onMessageSent: on('MESSAGE_SENT'),
        onMessageEdited: on('MESSAGE_EDITED'),
        onMessageUpdated: on('MESSAGE_UPDATED'),
        onChatChanged: on('CHAT_CHANGED'),
        onCharacterMessageRendered: on('CHARACTER_MESSAGE_RENDERED'),
        onUnload(handler) {
            windowRef?.addEventListener?.('beforeunload', handler);
            const unsubscribe = () => {
                windowRef?.removeEventListener?.('beforeunload', handler);
                subscriptions.delete(unsubscribe);
            };
            subscriptions.add(unsubscribe);
            return unsubscribe;
        },
        destroy() {
            [...subscriptions].reverse().forEach(unsubscribe => unsubscribe());
        },
    };
}
