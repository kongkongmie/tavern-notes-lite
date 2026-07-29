import { buildNoteQueryKey, normalizeNoteQuery } from '../core/note-query-model.js';
import { NOTE_UI_QUERY } from '../core/note-list-model.js';

export function createNoteFilterController({
    getQueryState,
    replaceQueryState,
    listController,
    debounceMs = 220,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
}) {
    let mounted = false;
    let timer = null;
    let lastLoadedKey = '';
    let scheduledKey = '';
    let pendingResolve = null;

    function commit(patch, { debounce = false } = {}) {
        if (!mounted) return Promise.resolve({ ok: false, stale: true });
        const query = normalizeNoteQuery({ ...getQueryState(), ...patch, page: 1 });
        replaceQueryState(query);
        const key = buildNoteQueryKey(query);
        if (key === lastLoadedKey || key === scheduledKey) return Promise.resolve({ ok: true, skipped: true });
        if (timer) {
            clearTimer(timer);
            pendingResolve?.({ ok: true, skipped: true });
        }
        const run = () => {
            timer = null;
            scheduledKey = '';
            pendingResolve = null;
            lastLoadedKey = key;
            return listController.load(query);
        };
        if (!debounce) return run();
        return new Promise(resolve => {
            scheduledKey = key;
            pendingResolve = resolve;
            timer = setTimer(async () => resolve(await run()), debounceMs);
        });
    }

    return {
        mount() {
            if (mounted) return;
            mounted = true;
            lastLoadedKey = buildNoteQueryKey(getQueryState());
        },
        setSearch: value => commit({ search: String(value ?? '').trim() }, { debounce: true }),
        setType: value => commit({ type: value || 'all' }),
        setCharacter: id => commit({ characterId: id || null }),
        setChat: id => commit({ chatId: id || null }),
        setTag: tag => commit({ tags: tag ? [String(tag)] : [] }),
        setSort: (sortBy, sortOrder) => commit({ sortBy, sortOrder }),
        reset: () => commit(NOTE_UI_QUERY),
        destroy() {
            mounted = false;
            lastLoadedKey = '';
            if (timer) clearTimer(timer);
            timer = null;
            scheduledKey = '';
            pendingResolve?.({ ok: false, stale: true });
            pendingResolve = null;
        },
    };
}
