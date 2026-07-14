import assert from 'node:assert/strict';
import { toLiteThemeVariables } from '../theme-compat.js';

const converted = toLiteThemeVariables({
    '--tn-paper': '#efefeb',
    '--tn-theme-flavor': 'archive',
    '--tn-note-bg': 'linear-gradient(var(--tn-paper), var(--tn-paper-2))',
    '--tnl-ink': '#171717',
    '--unrelated': 'ignored',
});

assert.equal(converted['--tnl-paper'], '#efefeb');
assert.equal(converted['--tnl-theme-flavor'], 'archive');
assert.equal(converted['--tnl-note-bg'], 'linear-gradient(var(--tnl-paper), var(--tnl-paper-2))');
assert.equal(converted['--tnl-ink'], '#171717');
assert.equal(converted['--unrelated'], undefined);

console.log('Theme compatibility smoke test passed.');
