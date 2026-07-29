export function createStorageModeView({ overlayId, classPrefix, translate, escapeHtml }) {
    let mounted = false;
    let overlay = null;
    let onSelect = () => {};
    return {
        mount(handler) { if (!mounted) { mounted = true; onSelect = handler; } },
        open(mode, options = {}) {
            if (!mounted) return;
            this.close();
            overlay = document.createElement('div');
            overlay.id = overlayId;
            overlay.dataset.tnOverlay = 'storage-choice';
            const allowClose = options.allowClose ?? Boolean(mode);
            overlay.innerHTML = `
                <div class="${classPrefix}-install-card ${classPrefix}-storage-choice-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(translate('storageChoiceTitle'))}">
                    ${allowClose ? `<button class="${classPrefix}-install-close" type="button" title="${escapeHtml(translate('close'))}" aria-label="${escapeHtml(translate('close'))}"><i class="fa-solid fa-xmark"></i></button>` : ''}
                    <h2>${escapeHtml(translate('storageChoiceTitle'))}</h2>
                    <p>${escapeHtml(translate('storageChoiceMessage'))}</p>
                    <div class="${classPrefix}-storage-choice-grid">
                        <button class="${classPrefix}-storage-choice ${mode === 'full' ? 'active' : ''}" data-storage-mode="full" type="button"><i class="fa-solid fa-hard-drive"></i><span><b>${escapeHtml(translate('storageFullTitle'))}</b><small>${escapeHtml(translate('storageFullDescription'))}</small></span></button>
                        <button class="${classPrefix}-storage-choice ${mode === 'lite' ? 'active' : ''}" data-storage-mode="lite" type="button"><i class="fa-solid fa-window-maximize"></i><span><b>${escapeHtml(translate('storageLiteTitle'))}</b><small>${escapeHtml(translate('storageLiteDescription'))}</small></span></button>
                    </div>
                </div>`;
            document.body.append(overlay);
            overlay.addEventListener('click', event => {
                const button = event.target.closest?.('[data-storage-mode]');
                if (button) onSelect(button.dataset.storageMode);
                else if (event.target === overlay || event.target.closest?.(`.${classPrefix}-install-close`)) this.close();
            });
        },
        close() { overlay?.remove(); overlay = null; },
        render() {},
        setLoading(value) { overlay?.classList.toggle('is-loading', value); },
        showError() {},
        destroy() { this.close(); mounted = false; onSelect = () => {}; },
    };
}
