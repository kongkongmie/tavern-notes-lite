import { isSameTag, normalizeTagName, removeTagFromFilter, replaceTagInFilter, validateTagName } from '../core/tag-model.js';

export function createTagController({
    repository,
    listController,
    getQueryState,
    replaceQueryState,
    getRecentTags = () => [],
    updateRecentTags = async () => ({ ok: true }),
    confirmRename,
    confirmDelete,
    notify = () => {},
    onQueryChange = () => {},
}) {
    let mounted = false;
    let submitting = false;

    async function renameTag(oldName, requestedName, options = {}) {
        if (!mounted || submitting) return { ok: false, busy: submitting };
        const candidate = requestedName ?? await confirmRename?.(oldName, options);
        const checked = validateTagName(candidate);
        if (!checked.valid || isSameTag(oldName, checked.name)) return { ok: false, cancelled: true };
        const previousQuery = getQueryState();
        submitting = true;
        try {
            const result = await repository.renameTag(oldName, checked.name, options);
            const tags = replaceTagInFilter(previousQuery.tags, oldName, result.newName);
            replaceQueryState({ ...previousQuery, tags });
            onQueryChange(tags);
            await updateRecentTags(getRecentTags().map(tag => isSameTag(tag, oldName) ? result.newName : tag));
            await listController.refresh();
            notify('renamed', result);
            return { ok: true, value: result };
        } catch (error) {
            replaceQueryState(previousQuery);
            notify('error', error);
            return { ok: false, error };
        } finally { submitting = false; }
    }

    async function deleteTag(tagName, options = {}) {
        if (!mounted || submitting) return { ok: false, busy: submitting };
        const tag = normalizeTagName(tagName);
        if (!tag || (confirmDelete && !(await confirmDelete(tag, options)))) return { ok: false, cancelled: true };
        const previousQuery = getQueryState();
        submitting = true;
        try {
            const result = await repository.deleteTag(tag, options);
            const tags = removeTagFromFilter(previousQuery.tags, tag);
            replaceQueryState({ ...previousQuery, tags, page: tags.length === previousQuery.tags?.length ? previousQuery.page : 1 });
            onQueryChange(tags);
            await updateRecentTags(getRecentTags().filter(item => !isSameTag(item, tag)));
            await listController.refresh();
            notify('deleted', result);
            return { ok: true, value: result };
        } catch (error) {
            replaceQueryState(previousQuery);
            notify('error', error);
            return { ok: false, error };
        } finally { submitting = false; }
    }

    return {
        mount() { mounted = true; },
        renameTag,
        deleteTag,
        destroy() { mounted = false; submitting = false; },
    };
}
