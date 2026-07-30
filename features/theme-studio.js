export function renderThemeStudioMarkup({
    translate,
    escapeHtml,
    idPrefix = 'tavern-notes',
    classPrefix = 'tn',
}) {
    const t = translate;
    const escape = escapeHtml;
    return `
        <div class="${classPrefix}-theme-studio" data-theme-studio>
            <input id="${idPrefix}-theme-name-input" class="${classPrefix}-theme-input" type="text" placeholder="${escape(t('themeName'))}" />
            <button id="${idPrefix}-theme-merge-st" class="${classPrefix}-theme-merge-button"><i class="fa-solid fa-wand-magic-sparkles"></i><span>${escape(t('mergeTheme'))}</span></button>
            <div class="${classPrefix}-theme-actions">
                <button id="${idPrefix}-theme-preview-save" class="${classPrefix}-export-choice"><i class="fa-solid fa-eye"></i><span>${escape(t('previewSave'))}</span></button>
                <button id="${idPrefix}-theme-save-as" class="${classPrefix}-export-choice"><i class="fa-solid fa-copy"></i><span>${escape(t('saveAs'))}</span></button>
                <button id="${idPrefix}-theme-reset" class="${classPrefix}-export-choice"><i class="fa-solid fa-rotate-left"></i><span>${escape(t('resetDefault'))}</span></button>
            </div>
            <details class="${classPrefix}-theme-guide">
                <summary><i class="fa-solid fa-circle-info"></i><span>${escape(t('themeGuide'))}</span></summary>
                <pre>${escape(t('themeGuideContent'))}</pre>
            </details>
            <textarea id="${idPrefix}-theme-code" spellcheck="false"></textarea>
        </div>
    `;
}

