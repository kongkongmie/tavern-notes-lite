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
            continue;
        }
        if (!current || !rawLine.trim()) continue;
        const item = rawLine.replace(/^\s*[-*+]\s+/, '').replace(/^\s*#+\s*/, '').trim();
        if (item && current.items.length < 12) current.items.push(item);
    }
    return entries.slice(0, limit);
}

export async function fetchUpdateInfo({ fetchImpl = fetch, installedVersion, manifestUrl, changelogUrl, annotationUrl = '' }) {
    const stamp = Date.now();
    const [manifestResponse, changelogResponse, annotationResponse] = await Promise.all([
        fetchImpl(`${manifestUrl}?t=${stamp}`, { cache: 'no-store' }),
        fetchImpl(`${changelogUrl}?t=${stamp}`, { cache: 'no-store' }).catch(() => null),
        annotationUrl ? fetchImpl(`${annotationUrl}?t=${stamp}`, { cache: 'no-store' }).catch(() => null) : null,
    ]);
    if (!manifestResponse.ok) throw new Error(`manifest:${manifestResponse.status}`);
    const manifest = await manifestResponse.json();
    const latestVersion = String(manifest.version || '').trim();
    if (!latestVersion) throw new Error('manifest:missing-version');
    const changelog = changelogResponse?.ok ? parseChangelog(await changelogResponse.text()) : [];
    const annotations = annotationResponse?.ok ? parseChangelog(await annotationResponse.text()) : [];
    return {
        installedVersion: String(installedVersion || ''),
        latestVersion,
        hasUpdate: compareVersions(latestVersion, installedVersion) > 0,
        changelog,
        annotations,
    };
}
