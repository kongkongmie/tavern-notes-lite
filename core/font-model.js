export function stripFontQuotes(value) {
    return String(value || '').trim().replace(/^['"]|['"]$/g, '');
}

export function quoteFontFamily(value) {
    const clean = stripFontQuotes(value);
    return clean ? `"${clean.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"` : '';
}

export function normalizeFontCss(value) {
    const text = String(value || '').trim();
    if (/^https?:\/\/\S+$/i.test(text)) return `@import url("${text}");`;
    return text.split(/\r?\n/).map(line => {
        const clean = line.trim();
        if (/^https?:\/\/\S+$/i.test(clean)) return `@import url("${clean}");`;
        if (/^@import\b/i.test(clean) && !/[;{}]\s*$/.test(clean)) return `${clean};`;
        return line;
    }).join('\n');
}

export function sanitizeFontCss(value) {
    const rules = String(value || '').replace(/\/\*[\s\S]*?\*\//g, '').match(/@font-face\s*\{[^{}]*\}/gi) || [];
    return rules.filter(rule => !/<\/?script|javascript\s*:|expression\s*\(/i.test(rule)).join('\n');
}

export function resolveFontCssUrls(value, stylesheetUrl) {
    return String(value || '').replace(/url\(\s*(['"]?)([^'"\)]+)\1\s*\)/gi, (match, quote, rawUrl) => {
        const fontUrl = String(rawUrl || '').trim();
        if (!fontUrl || /^(?:data:|blob:|https?:|\/\/|#)/i.test(fontUrl)) return match;
        try { return `url("${new URL(fontUrl, stylesheetUrl).href}")`; } catch { return match; }
    });
}

export function extractFontCssUrl(css) {
    const imported = String(css || '').match(/@import\s+url\((['"]?)(.*?)\1\)/i);
    if (imported?.[2]) return imported[2].trim();
    return String(css || '').match(/https?:\/\/[^\s'")]+/i)?.[0] || '';
}

export function parseFontFamily(css) {
    return String(css || '').match(/font-family\s*:\s*([^;}\n]+)/i)?.[1]?.trim() || '';
}

export function rememberFont(fonts, entry, now = Date.now()) {
    if (!entry?.name || (!entry.css && entry.type !== 'local')) return [...fonts];
    const id = entry.id || `${entry.type || 'css'}:${stripFontQuotes(entry.name)}:${now}`;
    const next = { id, type: entry.type || 'css', name: stripFontQuotes(entry.name), css: entry.css || '', dataUrl: entry.dataUrl || '' };
    return [next, ...fonts.filter(font => font.id !== id && !(font.type === next.type && stripFontQuotes(font.name) === next.name))].slice(0, 16);
}

export function createFontStack(settings) {
    const family = String(settings?.fontFamily || parseFontFamily(settings?.fontImport) || '').trim();
    return !family || family === 'system-ui'
        ? 'system-ui, "Noto Serif SC", serif'
        : `${family}, "Noto Serif SC", "Microsoft YaHei", serif`;
}
