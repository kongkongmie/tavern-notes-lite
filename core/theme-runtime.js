const PRESERVED_INLINE_SUFFIXES = new Set(['background-image', 'scope-avatar']);

export function normalizeThemeFlavor(value) {
    const flavor = String(value || '').replace(/[^a-z0-9_-]/gi, '').toLowerCase();
    return flavor === 'archive' ? 'default' : flavor;
}
export function replaceThemeVariables(element, variables, prefix) {
    if (!element) return [];
    const accepted = Object.entries(variables || {})
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => [key, String(value)]);
    const nextKeys = new Set(accepted.map(([key]) => key));

    for (let index = element.style.length - 1; index >= 0; index -= 1) {
        const key = element.style.item(index);
        if (!key.startsWith(prefix)) continue;
        const suffix = key.slice(prefix.length);
        if (!nextKeys.has(key) && !PRESERVED_INLINE_SUFFIXES.has(suffix)) element.style.removeProperty(key);
    }
    accepted.forEach(([key, value]) => element.style.setProperty(key, value));
    return accepted.map(([key]) => key);
}
