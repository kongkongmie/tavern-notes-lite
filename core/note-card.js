export function renderNoteCards(notes, options) {
    const {
        classPrefix,
        escapeHtml,
        translate,
        noteTypeClass,
        noteTypeLabel,
        renderQuotedText,
        renderTags,
        getVariants,
        getVariantIndex,
        getActiveVariant,
    } = options;
    const c = name => `${classPrefix}-${name}`;

    return notes.map(note => {
        const activeNote = getActiveVariant(note);
        const variants = getVariants(note);
        const variantIndex = getVariantIndex(note);
        const created = activeNote.createdAt ? new Date(activeNote.createdAt).toLocaleString() : '';
        const chatName = activeNote.chat?.name || note.chat?.name || '';
        const variantControls = variants.length <= 1 ? '' : `
            <button class="${c('variant-side')} ${c('variant-prev')}" type="button" ${variantIndex <= 0 ? 'disabled' : ''} title="${escapeHtml(translate('prevPage'))}">
                <i class="fa-solid fa-chevron-left"></i>
            </button>
            <button class="${c('variant-side')} ${c('variant-next')}" type="button" ${variantIndex >= variants.length - 1 ? 'disabled' : ''} title="${escapeHtml(translate('nextPage'))}">
                <i class="fa-solid fa-chevron-right"></i>
            </button>
            <span class="${c('variant-count')}">${variantIndex + 1}/${variants.length}</span>
        `;

        return `
            <article class="${c('note')} ${c(`note-${escapeHtml(noteTypeClass(note.type))}`)}${variants.length > 1 ? ` ${c('note-has-variants')}` : ''}" data-note-id="${escapeHtml(note.id)}" data-chat-name="${escapeHtml(chatName)}" tabindex="0" aria-label="${escapeHtml(translate('viewFull'))}">
                ${variantControls}
                <div class="${c('note-topline')}">
                    <span class="${c('note-type')}">${escapeHtml(noteTypeLabel(note.type))}</span>
                    ${Number(activeNote.repeatCount || 1) > 1 ? `<span class="${c('repeat-badge')}" title="${escapeHtml(translate('repeatedTimes', { count: activeNote.repeatCount }))}"><i class="fa-solid fa-repeat"></i><span>×${escapeHtml(activeNote.repeatCount)}</span></span>` : ''}
                    <span class="${c('note-character')}">${escapeHtml(note.character?.name || translate('unnamedCharacter'))}</span>
                    <span class="${c('note-time')}">${escapeHtml(created)}</span>
                </div>
                <div class="${c('note-body')}">
                    <div class="${c('note-content')}">${renderQuotedText(activeNote.content)}</div>
                </div>
                ${renderTags(activeNote)}
                <div class="${c('note-side-actions')}">
                    <button class="${c('note-quick-fill')} ${c('fill')}" type="button" title="${escapeHtml(translate('fillInput'))}" aria-label="${escapeHtml(translate('fillInput'))}">
                        <i class="fa-solid fa-arrow-turn-down"></i>
                    </button>
                    <button class="${c('note-menu-toggle')}" type="button" title="${escapeHtml(translate('more'))}" aria-label="${escapeHtml(translate('more'))}" aria-expanded="false">
                        <i class="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                </div>
                <div class="${c('note-actions')}" aria-hidden="true">
                    <button class="menu_button ${c('copy')}" title="${escapeHtml(translate('copy'))}"><i class="fa-regular fa-copy"></i><span>${escapeHtml(translate('copy'))}</span></button>
                    <button class="menu_button ${c('share')}" title="${escapeHtml(translate('share'))}"><i class="fa-solid fa-share-nodes"></i><span>${escapeHtml(translate('share'))}</span></button>
                    <button class="menu_button ${c('edit')}" title="${escapeHtml(translate('editNote'))}"><i class="fa-solid fa-pen"></i><span>${escapeHtml(translate('edit'))}</span></button>
                    <button class="menu_button ${c('delete')}" title="${escapeHtml(translate('delete'))}"><i class="fa-regular fa-trash-can"></i><span>${escapeHtml(translate('delete'))}</span></button>
                </div>
            </article>
        `;
    }).join('');
}
export function closeNoteActionMenus(root, classPrefix) {
    root?.querySelectorAll(`.${classPrefix}-note-actions.open`).forEach(menu => {
        menu.classList.remove('open');
        menu.setAttribute('aria-hidden', 'true');
        menu.closest(`.${classPrefix}-note`)
            ?.querySelector(`.${classPrefix}-note-menu-toggle`)
            ?.setAttribute('aria-expanded', 'false');
    });
}

export function toggleNoteActionMenu(article, classPrefix) {
    const actions = article?.querySelector(`.${classPrefix}-note-actions`);
    if (!actions) return false;
    const willOpen = !actions.classList.contains('open');
    closeNoteActionMenus(article.closest(`#tavern-notes-panel, #tavern-notes-lite-panel`) || document, classPrefix);
    actions.classList.toggle('open', willOpen);
    actions.setAttribute('aria-hidden', String(!willOpen));
    article.querySelector(`.${classPrefix}-note-menu-toggle`)?.setAttribute('aria-expanded', String(willOpen));
    return willOpen;
}
