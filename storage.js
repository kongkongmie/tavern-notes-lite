const DB_NAME = 'tavern-notes-lite';
const DB_VERSION = 1;
const NOTE_STORE = 'notes';
const META_STORE = 'meta';
const MAX_CONTENT_LENGTH = 200000;

let databasePromise = null;

function requestResult(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
    });
}

function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted.'));
        transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed.'));
    });
}

export function openLiteDatabase() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(NOTE_STORE)) {
                const notes = database.createObjectStore(NOTE_STORE, { keyPath: 'id' });
                notes.createIndex('seq', 'seq', { unique: false });
                notes.createIndex('type', 'type', { unique: false });
                notes.createIndex('createdAt', 'createdAt', { unique: false });
            }
            if (!database.objectStoreNames.contains(META_STORE)) {
                database.createObjectStore(META_STORE, { keyPath: 'key' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            databasePromise = null;
            reject(request.error || new Error('Unable to open Tavern Notes Lite storage.'));
        };
        request.onblocked = () => reject(new Error('Tavern Notes Lite storage is open in another page. Close the other page and retry.'));
    });
    return databasePromise;
}

async function readMeta(key, fallback = null) {
    const database = await openLiteDatabase();
    const transaction = database.transaction(META_STORE, 'readonly');
    const result = await requestResult(transaction.objectStore(META_STORE).get(key));
    return result?.value ?? fallback;
}

async function writeMeta(key, value, transaction = null) {
    if (transaction) {
        transaction.objectStore(META_STORE).put({ key, value });
        return;
    }
    const database = await openLiteDatabase();
    const ownTransaction = database.transaction(META_STORE, 'readwrite');
    ownTransaction.objectStore(META_STORE).put({ key, value });
    await transactionDone(ownTransaction);
}

async function readAllNotes() {
    const database = await openLiteDatabase();
    const transaction = database.transaction(NOTE_STORE, 'readonly');
    return requestResult(transaction.objectStore(NOTE_STORE).getAll());
}

function safeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function makeId(seq) {
    const random = globalThis.crypto?.randomUUID?.().replaceAll('-', '').slice(0, 12)
        || Math.random().toString(36).slice(2, 14);
    return `tnl_${Date.now().toString(36)}_${String(seq).padStart(6, '0')}_${random}`;
}

