import { createUpdateInfo, parseChangelog } from './update-model.js';

export { compareVersions, parseChangelog } from './update-model.js';

export async function fetchUpdateInfo({ fetchImpl = fetch, installedVersion, manifestUrl, changelogUrl, annotationUrl = '' }) {
    const stamp = Date.now();
    const [manifestResponse, changelogResponse, annotationResponse] = await Promise.all([
        fetchImpl(`${manifestUrl}?t=${stamp}`, { cache: 'no-store' }),
        fetchImpl(`${changelogUrl}?t=${stamp}`, { cache: 'no-store' }).catch(() => null),
        annotationUrl ? fetchImpl(`${annotationUrl}?t=${stamp}`, { cache: 'no-store' }).catch(() => null) : null,
    ]);
    if (!manifestResponse.ok) throw new Error(`manifest:${manifestResponse.status}`);
    const latestVersion = String((await manifestResponse.json()).version || '').trim();
    if (!latestVersion) throw new Error('manifest:missing-version');
    return createUpdateInfo({
        installedVersion,
        latestVersion,
        changelog: changelogResponse?.ok ? parseChangelog(await changelogResponse.text()) : [],
        annotations: annotationResponse?.ok ? parseChangelog(await annotationResponse.text()) : [],
    });
}
