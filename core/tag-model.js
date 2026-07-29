export function normalizeTagName(value) {
    return String(value || '').trim();
}

export function normalizeTagKey(value) {
    return normalizeTagName(value).toLocaleLowerCase();
}

export function validateTagName(value) {
    const name = normalizeTagName(value);
    return { valid: Boolean(name) && name.length <= 40, name };
}

export function isSameTag(left, right) {
    return normalizeTagKey(left) === normalizeTagKey(right);
}

export function replaceTagInFilter(tags, oldName, newName) {
    return (Array.isArray(tags) ? tags : []).map(tag => isSameTag(tag, oldName) ? normalizeTagName(newName) : tag);
}

export function removeTagFromFilter(tags, tagName) {
    return (Array.isArray(tags) ? tags : []).filter(tag => !isSameTag(tag, tagName));
}
