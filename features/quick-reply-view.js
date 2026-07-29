export function createQuickReplyView({ documentRef = document, windowRef = window, selectors, classes, renderIcon, translate, onPositionChange = async () => {} } = {}) {
    let actions = {};
    let visible = true;
    let dragMoved = false;
    const find = selector => documentRef.querySelector(selector);
    const remove = () => [selectors.open, selectors.capture, selectors.floating].forEach(selector => find(selector)?.remove());
    const position = launcher => {
        const saved = actions.getPosition?.();
        if (!launcher || !saved) return;
        const x = Math.min(Math.max(8, Number(saved.x || 8)), Math.max(8, windowRef.innerWidth - launcher.offsetWidth - 8));
        const y = Math.min(Math.max(8, Number(saved.y || 8)), Math.max(8, windowRef.innerHeight - launcher.offsetHeight - 8));
        Object.assign(launcher.style, { left: `${x}px`, top: `${y}px`, right: 'auto', bottom: 'auto', transform: 'none' });
    };
    const bindDrag = launcher => {
        if (launcher.dataset.dragBound) return;
        launcher.dataset.dragBound = 'true';
        launcher.addEventListener('pointerdown', event => {
            if (event.button !== undefined && event.button !== 0) return;
            const rect = launcher.getBoundingClientRect();
            const startX = event.clientX; const startY = event.clientY;
            dragMoved = false;
            const move = moveEvent => {
                if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 5) dragMoved = true;
                if (!dragMoved) return;
                Object.assign(launcher.style, {
                    left: `${Math.min(Math.max(8, moveEvent.clientX - (startX - rect.left)), windowRef.innerWidth - launcher.offsetWidth - 8)}px`,
                    top: `${Math.min(Math.max(8, moveEvent.clientY - (startY - rect.top)), windowRef.innerHeight - launcher.offsetHeight - 8)}px`,
                    right: 'auto', bottom: 'auto', transform: 'none',
                });
                moveEvent.preventDefault();
            };
            const up = async upEvent => {
                windowRef.removeEventListener('pointermove', move);
                windowRef.removeEventListener('pointerup', up);
                windowRef.removeEventListener('pointercancel', up);
                if (!dragMoved) return;
                const current = launcher.getBoundingClientRect();
                await onPositionChange({ x: current.left + current.width / 2 < windowRef.innerWidth / 2 ? 8 : windowRef.innerWidth - current.width - 8, y: current.top });
                setTimeout(() => { dragMoved = false; }, 0);
                upEvent.preventDefault();
            };
            windowRef.addEventListener('pointermove', move, { passive: false });
            windowRef.addEventListener('pointerup', up, { passive: false });
            windowRef.addEventListener('pointercancel', up, { passive: false });
        });
    };
    return {
        mount(nextActions = {}) { actions = nextActions; },
        updateModeButton(mode) {
            const button = find(selectors.modeButton);
            if (!button) return;
            const floating = mode === 'floating';
            button.classList.toggle('active', floating);
            button.title = translate('switchLauncherMode');
            button.setAttribute('aria-label', translate('switchLauncherMode'));
            const label = button.querySelector('span');
            if (label) label.textContent = translate(floating ? 'floatingBall' : 'toolbarButtons');
        },
        ensureToolbarButton(container) {
            if (!visible || !container) return;
            find(selectors.floating)?.remove();
            if (find(selectors.open) && find(selectors.capture)) return;
            find(selectors.open)?.remove(); find(selectors.capture)?.remove();
            const open = documentRef.createElement('div');
            open.id = selectors.open.slice(1); open.className = classes.toolbar; open.title = translate('openNotes'); open.tabIndex = 0;
            open.innerHTML = `${renderIcon('open', 'qr--button-icon')}<span class="qr--hidden">${translate('appName')}</span>`;
            const capture = documentRef.createElement('div');
            capture.id = selectors.capture.slice(1); capture.className = classes.toolbar; capture.title = translate('captureSelectedTitle'); capture.tabIndex = 0;
            capture.innerHTML = `${renderIcon('capture', 'qr--button-icon')}<span class="qr--hidden">${translate('captureSelected')}</span>`;
            open.addEventListener('click', () => actions.open?.());
            capture.addEventListener('click', () => actions.capture?.());
            open.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') actions.open?.();
            });
            capture.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') actions.capture?.();
            });
            container.append(open, capture);
            actions.iconsChanged?.();
        },
        ensureFloatingButton(container = documentRef.body) {
            if (!visible) return;
            find(selectors.open)?.remove(); find(selectors.capture)?.remove();
            let launcher = find(selectors.floating);
            if (!launcher) {
                launcher = documentRef.createElement('div');
                launcher.id = selectors.floating.slice(1);
                launcher.innerHTML = `<button id="${selectors.floatingOpen.slice(1)}" class="${classes.floating} ${classes.floatingMain}" type="button" title="${translate('openNotes')}" aria-label="${translate('openNotes')}">${renderIcon('open')}</button><button id="${selectors.floatingCapture.slice(1)}" class="${classes.floating} ${classes.floatingCapture}" type="button" title="${translate('captureSelectedTitle')}" aria-label="${translate('captureSelectedTitle')}">${renderIcon('capture')}</button>`;
                container.append(launcher);
                launcher.querySelector(selectors.floatingOpen)?.addEventListener('click', () => { if (!dragMoved) actions.open?.(); });
                launcher.querySelector(selectors.floatingCapture)?.addEventListener('click', () => { if (!dragMoved) actions.capture?.(); });
                bindDrag(launcher);
            }
            requestAnimationFrame(() => position(launcher));
            actions.iconsChanged?.();
        },
        resetPosition() {
            const launcher = find(selectors.floating);
            ['left', 'top', 'right', 'bottom', 'transform'].forEach(name => launcher?.style.removeProperty(name));
        },
        setVisible(value) { visible = Boolean(value); if (!visible) remove(); },
        remove,
        destroy() { visible = false; actions = {}; remove(); },
    };
}
