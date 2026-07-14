export function toLiteThemeVariables(variables = {}) {
    if (!variables || typeof variables !== 'object' || Array.isArray(variables)) return {};

    return Object.fromEntries(Object.entries(variables).flatMap(([key, value]) => {
        let liteKey = '';
        if (key.startsWith('--tnl-')) liteKey = key;
        else if (key.startsWith('--tn-')) liteKey = key.replace(/^--tn-/, '--tnl-');
        else return [];

        const liteValue = typeof value === 'string'
            ? value.replace(/--tn-(?!l-)/g, '--tnl-')
            : value;
        return [[liteKey, liteValue]];
    }));
}
