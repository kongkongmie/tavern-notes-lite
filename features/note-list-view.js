export function createNoteListView({
    root,
    selectors,
    renderContent,
    onEdit = () => {},
    onDelete = () => {},
    onShare = () => {},
    onPageChange = () => {},
    onPageJump = () => {},
    onAction = () => {},
}) {
    let abortController = null;

    function mount() {
        destroy();
        const host = typeof root === 'function' ? root() : root;
        if (!host) return;
        abortController = new AbortController();
        host.addEventListener('click', event => {
            const button = event.target.closest('button');
            if (button?.matches(selectors.edit)) return onEdit(button, event);
            if (button?.matches(selectors.delete)) return onDelete(button, event);
            if (button?.matches(selectors.share)) return onShare(button, event);
            if (button?.matches(selectors.previous)) return onPageChange(-1, event);
            if (button?.matches(selectors.next)) return onPageChange(1, event);
            if (button?.matches(selectors.pageJump)) return onPageJump(host.querySelector(selectors.pageInput)?.value || 1, event);
            onAction(event);
        }, { signal: abortController.signal });
        host.addEventListener('keydown', event => {
            if (event.key === 'Enter' && event.target.matches(selectors.pageInput)) onPageJump(event.target.value || 1, event);
        }, { signal: abortController.signal });
    }

    function destroy() {
        abortController?.abort();
        abortController = null;
    }

    return {
        mount,
        render: state => renderContent(state),
        destroy,
    };
}

