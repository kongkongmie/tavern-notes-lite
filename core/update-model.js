export function compareVersions(left, right) {
    const a = String(left || '').replace(/^v/i, '').split(/[.-]/).map(part => Number.parseInt(part, 10) || 0);
    const b = String(right || '').replace(/^v/i, '').split(/[.-]/).map(part => Number.parseInt(part, 10) || 0);
    const length = Math.max(a.length, b.length, 3);
    for (let index = 0; index < length; index += 1) {
        const difference = (a[index] || 0) - (b[index] || 0);
        if (difference !== 0) return difference;
    }
    return 0;
}

export function parseChangelog(markdown, limit = 12) {
    const entries = [];
    let current = null;
    for (const rawLine of String(markdown || '').split(/\r?\n/)) {
        const heading = rawLine.match(/^##\s+\[?v?([^\]\s]+)\]?/i);
        if (heading) {
            current = { version: heading[1], items: [] };
            entries.push(current);
            if (entries.length > limit) break;
        } else if (current && rawLine.trim()) {
            const item = rawLine.replace(/^\s*[-*+]\s+/, '').replace(/^\s*#+\s*/, '').trim();
            if (item && current.items.length < 12) current.items.push(item);
        }
    }
    return entries.slice(0, limit);
}

export function createUpdateInfo({ installedVersion, latestVersion, changelog = [], annotations = [] }) {
    return {
        installedVersion: String(installedVersion || ''),
        latestVersion: String(latestVersion || ''),
        hasUpdate: compareVersions(latestVersion, installedVersion) > 0,
        changelog,
        annotations,
    };
}

export function shouldShowUpdateNotice(previous, version, today) {
    return !(previous?.version === version && previous?.date === today);
}
