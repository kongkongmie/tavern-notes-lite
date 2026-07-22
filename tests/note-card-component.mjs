import assert from 'node:assert/strict';
import { renderNoteCards } from '../core/note-card.js';

const notes = [{
    id: 'synthetic-card',
    type: 'user_input',
    content: 'Synthetic content '.repeat(20),
    createdAt: '2026-07-21T01:02:03.000Z',
    character: { name: 'Tester' },
    chat: { name: 'Synthetic Chat', messageId: 5 },
    tags: ['test'],
    repeatCount: 2,
}];
const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const html = renderNoteCards(notes, {
    classPrefix: 'tn',
    escapeHtml,
    translate: (key, values = {}) => key === 'repeatedTimes' ? `repeat-${values.count}` : key,
    noteTypeClass: () => 'user-input',
    noteTypeLabel: () => 'User',
    renderQuotedText: escapeHtml,
    renderTags: () => '<div class="tn-note-tags"></div>',
    getVariants: note => [note, { ...note, id: 'synthetic-card-variant' }],
    getVariantIndex: () => 0,
    getActiveVariant: note => note,
});

assert.match(html, /class="tn-note tn-note-user-input tn-note-has-variants"/);
assert.match(html, /class="tn-variant-side tn-variant-next"/);
assert.match(html, /tabindex="0"/);
assert.match(html, /class="tn-note-menu-toggle"/);
assert.match(html, /class="tn-note-quick-fill tn-fill"/);
assert.match(html, /aria-expanded="false"/);
assert.match(html, /class="tn-note-actions"/);
assert.doesNotMatch(html, /class="tn-note-fade"/);
assert.doesNotMatch(html, /class="tn-expand"/);
for (const action of ['fill', 'copy', 'share', 'edit', 'delete']) assert.match(html, new RegExp(`tn-${action}`));
assert.doesNotMatch(html, /class="menu_button tn-fill"/);
assert.doesNotMatch(html, />Synthetic Chat</);
assert.doesNotMatch(html, />#5</);
assert.match(html, /<span>×2<\/span>/);
console.log('Shared note-card component test passed.');
