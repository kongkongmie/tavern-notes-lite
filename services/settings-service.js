import {
    DEFAULT_SETTINGS,
    normalizeSettings,
    pickPersistedSettings,
} from '../core/settings-model.js';

function isPlainObject(value) {
    if (!value || typeof value !== 'object') return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function mergePatch(current, patch) {
    const result = { ...current };
    for (const [key, value] of Object.entries(patch || {})) {
        result[key] = isPlainObject(value) && isPlainObject(current?.[key])
            ? mergePatch(current[key], value)
            : value;
    }
    return result;
}

export function createSettingsService({
    store,
    repository,
    sliceName = 'settings',
}) {
    let destroyed = false;
    let queue = Promise.resolve();

    function current() {
        return store.getSlice(sliceName);
    }

    function failure(error, settings) {
        let snapshot = settings;
        if (snapshot === undefined) {
            try {
                snapshot = current();
            } catch {
                snapshot = normalizeSettings(DEFAULT_SETTINGS);
            }
        }
        return { ok: false, settings: snapshot, error };
    }

    function enqueue(operation) {
        const task = queue.then(operation, operation);
        queue = task.then(() => undefined, () => undefined);
        return task;
    }

    async function loadNow() {
        if (destroyed) return failure(new Error('Settings Service is destroyed.'));
        try {
            const raw = await repository.load();
            const settings = normalizeSettings(raw || DEFAULT_SETTINGS);
            store.replace(sliceName, settings);
            return { ok: true, settings, found: raw !== null };
        } catch (error) {
            const settings = normalizeSettings(DEFAULT_SETTINGS);
            store.replace(sliceName, settings);
            return { ...failure(error, settings), found: false };
        }
    }

    async function persist(nextSettings, previousSettings) {
        store.replace(sliceName, nextSettings);
        try {
            await repository.save(pickPersistedSettings(nextSettings));
            return { ok: true, settings: current() };
        } catch (error) {
            store.replace(sliceName, previousSettings);
            return failure(error, current());
        }
    }

    async function updateNow(patch) {
        if (destroyed) return failure(new Error('Settings Service is destroyed.'));
        const previous = current();
        const next = normalizeSettings(mergePatch(previous, patch));
        return persist(next, previous);
    }

    async function replaceNow(settings) {
        if (destroyed) return failure(new Error('Settings Service is destroyed.'));
        const previous = current();
        return persist(normalizeSettings(settings), previous);
    }

    async function resetNow() {
        if (destroyed) return failure(new Error('Settings Service is destroyed.'));
        const previous = current();
        return persist(normalizeSettings(DEFAULT_SETTINGS), previous);
    }

    async function flushNow() {
        if (destroyed) return failure(new Error('Settings Service is destroyed.'));
        try {
            const settings = current();
            await repository.save(pickPersistedSettings(settings));
            return { ok: true, settings };
        } catch (error) {
            return failure(error);
        }
    }

    function destroy() {
        destroyed = true;
    }

    function load() {
        return enqueue(loadNow);
    }

    function update(patch) {
        return enqueue(() => updateNow(patch));
    }

    function replace(settings) {
        return enqueue(() => replaceNow(settings));
    }

    function reset() {
        return enqueue(resetNow);
    }

    function flush() {
        return enqueue(flushNow);
    }

    return {
        load,
        update,
        replace,
        reset,
        flush,
        destroy,
    };
}
