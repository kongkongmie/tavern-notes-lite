export function createApplicationCapabilities(overrides = {}) {
    return Object.freeze({
        coexistenceGuard: false,
        quickReplyToolbar: true,
        floatingLauncher: true,
        ...overrides,
    });
}
