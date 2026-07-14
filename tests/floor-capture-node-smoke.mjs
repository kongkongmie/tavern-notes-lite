import { parseHTML } from 'linkedom';
import { extractFloorText } from '../floor-capture.js';

const selectors = ['content', '.content', '[data-tavern-notes-content]', '[data-note-content]', '.comment', '.mes_text'];
const excludeSelector = 'details,summary,pre,code,script,style,button,[role="button"]';
const longText = `真正正文开始。${'长正文内容。'.repeat(1400)}真正正文结束。`;

function messageElement(html) {
    const { document } = parseHTML(`<div id="message">${html}</div>`);
    return { document, element: document.querySelector('#message') };
}

const collapsed = messageElement('<div class="mes_text"><span>正文（8000+字）</span></div>');
const recovered = extractFloorText({
    documentRef: collapsed.document,
    messageElement: collapsed.element,
    rawMessage: `<details><summary>正文（8000+字）</summary><content>${longText}</content></details>`,
    selectors,
    excludeSelector,
});

const rendered = messageElement('<div class="mes_text"><content>页面里的明确正文</content><span>摘要</span></div>');
const renderedResult = extractFloorText({
    documentRef: rendered.document,
    messageElement: rendered.element,
    rawMessage: '<content>原始消息里的旧正文</content>',
    selectors,
    excludeSelector,
});

const custom = messageElement('<div class="mes_text"><span>story summary</span></div>');
const customResult = extractFloorText({
    documentRef: custom.document,
    messageElement: custom.element,
    rawMessage: '<story>自定义标签正文</story>',
    selectors: ['story', '.story', '.mes_text'],
    excludeSelector,
});

const checks = {
    rawContentRecovered: recovered === longText,
    summaryExcluded: !recovered.includes('8000+字'),
    longContentIntact: recovered.length > 8000,
    renderedContentPreferred: renderedResult === '页面里的明确正文',
    customTagSupported: customResult === '自定义标签正文',
};

console.log(JSON.stringify({ lengths: { expected: longText.length, recovered: recovered.length }, checks }, null, 2));
if (!Object.values(checks).every(Boolean)) process.exitCode = 1;
