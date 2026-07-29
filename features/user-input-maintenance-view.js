export function createUserInputMaintenanceView({ root, selectors, controller, translate, escapeHtml, notify = () => {} }) {
    let abortController = null;

    function elements() {
        const host = typeof root === 'function' ? root() : root;
        return {
            host,
            menu: host?.querySelector(selectors.menu),
            preview: host?.querySelector(selectors.preview),
        };
    }

    function closePreview() {
        elements().preview?.classList.add('tn-hidden');
        controller.clearPreview();
    }

    function renderPreview(preview) {
        const panel = elements().preview;
        if (!panel) return;
        const summary = panel.querySelector(selectors.summary);
        const list = panel.querySelector(selectors.list);
        if (summary) summary.textContent = translate('scanPreview', { ...preview, duplicates: preview.removed });
        if (list) list.innerHTML = preview.items.map(item => `<article class="${selectors.itemClass}"><div><b>${escapeHtml(item.characterName || '')}</b><span>${escapeHtml(item.chatName || '')}</span><em>${escapeHtml(translate('dedupeOccurrences', { count: item.occurrences, duplicates: item.duplicateNotes }))}</em></div><pre>${escapeHtml(item.content || '')}</pre></article>`).join('');
        panel.classList.toggle('tn-hidden', !preview.removed);
    }

    function mount() {
        destroy();
        abortController = new AbortController();
        const { host } = elements();
        host?.addEventListener('click', async event => {
            if (event.target.closest?.(selectors.scan)) {
                const result = await controller.runPreview();
                if (result.ok) result.value.removed ? renderPreview(result.value) : notify('empty');
            } else if (event.target.closest?.(selectors.apply)) {
                const result = await controller.applyCleanup();
                if (result.ok) closePreview();
            } else if (event.target.closest?.(selectors.cancel)) closePreview();
        }, { signal: abortController.signal });
    }

    function destroy() {
        abortController?.abort();
        abortController = null;
    }

    return { mount, destroy, renderPreview, closePreview };
}