export function createNoteListRenderer({
    rootDocument = document,
    classPrefix,
    panelId,
    listId,
    pageLabelId,
    pageInputId,
    previousId,
    nextId,
    getState,
    translate,
    escapeHtml,
    renderCards,
    getVisibleFilters,
    getCurrentCharacterSummary,
    getCharacterAvatar,
    getCharacterKey,
    getCharacterInitial,
    noteTypeClass,
    noteTypeLabel,
    renderQuotedText,
    getVariants,
    getVariantIndex,
    getActiveVariant,
    renderTagShelf = () => {},
}) {
    const c = suffix => `${classPrefix}-${suffix}`;

    function renderNoteTags(note, state) {
        const tags = Array.isArray(note?.tags) ? note.tags : [];
        if (!tags.length) return '';
        return `<div class="${c('note-tags')}">${tags.map(tag => `
            <button class="${c('tag-chip')} ${state.tagFilter === tag ? 'active' : ''}" type="button" data-tag="${escapeHtml(tag)}" title="${escapeHtml(translate('filterByTag', { tag }))}">
                <i class="fa-solid fa-tag"></i><span>${escapeHtml(tag)}</span>
            </button>
        `).join('')}</div>`;
    }

    function renderCharacterOverview(state) {
        const current = getCurrentCharacterSummary();
        const currentKey = getCharacterKey(current);
        const userCharacter = state.characters.find(character => character.isUser || character.id === 'tavern-notes-user');
        const rest = state.characters.filter(character => getCharacterKey(character) !== currentKey && character !== userCharacter);
        if (!state.characters.length && !current.name) {
            return `<div class="${c('empty')}"><div class="${c('empty-orb')}"><i class="fa-solid fa-user"></i></div><div class="${c('empty-title')}">${escapeHtml(translate('noCharacterNotes'))}</div><small>${escapeHtml(translate('noCharacterNotesHint'))}</small></div>`;
        }
        const card = (character, isCurrent = false) => {
            const avatar = getCharacterAvatar(character);
            return `<button class="${c('character-card')} ${isCurrent ? c('character-current') : ''}" type="button" data-character-id="${escapeHtml(character.id ?? '')}" data-character-name="${escapeHtml(character.name || '')}">
                <span class="${c('character-avatar')}">${avatar ? `<img src="${escapeHtml(avatar)}" alt="${escapeHtml(character.name || translate('characterName'))}" loading="lazy" />` : `<span>${escapeHtml(getCharacterInitial(character.name))}</span>`}</span>
                <span class="${c('character-info')}"><b>${escapeHtml(character.name || translate('unnamedCharacter'))}${isCurrent ? `<em>${escapeHtml(translate('currentCharacter'))}</em>` : ''}</b><small>${escapeHtml(character.total)} · ${escapeHtml(translate('userInput'))} ${escapeHtml(character.userInput)} · ${escapeHtml(translate('excerpt'))} ${escapeHtml(character.excerpt)}</small></span>
                <i class="fa-solid fa-chevron-right"></i>
            </button>`;
        };
        return `<section class="${c('character-overview')}">
            <div class="${c('section-title')}"><span>${escapeHtml(translate('currentCharacter'))}</span><small>${escapeHtml(translate('priority'))}</small></div>
            <div class="${c('character-featured')}">${userCharacter ? card(userCharacter) : ''}${getCharacterKey(userCharacter) !== currentKey ? card(current, true) : ''}</div>
            <div class="${c('section-title')}"><span>${escapeHtml(translate('browseByCharacter'))}</span><small>${escapeHtml(translate('characterCount', { count: state.characters.length }))}</small></div>
            ${rest.length ? `<div class="${c('character-grid')}">${rest.map(character => card(character)).join('')}</div>` : `<div class="${c('character-empty-line')}">${escapeHtml(translate('otherCharactersEmpty'))}</div>`}
        </section>`;
    }

    function renderCharacterScope(state) {
        if (!state.characterFilter) return '';
        const avatar = getCharacterAvatar(state.characterFilter);
        return `<section class="${c('character-scope')}">
            <span class="${c('character-avatar')}">${avatar ? `<img src="${escapeHtml(avatar)}" alt="${escapeHtml(state.characterFilter.name || translate('characterName'))}" loading="lazy" />` : `<span>${escapeHtml(getCharacterInitial(state.characterFilter.name))}</span>`}</span>
            <div><b>${escapeHtml(state.characterFilter.name || translate('unnamedCharacter'))}</b><small>${escapeHtml(translate('viewingCharacter'))}</small></div>
            <button class="${c('clear-character')}" type="button"><i class="fa-solid fa-arrow-left"></i><span>${escapeHtml(translate('backCharacters'))}</span></button>
        </section>`;
    }

    function renderArticles(state) {
        if (!state.notes.length) {
            return `<div class="${c('empty')}"><div class="${c('empty-orb')}"><i class="fa-regular fa-note-sticky"></i></div><div class="${c('empty-title')}">${escapeHtml(translate('noNotes'))}</div><small>${escapeHtml(translate('noNotesHint'))}</small></div>`;
        }
        return renderCards(state.notes, {
            classPrefix,
            escapeHtml,
            translate,
            noteTypeClass,
            noteTypeLabel,
            renderQuotedText,
            renderTags: note => renderNoteTags(note, state),
            getVariants,
            getVariantIndex,
            getActiveVariant,
        });
    }

    function renderFilterTabs(state) {
        const nav = rootDocument.querySelector(`.${c('filters')}`);
        if (!nav) return;
        nav.innerHTML = getVisibleFilters().map(filter => `<button class="${c('filter')} ${filter.id === state.filter ? 'active' : ''}" data-filter="${filter.id}">
            <span class="${c('filter-icon')}"><i class="fa-solid ${filter.icon}"></i></span>
            <span class="${c('filter-text')}"><b>${escapeHtml(translate(filter.label))}</b><small>${escapeHtml(translate(filter.hint))}</small></span>
            <span class="${c('filter-count')}"></span>
        </button>`).join('');
    }

    function updateCounts(state) {
        const scoped = state.characterFilter;
        const countMap = {
            all: scoped ? scoped.total : (state.counts.all ?? state.totalNotes),
            characters: state.characters.length,
            user_input: scoped ? scoped.userInput : (state.counts.user_input ?? 0),
            excerpt: scoped ? scoped.excerpt : (state.counts.excerpt ?? 0),
        };
        rootDocument.querySelectorAll(`.${c('filter-count')}`).forEach(element => {
            const key = element.closest(`.${c('filter')}`)?.dataset.filter;
            element.textContent = countMap[key] === '' ? '' : String(countMap[key] ?? '');
        });
    }

    function updateScope(state) {
        const panel = rootDocument.querySelector(`#${panelId}`);
        if (!panel) return;
        const avatar = getCharacterAvatar(state.characterFilter);
        panel.classList.toggle(c('character-scoped'), Boolean(state.characterFilter && avatar));
        if (!state.characterFilter || !avatar) panel.style.removeProperty(`--${classPrefix}-scope-avatar`);
        else panel.style.setProperty(`--${classPrefix}-scope-avatar`, `url("${avatar.replaceAll('"', '\\"')}")`);
    }

    function renderPagination(state, visible = true) {
        const pagination = rootDocument.querySelector(`.${c('pagination')}`);
        if (pagination) pagination.classList.toggle(c('hidden'), !visible);
        if (!visible) return;
        const maxPage = Math.max(1, Math.ceil(state.totalNotes / state.pageSize));
        const label = rootDocument.querySelector(`#${pageLabelId}`);
        const input = rootDocument.querySelector(`#${pageInputId}`);
        const previous = rootDocument.querySelector(`#${previousId}`);
        const next = rootDocument.querySelector(`#${nextId}`);
        if (label) label.textContent = `${state.page} / ${maxPage}`;
        if (input) {
            input.max = String(maxPage);
            input.value = String(state.page);
        }
        if (previous) previous.disabled = state.page <= 1;
        if (next) next.disabled = state.page >= maxPage;
    }

    return {
        render() {
            const state = getState();
            const list = rootDocument.querySelector(`#${listId}`);
            if (!list) return;
            renderFilterTabs(state);
            renderTagShelf();
            updateCounts(state);
            updateScope(state);
            const directory = state.filter === 'characters' && !state.characterFilter;
            list.innerHTML = directory ? renderCharacterOverview(state) : `${renderCharacterScope(state)}${renderArticles(state)}`;
            renderPagination(state, !directory);
        },
        renderPagination(visible = true) {
            renderPagination(getState(), visible);
        },
    };
}

