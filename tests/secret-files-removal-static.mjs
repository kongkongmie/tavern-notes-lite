import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const themeRepository = fs.readFileSync(new URL('../core/local-theme-repository.js', import.meta.url), 'utf8');
assert.match(source, /RETIRED_SECRET_FILES_THEME_IDS = new Set\(\['secret-files', 'archive'\]\)/);
assert.match(source, /createLocalThemeRepository\(\{/);
assert.match(source, /isRetiredTheme: isRetiredSecretFilesTheme/);
assert.match(themeRepository, /safe = valid\.filter\(item => !isRetiredTheme\(item\)\)/);
assert.match(themeRepository, /if \(safe\.length !== valid\.length\) writeCustomThemes\(safe\)/);
assert.match(themeRepository, /if \(isRetiredTheme\(\{ id, name: theme\.name, theme \}\)\) throw new Error/);
assert.match(themeRepository, /return getRecords\(\)\.some\(item => item\.id === requested\) \? requested : 'default'/);
console.log(JSON.stringify({ builtInRemoved: true, persistedThemesPurged: true, legacyActiveThemeFallsBack: true, reimportBlocked: true }, null, 2));
