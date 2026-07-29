import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isRetiredLegacyTheme } from '../core/theme-presets.js';

const source = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const themeRepository = fs.readFileSync(new URL('../core/local-theme-repository.js', import.meta.url), 'utf8');
assert.equal(isRetiredLegacyTheme({ id: 'secret-files' }), true);
assert.equal(isRetiredLegacyTheme({ id: 'archive' }), true);
assert.equal(isRetiredLegacyTheme({ id: 'default' }), false);
assert.match(source, /import \{ createBuiltInThemeRecords, isRetiredLegacyTheme \} from '\.\/core\/theme-presets\.js'/);
assert.match(source, /createLocalThemeRepository\(\{/);
assert.match(source, /isRetiredTheme: isRetiredLegacyTheme/);
assert.match(themeRepository, /safe = valid\.filter\(item => !isRetiredTheme\(item\)\)/);
assert.match(themeRepository, /if \(safe\.length !== valid\.length\) writeCustomThemes\(safe\)/);
assert.match(themeRepository, /if \(isRetiredTheme\(\{ id, name: theme\.name, theme \}\)\) throw new Error/);
assert.match(themeRepository, /return getRecords\(\)\.some\(item => item\.id === requested\) \? requested : 'default'/);
console.log(JSON.stringify({ builtInRemoved: true, persistedThemesPurged: true, legacyActiveThemeFallsBack: true, reimportBlocked: true }, null, 2));
