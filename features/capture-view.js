export function createSelectionSnapshotReader({
    documentRef = document,
    windowRef = window,
    ignoredSelector,
    inputSelector,
}) {
    function messageId(selection) {
        if (!selection?.rangeCount) return null;
        for (const start of [selection.anchorNode, selection.focusNode]) {
            const message = (start?.nodeType === 1 ? start : start?.parentElement)?.closest?.('[mesid], .mes');
            const raw = message?.getAttribute?.('mesid') ?? message?.dataset?.mesid;
            if (raw !== undefined && raw !== null) return Number.isFinite(Number(raw)) ? Number(raw) : raw;
        }
        return null;
    }

    function ignored(selection) {
        return [selection?.anchorNode, selection?.focusNode].some(start => {
            const element = start?.nodeType === 1 ? start : start?.parentElement;
            return Boolean(element?.closest?.(ignoredSelector));
        });
    }

    function fromInput(element, offset = null) {
        if (!['INPUT', 'TEXTAREA'].includes(String(element?.tagName || '').toUpperCase())) return null;
        if (element.closest?.(ignoredSelector) || element.selectionStart === element.selectionEnd) return null;
        const text = String(element.value || '').slice(element.selectionStart, element.selectionEnd).trim();
        if (!text) return null;
        const rect = element.getBoundingClientRect();
        return {
            text,
            messageId: null,
            source: element.matches?.(inputSelector) ? 'input_selection' : 'selected_text',
            rect: offset ? { ...rect, left: rect.left + offset.left, right: rect.right + offset.left, top: rect.top + offset.top, bottom: rect.bottom + offset.top } : rect,
        };
    }

    function fromSelection(selection, offset = null) {
        const text = selection?.toString?.().trim();
        if (!text || !selection.rangeCount || ignored(selection)) return null;
        const range = selection.getRangeAt(selection.rangeCount - 1);
        const rects = Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0);
        const rect = rects.at(-1) || range.getBoundingClientRect();
        return {
            text,
            messageId: messageId(selection),
            source: 'selected_text',
            rect: offset ? { ...rect, left: rect.left + offset.left, right: rect.right + offset.left, top: rect.top + offset.top, bottom: rect.bottom + offset.top } : rect,
        };
    }

    return function readSelectionSnapshot() {
        const active = fromInput(documentRef.activeElement);
        if (active) return active;
        const selected = fromSelection(windowRef.getSelection?.());
        if (selected) return selected;
        for (const frame of documentRef.querySelectorAll('iframe')) {
            try {
                const offset = frame.getBoundingClientRect();
                const input = fromInput(frame.contentDocument?.activeElement, offset);
                if (input) return input;
                const snapshot = fromSelection(frame.contentWindow?.getSelection?.(), offset);
                if (snapshot) return snapshot;
            } catch { /* cross-origin */ }
        }
        return null;
    };
}

