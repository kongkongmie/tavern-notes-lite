export function createShareCardView({
    root,
    idPrefix = 'tavern-notes',
    classPrefix = 'tn',
    getSettings,
    renderSavedFonts = () => {},
    onEvent = () => {},
}) {
    let mounted = false;
    let menu = null;
    const listeners = [];

    function bind(target, type, handler) {
        if (!target) return;
        target.addEventListener(type, handler);
        listeners.push(() => target.removeEventListener(type, handler));
    }

    function emit(type, value) {
        Promise.resolve(onEvent(type, value)).catch(error => onEvent('error', error));
    }

    return {
        mount() {
            if (mounted) return;
            menu = root();
            if (!menu) return;
            bind(menu, 'click', event => {
                if (event.target === menu || event.target.closest?.(`.${classPrefix}-share-close`)) emit('close');
                const theme = event.target.closest?.(`.${classPrefix}-share-choice`);
                const background = event.target.closest?.(`.${classPrefix}-share-bg`);
                if (theme) emit('settings', { theme: theme.dataset.shareTheme || 'calendar' });
                if (background) emit('settings', { background: background.dataset.shareBg || '#f7f4ef' });
            });
            const query = selector => menu.querySelector(selector);
            bind(query(`#${idPrefix}-share-font`), 'input', event => emit('settings', { fontFamily: event.target.value || 'system-ui' }));
            bind(query(`#${idPrefix}-share-saved-fonts`), 'change', event => emit('saved-font', event.target.value));
            bind(query(`#${idPrefix}-share-font-size`), 'input', event => emit('settings', { fontScale: Number(event.target.value || 80) / 100 }));
            bind(query(`#${idPrefix}-share-font-import`), 'input', event => emit('font-import-input', event.target.value || ''));
            bind(query(`#${idPrefix}-share-show-character`), 'change', event => emit('settings', { showCharacter: event.target.checked }));
            bind(query(`#${idPrefix}-share-show-date`), 'change', event => emit('settings', { showDate: event.target.checked }));
            bind(query(`#${idPrefix}-share-import-font`), 'click', () => emit('import-font'));
            bind(query(`#${idPrefix}-share-import-local-font`), 'click', () => query(`#${idPrefix}-share-local-font-file`)?.click());
            bind(query(`#${idPrefix}-share-local-font-file`), 'change', event => emit('import-local-font', event));
            bind(query(`#${idPrefix}-share-redraw`), 'click', () => emit('preview'));
            bind(query(`#${idPrefix}-share-download`), 'click', () => emit('export'));
            mounted = true;
        },
        getCanvas() {
            return menu?.querySelector(`#${idPrefix}-share-canvas`) || null;
        },
        open() {
            this.sync();
            menu?.classList.add('open');
            menu?.setAttribute('aria-hidden', 'false');
        },
        close() {
            menu?.classList.remove('open');
            menu?.setAttribute('aria-hidden', 'true');
        },
        sync() {
            const settings = getSettings();
            menu?.querySelectorAll(`.${classPrefix}-share-choice`).forEach(button => button.classList.toggle('active', button.dataset.shareTheme === settings.theme));
            menu?.querySelectorAll(`.${classPrefix}-share-bg`).forEach(button => button.classList.toggle('active', button.dataset.shareBg === settings.background));
            const set = (selector, key, value) => { const node = menu?.querySelector(selector); if (node) node[key] = value; };
            set(`#${idPrefix}-share-font`, 'value', settings.fontFamily || '');
            renderSavedFonts(menu?.querySelector(`#${idPrefix}-share-saved-fonts`) || null, settings);
            const percent = Math.round(settings.fontScale * 100);
            set(`#${idPrefix}-share-font-size`, 'value', String(percent));
            const value = menu?.querySelector(`#${idPrefix}-share-font-size-value`);
            if (value) value.textContent = `${percent}%`;
            set(`#${idPrefix}-share-font-import`, 'value', settings.fontImport || '');
            set(`#${idPrefix}-share-show-character`, 'checked', settings.showCharacter);
            set(`#${idPrefix}-share-show-date`, 'checked', settings.showDate);
        },
        destroy() {
            listeners.splice(0).forEach(remove => remove());
            this.close();
            mounted = false;
            menu = null;
        },
    };
}
