export function createTagView({
    root,
    selectors,
    getState,
    translate,
    escapeHtml,
    normalizeKey,
    onSelect,
    onRename,
    onDelete,
    onQuery = () => {},
    onSort = () => {},
}) {
    let mounted = false;
    let abortController = null;

    function elements() {
        const host = typeof root === 'function' ? root() : root;
        return {
            host,
            shelf: host?.querySelector(selectors.shelf),
            library: host?.querySelector(selectors.library),
            list: host?.querySelector(selectors.list),
            search: host?.querySelector(selectors.search),
        };
    }

    function homeTags(state) {
        const byKey = new Map(state.tags.map(tag => [normalizeKey(tag.name), tag]));
        const selected = [];
        const append = tag => {
            if (tag && !selected.some(item => normalizeKey(item.name) === normalizeKey(tag.name))) selected.push(tag);
        };
        if (state.activeTag) append(byKey.get(normalizeKey(state.activeTag)));
        state.recentTags.forEach(name => append(byKey.get(normalizeKey(name))));
        [...state.tags].sort((a, b) => Number(b.count || 0) - Number(a.count || 0) || a.name.localeCompare(b.name)).forEach(append);
        return selected.slice(0, 12);
    }

    function renderShelf() {
        const { shelf } = elements();
        if (!shelf) return;
        const state = getState();
        shelf.classList.remove('tn-hidden');
        shelf.innerHTML = `<button class="${selectors.prefix}-tag-filter ${selectors.prefix}-tag-library-open" type="button"><i class="fa-solid fa-tags"></i><span>${escapeHtml(translate('allTags'))}</span><small>${state.tags.length}</small></button>${state.activeTag ? `<button class="${selectors.prefix}-tag-filter ${selectors.prefix}-tag-clear active" type="button" data-tag=""><i class="fa-solid fa-xmark"></i><span>${escapeHtml(translate('clearTagFilter'))}</span></button>` : ''}${homeTags(state).map(tag => `<button class="${selectors.prefix}-tag-filter ${state.activeTag === tag.name ? 'active' : ''}" type="button" data-tag="${escapeHtml(tag.name)}"><span>${escapeHtml(tag.name)}</span><small>${tag.count}</small></button>`).join('')}${!state.tags.length ? `<div class="${selectors.prefix}-tag-shelf-empty"><i class="fa-solid fa-pen-to-square"></i><span>${escapeHtml(translate('tagShelfEmpty'))}</span></div>` : ''}`;
    }

    function renderLibrary() {
        const { list, library } = elements();
        if (!list) return;
        const state = getState();
        const query = normalizeKey(state.query);
        const tags = state.tags.filter(tag => !query || normalizeKey(tag.name).includes(query)).sort((a, b) => state.sort === 'name' ? a.name.localeCompare(b.name) : Number(b.count || 0) - Number(a.count || 0) || a.name.localeCompare(b.name));
        list.innerHTML = tags.length ? tags.map(tag => `<div class="${selectors.prefix}-tag-library-row ${state.activeTag === tag.name ? 'active' : ''}"><button class="${selectors.prefix}-tag-library-item ${state.activeTag === tag.name ? 'active' : ''}" type="button" data-tag="${escapeHtml(tag.name)}"><i class="fa-solid fa-tag"></i><span>${escapeHtml(tag.name)}</span><small>${tag.count}</small></button><button class="${selectors.prefix}-tag-rename" type="button" data-rename-tag="${escapeHtml(tag.name)}" data-tag-count="${tag.count}" title="${escapeHtml(translate('renameTag'))}"><i class="fa-solid fa-pen"></i></button><button class="${selectors.prefix}-tag-delete" type="button" data-delete-tag="${escapeHtml(tag.name)}" data-tag-count="${tag.count}" title="${escapeHtml(translate('deleteTag'))}" aria-label="${escapeHtml(translate('deleteTag'))}"><i class="fa-solid fa-trash-can"></i></button></div>`).join('') : state.tags.length ? `<div class="${selectors.prefix}-tag-library-empty">${escapeHtml(translate('noMatchingTags'))}</div>` : `<div class="${selectors.prefix}-tag-empty-guide"><div class="${selectors.prefix}-tag-empty-icon"><i class="fa-solid fa-tags"></i><i class="fa-solid fa-plus"></i></div><strong>${escapeHtml(translate('tagEmptyTitle'))}</strong><p>${escapeHtml(translate('tagEmptyIntro'))}</p><ol><li><b>1</b><span>${escapeHtml(translate('tagEmptyStepEdit'))}</span></li><li><b>2</b><span>${escapeHtml(translate('tagEmptyStepAdd'))}</span></li><li><b>3</b><span>${escapeHtml(translate('tagEmptyStepSave'))}</span></li></ol><button class="${selectors.prefix}-tag-library-back" type="button"><i class="fa-solid fa-arrow-left"></i><span>${escapeHtml(translate('backToNotes'))}</span></button></div>`;
        list.closest(`.${selectors.prefix}-tag-library-card`)?.classList.toggle('is-empty', state.tags.length === 0);
        library?.querySelectorAll('[data-tag-sort]').forEach(button => button.classList.toggle('active', button.dataset.tagSort === state.sort));
    }

    function open() {
        const { library, search } = elements();
        renderLibrary();
        library?.classList.add('open');
        library?.setAttribute('aria-hidden', 'false');
        setTimeout(() => search?.focus(), 0);
    }

    function close() {
        const { library } = elements();
        library?.classList.remove('open');
        library?.setAttribute('aria-hidden', 'true');
    }

    function mount() {
        if (mounted) destroy();
        mounted = true;
        abortController = new AbortController();
        const { host } = elements();
        host?.addEventListener('click', event => {
            if (event.target.closest?.(`.${selectors.prefix}-tag-library-open`)) return open();
            if (event.target.closest?.(`.${selectors.prefix}-tag-library-close, .${selectors.prefix}-tag-library-back`) || event.target === elements().library) return close();
            const remove = event.target.closest?.('[data-delete-tag]');
            if (remove) return onDelete(remove.dataset.deleteTag, Number(remove.dataset.tagCount || 0));
            const rename = event.target.closest?.('[data-rename-tag]');
            if (rename) return onRename(rename.dataset.renameTag, Number(rename.dataset.tagCount || 0));
            const tag = event.target.closest?.(`${selectors.library} .${selectors.prefix}-tag-library-item`);
            if (tag) { onSelect(tag.dataset.tag || ''); close(); }
            const sort = event.target.closest?.('[data-tag-sort]');
            if (sort) { onSort(sort.dataset.tagSort === 'name' ? 'name' : 'count'); renderLibrary(); }
        }, { signal: abortController.signal });
        elements().search?.addEventListener('input', event => {
            onQuery(event.target.value || '');
            renderLibrary();
        }, { signal: abortController.signal });
    }

    function destroy() {
        abortController?.abort();
        abortController = null;
        mounted = false;
    }

    return { mount, destroy, renderShelf, renderLibrary, open, close };
}
