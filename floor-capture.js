export function normalizeFloorText(value) {
    return String(value || '')
        .replace(/\u00a0/g, ' ')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .join('\n')
        .trim();
}

export function getCleanFloorElementText(element, excludeSelector) {
    if (!element) return '';
    if (excludeSelector && element.matches?.(excludeSelector)) return '';
    const clone = element.cloneNode(true);
    if (excludeSelector) clone.querySelectorAll?.(excludeSelector).forEach(child => child.remove());
    clone.querySelectorAll?.('[hidden], [aria-hidden="true"], .displayNone, .hidden').forEach(child => child.remove());
    return normalizeFloorText(clone.innerText || clone.textContent || '');
}

export function queryFloorCandidates(root, selectors, excludeSelector) {
    for (const selector of selectors || []) {
        let matches = [];
        try {
            matches = Array.from(root?.querySelectorAll?.(selector) || []);
        } catch {
            continue;
        }
        const texts = matches
            .map(element => getCleanFloorElementText(element, excludeSelector))
            .filter(Boolean);
        if (texts.length) return texts;
    }
    return [];
}

export function extractFloorText({ documentRef, messageElement, rawMessage, selectors, excludeSelector }) {
    if (!messageElement) return '';
    const contentSelectors = (selectors || []).filter(selector => selector !== '.mes_text');
    // Renderers may replace a long body with a short summary while retaining
    // the original tag. The stored message remains the source of truth.
    if (String(rawMessage || '').trim() && documentRef) {
        const rawRoot = documentRef.createElement('div');
        rawRoot.innerHTML = String(rawMessage);
        const rawCandidates = queryFloorCandidates(rawRoot, contentSelectors, excludeSelector);
        if (rawCandidates.length) return rawCandidates.join('\n\n');
    }

    const renderedCandidates = queryFloorCandidates(messageElement, contentSelectors, excludeSelector);
    if (renderedCandidates.length) return renderedCandidates.join('\n\n');

    const fallback = messageElement.querySelector?.('.mes_text')
        || messageElement.querySelector?.('.mes_block')
        || messageElement;
    return getCleanFloorElementText(fallback, excludeSelector);
}
