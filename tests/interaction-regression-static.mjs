import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../index.js', import.meta.url), 'utf8');
const themeView = await readFile(new URL('../features/theme-view.js', import.meta.url), 'utf8');

for (const functionName of ['setActiveFilter', 'setCharacterFilter', 'clearCharacterFilter']) {
    const match = source.match(new RegExp(`function ${functionName}\\([^]*?\\n\\}`));
    assert.ok(match, `${functionName} must remain present`);
    assert.match(match[0], /noteListRenderer\.render\(\)/, `${functionName} must refresh the view even when the data query is unchanged`);
}

assert.doesNotMatch(themeView, /button\.classList\.toggle\('active',\s*supported && isNight\)/, 'the day/night action must not look permanently selected');

console.log('interaction regression static checks passed');
