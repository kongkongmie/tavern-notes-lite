import { normalizeThemeFlavor, replaceThemeVariables } from '../core/theme-runtime.js';

export function renderThemeViewMarkup({
    idPrefix,
    classPrefix,
    translate,
    escapeHtml,
    capabilities = {},
    studioMarkup = '',
}) {
    const t = translate;
    const escape = escapeHtml;
    const exportAction = capabilities.exportTheme
        ? `
            <button id="${idPrefix}-theme-export" class="${classPrefix}-theme-icon-button ${classPrefix}-theme-studio-action" title="${escape(t('exportCurrentTheme'))}" aria-label="${escape(t('exportCurrentTheme'))}"><i class="fa-solid fa-file-export"></i></button>
        `
        : '';
    const folderAction = capabilities.openThemeFolder
        ? `
            <button id="${idPrefix}-theme-open-folder" class="${classPrefix}-theme-icon-button ${classPrefix}-theme-studio-action" title="${escape(t('openThemeFolder'))}" aria-label="${escape(t('openThemeFolder'))}"><i class="fa-solid fa-folder-open"></i></button>
        `
        : '';
    return `
        <div id="${idPrefix}-theme-menu" aria-hidden="true">
            <div class="${classPrefix}-theme-card">
                <button class="${classPrefix}-icon-button ${classPrefix}-theme-close" data-theme-action="close" title="${escape(t('closeThemePanel'))}" aria-label="${escape(t('closeThemePanel'))}"><i class="fa-solid fa-xmark"></i></button>
                <div class="${classPrefix}-export-title">${escape(t('themeFiles'))}</div>
                <div class="${classPrefix}-theme-name">${escape(t('currentTheme', { name: 'Soft Neomorphism' }))}</div>
                <div class="${classPrefix}-theme-picker">
                    <select id="${idPrefix}-theme-select" data-theme-action="select" title="${escape(t('switchTheme'))}"></select>
                    <button id="${idPrefix}-theme-import" data-theme-action="import" class="${classPrefix}-theme-icon-button" title="${escape(t('importTheme'))}" aria-label="${escape(t('importTheme'))}"><i class="fa-solid fa-file-import"></i></button>
                    ${exportAction}
                    ${folderAction}
                    <button id="${idPrefix}-theme-delete" data-theme-action="delete" class="${classPrefix}-theme-icon-button" title="${escape(t('deleteTheme'))}" aria-label="${escape(t('deleteTheme'))}"><i class="fa-solid fa-trash-can"></i></button>
                </div>
                ${studioMarkup}
                <input id="${idPrefix}-theme-file" data-theme-action="file" type="file" accept=".json,application/json" hidden />
            </div>
        </div>
    `;
}

