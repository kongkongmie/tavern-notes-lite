import assert from 'node:assert/strict';
import { toFullThemeVariables, toLiteThemeVariables } from '../theme-compat.js';

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

const restored = toFullThemeVariables(converted);
assert.equal(restored['--tn-paper'], '#efefeb');
assert.equal(restored['--tn-note-bg'], 'linear-gradient(var(--tn-paper), var(--tn-paper-2))');
assert.equal(restored['--tn-ink'], '#171717');

console.log('Theme compatibility smoke test passed.');
