import { normalizeNoteQuery } from '../core/note-query-model.js';
import { clampNotePage, createNoteListCommit } from '../core/note-list-model.js';

export function createNoteListController({
    repository,
    getListState,
    patchListState,
    getQueryState,
    replaceQueryState,
    getListOptions = () => ({}),
    onStateChange = () => {},
    onSuccess = () => {},
    onError = () => {},
}) {
    let mounted = false;
    let requestVersion = 0;

    async function load(query = getQueryState()) {
        if (!mounted) return { ok: false, stale: true };
        const version = ++requestVersion;
        const normalized = normalizeNoteQuery(query);
        replaceQueryState(normalized);
        patchListState({ loading: true, error: null });
        onStateChange();
        try {
            const result = await repository.listNotes(normalized, getListOptions(normalized));
            if (!mounted || version !== requestVersion) return { ok: false, stale: true };
            const page = clampNotePage(normalized.page, result.total, normalized.pageSize);
            if (page !== normalized.page) {
                replaceQueryState({ ...normalized, page });
                return load({ ...normalized, page });
            }
            patchListState(createNoteListCommit(result));
            onStateChange();
            onSuccess(result, normalized);
            return { ok: true, result };
        } catch (error) {
            if (!mounted || version !== requestVersion) return { ok: false, stale: true, error };
            patchListState({ loading: false, error });
            onStateChange();
            onError(error, normalized);
            return { ok: false, error };
        }
    }

    return {
        mount() {
            if (mounted) return;
            mounted = true;
        },
        load,
        refresh: () => load(getQueryState()),
        reloadCurrentPage: () => load(getQueryState()),
        goToPage(page) {
            const query = getQueryState();
            const next = clampNotePage(page, getListState().total, query.pageSize);
            if (next === query.page) return Promise.resolve({ ok: true, skipped: true });
            return load({ ...query, page: next });
        },
        getVisibleNotes: () => getListState().items.slice(),
        destroy() {
            mounted = false;
            requestVersion += 1;
        },
    };
}
