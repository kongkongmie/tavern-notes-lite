import {
    characters,
    chat,
    eventSource,
    event_types,
    getCurrentChatId,
    getThumbnailUrl,
    name1,
    this_chid,
    user_avatar,
} from '../../../../script.js';
import { buildFloorExcludeSelector, extractFloorText, normalizeExcludedTagNames, stripExcludedTagsFromHtml } from './floor-capture.js';
import { toFullThemeVariables, toLiteThemeVariables } from './theme-compat.js';
import { closeNoteActionMenus, renderNoteCards, toggleNoteActionMenu } from './core/note-card.js';
import { createLocalThemeRepository } from './core/local-theme-repository.js';
import { createThemeRepository } from './core/theme-repository.js';
import { createBuiltInThemeRecords, isRetiredLegacyTheme } from './core/theme-presets.js';
import { createThemeModel } from './core/theme-model.js';
import { createAppStore } from './core/app-store.js';
import { createApplicationCapabilities } from './core/application-capabilities.js';
import { DEFAULT_SETTINGS, normalizeSettings } from './core/settings-model.js';
import { createSettingsRepository } from './core/settings-repository.js';
import { NOTE_LIST_INITIAL_STATE, NOTE_UI_INITIAL_STATE, createNoteUiQuery } from './core/note-list-model.js';
import { createThemeController } from './features/theme-controller.js';
import { createThemeView, renderThemeViewMarkup } from './features/theme-view.js';
import { createThemeStudio, renderThemeStudioMarkup } from './features/theme-studio.js';
import { createNoteListController } from './features/note-list-controller.js';
import { createNoteFilterController } from './features/note-filter-controller.js';
import { createNoteMutationController } from './features/note-mutation-controller.js';
import { createNoteExportController, prepareNoteForExport } from './features/note-export-controller.js';
import { createNoteActionHandler, createNoteListRenderer, createNoteListView } from './features/note-list-view.js';
import { createNoteFilterView } from './features/note-filter-view.js';
import { createNoteEditorView } from './features/note-editor-view.js';
import { createNoteImportExportView } from './features/note-import-export-view.js';
import { createTagController } from './features/tag-controller.js';
import { createTagView } from './features/tag-view.js';
import { createCaptureController } from './features/capture-controller.js';
import { createCaptureView, createSelectionSnapshotReader } from './features/capture-view.js';
import { createUserInputCaptureController } from './features/user-input-capture-controller.js';
import { createUserInputMaintenanceController } from './features/user-input-maintenance-controller.js';
import { createUserInputMaintenanceView } from './features/user-input-maintenance-view.js';
import { createShareCardRenderer } from './features/share-card-renderer.js';
import { createShareCardView } from './features/share-card-view.js';
import { createShareCardController } from './features/share-card-controller.js';
import { createNoteDetailView, renderNoteDetailContent } from './features/note-detail-view.js';
import { createNoteDetailController } from './features/note-detail-controller.js';
import { createUpdateRepository } from './repositories/update-repository.js';
import { createUpdateController } from './features/update-controller.js';
import { createUpdateView } from './features/update-view.js';
import { createLiteFontRepository } from './repositories/lite-font-repository.js';
import { createFontController } from './features/font-controller.js';
import { createFontView } from './features/font-view.js';
import { stripFontQuotes } from './core/font-model.js';
import { createLiteSystemStatusRepository } from './repositories/lite-system-status-repository.js';
import { createSystemStatusController } from './features/system-status-controller.js';
import { createSystemStatusView } from './features/system-status-view.js';
import { createQuickReplyView } from './features/quick-reply-view.js';
import { createQuickReplyController } from './features/quick-reply-controller.js';
import { createMutationObserverFactory, createObserverController, createResizeObserverFactory } from './features/observer-controller.js';
import { createAppShellView, ensureAppMenuEntry, insertAppShellMarkup } from './features/app-shell-view.js';
import { createCoexistenceController } from './features/coexistence-controller.js';
import { createApplication } from './services/application.js';
import { bootstrapApplication } from './services/application-bootstrap.js';
import { createSillyTavernEventAdapter } from './services/sillytavern-event-adapter.js';
import { createLifecycleRegistry } from './services/lifecycle-registry.js';
import { renderLiteAppShellMarkup } from './repositories/lite-app-shell-markup.js';
import { normalizeTagKey } from './core/tag-model.js';
import { normalizeInputIgnoreRules } from './core/capture-model.js';
import { createSettingsService } from './services/settings-service.js';
import { createLiteNoteRepository } from './repositories/lite-note-repository.js';
import { createLiteTagRepository } from './repositories/lite-tag-repository.js';
import { createLiteUserInputMaintenanceRepository } from './repositories/lite-user-input-maintenance-repository.js';
import {
    getAllLiteNotes,
    getLiteExport,
    getLiteStorageInfo,
    importLiteExport,
    liteApi,
    markLiteExported,
    openLiteDatabase,
} from './storage.js';

const SETTINGS_KEY = 'tavern-notes-lite-settings';
const UPDATE_NOTICE_KEY = 'tavern-notes-lite-update-notice';
const EXTENSION_VERSION = '0.2.0';
const REMOTE_MANIFEST_URL = 'https://raw.githubusercontent.com/kongkongmie/tavern-notes-lite/main/manifest.json';
const REMOTE_CHANGELOG_URL = 'https://raw.githubusercontent.com/kongkongmie/tavern-notes-lite/main/CHANGELOG.md';
const REMOTE_CHANGELOG_ANNOTATION_URL = 'https://raw.githubusercontent.com/kongkongmie/tavern-notes-lite/main/CHANGELOG.zh-CN.md';
const REPOSITORY_URL = 'https://github.com/kongkongmie/tavern-notes-lite';
const THEME_STORAGE_KEY = 'tavern-notes-lite-themes';
const ACTIVE_THEME_KEY = 'tavern-notes-lite-active-theme';
const FULL_EXTENSION_SELECTORS = '#tavern-notes-panel, #tavern-notes-open, #tavern-notes-floating-launcher, #tavern-notes-menu-entry';
const STORAGE_NOTICE_BYTES = 20 * 1024 * 1024;
const BACKUP_NOTICE_DAYS = 30;

function formatBytes(bytes) {
    const value = Math.max(0, Number(bytes) || 0);
    if (value < 1024) return `${Math.round(value)} B`;
    if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
    return `${(value / 1024 ** 3).toFixed(1)} GB`;
}
const FONT_DB_NAME = 'tavern-notes-lite-fonts';
const FONT_DB_STORE = 'fonts';
const DEFAULT_OPEN_ICON_URL = '/scripts/extensions/third-party/tavern-notes-lite/assets/tavern-notes-lite-open.png';
const DEFAULT_CAPTURE_ICON_URL = '/scripts/extensions/third-party/tavern-notes-lite/assets/tavern-notes-lite-capture.png';
const APPLE_THEME_ID = 'apple-glass';
const THEME_CAPABILITIES = Object.freeze({
    themeStudio: true,
    exportTheme: true,
    openThemeFolder: false,
});
const APPLICATION_CAPABILITIES = createApplicationCapabilities({ coexistenceGuard: true });
const sillyTavernEvents = createSillyTavernEventAdapter({ eventSource, eventTypes: event_types });
const MOBILE_VIEWPORT_QUERY = '(max-width: 1000px)';
const LEGACY_APPLE_THEME_DAY_ID = 'apple-glass-day';
const LEGACY_APPLE_THEME_NIGHT_ID = 'apple-glass-night';
const LEGACY_FLOOR_CAPTURE_SELECTOR = '.comment, [data-tavern-notes-content], [data-note-content], .mes_text';
const DEFAULT_FLOOR_CAPTURE_TAG = 'content';
const DEFAULT_FLOOR_CAPTURE_SELECTOR = 'content, .content, [data-tavern-notes-content], [data-note-content], .comment, .mes_text';
const FLOOR_CAPTURE_EXCLUDE_SELECTOR = [
    '.tn-floor-capture',
    '.mes_buttons',
    '.extraMesButtons',
    '.mes_edit_buttons',
    '.swipe_left',
    '.swipe_right',
    '.swipes-counter',
    '.mes_timer',
    '.mesIDDisplay',
    '.tokenCounterDisplay',
    '.mes_reasoning',
    '.mes_summary',
    '.summary',
    '[data-summary]',
    'details',
    'summary',
    'pre',
    'code',
    '.hljs',
    'script',
    'style',
    'textarea',
    'button',
    '[role="button"]',
].join(',');

const appStore = createAppStore({
    app: {},
    settings: normalizeSettings(DEFAULT_SETTINGS),
    theme: {
        theme: null,
        previewTheme: null,
        previewActive: false,
        themes: [],
        activeId: 'default',
        draft: false,
        appleMode: DEFAULT_SETTINGS.appleGlassMode,
        defaultMode: DEFAULT_SETTINGS.defaultThemeMode,
    },
    ui: {},
    noteList: NOTE_LIST_INITIAL_STATE,
    noteQuery: createNoteUiQuery(),
    noteUi: NOTE_UI_INITIAL_STATE,
});
const settingsRepository = createSettingsRepository({ storage: localStorage, key: SETTINGS_KEY });
const settingsService = createSettingsService({ store: appStore, repository: settingsRepository });

const state = {
    initialized: false,
    disabledByFull: false,
    open: false,
    filter: 'all',
    tagFilter: '',
    tagManagerQuery: '',
    tagManagerSort: 'count',
    editingNote: null,
    editingTags: [],
    characterFilter: null,
    status: null,
    variantIndexByGroup: {},
    exportScope: 'all',
    floatingDragMoved: false,
};
const NOTE_STATE_FIELDS = {
    notes: ['noteList', 'items'],
    characters: ['noteList', 'characters'],
    tags: ['noteList', 'tags'],
    totalNotes: ['noteList', 'total'],
    counts: ['noteList', 'counts'],
    query: ['noteQuery', 'search'],
    page: ['noteQuery', 'page'],
    pageSize: ['noteQuery', 'pageSize'],
};
for (const [field, [slice, key]] of Object.entries(NOTE_STATE_FIELDS)) {
    Object.defineProperty(state, field, {
        enumerable: true,
        get: () => appStore.getSlice(slice)[key],
    });
}

const SETTINGS_STATE_FIELDS = {
    language: 'language',
    currentUserName: 'currentUserName',
    recentTags: 'recentTags',
    launcherMode: 'launcherMode',
    floatingPosition: 'floatingPosition',
    autoCaptureUserInput: 'autoCaptureUserInput',
    collapseRepeatedUserInput: 'collapseRepeatedUserInput',
    userInputIgnoreExact: 'userInputIgnoreExact',
    userInputIgnorePrefixes: 'userInputIgnorePrefixes',
    showSelectionCaptureButton: 'showSelectionCaptureButton',
    showFloorCaptureButton: 'showFloorCaptureButton',
    floorCaptureSelector: 'floorCaptureSelector',
    floorCaptureExcludedTags: 'floorCaptureExcludedTags',
    shareCardSettings: 'shareCard',
};
for (const [stateKey, settingsKey] of Object.entries(SETTINGS_STATE_FIELDS)) {
    Object.defineProperty(state, stateKey, {
        enumerable: true,
        get: () => appStore.getSlice('settings')[settingsKey],
    });
}

let mobileViewportMediaQuery = null;

function updateMobileViewportGuard() {
    const isMobile = mobileViewportMediaQuery?.matches
        ?? window.matchMedia?.(MOBILE_VIEWPORT_QUERY)?.matches
        ?? window.innerWidth <= 1000;
    document.documentElement.classList.toggle('tavern-notes-lite-mobile-viewport', isMobile);
    document.body?.classList.toggle('tavern-notes-lite-mobile-viewport', isMobile);
}

function installMobileViewportGuard() {
    if (mobileViewportMediaQuery || !window.matchMedia) {
        updateMobileViewportGuard();
        return;
    }
    mobileViewportMediaQuery = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    updateMobileViewportGuard();
    if (mobileViewportMediaQuery.addEventListener) {
        mobileViewportMediaQuery.addEventListener('change', updateMobileViewportGuard);
    } else {
        mobileViewportMediaQuery.addListener?.(updateMobileViewportGuard);
    }
}

function removeMobileViewportGuard() {
    if (mobileViewportMediaQuery?.removeEventListener) {
        mobileViewportMediaQuery.removeEventListener('change', updateMobileViewportGuard);
    } else {
        mobileViewportMediaQuery?.removeListener?.(updateMobileViewportGuard);
    }
    mobileViewportMediaQuery = null;
    document.documentElement.classList.remove('tavern-notes-lite-mobile-viewport');
    document.body?.classList.remove('tavern-notes-lite-mobile-viewport');
}

const LANGUAGE_OPTIONS = [
    { id: 'auto', label: '跟随酒馆' },
    { id: 'zh-CN', label: '简体中文' },
    { id: 'zh-TW', label: '繁體中文' },
    { id: 'en', label: 'English' },
    { id: 'ko', label: '한국어' },
];

const TEXT_ZH_CN = {
    appName: '酒馆笔记 Lite',
    autoLanguage: '跟随酒馆',
    language: '语言',
    languageSaved: '语言已保存，刷新页面后生效。',
    subtitle: 'soft notes · character memory',
    theme: '主题',
    exportNotes: '导入导出笔记',
    closeNotes: '关闭酒馆笔记',
    searchPlaceholder: '搜索笔记、角色、聊天、标签...',
    connecting: '正在连接酒馆笔记...',
    prevPage: '上一页',
    nextPage: '下一页',
    jumpPage: '跳页',
    exportScope: '导出范围',
    allNotes: '全部笔记',
    currentPage: '当前页面',
    exportHint: '当前页面只导出现在列表里这一页看到的笔记。',
    exportJson: '可再次导入的 JSON 笔记文件',
    exportTxt: '纯 TXT 文件',
    importJson: '导入 JSON 笔记',
    liteFullInfoTitle: 'Lite 与 Full 版本',
    liteFullJsonCompatibility: 'Lite 导出的 JSON 笔记可直接导入 Full；Full 导出的 JSON 也可导入 Lite。',
    liteLimitations: 'Lite 无需安装后端，笔记只保存在当前浏览器中。它不会自动跨浏览器或设备共享；清除网站数据可能删除笔记，请定期导出 JSON 备份。',
    fullAdvantages: 'Full 需要安装后端，并支持本地文件存储、每日自动备份，以及多端共享同一份数据。',
    importDone: '导入完成：新增 {imported} 条，跳过 {skipped} 条重复或空笔记。',
    invalidBackup: '无法导入：请选择酒馆笔记导出的 JSON 备份。',
    noPageNotesToExport: '当前页面没有可导出的笔记。',
    exportStarted: '已开始导出。',
    liteStorageStatus: '浏览器本地存储 · {size} · {count} 条',
    liteBackupReminder: 'Lite 笔记已占约 {size}，或超过 30 天没有导出备份。建议现在导出 JSON。',
    themeFiles: '主题文件',
    currentTheme: '当前：{name}',
    themeName: '主题名称',
    mergeTheme: '融合当前酒馆主题',
    themeGuide: '主题制作说明',
    preview: '预览',
    save: '保存',
    saveAs: '另存为',
    resetDefault: '恢复默认',
    shareCard: '分享卡片',
    font: '字体',
    savedFonts: '已导入字体',
    savedFontsPlaceholder: '选择已导入字体',
    noSavedFonts: '还没有已导入字体',
    fontSize: '字号',
    fontImport: '字体地址或 @import',
    fontHelp: '粘贴 ZeoSeven 的 result.css 地址，或整段 @import CSS，然后点“导入字体”。识别成功后会自动填入字体名并刷新图片。',
    findFonts: '查找免费商用字体',
    background: '背景',
    display: '显示',
    characterName: '角色名',
    date: '日期',
    importFont: '导入字体',
    importLocalFont: '导入本地字体',
    redrawPreview: '刷新预览',
    exportPng: '导出 PNG',
    noShareCardToExport: '没有可导出的分享卡。',
    shareCardExportFailed: '生成图片失败。',
    shareCardExported: '已导出分享卡。',
    filtersAll: '全部',
    filtersCharacters: '角色',
    filtersUserInput: 'User 输入',
    filtersExcerpt: '摘抄',
    hintAllNotes: '全部记录',
    hintByCard: '按角色',
    hintYourWords: '你的输入',
    hintSelectedText: '选中文字',
    userInput: 'User 输入',
    excerpt: '摘抄',
    manual: '手动',
    unnamedCharacter: '未命名角色',
    noNotes: '这里还没有笔记',
    noNotesHint: '发送消息会自动记录 User 输入；选中聊天文字后点“摘录选中”会保存摘抄。',
    noCharacterNotes: '还没有角色笔记',
    noCharacterNotesHint: '发送 User 输入或摘录聊天文字后，这里会按角色汇总。',
    currentCharacter: '当前角色',
    priority: '优先显示',
    browseByCharacter: '按角色浏览',
    characterCount: '{count} 个角色',
    otherCharactersEmpty: '其他角色有记录后会显示在这里。',
    viewingCharacter: '正在查看这个角色的笔记',
    backCharacters: '返回角色列表',
    fillInput: '输入',
    copy: '复制',
    share: '分享',
    delete: '删除',
    viewFull: '查看全文',
    edit: '编辑',
    editNote: '编辑笔记',
    noteContent: '笔记正文',
    noteContentRequired: '笔记正文不能为空。',
    tags: '标签',
    allTags: '全部标签',
    clearTagFilter: '清除筛选',
    tagLibrary: '全部标签',
    tagLibraryIntro: '搜索或整理所有标签，点击标签即可查看对应笔记。',
    tagShelfEmpty: '还没有标签，编辑任意笔记即可添加',
    tagEmptyTitle: '从第一个标签开始',
    tagEmptyIntro: '标签可以把不同角色、聊天里的笔记整理到一起。',
    tagEmptyStepEdit: '打开任意一条笔记，点击“编辑”',
    tagEmptyStepAdd: '在标签框输入名称，可用逗号分隔多个标签',
    tagEmptyStepSave: '保存后，标签会自动出现在这里',
    backToNotes: '返回笔记列表',
    deleteTag: '删除标签',
    confirmDeleteTag: '确定删除标签“{tag}”吗？\n\n它会从 {count} 条笔记中移除，但不会删除笔记。',
    tagDeleted: '标签“{tag}”已从 {count} 条笔记中移除。',
    searchTags: '搜索标签…',
    sortByCount: '按使用次数',
    sortByName: '按名称',
    noMatchingTags: '没有找到匹配的标签。',
    tagSuggestions: '已有标签推荐',
    tagsPlaceholder: '例如：甜饼, 剧情线, 待整理',
    tagsHelp: '输入后按回车或逗号添加；点击标签右侧的 × 可以移除。最多 20 个。',
    filterByTag: '查看标签：{tag}',
    saveChanges: '保存修改',
    noteUpdated: '笔记已更新。',
    captured: '已摘录选中文字。',
    copied: '已复制。',
    filled: '已进入输入栏。',
    deleted: '已删除。',
    selectTextFirst: '先在聊天里选中一段文字，再点“摘录选中”。',
    noInput: '没有找到输入框。',
    shownCharacters: '已显示 {count} 个角色',
    shownNotes: '已显示 {shown} 条，当前筛选共 {total} 条',
    connected: '已连接：{user}，V{version}，总记录约 {count} 条',
    updateAvailableTitle: '酒馆笔记有新版本',
    updateAvailable: '检测到 v{version}。请在 SillyTavern 扩展面板里更新酒馆笔记 Lite。',
    updateCenter: '版本与更新', updateCenterIntro: '查看当前版本、最新版本和更新日志。是否更新完全由你决定。', checkUpdates: '检查更新', checkingUpdates: '正在检查…', installedVersion: '当前版本', latestVersion: '最新版本', updateAvailableStatus: '发现新版本 v{version}', upToDateStatus: '已经是最新版本', updateCheckFailed: '暂时无法连接更新服务器', openExtensionManager: '打开扩展管理', openRepository: '打开项目页面', updateInstructions: '更新由 SillyTavern 扩展管理器执行；酒馆笔记 Lite 不会静默安装或覆盖文件。', changelogTitle: '更新日志', latestBadge: '最新', noChangelog: '暂时没有取得更新日志。', viewUpdate: '查看更新', authorAnnotation: '作者中文注释',
    openNotes: '打开酒馆笔记',
    captureSelected: '摘录选中',
    captureSelectedTitle: '摘录选中的聊天文字',
    captureFloor: '摘录整层',
    captureFloorTitle: '摘录这一整层楼的文字',
    captureFloorEmpty: '没有找到这一层楼的正文。',
    floorCaptureEntry: '整楼摘录',
    floorCaptureEntryTitle: '是否开启整楼摘录功能，点击查看配置说明',
    floorCaptureSettingsTitle: '整楼摘录设置',
    floorCaptureSettingsIntro: '这个功能会在每层楼右上角加一个“摘录整层”按钮。普通聊天不用配置，打开开关就能用。',
    floorCaptureStepsTitle: '怎么用',
    floorCaptureSteps: '1. 打开“是否开启整楼摘录功能”。\n2. 回到聊天页面。\n3. 在想保存的那层楼右上角点“摘录整层”。',
    floorCaptureContentTitle: '正文标签名是什么',
    floorCaptureContentHelp: '如果一层楼里有摘要、状态栏、按钮或代码块，就让模板作者把真正正文包在一个标签里。比如 <content>正文</content>，标签名就是 content。',
    floorCaptureTroubleTitle: '如果摘录结果不对',
    floorCaptureTroubleHelp: '问模板作者：正文是被哪个标签包住的？把那个标签名填进“修改正文标签”。例如 <story>正文</story> 就填 story。保存后重新点“摘录整层”。',
    floorCaptureButton: '是否开启整楼摘录功能',
    floorCaptureButtonTitle: '是否开启每层楼右上角的“摘录整层”按钮',
    floorCaptureButtonOn: '已开启整层摘录按钮。',
    floorCaptureButtonOff: '已关闭整层摘录按钮。',
    floorCaptureSelectorLabel: '正文标签名',
    floorCaptureSelectorPlaceholder: 'content',
    floorCaptureSelectorHelp: '只填标签名，不要填尖括号。比如正文写在 <story>正文</story> 里，就填 story。',
    floorCaptureSelectorSaved: '正文标签已保存。',
    floorCaptureSelectorCurrentDefault: '当前会优先摘取 <content> 标签里的正文。',
    floorCaptureSelectorCurrentCustom: '当前会优先摘取 <{tag}> 标签里的正文。',
    floorCaptureExampleTitle: '推荐写法',
    floorCaptureExample: '<content>这里写真正要摘录的正文。</content>',
    floorCaptureAdvanced: '修改正文标签',
    excludeTagsTitle: '排除标签', excludeTagsHelp: '若正文中夹有这些标签，摘录时会删除标签及其中的全部内容。例如填写 thinking，会删除 <thinking>…</thinking>。', excludeTagPlaceholder: 'thinking、status', addExcludedTag: '添加排除标签', removeExcludedTag: '删除排除标签', noExcludedTags: '尚未设置排除标签', invalidExcludedTag: '请输入有效标签名，例如 thinking。', excludedTagsSaved: '排除标签已保存。',
    launcherMode: '入口',
    toolbarButtons: '工具栏',
    floatingBall: '悬浮球',
    switchLauncherMode: '切换酒馆笔记入口显示方式',
    toolbarLauncherShown: '已切换为工具栏入口。',
    floatingLauncherShown: '已切换为悬浮球入口。',
    autoCaptureUserInput: '记录输入',
    autoCaptureUserInputTitle: '自动记录发送出去的 User 输入',
    autoCaptureUserInputOn: '已开启自动记录 User 输入。',
    autoCaptureUserInputOff: '已关闭自动记录 User 输入。',
    newNote: '新建笔记', captureTools: '摘录工具', more: '更多', inspirationTag: '灵感笔记', newNoteUserHelp: '笔记将归入当前 USER，并自动带上“灵感笔记”标签。', newNoteSaved: '灵感笔记已保存。', noteContentRequired: '请先填写笔记内容。', saveNote: '保存笔记', renameTag: '重命名标签', renameTagPrompt: '把标签“{tag}”重命名为：', tagRenamed: '已将“{oldTag}”重命名为“{newTag}”，更新 {count} 条笔记。', resetFloatingPosition: '重置悬浮球位置',
    userInputCleanup: '输入整理', userInputCleanupTitle: '重复输入与忽略规则', userInputCleanupIntro: '连续相同输入会折叠为一条；每行可填写一条不需要记录的固定指令。', collapseRepeatedInput: '折叠连续重复输入', collapseRepeatedHelp: '保留一条笔记，并显示累计重复次数。', ignoreExactLabel: '完全匹配时忽略', ignoreExactPlaceholder: '每行一条，例如：继续', ignorePrefixLabel: '以这些文字开头时忽略', ignorePrefixPlaceholder: '每行一条，例如：/qr', saveInputRules: '保存规则', inputRulesSaved: '输入整理规则已保存。', scanDuplicates: '扫描历史重复', scanNoDuplicates: '没有发现可清理的连续重复输入。', scanPreview: '发现 {groups} 组、共 {duplicateNotes} 条可合并的重复输入。', cleanupConfirm: '确认清理吗？建议先导出一份备份。', cleanupDone: '已合并 {duplicateNotes} 条历史重复输入。', repeatedTimes: '重复 {count} 次',
    addInputRules: '添加规则', filterInputRules: '搜索规则', noInputRules: '暂无规则', clearHistoryDuplicates: '清除历史重复', dedupeOccurrences: '共 {count} 条，将移除 {duplicates} 条', confirmCleanup: '确认清理这些条目', cancelCleanup: '取消',
    selectionCaptureButton: '选区按钮',
    selectionCaptureButtonTitle: '选中文字后显示浮动摘录按钮',
    selectionCaptureButtonOn: '已开启选区浮动摘录按钮。',
    selectionCaptureButtonOff: '已关闭选区浮动摘录按钮。',
    noNotesHintNoUserInput: '选中聊天文字后点“摘录选中”会保存摘抄。',
    noCharacterNotesHintNoUserInput: '摘录聊天文字后，这里会按角色汇总。',
    fromTavernNotes: '来自酒馆笔记',
    brandForShare: '酒馆笔记',
    excerptedAt: '摘录于',
    openThemePanel: '打开主题面板：切换、导入、导出或编辑酒馆笔记主题',
    close: '关闭',
    closeThemePanel: '关闭主题面板',
    switchTheme: '切换主题',
    importTheme: '导入主题',
    exportCurrentTheme: '导出当前主题',
    openThemeFolder: '打开主题文件夹',
    deleteTheme: '删除主题',
    builtInThemeCannotDelete: '内置主题不能删除。',
    appleThemeMode: '日夜',
    appleThemeModeTitle: '切换 Apple Glass 日夜主题',
    appleThemeDay: '切换到 Apple 日间',
    appleThemeNight: '切换到 Apple 夜间',
    defaultThemeDay: '切换到柔光日间',
    defaultThemeNight: '切换到暮蓝夜间',
    defaultThemeModeTitle: '切换默认主题的日间 / 夜间模式',
    defaultThemeDayOn: '已切换到柔光日间。',
    defaultThemeNightOn: '已切换到暮蓝夜间。',
    appleThemeEnabled: '已切换 Apple Glass 主题。',
    previewTheme: '预览：{name}',
    unnamedTheme: '未命名主题',
    previewSave: '应用并保存',
    themeCalendar: '日历',
    themeJianshu: '简书',
    themeDialogue: '对话',
    themeMobai: '墨白',
    themeGuideContent: `主题文件说明

主题 JSON 由 variables 和 assets 两部分组成。

variables 控制颜色、圆角、字体、卡片、按钮和笔记样式。
assets 控制标题图标和背景图；输入栏与摘录按钮使用固定默认图标。

`,
    invalidThemeFile: '这不是酒馆笔记主题文件。',
    previewedTheme: '已预览主题，还没有保存。',
    mergedThemeDraft: '已生成融合主题草稿；当前主题未改变。点“应用并保存”才会切换当前主题。',
    savedAsTheme: '已另存为新主题。',
    savedTheme: '主题已保存。',
    switchedTheme: '主题已切换。',
    importedTheme: '主题已导入并切换。',
    requestedThemeFolder: '已请求打开主题文件夹。默认主题是内嵌的，不在这个文件夹里。',
    defaultThemeCannotDelete: '默认主题不能删除。',
    confirmDeleteTheme: '确定删除主题“{name}”吗？',
    deletedTheme: '主题已删除。',
    themeNamePrompt: '{action}主题名称：',
    themeNameEmpty: '主题名称不能为空。',
    saveAction: '保存',
    saveAsAction: '另存为',
    currentTavernTheme: '当前酒馆主题',
    mergedThemeName: '融合酒馆主题 - {name}',
    confirmDeleteNote: '确定删除这条笔记吗？\n\n{preview}{ellipsis}',
    pasteFontFirst: '先粘贴字体地址或 @import 代码。',
    importedFont: '已导入字体：{name}',
    importedFontCode: '已导入字体代码，请确认字体名。',
    localFontImported: '已导入本地字体：{name}',
    localFontSessionOnly: '字体文件较大，已临时导入。本次页面可用，下次需要重新选择文件。',
    localFontUnsupported: '当前浏览器不支持本地字体导入。',
    savedFontMissing: '这个字体缺少可读取的数据，请重新导入。',
};

