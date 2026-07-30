import {
    createFontStack, extractFontCssUrl, normalizeFontCss, parseFontFamily, quoteFontFamily,
    rememberFont, resolveFontCssUrls, sanitizeFontCss, stripFontQuotes,
} from '../core/font-model.js';

export function createFontController({ repository, view, getSettings, updateSettings, fetchImpl = fetch, notify = () => {}, onChanged = () => {}, errors = {} }) {
    let mounted = false;
    let generation = 0;
    const fonts = () => Array.isArray(getSettings()?.importedFonts) ? getSettings().importedFonts : [];

    async function buildCss(raw) {
        const normalized = normalizeFontCss(raw);
        const url = extractFontCssUrl(normalized);
        let remoteCss = '';
        if (url) {
            try {
                const response = await fetchImpl(url);
                if (response.ok) remoteCss = resolveFontCssUrls(await response.text(), url);
            } catch {}
        }
        const safeCss = sanitizeFontCss(`${normalized}\n${remoteCss}`);
        const family = parseFontFamily(safeCss) || parseFontFamily(normalized) || parseFontFamily(remoteCss);
        return [safeCss, family ? `.tavern-notes-share-font-probe { font-family: ${family}; }` : ''].filter(Boolean).join('\n');
    }

    async function loadLocal(font) {
        const stored = font.dataUrl ? { dataUrl: font.dataUrl } : await repository.getFont(font.id);
        if (!stored?.dataUrl) throw errors.missing?.() || new Error('font-missing');
        await view.loadFont({ name: stripFontQuotes(font.name), dataUrl: stored.dataUrl });
    }

    return {
        mount() { if (!mounted) { mounted = true; view.mount(); } },
        listFonts: () => fonts(),
        async select(fontId) {
            const font = fonts().find(item => item.id === fontId);
            if (!font) return;
            if (font.type === 'local') await loadLocal(font);
            const patch = font.type === 'local'
                ? { fontFamily: quoteFontFamily(font.name), fontImport: '' }
                : { fontFamily: quoteFontFamily(font.name), fontImport: font.css || '' };
            const result = await updateSettings(patch);
            if (result?.ok !== false) onChanged();
            return result;
        },
        async importCss(raw) {
            const request = ++generation;
            const css = await buildCss(raw);
            if (!mounted || request !== generation) return { stale: true };
            const family = parseFontFamily(css);
            const importedFonts = family ? rememberFont(fonts(), { type: 'css', name: stripFontQuotes(family), css }) : fonts();
            const fontFamily = family ? quoteFontFamily(family) : (getSettings().fontFamily || 'system-ui');
            const result = await updateSettings({ fontImport: css, fontFamily, importedFonts });
            if (result?.ok !== false) {
                view.applyCss(css);
                await view.waitForFont(createFontStack({ fontFamily, fontImport: css }));
                notify(family ? 'imported' : 'imported-code', family);
                onChanged();
            }
            return result;
        },
        async importLocal(file) {
            const family = file.name.replace(/\.(ttf|otf|woff2?)$/i, '').trim() || 'Local Font';
            const dataUrl = await view.readFile(file);
            const font = { id: `local:${family}:${Date.now()}`, type: 'local', name: family, dataUrl };
            await view.loadFont(font);
            await repository.importFont(font, dataUrl);
            const importedFonts = rememberFont(fonts(), { ...font, dataUrl: '' });
            const result = await updateSettings({ fontFamily: quoteFontFamily(family), fontImport: '', importedFonts });
            if (result?.ok === false) await repository.deleteFont(font.id).catch(() => {});
            else {
                notify('local-imported', family);
                onChanged();
            }
            return result;
        },
        async deleteFont(id) {
            const previous = fonts();
            const deleted = previous.find(font => font.id === id);
            const next = previous.filter(font => font.id !== id);
            const activeFamily = stripFontQuotes(getSettings()?.fontFamily);
            const deletingActiveFont = deleted && stripFontQuotes(deleted.name) === activeFamily;
            const result = await updateSettings({
                importedFonts: next,
                ...(deletingActiveFont ? { fontFamily: 'system-ui', fontImport: '' } : {}),
            });
            if (result?.ok === false) return result;
            try { await repository.deleteFont(id); } catch (error) {
                await updateSettings({ importedFonts: previous });
                throw error;
            }
            onChanged();
            return result;
        },
        applyCss() { view.applyCss(sanitizeFontCss(getSettings()?.fontImport || '')); },
        async resolveFont() {
            const family = stripFontQuotes(getSettings()?.fontFamily);
            const local = fonts().find(item => item.type === 'local' && stripFontQuotes(item.name) === family);
            if (local) await loadLocal(local);
            this.applyCss();
            return { font: createFontStack(getSettings()) };
        },
        waitForFont: font => view.waitForFont(font),
        destroy() { mounted = false; generation += 1; view.destroy(); },
    };
}
