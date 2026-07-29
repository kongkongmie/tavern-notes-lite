export function createNoteMutationController({
    repository,
    listController,
    getListState,
    getQueryState,
    getNoteUiState,
    patchNoteUiState,
    replaceQueryState,
    onSuccess = () => {},
    onError = () => {},
}) {
    let mounted = false;

    async function mutate(operation, successType, { closeEditor = false, refresh = true } = {}) {
        if (!mounted) return { ok: false, stale: true };
        patchNoteUiState({ submitting: true });
        try {
            const value = await operation();
            if (!mounted) return { ok: false, stale: true };
            if (closeEditor) patchNoteUiState({ editingId: null });
            if (refresh) await listController.reloadCurrentPage();
            onSuccess(successType, value);
            return { ok: true, value };
        } catch (error) {
            if (mounted) onError(error, successType);
            return { ok: false, error };
        } finally {
            if (mounted) patchNoteUiState({ submitting: false });
        }
    }

    async function remove(operation, successType) {
        const result = await mutate(operation, successType);
        if (!result.ok || !mounted) return result;
        const query = getQueryState();
        if (query.page > 1 && getListState().items.length === 0) {
            replaceQueryState({ ...query, page: query.page - 1 });
            await listController.reloadCurrentPage();
        }
        return result;
    }

    return {
        mount() {
            mounted = true;
        },
        createNote: (input, options = {}) => mutate(
            () => repository.createNote(input, options),
            'create',
            { refresh: options.refresh !== false },
        ),
        updateNote: (id, patch, options) => mutate(() => repository.updateNote(id, patch, options), 'update', { closeEditor: true }),
        deleteNote: (id, options) => remove(() => repository.deleteNote(id, options), 'delete'),
        deleteNotes: (ids, options) => remove(() => repository.deleteNotes(ids, options), 'deleteMany'),
        openEditor(note) {
            if (!mounted) return;
            patchNoteUiState({ editingId: note?.id ?? null });
            return note || null;
        },
        closeEditor() {
            if (!mounted || getNoteUiState().submitting) return;
            patchNoteUiState({ editingId: null });
        },
        destroy() {
            mounted = false;
            patchNoteUiState({ submitting: false, editingId: null });
        },
    };
}