const TEXTS = {
    'zh-CN': TEXT_ZH_CN,
    'zh-TW': {
        ...TEXT_ZH_CN,
        autoLanguage: '跟隨酒館',
        language: '語言',
        languageSaved: '語言已保存，重新整理頁面後生效。',
        appName: '酒館筆記 Lite',
        theme: '主題',
        exportNotes: '匯入匯出筆記',
        exportJson: '可再次匯入的 JSON 筆記檔案',
        exportTxt: '純 TXT 檔案',
        importJson: '匯入 JSON 筆記',
        liteFullInfoTitle: 'Lite 與 Full 版本',
        liteFullJsonCompatibility: 'Lite 匯出的 JSON 筆記可直接匯入 Full；Full 匯出的 JSON 也可匯入 Lite。',
        liteLimitations: 'Lite 不需安裝後端，筆記只保存在目前瀏覽器中。它不會自動跨瀏覽器或裝置共享；清除網站資料可能刪除筆記，請定期匯出 JSON 備份。',
        fullAdvantages: 'Full 需安裝後端，並支援本機檔案儲存、每日自動備份，以及多端共用同一份資料。',
        importDone: '匯入完成：新增 {imported} 條，略過 {skipped} 條重複或空白筆記。',
        invalidBackup: '無法匯入：請選擇酒館筆記匯出的 JSON 備份。',
        noPageNotesToExport: '目前頁面沒有可匯出的筆記。',
        exportStarted: '已開始匯出。',
        liteStorageStatus: '瀏覽器本機儲存 · {size} · {count} 條',
        liteBackupReminder: 'Lite 筆記已佔約 {size}，或超過 30 天沒有匯出備份。建議現在匯出 JSON。',
        closeNotes: '關閉酒館筆記',
        searchPlaceholder: '搜尋筆記、角色、聊天、標籤...',
        connecting: '正在連接酒館筆記...',
        currentPage: '目前頁面',
        themeFiles: '主題檔案',
        currentTheme: '目前：{name}',
        themeName: '主題名稱',
        mergeTheme: '融合目前酒館主題',
        saveAs: '另存為',
        resetDefault: '恢復預設',
        importFont: '匯入字體',
        importLocalFont: '匯入本機字體',
        savedFonts: '已匯入字體',
        savedFontsPlaceholder: '選擇已匯入字體',
        noSavedFonts: '還沒有已匯入字體',
        fontHelp: '貼上 ZeoSeven 的 result.css 地址，或整段 @import CSS，然後點「匯入字體」。識別成功後會自動填入字體名稱並重新整理圖片。',
        findFonts: '查找免費商用字體',
        redrawPreview: '重新整理預覽',
        exportPng: '匯出 PNG',
        noShareCardToExport: '沒有可匯出的分享卡。',
        shareCardExportFailed: '產生圖片失敗。',
        shareCardExported: '已匯出分享卡。',
        userInput: 'User 輸入',
        hintAllNotes: '全部記錄',
        hintByCard: '按角色',
        hintYourWords: '你的輸入',
        hintSelectedText: '選中文字',
        unnamedCharacter: '未命名角色',
        currentCharacter: '目前角色',
        copied: '已複製。',
        filled: '已進入輸入框。',
        edit: '編輯',
        editNote: '編輯筆記',
        noteContent: '筆記正文',
        noteContentRequired: '筆記正文不能為空。',
        tags: '標籤',
        allTags: '全部標籤',
        clearTagFilter: '清除篩選',
        tagLibrary: '全部標籤',
        tagLibraryIntro: '搜尋或整理所有標籤，點擊標籤即可查看對應筆記。',
        tagShelfEmpty: '還沒有標籤，編輯任意筆記即可新增',
        tagEmptyTitle: '從第一個標籤開始',
        tagEmptyIntro: '標籤可以把不同角色、聊天裡的筆記整理到一起。',
        tagEmptyStepEdit: '打開任意一則筆記，點擊「編輯」',
        tagEmptyStepAdd: '在標籤欄輸入名稱，可用逗號分隔多個標籤',
        tagEmptyStepSave: '儲存後，標籤會自動出現在這裡',
        backToNotes: '返回筆記列表',
        deleteTag: '刪除標籤',
        confirmDeleteTag: '確定刪除標籤「{tag}」嗎？\n\n它會從 {count} 則筆記中移除，但不會刪除筆記。',
        tagDeleted: '標籤「{tag}」已從 {count} 則筆記中移除。',
        searchTags: '搜尋標籤…',
        sortByCount: '按使用次數',
        sortByName: '按名稱',
        noMatchingTags: '找不到符合的標籤。',
        tagSuggestions: '現有標籤建議',
        tagsPlaceholder: '例如：甜餅, 劇情線, 待整理',
        tagsHelp: '輸入後按 Enter 或逗號新增；點擊標籤右側的 × 可以移除。最多 20 個。',
        filterByTag: '查看標籤：{tag}',
        saveChanges: '儲存修改',
        noteUpdated: '筆記已更新。',
        openNotes: '打開酒館筆記',
        updateAvailableTitle: '酒館筆記有新版本',
        updateAvailable: '偵測到 v{version}。請在 SillyTavern 擴充面板裡更新酒館筆記 Lite。',
        updateCenter: '版本與更新', updateCenterIntro: '查看目前版本、最新版本和更新日誌。是否更新完全由你決定。', checkUpdates: '檢查更新', checkingUpdates: '正在檢查…', installedVersion: '目前版本', latestVersion: '最新版本', updateAvailableStatus: '發現新版本 v{version}', upToDateStatus: '已經是最新版本', updateCheckFailed: '暫時無法連線更新伺服器', openExtensionManager: '開啟擴充管理', openRepository: '開啟專案頁面', updateInstructions: '更新由 SillyTavern 擴充管理器執行；酒館筆記 Lite 不會靜默安裝或覆蓋檔案。', changelogTitle: '更新日誌', latestBadge: '最新', noChangelog: '暫時沒有取得更新日誌。', viewUpdate: '查看更新', authorAnnotation: '作者中文註釋',
        captureFloor: '摘錄整層',
        captureFloorTitle: '摘錄這一整層樓的文字',
        captureFloorEmpty: '沒有找到這一層樓的正文。',
        floorCaptureEntry: '整樓摘錄',
        floorCaptureEntryTitle: '是否開啟整樓摘錄功能，點擊查看配置說明',
        floorCaptureSettingsTitle: '整樓摘錄設定',
        floorCaptureSettingsIntro: '這個功能會在每層樓右上角加一個「摘錄整層」按鈕。普通聊天不用配置，打開開關就能用。',
        floorCaptureStepsTitle: '怎麼用',
        floorCaptureSteps: '1. 打開「是否開啟整樓摘錄功能」。\n2. 回到聊天頁面。\n3. 在想保存的那層樓右上角點「摘錄整層」。',
        floorCaptureContentTitle: '如果訊息裡有摘要、狀態列或裝飾程式碼',
        floorCaptureContentHelp: '如果一層樓裡除了正文，還有摘要、屬性列、按鈕、程式碼區，最好讓模板作者把真正正文包在 content 標籤裡。這樣酒館筆記會優先只摘 content 裡面的文字。',
        floorCaptureTroubleTitle: '如果摘錄結果不對',
        floorCaptureTroubleHelp: '先看正文外面包著什麼標籤：如果是 <story>正文</story>，進階設定填 story；如果是 <div class="story">正文</div>，進階設定填 .story。改完後重新點「摘錄整層」。',
        floorCaptureButton: '是否開啟整樓摘錄功能',
        floorCaptureButtonTitle: '是否開啟每層樓右上角的「摘錄整層」按鈕',
        floorCaptureButtonOn: '已開啟整層摘錄按鈕。',
        floorCaptureButtonOff: '已關閉整層摘錄按鈕。',
        floorCaptureSelectorLabel: '正文標籤名',
        floorCaptureSelectorPlaceholder: 'content',
        floorCaptureSelectorHelp: '只填標籤名，不要填尖括號。比如正文寫在 <story>正文</story> 裡，就填 story。',
        floorCaptureSelectorSaved: '正文標籤已保存。',
        floorCaptureSelectorCurrentDefault: '目前會優先摘取 <content> 標籤裡的正文。',
        floorCaptureSelectorCurrentCustom: '目前會優先摘取 <{tag}> 標籤裡的正文。',
        floorCaptureExampleTitle: '推薦寫法',
        floorCaptureExample: '<content>這裡寫真正要摘錄的正文。</content>',
        floorCaptureAdvanced: '修改正文標籤',
        excludeTagsTitle: '排除標籤', excludeTagsHelp: '若正文中夾有這些標籤，摘錄時會刪除標籤及其中的全部內容。例如填入 thinking，會刪除 <thinking>…</thinking>。', excludeTagPlaceholder: 'thinking、status', addExcludedTag: '新增排除標籤', removeExcludedTag: '刪除排除標籤', noExcludedTags: '尚未設定排除標籤', invalidExcludedTag: '請輸入有效標籤名，例如 thinking。', excludedTagsSaved: '排除標籤已儲存。',
        launcherMode: '入口',
        toolbarButtons: '工具列',
        floatingBall: '懸浮球',
        switchLauncherMode: '切換酒館筆記入口顯示方式',
        toolbarLauncherShown: '已切換為工具列入口。',
        floatingLauncherShown: '已切換為懸浮球入口。',
        autoCaptureUserInput: '記錄輸入',
        autoCaptureUserInputTitle: '自動記錄送出的 User 輸入',
        autoCaptureUserInputOn: '已開啟自動記錄 User 輸入。',
        autoCaptureUserInputOff: '已關閉自動記錄 User 輸入。',
        newNote: '新增筆記', captureTools: '摘錄工具', more: '更多', inspirationTag: '靈感筆記', newNoteUserHelp: '筆記將歸入目前 USER，並自動帶上「靈感筆記」標籤。', newNoteSaved: '靈感筆記已儲存。', noteContentRequired: '請先填寫筆記內容。', saveNote: '儲存筆記', renameTag: '重新命名標籤', renameTagPrompt: '將標籤「{tag}」重新命名為：', tagRenamed: '已將「{oldTag}」重新命名為「{newTag}」，更新 {count} 則筆記。', resetFloatingPosition: '重設懸浮球位置',
        userInputCleanup: '輸入整理', userInputCleanupTitle: '重複輸入與忽略規則', userInputCleanupIntro: '連續相同輸入會折疊成一則；每行可填寫一條不需記錄的固定指令。', collapseRepeatedInput: '折疊連續重複輸入', collapseRepeatedHelp: '保留一則筆記，並顯示累計重複次數。', ignoreExactLabel: '完全符合時忽略', ignoreExactPlaceholder: '每行一條，例如：繼續', ignorePrefixLabel: '以這些文字開頭時忽略', ignorePrefixPlaceholder: '每行一條，例如：/qr', saveInputRules: '儲存規則', inputRulesSaved: '輸入整理規則已儲存。', scanDuplicates: '掃描歷史重複', scanNoDuplicates: '沒有發現可清理的連續重複輸入。', scanPreview: '發現 {groups} 組、共 {duplicateNotes} 則可合併的重複輸入。', cleanupConfirm: '確認清理嗎？建議先匯出一份備份。', cleanupDone: '已合併 {duplicateNotes} 則歷史重複輸入。', repeatedTimes: '重複 {count} 次',
        addInputRules: '新增規則', filterInputRules: '搜尋規則', noInputRules: '暫無規則', clearHistoryDuplicates: '清除歷史重複', dedupeOccurrences: '共 {count} 條，將移除 {duplicates} 條', confirmCleanup: '確認清理這些項目', cancelCleanup: '取消',
        selectionCaptureButton: '選區按鈕',
        selectionCaptureButtonTitle: '選中文字後顯示浮動摘錄按鈕',
        selectionCaptureButtonOn: '已開啟選區浮動摘錄按鈕。',
        selectionCaptureButtonOff: '已關閉選區浮動摘錄按鈕。',
        noNotesHintNoUserInput: '選中聊天文字後點「摘錄選中」會保存摘抄。',
        noCharacterNotesHintNoUserInput: '摘錄聊天文字後，這裡會按角色彙總。',
        fromTavernNotes: '來自酒館筆記',
        brandForShare: '酒館筆記',
        excerptedAt: '摘錄於',
        openThemePanel: '打開主題面板：切換、匯入、匯出或編輯酒館筆記主題',
        close: '關閉',
        closeThemePanel: '關閉主題面板',
        switchTheme: '切換主題',
        importTheme: '匯入主題',
        exportCurrentTheme: '匯出目前主題',
        openThemeFolder: '打開主題資料夾',
        deleteTheme: '刪除主題',
        builtInThemeCannotDelete: '內建主題不能刪除。',
        appleThemeMode: '日夜',
        appleThemeModeTitle: '切換 Apple Glass 日夜主題',
        appleThemeDay: '切換到 Apple 日間',
        appleThemeNight: '切換到 Apple 夜間',
        defaultThemeDay: '切換到柔光日間',
        defaultThemeNight: '切換到暮藍夜間',
        defaultThemeModeTitle: '切換預設主題的日間 / 夜間模式',
        defaultThemeDayOn: '已切換到柔光日間。',
        defaultThemeNightOn: '已切換到暮藍夜間。',
        appleThemeEnabled: '已切換 Apple Glass 主題。',
        previewTheme: '預覽：{name}',
        unnamedTheme: '未命名主題',
        previewSave: '套用並儲存',
        themeCalendar: '日曆',
        themeJianshu: '簡書',
        themeDialogue: '對話',
        themeMobai: '墨白',
        themeGuideContent: `主題 JSON 由 variables 和 assets 兩部分組成。

variables 控制顏色、圓角、字體、卡片、按鈕和筆記樣式。
assets 控制標題圖示和背景圖；輸入列與摘錄按鈕使用固定預設圖示。

`,
        invalidThemeFile: '這不是酒館筆記主題檔案。',
        previewedTheme: '已預覽主題，尚未儲存。',
        mergedThemeDraft: '已產生融合主題草稿；目前主題未變更。點「套用並儲存」才會切換目前主題。',
        savedAsTheme: '已另存為新主題。',
        savedTheme: '主題已儲存。',
        switchedTheme: '主題已切換。',
        importedTheme: '主題已匯入並切換。',
        requestedThemeFolder: '已請求打開主題資料夾。預設主題是內嵌的，不在這個資料夾裡。',
        defaultThemeCannotDelete: '預設主題不能刪除。',
        confirmDeleteTheme: '確定刪除主題「{name}」嗎？',
        deletedTheme: '主題已刪除。',
        themeNamePrompt: '{action}主題名稱：',
        themeNameEmpty: '主題名稱不能為空。',
        saveAction: '儲存',
        saveAsAction: '另存為',
        currentTavernTheme: '目前酒館主題',
        mergedThemeName: '融合酒館主題 - {name}',
        confirmDeleteNote: '確定刪除這條筆記嗎？\n\n{preview}{ellipsis}',
        pasteFontFirst: '先貼上字體地址或 @import 代碼。',
        importedFont: '已匯入字體：{name}',
        importedFontCode: '已匯入字體代碼，請確認字體名稱。',
        localFontImported: '已匯入本機字體：{name}',
        localFontSessionOnly: '字體檔案較大，已臨時匯入。本次頁面可用，下次需要重新選擇檔案。',
        localFontUnsupported: '目前瀏覽器不支援本機字體匯入。',
        savedFontMissing: '這個字體缺少可讀取資料，請重新匯入。',
        subtitle: '柔和筆記・角色記憶', prevPage: '上一頁', nextPage: '下一頁', jumpPage: '跳頁', exportScope: '匯出範圍', allNotes: '全部筆記', exportHint: '匯出的檔案可重新匯入 Tavern Notes。', themeGuide: '主題製作說明', preview: '預覽', save: '儲存', shareCard: '分享卡片', font: '字體', fontSize: '字體大小', fontImport: '字體網址或 @import', background: '背景', display: '顯示', characterName: '角色名稱', date: '日期',
        filtersAll: '全部筆記', filtersCharacters: '角色瀏覽', filtersUserInput: 'User 輸入', filtersExcerpt: '摘錄', excerpt: '摘錄', manual: '手動筆記', noNotes: '暫無筆記', noNotesHint: '選取聊天文字後，按下摘錄選中即可儲存。', noCharacterNotes: '這個角色暫無筆記', noCharacterNotesHint: '切換角色或返回角色瀏覽。', priority: '優先', browseByCharacter: '依角色瀏覽', characterCount: '{count} 則筆記', otherCharactersEmpty: '沒有其他角色筆記。', viewingCharacter: '正在查看 {name}', backCharacters: '返回角色瀏覽',
        fillInput: '重新輸入', copy: '複製', share: '分享', delete: '刪除', viewFull: '查看全文', captured: '已摘錄選中文字。', deleted: '已刪除筆記。', selectTextFirst: '請先選取聊天文字，再按摘錄選中。', noInput: '輸入框沒有內容。', shownCharacters: '已顯示 {count} 個角色', shownNotes: '已顯示 {shown} 則，目前篩選共 {total} 則', connected: '已連線', captureSelected: '摘錄選中', captureSelectedTitle: '摘錄選中的聊天文字',
    },
    en: {
        ...TEXT_ZH_CN,
        autoLanguage: 'Follow Tavern',
        language: 'Language',
        languageSaved: 'Language saved. Refresh the page to apply it.',
        appName: 'Tavern Notes Lite',
        theme: 'Theme',
        exportNotes: 'Export notes',
        closeNotes: 'Close Tavern Notes Lite',
        searchPlaceholder: 'Search notes, characters, chats, tags...',
        connecting: 'Connecting to Tavern Notes Lite...',
        prevPage: 'Previous page',
        nextPage: 'Next page',
        jumpPage: 'Jump',
        exportScope: 'Export scope',
        allNotes: 'All notes',
        currentPage: 'Current page',
        exportHint: 'Current page exports only the notes visible on this page.',
        exportNotes: 'Import / Export Notes',
        exportJson: 'Re-importable JSON note file',
        exportTxt: 'Plain TXT file',
        importJson: 'Import JSON notes',
        liteFullInfoTitle: 'Lite and Full',
        liteFullJsonCompatibility: 'JSON notes exported by Lite can be imported directly into Full, and Full JSON exports can also be imported into Lite.',
        liteLimitations: 'Lite needs no server plugin and stores notes only in this browser. It does not sync across browsers or devices, and clearing site data may delete notes. Export JSON backups regularly.',
        fullAdvantages: 'Full requires the server plugin and adds local file storage, daily automatic backups, and shared data across devices.',
        importDone: 'Import complete: {imported} added, {skipped} duplicates or empty notes skipped.',
        invalidBackup: 'Import failed. Choose a JSON backup exported by Tavern Notes.',
        noPageNotesToExport: 'There are no notes to export on this page.',
        exportStarted: 'Export started.',
        liteStorageStatus: 'Browser storage · {size} · {count} notes',
        liteBackupReminder: 'Lite uses about {size}, or no JSON backup was exported for 30 days. Export a backup now.',
        themeFiles: 'Theme Files',
        currentTheme: 'Current: {name}',
        themeName: 'Theme name',
        mergeTheme: 'Merge current Tavern theme',
        themeGuide: 'Theme guide',
        preview: 'Preview',
        save: 'Save',
        saveAs: 'Save as',
        resetDefault: 'Reset default',
        shareCard: 'Share Card',
        font: 'Font',
        savedFonts: 'Imported fonts',
        savedFontsPlaceholder: 'Choose imported font',
        noSavedFonts: 'No imported fonts yet',
        fontSize: 'Font size',
        fontImport: 'Font URL or @import',
        fontHelp: 'Paste a ZeoSeven result.css URL, or a full @import CSS snippet, then click Import font. When recognized, the font name is filled in and the image refreshes.',
        findFonts: 'Find free commercial fonts',
        background: 'Background',
        display: 'Display',
        characterName: 'Character name',
        date: 'Date',
        importFont: 'Import font',
        importLocalFont: 'Import local font',
        redrawPreview: 'Refresh preview',
        exportPng: 'Export PNG',
        noShareCardToExport: 'There is no share card to export.',
        shareCardExportFailed: 'Could not generate the image.',
        shareCardExported: 'Share card exported.',
        filtersAll: 'All',
        filtersCharacters: 'Characters',
        filtersUserInput: 'User input',
        filtersExcerpt: 'Excerpts',
        hintAllNotes: 'all notes',
        hintByCard: 'by card',
        hintYourWords: 'your words',
        hintSelectedText: 'selected text',
        userInput: 'User input',
        excerpt: 'Excerpt',
        manual: 'Manual',
        unnamedCharacter: 'Unnamed character',
        noNotes: 'No notes yet',
        noCharacterNotes: 'No character notes yet',
        currentCharacter: 'Current character',
        priority: 'Pinned first',
        browseByCharacter: 'Browse by character',
        characterCount: '{count} characters',
        viewingCharacter: 'Viewing notes for this character',
        backCharacters: 'Back to characters',
        fillInput: 'Input',
        copy: 'Copy',
        share: 'Share',
        delete: 'Delete',
        viewFull: 'View full note',
        edit: 'Edit',
        editNote: 'Edit note',
        noteContent: 'Note text',
        noteContentRequired: 'Note text cannot be empty.',
        tags: 'Tags',
        allTags: 'All tags',
        clearTagFilter: 'Clear filter',
        tagLibrary: 'All tags',
        tagLibraryIntro: 'Search and browse every tag. Select one to view its notes.',
        tagShelfEmpty: 'No tags yet. Edit any note to add one',
        tagEmptyTitle: 'Create your first tag',
        tagEmptyIntro: 'Tags bring related notes from different characters and chats together.',
        tagEmptyStepEdit: 'Open any note and select Edit',
        tagEmptyStepAdd: 'Enter a tag; use commas to add more than one',
        tagEmptyStepSave: 'Save the note and the tag will appear here',
        backToNotes: 'Back to notes',
        deleteTag: 'Delete tag',
        confirmDeleteTag: 'Delete the tag "{tag}"?\n\nIt will be removed from {count} notes. No notes will be deleted.',
        tagDeleted: 'Removed "{tag}" from {count} notes.',
        searchTags: 'Search tags…',
        sortByCount: 'Most used',
        sortByName: 'Name',
        noMatchingTags: 'No matching tags.',
        tagSuggestions: 'Existing tag suggestions',
        tagsPlaceholder: 'e.g. favorite, plot, review later',
        tagsHelp: 'Press Enter or comma to add. Select × to remove a tag. Up to 20 tags.',
        filterByTag: 'Filter by tag: {tag}',
        saveChanges: 'Save changes',
        noteUpdated: 'Note updated.',
        captured: 'Selected text captured.',
        copied: 'Copied.',
        filled: 'Moved to input box.',
        deleted: 'Deleted.',
        selectTextFirst: 'Select some chat text first, then click Capture selected.',
        noInput: 'Input box not found.',
        shownCharacters: 'Showing {count} characters',
        shownNotes: 'Showing {shown}; {total} in current filter',
        connected: 'Connected: {user}, V{version}, about {count} total notes',
        updateAvailableTitle: 'Tavern Notes Lite update available',
        updateAvailable: 'Version {version} is available. Update Tavern Notes Lite in the SillyTavern extensions panel.',
        updateCenter: 'Version & updates', updateCenterIntro: 'View the installed version, latest version, and release notes. You decide whether to update.', checkUpdates: 'Check for updates', checkingUpdates: 'Checking…', installedVersion: 'Installed', latestVersion: 'Latest', updateAvailableStatus: 'Version {version} is available', upToDateStatus: 'You are up to date', updateCheckFailed: 'Could not reach the update server', openExtensionManager: 'Open extension manager', openRepository: 'Open project page', updateInstructions: 'Updates are performed by the SillyTavern extension manager. Tavern Notes Lite never installs silently or overwrites files on its own.', changelogTitle: 'Release notes', latestBadge: 'Latest', noChangelog: 'Release notes are not available right now.', viewUpdate: 'View update', authorAnnotation: 'Author’s Chinese notes',
        openNotes: 'Open Tavern Notes Lite',
        captureSelected: 'Capture selected',
        captureSelectedTitle: 'Capture selected chat text',
        captureFloor: 'Capture floor',
        captureFloorTitle: 'Capture this whole message',
        captureFloorEmpty: 'No message text found in this floor.',
        floorCaptureEntry: 'Floor capture',
        floorCaptureEntryTitle: 'Enable or configure whole-message floor capture',
        floorCaptureSettingsTitle: 'Floor capture settings',
        floorCaptureSettingsIntro: 'This adds a Capture floor button to each message. Normal chats need no setup; just turn it on.',
        floorCaptureStepsTitle: 'How to use',
        floorCaptureSteps: '1. Turn on floor capture.\n2. Return to the chat.\n3. Click Capture floor on the message you want to save.',
        floorCaptureContentTitle: 'If a message has summaries, status text, or decorative code',
        floorCaptureContentHelp: 'If one message contains body text plus summaries, status rows, buttons, or code blocks, ask the template author to wrap the real body text in a content tag. Tavern Notes Lite will capture that first.',
        floorCaptureTroubleTitle: 'If the capture is wrong',
        floorCaptureTroubleHelp: 'Check what wraps the body text. For <story>text</story>, enter story in Advanced settings. For <div class="story">text</div>, enter .story. Then try Capture floor again.',
        floorCaptureButton: 'Enable floor capture',
        floorCaptureButtonTitle: 'Enable the Capture floor button on each message',
        floorCaptureButtonOn: 'Floor capture buttons are on.',
        floorCaptureButtonOff: 'Floor capture buttons are off.',
        floorCaptureSelectorLabel: 'Body tag name',
        floorCaptureSelectorPlaceholder: 'content',
        floorCaptureSelectorHelp: 'Enter only the tag name, without angle brackets. If the body is in <story>text</story>, enter story.',
        floorCaptureSelectorSaved: 'Body tag saved.',
        floorCaptureSelectorCurrentDefault: 'Currently captures <content> first.',
        floorCaptureSelectorCurrentCustom: 'Currently captures <{tag}> first.',
        floorCaptureExampleTitle: 'Recommended markup',
        floorCaptureExample: '<content>Write the body text to capture here.</content>',
        floorCaptureAdvanced: 'Change body tag',
        excludeTagsTitle: 'Excluded tags', excludeTagsHelp: 'When these tags occur inside the body, the tags and everything inside them are removed. For example, thinking removes <thinking>…</thinking>.', excludeTagPlaceholder: 'thinking, status', addExcludedTag: 'Add excluded tag', removeExcludedTag: 'Remove excluded tag', noExcludedTags: 'No excluded tags yet', invalidExcludedTag: 'Enter a valid tag name, such as thinking.', excludedTagsSaved: 'Excluded tags saved.',
        launcherMode: 'Launcher',
        toolbarButtons: 'Toolbar',
        floatingBall: 'Floating ball',
        switchLauncherMode: 'Switch Tavern Notes Lite launcher mode',
        toolbarLauncherShown: 'Switched to toolbar launcher.',
        floatingLauncherShown: 'Switched to floating launcher.',
        autoCaptureUserInput: 'Record input',
        autoCaptureUserInputTitle: 'Automatically record sent User inputs',
        autoCaptureUserInputOn: 'Automatic User input recording is on.',
        autoCaptureUserInputOff: 'Automatic User input recording is off.',
        newNote: 'New note', captureTools: 'Capture tools', more: 'More', inspirationTag: 'Inspiration', newNoteUserHelp: 'This note will belong to the current USER and include the Inspiration tag.', newNoteSaved: 'Inspiration note saved.', noteContentRequired: 'Enter note content first.', saveNote: 'Save note', renameTag: 'Rename tag', renameTagPrompt: 'Rename “{tag}” to:', tagRenamed: 'Renamed “{oldTag}” to “{newTag}” on {count} notes.', resetFloatingPosition: 'Reset floating ball position',
        userInputCleanup: 'Input cleanup', userInputCleanupTitle: 'Repeated inputs and ignore rules', userInputCleanupIntro: 'Consecutive identical inputs are collapsed. Add one fixed command per line to skip it.', collapseRepeatedInput: 'Collapse consecutive repeats', collapseRepeatedHelp: 'Keep one note and show its accumulated repeat count.', ignoreExactLabel: 'Ignore exact matches', ignoreExactPlaceholder: 'One per line, e.g. continue', ignorePrefixLabel: 'Ignore these prefixes', ignorePrefixPlaceholder: 'One per line, e.g. /qr', saveInputRules: 'Save rules', inputRulesSaved: 'Input cleanup rules saved.', scanDuplicates: 'Scan old duplicates', scanNoDuplicates: 'No consecutive duplicate inputs found.', scanPreview: 'Found {groups} groups with {duplicateNotes} duplicate inputs to merge.', cleanupConfirm: 'Clean them up now? Exporting a backup first is recommended.', cleanupDone: 'Merged {duplicateNotes} historical duplicate inputs.', repeatedTimes: 'Repeated {count} times',
        addInputRules: 'Add rules', filterInputRules: 'Search rules', noInputRules: 'No rules yet', clearHistoryDuplicates: 'Clear historical duplicates', dedupeOccurrences: '{count} entries; {duplicates} will be removed', confirmCleanup: 'Confirm cleanup', cancelCleanup: 'Cancel',
        selectionCaptureButton: 'Selection button',
        selectionCaptureButtonTitle: 'Show a floating capture button after selecting text',
        selectionCaptureButtonOn: 'Floating selection capture button is on.',
        selectionCaptureButtonOff: 'Floating selection capture button is off.',
        noNotesHintNoUserInput: 'Select chat text, then click Capture selected to save an excerpt.',
        noCharacterNotesHintNoUserInput: 'Captured excerpts will be grouped by character here.',
        fromTavernNotes: 'From Tavern Notes Lite',
        brandForShare: 'Tavern Notes Lite',
        excerptedAt: 'excerpted on',
        openThemePanel: 'Open the theme panel to switch, import, export, or edit Tavern Notes Lite themes',
        close: 'Close',
        closeThemePanel: 'Close theme panel',
        switchTheme: 'Switch theme',
        importTheme: 'Import theme',
        exportCurrentTheme: 'Export current theme',
        openThemeFolder: 'Open theme folder',
        deleteTheme: 'Delete theme',
        builtInThemeCannotDelete: 'Built-in themes cannot be deleted.',
        appleThemeMode: 'Day/Night',
        appleThemeModeTitle: 'Toggle Apple Glass day/night theme',
        appleThemeDay: 'Switch to Apple Day',
        appleThemeNight: 'Switch to Apple Night',
        defaultThemeDay: 'Switch to Soft Day',
        defaultThemeNight: 'Switch to Twilight Blue',
        defaultThemeModeTitle: 'Switch the default theme between day and night',
        defaultThemeDayOn: 'Soft Day enabled.',
        defaultThemeNightOn: 'Twilight Blue enabled.',
        appleThemeEnabled: 'Apple Glass theme switched.',
        previewTheme: 'Preview: {name}',
        unnamedTheme: 'Untitled theme',
        previewSave: 'Apply & save',
        themeCalendar: 'Calendar',
        themeJianshu: 'Jianshu',
        themeDialogue: 'Dialogue',
        themeMobai: 'Ink White',
        themeGuideContent: `Theme JSON has two main sections: variables and assets.

variables control colors, radius, fonts, cards, buttons, and note styles.
assets control the header icon and background image; the input-bar and capture buttons use fixed default icons.

`,
        invalidThemeFile: 'This is not a Tavern Notes Lite theme file.',
        previewedTheme: 'Theme previewed. It is not saved yet.',
        mergedThemeDraft: 'Merged theme draft created. The active theme is unchanged. Use Apply & save to switch themes.',
        savedAsTheme: 'Saved as a new theme.',
        savedTheme: 'Theme saved.',
        switchedTheme: 'Theme switched.',
        importedTheme: 'Theme imported and activated.',
        requestedThemeFolder: 'Theme folder open requested. The default theme is built in, so it is not in that folder.',
        defaultThemeCannotDelete: 'The default theme cannot be deleted.',
        confirmDeleteTheme: 'Delete theme "{name}"?',
        deletedTheme: 'Theme deleted.',
        themeNamePrompt: '{action} theme name:',
        themeNameEmpty: 'Theme name cannot be empty.',
        saveAction: 'Save',
        saveAsAction: 'Save as',
        currentTavernTheme: 'Current Tavern theme',
        mergedThemeName: 'Merged Tavern theme - {name}',
        confirmDeleteNote: 'Delete this note?\n\n{preview}{ellipsis}',
        pasteFontFirst: 'Paste a font URL or @import code first.',
        importedFont: 'Imported font: {name}',
        importedFontCode: 'Font code imported. Please check the font name.',
        localFontImported: 'Imported local font: {name}',
        localFontSessionOnly: 'This font file is large, so it was imported for this page only. Choose it again next time.',
        localFontUnsupported: 'This browser does not support local font import.',
        savedFontMissing: 'This font has no readable data. Please import it again.',
        subtitle: 'soft notes · character memory', noNotesHint: 'Select chat text, then click Capture selected to save an excerpt.', noCharacterNotesHint: 'Choose another character or return to character browsing.', otherCharactersEmpty: 'No other character notes.',
    },
    ko: {
        ...TEXT_ZH_CN,
        autoLanguage: '술집 언어 따르기',
        language: '언어',
        languageSaved: '언어가 저장되었습니다. 페이지를 새로고침하면 적용됩니다.',
        appName: '술집 노트 Lite',
        theme: '테마',
        exportNotes: '노트 내보내기',
        closeNotes: '술집 노트 닫기',
        searchPlaceholder: '노트, 캐릭터, 채팅, 태그 검색...',
        connecting: '술집 노트에 연결 중...',
        prevPage: '이전 페이지',
        nextPage: '다음 페이지',
        jumpPage: '이동',
        exportScope: '내보내기 범위',
        allNotes: '전체 노트',
        currentPage: '현재 페이지',
        exportHint: '현재 페이지는 지금 목록에 보이는 노트만 내보냅니다.',
        exportNotes: '노트 가져오기 / 내보내기',
        exportJson: '다시 가져올 수 있는 JSON 노트 파일',
        exportTxt: '순수 TXT 파일',
        importJson: 'JSON 노트 가져오기',
        liteFullInfoTitle: 'Lite와 Full 버전',
        liteFullJsonCompatibility: 'Lite에서 내보낸 JSON 노트는 Full로 바로 가져올 수 있으며, Full의 JSON도 Lite로 가져올 수 있습니다.',
        liteLimitations: 'Lite는 서버 플러그인 없이 현재 브라우저에만 노트를 저장합니다. 브라우저나 기기 간 자동 공유는 되지 않으며, 사이트 데이터를 지우면 노트가 삭제될 수 있으니 JSON을 정기적으로 백업하세요.',
        fullAdvantages: 'Full은 서버 플러그인이 필요하며 로컬 파일 저장, 매일 자동 백업, 여러 기기에서 같은 데이터 사용을 제공합니다.',
        importDone: '가져오기 완료: {imported}개 추가, 중복 또는 빈 노트 {skipped}개 건너뜀.',
        invalidBackup: '가져올 수 없습니다. Tavern Notes에서 내보낸 JSON 백업을 선택하세요.',
        noPageNotesToExport: '현재 페이지에 내보낼 노트가 없습니다.',
        exportStarted: '내보내기를 시작했습니다.',
        liteStorageStatus: '브라우저 로컬 저장소 · {size} · {count}개',
        liteBackupReminder: 'Lite가 약 {size}를 사용 중이거나 30일 동안 JSON 백업이 없습니다. 지금 백업을 내보내세요.',
        themeFiles: '테마 파일',
        currentTheme: '현재: {name}',
        themeName: '테마 이름',
        mergeTheme: '현재 술집 테마 병합',
        themeGuide: '테마 제작 설명',
        preview: '미리보기',
        save: '저장',
        saveAs: '다른 이름으로 저장',
        resetDefault: '기본값 복원',
        shareCard: '공유 카드',
        font: '글꼴',
        savedFonts: '가져온 글꼴',
        savedFontsPlaceholder: '가져온 글꼴 선택',
        noSavedFonts: '아직 가져온 글꼴이 없습니다',
        fontSize: '글자 크기',
        fontImport: '글꼴 주소 또는 @import',
        fontHelp: 'ZeoSeven result.css 주소나 전체 @import CSS를 붙여 넣은 뒤 글꼴 가져오기를 누르세요. 인식되면 글꼴 이름이 자동으로 채워지고 이미지가 새로고침됩니다.',
        findFonts: '무료 상업용 글꼴 찾기',
        background: '배경',
        display: '표시',
        characterName: '캐릭터 이름',
        date: '날짜',
        importFont: '글꼴 가져오기',
        importLocalFont: '로컬 글꼴 가져오기',
        redrawPreview: '미리보기 새로고침',
        exportPng: 'PNG 내보내기',
        noShareCardToExport: '내보낼 공유 카드가 없습니다.',
        shareCardExportFailed: '이미지 생성에 실패했습니다.',
        shareCardExported: '공유 카드를 내보냈습니다.',
        filtersAll: '전체',
        filtersCharacters: '캐릭터',
        filtersUserInput: 'User 입력',
        filtersExcerpt: '발췌',
        hintAllNotes: '전체 노트',
        hintByCard: '캐릭터별',
        hintYourWords: '내 입력',
        hintSelectedText: '선택한 글',
        userInput: 'User 입력',
        excerpt: '발췌',
        manual: '수동',
        unnamedCharacter: '이름 없는 캐릭터',
        noNotes: '아직 노트가 없습니다',
        noCharacterNotes: '아직 캐릭터 노트가 없습니다',
        currentCharacter: '현재 캐릭터',
        priority: '우선 표시',
        browseByCharacter: '캐릭터별 보기',
        characterCount: '캐릭터 {count}명',
        viewingCharacter: '이 캐릭터의 노트를 보는 중',
        backCharacters: '캐릭터 목록으로',
        fillInput: '입력',
        copy: '복사',
        share: '공유',
        delete: '삭제',
        viewFull: '전체 보기',
        edit: '편집',
        editNote: '노트 편집',
        noteContent: '노트 본문',
        noteContentRequired: '노트 본문을 비워 둘 수 없습니다.',
        tags: '태그',
        allTags: '모든 태그',
        clearTagFilter: '필터 해제',
        tagLibrary: '모든 태그',
        tagLibraryIntro: '모든 태그를 검색하고 정리할 수 있습니다. 태그를 누르면 해당 노트를 봅니다.',
        tagShelfEmpty: '아직 태그가 없습니다. 노트를 편집해 추가하세요',
        tagEmptyTitle: '첫 태그를 만들어 보세요',
        tagEmptyIntro: '태그로 여러 캐릭터와 채팅의 관련 노트를 한곳에 모을 수 있습니다.',
        tagEmptyStepEdit: '노트 하나를 열고 “편집”을 누릅니다',
        tagEmptyStepAdd: '태그 이름을 입력합니다. 여러 개는 쉼표로 구분합니다',
        tagEmptyStepSave: '저장하면 태그가 여기에 자동으로 표시됩니다',
        backToNotes: '노트 목록으로',
        deleteTag: '태그 삭제',
        confirmDeleteTag: '“{tag}” 태그를 삭제할까요?\n\n{count}개의 노트에서 태그만 제거되며 노트는 삭제되지 않습니다.',
        tagDeleted: '“{tag}” 태그를 {count}개의 노트에서 제거했습니다.',
        searchTags: '태그 검색…',
        sortByCount: '사용 횟수순',
        sortByName: '이름순',
        noMatchingTags: '일치하는 태그가 없습니다.',
        tagSuggestions: '기존 태그 추천',
        tagsPlaceholder: '예: 최애, 줄거리, 나중에 정리',
        tagsHelp: 'Enter 또는 쉼표로 추가하고 ×로 제거합니다. 최대 20개까지 가능합니다.',
        filterByTag: '태그로 보기: {tag}',
        saveChanges: '변경 저장',
        noteUpdated: '노트를 수정했습니다.',
        captured: '선택한 글을 발췌했습니다.',
        copied: '복사했습니다.',
        filled: '입력창에 넣었습니다.',
        deleted: '삭제했습니다.',
        selectTextFirst: '먼저 채팅 글을 선택한 뒤 “선택 발췌”를 누르세요.',
        noInput: '입력창을 찾지 못했습니다.',
        shownCharacters: '캐릭터 {count}명 표시 중',
        shownNotes: '{shown}개 표시 중, 현재 필터 전체 {total}개',
        connected: '연결됨: {user}, V{version}, 전체 약 {count}개',
        updateAvailableTitle: 'Tavern Notes Lite 업데이트 가능',
        updateAvailable: 'v{version} 버전이 있습니다. SillyTavern 확장 패널에서 Tavern Notes Lite를 업데이트하세요.',
        updateCenter: '버전 및 업데이트', updateCenterIntro: '현재 버전, 최신 버전과 변경 사항을 확인합니다. 업데이트 여부는 사용자가 결정합니다.', checkUpdates: '업데이트 확인', checkingUpdates: '확인 중…', installedVersion: '현재 버전', latestVersion: '최신 버전', updateAvailableStatus: '새 버전 v{version} 사용 가능', upToDateStatus: '최신 버전입니다', updateCheckFailed: '업데이트 서버에 연결할 수 없습니다', openExtensionManager: '확장 관리 열기', openRepository: '프로젝트 페이지 열기', updateInstructions: '업데이트는 SillyTavern 확장 관리자가 수행합니다. Tavern Notes Lite는 자동으로 설치하거나 파일을 덮어쓰지 않습니다.', changelogTitle: '업데이트 기록', latestBadge: '최신', noChangelog: '현재 업데이트 기록을 가져올 수 없습니다.', viewUpdate: '업데이트 보기', authorAnnotation: '작성자 중국어 주석',
        openNotes: '술집 노트 열기',
        captureSelected: '선택 발췌',
        captureSelectedTitle: '선택한 채팅 글 발췌',
        captureFloor: '전체 발췌',
        captureFloorTitle: '이 메시지 전체를 발췌',
        captureFloorEmpty: '이 메시지의 본문을 찾지 못했습니다.',
        floorCaptureEntry: '전체 발췌',
        floorCaptureEntryTitle: '전체 메시지 발췌 기능 켜기 및 설정',
        floorCaptureSettingsTitle: '전체 발췌 설정',
        floorCaptureSettingsIntro: '각 메시지에 전체 발췌 버튼을 추가합니다. 일반 채팅은 설정 없이 켜기만 하면 됩니다.',
        floorCaptureStepsTitle: '사용 방법',
        floorCaptureSteps: '1. 전체 발췌 기능을 켭니다.\n2. 채팅으로 돌아갑니다.\n3. 저장할 메시지의 전체 발췌 버튼을 누릅니다.',
        floorCaptureContentTitle: '본문 태그 이름이란?',
        floorCaptureContentHelp: '한 메시지에 요약, 상태 줄, 버튼, 코드 블록이 있으면 실제 본문을 하나의 태그로 감싸 달라고 템플릿 작성자에게 요청하세요. 예: <content>본문</content>이면 태그 이름은 content입니다.',
        floorCaptureTroubleTitle: '발췌 결과가 이상할 때',
        floorCaptureTroubleHelp: '템플릿 작성자에게 본문을 감싼 태그 이름을 물어보세요. 그 태그 이름을 “본문 태그 변경”에 입력합니다. 예: <story>본문</story>이면 story를 입력하고 저장한 뒤 다시 전체 발췌를 누릅니다.',
        floorCaptureButton: '전체 발췌 기능 켜기',
        floorCaptureButtonTitle: '각 메시지의 전체 발췌 버튼 켜기',
        floorCaptureButtonOn: '전체 발췌 버튼을 켰습니다.',
        floorCaptureButtonOff: '전체 발췌 버튼을 껐습니다.',
        floorCaptureSelectorLabel: '본문 태그 이름',
        floorCaptureSelectorPlaceholder: 'content',
        floorCaptureSelectorHelp: '꺾쇠괄호 없이 태그 이름만 입력하세요. 본문이 <story>본문</story> 안에 있으면 story를 입력합니다.',
        floorCaptureSelectorSaved: '본문 태그를 저장했습니다.',
        floorCaptureSelectorCurrentDefault: '현재 <content> 태그를 우선 발췌합니다.',
        floorCaptureSelectorCurrentCustom: '현재 <{tag}> 태그를 우선 발췌합니다.',
        floorCaptureExampleTitle: '권장 형식',
        floorCaptureExample: '<content>발췌할 실제 본문을 여기에 씁니다.</content>',
        floorCaptureAdvanced: '본문 태그 변경',
        excludeTagsTitle: '제외 태그', excludeTagsHelp: '본문 안에 이 태그가 있으면 태그와 내부 내용을 모두 삭제한 뒤 발췌합니다. 예: thinking은 <thinking>…</thinking>을 삭제합니다.', excludeTagPlaceholder: 'thinking, status', addExcludedTag: '제외 태그 추가', removeExcludedTag: '제외 태그 삭제', noExcludedTags: '설정된 제외 태그 없음', invalidExcludedTag: 'thinking과 같은 올바른 태그 이름을 입력하세요.', excludedTagsSaved: '제외 태그가 저장되었습니다.',
        launcherMode: '실행 버튼',
        toolbarButtons: '도구막대',
        floatingBall: '플로팅 버튼',
        switchLauncherMode: '술집 노트 실행 방식 전환',
        toolbarLauncherShown: '도구막대 실행 버튼으로 전환했습니다.',
        floatingLauncherShown: '플로팅 버튼으로 전환했습니다.',
        autoCaptureUserInput: '입력 기록',
        autoCaptureUserInputTitle: '보낸 User 입력을 자동 기록',
        autoCaptureUserInputOn: 'User 입력 자동 기록을 켰습니다.',
        autoCaptureUserInputOff: 'User 입력 자동 기록을 껐습니다.',
        newNote: '새 노트', captureTools: '발췌 도구', more: '더보기', inspirationTag: '영감 노트', newNoteUserHelp: '현재 USER에 저장되며 영감 노트 태그가 자동으로 추가됩니다.', newNoteSaved: '영감 노트를 저장했습니다.', noteContentRequired: '노트 내용을 입력하세요.', saveNote: '노트 저장', renameTag: '태그 이름 변경', renameTagPrompt: '“{tag}” 태그의 새 이름:', tagRenamed: '“{oldTag}”을 “{newTag}”으로 변경하고 {count}개 노트를 업데이트했습니다.', resetFloatingPosition: '플로팅 버튼 위치 초기화',
        noNotesHintNoUserInput: '채팅 글을 선택한 뒤 “선택 발췌”를 눌러 발췌를 저장하세요.',
        noCharacterNotesHintNoUserInput: '발췌한 채팅 글은 캐릭터별로 여기에 정리됩니다.',
        fromTavernNotes: '술집 노트에서',
        brandForShare: '술집 노트',
        excerptedAt: '발췌일',
        openThemePanel: '테마 패널 열기: 술집 노트 테마를 전환, 가져오기, 내보내기, 편집합니다',
        close: '닫기',
        closeThemePanel: '테마 패널 닫기',
        switchTheme: '테마 전환',
        importTheme: '테마 가져오기',
        exportCurrentTheme: '현재 테마 내보내기',
        openThemeFolder: '테마 폴더 열기',
        deleteTheme: '테마 삭제',
        previewTheme: '미리보기: {name}',
        unnamedTheme: '이름 없는 테마',
        previewSave: '적용 및 저장',
        themeCalendar: '캘린더',
        themeJianshu: '젠슈',
        themeDialogue: '대화',
        themeMobai: '묵백',
        themeGuideContent: `테마 JSON은 variables와 assets 두 부분으로 구성됩니다.

variables는 색상, 둥근 모서리, 글꼴, 카드, 버튼, 노트 스타일을 제어합니다.
assets는 제목 아이콘과 배경 이미지를 제어합니다. 입력창과 발췌 버튼은 고정 기본 아이콘을 사용합니다.

`,
        invalidThemeFile: '술집 노트 테마 파일이 아닙니다.',
        previewedTheme: '테마를 미리보았습니다. 아직 저장되지 않았습니다.',
        mergedThemeDraft: '병합 테마 초안을 만들었습니다. 현재 테마는 변경되지 않았습니다. 적용 및 저장을 눌러 테마를 전환하세요.',
        savedAsTheme: '새 테마로 저장했습니다.',
        savedTheme: '테마를 저장했습니다.',
        switchedTheme: '테마를 전환했습니다.',
        importedTheme: '테마를 가져오고 적용했습니다.',
        requestedThemeFolder: '테마 폴더 열기를 요청했습니다. 기본 테마는 내장되어 있어 이 폴더에 없습니다.',
        defaultThemeCannotDelete: '기본 테마는 삭제할 수 없습니다.',
        confirmDeleteTheme: '"{name}" 테마를 삭제할까요?',
        deletedTheme: '테마를 삭제했습니다.',
        themeNamePrompt: '{action} 테마 이름:',
        themeNameEmpty: '테마 이름은 비워둘 수 없습니다.',
        saveAction: '저장',
        saveAsAction: '다른 이름으로 저장',
        currentTavernTheme: '현재 술집 테마',
        mergedThemeName: '병합한 술집 테마 - {name}',
        confirmDeleteNote: '이 노트를 삭제할까요?\n\n{preview}{ellipsis}',
        pasteFontFirst: '먼저 글꼴 주소나 @import 코드를 붙여 넣으세요.',
        importedFont: '글꼴을 가져왔습니다: {name}',
        importedFontCode: '글꼴 코드를 가져왔습니다. 글꼴 이름을 확인하세요.',
        localFontImported: '로컬 글꼴을 가져왔습니다: {name}',
        localFontSessionOnly: '글꼴 파일이 커서 이 페이지에서만 임시로 가져왔습니다. 다음에는 파일을 다시 선택해야 합니다.',
        localFontUnsupported: '현재 브라우저는 로컬 글꼴 가져오기를 지원하지 않습니다.',
        savedFontMissing: '이 글꼴에는 읽을 수 있는 데이터가 없습니다. 다시 가져오세요.',
        subtitle: '부드러운 노트 · 캐릭터 메모리', noNotesHint: '채팅 글을 선택한 뒤 선택 발췌를 눌러 저장하세요.', noCharacterNotesHint: '다른 캐릭터를 선택하거나 캐릭터 탐색으로 돌아가세요.', otherCharactersEmpty: '다른 캐릭터 노트가 없습니다.', userInputCleanup: '입력 정리', addInputRules: '입력 규칙 추가',
        userInputCleanupTitle: 'User 입력 정리', userInputCleanupIntro: '반복 입력을 묶어 표시하고, 자동 저장에서 제외할 정확한 문구와 접두사를 설정합니다.', collapseRepeatedInput: '반복 입력 묶기', collapseRepeatedHelp: '같은 채팅에서 내용이 같은 User 입력을 하나의 카드로 묶습니다.', ignoreExactLabel: '정확히 일치하면 제외', ignoreExactPlaceholder: '한 줄에 하나씩 입력', ignorePrefixLabel: '이 접두사로 시작하면 제외', ignorePrefixPlaceholder: '한 줄에 하나씩 입력', saveInputRules: '입력 규칙 저장', inputRulesSaved: '입력 규칙을 저장했습니다.', scanDuplicates: '기존 중복 항목 검사', scanNoDuplicates: '정리할 기존 중복 입력이 없습니다.', scanPreview: '중복 정리 미리보기', cleanupConfirm: '선택한 중복 항목 정리', cleanupDone: '{count}개의 중복 입력을 정리했습니다.', repeatedTimes: '{count}회 반복', filterInputRules: '입력 규칙 검색', noInputRules: '설정된 규칙 없음', clearHistoryDuplicates: '기존 중복 정리', dedupeOccurrences: '{count}개 항목', confirmCleanup: '정리 확인', cancelCleanup: '취소',
        selectionCaptureButton: '선택 영역 버튼', selectionCaptureButtonTitle: '글을 선택하면 플로팅 발췌 버튼 표시', selectionCaptureButtonOn: '선택 영역 플로팅 발췌 버튼을 켰습니다.', selectionCaptureButtonOff: '선택 영역 플로팅 발췌 버튼을 껐습니다.', builtInThemeCannotDelete: '내장 테마는 삭제할 수 없습니다.', appleThemeMode: 'Apple Glass 모드', appleThemeModeTitle: 'Apple Glass의 낮/밤 모드 전환', appleThemeDay: '낮 모드', appleThemeNight: '밤 모드', defaultThemeDay: '기본 낮 모드', defaultThemeNight: '기본 밤 모드', defaultThemeModeTitle: '기본 테마의 낮/밤 모드 전환', defaultThemeDayOn: '기본 테마 낮 모드를 적용했습니다.', defaultThemeNightOn: '기본 테마 밤 모드를 적용했습니다.', appleThemeEnabled: 'Apple Glass 테마를 적용했습니다.',
    },
};