export function createNoteActionHandler({
    classPrefix,
    getNotes,
    getCharacters,
    getVariants,
    getVariantIndex,
    getActiveVariant,
    setVariantIndex,
    render,
    setTag,
    setCharacter,
    clearCharacter,
    openDetail,
    copy,
    fill,
    share,
    edit,
    confirmDelete,
    deleteNote,
    onDeleted = () => {},
    toggleActionMenu,
    closeActionMenus,
}) {
    const c = suffix => `${classPrefix}-${suffix}`;
    const groupFrom = element => {
        const id = element?.closest(`.${c('note')}`)?.dataset.noteId;
        return getNotes().find(note => note.id === id);
    };

    return async function handleNoteAction(event) {
        const button = event.target.closest('button');
        const article = event.target.closest(`.${c('note')}`);
        if (!button) {
            const group = article ? groupFrom(article) : null;
            if (group) openDetail(getActiveVariant(group));
            return;
        }
        if (button.classList.contains(c('note-menu-toggle'))) {
            toggleActionMenu(article, classPrefix);
            return;
        }
        if (button.classList.contains(c('tag-chip'))) {
            setTag(button.dataset.tag || '');
            return;
        }
        if (button.classList.contains(c('character-card'))) {
            const id = button.dataset.characterId || null;
            const name = button.dataset.characterName || '未命名角色';
            const character = getCharacters().find(item => String(item.id ?? '') === String(id ?? '') && item.name === name)
                || getCharacters().find(item => item.name === name)
                || { id, name };
            setCharacter(character);
            return;
        }
        if (button.classList.contains(c('clear-character'))) {
            clearCharacter();
            return;
        }
        const group = groupFrom(button);
        if (!group) return;
        if (button.classList.contains(c('variant-prev')) || button.classList.contains(c('variant-next'))) {
            const variants = getVariants(group);
            const direction = button.classList.contains(c('variant-prev')) ? -1 : 1;
            setVariantIndex(group.id, Math.min(Math.max(getVariantIndex(group) + direction, 0), variants.length - 1));
            render();
            return;
        }
        const note = getActiveVariant(group);
        if (!note) return;
        closeActionMenus(article, classPrefix);
        if (button.classList.contains(c('copy'))) await copy(note);
        else if (button.classList.contains(c('fill'))) await fill(note);
        else if (button.classList.contains(c('share'))) share(note);
        else if (button.classList.contains(c('edit'))) edit(note);
        else if (button.classList.contains(c('delete'))) {
            if (!await confirmDelete(note)) return;
            const result = await deleteNote(note.id);
            if (result?.ok === false) throw result.error;
            onDeleted(note);
        }
    };
}
