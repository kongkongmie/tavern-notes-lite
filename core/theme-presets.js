export function createAppleGlassSharedVariables(prefix = '--tn-') {
    const variable = name => `${prefix}${name}`;
    return {
        [variable('radius-panel')]: '26px',
        [variable('radius-card')]: '18px',
        [variable('font-family')]: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", sans-serif',
        [variable('text-shadow')]: 'transparent',
        [variable('mini-button-shadow')]: `0 0 0 1px var(${variable('line')}), 0 8px 24px var(${variable('shadow-dark')})`,
        [variable('mini-button-hover-shadow')]: `0 0 0 1px color-mix(in srgb, var(${variable('gold')}) 24%, var(${variable('line')})), 0 10px 28px var(${variable('shadow-dark')})`,
        [variable('filter-hover-shadow')]: `0 0 0 1px color-mix(in srgb, var(${variable('gold')}) 24%, var(${variable('line')})), 0 14px 34px var(${variable('shadow-dark')})`,
        [variable('filter-icon-shadow')]: `0 0 0 1px var(${variable('line')}), 0 8px 20px var(${variable('shadow-dark')})`,
        [variable('inline-action-bg')]: 'transparent',
        [variable('inline-action-shadow')]: 'none',
        [variable('inline-action-hover-shadow')]: 'none',
        [variable('inline-icon-shadow')]: `0 0 0 1px var(${variable('line')})`,
        [variable('note-bg')]: `var(${variable('card-image')}), var(${variable('card-bg')})`,
        [variable('note-shadow')]: `0 18px 46px var(${variable('shadow-dark')})`,
        [variable('note-topline-bg')]: 'transparent',
        [variable('note-topline-border')]: '0',
        [variable('note-topline-padding')]: '0',
        [variable('note-topline-radius')]: '0',
        [variable('filter-shadow')]: `0 12px 32px var(${variable('shadow-dark')})`,
        [variable('control-shadow')]: `0 10px 28px var(${variable('shadow-dark')}), inset 0 1px 0 rgba(255, 255, 255, 0.16)`,
    };
}

export function createBuiltInThemeRecords({
    defaultTheme,
    appleDayVariables,
    normalizeTheme,
    variablePrefix = '--tn-',
    appleThemeId = 'apple-glass',
    author = 'Tavern Notes',
}) {
    const defaultPreset = normalizeTheme({
        ...defaultTheme,
        id: 'default',
        name: 'Soft Neomorphism',
        author,
    });
    const applePreset = normalizeTheme({
        ...defaultTheme,
        id: appleThemeId,
        name: 'Apple Glass',
        author,
        variables: {
            ...defaultTheme.variables,
            ...createAppleGlassSharedVariables(variablePrefix),
            ...appleDayVariables,
            [`${variablePrefix}theme-flavor`]: 'apple',
        },
    });
    return [
        { id: 'default', name: defaultPreset.name, author, builtIn: true, theme: defaultPreset },
        { id: appleThemeId, name: applePreset.name, author, builtIn: true, theme: applePreset },
    ];
}

export function isRetiredLegacyTheme(record) {
    const retiredIds = new Set(['secret-files', 'archive']);
    const id = String(record?.id || record?.theme?.id || '').trim().toLowerCase();
    const name = String(record?.name || record?.theme?.name || '').trim();
    const variables = record?.theme?.variables || {};
    const flavor = String(variables['--tn-theme-flavor'] || variables['--tnl-theme-flavor'] || '').trim().toLowerCase();
    return retiredIds.has(id)
        || flavor === 'archive'
        || /secret\s*files?/i.test(name)
        || /秘密档案|秘密檔案/.test(name);
}