function normalizeLanguage(value) {
    const language = String(value || '').toLowerCase();
    if (language.startsWith('zh-tw') || language.startsWith('zh-hk') || language.startsWith('zh-hant')) return 'zh-TW';
    if (language.startsWith('zh')) return 'zh-CN';
    if (language.startsWith('ko')) return 'ko';
    if (language.startsWith('en')) return 'en';
    return 'zh-CN';
}

function getActiveLanguage() {
    const language = state.language === 'auto'
        ? (localStorage.getItem('language') || navigator.language)
        : state.language;
    return normalizeLanguage(language);
}

function t(key, values = {}) {
    const table = TEXTS[getActiveLanguage()] || TEXT_ZH_CN;
    return String(table[key] ?? TEXT_ZH_CN[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
}

const DEFAULT_THEME = {
    format: 'tavern-notes-theme',
    version: 1,
    name: 'Soft Neomorphism',
    author: 'Tavern Notes Lite',
    variables: {
        '--tnl-theme-flavor': 'default',
        // 基础颜色：面板纸色、文字色、弱化文字、边框、强调色。
        '--tnl-paper': '#eeede9',
        '--tnl-paper-2': '#fbfaf6',
        '--tnl-ink': '#44423e',
        '--tnl-muted': '#8f8b82',
        '--tnl-line': 'rgba(188, 183, 171, 0.34)',
        '--tnl-gold': '#f4b51f',
        '--tnl-gold-2': '#ffd45f',
        // 全局形状与阴影：面板半径、卡片半径、字体和外层投影。
        '--tnl-shadow-dark': 'rgba(111, 105, 94, 0.18)',
        '--tnl-shadow-light': 'rgba(255, 255, 255, 0.52)',
        '--tnl-radius-panel': '28px',
        '--tnl-radius-card': '24px',
        '--tnl-font-family': 'var(--mainFontFamily, inherit)',
        '--tnl-panel-border': 'rgba(188, 183, 171, 0.42)',
        '--tnl-panel-shadow': '0 18px 48px rgba(74, 68, 58, 0.18), 0 1px 0 rgba(255, 255, 255, 0.62)',
        // 控件与卡片：搜索框、筛选卡、按钮、弹层背景。
        '--tnl-control-bg': 'linear-gradient(145deg, #fffdf7 0%, #e4e1d8 100%)',
        '--tnl-control-bg-hover': 'linear-gradient(145deg, rgba(255, 216, 82, 0.48), rgba(255, 254, 248, 0.98)), linear-gradient(145deg, #fffdf7, #e4e1d8)',
        '--tnl-control-inset-bg': 'linear-gradient(145deg, #dedbd2 0%, #fffdf8 100%)',
        '--tnl-control-inset-shadow': 'inset 0 0 0 1px rgba(151, 145, 132, 0.16)',
        '--tnl-card-bg': 'linear-gradient(145deg, #fffdf7 0%, #e5e2d9 100%)',
        '--tnl-card-bg-active': 'radial-gradient(circle at 18% 22%, rgba(255, 212, 74, 0.58), transparent 32%), linear-gradient(145deg, #fffdf7 0%, #e5e2d9 100%)',
        '--tnl-card-active-shadow': '0 0 0 1px rgba(216, 148, 0, 0.22), 0 5px 14px rgba(106, 99, 87, 0.12)',
        '--tnl-icon-bg': 'linear-gradient(145deg, #fffef9 0%, #ddd9cf 100%)',
        '--tnl-action-bg': 'linear-gradient(145deg, rgba(255, 253, 247, 0.98), rgba(230, 226, 217, 0.96))',
        '--tnl-overlay-bg': 'rgba(238, 236, 229, 0.84)',
        '--tnl-fade-bg': 'linear-gradient(90deg, rgba(251, 250, 246, 0), rgba(251, 250, 246, 0.88) 34%, rgba(251, 250, 246, 0.98))',
        '--tnl-card-image': 'linear-gradient(transparent, transparent)',
        // 文本语义：斜体、下划线、引用色和文本阴影。
        '--tnl-em': '#8d8a82',
        '--tnl-underline': '#d7a018',
        '--tnl-quote': '#d89400',
        '--tnl-text-shadow': 'transparent',
        // 滚动条与小按钮：分页、主题按钮、笔记操作按钮共用。
        '--tnl-panel-glow': 'rgba(255, 215, 91, 0.08)',
        '--tnl-scrollbar-thumb': '#f4b51f',
        '--tnl-scrollbar-track': 'rgba(244, 181, 31, 0.13)',
        '--tnl-mini-button-bg': 'linear-gradient(145deg, #fffef9, #e4e1da)',
        '--tnl-mini-button-shadow': '0 3px 8px rgba(106, 99, 87, 0.14)',
        '--tnl-mini-button-hover-bg': 'linear-gradient(145deg, rgba(255, 218, 94, 0.45), #fffef9)',
        '--tnl-mini-button-hover-shadow': '0 5px 12px rgba(106, 99, 87, 0.18)',
        '--tnl-filter-hover-shadow': '0 7px 18px rgba(106, 99, 87, 0.16)',
        '--tnl-filter-icon-border': 'rgba(188, 183, 171, 0.34)',
        '--tnl-filter-icon-shadow': '0 3px 9px rgba(106, 99, 87, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.48)',
        '--tnl-inline-action-bg': 'rgba(255, 253, 247, 0.42)',
        '--tnl-inline-action-hover-bg': 'rgba(255, 229, 138, 0.24)',
        '--tnl-inline-action-shadow': '0 2px 6px rgba(106, 99, 87, 0.1)',
        '--tnl-inline-action-hover-shadow': 'inset 3px 3px 7px rgba(151, 145, 132, 0.14), inset -3px -3px 7px rgba(255, 255, 255, 0.78)',
        '--tnl-inline-icon-bg': 'linear-gradient(145deg, #fffdf8, #dedbd3)',
        '--tnl-inline-icon-hover-bg': 'linear-gradient(145deg, #fff7d9, #fffefa)',
        '--tnl-inline-icon-shadow': '0 2px 5px rgba(106, 99, 87, 0.12)',
        // 笔记卡片：卡片背景、类型标签、User 输入/摘抄的区分色。
        '--tnl-note-bg': 'var(--tnl-card-image), var(--tnl-card-bg)',
        '--tnl-note-border': '1px solid rgba(188, 183, 171, 0.44)',
        '--tnl-note-shadow': '0 8px 22px rgba(106, 99, 87, 0.14)',
        '--tnl-note-type-bg': 'linear-gradient(145deg, rgba(255, 225, 127, 0.7), rgba(255, 248, 224, 0.78))',
        '--tnl-note-type-color': '#805d05',
        '--tnl-note-type-user-bg': 'linear-gradient(145deg, rgba(255, 225, 127, 0.7), rgba(255, 248, 224, 0.78))',
        '--tnl-note-type-user-color': '#805d05',
        '--tnl-note-type-excerpt-bg': 'linear-gradient(145deg, rgba(210, 217, 228, 0.72), rgba(250, 250, 247, 0.86))',
        '--tnl-note-type-excerpt-color': '#62676f',
        '--tnl-note-accent-user': 'var(--tnl-gold)',
        '--tnl-note-accent-excerpt': 'var(--tnl-muted)',
        '--tnl-note-padding': '20px 22px 18px',
        '--tnl-note-topline-bg': 'transparent',
        '--tnl-note-topline-border': '0',
        '--tnl-note-topline-padding': '0',
        '--tnl-note-topline-radius': '0',
        '--tnl-note-topline-margin': '0 0 12px 18px',
        '--tnl-note-dot-display': 'block',
        '--tnl-filter-shadow': '0 5px 15px rgba(106, 99, 87, 0.12)',
        '--tnl-control-shadow': '0 4px 12px rgba(106, 99, 87, 0.12)',
        '--tnl-inset-light': 'rgba(255, 255, 255, 0.5)',
    },
    assets: {
        brandIcon: 'fa-book-open',
        openIcon: 'fa-book-open',
        captureIcon: 'fa-highlighter',
        backgroundImage: '',
        buttonImage: '',
    },
};

const DEFAULT_NIGHT_VARIABLES = {
    '--tnl-paper': '#202832', '--tnl-paper-2': '#26313d', '--tnl-ink': '#edf1f2', '--tnl-muted': '#9eabb5',
    '--tnl-line': 'rgba(171, 190, 202, 0.22)', '--tnl-gold': '#d7838f', '--tnl-gold-2': '#e8a2aa',
    '--tnl-shadow-dark': 'rgba(6, 11, 17, 0.64)', '--tnl-shadow-light': 'rgba(86, 111, 128, 0.18)',
    '--tnl-panel-border': 'rgba(178, 198, 210, 0.18)',
    '--tnl-control-bg': 'linear-gradient(145deg, #2c3945 0%, #1d252e 100%)',
    '--tnl-control-bg-hover': 'linear-gradient(145deg, rgba(215, 131, 143, 0.25), rgba(43, 56, 68, 0.98))',
    '--tnl-control-inset-bg': 'linear-gradient(145deg, #19212a 0%, #2b3742 100%)',
    '--tnl-control-inset-shadow': 'inset 7px 7px 15px rgba(5, 10, 15, 0.5), inset -7px -7px 15px rgba(91, 116, 132, 0.12)',
    '--tnl-card-bg': 'linear-gradient(145deg, #2b3742 0%, #1d252e 100%)',
    '--tnl-card-bg-active': 'radial-gradient(circle at 18% 22%, rgba(215, 131, 143, 0.28), transparent 34%), linear-gradient(145deg, #303d49 0%, #202933 100%)',
    '--tnl-icon-bg': 'linear-gradient(145deg, #33414d 0%, #202933 100%)',
    '--tnl-action-bg': 'linear-gradient(145deg, rgba(48, 61, 73, 0.98), rgba(28, 36, 44, 0.98))',
    '--tnl-overlay-bg': 'rgba(17, 23, 30, 0.88)',
    '--tnl-fade-bg': 'linear-gradient(90deg, rgba(38, 49, 61, 0), rgba(38, 49, 61, 0.9) 34%, #26313d)',
    '--tnl-em': '#b5c0c8', '--tnl-underline': '#d7838f', '--tnl-quote': '#e8a2aa',
    '--tnl-panel-glow': 'rgba(215, 131, 143, 0.18)', '--tnl-scrollbar-thumb': '#bd6f7b',
    '--tnl-scrollbar-track': 'rgba(215, 131, 143, 0.1)',
    '--tnl-mini-button-bg': 'linear-gradient(145deg, #33414d, #1f2831)',
    '--tnl-mini-button-shadow': 'none',
    '--tnl-mini-button-hover-bg': 'linear-gradient(145deg, #724752, #513640)',
    '--tnl-mini-button-hover-shadow': 'none',
    '--tnl-inline-action-bg': 'rgba(45, 58, 69, 0.55)', '--tnl-inline-action-hover-bg': 'rgba(215, 131, 143, 0.16)',
    '--tnl-inline-action-shadow': 'none', '--tnl-inline-action-hover-shadow': 'none',
    '--tnl-inline-icon-bg': 'linear-gradient(145deg, #34424e, #202933)',
    '--tnl-inline-icon-shadow': 'none', '--tnl-inline-icon-hover-bg': 'rgba(73, 49, 57, 0.72)',
    '--tnl-note-border': '1px solid rgba(178, 198, 210, 0.16)',
    '--tnl-note-shadow': '14px 14px 28px rgba(5, 10, 15, 0.46), -10px -10px 24px rgba(91, 116, 132, 0.09)',
    '--tnl-note-type-bg': 'linear-gradient(145deg, rgba(215, 131, 143, 0.3), rgba(82, 47, 56, 0.46))',
    '--tnl-note-type-color': '#efb5bc',
    '--tnl-note-type-user-bg': 'linear-gradient(145deg, rgba(215, 131, 143, 0.3), rgba(82, 47, 56, 0.46))',
    '--tnl-note-type-user-color': '#efb5bc',
    '--tnl-note-type-excerpt-bg': 'linear-gradient(145deg, rgba(103, 147, 174, 0.34), rgba(37, 57, 70, 0.72))',
    '--tnl-note-type-excerpt-color': '#b9d5e4',
    '--tnl-note-accent-excerpt': '#79a9c4',
    '--tnl-filter-shadow': '12px 12px 24px rgba(5, 10, 15, 0.48), -9px -9px 20px rgba(91, 116, 132, 0.08)',
    '--tnl-control-shadow': '9px 9px 18px rgba(5, 10, 15, 0.48), -7px -7px 16px rgba(91, 116, 132, 0.08)',
    '--tnl-inset-light': 'rgba(112, 139, 156, 0.12)',
};

const FILTERS = [
    { id: 'all', icon: 'fa-layer-group', label: 'filtersAll', hint: 'hintAllNotes' },
    { id: 'characters', icon: 'fa-user', label: 'filtersCharacters', hint: 'hintByCard' },
    { id: 'user_input', icon: 'fa-keyboard', label: 'filtersUserInput', hint: 'hintYourWords' },
    { id: 'excerpt', icon: 'fa-highlighter', label: 'filtersExcerpt', hint: 'hintSelectedText' },
];

const HEADER_ACTION_IDS = [
    'tavern-notes-lite-new-note-open',
    'tavern-notes-lite-selection-capture-setting',
    'tavern-notes-lite-floor-capture-open',
    'tavern-notes-lite-auto-user-input',
    'tavern-notes-lite-user-input-cleanup-open',
    'tavern-notes-lite-export',
    'tavern-notes-lite-update-open',
    'tavern-notes-lite-reset-floating',
    'tavern-notes-lite-apple-mode-main',
];
let headerActionLayoutFrame = 0;

const SHARE_CARD_THEMES = [
    { id: 'calendar', labelKey: 'themeCalendar' },
    { id: 'jianshu', labelKey: 'themeJianshu' },
    { id: 'dialogue', labelKey: 'themeDialogue' },
    { id: 'mobai', labelKey: 'themeMobai' },
];

const SHARE_CARD_BACKGROUNDS = ['#eef7f2', '#f4f0e5', '#fff4ec', '#edf2ff', '#f2e4b8', '#ffffff', '#1f1f1f', '#203b2a', '#182235', '#3a2330'];

const APPLE_GLASS_DAY_VARIABLES = {
    '--tnl-apple-mode': 'day',
    '--tnl-paper': '#f5f5f7',
    '--tnl-paper-2': '#ffffff',
    '--tnl-ink': '#1d1d1f',
    '--tnl-muted': '#6e6e73',
    '--tnl-line': 'rgba(0, 0, 0, 0.09)',
    '--tnl-gold': '#007aff',
    '--tnl-gold-2': '#34c759',
    '--tnl-shadow-dark': 'rgba(0, 0, 0, 0.12)',
    '--tnl-shadow-light': 'rgba(255, 255, 255, 0.72)',
    '--tnl-panel-border': 'rgba(255, 255, 255, 0.72)',
    '--tnl-control-bg': 'rgba(255, 255, 255, 0.64)',
    '--tnl-control-bg-hover': 'rgba(255, 255, 255, 0.88)',
    '--tnl-control-inset-bg': 'rgba(255, 255, 255, 0.72)',
    '--tnl-control-inset-shadow': 'inset 0 0 0 1px rgba(255, 255, 255, 0.78)',
    '--tnl-card-bg': 'rgba(255, 255, 255, 0.58)',
    '--tnl-card-bg-active': 'linear-gradient(135deg, rgba(0, 122, 255, 0.12), rgba(255, 255, 255, 0.84))',
    '--tnl-card-active-shadow': '0 0 0 1px rgba(0, 122, 255, 0.18), 0 16px 36px rgba(0, 0, 0, 0.10)',
    '--tnl-icon-bg': 'rgba(255, 255, 255, 0.74)',
    '--tnl-action-bg': 'rgba(255, 255, 255, 0.68)',
    '--tnl-overlay-bg': 'rgba(245, 245, 247, 0.72)',
    '--tnl-fade-bg': 'linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.78) 34%, rgba(255, 255, 255, 0.96))',
    '--tnl-card-image': 'radial-gradient(circle at 12% 10%, rgba(0, 122, 255, 0.10), transparent 34%), radial-gradient(circle at 88% 4%, rgba(52, 199, 89, 0.10), transparent 30%)',
    '--tnl-em': '#86868b',
    '--tnl-underline': '#007aff',
    '--tnl-quote': '#007aff',
    '--tnl-panel-glow': 'rgba(0, 122, 255, 0.12)',
    '--tnl-scrollbar-thumb': 'rgba(0, 122, 255, 0.48)',
    '--tnl-scrollbar-track': 'rgba(0, 0, 0, 0.05)',
    '--tnl-mini-button-bg': 'rgba(255, 255, 255, 0.68)',
    '--tnl-mini-button-hover-bg': 'rgba(255, 255, 255, 0.92)',
    '--tnl-filter-icon-border': 'rgba(255, 255, 255, 0.82)',
    '--tnl-inline-action-hover-bg': 'rgba(0, 122, 255, 0.08)',
    '--tnl-inline-icon-bg': 'rgba(255, 255, 255, 0.74)',
    '--tnl-inline-icon-hover-bg': 'rgba(0, 122, 255, 0.10)',
    '--tnl-note-border': '1px solid rgba(255, 255, 255, 0.72)',
    '--tnl-note-type-bg': 'rgba(0, 122, 255, 0.10)',
    '--tnl-note-type-color': '#0066cc',
    '--tnl-note-type-user-bg': 'rgba(0, 122, 255, 0.10)',
    '--tnl-note-type-user-color': '#0066cc',
    '--tnl-note-type-excerpt-bg': 'rgba(52, 199, 89, 0.11)',
    '--tnl-note-type-excerpt-color': '#1f7a35',
    '--tnl-note-accent-user': '#007aff',
    '--tnl-note-accent-excerpt': '#34c759',
    '--tnl-inset-light': 'rgba(255, 255, 255, 0.82)',
};

const APPLE_GLASS_NIGHT_VARIABLES = {
    '--tnl-apple-mode': 'night',
    '--tnl-paper': '#16181d',
    '--tnl-paper-2': '#20232b',
    '--tnl-ink': '#f5f5f7',
    '--tnl-muted': '#a1a1a6',
    '--tnl-line': 'rgba(255, 255, 255, 0.14)',
    '--tnl-gold': '#64d2ff',
    '--tnl-gold-2': '#30d158',
    '--tnl-shadow-dark': 'rgba(0, 0, 0, 0.42)',
    '--tnl-shadow-light': 'rgba(255, 255, 255, 0.05)',
    '--tnl-panel-border': 'rgba(255, 255, 255, 0.16)',
    '--tnl-control-bg': 'rgba(255, 255, 255, 0.08)',
    '--tnl-control-bg-hover': 'rgba(255, 255, 255, 0.13)',
    '--tnl-control-inset-bg': 'rgba(255, 255, 255, 0.07)',
    '--tnl-control-inset-shadow': 'inset 0 0 0 1px rgba(255, 255, 255, 0.09)',
    '--tnl-card-bg': 'rgba(255, 255, 255, 0.075)',
    '--tnl-card-bg-active': 'linear-gradient(135deg, rgba(100, 210, 255, 0.20), rgba(255, 255, 255, 0.08))',
    '--tnl-card-active-shadow': '0 0 0 1px rgba(100, 210, 255, 0.26), 0 12px 30px rgba(0, 0, 0, 0.28)',
    '--tnl-icon-bg': 'rgba(255, 255, 255, 0.10)',
    '--tnl-action-bg': 'rgba(255, 255, 255, 0.08)',
    '--tnl-overlay-bg': 'rgba(22, 24, 29, 0.74)',
    '--tnl-fade-bg': 'linear-gradient(90deg, rgba(32, 35, 43, 0), rgba(32, 35, 43, 0.78) 34%, rgba(32, 35, 43, 0.96))',
    '--tnl-card-image': 'radial-gradient(circle at 12% 10%, rgba(100, 210, 255, 0.12), transparent 34%), radial-gradient(circle at 88% 4%, rgba(48, 209, 88, 0.08), transparent 30%)',
    '--tnl-em': '#c7c7cc',
    '--tnl-underline': '#64d2ff',
    '--tnl-quote': '#64d2ff',
    '--tnl-panel-glow': 'rgba(100, 210, 255, 0.18)',
    '--tnl-scrollbar-thumb': 'rgba(100, 210, 255, 0.64)',
    '--tnl-scrollbar-track': 'rgba(255, 255, 255, 0.06)',
    '--tnl-mini-button-bg': 'rgba(255, 255, 255, 0.08)',
    '--tnl-mini-button-hover-bg': 'rgba(255, 255, 255, 0.14)',
    '--tnl-filter-icon-border': 'rgba(255, 255, 255, 0.12)',
    '--tnl-inline-action-hover-bg': 'rgba(255, 255, 255, 0.08)',
    '--tnl-inline-icon-bg': 'rgba(255, 255, 255, 0.10)',
    '--tnl-inline-icon-hover-bg': 'rgba(100, 210, 255, 0.16)',
    '--tnl-note-border': '1px solid rgba(255, 255, 255, 0.12)',
    '--tnl-note-type-bg': 'rgba(100, 210, 255, 0.16)',
    '--tnl-note-type-color': '#9cdcfe',
    '--tnl-note-type-user-bg': 'rgba(100, 210, 255, 0.16)',
    '--tnl-note-type-user-color': '#9cdcfe',
    '--tnl-note-type-excerpt-bg': 'rgba(48, 209, 88, 0.14)',
    '--tnl-note-type-excerpt-color': '#8ee99b',
    '--tnl-note-accent-user': '#64d2ff',
    '--tnl-note-accent-excerpt': '#30d158',
    '--tnl-inset-light': 'rgba(255, 255, 255, 0.10)',
};

const themeModel = createThemeModel({
    defaultTheme: DEFAULT_THEME,
    convertVariables: toLiteThemeVariables,
    variablePrefix: '--tnl-',
    appleThemeId: APPLE_THEME_ID,
    legacyAppleThemeIds: [LEGACY_APPLE_THEME_DAY_ID, LEGACY_APPLE_THEME_NIGHT_ID],
    defaultNightVariables: DEFAULT_NIGHT_VARIABLES,
    appleDayVariables: APPLE_GLASS_DAY_VARIABLES,
    appleNightVariables: APPLE_GLASS_NIGHT_VARIABLES,
});

function getCurrentCharacter() {
    const character = characters?.[this_chid] || {};
    return {
        id: this_chid ?? null,
        name: character.name || '未命名角色',
        avatar: character.avatar || null,
    };
}

function getChatName() {
    return getCurrentChatId?.() || '';
}

function getLiteUserName() {
    return String(name1 || state.currentUserName || 'default-user').trim() || 'default-user';
}

function getLiteBuiltInThemes() {
    return createBuiltInThemeRecords({
        defaultTheme: DEFAULT_THEME,
        appleDayVariables: APPLE_GLASS_DAY_VARIABLES,
        normalizeTheme: themeModel.normalizeTheme,
        variablePrefix: '--tnl-',
        appleThemeId: APPLE_THEME_ID,
        author: 'Tavern Notes Lite',
    });
}

const liteThemeApi = createLocalThemeRepository({
    storage: localStorage,
    themeStorageKey: THEME_STORAGE_KEY,
    activeThemeKey: ACTIVE_THEME_KEY,
    appleThemeId: APPLE_THEME_ID,
    getBuiltInThemes: getLiteBuiltInThemes,
    normalizeTheme: themeModel.normalizeTheme,
    normalizeThemeId: themeModel.normalizeAppleThemeId,
    isRetiredTheme: isRetiredLegacyTheme,
    translate: t,
});

async function api(path, options = {}) {
    return liteApi(path, options, getLiteUserName());
}

const noteRepository = createLiteNoteRepository({
    request: (path, options) => liteApi(path, options, getLiteUserName(), EXTENSION_VERSION),
    getAllNotes: getAllLiteNotes,
    importData: importLiteExport,
    exportData: getLiteExport,
    markExported: markLiteExported,
});
const noteStoreAdapter = {
    getListState: () => appStore.getSlice('noteList'),
    patchListState: patch => appStore.patch('noteList', patch),
    getQueryState: () => appStore.getSlice('noteQuery'),
    replaceQueryState: query => appStore.replace('noteQuery', query),
    getNoteUiState: () => appStore.getSlice('noteUi'),
    patchNoteUiState: patch => appStore.patch('noteUi', patch),
};
const noteListController = createNoteListController({
    repository: noteRepository,
    ...noteStoreAdapter,
    getListOptions: () => {
        const character = getCurrentCharacter();
        return {
            legacy: true,
            currentCharacterId: character.id,
            characterName: state.characterFilter?.name || '',
        };
    },
    onStateChange: () => noteListRenderer.render(),
    onSuccess: () => {
        const directory = state.filter === 'characters' && !state.characterFilter;
        setStatus(directory
            ? t('shownCharacters', { count: state.characters.length })
            : t('shownNotes', { shown: state.notes.length, total: state.totalNotes }));
    },
    onError: error => notify(error.message, 'error'),
});
const noteFilterController = createNoteFilterController({ ...noteStoreAdapter, listController: noteListController, debounceMs: 300 });
const noteMutationController = createNoteMutationController({
    repository: noteRepository,
    listController: noteListController,
    ...noteStoreAdapter,
    onError: error => notify(error.message, 'error'),
});
const noteExportController = createNoteExportController({
    repository: noteRepository,
    listController: noteListController,
    ...noteStoreAdapter,
    prepareVisibleNote: note => prepareNoteForExport(note, {
        getVariants: getNoteVariants,
        getVariantIndex,
        getActiveVariant,
    }),
    download: (...args) => noteTransferView.download(...args),
    getExportOptions: () => ({ user: getLiteUserName() }),
    currentPageEdition: '-lite',
    getCurrentPageMeta: () => ({
        filter: state.filter,
        query: state.query,
        characterFilter: state.characterFilter,
    }),
});
[noteListController, noteFilterController, noteMutationController, noteExportController].forEach(controller => controller.mount());
const tagRepository = createLiteTagRepository({ request: (path, options) => liteApi(path, options, getLiteUserName(), EXTENSION_VERSION) });
const tagController = createTagController({
    repository: tagRepository,
    listController: noteListController,
    getQueryState: () => noteStoreAdapter.getQueryState(),
    replaceQueryState: query => noteStoreAdapter.replaceQueryState(query),
    getRecentTags: () => state.recentTags,
    updateRecentTags: recentTags => updateSettings({ recentTags }),
    confirmRename: oldName => window.prompt(t('renameTagPrompt', { tag: oldName }), oldName),
    confirmDelete: (tag, { count = 0 } = {}) => window.confirm(t('confirmDeleteTag', { tag, count })),
    onQueryChange: tags => { state.tagFilter = tags[0] || ''; },
    notify: (kind, value) => {
        if (kind === 'error') return notify(value.message, 'error');
        if (kind === 'renamed') notify(t('tagRenamed', { oldTag: value.oldName, newTag: value.newName, count: value.affectedNotes }), 'success');
        if (kind === 'deleted') notify(t('tagDeleted', { tag: value.deletedTag, count: value.affectedNotes }), 'success');
        tagView.renderLibrary();
    },
});
tagController.mount();
const maintenanceRepository = createLiteUserInputMaintenanceRepository({ request: (path, options) => liteApi(path, options, getLiteUserName(), EXTENSION_VERSION) });
const readCaptureSelection = createSelectionSnapshotReader({
    ignoredSelector: '#tavern-notes-lite-panel, #tavern-notes-lite-selection-capture, select',
    inputSelector: '#send_textarea, #send_form textarea',
});
const userInputMaintenanceController = createUserInputMaintenanceController({
    repository: maintenanceRepository,
    listController: noteListController,
    notify: (kind, value) => {
        if (kind === 'error') notify(value.message, 'error');
        if (kind === 'applied') notify(t('cleanupDone', { ...value, duplicates: value.removed }), 'success');
    },
});
userInputMaintenanceController.mount();
const captureController = createCaptureController({
    noteMutationController,
    getCaptureSettings: () => ({ automatic: false, selector: state.floorCaptureSelector, excludedTags: state.floorCaptureExcludedTags }),
    getSillyTavernContext: () => ({ character: getCurrentCharacter(), chatId: getChatName() }),
    getSelectionSnapshot: readCaptureSelection,
    getFloorText: messageElement => {
        const messageId = getMessageIdFromElement(messageElement);
        const message = messageId !== null ? chat?.[messageId] : null;
        return {
            content: getMessageTextFromElement(messageElement, message?.mes)
                || htmlToPlainText(stripExcludedTagsFromHtml({ documentRef: document, html: message?.mes, excludedTagNames: state.floorCaptureExcludedTags })).trim(),
            messageId,
            character: getMessageCharacterForCapture(messageId),
        };
    },
    notify: (kind, value) => {
        if (kind === 'captured') notify(t('captured'), 'success');
        else if (kind === 'selection-empty') notify(t('selectTextFirst'));
        else if (kind === 'empty') notify(t('captureFloorEmpty'), 'warning');
        else if (kind === 'error') notify(value.message, 'error');
    },
});
captureController.mount();
const userInputCaptureController = createUserInputCaptureController({
    events: sillyTavernEvents,
    noteMutationController,
    getSettings: () => ({
        enabled: state.autoCaptureUserInput,
        ignoreExact: state.userInputIgnoreExact,
        ignorePrefixes: state.userInputIgnorePrefixes,
        collapseRepeated: state.collapseRepeatedUserInput,
    }),
    getContext: messageId => ({ message: chat?.[messageId], messageId, chatId: getChatName(), character: getCurrentCharacter() }),
    notify: (kind, error) => { if (kind === 'error') notify(error.message, 'error'); },
});
userInputCaptureController.mount();
const noteActionHandler = createNoteActionHandler({
    classPrefix: 'tnl',
    getNotes: () => state.notes,
    getCharacters: () => state.characters,
    getVariants: getNoteVariants,
    getVariantIndex,
    getActiveVariant,
    setVariantIndex: (id, index) => { state.variantIndexByGroup[id] = index; },
    render: () => noteListRenderer.render(),
    setTag: setTagFilter,
    setCharacter: setCharacterFilter,
    clearCharacter: clearCharacterFilter,
    openDetail: openFullNote,
    copy: async note => {
        await navigator.clipboard.writeText(note.content);
        notify(t('copied'), 'success');
    },
    fill: async note => {
        writeInput(note.content, false);
        closePanel();
        notify(t('filled'), 'success');
    },
    share: openShareCard,
    edit: note => noteEditorView.open(note),
    confirmDelete,
    deleteNote: id => noteMutationController.deleteNote(id),
    onDeleted: () => notify(t('deleted'), 'success'),
    toggleActionMenu: toggleNoteActionMenu,
    closeActionMenus: closeNoteActionMenus,
});
const noteListView = createNoteListView({
    root: () => document.querySelector('#tavern-notes-lite-panel'),
    selectors: {
        edit: '.__note-view-never',
        delete: '.__note-view-never',
        share: '.__note-view-never',
        previous: '#tavern-notes-lite-prev',
        next: '#tavern-notes-lite-next',
        pageJump: '#tavern-notes-lite-page-jump',
        pageInput: '#tavern-notes-lite-page-input',
    },
    renderContent: () => noteListRenderer.render(),
    onPageChange: direction => noteListController.goToPage(state.page + direction),
    onPageJump: page => noteListController.goToPage(page),
    onAction: event => {
        if (event.target.closest('#tavern-notes-lite-list')) noteActionHandler(event).catch(error => notify(error.message, 'error'));
    },
});
const noteFilterView = createNoteFilterView({
    root: () => document.querySelector('#tavern-notes-lite-panel'),
    selectors: {
        search: '#tavern-notes-lite-search',
        type: '.tn-filter',
        character: '.__note-view-never',
        chat: '.__note-view-never',
        tag: '.tn-tag-filter[data-tag]',
        sort: '.__note-view-never',
        reset: '.__note-view-never',
    },
    onSearch: value => noteFilterController.setSearch(value),
    onType: setActiveFilter,
    onCharacter: id => noteFilterController.setCharacter(id),
    onChat: id => noteFilterController.setChat(id),
    onTag: setTagFilter,
    onSort: (by, order) => noteFilterController.setSort(by, order),
    onReset: () => noteFilterController.reset(),
});
const noteListRenderer = createNoteListRenderer({
    classPrefix: 'tnl',
    panelId: 'tavern-notes-lite-panel',
    listId: 'tavern-notes-lite-list',
    pageLabelId: 'tavern-notes-lite-page-label',
    pageInputId: 'tavern-notes-lite-page-input',
    previousId: 'tavern-notes-lite-prev',
    nextId: 'tavern-notes-lite-next',
    getState: () => state,
    translate: t,
    escapeHtml: htmlEscape,
    renderCards: renderNoteCards,
    getVisibleFilters,
    getCurrentCharacterSummary,
    getCharacterAvatar,
    getCharacterKey,
    getCharacterInitial,
    noteTypeClass,
    noteTypeLabel,
    renderQuotedText,
    getVariants: getNoteVariants,
    getVariantIndex,
    getActiveVariant,
    renderTagShelf: () => tagView.renderShelf(),
});
const noteEditorView = createNoteEditorView({
    root: () => document.querySelector('#tavern-notes-lite-panel'),
    selectors: {
        dialog: '#tavern-notes-lite-edit-menu',
        form: '#tavern-notes-lite-edit-menu form',
        content: '#tavern-notes-lite-edit-content',
        tags: '#tavern-notes-lite-edit-tags',
        submit: '.tn-edit-save',
        close: '.tn-edit-close',
    },
    parseTags: parseTagsInput,
    getTags: () => {
        commitEditTagInput();
        return [...state.editingTags];
    },
    onOpen: note => {
        state.editingNote = note;
        state.editingTags = parseTagsInput(note?.tags || []);
        noteMutationController.openEditor(note);
        renderEditTagChips();
        renderTagSuggestions();
    },
    onClosed: () => {
        state.editingNote = null;
        state.editingTags = [];
        noteMutationController.closeEditor();
    },
    onClose: () => {},
    onError: error => notify(error.message, 'error'),
    onSubmit: async ({ id, content, tags }) => {
        if (!content) throw new Error(t('noteContentRequired'));
        const result = await noteMutationController.updateNote(id, { content, tags });
        if (!result.ok) throw result.error;
        tags.forEach(rememberTag);
        noteEditorView.close();
        notify(t('noteUpdated'), 'success');
    },
});
const newNoteView = createNoteEditorView({
    root: () => document.querySelector('#tavern-notes-lite-panel'),
    selectors: {
        dialog: '#tavern-notes-lite-new-note-menu',
        form: '#tavern-notes-lite-new-note-menu form',
        content: '#tavern-notes-lite-new-note-content',
        tags: '#tavern-notes-lite-new-note-tags',
        submit: '.tn-new-note-save',
        close: '.tn-new-note-close',
    },
    parseTags: parseTagsInput,
    getInitialTags: () => t('inspirationTag'),
    onOpen: closeHeaderPopovers,
    onClose: () => {},
    onError: error => notify(error.message, 'error'),
    onSubmit: async ({ content, tags }) => {
        if (!content) throw new Error(t('noteContentRequired'));
        const result = await noteMutationController.createNote({
            type: 'user_input',
            content,
            tags,
            character: getUserNoteCharacter(),
            chat: { id: getChatName(), name: getChatName(), messageId: null },
            source: 'manual_inspiration',
            collapseRepeated: false,
        }, { refresh: state.open });
        if (!result.ok) throw result.error;
        newNoteView.close();
        notify(t('newNoteSaved'), 'success');
    },
});
const noteTransferView = createNoteImportExportView({
    root: () => document.querySelector('#tavern-notes-lite-panel'),
    selectors: {
        scope: '#tavern-notes-lite-export-menu .tn-export-scope-choice',
        exportChoice: '#tavern-notes-lite-export-menu .tn-export-choice[data-format]',
        importButton: '#tavern-notes-lite-import-json',
        fileInput: '#tavern-notes-lite-import-json-file',
    },
    getScope: () => state.exportScope,
    onScopeChange: scope => { state.exportScope = scope; },
    onImport: async file => {
        const result = await noteExportController.importJson(file);
        if (!result.ok) throw new Error(result.error?.message === 'INVALID_BACKUP' ? t('invalidBackup') : result.error?.message);
        closeExportMenu();
        notify(t('importDone', result.value), 'success');
    },
    onExport: async (format, scope) => {
        const method = scope === 'page'
            ? (format === 'json' ? 'exportCurrentPageJson' : 'exportCurrentPageTxt')
            : (format === 'json' ? 'exportAllJson' : 'exportAllTxt');
        const result = await noteExportController[method]();
        if (!result.ok) throw new Error(result.error?.message === 'NO_PAGE_NOTES' ? t('noPageNotesToExport') : result.error?.message);
        closeExportMenu();
        notify(t('exportStarted'), 'success');
    },
    onError: error => notify(error.message || t('invalidBackup'), 'error'),
});
const tagView = createTagView({
    root: () => document.querySelector('#tavern-notes-lite-panel'),
    selectors: { prefix: 'tnl', shelf: '#tavern-notes-lite-tag-shelf', library: '#tavern-notes-lite-tag-library', list: '#tavern-notes-lite-tag-library-list', search: '#tavern-notes-lite-tag-search' },
    getState: () => ({ tags: state.tags, recentTags: state.recentTags, activeTag: state.tagFilter, query: state.tagManagerQuery, sort: state.tagManagerSort }),
    translate: t,
    escapeHtml: htmlEscape,
    normalizeKey: normalizeTagKey,
    onSelect: setTagFilter,
    onRename: (tag, count) => tagController.renameTag(tag, undefined, { count }),
    onDelete: (tag, count) => tagController.deleteTag(tag, { count }),
    onQuery: query => { state.tagManagerQuery = query; },
    onSort: sort => { state.tagManagerSort = sort; },
});
const captureView = createCaptureView({
    classPrefix: 'tnl',
    selectors: { selectionButton: '#tavern-notes-lite-selection-capture', selectionClass: 'tnl-selection-capture', floorButton: '.tn-floor-capture', chat: '#chat', messages: '.mes[mesid], .mes[data-mesid]', message: '.mes[mesid], .mes[data-mesid]' },
    translate: t,
    escapeHtml: htmlEscape,
    isSelectionEnabled: () => state.showSelectionCaptureButton,
    isFloorEnabled: () => state.showFloorCaptureButton,
    getSelectionSnapshot: readCaptureSelection,
    onSelectionCapture: snapshot => captureController.handleManualCapture(snapshot),
    onFloorCapture: message => captureController.captureWholeFloor(message),
});
const userInputMaintenanceView = createUserInputMaintenanceView({
    root: () => document.querySelector('#tavern-notes-lite-panel'),
    selectors: { menu: '#tavern-notes-lite-user-input-cleanup-menu', preview: '#tavern-notes-lite-input-dedupe-preview', summary: '.tn-dedupe-preview-summary', list: '.tn-dedupe-preview-list', itemClass: 'tnl-dedupe-preview-item', scan: '#tavern-notes-lite-input-dedupe-scan', apply: '#tavern-notes-lite-input-dedupe-confirm', cancel: '#tavern-notes-lite-input-dedupe-cancel' },
    controller: userInputMaintenanceController,
    translate: t,
    escapeHtml: htmlEscape,
    notify: kind => { if (kind === 'empty') notify(t('scanNoDuplicates'), 'success'); },
});
const noteFeatureLifecycle = createLifecycleRegistry();
[noteListView, noteFilterView, noteEditorView, newNoteView, noteTransferView, tagView, captureView, userInputMaintenanceView,
    noteListController, noteFilterController, noteMutationController, noteExportController, tagController, captureController,
    userInputCaptureController, userInputMaintenanceController]
    .forEach(resource => noteFeatureLifecycle.registerDestroy(() => resource.destroy()));
function destroyNoteFeatureLayer() { noteFeatureLifecycle.destroyAll(); }

const themeRepository = createThemeRepository({ request: liteThemeApi });

const themeView = createThemeView({
    document,
    window,
    getComputedStyle: element => getComputedStyle(element),
    requestAnimationFrame: callback => requestAnimationFrame(callback),
    idPrefix: 'tavern-notes-lite',
    classPrefix: 'tnl',
    variablePrefix: '--tnl-',
    translate: t,
    scheduleLayout: scheduleHeaderActionLayout,
    exportFile,
    iconConfig: {
        defaultIconClass: 'tavern-notes-lite-default-icon',
        lightIconClass: 'tavern-notes-lite-default-icon-light',
        brandIconSelector: '.tn-brand-mark',
        useThemeBrandIcon: false,
        openSelector: '#tavern-notes-lite-open',
        captureSelector: '#tavern-notes-lite-capture',
        floatingOpenSelector: '#tavern-notes-lite-floating-open',
        floatingCaptureSelector: '#tavern-notes-lite-floating-capture',
        openIconUrl: DEFAULT_OPEN_ICON_URL,
        captureIconUrl: DEFAULT_CAPTURE_ICON_URL,
    },
});

const themeController = createThemeController({
    repository: themeRepository,
    view: themeView,
    renderer: themeView,
    themeModel,
    defaultTheme: DEFAULT_THEME,
    appleThemeId: APPLE_THEME_ID,
    capabilities: THEME_CAPABILITIES,
    getThemeState: () => appStore.getSlice('theme'),
    patchThemeState: patch => appStore.patch('theme', patch),
    persistThemeSettings: async () => {
        const themeState = appStore.getSlice('theme');
        const result = await settingsService.update({
            appleGlassMode: themeState.appleMode,
            defaultThemeMode: themeState.defaultMode,
        });
        if (!result.ok) throw result.error;
    },
    translate: t,
    notify,
    confirm: message => window.confirm(message),
    beforeOpen: closeHeaderPopovers,
});

const themeStudio = createThemeStudio({
    document,
    window,
    getComputedStyle: element => getComputedStyle(element),
    defaultTheme: {
        ...DEFAULT_THEME,
        variables: toFullThemeVariables(DEFAULT_THEME.variables),
    },
    normalizeTheme: themeModel.normalizeTheme,
    themeController,
    translate: t,
    notify,
    idPrefix: 'tavern-notes-lite',
});
themeController.attachStudio(themeStudio);

const fontRepository = createLiteFontRepository({
    getDatabaseName: () => FONT_DB_NAME,
    storeName: FONT_DB_STORE,
    unsupportedError: () => new Error(t('localFontUnsupported')),
});
const fontView = createFontView({
    getStyleElement: () => document.querySelector('#tavern-notes-lite-share-font-style'),
    translate: t,
    stripQuotes: stripFontQuotes,
    FontFaceImpl: globalThis.FontFace,
    fontSet: document.fonts,
    readFile: file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('File read failed.'));
        reader.readAsDataURL(file);
    }),
});
const fontController = createFontController({
    repository: fontRepository,
    view: fontView,
    getSettings: () => state.shareCardSettings,
    updateSettings: patch => updateSettings({ shareCard: patch }),
    onChanged: () => shareCardController?.preview(),
    notify: (kind, family) => {
        if (kind === 'local-imported') notify(t('localFontImported', { name: family }), 'success');
        else notify(kind === 'imported' ? t('importedFont', { name: family }) : t('importedFontCode'), 'success');
    },
    errors: { missing: () => new Error(t('savedFontMissing')) },
});
const updateRepository = createUpdateRepository({
    installedManifestUrl: '/scripts/extensions/third-party/tavern-notes-lite/manifest.json',
    fallbackVersion: EXTENSION_VERSION,
    manifestUrl: REMOTE_MANIFEST_URL,
    changelogUrl: REMOTE_CHANGELOG_URL,
    annotationUrl: REMOTE_CHANGELOG_ANNOTATION_URL,
    noticeStorage: localStorage,
    noticeKey: UPDATE_NOTICE_KEY,
});
const updateView = createUpdateView({
    root: () => document.querySelector('#tavern-notes-lite-update-menu'),
    idPrefix: 'tavern-notes-lite',
    classPrefix: 'tnl',
    translate: t,
    escapeHtml: htmlEscape,
    openManager: openSillyTavernExtensionManager,
    openRepository: openUpdateRepository,
    closePopovers: closeHeaderPopovers,
});
const updateController = createUpdateController({
    repository: updateRepository,
    view: updateView,
    fallbackVersion: EXTENSION_VERSION,
    notify: info => {
        const toastrApi = globalThis.toastr;
        if (!toastrApi) return false;
        toastrApi.info(t('updateAvailable', { version: info.latestVersion }), t('updateAvailableTitle'), { timeOut: 12000, extendedTimeOut: 16000 });
        return true;
    },
    setStatus: info => setStatus(`${t('updateAvailableTitle')}: ${t('updateAvailable', { version: info.latestVersion })}`),
});
const systemStatusView = createSystemStatusView({
    statusSelector: '.tavern-notes-lite-status',
    classPrefix: 'tnl',
    translate: t,
    escapeHtml: htmlEscape,
    copyText: copyTextToClipboard,
    notify,
    install: { id: 'tavern-notes-lite-install-guide', windowsPath: '', shellCommand: '' },
    chooseLite: () => {},
});
const systemStatusController = createSystemStatusController({
    repository: createLiteSystemStatusRepository({
        getStorageInfo: getLiteStorageInfo,
        estimateStorage: () => navigator.storage?.estimate?.() || Promise.resolve({}),
    }),
    view: systemStatusView,
    capabilities: { backendStatus: false, installGuide: false, storageModeSwitch: false, storageQuota: true },
    formatStatus: status => t('liteStorageStatus', { size: formatBytes(status.approximateBytes), count: status.totalNotes }),
    notifyReminder: status => notify(t('liteBackupReminder', { size: formatBytes(status.approximateBytes) }), 'info'),
    reminderOptions: { storageNoticeBytes: STORAGE_NOTICE_BYTES, backupNoticeDays: BACKUP_NOTICE_DAYS },
    onStatus: status => { if (status.user) updateSettings({ currentUserName: status.user }); },
});
fontController.mount();
systemStatusController.mount();
let shareCardController;
const shareCardRenderer = createShareCardRenderer({
    resolveFont: () => fontController.resolveFont(),
    loadFont: async () => {},
    waitForFont: font => fontController.waitForFont(font),
    getCharacterAvatarUrl: getShareCardAvatarUrl,
    getUserAvatarUrl: getShareCardUserAvatarUrl,
    getUserName: getShareCardUserName,
    translate: t,
});
const shareCardView = createShareCardView({
    root: () => document.querySelector('#tavern-notes-lite-share-menu'),
    idPrefix: 'tavern-notes-lite',
    classPrefix: 'tnl',
    getSettings: () => state.shareCardSettings,
    renderSavedFonts: select => fontView.renderSavedFonts(select, fontController.listFonts(), state.shareCardSettings.fontFamily),
    onEvent: async (type, value) => {
        if (type === 'close') shareCardController.close();
        else if (type === 'settings') await shareCardController.updateSettings(value);
        else if (type === 'font-import-input') await updateSettings({ shareCard: { fontImport: value } });
        else if (type === 'saved-font') await fontController.select(value);
        else if (type === 'import-font') await fontController.importCss(state.shareCardSettings.fontImport || '');
        else if (type === 'import-local-font') {
            const input = value.target;
            const file = input.files?.[0];
            input.value = '';
            if (file) await fontController.importLocal(file);
        }
        else if (type === 'preview') await shareCardController.preview();
        else if (type === 'export') await shareCardController.exportImage();
        else if (type === 'error') notify(value.message, 'error');
    },
});
shareCardController = createShareCardController({
    view: shareCardView,
    renderer: shareCardRenderer,
    getSettings: () => state.shareCardSettings,
    updateSettings: patch => updateSettings({ shareCard: patch }),
    resetSettings: () => updateSettings({ shareCard: DEFAULT_SETTINGS.shareCard }),
    downloadBlob: (blob, filename) => {
        const url = URL.createObjectURL(blob);
        exportFile(url, filename);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    brand: t('brandForShare'),
    onEvent: (type, value) => {
        if (type === 'exported') notify(t('shareCardExported'), 'success');
        else if (type === 'error') {
            console.error('[Tavern Notes Lite] share-card error', value);
            notify(value?.message === 'share-card-export-failed' ? t('shareCardExportFailed') : value.message, 'error');
        }
    },
});
const noteDetailView = createNoteDetailView({
    root: () => document.querySelector('#tavern-notes-lite-modal'),
    classPrefix: 'tnl',
    escapeHtml: htmlEscape,
    renderContent: model => renderNoteDetailContent(model, { escapeHtml: htmlEscape, renderText: renderQuotedText, classPrefix: 'tnl' }),
    onAction: action => noteDetailController.handleAction(action).catch(error => notify(error.message, 'error')),
    onClose: () => noteDetailController.close(),
});
const noteDetailController = createNoteDetailController({
    view: noteDetailView,
    formatType: noteTypeLabel,
    closeActionMenus: () => closeNoteActionMenus(document.querySelector('#tavern-notes-lite-panel'), 'tnl'),
    copyText: copyTextToClipboard,
    fillInput: content => writeInput(content, false),
    editNote: note => noteEditorView.open(note),
    confirmDelete,
    deleteNote: id => noteMutationController.deleteNote(id),
    shareNote: note => shareCardController.open(note),
    closePanel,
    notify: type => notify(t(type), 'success'),
});

function notify(message, kind = 'info') {
    setStatus(message);
    const toastrApi = globalThis.toastr;
    if (!toastrApi) return;
    if (kind === 'success') toastrApi.success(message);
    else if (kind === 'error') toastrApi.error(message);
    else toastrApi.info(message);
}

async function copyTextToClipboard(text) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
}

