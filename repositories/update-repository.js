import { createUpdateInfo, parseChangelog } from '../core/update-model.js';

export function createUpdateRepository({
    fetchImpl = fetch,
    installedManifestUrl,
    fallbackVersion,
    manifestUrl,
    changelogUrl,
    annotationUrl = '',
    noticeStorage,
    noticeKey,
}) {
    async function getInstalledVersion() {
        try {
            const response = await fetchImpl(`${installedManifestUrl}?t=${Date.now()}`, { cache: 'no-store' });
            if (!response.ok) return fallbackVersion;
            return (await response.json()).version || fallbackVersion;
        } catch {
            return fallbackVersion;
        }
    }

    return {
        async check() {
            const stamp = Date.now();
            const installedVersion = await getInstalledVersion();
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
        },
        getInstalledVersion,
        readNotice() {
            try { return JSON.parse(noticeStorage.getItem(noticeKey) || '{}') || {}; } catch { return {}; }
        },
        writeNotice(value) {
            noticeStorage.setItem(noticeKey, JSON.stringify(value));
        },
    };
}
