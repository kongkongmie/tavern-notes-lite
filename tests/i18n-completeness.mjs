import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const baseBlock = source.slice(source.indexOf('const TEXT_ZH_CN = {'), source.indexOf('const TEXTS = {'));
const localizedBlock = source.slice(source.indexOf('const TEXTS = {'), source.indexOf('\nfunction normalizeLanguage'));
const keys = block => new Set([...block.matchAll(/\b([A-Za-z][\w]*):\s*['`]/g)].map(match => match[1]));
const baseKeys = keys(baseBlock);
const languageBlocks = {
    'zh-TW': localizedBlock.slice(localizedBlock.indexOf("'zh-TW': {"), localizedBlock.indexOf('\n    en: {')),
    en: localizedBlock.slice(localizedBlock.indexOf('\n    en: {'), localizedBlock.indexOf('\n    ko: {')),
    ko: localizedBlock.slice(localizedBlock.indexOf('\n    ko: {')),
};

for (const [language, block] of Object.entries(languageBlocks)) {
    const translatedKeys = keys(block);
    const missing = [...baseKeys].filter(key => !translatedKeys.has(key));
    assert.deepEqual(missing, [], `${language} is missing translations: ${missing.join(', ')}`);
    for (const buttonKey of ['newNote', 'captureSelected', 'captureFloor', 'theme', 'more', 'fillInput', 'copy', 'share', 'edit', 'delete']) {
        assert.ok(translatedKeys.has(buttonKey), `${language} is missing button translation: ${buttonKey}`);
    }
}

console.log(JSON.stringify({ languages: Object.keys(languageBlocks), keysPerLanguage: baseKeys.size, complete: true }, null, 2));