function setStatus(message) {
    state.status = message;
    systemStatusView.renderStatus(message);
}

async function checkForTavernNotesUpdate(options) {
    return updateController.check(options);
}

async function updateSettings(patch) {
    const result = await settingsService.update(patch);
    if (!result.ok) notify(result.error.message, 'error');
    return result;
}

async function saveLanguageSetting(language) {
    const result = await updateSettings({ language });
    if (!result.ok) return;
    updateAutoCaptureUserInputButton();
    updateSelectionCaptureButtonSetting();
    closeHeaderPopovers();
    updateFloorCaptureButtonSetting();
    updateFloorCaptureSelectorInput();
    themeController.render();
    quickReplyController.refresh();
    quickReplyController.refresh();
    notify(t('languageSaved'), 'success');
}

function getVisibleFilters() {
    return FILTERS;
}

function updateAutoCaptureUserInputButton() {
    const button = document.querySelector('#tavern-notes-lite-auto-user-input');
    if (!button) return;
    button.classList.toggle('active', state.autoCaptureUserInput);
    const label = t('autoCaptureUserInputTitle');
    button.title = label;
    button.setAttribute('aria-label', label);
    button.querySelector('span')?.replaceChildren(document.createTextNode(t('autoCaptureUserInput')));
}

async function toggleAutoCaptureUserInput() {
    const result = await updateSettings({ autoCaptureUserInput: !state.autoCaptureUserInput });
    if (!result.ok) return;
    updateAutoCaptureUserInputButton();
    renderFilterTabs();
    noteListController.refresh();
    notify(state.autoCaptureUserInput ? t('autoCaptureUserInputOn') : t('autoCaptureUserInputOff'), 'success');
}

