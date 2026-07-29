export function createNoteImportExportView({
    root,
    selectors,
    getScope,
    onScopeChange,
    onImport,
    onExport,
    onError = () => {},
}) {
    let abortController = null;

    function syncScope() {
        const host = typeof root === 'function' ? root() : root;
        host?.querySelectorAll(selectors.scope).forEach(button => {
            button.classList.toggle('active', button.dataset.scope === getScope());
        });
    }

    function mount() {
        destroy();
        const host = typeof root === 'function' ? root() : root;
        if (!host) return;
        abortController = new AbortController();
        host.addEventListener('click', event => {
            const scope = event.target.closest(selectors.scope);
            if (scope) {
                onScopeChange(scope.dataset.scope === 'page' ? 'page' : 'all');
                syncScope();
                return;
            }
            const choice = event.target.closest(selectors.exportChoice);
            if (choice) onExport(choice.dataset.format || 'json', getScope()).catch(onError);
            if (event.target.closest(selectors.importButton)) host.querySelector(selectors.fileInput)?.click();
        }, { signal: abortController.signal });
        host.addEventListener('change', event => {
            if (!event.target.matches(selectors.fileInput)) return;
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) onImport(file).catch(onError);
        }, { signal: abortController.signal });
        syncScope();
    }

    function download(content, filename, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function destroy() {
        abortController?.abort();
        abortController = null;
    }

    return { mount, syncScope, download, destroy };
}
