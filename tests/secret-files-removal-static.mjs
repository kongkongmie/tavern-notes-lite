import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
assert.match(source, /RETIRED_SECRET_FILES_THEME_IDS = new Set\(\['secret-files', 'archive'\]\)/);
assert.match(source, /safeThemes = validThemes\.filter\(item => !isRetiredSecretFilesTheme\(item\)\)/);
assert.match(source, /if \(safeThemes\.length !== validThemes\.length\) writeLiteCustomThemes\(safeThemes\)/);
assert.match(source, /if \(isRetiredSecretFilesTheme\(\{ id, name: theme\.name, theme \}\)\) throw new Error/);
assert.match(source, /RETIRED_SECRET_FILES_THEME_IDS\.has\(String\(id \|\| ''\)\.trim\(\)\.toLowerCase\(\)\)\) return 'default'/);
console.log(JSON.stringify({ builtInRemoved: true, persistedThemesPurged: true, legacyActiveThemeFallsBack: true, reimportBlocked: true }, null, 2));
