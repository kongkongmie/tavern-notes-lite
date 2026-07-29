import assert from 'node:assert/strict';
import { compareVersions, parseChangelog } from '../core/update-model.js';
import { createUpdateController } from '../features/update-controller.js';
import { rememberFont, sanitizeFontCss } from '../core/font-model.js';
import { createFontController } from '../features/font-controller.js';
import { shouldShowBackupReminder } from '../core/system-status-model.js';
import { createSystemStatusController } from '../features/system-status-controller.js';
import { createStorageModeController } from '../features/storage-mode-controller.js';

assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
assert.equal(parseChangelog('## 1.2.0\n- A\n## 1.1.0\n- B').length, 2);
assert.equal(sanitizeFontCss('@font-face { font-family:X; src:url(x) } script{}').includes('script'), false);
assert.equal(rememberFont([], { type: 'local', name: 'A' }, 1)[0].id, 'local:A:1');
assert.equal(shouldShowBackupReminder({ count: 50, approximateBytes: 1, lastExportAt: '' }, { now: 1 }), true);
assert.equal(shouldShowBackupReminder({ count: 1, approximateBytes: 1 }, { now: 1 }), false);

let updateResolvers = [];
let updateRenders = [];
const updateController = createUpdateController({
    repository: {
        check: () => new Promise(resolve => updateResolvers.push(resolve)),
        getInstalledVersion: async () => '1.0.0',
        readNotice: () => ({}),
        writeNotice() {},
    },
    view: { mount() {}, render: state => updateRenders.push(state), close() {}, destroy() {} },
    fallbackVersion: '1.0.0',
});
updateController.mount();
const first = updateController.check();
const second = updateController.check();
updateResolvers[1]({ installedVersion: '1', latestVersion: '2', hasUpdate: true });
assert.equal((await second).latestVersion, '2');
updateResolvers[0]({ installedVersion: '1', latestVersion: '9', hasUpdate: true });
assert.equal((await first).stale, true);
updateController.destroy();

let settings = { importedFonts: [], fontFamily: 'system-ui', fontImport: '' };
let deleted = [];
let fontChanges = 0;
const fontController = createFontController({
    repository: {
        importFont: async () => {},
        deleteFont: async id => deleted.push(id),
        getFont: async () => ({ dataUrl: 'data:font/woff;base64,AA' }),
    },
    view: { mount() {}, destroy() {}, applyCss() {}, loadFont: async () => {}, readFile: async () => 'data:font/woff;base64,AA', waitForFont: async () => {} },
    getSettings: () => settings,
    updateSettings: async patch => { settings = { ...settings, ...patch }; return { ok: true }; },
    onChanged: () => { fontChanges += 1; },
});
fontController.mount();
await fontController.importLocal({ name: 'Test.woff' });
assert.equal(settings.importedFonts.length, 1);
await fontController.deleteFont(settings.importedFonts[0].id);
assert.equal(deleted.length, 1);
assert.equal(settings.fontFamily, 'system-ui');
assert.equal(fontChanges, 2);
fontController.destroy();

let statusResolvers = [];
let statuses = [];
const statusController = createSystemStatusController({
    repository: { getStatus: () => new Promise(resolve => statusResolvers.push(resolve)) },
    view: { mount() {}, renderStatus: value => statuses.push(value), setLoading() {}, destroy() {} },
    capabilities: { storageQuota: true },
    formatStatus: status => String(status.totalNotes),
});
statusController.mount();
const statusFirst = statusController.refresh();
const statusSecond = statusController.refresh();
statusResolvers[1]({ totalNotes: 2 });
assert.equal((await statusSecond).totalNotes, 2);
statusResolvers[0]({ totalNotes: 1 });
assert.equal((await statusFirst).stale, true);
statusController.destroy();

let mode = 'full';
let renderedMode = null;
const storageController = createStorageModeController({
    view: { mount() {}, close() {}, setLoading() {}, showError() {}, render: value => { renderedMode = value; }, destroy() {} },
    getMode: () => mode,
    prepareSwitch: (from, to) => ({ from, to }),
    replaceSettings: async () => ({ ok: false, error: new Error('failed') }),
    confirmSwitch: async () => true,
    reload() {},
});
storageController.mount();
await storageController.select('lite');
assert.equal(renderedMode, 'full');
storageController.destroy();

console.log('peripheral status feature: ok');
