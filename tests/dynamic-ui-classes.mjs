import assert from 'node:assert/strict';
import { createTagView } from '../features/tag-view.js';
import { createCaptureView } from '../features/capture-view.js';

function renderTagShelf(prefix) {
    const shelf = { classList: { remove() {} }, innerHTML: '' };
    const root = { querySelector: selector => selector === '#shelf' ? shelf : null };
    const view = createTagView({
        root,
        selectors: { prefix, shelf: '#shelf', library: '#library', list: '#list', search: '#search' },
        getState: () => ({ tags: [{ name: 'A', count: 1 }], activeTag: '', recentTags: [], query: '', sort: 'count' }),
        translate: key => key,
        escapeHtml: String,
        normalizeKey: value => String(value).toLowerCase(),
        onSelect() {},
        onRename() {},
        onDelete() {},
    });
    view.renderShelf();
    return shelf.innerHTML;
}

assert.match(renderTagShelf('tn'), /class="tn-tag-filter tn-tag-library-open"/);
assert.doesNotMatch(renderTagShelf('tn'), /tnl-tag-filter/);
assert.match(renderTagShelf('tnl'), /class="tn-tag-filter tnl-tag-filter tnl-tag-library-open"/);

function renderFloorButton(prefix) {
    let appended = null;
    const message = {
        querySelector: () => null,
        append: button => { appended = button; },
    };
    const documentRef = {
        addEventListener() {},
        createElement: () => ({
            addEventListener() {},
            innerHTML: '',
            className: '',
            title: '',
            type: '',
        }),
        querySelector: () => null,
        querySelectorAll: () => [],
    };
    const view = createCaptureView({
        documentRef,
        windowRef: { addEventListener() {} },
        classPrefix: prefix,
        selectors: {
            selectionButton: '#selection',
            selectionClass: `${prefix}-selection`,
            floorButton: '.tn-floor-capture',
            messages: '.mes',
        },
        translate: key => key,
        escapeHtml: String,
        isSelectionEnabled: () => false,
        isFloorEnabled: () => true,
        getSelectionSnapshot: () => null,
        onSelectionCapture() {},
        onFloorCapture() {},
    });
    view.mount();
    view.refreshFloorButtons({ querySelectorAll: () => [message] });
    return appended?.className;
}

assert.equal(renderFloorButton('tn'), 'tn-floor-capture');
assert.equal(renderFloorButton('tnl'), 'tn-floor-capture tnl-floor-capture');

console.log('Shared dynamic UI classes test passed.');
