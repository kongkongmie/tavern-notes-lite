import { parseHTML } from 'linkedom';
import { buildFloorExcludeSelector, extractFloorText, normalizeExcludedTagNames, stripExcludedTagsFromHtml } from '../floor-capture.js';

const selectors = ['content', '.content', '[data-tavern-notes-content]', '[data-note-content]', '.comment', '.mes_text'];
const excludeSelector = 'details,summary,pre,code,script,style,button,[role="button"]';
const longText = `真正正文开始。${'长正文内容。'.repeat(1400)}真正正文结束。`;

function messageElement(html) {
    const { document } = parseHTML(`<div id="message">${html}</div>`);
    return { document, element: document.querySelector('#message') };
}

// The real failure mode: a renderer keeps the content tag but replaces its
// body with a length summary. The raw SillyTavern message still has all text.
const collapsed = messageElement('<div class="mes_text"><content>正文（8000字+）</content></div>');
const recovered = extractFloorText({
    documentRef: collapsed.document,
    messageElement: collapsed.element,
    rawMessage: `:::newspaper 古风架空·春 :::\n\n<startTime>暮春</startTime>\n\n<content>${longText}</content>`,
    selectors,
    excludeSelector,
});

const rendered = messageElement('<div class="mes_text"><content>页面里的明确正文</content><span>摘要</span></div>');
const renderedResult = extractFloorText({
    documentRef: rendered.document,
    messageElement: rendered.element,
    rawMessage: '没有正文标签的原始消息',
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

const multiple = messageElement('<div class="mes_text"><content>页面摘要</content></div>');
const multipleResult = extractFloorText({
    documentRef: multiple.document,
    messageElement: multiple.element,
    rawMessage: '<content>第一段正文</content><aside>装饰内容</aside><content>第二段正文</content>',
    selectors,
    excludeSelector,
});

const excluded = messageElement('<div class="mes_text"><content>保留开头<thinking>删除秘密推理</thinking>保留结尾<status>删除状态</status></content></div>');
const excludedTags = normalizeExcludedTagNames('thinking, <status> thinking invalid.class');
const excludedResult = extractFloorText({
    documentRef: excluded.document,
    messageElement: excluded.element,
    rawMessage: '<content>保留开头<thinking>删除秘密推理</thinking>保留结尾<status>删除状态</status></content>',
    selectors,
    excludeSelector: buildFloorExcludeSelector(excludeSelector, excludedTags),
});
const strippedFallback = stripExcludedTagsFromHtml({
    documentRef: excluded.document,
    html: '保留<thinking>删除</thinking><status>也删除</status>结尾',
    excludedTagNames: excludedTags,
});

const checks = {
    rawContentRecovered: recovered === longText,
    collapsedSummaryExcluded: !recovered.includes('8000字+'),
    longContentIntact: recovered.length > 8000,
    renderedContentFallback: renderedResult === '页面里的明确正文',
    customTagSupported: customResult === '自定义标签正文',
    multipleContentTagsMerged: multipleResult === '第一段正文\n\n第二段正文',
    excludedTagsNormalized: excludedTags.join(',') === 'thinking,status',
    excludedTagBodiesRemoved: excludedResult === '保留开头保留结尾',
    fallbackAlsoExcludesTags: strippedFallback === '保留结尾',
};

console.log(JSON.stringify({ lengths: { expected: longText.length, recovered: recovered.length }, checks }, null, 2));
if (!Object.values(checks).every(Boolean)) process.exitCode = 1;