function updateSelectionCaptureButtonSetting() {
    const button = document.querySelector('#tavern-notes-lite-selection-capture-setting');
    if (!button) return;
    button.classList.toggle('active', state.showSelectionCaptureButton);
    const label = t('selectionCaptureButtonTitle');
    button.title = label;
    button.setAttribute('aria-label', label);
    button.querySelector('span')?.replaceChildren(document.createTextNode(t('selectionCaptureButton')));
}

async function toggleSelectionCaptureButtonSetting() {
    const result = await updateSettings({ showSelectionCaptureButton: !state.showSelectionCaptureButton });
    if (!result.ok) return;
    updateSelectionCaptureButtonSetting();
    if (!state.showSelectionCaptureButton) captureView.hideSelectionButton();
    notify(state.showSelectionCaptureButton ? t('selectionCaptureButtonOn') : t('selectionCaptureButtonOff'), 'success');
}

function updateFloorCaptureButtonSetting() {
    const button = document.querySelector('#tavern-notes-lite-floor-capture-setting');
    if (button) {
        button.classList.toggle('active', state.showFloorCaptureButton);
        const label = t('floorCaptureButtonTitle');
        button.title = label;
        button.setAttribute('aria-label', label);
        button.querySelector('span')?.replaceChildren(document.createTextNode(t('floorCaptureButton')));
    }
    updateFloorCaptureEntryButton();
}