export function createThemeStudio({
    document,
    window,
    getComputedStyle,
    defaultTheme,
    normalizeTheme,
    themeController,
    translate,
    notify,
    idPrefix = 'tavern-notes',
}) {
    const t = translate;
    let mounted = false;
    const listeners = [];

    function syncEditor(theme = themeController.getThemeState().theme || defaultTheme) {
        const clean = normalizeTheme(theme);
        const nameInput = document.querySelector(`#${idPrefix}-theme-name-input`);
        const code = document.querySelector(`#${idPrefix}-theme-code`);
        if (nameInput) nameInput.value = clean.name || '';
        if (code) code.value = JSON.stringify(clean, null, 2);
    }

    function getThemeFromEditor() {
        const code = document.querySelector(`#${idPrefix}-theme-code`);
        const nameInput = document.querySelector(`#${idPrefix}-theme-name-input`);
        const theme = JSON.parse(code?.value || '{}');
        if (nameInput?.value?.trim()) theme.name = nameInput.value.trim();
        if (theme.format && theme.format !== 'tavern-notes-theme') throw new Error(t('invalidThemeFile'));
        return normalizeTheme(theme);
    }

    function firstElement(selectors) {
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) return element;
        }
        return null;
    }

    function styleOf(selectors) {
        const element = Array.isArray(selectors) ? firstElement(selectors) : document.querySelector(selectors);
        return element ? getComputedStyle(element) : null;
    }

    function usefulColor(value) {
        if (!value || value === 'transparent') return '';
        const text = String(value).trim();
        if (/^\d+(\.\d+)?\s*,\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?/.test(text)) return `rgb(${text})`;
        if (/rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/i.test(value)) return '';
        return text;
    }

    function cssVar(styles, name) {
        return usefulColor(styles?.getPropertyValue(name)?.trim());
    }

    function parseColor(value) {
        const text = String(value || '').trim();
        const rgb = text.match(/rgba?\(([^)]+)\)/i);
        if (rgb) {
            const [channelsText, alphaText] = rgb[1].split('/').map(part => part.trim());
            const parts = (channelsText.includes(',') ? channelsText.split(',') : channelsText.split(/\s+/))
                .map(part => Number.parseFloat(part));
            if (parts.length >= 3) {
                const commaAlpha = channelsText.includes(',') && parts.length >= 4 ? parts[3] : null;
                const alpha = Number.parseFloat(alphaText ?? commaAlpha ?? '1');
                return { rgb: parts.slice(0, 3), alpha: Number.isFinite(alpha) ? Math.min(Math.max(alpha, 0), 1) : 1 };
            }
        }
        const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (!hex) return null;
        const raw = hex[1].length === 3 ? hex[1].split('').map(char => char + char).join('') : hex[1];
        return { rgb: [0, 2, 4].map(index => Number.parseInt(raw.slice(index, index + 2), 16)), alpha: 1 };
    }

    function parseRgb(value) {
        return parseColor(value)?.rgb || null;
    }

    function toOpaqueColor(value, fallback = '#111522') {
        const source = parseColor(value);
        if (!source) return fallback;
        const base = parseColor(fallback)?.rgb || [17, 21, 34];
        const rgb = source.rgb.map((channel, index) => channel * source.alpha + base[index] * (1 - source.alpha));
        return `rgb(${rgb.map(channel => Math.max(0, Math.min(255, Math.round(channel)))).join(', ')})`;
    }

    function isDarkColor(value) {
        const rgb = parseRgb(value);
        if (!rgb) return false;
        const [r, g, b] = rgb.map(channel => {
            const normalized = channel / 255;
            return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 0.35;
    }

    function pickStyleValue(styles, property, fallback = '') {
        for (const style of styles) {
            const value = usefulColor(style?.getPropertyValue(property)?.trim());
            if (value) return value;
        }
        return fallback;
    }

    function pickBackgroundColor(styles, fallback = defaultTheme.variables['--tn-paper']) {
        return pickStyleValue(styles, 'background-color', fallback);
    }

    function colorMix(color, alpha = 0.3) {
        const value = usefulColor(color);
        if (!value) return `rgba(156, 151, 139, ${alpha})`;
        if (value.startsWith('rgb(')) return value.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
        if (value.startsWith('rgba(')) return value.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
        return value;
    }

    function shadowColor(value, fallbackColor) {
        const shadow = String(value || '');
        const rgba = shadow.match(/rgba?\([^)]+\)/i)?.[0];
        return colorMix(rgba || fallbackColor, 0.38);
    }

    function getSillyTavernThemeName() {
        const select = document.querySelector('#themes');
        const selected = select?.selectedOptions?.[0];
        return selected?.textContent?.trim() || select?.value?.trim() || t('currentTavernTheme');
    }

    function extractCurrentSillyTavernTheme() {
        const body = getComputedStyle(document.body);
        const root = getComputedStyle(document.documentElement);
        const chatBlock = styleOf(['.mes', '.mes_block', '#chat .mes']);
        const chatText = styleOf(['.mes_text', '.mes .mes_text', '#chat']);
        const input = styleOf(['#send_textarea', '#send_form textarea', '#send_form']);
        const menu = styleOf(['#user-settings-block', '#left-nav-panel', '.drawer-content', '.popup']);
        const backdrop = styleOf(['#bg1', '#bg_custom', '#chat', '#sheld', '.drawer-content']);
        const button = styleOf(['.menu_button', '.qr--button', '#send_but']);
        const active = styleOf(['.selected', '.active', '.mes.selected', '.menu_button:hover']);
        const styles = [chatBlock, input, menu, body, root].filter(Boolean);
        const textStyles = [chatText, input, menu, body, root].filter(Boolean);
        const defaults = defaultTheme.variables;
        const bodyText = toOpaqueColor(cssVar(root, '--SmartThemeBodyColor') || pickStyleValue(textStyles, 'color', defaults['--tn-ink']), defaults['--tn-ink']);
        const border = toOpaqueColor(cssVar(root, '--SmartThemeBorderColor') || pickStyleValue([input, button, menu, root], 'border-color', defaults['--tn-line']), defaults['--tn-line']);
        const quote = toOpaqueColor(cssVar(root, '--SmartThemeQuoteColor') || pickStyleValue([active, button, root, body], 'color', defaults['--tn-gold']), defaults['--tn-gold']);
        const em = toOpaqueColor(cssVar(root, '--SmartThemeEmColor') || bodyText, bodyText);
        const underline = toOpaqueColor(cssVar(root, '--SmartThemeUnderlineColor') || quote, quote);
        const userTint = toOpaqueColor(cssVar(root, '--SmartThemeUserMesBlurTintColor') || quote, quote);
        const chatTint = cssVar(root, '--SmartThemeChatTintColor') || cssVar(root, '--SmartThemeBlurTintColor');
        const uiBackground = cssVar(root, '--SmartThemeBlurTintColor') || cssVar(root, '--SmartThemeChatTintColor');
        const lightFallback = isDarkColor(bodyText) ? '#f5f2ec' : defaults['--tn-paper'];
        const baseBackground = pickBackgroundColor([backdrop, chatBlock, input, menu, body, root], lightFallback);
        const baseSolid = toOpaqueColor(baseBackground, lightFallback);
        const panelBackground = pickBackgroundColor([menu, input], '') || uiBackground || baseBackground;
        const panelSolid = toOpaqueColor(panelBackground, baseSolid);
        const cardBackground = pickBackgroundColor([chatBlock], '') || chatTint || uiBackground || panelBackground;
        const cardSolid = toOpaqueColor(cardBackground, panelSolid);
        const botTint = toOpaqueColor(cssVar(root, '--SmartThemeBotMesBlurTintColor') || cardBackground || quote, quote);
        const shadow = pickStyleValue([chatBlock, input, button, menu], 'box-shadow', '');
        const isDark = isDarkColor(panelSolid) || isDarkColor(cardSolid);
        const lightGlow = isDark ? colorMix(quote, 0.18) : 'rgba(255, 255, 255, 0.76)';
        const textShadow = usefulColor(cssVar(root, '--SmartThemeShadowColor')) || 'transparent';
        const themeShadow = toOpaqueColor(cssVar(root, '--SmartThemeShadowColor') || shadowColor(shadow, '#000000'), '#000000');
        const muted = `color-mix(in srgb, ${bodyText} ${isDark ? '68%' : '62%'}, ${panelSolid} ${isDark ? '32%' : '38%'})`;
        const softBorder = `color-mix(in srgb, ${border} ${isDark ? '46%' : '38%'}, transparent)`;
        const glow = `color-mix(in srgb, ${quote} ${isDark ? '16%' : '24%'}, transparent)`;
        const darkShadow = isDark ? colorMix(themeShadow, 0.5) : shadowColor(shadow, pickStyleValue(styles, 'color', '#4c4a44'));
        const buttonBase = isDark ? `color-mix(in srgb, ${cardSolid} 88%, ${border} 12%)` : `color-mix(in srgb, ${cardSolid} 84%, white 16%)`;
        const darkButton = `color-mix(in srgb, ${cardSolid} 90%, black 10%)`;
        const darkButtonHover = `color-mix(in srgb, ${quote} 16%, ${darkButton} 84%)`;
        const darkButtonShadow = `0 0 0 1px ${softBorder}, 0 3px 10px ${colorMix(themeShadow, 0.42)}, inset 0 1px 0 color-mix(in srgb, ${bodyText} 12%, transparent)`;
        const darkIconBg = `linear-gradient(145deg, color-mix(in srgb, ${quote} 8%, ${darkButton} 92%), color-mix(in srgb, ${darkButton} 84%, black 16%))`;
        const darkIconShadow = `0 0 0 1px color-mix(in srgb, ${border} 68%, transparent), 0 2px 6px ${colorMix(themeShadow, 0.34)}, inset 0 1px 0 color-mix(in srgb, ${bodyText} 12%, transparent)`;
        const paperLift = isDark ? `color-mix(in srgb, ${panelSolid} 92%, black 8%)` : `color-mix(in srgb, ${panelSolid} 94%, white 6%)`;
        const cardLift = isDark ? `color-mix(in srgb, ${cardSolid} 94%, black 6%)` : `color-mix(in srgb, ${cardSolid} 90%, white 10%)`;

        return normalizeTheme({
            name: t('mergedThemeName', { name: getSillyTavernThemeName() }),
            author: 'Tavern Notes',
            variables: {
                '--tn-paper': panelSolid, '--tn-paper-2': cardSolid, '--tn-ink': bodyText, '--tn-muted': muted,
                '--tn-line': softBorder, '--tn-gold': quote, '--tn-gold-2': quote, '--tn-em': em,
                '--tn-underline': underline, '--tn-quote': quote, '--tn-text-shadow': textShadow,
                '--tn-panel-glow': glow, '--tn-scrollbar-thumb': quote,
                '--tn-scrollbar-track': `color-mix(in srgb, ${border} 24%, ${panelSolid} 76%)`,
                '--tn-mini-button-bg': `linear-gradient(145deg, ${buttonBase}, ${paperLift})`,
                '--tn-mini-button-shadow': isDark ? darkButtonShadow : defaults['--tn-mini-button-shadow'],
                '--tn-mini-button-hover-bg': `linear-gradient(145deg, color-mix(in srgb, ${quote} ${isDark ? '24%' : '28%'}, ${buttonBase}), ${buttonBase})`,
                '--tn-mini-button-hover-shadow': isDark ? `0 0 0 1px color-mix(in srgb, ${quote} 42%, transparent), 0 4px 12px ${colorMix(themeShadow, 0.42)}, inset 0 1px 0 color-mix(in srgb, ${bodyText} 16%, transparent)` : defaults['--tn-mini-button-hover-shadow'],
                '--tn-filter-hover-shadow': isDark ? `0 0 0 1px color-mix(in srgb, ${border} 70%, transparent), 0 5px 13px ${colorMix(themeShadow, 0.36)}` : defaults['--tn-filter-hover-shadow'],
                '--tn-filter-icon-border': isDark ? `color-mix(in srgb, ${border} 72%, transparent)` : defaults['--tn-filter-icon-border'],
                '--tn-filter-icon-shadow': isDark ? darkIconShadow : defaults['--tn-filter-icon-shadow'],
                '--tn-inline-action-bg': isDark ? darkButton : defaults['--tn-inline-action-bg'],
                '--tn-inline-action-hover-bg': isDark ? darkButtonHover : defaults['--tn-inline-action-hover-bg'],
                '--tn-inline-action-shadow': isDark ? 'none' : defaults['--tn-inline-action-shadow'],
                '--tn-inline-action-hover-shadow': isDark ? `inset 0 0 0 1px color-mix(in srgb, ${quote} 36%, transparent), inset 0 1px 0 color-mix(in srgb, ${bodyText} 12%, transparent)` : defaults['--tn-inline-action-hover-shadow'],
                '--tn-inline-icon-bg': isDark ? darkIconBg : defaults['--tn-inline-icon-bg'],
                '--tn-inline-icon-hover-bg': isDark ? `linear-gradient(145deg, color-mix(in srgb, ${quote} 22%, ${darkButton} 78%), ${darkButton})` : defaults['--tn-inline-icon-hover-bg'],
                '--tn-inline-icon-shadow': isDark ? darkIconShadow : defaults['--tn-inline-icon-shadow'],
                '--tn-shadow-dark': darkShadow, '--tn-shadow-light': lightGlow, '--tn-radius-panel': '24px',
                '--tn-radius-card': isDark ? '13px' : defaults['--tn-radius-card'], '--tn-panel-border': softBorder,
                '--tn-control-bg': `linear-gradient(145deg, ${buttonBase}, ${paperLift})`,
                '--tn-control-bg-hover': `linear-gradient(145deg, color-mix(in srgb, ${quote} ${isDark ? '22%' : '30%'}, ${buttonBase}), ${buttonBase})`,
                '--tn-control-inset-bg': `linear-gradient(145deg, color-mix(in srgb, ${panelSolid} ${isDark ? '90%' : '88%'}, ${isDark ? 'black' : 'white'} ${isDark ? '10%' : '12%'}), color-mix(in srgb, ${cardSolid} ${isDark ? '86%' : '88%'}, ${isDark ? 'black' : 'white'} ${isDark ? '14%' : '12%'}))`,
                '--tn-control-inset-shadow': isDark ? `inset 0 0 0 1px color-mix(in srgb, ${border} 54%, transparent), inset 0 8px 16px ${colorMix(themeShadow, 0.36)}` : defaults['--tn-control-inset-shadow'],
                '--tn-input-bg': cardLift, '--tn-input-color': bodyText, '--tn-input-border': softBorder, '--tn-input-placeholder': muted,
                '--tn-card-bg': `linear-gradient(145deg, ${cardLift}, ${paperLift})`,
                '--tn-card-bg-active': `linear-gradient(145deg, color-mix(in srgb, ${quote} ${isDark ? '18%' : '24%'}, ${cardLift}), ${cardLift})`,
                '--tn-card-active-shadow': isDark ? `inset 0 0 0 1px color-mix(in srgb, ${quote} 28%, transparent), inset 0 8px 14px ${colorMix(themeShadow, 0.3)}` : defaults['--tn-card-active-shadow'],
                '--tn-icon-bg': isDark ? darkIconBg : `linear-gradient(145deg, color-mix(in srgb, ${quote} 16%, ${buttonBase}), ${paperLift})`,
                '--tn-action-bg': `linear-gradient(145deg, ${paperLift}, ${cardLift})`,
                '--tn-overlay-bg': `color-mix(in srgb, ${panelSolid} 94%, ${isDark ? 'black' : 'white'} 6%)`,
                '--tn-fade-bg': `linear-gradient(90deg, color-mix(in srgb, ${cardSolid} 0%, transparent), ${cardSolid} 34%, color-mix(in srgb, ${quote} ${isDark ? '34%' : '18%'}, ${cardSolid}))`,
                '--tn-card-image': 'linear-gradient(transparent, transparent)',
                '--tn-note-bg': `linear-gradient(145deg, ${paperLift}, ${cardLift})`, '--tn-note-border': `1px solid ${softBorder}`,
                '--tn-note-shadow': isDark ? `0 0 0 1px color-mix(in srgb, ${quote} 18%, transparent), 0 8px 24px ${colorMix(themeShadow, 0.5)}` : defaults['--tn-note-shadow'],
                '--tn-note-type-bg': isDark ? `linear-gradient(145deg, color-mix(in srgb, ${userTint} 62%, ${quote} 38%), color-mix(in srgb, ${userTint} 72%, black 28%))` : `linear-gradient(145deg, color-mix(in srgb, ${userTint} 34%, white 66%), color-mix(in srgb, ${quote} 18%, white 82%))`,
                '--tn-note-type-color': isDark ? `color-mix(in srgb, ${bodyText} 82%, ${userTint} 18%)` : `color-mix(in srgb, ${quote} 82%, black 18%)`,
                '--tn-note-type-user-bg': isDark ? `linear-gradient(145deg, color-mix(in srgb, ${userTint} 58%, ${cardSolid} 42%), color-mix(in srgb, ${userTint} 28%, ${panelSolid} 72%))` : `linear-gradient(145deg, color-mix(in srgb, ${userTint} 32%, white 68%), color-mix(in srgb, ${quote} 16%, white 84%))`,
                '--tn-note-type-user-color': isDark ? `color-mix(in srgb, ${bodyText} 88%, ${userTint} 12%)` : `color-mix(in srgb, ${quote} 78%, black 22%)`,
                '--tn-note-type-excerpt-bg': isDark ? `linear-gradient(145deg, color-mix(in srgb, ${botTint} 52%, ${cardSolid} 48%), color-mix(in srgb, ${botTint} 22%, ${panelSolid} 78%))` : `linear-gradient(145deg, color-mix(in srgb, ${botTint} 32%, white 68%), color-mix(in srgb, ${border} 16%, white 84%))`,
                '--tn-note-type-excerpt-color': isDark ? `color-mix(in srgb, ${bodyText} 84%, ${botTint} 16%)` : `color-mix(in srgb, ${border} 76%, black 24%)`,
                '--tn-note-accent-user': userTint, '--tn-note-accent-excerpt': botTint,
                '--tn-note-padding': isDark ? '15px 17px 15px' : defaults['--tn-note-padding'],
                '--tn-note-topline-bg': isDark ? `linear-gradient(135deg, color-mix(in srgb, ${userTint} 12%, ${cardSolid} 88%), color-mix(in srgb, ${botTint} 8%, ${panelSolid} 92%))` : defaults['--tn-note-topline-bg'],
                '--tn-note-topline-border': isDark ? `1px solid ${softBorder}` : defaults['--tn-note-topline-border'],
                '--tn-note-topline-padding': isDark ? '8px 12px' : defaults['--tn-note-topline-padding'],
                '--tn-note-topline-radius': isDark ? '10px' : defaults['--tn-note-topline-radius'],
                '--tn-note-topline-margin': isDark ? '0 0 13px 0' : defaults['--tn-note-topline-margin'],
                '--tn-note-dot-display': isDark ? 'none' : defaults['--tn-note-dot-display'],
                '--tn-filter-shadow': isDark ? `0 0 0 1px ${softBorder}, 0 6px 16px ${colorMix(themeShadow, 0.38)}` : defaults['--tn-filter-shadow'],
                '--tn-control-shadow': isDark ? `0 0 0 1px ${softBorder}, 0 5px 14px ${colorMix(themeShadow, 0.38)}` : defaults['--tn-control-shadow'],
                '--tn-inset-light': isDark ? `color-mix(in srgb, ${quote} 16%, transparent)` : defaults['--tn-inset-light'],
                '--tn-font-family': defaults['--tn-font-family'],
            },
            assets: { ...defaultTheme.assets, backgroundImage: '' },
        });
    }

    function previewFromEditor() {
        const theme = getThemeFromEditor();
        themeController.setDraft(true);
        syncEditor(theme);
        return theme;
    }

    async function previewAndSaveFromEditor() {
        const theme = getThemeFromEditor();
        themeController.previewTheme(theme);
        await saveFromEditor(theme);
    }

    async function mergeCurrentSillyTavernTheme() {
        const theme = extractCurrentSillyTavernTheme();
        const stamp = new Date().toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
        }).replace(/[\/:\s]/g, '-');
        theme.name = `${theme.name} - ${stamp}`;
        themeController.setDraft(true);
        syncEditor(theme);
        notify(t('mergedThemeDraft'), 'success');
    }

    function askThemeName(theme, actionLabel) {
        const currentName = theme?.name || document.querySelector(`#${idPrefix}-theme-name-input`)?.value || t('unnamedTheme');
        const nextName = window.prompt(t('themeNamePrompt', { action: actionLabel }), currentName);
        if (nextName === null) return null;
        const cleanName = nextName.trim();
        if (!cleanName) {
            notify(t('themeNameEmpty'), 'warning');
            return null;
        }
        return cleanName;
    }

    async function saveFromEditor(themeFromEditor = null) {
        const theme = themeFromEditor || getThemeFromEditor();
        const themeState = themeController.getThemeState();
        const shouldSaveAs = themeState.draft
            || !themeState.activeId
            || themeState.activeId === 'default'
            || themeController.isAppleThemeId(themeState.activeId);
        const name = askThemeName(theme, shouldSaveAs ? t('saveAsAction') : t('saveAction'));
        if (!name) return;
        theme.name = name;
        syncEditor(theme);
        await themeController.saveTheme(theme, {
            id: shouldSaveAs ? null : themeState.activeId,
            notifyKey: shouldSaveAs ? 'savedAsTheme' : 'savedTheme',
        });
    }

    async function saveAsFromEditor() {
        const theme = getThemeFromEditor();
        const name = askThemeName(theme, t('saveAsAction'));
        if (!name) return;
        theme.name = name;
        syncEditor(theme);
        await themeController.saveTheme(theme, {
            id: null,
            activate: false,
            notifyKey: 'savedAsTheme',
        });
    }

    function listen(selector, action) {
        const element = document.querySelector(selector);
        if (!element) return;
        const listener = () => Promise.resolve(action()).catch(error => notify(error.message, 'error'));
        element.addEventListener('click', listener);
        listeners.push([element, listener]);
    }

    function mount() {
        destroy();
        listen(`#${idPrefix}-theme-preview-save`, previewAndSaveFromEditor);
        listen(`#${idPrefix}-theme-merge-st`, mergeCurrentSillyTavernTheme);
        listen(`#${idPrefix}-theme-save-as`, saveAsFromEditor);
        mounted = true;
    }

    function destroy() {
        for (const [element, listener] of listeners.splice(0)) {
            element.removeEventListener('click', listener);
        }
        mounted = false;
    }

    return {
        syncEditor,
        getThemeFromEditor,
        extractCurrentSillyTavernTheme,
        previewFromEditor,
        previewAndSaveFromEditor,
        mergeCurrentSillyTavernTheme,
        saveFromEditor,
        saveAsFromEditor,
        mount,
        destroy,
        isMounted: () => mounted,
    };
}
