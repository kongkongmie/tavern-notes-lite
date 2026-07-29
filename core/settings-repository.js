export function createSettingsRepository({ storage, key }) {
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
        throw new TypeError('Settings Repository requires a storage adapter.');
    }
    if (!key) throw new TypeError('Settings Repository requires a key.');

    async function load() {
        const value = storage.getItem(key);
        return value === null || value === '' ? null : JSON.parse(value);
    }

    async function save(settings) {
        storage.setItem(key, JSON.stringify(settings));
        return settings;
    }

    async function remove() {
        storage.removeItem(key);
    }

    return { load, save, remove };
}
