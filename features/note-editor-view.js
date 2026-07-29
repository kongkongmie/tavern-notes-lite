export function createNoteEditorView({
    root,
    selectors,
    parseTags,
    onSubmit,
    onClose,
    onOpen = () => {},
    onClosed = () => {},
    getTags = null,
    onError = () => {},
    getInitialTags = () => '',
}) {
    let abortController = null;
    let current = null;
    let submitRunning = false;

    function element(selector) {
        const host = typeof root === 'function' ? root() : root;
        return host?.querySelector(selector);
    }

    function mount() {
        destroy();
        const host = typeof root === 'function' ? root() : root;
        if (!host) return;
        abortController = new AbortController();
        const signal = abortController.signal;
        host.addEventListener('submit', async event => {
            if (!event.target.closest(selectors.form)) return;
            event.preventDefault();
            if (submitRunning) return;
            submitRunning = true;
            setSubmitting(true);
            try {
                await onSubmit(collect());
            } catch (error) {
                onError(error);
            } finally {
                submitRunning = false;
                setSubmitting(false);
            }
        }, { signal });
        host.addEventListener('click', event => {
            if (event.target.closest(selectors.close)) {
                close();
                onClose();
            }
        }, { signal });
    }

    function open(note) {
        current = note || null;
        onOpen(current);
        const content = element(selectors.content);
        const tags = element(selectors.tags);
        if (content) content.value = note?.content || '';
        if (tags) tags.value = getInitialTags(current);
        const dialog = element(selectors.dialog);
        dialog?.classList.add('open');
        dialog?.setAttribute('aria-hidden', 'false');
        setTimeout(() => content?.focus(), 0);
    }

    function close() {
        current = null;
        submitRunning = false;
        const dialog = element(selectors.dialog);
        dialog?.classList.remove('open');
        dialog?.setAttribute('aria-hidden', 'true');
        onClosed();
    }

    function collect() {
        return {
            id: current?.id ?? null,
            content: String(element(selectors.content)?.value || '').trim(),
            tags: getTags ? getTags() : parseTags(element(selectors.tags)?.value || ''),
        };
    }

    function setSubmitting(value) {
        const submit = element(selectors.submit);
        if (submit) submit.disabled = Boolean(value);
    }

    function destroy() {
        abortController?.abort();
        abortController = null;
        current = null;
    }

    return { mount, open, close, collect, setSubmitting, destroy };
}