function updateFloorCaptureEntryButton() {
    const button = document.querySelector('#tavern-notes-lite-floor-capture-open');
    if (!button) return;
    button.classList.toggle('active', state.showFloorCaptureButton);
    const label = t('floorCaptureEntryTitle');
    button.title = label;
    button.setAttribute('aria-label', label);
    button.querySelector('span')?.replaceChildren(document.createTextNode(t('floorCaptureEntry')));
}

function updateFloorCaptureSelectorInput() {
    const input = document.querySelector('#tavern-notes-lite-floor-capture-selector');
    if (input) {
        input.value = getFloorCaptureTagName();
        input.placeholder = t('floorCaptureSelectorPlaceholder');
    }
    updateFloorCaptureSelectorSummary();
    renderFloorCaptureExcludedTags();
}

function renderFloorCaptureExcludedTags() {
    const list = document.querySelector('#tavern-notes-lite-floor-exclude-tags');
    if (!list) return;
    list.innerHTML = state.floorCaptureExcludedTags.length
        ? state.floorCaptureExcludedTags.map(tag => `<span class="tnl-floor-exclude-tag"><code>&lt;${htmlEscape(tag)}&gt;</code><button type="button" data-floor-exclude-remove="${htmlEscape(tag)}" title="${htmlEscape(t('removeExcludedTag'))}" aria-label="${htmlEscape(t('removeExcludedTag'))}"><i class="fa-solid fa-xmark"></i></button></span>`).join('')
        : `<span class="tnl-floor-exclude-empty">${htmlEscape(t('noExcludedTags'))}</span>`;
}

