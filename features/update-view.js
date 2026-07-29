export function createUpdateView({ root, idPrefix, classPrefix, translate, escapeHtml, openManager, openRepository, closePopovers = () => {} }) {
    let mounted = false;
    let menu = null;
    let handlers = null;
    const removers = [];
    const bind = (target, type, handler) => {
        if (!target) return;
        target.addEventListener(type, handler);
        removers.push(() => target.removeEventListener(type, handler));
    };
    return {
        mount(nextHandlers) {
            if (mounted) return;
            menu = root();
            if (!menu) return;
            handlers = nextHandlers;
            bind(menu, 'click', event => { if (event.target === menu || event.target.closest?.(`.${classPrefix}-update-close`)) this.close(); });
            bind(document.querySelector(`#${idPrefix}-update-open`), 'click', () => this.open());
            bind(document.querySelector(`#${idPrefix}-update-indicator`), 'click', () => this.open());
            bind(menu.querySelector(`#${idPrefix}-update-check`), 'click', () => handlers.onCheck().catch(() => {}));
            bind(menu.querySelector(`#${idPrefix}-update-manager`), 'click', openManager);
            bind(menu.querySelector(`#${idPrefix}-update-repository`), 'click', openRepository);
            mounted = true;
        },
        render({ info, checking, fallbackVersion }) {
            if (!menu) return;
            const installed = menu.querySelector('[data-update-installed]');
            const latest = menu.querySelector('[data-update-latest]');
            const status = menu.querySelector('[data-update-status]');
            const checkButton = menu.querySelector(`#${idPrefix}-update-check`);
            const indicator = document.querySelector(`#${idPrefix}-update-indicator`);
            const moreButton = document.querySelector(`#${idPrefix}-more-open`);
            const hasUpdate = Boolean(info?.hasUpdate);
            indicator?.classList.toggle(`${classPrefix}-hidden`, !hasUpdate);
            moreButton?.classList.toggle(`${classPrefix}-has-update`, hasUpdate);
            const indicatorVersion = indicator?.querySelector('[data-update-indicator-version]');
            if (indicatorVersion && hasUpdate) indicatorVersion.textContent = `v${info.latestVersion}`;
            if (installed) installed.textContent = `v${info?.installedVersion || fallbackVersion}`;
            if (latest) latest.textContent = info?.latestVersion ? `v${info.latestVersion}` : '—';
            if (status) {
                status.className = info?.hasUpdate ? 'has-update' : info && !info.error ? 'is-current' : '';
                status.textContent = checking ? translate('checkingUpdates') : info?.error ? translate('updateCheckFailed')
                    : info?.hasUpdate ? translate('updateAvailableStatus', { version: info.latestVersion })
                        : info ? translate('upToDateStatus') : translate('checkUpdates');
            }
            if (checkButton) {
                checkButton.disabled = checking;
                checkButton.classList.toggle('checking', checking);
                checkButton.querySelector('span')?.replaceChildren(document.createTextNode(translate(checking ? 'checkingUpdates' : 'checkUpdates')));
            }
            const log = menu.querySelector(`#${idPrefix}-update-log`);
            if (log) log.innerHTML = info?.changelog?.length ? info.changelog.map((entry, index) => {
                const annotation = info.annotations?.find(item => item.version === entry.version);
                return `<article class="${classPrefix}-update-entry"><header><b>v${escapeHtml(entry.version)}</b>${index === 0 ? `<span>${escapeHtml(translate('latestBadge'))}</span>` : ''}</header>${annotation?.items?.length ? `<aside class="${classPrefix}-update-annotation"><b>${escapeHtml(translate('authorAnnotation'))}</b><ul>${annotation.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></aside>` : ''}${entry.items.length ? `<ul>${entry.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}</article>`;
            }).join('') : `<div class="${classPrefix}-update-empty">${escapeHtml(translate('noChangelog'))}</div>`;
        },
        open() { closePopovers(); menu?.classList.add('open'); menu?.setAttribute('aria-hidden', 'false'); handlers?.onOpen(); },
        close() { menu?.classList.remove('open'); menu?.setAttribute('aria-hidden', 'true'); },
        destroy() { removers.splice(0).forEach(remove => remove()); this.close(); mounted = false; menu = null; handlers = null; },
    };
}
