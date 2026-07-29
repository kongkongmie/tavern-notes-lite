function isPlainObject(value) {
    if (!value || typeof value !== 'object') return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function cloneValue(value, seen = new WeakMap()) {
    if (value === null || typeof value !== 'object') return value;
    if (seen.has(value)) return seen.get(value);
    if (value instanceof Date) return new Date(value.getTime());
    if (Array.isArray(value)) {
        const clone = [];
        seen.set(value, clone);
        value.forEach(item => clone.push(cloneValue(item, seen)));
        return clone;
    }
    if (value instanceof Map) {
        const clone = new Map();
        seen.set(value, clone);
        value.forEach((item, key) => clone.set(cloneValue(key, seen), cloneValue(item, seen)));
        return clone;
    }
    if (value instanceof Set) {
        const clone = new Set();
        seen.set(value, clone);
        value.forEach(item => clone.add(cloneValue(item, seen)));
        return clone;
    }
    if (!isPlainObject(value)) return value;
    const clone = {};
    seen.set(value, clone);
    for (const [key, item] of Object.entries(value)) clone[key] = cloneValue(item, seen);
    return clone;
}

function valuesEqual(left, right, seen = new WeakMap()) {
    if (Object.is(left, right)) return true;
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
    if (Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)) return false;
    if (seen.get(left) === right) return true;
    seen.set(left, right);
    if (Array.isArray(left)) {
        return left.length === right.length && left.every((item, index) => valuesEqual(item, right[index], seen));
    }
    if (left instanceof Date) return left.getTime() === right.getTime();
    if (left instanceof Map) {
        if (left.size !== right.size) return false;
        for (const [key, value] of left) {
            if (!right.has(key) || !valuesEqual(value, right.get(key), seen)) return false;
        }
        return true;
    }
    if (left instanceof Set) {
        if (left.size !== right.size) return false;
        for (const value of left) if (!right.has(value)) return false;
        return true;
    }
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return leftKeys.length === rightKeys.length
        && leftKeys.every(key => Object.prototype.hasOwnProperty.call(right, key)
            && valuesEqual(left[key], right[key], seen));
}

export function createAppStore(initialState = {}) {
    let state = cloneValue({
        app: {},
        settings: {},
        theme: {},
        ui: {},
        ...initialState,
    });
    let destroyed = false;
    let batchDepth = 0;
    let batchChanged = false;
    const subscriptions = new Set();

    function snapshot() {
        return cloneValue(state);
    }

    function notifySubscribers() {
        if (destroyed) return;
        const currentState = snapshot();
        for (const subscription of [...subscriptions]) {
            const selected = cloneValue(subscription.selector(currentState));
            if (valuesEqual(selected, subscription.value)) continue;
            const previous = cloneValue(subscription.value);
            subscription.value = cloneValue(selected);
            subscription.listener(cloneValue(selected), previous);
        }
    }

    function changed() {
        if (batchDepth > 0) {
            batchChanged = true;
            return;
        }
        notifySubscribers();
    }

    function getState() {
        return snapshot();
    }

    function getSlice(sliceName) {
        return cloneValue(state[sliceName]);
    }

    function replace(sliceName, value) {
        if (destroyed) return getSlice(sliceName);
        const next = cloneValue(value);
        if (valuesEqual(state[sliceName], next)) return getSlice(sliceName);
        state = { ...state, [sliceName]: next };
        changed();
        return getSlice(sliceName);
    }

    function patch(sliceName, patchValue) {
        if (destroyed) return getSlice(sliceName);
        if (!isPlainObject(patchValue)) throw new TypeError('Store patch must be a plain object.');
        const current = isPlainObject(state[sliceName]) ? state[sliceName] : {};
        return replace(sliceName, { ...current, ...cloneValue(patchValue) });
    }

    function subscribe(selector, listener) {
        if (destroyed) return () => {};
        if (typeof selector !== 'function' || typeof listener !== 'function') {
            throw new TypeError('Store subscribe requires selector and listener functions.');
        }
        const subscription = {
            selector,
            listener,
            value: cloneValue(selector(snapshot())),
        };
        subscriptions.add(subscription);
        return () => subscriptions.delete(subscription);
    }

    function batch(callback) {
        if (destroyed) return undefined;
        batchDepth += 1;
        try {
            return callback();
        } finally {
            batchDepth -= 1;
            if (batchDepth === 0 && batchChanged) {
                batchChanged = false;
                notifySubscribers();
            }
        }
    }

    function destroy() {
        subscriptions.clear();
        destroyed = true;
        batchChanged = false;
        batchDepth = 0;
    }

    return {
        getState,
        getSlice,
        patch,
        replace,
        subscribe,
        batch,
        destroy,
    };
}
