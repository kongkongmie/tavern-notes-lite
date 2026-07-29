import assert from 'node:assert/strict';
import { uiClass } from '../core/ui-class-names.js';

assert.equal(uiClass('header', { classPrefix: 'tn' }), 'tn-header');
assert.equal(uiClass('header', { classPrefix: 'tnl' }), 'tn-header tnl-header');
assert.equal(uiClass('header', { classPrefix: 'tn', keepLegacyClass: false }), 'tn-header');
assert.throws(() => uiClass('', { classPrefix: 'tn' }), /non-empty/);
assert.throws(() => uiClass('header', { classPrefix: '' }), /non-empty/);
for (const value of [
    uiClass('header', { classPrefix: 'tn' }),
    uiClass('header', { classPrefix: 'tnl' }),
]) {
    const tokens = value.split(/\s+/);
    assert.equal(tokens.length, new Set(tokens).size);
}

console.log('Shared UI class names test passed.');