async function addFloorCaptureExcludedTags() {
    const input = document.querySelector('#tavern-notes-lite-floor-exclude-input');
    const additions = normalizeExcludedTagNames(input?.value);
    if (!additions.length) return notify(t('invalidExcludedTag'), 'warning');
    const result = await updateSettings({
        floorCaptureExcludedTags: [...state.floorCaptureExcludedTags, ...additions],
    });
    if (!result.ok) return;
    if (input) input.value = '';
    renderFloorCaptureExcludedTags();
    notify(t('excludedTagsSaved'), 'success');
}

async function removeFloorCaptureExcludedTag(tag) {
    const result = await updateSettings({
        floorCaptureExcludedTags: state.floorCaptureExcludedTags.filter(item => item !== tag),
    });
    if (!result.ok) return;
    renderFloorCaptureExcludedTags();
}

function selectorFromFloorCaptureTag(value) {
    let tag = String(value || '').trim();
    tag = tag.replace(/^<\s*/, '').replace(/\s*>$/, '').replace(/^\/+/, '').trim();
    if (!tag) return DEFAULT_FLOOR_CAPTURE_SELECTOR;
    if (/[,.[#\s>:]/.test(tag)) return tag;
    return `${tag}, .${tag}, [data-tavern-notes-content], [data-note-content], .mes_text`;
}

function getFloorCaptureTagName() {
    const selector = String(state.floorCaptureSelector || DEFAULT_FLOOR_CAPTURE_SELECTOR).trim();
    if (selector === DEFAULT_FLOOR_CAPTURE_SELECTOR) return DEFAULT_FLOOR_CAPTURE_TAG;
    const first = selector.split(',')[0]?.trim() || DEFAULT_FLOOR_CAPTURE_TAG;
    if (first.startsWith('.')) return first.slice(1);
    const match = first.match(/^([a-zA-Z][\w-]*)$/);
    return match ? match[1] : first;
}

function updateFloorCaptureSelectorSummary() {
    const summary = document.querySelector('#tavern-notes-lite-floor-capture-selector-summary');
    if (!summary) return;
    const selector = String(state.floorCaptureSelector || DEFAULT_FLOOR_CAPTURE_SELECTOR).trim();
    const isDefault = selector === DEFAULT_FLOOR_CAPTURE_SELECTOR;
    summary.textContent = isDefault
        ? t('floorCaptureSelectorCurrentDefault')
        : t('floorCaptureSelectorCurrentCustom', { tag: getFloorCaptureTagName(), selector });
}

async function toggleFloorCaptureButtonSetting() {
    const result = await updateSettings({ showFloorCaptureButton: !state.showFloorCaptureButton });
    if (!result.ok) return;
    updateFloorCaptureButtonSetting();
    captureView.refreshFloorButtons();
    notify(state.showFloorCaptureButton ? t('floorCaptureButtonOn') : t('floorCaptureButtonOff'), 'success');
}

async function saveFloorCaptureSelector(value, silent = false) {
    const next = selectorFromFloorCaptureTag(value);
    const result = await updateSettings({ floorCaptureSelector: next });
    if (!result.ok) return;
    updateFloorCaptureSelectorInput();
    captureView.refreshFloorButtons();
    document.querySelector('.tn-floor-capture-advanced')?.removeAttribute('open');
    if (!silent) notify(t('floorCaptureSelectorSaved'), 'success');
}

function openFloorCaptureMenu() {
    const menu = document.querySelector('#tavern-notes-lite-floor-capture-menu');
    if (!menu) return;
    updateFloorCaptureButtonSetting();
    updateFloorCaptureSelectorInput();
    menu.classList.add('open');
    menu.setAttribute('aria-hidden', 'false');
}

function closeFloorCaptureMenu() {
    const menu = document.querySelector('#tavern-notes-lite-floor-capture-menu');
    if (!menu) return;
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden', 'true');
}

function openSillyTavernExtensionManager() {
    updateController.close();
    closePanel();
    document.querySelector('#extensions_details')?.click();
}

function openUpdateRepository() {
    window.open(REPOSITORY_URL, '_blank', 'noopener,noreferrer');
}

function syncUserInputCleanupControls() {
    const collapse = document.querySelector('#tavern-notes-lite-collapse-repeated-input');
    if (collapse) collapse.checked = state.collapseRepeatedUserInput;
    renderInputRuleLists();
}

function inputRuleStateKey(kind) { return kind === 'prefix' ? 'userInputIgnorePrefixes' : 'userInputIgnoreExact'; }
function renderInputRuleLists() {
    const query = String(document.querySelector('#tavern-notes-lite-input-rule-search')?.value || '').trim().toLocaleLowerCase();
    for (const kind of ['exact', 'prefix']) {
        const rules = state[inputRuleStateKey(kind)];
        const visible = rules.filter(rule => !query || rule.toLocaleLowerCase().includes(query));
        const count = document.querySelector(`[data-rule-count="${kind}"]`);
        const list = document.querySelector(`[data-rule-list="${kind}"]`);
        if (count) count.textContent = String(rules.length);
        if (list) list.innerHTML = visible.length ? visible.map(rule => `<div class="tnl-input-rule-item"><span title="${htmlEscape(rule)}">${htmlEscape(rule)}</span><button type="button" data-rule-delete="${kind}" data-rule-value="${htmlEscape(rule)}" title="${htmlEscape(t('delete'))}"><i class="fa-solid fa-xmark"></i></button></div>`).join('') : `<div class="tnl-input-rule-empty">${htmlEscape(t('noInputRules'))}</div>`;
    }
}
async function addInputRules(kind) {
    const input = document.querySelector(`[data-rule-input="${kind}"]`);
    const additions = normalizeInputIgnoreRules(input?.value);
    if (!additions.length) return;
    const key = inputRuleStateKey(kind);
    const result = await updateSettings({
        [key]: normalizeInputIgnoreRules([...state[key], ...additions]),
    });
    if (!result.ok) return;
    if (input) input.value = '';
    renderInputRuleLists();
}
async function deleteInputRule(kind, value) {
    const key = inputRuleStateKey(kind);
    const result = await updateSettings({ [key]: state[key].filter(rule => rule !== value) });
    if (!result.ok) return;
    renderInputRuleLists();
}

function openUserInputCleanupMenu() {
    const menu = document.querySelector('#tavern-notes-lite-user-input-cleanup-menu');
    if (!menu) return;
    closeHeaderPopovers();
    syncUserInputCleanupControls();
    menu.classList.add('open');
    menu.setAttribute('aria-hidden', 'false');
}

function closeUserInputCleanupMenu() {
    const menu = document.querySelector('#tavern-notes-lite-user-input-cleanup-menu');
    if (!menu) return;
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden', 'true');
}

async function saveUserInputCleanupSettings() {
    const result = await updateSettings({
        collapseRepeatedUserInput: document.querySelector('#tavern-notes-lite-collapse-repeated-input')?.checked !== false,
    });
    if (!result.ok) return;
    syncUserInputCleanupControls();
    notify(t('inputRulesSaved'), 'success');
}

function htmlEscape(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function renderQuotedText(value) {
    const text = String(value ?? '');
    const pairs = {
        '“': '”',
        '「': '」',
        '『': '』',
        '《': '》',
        '"': '"',
    };
    const openers = new Set(Object.keys(pairs));
    let output = '';
    let index = 0;

    while (index < text.length) {
        const open = text[index];
        if (!openers.has(open)) {
            output += htmlEscape(open);
            index += 1;
            continue;
        }

        const close = pairs[open];
        const closeIndex = text.indexOf(close, index + 1);
        if (closeIndex === -1) {
            output += htmlEscape(open);
            index += 1;
            continue;
        }

        const quoted = text.slice(index, closeIndex + 1);
        output += `<span class="tnl-dialogue">${htmlEscape(quoted)}</span>`;
        index = closeIndex + 1;
    }

    return output;
}

function noteTypeLabel(type) {
    if (type === 'user_input') return t('userInput');
    if (type === 'excerpt') return t('excerpt');
    return t('manual');
}

function noteTypeClass(type) {
    if (type === 'user_input') return 'user';
    if (type === 'excerpt') return 'excerpt';
    return 'manual';
}

function rememberTag(tag) {
    const name = String(tag || '').trim();
    if (!name) return;
    const key = normalizeTagKey(name);
    updateSettings({ recentTags: [name, ...state.recentTags.filter(item => normalizeTagKey(item) !== key)].slice(0, 16) });
}

function setTagFilter(tag = '') {
    state.tagFilter = String(tag || '');
    if (state.tagFilter) rememberTag(state.tagFilter);
    noteFilterController.setTag(state.tagFilter);
}

function updateArchiveReadingMode() {
    const panel = document.querySelector('#tavern-notes-lite-panel');
    const list = document.querySelector('#tavern-notes-lite-list');
    if (!panel || !list) return;
    if (panel.dataset.themeFlavor !== 'archive') {
        panel.classList.remove('tn-archive-reading');
        return;
    }

    const threshold = panel.classList.contains('tn-archive-reading') ? 4 : 24;
    panel.classList.toggle('tn-archive-reading', list.scrollTop > threshold);
}

function getCharacterAvatar(character) {
    if (character?.isUser || character?.id === 'tavern-notes-user') return getShareCardUserAvatarUrl();
    const avatar = character?.avatar;
    if (!avatar || avatar === 'none') return '';
    try {
        return getThumbnailUrl('avatar', avatar);
    } catch {
        return '';
    }
}

function getCharacterInitial(name) {
    return String(name || t('unnamedCharacter')).trim().slice(0, 1) || t('unnamedCharacter').slice(0, 1);
}

function getCharacterKey(character) {
    return [
        character?.id ?? '',
        character?.avatar ?? '',
        character?.name ?? '',
    ].map(value => String(value)).join('|');
}

function getCurrentCharacterSummary() {
    const current = getCurrentCharacter();
    const matched = state.characters.find(character => String(character.id ?? '') === String(current.id ?? ''))
        || state.characters.find(character => character.avatar && character.avatar === current.avatar)
        || state.characters.find(character => character.name === current.name);

    return {
        ...current,
        ...(matched || {}),
        id: matched?.id ?? current.id,
        name: matched?.name || current.name,
        avatar: matched?.avatar || current.avatar,
        total: Number(matched?.total || 0),
        userInput: Number(matched?.userInput || 0),
        excerpt: Number(matched?.excerpt || 0),
        isCurrent: true,
    };
}

function getNoteVariants(note) {
    return Array.isArray(note?.variants) && note.variants.length ? note.variants : [note];
}

function getVariantIndex(note) {
    const variants = getNoteVariants(note);
    const saved = state.variantIndexByGroup[note.id];
    const fallback = Math.max(0, variants.findIndex(variant => variant.id === note.activeVariantId));
    const index = Number.isFinite(Number(saved)) ? Number(saved) : (fallback >= 0 ? fallback : variants.length - 1);
    return Math.min(Math.max(index, 0), variants.length - 1);
}

function getActiveVariant(note) {
    const variants = getNoteVariants(note);
    return variants[getVariantIndex(note)] || note;
}

function findNoteGroupFromElement(element) {
    const article = element.closest('.tn-note');
    const id = article?.dataset.noteId;
    return state.notes.find(note => note.id === id);
}

function findNoteFromButton(button) {
    const note = findNoteGroupFromElement(button);
    return note ? getActiveVariant(note) : null;
}

function getInputBox() {
    return document.querySelector('#send_textarea') || document.querySelector('textarea');
}

function writeInput(text, append = false) {
    const input = getInputBox();
    if (!input) {
        notify(t('noInput'), 'error');
        return;
    }
    input.value = append && input.value ? `${input.value}\n${text}` : text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
}

function getUserNoteCharacter() { return { id: 'tavern-notes-user', name: getShareCardUserName(), avatar: user_avatar || null, isUser: true }; }
function layoutHeaderActions() {
    const panel = document.querySelector('#tavern-notes-lite-panel');
    const actions = panel?.querySelector('.tn-header-actions');
    const moreButton = document.querySelector('#tavern-notes-lite-more-open');
    const moreMenu = document.querySelector('#tavern-notes-lite-more-menu');
    if (!panel || !actions || !moreButton || !moreMenu) return;

    const buttons = HEADER_ACTION_IDS.map(id => document.getElementById(id)).filter(Boolean);
    const activeButtons = buttons.filter(button => !button.classList.contains('tnl-hidden'));
    const panelWidth = panel.getBoundingClientRect().width || panel.clientWidth || 480;
    const directLimit = Math.max(3, Math.floor((Math.max(0, panelWidth - 48) + 8) / 78) - 1);
    const directButtons = activeButtons.slice(0, directLimit);
    const overflowButtons = activeButtons.slice(directLimit);
    const hiddenButtons = buttons.filter(button => button.classList.contains('tnl-hidden'));

    directButtons.forEach(button => actions.insertBefore(button, moreButton));
    overflowButtons.forEach(button => moreMenu.append(button));
    hiddenButtons.forEach(button => moreMenu.append(button));

    const hasOverflow = overflowButtons.length > 0;
    moreButton.classList.toggle('tnl-hidden', !hasOverflow);
    actions.style.setProperty('--tnl-header-action-columns', String(directButtons.length + (hasOverflow ? 1 : 0)));
    if (!hasOverflow) moreMenu.classList.remove('open');
}

function scheduleHeaderActionLayout() {
    if (headerActionLayoutFrame) return;
    headerActionLayoutFrame = window.requestAnimationFrame(() => {
        headerActionLayoutFrame = 0;
        layoutHeaderActions();
    });
}

const headerLayoutObserverController = createObserverController({
    createObserver: createResizeObserverFactory(globalThis),
    getTarget: () => typeof globalThis.ResizeObserver === 'function' ? document.querySelector('#tavern-notes-lite-panel') : null,
    onRefresh: scheduleHeaderActionLayout,
});

function observeHeaderActionLayout() {
    headerLayoutObserverController.mount();
}

function closeHeaderPopovers() { document.querySelectorAll('.tn-header-popover.open').forEach(menu => menu.classList.remove('open')); }
function closeHeaderPopoverFromOutside(event) {
    const openPopover = document.querySelector('.tn-header-popover.open');
    if (!openPopover) return;
    if (event.target.closest?.('#tavern-notes-lite-more-open, .tn-header-popover')) return;
    closeHeaderPopovers();
}
function toggleHeaderPopover(id) {
    const target = document.getElementById(id);
    const shouldOpen = Boolean(target && !target.classList.contains('open'));
    closeHeaderPopovers();
    if (shouldOpen) target.classList.add('open');
}

function getMessageIdFromElement(messageElement) {
    const raw = messageElement?.getAttribute?.('mesid') || messageElement?.dataset?.mesid;
    if (raw === undefined || raw === null || raw === '') return null;
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : raw;
}

function htmlToPlainText(value) {
    const element = document.createElement('div');
    element.innerHTML = String(value || '');
    return element.innerText || element.textContent || '';
}

function getFloorCaptureSelectors() {
    const selectors = String(state.floorCaptureSelector || DEFAULT_FLOOR_CAPTURE_SELECTOR)
        .split(',')
        .map(selector => selector.trim())
        .filter(Boolean);
    return selectors.length ? selectors : DEFAULT_FLOOR_CAPTURE_SELECTOR.split(',').map(selector => selector.trim());
}

function getMessageTextFromElement(messageElement, rawMessage = '') {
    return extractFloorText({
        documentRef: document,
        messageElement,
        rawMessage,
        selectors: getFloorCaptureSelectors(),
        excludeSelector: buildFloorExcludeSelector(FLOOR_CAPTURE_EXCLUDE_SELECTOR, state.floorCaptureExcludedTags),
    });
}

function getMessageCharacterForCapture(messageId) {
    const current = getCurrentCharacter();
    const message = chat?.[messageId];
    if (!message || message.is_user) return current;
    return {
        ...current,
        name: message.name || current.name,
    };
}

function setActiveFilter(filter) {
    state.filter = filter;
    if (filter === 'characters') state.characterFilter = null;
    document.querySelectorAll('.tn-filter').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === filter);
    });
    noteListRenderer.render();
    noteFilterController.setType(filter === 'characters' ? 'all' : filter);
}

function setCharacterFilter(character) {
    state.filter = 'all';
    state.characterFilter = {
        id: character.id === '' ? null : character.id,
        name: character.name || '未命名角色',
        avatar: character.avatar || null,
        total: Number(character.total || 0),
        userInput: Number(character.userInput || 0),
        excerpt: Number(character.excerpt || 0),
    };
    document.querySelectorAll('.tn-filter').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === 'all');
    });
    noteListRenderer.render();
    noteFilterController.setCharacter(state.characterFilter.id);
}

