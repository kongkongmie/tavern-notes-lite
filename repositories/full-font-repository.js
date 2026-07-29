export function createFullFontRepository(options) {
    return createIndexedDbFontRepository(options);
}

export function createIndexedDbFontRepository({ indexedDb = globalThis.indexedDB, getDatabaseName, storeName = 'fonts', unsupportedError = () => new Error('IndexedDB unsupported') }) {
    function open() {
        return new Promise((resolve, reject) => {
            if (!indexedDb) return reject(unsupportedError());
            const request = indexedDb.open(getDatabaseName(), 1);
            request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: 'id' });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('IndexedDB open failed.'));
        });
    }
    async function transaction(mode, operation) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, mode);
            const request = operation(tx.objectStore(storeName));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
            tx.oncomplete = () => db.close();
            tx.onerror = () => { db.close(); reject(tx.error || new Error('IndexedDB transaction failed.')); };
        });
    }
    return {
        listFonts: async () => (await transaction('readonly', store => store.getAll())).map(value => ({ ...value })),
        importFont: (font, dataUrl) => transaction('readwrite', store => store.put({ id: font.id, dataUrl })),
        deleteFont: id => transaction('readwrite', store => store.delete(id)),
        getFont: async id => (await transaction('readonly', store => store.get(id))) || null,
        clearFonts: () => transaction('readwrite', store => store.clear()),
    };
}