export function createCaptureView({
    documentRef = document,
    windowRef = window,
    selectors,
    translate,
    escapeHtml,
    isSelectionEnabled,
    isFloorEnabled,
    getSelectionSnapshot,
    onSelectionCapture,
    onFloorCapture,
}) {
    let mounted = false;
    let observer = null;
    let timer = null;
    let abortController = null;
    let lastSelection = null;
    let selectionDismissedUntil = 0;

    function clearSelections() {
        const selections = [windowRef.getSelection?.()];
        for (const frame of documentRef.querySelectorAll('iframe')) {
            try { selections.push(frame.contentWindow?.getSelection?.()); } catch { /* cross-origin */ }
        }
        for (const selection of new Set(selections.filter(Boolean))) {
            try { selection.removeAllRanges(); } catch { /* embedded selection may reject clearing */ }
        }
    }

    function hideSelectionButton() {
        documentRef.querySelector(selectors.selectionButton)?.classList.remove('show');
    }

    function ensureSelectionButton() {
        let button = documentRef.querySelector(selectors.selectionButton);
        if (button) return button;
        button = documentRef.createElement('button');
        button.id = selectors.selectionButton.replace(/^#/, '');
        button.className = selectors.selectionClass;
        button.type = 'button';
        button.innerHTML = `<i class="fa-solid fa-highlighter"></i><span>${escapeHtml(translate('captureSelected'))}</span>`;
        button.addEventListener('mousedown', event => event.preventDefault(), { signal: abortController.signal });
        button.addEventListener('click', event => {
            event.preventDefault();
            onSelectionCapture(lastSelection);
            lastSelection = null;
            selectionDismissedUntil = Date.now() + 1000;
            clearSelections();
            hideSelectionButton();
        }, { signal: abortController.signal });
        documentRef.body.append(button);
        return button;
    }

    function updateSelectionButton() {
        if (!mounted || !isSelectionEnabled() || Date.now() < selectionDismissedUntil) return hideSelectionButton();
        const snapshot = getSelectionSnapshot();
        if (!snapshot?.text || !snapshot.rect) return hideSelectionButton();
        lastSelection = snapshot;
        const button = ensureSelectionButton();
        const margin = 8;
        const left = Math.min(Math.max(snapshot.rect.right + margin, margin), windowRef.innerWidth - (button.offsetWidth || 92) - margin);
        const top = Math.min(Math.max(snapshot.rect.bottom + margin, margin), windowRef.innerHeight - (button.offsetHeight || 34) - margin);
        button.style.left = `${left}px`;
        button.style.top = `${top}px`;
        button.classList.add('show');
    }

    function scheduleSelectionButton() {
        clearTimeout(timer);
        timer = setTimeout(updateSelectionButton, 80);
    }

    function ensureFloorButton(message) {
        if (!isFloorEnabled() || message.querySelector(`:scope > ${selectors.floorButton}`)) return;
        const button = documentRef.createElement('button');
        button.type = 'button';
        button.className = selectors.floorButton.replace(/^\./, '');
        button.title = translate('captureFloorTitle');
        button.innerHTML = `<i class="fa-solid fa-file-lines"></i><span>${escapeHtml(translate('captureFloor'))}</span>`;
        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            onFloorCapture(message);
        }, { signal: abortController.signal });
        message.append(button);
    }

    function refreshFloorButtons(root = documentRef) {
        if (!isFloorEnabled()) {
            documentRef.querySelectorAll(selectors.floorButton).forEach(button => button.remove());
            return;
        }
        root.querySelectorAll?.(selectors.messages).forEach(ensureFloorButton);
    }

    function mount() {
        destroy();
        mounted = true;
        abortController = new AbortController();
        documentRef.addEventListener('selectionchange', scheduleSelectionButton, { signal: abortController.signal });
        documentRef.addEventListener('mouseup', scheduleSelectionButton, { signal: abortController.signal });
        documentRef.addEventListener('scroll', hideSelectionButton, { capture: true, signal: abortController.signal });
        windowRef.addEventListener('resize', hideSelectionButton, { signal: abortController.signal });
        refreshFloorButtons();
        const chat = documentRef.querySelector(selectors.chat);
        if (chat) {
            observer = new MutationObserver(records => {
                if (!mounted) return;
                records.forEach(record => record.addedNodes.forEach(node => {
                    if (!(node instanceof Element)) return;
                    if (node.matches?.(selectors.message)) ensureFloorButton(node);
                    node.querySelectorAll?.(selectors.message).forEach(ensureFloorButton);
                }));
            });
            observer.observe(chat, { childList: true, subtree: true });
        }
    }

    function destroy() {
        mounted = false;
        clearTimeout(timer);
        timer = null;
        observer?.disconnect();
        observer = null;
        abortController?.abort();
        abortController = null;
        documentRef.querySelector(selectors.selectionButton)?.remove();
        documentRef.querySelectorAll(selectors.floorButton).forEach(button => button.remove());
    }

    return { mount, destroy, refreshFloorButtons, hideSelectionButton };
}