function clearCharacterFilter() {
    state.characterFilter = null;
    state.filter = 'characters';
    document.querySelectorAll('.tn-filter').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === 'characters');
    });
    noteListRenderer.render();
    noteFilterController.setCharacter(null);
}

function buildPanel() {
    if (document.querySelector('#tavern-notes-lite-panel')) return;

    insertAppShellMarkup(document, renderLiteAppShellMarkup({
        state,
        translate: t,
        escapeHtml: htmlEscape,
        languageOptions: LANGUAGE_OPTIONS,
        getVisibleFilters,
        getFloorCaptureTagName,
        extensionVersion: EXTENSION_VERSION,
        renderThemeViewMarkup,
        renderThemeStudioMarkup,
        themeCapabilities: THEME_CAPABILITIES,
        shareCardThemes: SHARE_CARD_THEMES,
        shareCardBackgrounds: SHARE_CARD_BACKGROUNDS,
        brandIconMarkup: themeView.renderDefaultIcon(DEFAULT_OPEN_ICON_URL),
    }));

    const dialogIds = [
        'tavern-notes-lite-new-note-menu',
        'tavern-notes-lite-modal',
        'tavern-notes-lite-edit-menu',
        'tavern-notes-lite-tag-library',
        'tavern-notes-lite-export-menu',
        'tavern-notes-lite-floor-capture-menu',
        'tavern-notes-lite-update-menu',
        'tavern-notes-lite-user-input-cleanup-menu',
        'tavern-notes-lite-theme-menu',
        'tavern-notes-lite-share-menu',
    ];
    dialogIds.forEach(id => document.getElementById(id)?.setAttribute('data-tn-overlay', 'dialog'));
    document.querySelector('#tavern-notes-lite-more-menu')?.setAttribute('data-tn-overlay', 'popover');

    quickReplyController.refresh();
    addExtensionsMenuEntry();
    updateSelectionCaptureButtonSetting();
    updateFloorCaptureButtonSetting();
    updateFloorCaptureSelectorInput();
    bindEvents();
}

const appShellView = createAppShellView({
    mountShell: buildPanel,
    getRoot: () => document.querySelector('#tavern-notes-lite-panel'),
    openShell: openPanel,
    closeShell: closePanel,
    removeShell: () => document.querySelector('#tavern-notes-lite-panel')?.remove(),
});

function bindEvents() {
    noteListView.mount();
    noteFilterView.mount();
    noteEditorView.mount();
    newNoteView.mount();
    noteTransferView.mount();
    tagView.mount();
    captureView.mount();
    userInputMaintenanceView.mount();
    themeController.mount();
    shareCardController.mount();
    noteDetailController.mount();
    fontController.mount();
    updateController.mount();
    systemStatusController.mount();
    window.addEventListener('resize', () => quickReplyController.refresh(), { passive: true });
    document.querySelector('#tavern-notes-lite-new-note-open')?.addEventListener('click', () => newNoteView.open());
    document.querySelector('#tavern-notes-lite-more-open')?.addEventListener('click', () => toggleHeaderPopover('tavern-notes-lite-more-menu'));
    document.querySelector('#tavern-notes-lite-reset-floating')?.addEventListener('click', () => quickReplyController.resetPosition());
    document.querySelector('#tavern-notes-lite-new-note-menu')?.addEventListener('click', event => { if (event.target.id === 'tavern-notes-lite-new-note-menu') newNoteView.close(); });
    document.querySelector('#tavern-notes-lite-language')?.addEventListener('change', event => saveLanguageSetting(event.target.value));
    document.querySelector('#tavern-notes-lite-launcher-mode')?.addEventListener('click', () => quickReplyController.toggle());
    document.querySelector('#tavern-notes-lite-auto-user-input')?.addEventListener('click', toggleAutoCaptureUserInput);
    document.querySelector('#tavern-notes-lite-user-input-cleanup-open')?.addEventListener('click', openUserInputCleanupMenu);
    document.querySelector('.tn-user-input-cleanup-close')?.addEventListener('click', closeUserInputCleanupMenu);
    document.querySelector('#tavern-notes-lite-input-rules-save')?.addEventListener('click', saveUserInputCleanupSettings);
    document.querySelector('#tavern-notes-lite-input-rule-search')?.addEventListener('input', renderInputRuleLists);
    document.querySelector('.tn-user-input-cleanup-card')?.addEventListener('click', event => {
        const add = event.target.closest?.('[data-rule-add]');
        if (add) return addInputRules(add.dataset.ruleAdd);
        const remove = event.target.closest?.('[data-rule-delete]');
        if (remove) deleteInputRule(remove.dataset.ruleDelete, remove.dataset.ruleValue || '');
    });
    document.querySelector('#tavern-notes-lite-selection-capture-setting')?.addEventListener('click', toggleSelectionCaptureButtonSetting);
    document.querySelector('#tavern-notes-lite-floor-capture-open')?.addEventListener('click', openFloorCaptureMenu);
    document.querySelector('#tavern-notes-lite-floor-capture-setting')?.addEventListener('click', toggleFloorCaptureButtonSetting);
    document.querySelector('.tn-floor-capture-close')?.addEventListener('click', closeFloorCaptureMenu);
    document.querySelector('.tn-close')?.addEventListener('click', closePanel);
    document.querySelector('#tavern-notes-lite-export')?.addEventListener('click', toggleExportMenu);
    document.querySelector('#tavern-notes-lite-floor-capture-selector-save')?.addEventListener('click', () => saveFloorCaptureSelector(document.querySelector('#tavern-notes-lite-floor-capture-selector')?.value));
    document.querySelector('#tavern-notes-lite-floor-capture-selector')?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); saveFloorCaptureSelector(event.target.value); } });
    document.querySelector('#tavern-notes-lite-floor-exclude-add')?.addEventListener('click', addFloorCaptureExcludedTags);
    document.querySelector('#tavern-notes-lite-floor-exclude-input')?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addFloorCaptureExcludedTags(); } });
    document.querySelector('#tavern-notes-lite-floor-exclude-tags')?.addEventListener('click', event => { const button = event.target.closest?.('[data-floor-exclude-remove]'); if (button) removeFloorCaptureExcludedTag(button.dataset.floorExcludeRemove || ''); });
    document.querySelector('#tavern-notes-lite-list')?.addEventListener('keydown', event => {
        if (!['Enter', ' '].includes(event.key) || !event.target.matches?.('.tn-note')) return;
        event.preventDefault();
        const note = findNoteFromButton(event.target);
        if (note) openFullNote(note);
    });
    document.querySelector('#tavern-notes-lite-list')?.addEventListener('scroll', updateArchiveReadingMode, { passive: true });
    document.querySelector('#tavern-notes-lite-edit-menu')?.addEventListener('click', event => {
        if (event.target.id === 'tavern-notes-lite-edit-menu') noteEditorView.close();
    });
    document.querySelector('#tavern-notes-lite-edit-tags')?.addEventListener('input', renderTagSuggestions);
    document.querySelector('#tavern-notes-lite-edit-tags')?.addEventListener('keydown', event => {
        if (!['Enter', ',', '，'].includes(event.key)) return;
        event.preventDefault();
        commitEditTagInput();
    });
    document.querySelector('#tavern-notes-lite-edit-tag-chips')?.addEventListener('click', event => {
        const button = event.target.closest?.('[data-remove-edit-tag]');
        if (button) removeEditTag(button.dataset.removeEditTag || '');
    });
    document.querySelector('#tavern-notes-lite-tag-suggestions')?.addEventListener('click', event => {
        const button = event.target.closest?.('[data-suggest-tag]');
        if (button) addSuggestedTag(button.dataset.suggestTag || '');
    });
    document.querySelector('#tavern-notes-lite-export-menu')?.addEventListener('click', event => {
        if (event.target.id === 'tavern-notes-lite-export-menu') closeExportMenu();
    });
    document.querySelector('#tavern-notes-lite-floor-capture-menu')?.addEventListener('click', event => {
        if (event.target.id === 'tavern-notes-lite-floor-capture-menu') closeFloorCaptureMenu();
    });
    document.querySelector('#tavern-notes-lite-update-menu')?.addEventListener('click', event => {
        if (event.target.id === 'tavern-notes-lite-update-menu') closeUpdateCenter();
    });
    document.querySelector('#tavern-notes-lite-user-input-cleanup-menu')?.addEventListener('click', event => {
        if (event.target.id === 'tavern-notes-lite-user-input-cleanup-menu') closeUserInputCleanupMenu();
    });
    document.addEventListener('pointerdown', closeHeaderPopoverFromOutside, true);
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        closeFullNote();
        noteEditorView.close();
        tagView.close();
        closeExportMenu();
        closeUpdateCenter();
        themeController.close();
        closeShareCard();
    });
}

function exportFile(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
}

function toggleExportMenu() {
    const menu = document.querySelector('#tavern-notes-lite-export-menu');
    if (!menu) return;
    closeHeaderPopovers();
    noteTransferView.syncScope();
    menu.classList.toggle('open');
    menu.setAttribute('aria-hidden', menu.classList.contains('open') ? 'false' : 'true');
}

function closeExportMenu() {
    const menu = document.querySelector('#tavern-notes-lite-export-menu');
    menu?.classList.remove('open');
    menu?.setAttribute('aria-hidden', 'true');
}

function openShareCard(note) {
    shareCardController.open(note);
}

function closeShareCard() {
    shareCardController.close();
}

function syncShareCardControls() {
    const settings = state.shareCardSettings;
    document.querySelectorAll('.tn-share-choice').forEach(button => {
        button.classList.toggle('active', button.dataset.shareTheme === settings.theme);
    });
    document.querySelectorAll('.tn-share-bg').forEach(button => {
        button.classList.toggle('active', button.dataset.shareBg === settings.background);
    });
    const font = document.querySelector('#tavern-notes-lite-share-font');
    const savedFonts = document.querySelector('#tavern-notes-lite-share-saved-fonts');
    const fontSize = document.querySelector('#tavern-notes-lite-share-font-size');
    const fontSizeValue = document.querySelector('#tavern-notes-lite-share-font-size-value');
    const fontImport = document.querySelector('#tavern-notes-lite-share-font-import');
    const showCharacter = document.querySelector('#tavern-notes-lite-share-show-character');
    const showDate = document.querySelector('#tavern-notes-lite-share-show-date');
    if (font) font.value = settings.fontFamily || '';
    renderSavedShareFonts(savedFonts);
    const percent = Math.round(Math.min(Math.max(Number(settings.fontScale || 0.8), 0.65), 1.1) * 100);
    if (fontSize) fontSize.value = String(percent);
    if (fontSizeValue) fontSizeValue.textContent = `${percent}%`;
    if (fontImport) fontImport.value = settings.fontImport || '';
    if (showCharacter) showCharacter.checked = settings.showCharacter;
    if (showDate) showDate.checked = settings.showDate;
    fontController.applyCss();
}

function getShareCardAvatarUrl(note) {
    const url = getCharacterAvatar(note?.character);
    if (url) return url;
    return '';
}

function getShareCardUserName() {
    const currentName = String(name1 || '').trim();
    if (currentName && currentName !== 'User') return currentName;
    return String(state.currentUserName || currentName || 'User').trim() || 'User';
}

function getShareCardUserAvatarUrl() {
    if (!user_avatar || user_avatar === 'none') return '';
    try {
        return getThumbnailUrl('persona', user_avatar);
    } catch {
        return '';
    }
}

async function confirmDelete(note) {
    const preview = String(note.content || '').slice(0, 40).replace(/\s+/g, ' ');
    return window.confirm(t('confirmDeleteNote', {
        preview,
        ellipsis: note.content.length > 40 ? '...' : '',
    }));
}

function openFullNote(note) {
    noteDetailController.open(note);
}

function closeFullNote() {
    noteDetailController.close();
}

function parseTagsInput(value) {
    const unique = [];
    for (const part of String(value || '').split(/[,，\n]/)) {
        const tag = part.trim().replace(/^#+/, '').slice(0, 40);
        if (!tag || unique.some(item => item.toLocaleLowerCase() === tag.toLocaleLowerCase())) continue;
        unique.push(tag);
        if (unique.length >= 20) break;
    }
    return unique;
}

function renderTagSuggestions() {
    const input = document.querySelector('#tavern-notes-lite-edit-tags');
    const list = document.querySelector('#tavern-notes-lite-tag-suggestions');
    if (!input || !list) return;
    const query = normalizeTagKey(input.value);
    const selected = new Set(state.editingTags.map(normalizeTagKey));
    const suggestions = [...state.tags]
        .filter(tag => !selected.has(normalizeTagKey(tag.name)) && (!query || normalizeTagKey(tag.name).includes(query)))
        .sort((a, b) => Number(b.count || 0) - Number(a.count || 0) || a.name.localeCompare(b.name))
        .slice(0, 8);
    list.innerHTML = suggestions.map(tag => `
        <button type="button" data-suggest-tag="${htmlEscape(tag.name)}"><span>${htmlEscape(tag.name)}</span><small>${htmlEscape(tag.count)}</small></button>
    `).join('');
    list.parentElement?.classList.toggle('tnl-hidden', !suggestions.length);
}

function addSuggestedTag(tag) {
    const input = document.querySelector('#tavern-notes-lite-edit-tags');
    if (!input) return;
    addEditTags([tag]);
    input.value = '';
    rememberTag(tag);
    renderTagSuggestions();
    input.focus();
}

function renderEditTagChips() {
    const list = document.querySelector('#tavern-notes-lite-edit-tag-chips');
    if (!list) return;
    list.innerHTML = state.editingTags.map(tag => `
        <span class="tnl-edit-tag-chip"><i class="fa-solid fa-tag"></i><span>${htmlEscape(tag)}</span><button type="button" data-remove-edit-tag="${htmlEscape(tag)}" title="${htmlEscape(t('deleteTag'))}" aria-label="${htmlEscape(t('deleteTag'))}"><i class="fa-solid fa-xmark"></i></button></span>
    `).join('');
    list.classList.toggle('tnl-hidden', !state.editingTags.length);
}

function addEditTags(tags) {
    state.editingTags = parseTagsInput([...state.editingTags, ...tags].join(','));
    renderEditTagChips();
}

function commitEditTagInput() {
    const input = document.querySelector('#tavern-notes-lite-edit-tags');
    if (!input) return;
    addEditTags(parseTagsInput(input.value));
    input.value = '';
    renderTagSuggestions();
}

function removeEditTag(tag) {
    state.editingTags = state.editingTags.filter(item => normalizeTagKey(item) !== normalizeTagKey(tag));
    renderEditTagChips();
    renderTagSuggestions();
}

const quickReplyView = createQuickReplyView({
    selectors: {
        open: '#tavern-notes-lite-open',
        capture: '#tavern-notes-lite-capture',
        floating: '#tavern-notes-lite-floating-launcher',
        floatingOpen: '#tavern-notes-lite-floating-open',
        floatingCapture: '#tavern-notes-lite-floating-capture',
        modeButton: '#tavern-notes-lite-launcher-mode',
    },
    classes: {
        toolbar: 'qr--button tavern-notes-lite-qr-button interactable',
        floating: 'tnl-floating-button',
        floatingMain: 'tnl-floating-main',
        floatingCapture: 'tnl-floating-capture',
    },
    renderIcon: (kind, iconClass) => themeView.renderDefaultIcon(kind === 'open' ? DEFAULT_OPEN_ICON_URL : DEFAULT_CAPTURE_ICON_URL, iconClass),
    translate: t,
    onPositionChange: floatingPosition => updateSettings({ floatingPosition }),
});
let quickReplyController;
const quickReplyObserverController = createObserverController({
    createObserver: createMutationObserverFactory(globalThis),
    getTarget: () => document.querySelector('#send_form'),
    onRefresh: () => quickReplyController?.refresh(),
});
quickReplyController = createQuickReplyController({
    view: quickReplyView,
    getMode: () => state.launcherMode,
    saveSettings: patch => updateSettings(patch),
    findToolbar: () => document.querySelector('#qr--bar > .qr--buttons') || document.querySelector('#qr--bar'),
    createObserverController: () => quickReplyObserverController,
    notify: mode => notify(t(mode === 'floating' ? 'floatingLauncherShown' : 'toolbarLauncherShown'), 'success'),
    capabilities: {
        ...APPLICATION_CAPABILITIES,
        open: () => { if (state.open) closePanel(); else openPanel(); },
        capture: () => captureController.handleManualCapture().catch(error => notify(error.message, 'error')),
        getPosition: () => state.floatingPosition,
        iconsChanged: () => themeView.updateIcons(appStore.getSlice('theme').theme || DEFAULT_THEME),
    },
});

const applicationLifecycle = createLifecycleRegistry();
[appStore, settingsService, systemStatusController, fontController, updateController, shareCardController,
    noteDetailController, themeController, { destroy: destroyNoteFeatureLayer }, appShellView,
    headerLayoutObserverController, quickReplyController]
    .forEach(resource => applicationLifecycle.registerDestroy(() => resource.destroy()));
function destroyApplicationModules() {
    applicationLifecycle.destroyAll();
    removeMobileViewportGuard();
}

function addExtensionsMenuEntry() {
    ensureAppMenuEntry({
        documentRef: document,
        menuSelector: '#extensionsMenu',
        id: 'tavern-notes-lite-menu-entry',
        className: 'list-group-item flex-container flexGap5 interactable',
        title: t('openNotes'),
        iconMarkup: themeView.renderDefaultIcon(DEFAULT_OPEN_ICON_URL),
        label: t('appName'),
        onOpen: openPanel,
    });
}

async function openPanel() {
    const panel = document.querySelector('#tavern-notes-lite-panel');
    if (!panel) return;
    state.open = true;
    panel.classList.remove('tnl-archive-reading');
    panel.classList.add('open');
    scheduleHeaderActionLayout();
    quickReplyController.refresh();
    await noteListController.refresh();
    const list = document.querySelector('#tavern-notes-lite-list');
    if (list) list.scrollTop = 0;
}

function closePanel() {
    const panel = document.querySelector('#tavern-notes-lite-panel');
    if (!panel) return;
    closeHeaderPopovers();
    newNoteView.close();
    closeFullNote();
    noteEditorView.close();
    tagView.close();
    closeExportMenu();
    closeFloorCaptureMenu();
    closeUserInputCleanupMenu();
    themeController.close();
    closeShareCard();
    state.open = false;
    panel.classList.remove('open');
    quickReplyController.refresh();
}

async function init() {
    if (state.initialized || state.disabledByFull) return;
    const loadedSettings = await settingsService.load();
    appStore.patch('theme', {
        appleMode: loadedSettings.settings.appleGlassMode,
        defaultMode: loadedSettings.settings.defaultThemeMode,
    });
    state.initialized = true;
    installMobileViewportGuard();
    await openLiteDatabase();
    appShellView.mount();
    observeHeaderActionLayout();
    fontController.applyCss();
    await themeController.load();
    quickReplyController.mount();
    setTimeout(() => checkForTavernNotesUpdate(), 5000);

    const status = await api('/status');
    await updateSettings({ currentUserName: status.user || state.currentUserName || '' });
    await systemStatusController.refresh({ showReminder: true });
}

let application;
const removeLiteUi = () => {
    document.querySelectorAll('#tavern-notes-lite-panel, #tavern-notes-lite-floating-launcher, #tavern-notes-lite-open, #tavern-notes-lite-capture, #tavern-notes-lite-menu-entry, #tavern-notes-lite-selection-capture').forEach(element => element.remove());
    state.disabledByFull = true;
    console.info('[Tavern Notes Lite] Full edition detected. Lite has paused to avoid duplicate capture.');
};
const coexistenceController = createCoexistenceController({
    isFullActive: () => Boolean(document.querySelector(FULL_EXTENSION_SELECTORS)),
    application: { pause: reason => application?.pause(reason) },
    removeLiteUi,
    createObserver: createMutationObserverFactory(globalThis),
    getTarget: () => document.body,
    schedule: callback => queueMicrotask(callback),
});
application = createApplication({
    modules: [coexistenceController, { mount: init, destroy: destroyApplicationModules }],
    onPause: () => { state.disabledByFull = true; },
    onError: error => notify(error.message, 'error'),
});
bootstrapApplication({
    createApplication: () => application,
    events: sillyTavernEvents,
    isReady: () => document.readyState === 'complete' && Boolean(document.querySelector('#send_form')),
    onError: error => notify(error.message, 'error'),
});
