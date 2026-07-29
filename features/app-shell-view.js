export function insertAppShellMarkup(documentRef, markup) {
    documentRef.body.insertAdjacentHTML('beforeend', markup);
}

export function ensureAppMenuEntry({ documentRef, menuSelector, id, className, title, iconMarkup, label, onOpen }) {
    const existing = documentRef.getElementById(id);
    if (existing) return existing;
    const menu = documentRef.querySelector(menuSelector);
    if (!menu) return null;
    const entry = documentRef.createElement('div');
    entry.id = id;
    entry.className = className;
    entry.title = title;
    entry.tabIndex = 0;
    entry.innerHTML = `${iconMarkup}<span>${label}</span>`;
    entry.addEventListener('click', onOpen);
    entry.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') onOpen();
    });
    menu.append(entry);
    return entry;
}

export function createAppShellView({ mountShell, getRoot, openShell, closeShell, removeShell, getContainers = () => ({}) } = {}) {
    let mounted = false;
    return {
        mount() { if (!mounted) { mountShell?.(); mounted = true; } return getRoot?.(); },
        getContainers,
        open: () => openShell?.(),
        close: () => closeShell?.(),
        isOpen: () => Boolean(getRoot?.()?.classList?.contains('open')),
        destroy() { if (!mounted) return; mounted = false; removeShell?.(); },
    };
}
