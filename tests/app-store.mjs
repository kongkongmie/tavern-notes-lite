import assert from 'node:assert/strict';
import { createAppStore } from '../core/app-store.js';

const store = createAppStore({
    app: { ready: false },
    settings: { language: 'auto' },
    theme: { activeId: 'default', nested: { value: 1 } },
    ui: {},
});

assert.equal(store.getSlice('settings').language, 'auto');
store.patch('settings', { language: 'en' });
assert.equal(store.getState().settings.language, 'en');
store.replace('ui', { open: true });
assert.deepEqual(store.getSlice('ui'), { open: true });

const exposed = store.getSlice('theme');
exposed.activeId = 'mutated';
exposed.nested.value = 99;
assert.equal(store.getSlice('theme').activeId, 'default');
assert.equal(store.getSlice('theme').nested.value, 1);

let notifications = 0;
let lastSelection = null;
store.subscribe(state => state.theme, value => {
    notifications += 1;
    lastSelection = value;
});
store.patch('settings', { language: 'ko' });
assert.equal(notifications, 0, 'unrelated slice changes do not notify');
store.patch('theme', { activeId: 'default' });
assert.equal(notifications, 0, 'same-value patch does not notify');
store.patch('theme', { activeId: 'apple-glass' });
assert.equal(notifications, 1);
lastSelection.activeId = 'listener-mutation';
assert.equal(store.getSlice('theme').activeId, 'apple-glass');

store.batch(() => {
    store.patch('theme', { activeId: 'one' });
    store.patch('theme', { activeId: 'two' });
    store.patch('theme', { activeId: 'three' });
});
assert.equal(notifications, 2, 'batch emits once');
assert.equal(lastSelection.activeId, 'three');

store.destroy();
store.patch('theme', { activeId: 'after-destroy' });
assert.equal(notifications, 2, 'destroy disables subscriptions');
console.log('app store: ok');