function normalizeTags(tags) {
    const values = Array.isArray(tags) ? tags : String(tags || '').split(/[,，\n]/);
    const unique = [];
    for (const value of values) {
        const tag = String(value || '').trim().replace(/^#+/, '').slice(0, 40);
        if (!tag || unique.some(item => item.toLocaleLowerCase() === tag.toLocaleLowerCase())) continue;
        unique.push(tag);
        if (unique.length >= 20) break;
    }
    return unique;
}

function cleanNote(input, seq, preserveIdentity = false) {
    const content = String(input?.content || '').trim();
    if (!content) throw new Error('Note content is empty.');
    const now = new Date().toISOString();
    const type = ['user_input', 'excerpt', 'manual'].includes(input?.type) ? input.type : 'manual';
    return {
        id: preserveIdentity && input.id ? String(input.id) : makeId(seq),
        seq: preserveIdentity && Number.isFinite(Number(input.seq)) ? Number(input.seq) : seq,
        type,
        content: content.slice(0, MAX_CONTENT_LENGTH),
        createdAt: preserveIdentity && input.createdAt ? String(input.createdAt) : now,
        updatedAt: preserveIdentity && input.updatedAt ? String(input.updatedAt) : now,
        character: {
            id: input?.character?.id ?? null,
            name: String(input?.character?.name || '未命名角色'),
            avatar: input?.character?.avatar ?? null,
        },
        chat: {
            id: input?.chat?.id ?? null,
            name: String(input?.chat?.name || ''),
            messageId: Number.isFinite(Number(input?.chat?.messageId)) ? Number(input.chat.messageId) : null,
        },
        source: String(input?.source || ''),
        tags: normalizeTags(input?.tags),
        repeatCount: Math.max(1, safeNumber(input?.repeatCount, 1)),
        lastRepeatedAt: input?.lastRepeatedAt ? String(input.lastRepeatedAt) : null,
        latestMessageId: Number.isFinite(Number(input?.latestMessageId))
            ? Number(input.latestMessageId)
            : (Number.isFinite(Number(input?.chat?.messageId)) ? Number(input.chat.messageId) : null),
    };
}

function normalizeRepeatContent(value) {
    return String(value || '').trim().replace(/\r\n?/g, '\n');
}

function userInputContextKey(note) {
    return [note?.character?.id ?? '', note?.character?.name ?? '', note?.chat?.id ?? '', note?.chat?.name ?? '']
        .map(value => String(value).replaceAll('|', '\\|')).join('|');
}

function findUserInputDedupeGroups(notes) {
    const groups = new Map();
    const previousByContext = new Map();
    for (const note of [...notes].sort((left, right) => safeNumber(left.seq) - safeNumber(right.seq))) {
        if (note.type !== 'user_input') continue;
        const contextKey = userInputContextKey(note);
        const contentKey = normalizeRepeatContent(note.content);
        const previous = previousByContext.get(contextKey);
        if (previous && previous.contentKey === contentKey) {
            if (!groups.has(previous.canonical.id)) groups.set(previous.canonical.id, { canonical: previous.canonical, duplicates: [] });
            groups.get(previous.canonical.id).duplicates.push(note);
            continue;
        }
        previousByContext.set(contextKey, { canonical: note, contentKey });
    }
    return Array.from(groups.values());
}

function variantGroupKey(note) {
    if (note.type !== 'user_input' || note.chat?.messageId === null || note.chat?.messageId === undefined) return '';
    return [
        note.type,
        note.character?.id ?? '',
        note.character?.avatar ?? '',
        note.character?.name ?? '',
        note.chat?.id ?? '',
        note.chat?.name ?? '',
        note.chat.messageId,
    ].map(value => String(value).replaceAll('|', '\\|')).join('|');
}

function groupId(groupKey) {
    let hash = 2166136261;
    for (let index = 0; index < groupKey.length; index += 1) {
        hash ^= groupKey.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return `tnlg_${(hash >>> 0).toString(36)}`;
}

function groupNotesForDisplay(notes) {
    const groups = new Map();
    const display = [];
    for (const note of notes) {
        const key = variantGroupKey(note);
        if (!key) {
            display.push(note);
            continue;
        }
        let group = groups.get(key);
        if (!group) {
            group = {
                ...note,
                id: groupId(key),
                groupId: groupId(key),
                variantGroupKey: key,
                activeVariantId: note.id,
                variants: [],
                variantCount: 0,
            };
            groups.set(key, group);
            display.push(group);
        }
        if (!group.variants.some(variant => variant.content === note.content)) group.variants.push(note);
    }
    for (const group of groups.values()) {
        group.variants.sort((left, right) => safeNumber(left.seq) - safeNumber(right.seq));
        group.variantCount = group.variants.length;
        const latest = group.variants[group.variants.length - 1] || group;
        Object.assign(group, {
            activeVariantId: latest.id,
            content: latest.content,
            createdAt: latest.createdAt,
            seq: latest.seq,
            chat: latest.chat,
            source: latest.source,
            tags: latest.tags,
        });
    }
    return display.sort((left, right) => safeNumber(right.seq) - safeNumber(left.seq));
}

function matchesCharacter(note, id, name) {
    if (id !== null && id !== undefined && id !== '') return String(note.character?.id ?? '') === String(id);
    if (name) return String(note.character?.name || '') === String(name);
    return true;
}

function searchMatches(note, query) {
    if (!query) return true;
    const haystack = [note.content, note.character?.name, note.chat?.name, ...(note.tags || [])]
        .join('\n')
        .toLocaleLowerCase();
    return haystack.includes(query.toLocaleLowerCase());
}

function baseFilteredNotes(notes, params) {
    const includeUserInput = params.get('includeUserInput') !== 'false';
    const query = String(params.get('q') || '').trim();
    const selectedTag = String(params.get('tag') || '').trim().toLocaleLowerCase();
    return notes.filter(note => (
        (includeUserInput || note.type !== 'user_input')
        && (!selectedTag || (note.tags || []).some(tag => tag.toLocaleLowerCase() === selectedTag))
        && searchMatches(note, query)
    ));
}

function countGroups(notes) {
    return {
        all: groupNotesForDisplay(notes).length,
        user_input: groupNotesForDisplay(notes.filter(note => note.type === 'user_input')).length,
        excerpt: notes.filter(note => note.type === 'excerpt').length,
        manual: notes.filter(note => note.type === 'manual').length,
    };
}

function characterSummaries(notes) {
    const map = new Map();
    for (const note of notes) {
        const key = [note.character?.id ?? '', note.character?.avatar ?? '', note.character?.name ?? ''].join('|');
        if (!map.has(key)) {
            map.set(key, {
                id: note.character?.id ?? null,
                name: note.character?.name || '未命名角色',
                avatar: note.character?.avatar ?? null,
                total: 0,
                userInput: 0,
                excerpt: 0,
                manual: 0,
                latestAt: note.createdAt || '',
            });
        }
        const item = map.get(key);
        item.total += 1;
        if (note.type === 'user_input') item.userInput += 1;
        else if (note.type === 'excerpt') item.excerpt += 1;
        else item.manual += 1;
        if (String(note.createdAt || '') > item.latestAt) item.latestAt = note.createdAt;
    }
    return Array.from(map.values()).sort((left, right) => String(right.latestAt).localeCompare(String(left.latestAt)));
}

async function addNote(payload) {
    const database = await openLiteDatabase();
    if (payload?.type === 'user_input' && payload?.collapseRepeated !== false) {
        const notes = await readAllNotes();
        const contextKey = userInputContextKey(payload);
        const previous = notes
            .filter(note => note.type === 'user_input' && userInputContextKey(note) === contextKey)
            .sort((left, right) => safeNumber(right.seq) - safeNumber(left.seq))[0];
        if (previous && normalizeRepeatContent(previous.content) === normalizeRepeatContent(payload.content)) {
            const repeatedAt = new Date().toISOString();
            const updated = {
                ...previous,
                updatedAt: repeatedAt,
                repeatCount: Math.max(1, safeNumber(previous.repeatCount, 1)) + 1,
                lastRepeatedAt: repeatedAt,
                latestMessageId: Number.isFinite(Number(payload?.chat?.messageId))
                    ? Number(payload.chat.messageId)
                    : (previous.latestMessageId ?? previous.chat?.messageId ?? null),
            };
            const transaction = database.transaction([NOTE_STORE, META_STORE], 'readwrite');
            transaction.objectStore(NOTE_STORE).put(updated);
            transaction.objectStore(META_STORE).put({ key: 'updatedAt', value: repeatedAt });
            await transactionDone(transaction);
            return { note: updated, deduplicated: true };
        }
    }
    const nextSeq = safeNumber(await readMeta('nextSeq', 1), 1);
    const note = cleanNote(payload, nextSeq);
    const transaction = database.transaction([NOTE_STORE, META_STORE], 'readwrite');
    transaction.objectStore(NOTE_STORE).add(note);
    transaction.objectStore(META_STORE).put({ key: 'nextSeq', value: nextSeq + 1 });
    transaction.objectStore(META_STORE).put({ key: 'updatedAt', value: note.updatedAt });
    await transactionDone(transaction);
    return { note, deduplicated: false };
}

async function dedupeUserInputs(apply = false, selectedIds = null) {
    const notes = await readAllNotes();
    const selected = Array.isArray(selectedIds) ? new Set(selectedIds.map(String)) : null;
    const groups = findUserInputDedupeGroups(notes).filter(group => !selected || selected.has(String(group.canonical.id)));
    const duplicateNotes = groups.reduce((total, group) => total + group.duplicates.length, 0);
    const items = groups.map(group => ({
        id: group.canonical.id,
        content: group.canonical.content,
        characterName: group.canonical.character?.name || '',
        chatName: group.canonical.chat?.name || '',
        occurrences: group.duplicates.length + 1,
        duplicateNotes: group.duplicates.length,
    }));
    if (!apply || !duplicateNotes) return { groups: groups.length, duplicateNotes, remainingNotes: notes.length - duplicateNotes, items };
    const updatedAt = new Date().toISOString();
    const database = await openLiteDatabase();
    const transaction = database.transaction([NOTE_STORE, META_STORE], 'readwrite');
    const store = transaction.objectStore(NOTE_STORE);
    for (const group of groups) {
        const all = [group.canonical, ...group.duplicates];
        const last = all[all.length - 1];
        store.put({
            ...group.canonical,
            updatedAt,
            repeatCount: all.reduce((total, note) => total + Math.max(1, safeNumber(note.repeatCount, 1)), 0),
            lastRepeatedAt: last.lastRepeatedAt || last.updatedAt || last.createdAt || updatedAt,
            latestMessageId: last.latestMessageId ?? last.chat?.messageId ?? null,
        });
        group.duplicates.forEach(note => store.delete(note.id));
    }
    transaction.objectStore(META_STORE).put({ key: 'updatedAt', value: updatedAt });
    await transactionDone(transaction);
    return { groups: groups.length, duplicateNotes, remainingNotes: notes.length - duplicateNotes, items };
}

async function deleteNote(id) {
    const database = await openLiteDatabase();
    const transaction = database.transaction([NOTE_STORE, META_STORE], 'readwrite');
    transaction.objectStore(NOTE_STORE).delete(String(id));
    transaction.objectStore(META_STORE).put({ key: 'updatedAt', value: new Date().toISOString() });
    await transactionDone(transaction);
}

async function updateNote(id, payload) {
    const database = await openLiteDatabase();
    const readTransaction = database.transaction(NOTE_STORE, 'readonly');
    const existing = await requestResult(readTransaction.objectStore(NOTE_STORE).get(String(id)));
    if (!existing) throw new Error('Note not found.');
    const content = String(payload?.content || '').trim();
    if (!content) throw new Error('Note content is empty.');
    const updated = {
        ...existing,
        content: content.slice(0, MAX_CONTENT_LENGTH),
        tags: normalizeTags(payload?.tags),
        updatedAt: new Date().toISOString(),
    };
    const transaction = database.transaction([NOTE_STORE, META_STORE], 'readwrite');
    transaction.objectStore(NOTE_STORE).put(updated);
    transaction.objectStore(META_STORE).put({ key: 'updatedAt', value: updated.updatedAt });
    await transactionDone(transaction);
    return updated;
}

async function removeTagFromAllNotes(tag) {
    const key = String(tag || '').trim().toLocaleLowerCase();
    if (!key) throw new Error('Missing tag.');
    const notes = await readAllNotes();
    const changed = notes.filter(note => normalizeTags(note.tags).some(item => item.toLocaleLowerCase() === key));
    if (!changed.length) return 0;
    const updatedAt = new Date().toISOString();
    const database = await openLiteDatabase();
    const transaction = database.transaction([NOTE_STORE, META_STORE], 'readwrite');
    const store = transaction.objectStore(NOTE_STORE);
    for (const note of changed) {
        store.put({
            ...note,
            tags: normalizeTags(note.tags).filter(item => item.toLocaleLowerCase() !== key),
            updatedAt,
        });
    }
    transaction.objectStore(META_STORE).put({ key: 'updatedAt', value: updatedAt });
    await transactionDone(transaction);
    return changed.length;
}

function summarizeTags(notes) {
    const counts = new Map();
    for (const note of notes) {
        for (const tag of normalizeTags(note.tags)) {
            const key = tag.toLocaleLowerCase();
            const current = counts.get(key) || { name: tag, count: 0 };
            current.count += 1;
            counts.set(key, current);
        }
    }
    return Array.from(counts.values()).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

export async function getAllLiteNotes() {
    const notes = await readAllNotes();
    return notes.sort((left, right) => safeNumber(left.seq) - safeNumber(right.seq));
}

export async function getLiteExport(user = 'default-user') {
    const notes = await getAllLiteNotes();
    return {
        ok: true,
        format: 'tavern-notes-export',
        version: 1,
        source: 'tavern-notes-lite',
        exportedAt: new Date().toISOString(),
        user,
        notes,
    };
}

export async function markLiteExported() {
    await writeMeta('lastExportAt', new Date().toISOString());
}

export async function importLiteExport(payload) {
    if (!payload || payload.format !== 'tavern-notes-export' || !Array.isArray(payload.notes)) {
        throw new Error('This is not a Tavern Notes JSON backup.');
    }
    const existing = await getAllLiteNotes();
    const signatures = new Set(existing.map(note => [
        note.type,
        note.content,
        note.character?.id ?? '',
        note.character?.name ?? '',
        note.chat?.id ?? '',
        note.chat?.messageId ?? '',
        note.createdAt ?? '',
    ].join('\u0001')));
    let nextSeq = Math.max(0, ...existing.map(note => safeNumber(note.seq))) + 1;
    const accepted = [];
    for (const raw of payload.notes) {
        const signature = [
            raw?.type,
            raw?.content,
            raw?.character?.id ?? '',
            raw?.character?.name ?? '',
            raw?.chat?.id ?? '',
            raw?.chat?.messageId ?? '',
            raw?.createdAt ?? '',
        ].join('\u0001');
        if (signatures.has(signature) || !String(raw?.content || '').trim()) continue;
        signatures.add(signature);
        const note = cleanNote(raw, nextSeq, true);
        if (existing.some(item => item.id === note.id) || accepted.some(item => item.id === note.id)) note.id = makeId(nextSeq);
        note.seq = nextSeq;
        accepted.push(note);
        nextSeq += 1;
    }
    if (!accepted.length) return { imported: 0, skipped: payload.notes.length };
    const database = await openLiteDatabase();
    const transaction = database.transaction([NOTE_STORE, META_STORE], 'readwrite');
    const store = transaction.objectStore(NOTE_STORE);
    accepted.forEach(note => store.put(note));
    transaction.objectStore(META_STORE).put({ key: 'nextSeq', value: nextSeq });
    transaction.objectStore(META_STORE).put({ key: 'updatedAt', value: new Date().toISOString() });
    await transactionDone(transaction);
    return { imported: accepted.length, skipped: payload.notes.length - accepted.length };
}

export async function getLiteStorageInfo() {
    const notes = await getAllLiteNotes();
    const approximateBytes = new Blob([JSON.stringify(notes)]).size;
    const lastExportAt = await readMeta('lastExportAt', '');
    let browserUsage = null;
    let browserQuota = null;
    try {
        const estimate = await navigator.storage?.estimate?.();
        browserUsage = estimate?.usage ?? null;
        browserQuota = estimate?.quota ?? null;
    } catch {
        // The extension still has its own approximate size when browser estimates are unavailable.
    }
    return { count: notes.length, approximateBytes, lastExportAt, browserUsage, browserQuota };
}

export async function liteApi(path, options = {}, user = 'default-user') {
    const url = new URL(path, 'https://tavern-notes-lite.local');
    const method = String(options.method || 'GET').toUpperCase();
    if (url.pathname === '/status') {
        const notes = await readAllNotes();
        return { ok: true, user, version: '0.1.3', totalNotes: notes.length, storage: 'IndexedDB' };
    }
    if (url.pathname === '/notes' && method === 'POST') {
        const payload = typeof options.body === 'string' ? JSON.parse(options.body) : (options.body || {});
        const result = await addNote(payload);
        return { ok: true, ...result };
    }
    if (url.pathname === '/notes' && method === 'GET') {
        const allNotes = await readAllNotes();
        const base = baseFilteredNotes(allNotes, url.searchParams);
        const counts = countGroups(base);
        let filtered = base;
        const type = url.searchParams.get('type');
        if (type) filtered = filtered.filter(note => note.type === type);
        filtered = filtered.filter(note => matchesCharacter(
            note,
            url.searchParams.get('characterId'),
            url.searchParams.get('characterName'),
        ));
        const display = groupNotesForDisplay(filtered);
        const offset = Math.max(0, safeNumber(url.searchParams.get('offset')));
        const limit = Math.max(1, safeNumber(url.searchParams.get('limit'), 15));
        return {
            ok: true,
            notes: display.slice(offset, offset + limit),
            totalNotes: display.length,
            allNotes: allNotes.length,
            counts,
        };
    }
    if (url.pathname === '/characters' && method === 'GET') {
        const allNotes = await readAllNotes();
        return { ok: true, characters: characterSummaries(baseFilteredNotes(allNotes, url.searchParams)) };
    }
    if (url.pathname === '/tags' && method === 'GET') {
        const allNotes = await readAllNotes();
        const params = new URLSearchParams(url.searchParams);
        params.delete('q');
        params.delete('tag');
        return { ok: true, tags: summarizeTags(baseFilteredNotes(allNotes, params)) };
    }
    if (url.pathname.startsWith('/tags/') && method === 'DELETE') {
        const tag = decodeURIComponent(url.pathname.slice('/tags/'.length));
        return { ok: true, tag, updated: await removeTagFromAllNotes(tag) };
    }
    if (url.pathname.startsWith('/notes/') && method === 'PATCH') {
        const payload = typeof options.body === 'string' ? JSON.parse(options.body) : (options.body || {});
        const note = await updateNote(decodeURIComponent(url.pathname.slice('/notes/'.length)), payload);
        return { ok: true, note };
    }
    if (url.pathname.startsWith('/notes/') && method === 'DELETE') {
        await deleteNote(decodeURIComponent(url.pathname.slice('/notes/'.length)));
        return { ok: true };
    }
    if (url.pathname === '/user-input-dedupe' && method === 'GET') {
        return { ok: true, ...await dedupeUserInputs(false) };
    }
    if (url.pathname === '/user-input-dedupe' && method === 'POST') {
        const payload = typeof options.body === 'string' ? JSON.parse(options.body) : (options.body || {});
        return { ok: true, ...await dedupeUserInputs(true, payload.ids) };
    }
    throw new Error(`Unsupported Tavern Notes Lite operation: ${method} ${url.pathname}`);
}