export function createThemeView({
    document,
    window,
    getComputedStyle,
    requestAnimationFrame,
    idPrefix,
    classPrefix,
    variablePrefix,
    translate,
    scheduleLayout = () => {},
    exportFile,
    iconConfig = {},
}) {
    const t = translate;
    const selectors = {
        panel: `#${idPrefix}-panel`,
        menu: `#${idPrefix}-theme-menu`,
        select: `#${idPrefix}-theme-select`,
        file: `#${idPrefix}-theme-file`,
        mode: `#${idPrefix}-apple-mode-main`,
        name: `.${classPrefix}-theme-name`,
    };
    let mounted = false;
    let clickListener = null;
    let changeListener = null;

    const query = selector => document.querySelector(selector);

    function renderThemeSelect({ themes, activeId }) {
        const select = query(selectors.select);
        if (!select) return;
        const records = themes?.length ? themes : [{ id: 'default', name: 'Soft Neomorphism' }];
        select.replaceChildren(...records.map(theme => {
            const option = document.createElement('option');
            option.value = theme.id;
            option.textContent = theme.author ? `${theme.name} · ${theme.author}` : theme.name;
            return option;
        }));
        select.value = activeId || 'default';
    }

    function renderModeControl(themeState, isAppleThemeId) {
        const button = query(selectors.mode);
        if (!button) return;
        const isApple = isAppleThemeId(themeState.activeId);
        const isDefault = themeState.activeId === 'default';
        const supported = isApple || isDefault;
        const isNight = isApple
            ? themeState.appleMode === 'night'
            : themeState.defaultMode === 'night';
        button.classList.toggle(`${classPrefix}-hidden`, !supported);
        button.classList.toggle('active', supported && isNight);
        const title = t(isApple ? 'appleThemeModeTitle' : 'defaultThemeModeTitle');
        button.title = title;
        button.setAttribute('aria-label', title);
        button.querySelector('i')?.classList.toggle('fa-sun', isNight);
        button.querySelector('i')?.classList.toggle('fa-moon', !isNight);
        const labelKey = isApple
            ? (isNight ? 'appleThemeDay' : 'appleThemeNight')
            : (isNight ? 'defaultThemeDay' : 'defaultThemeNight');
        button.querySelector('span')?.replaceChildren(document.createTextNode(t(labelKey)));
        scheduleLayout();
    }

    function render(themeState, { isAppleThemeId, labelKey = 'currentTheme' }) {
        renderThemeSelect(themeState);
        renderModeControl(themeState, isAppleThemeId);
        const name = themeState.previewTheme?.name || themeState.theme?.name || t('unnamedTheme');
        query(selectors.name)?.replaceChildren(document.createTextNode(t(labelKey, { name })));
    }

    function open() {
        const menu = query(selectors.menu);
        menu?.classList.add('open');
        menu?.setAttribute('aria-hidden', 'false');
    }

    function close() {
        const menu = query(selectors.menu);
        menu?.classList.remove('open');
        menu?.setAttribute('aria-hidden', 'true');
    }

    function isOpen() {
        return Boolean(query(selectors.menu)?.classList.contains('open'));
    }

    function getSelectedThemeId() {
        return query(selectors.select)?.value || '';
    }

    function requestThemeFile() {
        query(selectors.file)?.click();
    }

    function downloadTheme(theme) {
        const blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const safeName = String(theme.name || '未命名主题').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
        exportFile(url, `酒馆笔记主题-${safeName}-${Date.now()}.json`);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function mount(handlers) {
        destroy();
        clickListener = event => {
            const target = event.target;
            const menu = query(selectors.menu);
            if (target === menu) return handlers.close?.();
            const action = target.closest?.('[data-theme-action]')?.dataset.themeAction;
            const id = target.closest?.('[id]')?.id;
            if (id === `${idPrefix}-theme`) return handlers.toggle?.();
            if (id === `${idPrefix}-apple-mode-main`) return handlers.toggleMode?.();
            if (action === 'close') return handlers.close?.();
            if (action === 'import') return requestThemeFile();
            if (action === 'delete') return handlers.delete?.();
            if (id === `${idPrefix}-theme-export`) return handlers.export?.();
            if (id === `${idPrefix}-theme-open-folder`) return handlers.openFolder?.();
            if (id === `${idPrefix}-theme-reset`) return handlers.reset?.();
        };
        changeListener = event => {
            const action = event.target?.dataset?.themeAction;
            if (action === 'select') handlers.activate?.(event.target.value);
            if (action === 'file') {
                const file = event.target.files?.[0] || null;
                event.target.value = '';
                if (file) handlers.import?.(file);
            }
        };
        document.addEventListener('click', clickListener);
        document.addEventListener('change', changeListener);
        mounted = true;
    }

    function destroy() {
        if (clickListener) document.removeEventListener('click', clickListener);
        if (changeListener) document.removeEventListener('change', changeListener);
        clickListener = null;
        changeListener = null;
        mounted = false;
    }

    function renderDefaultIcon(src, extraClass = '') {
        return `<img class="${iconConfig.defaultIconClass} ${extraClass}" src="${src}" alt="" aria-hidden="true" draggable="false" />`;
    }

    function parseComputedRgb(value) {
        const numbers = String(value || '').match(/[\d.]+/g)?.map(Number) || [];
        if (numbers.length < 3 || numbers.slice(0, 3).some(number => !Number.isFinite(number))) return null;
        return {
            red: numbers[0],
            green: numbers[1],
            blue: numbers[2],
            alpha: Number.isFinite(numbers[3]) ? numbers[3] : 1,
        };
    }

    function updateDefaultIconContrast(icon) {
        if (!icon) return;
        let element = icon.parentElement;
        let background = null;
        while (element) {
            const color = parseComputedRgb(getComputedStyle(element).backgroundColor);
            if (color && color.alpha > 0.1) {
                background = color;
                break;
            }
            element = element.parentElement;
        }
        const brightness = background
            ? (background.red * 299 + background.green * 587 + background.blue * 114) / 1000
            : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 0 : 255);
        icon.classList.toggle(iconConfig.lightIconClass, brightness < 148);
    }

    function setDefaultIcon(selector, src, extraClass = '') {
        const element = query(selector);
        if (!element || !src) return;
        const current = element.querySelector(`.${iconConfig.defaultIconClass}`);
        if (current?.tagName === 'IMG') {
            current.src = src;
            current.className = `${iconConfig.defaultIconClass} ${extraClass}`.trim();
            updateDefaultIconContrast(current);
            return;
        }
        current?.remove();
        element.querySelector('i')?.remove();
        element.insertAdjacentHTML('afterbegin', renderDefaultIcon(src, extraClass));
        updateDefaultIconContrast(element.querySelector(`.${iconConfig.defaultIconClass}`));
    }

    function updateIcons(theme) {
        if (iconConfig.brandIconSelector && iconConfig.useThemeBrandIcon) {
            const icon = query(iconConfig.brandIconSelector);
            if (icon && theme.assets?.brandIcon) {
                icon.className = `fa-solid ${String(theme.assets.brandIcon).replace(/[^a-z0-9-]/gi, '')}`.trim();
            }
        } else if (iconConfig.brandIconSelector) {
            setDefaultIcon(iconConfig.brandIconSelector, iconConfig.openIconUrl);
        }
        setDefaultIcon(iconConfig.openSelector, iconConfig.openIconUrl, 'qr--button-icon');
        setDefaultIcon(iconConfig.captureSelector, iconConfig.captureIconUrl, 'qr--button-icon');
        setDefaultIcon(iconConfig.floatingOpenSelector, iconConfig.openIconUrl);
        setDefaultIcon(iconConfig.floatingCaptureSelector, iconConfig.captureIconUrl);
        requestAnimationFrame(() => {
            document.querySelectorAll(`.${iconConfig.defaultIconClass}`).forEach(updateDefaultIconContrast);
        });
    }

    function applyTheme(theme, themeState, themeModel) {
        const clean = themeModel.resolveTheme(theme, {
            activeThemeId: themeState.activeId,
            appleMode: themeState.appleMode,
            defaultMode: themeState.defaultMode,
        });
        const panel = query(selectors.panel);
        if (panel) {
            const flavorName = `${variablePrefix}theme-flavor`;
            clean.variables[flavorName] = normalizeThemeFlavor(clean.variables[flavorName]);
            replaceThemeVariables(panel, clean.variables, variablePrefix);
            const flavor = clean.variables[flavorName];
            if (flavor) panel.dataset.themeFlavor = flavor;
            else delete panel.dataset.themeFlavor;
            if (flavor === 'default') panel.dataset.themeMode = themeState.defaultMode;
            else delete panel.dataset.themeMode;
            if (flavor !== 'archive') panel.classList.remove(`${classPrefix}-archive-reading`);
            const backgroundImage = clean.assets?.backgroundImage;
            if (backgroundImage) {
                const image = String(backgroundImage).trim();
                const cssImage = /^(url|linear-gradient|radial-gradient|conic-gradient)\(/i.test(image) ? image : `url("${image}")`;
                panel.style.setProperty(`${variablePrefix}background-image`, cssImage);
            } else {
                panel.style.removeProperty(`${variablePrefix}background-image`);
            }
        }
        updateIcons(clean);
        return clean;
    }

    return {
        mount,
        destroy,
        isMounted: () => mounted,
        open,
        close,
        isOpen,
        render,
        getSelectedThemeId,
        downloadTheme,
        applyTheme,
        renderDefaultIcon,
        updateIcons,
    };
}
