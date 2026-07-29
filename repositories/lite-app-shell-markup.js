import { renderAppShellMarkup } from '../features/app-shell-markup.js';

export function renderLiteAppShellMarkup(options) {
    return renderAppShellMarkup({
        ...options,
        idPrefix: 'tavern-notes-lite',
        classPrefix: 'tnl',
        brandIconMarkup: options.brandIconMarkup,
        capabilities: {
            storageMode: false,
            compatibilityInfo: true,
        },
        cleanupScanLabelKey: 'clearHistoryDuplicates',
    });
}
