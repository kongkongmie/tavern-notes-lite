export function createSystemStatusView({ statusSelector, classPrefix, translate, escapeHtml, copyText, notify, install, chooseLite }) {
    let mounted = false;
    let overlay = null;
    return {
        mount() { mounted = true; },
        renderStatus(message) {
            if (!mounted) return;
            document.querySelectorAll(statusSelector).forEach(element => { element.textContent = message; });
        },
        showInstallGuide() {
            if (!mounted) return;
            overlay?.remove();
            overlay = document.createElement('div');
            overlay.id = install.id;
            overlay.dataset.tnOverlay = 'install';
            overlay.innerHTML = `
                <div class="${classPrefix}-install-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(translate('backendInstallTitle'))}">
                    <button class="${classPrefix}-install-close" type="button" title="${escapeHtml(translate('close'))}" aria-label="${escapeHtml(translate('close'))}"><i class="fa-solid fa-xmark"></i></button>
                    <h2>${escapeHtml(translate('backendInstallTitle'))}</h2>
                    <p>${escapeHtml(translate('backendInstallMessage'))}</p>
                    <section><b>${escapeHtml(translate('backendInstallWindows'))}</b><code>${escapeHtml(install.windowsPath)}</code><button class="${classPrefix}-install-copy" data-copy-kind="windows" type="button"><i class="fa-solid fa-copy"></i><span>${escapeHtml(translate('copyWindowsPath'))}</span></button></section>
                    <section><b>${escapeHtml(translate('backendInstallOther'))}</b><code>${escapeHtml(install.shellCommand)}</code><button class="${classPrefix}-install-copy" data-copy-kind="shell" type="button"><i class="fa-solid fa-copy"></i><span>${escapeHtml(translate('copyShellCommand'))}</span></button></section>
                    <button class="${classPrefix}-install-use-lite" type="button"><i class="fa-solid fa-window-maximize"></i><span>${escapeHtml(translate('storageLiteTitle'))}</span></button>
                </div>`;
            document.body.append(overlay);
            overlay.addEventListener('click', async event => {
                if (event.target === overlay || event.target.closest(`.${classPrefix}-install-close`)) overlay.remove();
                const copy = event.target.closest(`.${classPrefix}-install-copy`);
                if (copy) {
                    await copyText(copy.dataset.copyKind === 'windows' ? install.windowsPath : install.shellCommand);
                    notify(translate('copiedInstallCommand'), 'success');
                }
                if (event.target.closest(`.${classPrefix}-install-use-lite`)) chooseLite();
            });
        },
        destroy() { mounted = false; overlay?.remove(); overlay = null; },
    };
}
