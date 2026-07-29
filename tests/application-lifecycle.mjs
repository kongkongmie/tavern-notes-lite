import assert from 'node:assert/strict';
import { createLifecycleRegistry } from '../services/lifecycle-registry.js';
import { createApplication } from '../services/application.js';
import { bootstrapApplication } from '../services/application-bootstrap.js';
import { createObserverController } from '../features/observer-controller.js';
import { createCoexistenceController } from '../features/coexistence-controller.js';
import { createQuickReplyController } from '../features/quick-reply-controller.js';

{
    const calls = [];
    const registry = createLifecycleRegistry({ clearTimeoutFn: id => calls.push(`timeout:${id}`), clearIntervalFn: id => calls.push(`interval:${id}`) });
    registry.registerDestroy(() => calls.push('first'));
    registry.registerObserver({ disconnect: () => calls.push('observer') });
    registry.registerTimeout(1);
    registry.registerInterval(2);
    registry.registerUnsubscribe(() => calls.push('unsubscribe'));
    registry.registerDestroy(() => { calls.push('throws'); throw new Error('expected'); });
    registry.destroyAll();
    registry.destroyAll();
    assert.deepEqual(calls, ['throws', 'unsubscribe', 'interval:2', 'timeout:1', 'observer', 'first']);
}

{
    const calls = [];
    const application = createApplication({
        shell: { mount: () => calls.push('shell+'), destroy: () => calls.push('shell-') },
        modules: [
            { mount: () => calls.push('a+'), destroy: () => calls.push('a-') },
            { mount: () => calls.push('b+'), destroy: () => calls.push('b-') },
        ],
    });
    await Promise.all([application.start(), application.start()]);
    assert.equal(application.getStatus().phase, 'running');
    await application.destroy();
    await application.destroy();
    assert.deepEqual(calls, ['shell+', 'a+', 'b+', 'b-', 'a-', 'shell-']);
}

{
    const calls = [];
    const application = createApplication({
        modules: [
            { mount: () => calls.push('a+'), destroy: () => calls.push('a-') },
            { mount: () => { throw new Error('mount failed'); } },
        ],
    });
    await application.start();
    assert.equal(application.getStatus().phase, 'idle');
    assert.deepEqual(calls, ['a+', 'a-']);
}

{
    let release;
    const application = createApplication({
        modules: [{ mount: () => new Promise(resolve => { release = resolve; }), destroy() {} }],
    });
    const starting = application.start();
    await Promise.resolve();
    await application.destroy();
    release();
    await starting;
    assert.equal(application.getStatus().phase, 'destroyed');
}

{
    let callback;
    let disconnected = 0;
    let refreshed = 0;
    const queued = [];
    const observer = createObserverController({
        createObserver: next => ({ observe() { callback = next; }, disconnect() { disconnected += 1; } }),
        getTarget: () => ({}),
        onRefresh: () => { refreshed += 1; },
        schedule: next => queued.push(next),
    });
    observer.mount();
    observer.mount();
    callback(); callback();
    assert.equal(queued.length, 1);
    queued.shift()();
    assert.equal(refreshed, 1);
    observer.destroy();
    callback();
    queued.shift()?.();
    assert.equal(refreshed, 1);
    assert.equal(disconnected, 1);
}

{
    let full = false;
    let pauses = 0;
    let removed = 0;
    let trigger;
    const coexistence = createCoexistenceController({
        isFullActive: () => full,
        application: { pause: () => { pauses += 1; } },
        removeLiteUi: () => { removed += 1; },
        createObserver: callback => ({ observe() { trigger = callback; }, disconnect() {} }),
        getTarget: () => ({}),
    });
    coexistence.mount();
    full = true;
    trigger();
    trigger();
    assert.equal(pauses, 1);
    assert.equal(removed, 1);
    coexistence.destroy();
}

{
    let mode = 'toolbar';
    let toolbarCount = 0;
    let floatingCount = 0;
    let destroyed = 0;
    let observerMounts = 0;
    const controller = createQuickReplyController({
        view: {
            mount() {},
            ensureToolbarButton() { toolbarCount += 1; },
            ensureFloatingButton() { floatingCount += 1; },
            destroy() { destroyed += 1; },
        },
        getMode: () => mode,
        saveSettings: async patch => { mode = patch.launcherMode ?? mode; return { ok: true }; },
        findToolbar: () => ({}),
        createObserverController: refresh => ({ mount() { observerMounts += 1; refresh(); }, destroy() {} }),
        capabilities: {},
    });
    controller.mount();
    controller.mount();
    await controller.toggle();
    controller.destroy();
    assert.equal(observerMounts, 1);
    assert.ok(toolbarCount >= 1);
    assert.equal(floatingCount, 1);
    assert.equal(destroyed, 1);
}

{
    let ready;
    let unload;
    let starts = 0;
    let destroys = 0;
    const events = {
        onAppReady(handler) { ready = handler; return () => {}; },
        onUnload(handler) { unload = handler; return () => {}; },
        destroy() {},
    };
    const bootstrap = bootstrapApplication({
        events,
        createApplication: async () => ({ start: async () => { starts += 1; }, destroy: async () => { destroys += 1; } }),
    });
    await Promise.all([ready(), ready()]);
    assert.equal(starts, 1);
    await unload();
    await bootstrap.destroy();
    assert.equal(destroys, 1);
}

console.log('application lifecycle tests passed');
