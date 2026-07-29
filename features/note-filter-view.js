export function createNoteFilterView({
    root,
    selectors,
    onSearch,
    onType,
    onCharacter,
    onChat,
    onTag,
    onSort,
    onReset,
}) {
    let abortController = null;
    function mount() {
        destroy();
        const host = typeof root === 'function' ? root() : root;
        if (!host) return;
        abortController = new AbortController();
        const signal = abortController.signal;
        host.addEventListener('input', event => {
            if (event.target.matches(selectors.search)) onSearch(event.target.value);
        }, { signal });
        host.addEventListener('change', event => {
            if (event.target.matches(selectors.sort)) onSort(event.target.dataset.sortBy || event.target.value, event.target.dataset.sortOrder);
        }, { signal });
        host.addEventListener('click', event => {
            const target = event.target.closest('button,[data-filter],[data-tag],[data-character-id],[data-chat-id]');
            if (!target) return;
            if (target.matches(selectors.type)) onType(target.dataset.filter);
            else if (target.matches(selectors.character)) onCharacter(target.dataset.characterId || null);
            else if (target.matches(selectors.chat)) onChat(target.dataset.chatId || null);
            else if (target.matches(selectors.tag)) onTag(target.dataset.tag || '');
            else if (target.matches(selectors.reset)) onReset();
        }, { signal });
    }
    function destroy() {
        abortController?.abort();
        abortController = null;
    }
    return { mount, destroy };
}
