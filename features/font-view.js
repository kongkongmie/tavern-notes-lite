export function createFontView({ getStyleElement, translate, stripQuotes = value => value, fontSet = document.fonts, FontFaceImpl = globalThis.FontFace, readFile }) {
    return {
        mount() {},
        renderSavedFonts(select, fonts, currentFamily) {
            if (!select) return;
            select.replaceChildren();
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = fonts.length ? translate('savedFontsPlaceholder') : translate('noSavedFonts');
            select.append(placeholder);
            fonts.forEach(font => {
                const option = document.createElement('option');
                option.value = font.id;
                option.textContent = font.type === 'local' ? `${font.name} · local` : font.name;
                select.append(option);
            });
            select.value = fonts.find(font => stripQuotes(font.name) === stripQuotes(currentFamily))?.id || '';
        },
        applyCss(css) {
            const style = getStyleElement();
            if (style) style.textContent = css || '';
        },
        async loadFont({ name, dataUrl }) {
            if (!FontFaceImpl || !fontSet) throw new Error('font-unsupported');
            const face = new FontFaceImpl(name, `url(${dataUrl})`);
            await face.load();
            fontSet.add(face);
        },
        readFile,
        async waitForFont(font) {
            if (!fontSet) return;
            const timeout = new Promise(resolve => setTimeout(resolve, 900));
            const tasks = [];
            if (fontSet.load) tasks.push(fontSet.load(`32px ${font}`, '酒馆笔记分享卡'));
            if (fontSet.ready) tasks.push(fontSet.ready);
            await Promise.race([Promise.allSettled(tasks), timeout]);
        },
        destroy() { this.applyCss(''); },
    };
}
