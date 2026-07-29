export function createNoteDetailView({
    root,
    classPrefix = 'tn',
    escapeHtml,
    renderContent,
    onAction = () => {},
    onClose = () => {},
}) {
    let mounted = false;
    let modal = null;

    function handleClick(event) {
        if (event.target === modal || event.target.closest?.(`.${classPrefix}-modal-close`)) {
            onClose();
            return;
        }
        const button = event.target.closest?.('[data-modal-action]');
        if (button) onAction(button.dataset.modalAction || '');
    }

    return {
        mount() {
            if (mounted) return;
            modal = root();
            if (!modal) return;
            modal.addEventListener('click', handleClick);
            mounted = true;
        },
        open(model) {
            if (!mounted || !model) return;
            modal.querySelector(`.${classPrefix}-modal-kicker`).textContent = model.kicker;
            modal.querySelector(`.${classPrefix}-modal-title`).textContent = model.title;
            modal.querySelector(`.${classPrefix}-modal-content`).innerHTML = renderContent(model);
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
        },
        close() {
            modal?.classList.remove('open');
            modal?.setAttribute('aria-hidden', 'true');
        },
        destroy() {
            if (mounted) modal?.removeEventListener('click', handleClick);
            this.close();
            mounted = false;
            modal = null;
        },
    };
}

export function renderNoteDetailContent(model, { escapeHtml, renderText, classPrefix = 'tn' }) {
    return `
        <div class="${classPrefix}-modal-note-text">${renderText(model.content)}</div>
        <div class="${classPrefix}-modal-note-meta">
            ${model.chatName ? `<span>${escapeHtml(model.chatName)}</span>` : ''}
            <span>#${escapeHtml(model.messageId)}</span>
            ${model.tags.map(tag => `<span>#${escapeHtml(tag)}</span>`).join('')}
        </div>
    `;
}
