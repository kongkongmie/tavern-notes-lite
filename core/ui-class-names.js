export function uiClass(name, {
    classPrefix,
    canonicalPrefix = 'tn',
    keepLegacyClass = true,
} = {}) {
    const cleanName = String(name || '').trim();
    const cleanClassPrefix = String(classPrefix || '').trim();
    const cleanCanonicalPrefix = String(canonicalPrefix || '').trim();
    if (!cleanName || !cleanClassPrefix || !cleanCanonicalPrefix) {
        throw new TypeError('uiClass requires non-empty name, classPrefix, and canonicalPrefix');
    }
    const canonicalClass = `${cleanCanonicalPrefix}-${cleanName}`;
    const legacyClass = `${cleanClassPrefix}-${cleanName}`;
    if (!keepLegacyClass || legacyClass === canonicalClass) return canonicalClass;
    return `${canonicalClass} ${legacyClass}`;
}
