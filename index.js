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
import { extractFloorText } from './floor-capture.js';
import { toLiteThemeVariables } from './theme-compat.js';
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
const EXTENSION_VERSION = '0.1.4';
const REMOTE_MANIFEST_URL = 'https://raw.githubusercontent.com/kongkongmie/tavern-notes-lite/main/manifest.json';
const THEME_STORAGE_KEY = 'tavern-notes-lite-themes';
const ACTIVE_THEME_KEY = 'tavern-notes-lite-active-theme';
const FULL_EXTENSION_SELECTORS = '#tavern-notes-panel, #tavern-notes-open, #tavern-notes-floating-launcher, #tavern-notes-menu-entry';
const STORAGE_NOTICE_BYTES = 20 * 1024 * 1024;
const BACKUP_NOTICE_DAYS = 30;
const FONT_DB_NAME = 'tavern-notes-lite-fonts';
const FONT_DB_STORE = 'fonts';
const DEFAULT_OPEN_ICON_URL = '/scripts/extensions/third-party/tavern-notes-lite/assets/tavern-notes-lite-open.png';
const DEFAULT_CAPTURE_ICON_URL = '/scripts/extensions/third-party/tavern-notes-lite/assets/tavern-notes-lite-capture.png';
const APPLE_THEME_ID = 'apple-glass';
const MOBILE_VIEWPORT_QUERY = '(max-width: 1000px)';
const LEGACY_APPLE_THEME_DAY_ID = 'apple-glass-day';
const LEGACY_APPLE_THEME_NIGHT_ID = 'apple-glass-night';
const LEGACY_FLOOR_CAPTURE_SELECTOR = '.comment, [data-tavern-notes-content], [data-note-content], .mes_text';
const DEFAULT_FLOOR_CAPTURE_TAG = 'content';
const DEFAULT_FLOOR_CAPTURE_SELECTOR = 'content, .content, [data-tavern-notes-content], [data-note-content], .comment, .mes_text';
const FLOOR_CAPTURE_EXCLUDE_SELECTOR = [
    '.tnl-floor-capture',
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

function loadLocalSettings() {
    try {
        return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {};
    } catch {
        return {};
    }
}

const localSettings = loadLocalSettings();
const savedLanguage = ['auto', 'zh-CN', 'zh-TW', 'en', 'ko'].includes(localSettings.language)
    ? localSettings.language
    : 'auto';
const savedShareTheme = ['calendar', 'jianshu', 'dialogue', 'mobai'].includes(localSettings.shareCard?.theme)
    ? localSettings.shareCard.theme
    : 'calendar';
const savedLauncherMode = ['toolbar', 'floating'].includes(localSettings.launcherMode)
    ? localSettings.launcherMode
    : 'toolbar';

function sanitizeImportedFonts(fonts) {
    if (!Array.isArray(fonts)) return [];
    return fonts
        .filter(font => font && font.id && font.name && (font.css || font.type === 'local'))
        .map(font => ({ ...font, dataUrl: '' }))
        .slice(0, 16);
}

function normalizeInputIgnoreRules(value) {
    const items = Array.isArray(value) ? value : String(value || '').split(/\r?\n/);
    return [...new Set(items.map(item => String(item || '').trim()).filter(Boolean))].slice(0, 1000);
}

const state = {
    initialized: false,
    disabledByFull: false,
    fullGuardObserver: null,
    open: false,
    filter: 'all',
    query: '',
    tagFilter: '',
    tags: [],
    recentTags: Array.isArray(localSettings.recentTags) ? localSettings.recentTags.map(String).slice(0, 16) : [],
    tagManagerQuery: '',
    tagManagerSort: 'count',
    editingNote: null,
    editingTags: [],
    notes: [],
    characters: [],
    characterFilter: null,
    totalNotes: 0,
    counts: {},
    page: 1,
    pageSize: 15,
    status: null,
    language: savedLanguage,
    currentUserName: localSettings.currentUserName || '',
    lastCapturedMessageId: null,
    capturedUserInputs: {},
    variantIndexByGroup: {},
    lastSelection: null,
    selectionButtonTimer: null,
    lastSelectionRoot: null,
    selectionFrameObserver: null,
    boundSelectionRoots: new WeakSet(),
    floorCaptureObserver: null,
    searchTimer: null,
    qrBarObserver: null,
    theme: null,
    themes: [],
    activeThemeId: 'default',
    exportScope: 'all',
    launcherMode: savedLauncherMode,
    floatingPosition: localSettings.floatingPosition && typeof localSettings.floatingPosition === 'object' ? localSettings.floatingPosition : null,
    floatingDragMoved: false,
    autoCaptureUserInput: localSettings.autoCaptureUserInput !== false,
    collapseRepeatedUserInput: localSettings.collapseRepeatedUserInput !== false,
    userInputIgnoreExact: normalizeInputIgnoreRules(localSettings.userInputIgnoreExact),
    userInputIgnorePrefixes: normalizeInputIgnoreRules(localSettings.userInputIgnorePrefixes),
    showSelectionCaptureButton: localSettings.showSelectionCaptureButton !== false,
    showFloorCaptureButton: localSettings.showFloorCaptureButton !== false,
    floorCaptureSelector: !localSettings.floorCaptureSelector || localSettings.floorCaptureSelector === LEGACY_FLOOR_CAPTURE_SELECTOR
        ? DEFAULT_FLOOR_CAPTURE_SELECTOR
        : localSettings.floorCaptureSelector,
    appleGlassMode: localSettings.appleGlassMode === 'night' ? 'night' : 'day',
    defaultThemeMode: localSettings.defaultThemeMode === 'night' ? 'night' : 'day',
    pendingUserInputDedupeIds: [],
    shareCardNote: null,
    shareCardSettings: {
        theme: savedShareTheme,
        background: localSettings.shareCard?.background || '#eef7f2',
        textColor: localSettings.shareCard?.textColor || '',
        fontFamily: localSettings.shareCard?.fontFamily || 'system-ui',
        fontImport: localSettings.shareCard?.fontImport || '',
        importedFonts: sanitizeImportedFonts(localSettings.shareCard?.importedFonts),
        fontScale: Number(localSettings.shareCard?.fontScale || 0.8),
        showCharacter: localSettings.shareCard?.showCharacter !== false,
        showDate: localSettings.shareCard?.showDate !== false,
    },
};

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
    fullAdvantages: 'Full 需要安装后端，但支持本地文件存储、每日自动备份、多端共享同一份数据，以及完整的主题制作与融合功能。',
    importDone: '导入完成：新增 {imported} 条，跳过 {skipped} 条重复或空笔记。',
    invalidBackup: '无法导入：请选择酒馆笔记导出的 JSON 备份。',
    noPageNotesToExport: '当前页面没有可导出的笔记。',
    exportStarted: '已开始导出。',
    liteStorageStatus: '浏览器本地存储 · {size} · {count} 条',
    liteBackupReminder: 'Lite 笔记已占约 {size}，或超过 30 天没有导出备份。建议现在导出 JSON。',
    themeFiles: '主题文件',
    currentTheme: '当前：{name}',
    themeName: '主题名称',
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
    previewSave: '预览并保存',
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
        fullAdvantages: 'Full 需安裝後端，但支援本機檔案儲存、每日自動備份、多端共用同一份資料，以及完整的主題製作與融合功能。',
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
        previewSave: '預覽並儲存',
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
        confirmDeleteNote: '確定刪除這條筆記嗎？\n\n{preview}{ellipsis}',
        pasteFontFirst: '先貼上字體地址或 @import 代碼。',
        importedFont: '已匯入字體：{name}',
        importedFontCode: '已匯入字體代碼，請確認字體名稱。',
        localFontImported: '已匯入本機字體：{name}',
        localFontSessionOnly: '字體檔案較大，已臨時匯入。本次頁面可用，下次需要重新選擇檔案。',
        localFontUnsupported: '目前瀏覽器不支援本機字體匯入。',
        savedFontMissing: '這個字體缺少可讀取資料，請重新匯入。',
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
        fullAdvantages: 'Full requires the server plugin, but adds local file storage, daily automatic backups, shared data across devices, and complete theme creation and Tavern-theme merging.',
        importDone: 'Import complete: {imported} added, {skipped} duplicates or empty notes skipped.',
        invalidBackup: 'Import failed. Choose a JSON backup exported by Tavern Notes.',
        noPageNotesToExport: 'There are no notes to export on this page.',
        exportStarted: 'Export started.',
        liteStorageStatus: 'Browser storage · {size} · {count} notes',
        liteBackupReminder: 'Lite uses about {size}, or no JSON backup was exported for 30 days. Export a backup now.',
        themeFiles: 'Theme Files',
        currentTheme: 'Current: {name}',
        themeName: 'Theme name',
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
        previewSave: 'Preview & save',
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
        confirmDeleteNote: 'Delete this note?\n\n{preview}{ellipsis}',
        pasteFontFirst: 'Paste a font URL or @import code first.',
        importedFont: 'Imported font: {name}',
        importedFontCode: 'Font code imported. Please check the font name.',
        localFontImported: 'Imported local font: {name}',
        localFontSessionOnly: 'This font file is large, so it was imported for this page only. Choose it again next time.',
        localFontUnsupported: 'This browser does not support local font import.',
        savedFontMissing: 'This font has no readable data. Please import it again.',
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
        fullAdvantages: 'Full은 서버 플러그인이 필요하지만 로컬 파일 저장, 매일 자동 백업, 여러 기기에서 같은 데이터 사용, 전체 테마 제작 및 술집 테마 병합 기능을 제공합니다.',
        importDone: '가져오기 완료: {imported}개 추가, 중복 또는 빈 노트 {skipped}개 건너뜀.',
        invalidBackup: '가져올 수 없습니다. Tavern Notes에서 내보낸 JSON 백업을 선택하세요.',
        noPageNotesToExport: '현재 페이지에 내보낼 노트가 없습니다.',
        exportStarted: '내보내기를 시작했습니다.',
        liteStorageStatus: '브라우저 로컬 저장소 · {size} · {count}개',
        liteBackupReminder: 'Lite가 약 {size}를 사용 중이거나 30일 동안 JSON 백업이 없습니다. 지금 백업을 내보내세요.',
        themeFiles: '테마 파일',
        currentTheme: '현재: {name}',
        themeName: '테마 이름',
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
        previewSave: '미리보기 후 저장',
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
        confirmDeleteNote: '이 노트를 삭제할까요?\n\n{preview}{ellipsis}',
        pasteFontFirst: '먼저 글꼴 주소나 @import 코드를 붙여 넣으세요.',
        importedFont: '글꼴을 가져왔습니다: {name}',
        importedFontCode: '글꼴 코드를 가져왔습니다. 글꼴 이름을 확인하세요.',
        localFontImported: '로컬 글꼴을 가져왔습니다: {name}',
        localFontSessionOnly: '글꼴 파일이 커서 이 페이지에서만 임시로 가져왔습니다. 다음에는 파일을 다시 선택해야 합니다.',
        localFontUnsupported: '현재 브라우저는 로컬 글꼴 가져오기를 지원하지 않습니다.',
        savedFontMissing: '이 글꼴에는 읽을 수 있는 데이터가 없습니다. 다시 가져오세요.',
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
        // 基础颜色：面板纸色、文字色、弱化文字、边框、强调色。
        '--tnl-paper': '#eeede9',
        '--tnl-paper-2': '#fbfaf6',
        '--tnl-ink': '#44423e',
        '--tnl-muted': '#8f8b82',
        '--tnl-line': 'rgba(188, 183, 171, 0.34)',
        '--tnl-gold': '#f4b51f',
        '--tnl-gold-2': '#ffd45f',
        // 全局形状与阴影：面板半径、卡片半径、字体和外层投影。
        '--tnl-shadow-dark': 'rgba(151, 145, 132, 0.44)',
        '--tnl-shadow-light': 'rgba(255, 255, 255, 0.98)',
        '--tnl-radius-panel': '28px',
        '--tnl-radius-card': '24px',
        '--tnl-font-family': 'var(--mainFontFamily, inherit)',
        '--tnl-panel-border': 'rgba(255, 255, 255, 0.86)',
        // 控件与卡片：搜索框、筛选卡、按钮、弹层背景。
        '--tnl-control-bg': 'linear-gradient(145deg, #fffdf7 0%, #e4e1d8 100%)',
        '--tnl-control-bg-hover': 'linear-gradient(145deg, rgba(255, 216, 82, 0.48), rgba(255, 254, 248, 0.98)), linear-gradient(145deg, #fffdf7, #e4e1d8)',
        '--tnl-control-inset-bg': 'linear-gradient(145deg, #dedbd2 0%, #fffdf8 100%)',
        '--tnl-control-inset-shadow': 'inset 8px 8px 18px rgba(151, 145, 132, 0.24), inset -8px -8px 18px rgba(255, 255, 255, 0.92)',
        '--tnl-card-bg': 'linear-gradient(145deg, #fffdf7 0%, #e5e2d9 100%)',
        '--tnl-card-bg-active': 'radial-gradient(circle at 18% 22%, rgba(255, 212, 74, 0.58), transparent 32%), linear-gradient(145deg, #fffdf7 0%, #e5e2d9 100%)',
        '--tnl-card-active-shadow': 'inset 5px 5px 12px rgba(151, 145, 132, 0.18), inset -5px -5px 12px rgba(255, 255, 255, 0.78), 8px 8px 18px rgba(151, 145, 132, 0.2)',
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
        '--tnl-panel-glow': 'rgba(255, 215, 91, 0.24)',
        '--tnl-scrollbar-thumb': '#f4b51f',
        '--tnl-scrollbar-track': 'rgba(244, 181, 31, 0.13)',
        '--tnl-mini-button-bg': 'linear-gradient(145deg, #fffef9, #e4e1da)',
        '--tnl-mini-button-shadow': '4px 4px 9px rgba(151, 145, 132, 0.3), -4px -4px 9px rgba(255, 255, 255, 0.98)',
        '--tnl-mini-button-hover-bg': 'linear-gradient(145deg, rgba(255, 218, 94, 0.45), #fffef9)',
        '--tnl-mini-button-hover-shadow': '6px 6px 13px rgba(151, 145, 132, 0.38), -6px -6px 13px rgba(255, 255, 255, 1)',
        '--tnl-filter-hover-shadow': '15px 15px 28px rgba(151, 145, 132, 0.3), -12px -12px 24px rgba(255, 255, 255, 0.99)',
        '--tnl-filter-icon-border': 'rgba(255, 255, 255, 0.76)',
        '--tnl-filter-icon-shadow': '6px 6px 12px rgba(151, 145, 132, 0.28), -5px -5px 11px rgba(255, 255, 255, 0.96), inset 1px 1px 2px rgba(255, 255, 255, 0.82), inset -1px -1px 2px rgba(151, 145, 132, 0.12)',
        '--tnl-inline-action-bg': 'rgba(255, 253, 247, 0.42)',
        '--tnl-inline-action-hover-bg': 'rgba(255, 229, 138, 0.24)',
        '--tnl-inline-action-shadow': '3px 3px 7px rgba(151, 145, 132, 0.16), -3px -3px 7px rgba(255, 255, 255, 0.72)',
        '--tnl-inline-action-hover-shadow': 'inset 3px 3px 7px rgba(151, 145, 132, 0.14), inset -3px -3px 7px rgba(255, 255, 255, 0.78)',
        '--tnl-inline-icon-bg': 'linear-gradient(145deg, #fffdf8, #dedbd3)',
        '--tnl-inline-icon-hover-bg': 'linear-gradient(145deg, #fff7d9, #fffefa)',
        '--tnl-inline-icon-shadow': '2px 2px 5px rgba(151, 145, 132, 0.28), -2px -2px 5px rgba(255, 255, 255, 0.88)',
        // 笔记卡片：卡片背景、类型标签、User 输入/摘抄的区分色。
        '--tnl-note-bg': 'var(--tnl-card-image), var(--tnl-card-bg)',
        '--tnl-note-border': '1px solid rgba(255, 255, 255, 0.82)',
        '--tnl-note-shadow': '16px 16px 30px rgba(151, 145, 132, 0.28), -14px -14px 28px rgba(255, 255, 255, 0.98)',
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
        '--tnl-filter-shadow': '13px 13px 25px rgba(151, 145, 132, 0.28), -11px -11px 23px rgba(255, 255, 255, 0.99)',
        '--tnl-control-shadow': '9px 9px 18px rgba(151, 145, 132, 0.3), -8px -8px 18px rgba(255, 255, 255, 0.99)',
        '--tnl-inset-light': 'rgba(255, 255, 255, 0.94)',
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

const SHARE_CARD_THEMES = [
    { id: 'calendar', labelKey: 'themeCalendar' },
    { id: 'jianshu', labelKey: 'themeJianshu' },
    { id: 'dialogue', labelKey: 'themeDialogue' },
    { id: 'mobai', labelKey: 'themeMobai' },
];

const SHARE_CARD_BACKGROUNDS = ['#eef7f2', '#f4f0e5', '#fff4ec', '#edf2ff', '#f2e4b8', '#ffffff', '#1f1f1f', '#203b2a', '#182235', '#3a2330'];

const APPLE_GLASS_SHARED_VARIABLES = {
    '--tnl-radius-panel': '26px',
    '--tnl-radius-card': '18px',
    '--tnl-font-family': '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", sans-serif',
    '--tnl-text-shadow': 'transparent',
    '--tnl-mini-button-shadow': '0 0 0 1px var(--tnl-line), 0 8px 24px var(--tnl-shadow-dark)',
    '--tnl-mini-button-hover-shadow': '0 0 0 1px color-mix(in srgb, var(--tnl-gold) 24%, var(--tnl-line)), 0 10px 28px var(--tnl-shadow-dark)',
    '--tnl-filter-hover-shadow': '0 0 0 1px color-mix(in srgb, var(--tnl-gold) 24%, var(--tnl-line)), 0 14px 34px var(--tnl-shadow-dark)',
    '--tnl-filter-icon-shadow': '0 0 0 1px var(--tnl-line), 0 8px 20px var(--tnl-shadow-dark)',
    '--tnl-inline-action-bg': 'transparent',
    '--tnl-inline-action-shadow': 'none',
    '--tnl-inline-action-hover-shadow': 'none',
    '--tnl-inline-icon-shadow': '0 0 0 1px var(--tnl-line)',
    '--tnl-note-bg': 'var(--tnl-card-image), var(--tnl-card-bg)',
    '--tnl-note-shadow': '0 18px 46px var(--tnl-shadow-dark)',
    '--tnl-note-padding': '18px 20px',
    '--tnl-note-topline-bg': 'transparent',
    '--tnl-note-topline-border': '0',
    '--tnl-note-topline-padding': '0',
    '--tnl-note-topline-radius': '0',
    '--tnl-note-topline-margin': '0 0 12px',
    '--tnl-note-dot-display': 'none',
    '--tnl-filter-shadow': '0 12px 32px var(--tnl-shadow-dark)',
    '--tnl-control-shadow': '0 10px 28px var(--tnl-shadow-dark), inset 0 1px 0 rgba(255, 255, 255, 0.16)',
};

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
    const defaultTheme = normalizeTheme({ ...DEFAULT_THEME, id: 'default', name: 'Soft Neomorphism' });
    const appleTheme = normalizeTheme({
        ...DEFAULT_THEME,
        id: APPLE_THEME_ID,
        name: 'Apple Glass',
        variables: {
            ...DEFAULT_THEME.variables,
            ...APPLE_GLASS_SHARED_VARIABLES,
            ...APPLE_GLASS_DAY_VARIABLES,
            '--tnl-theme-flavor': 'apple',
        },
    });
    return [
        { id: 'default', name: defaultTheme.name, author: 'Tavern Notes Lite', builtIn: true, theme: defaultTheme },
        { id: APPLE_THEME_ID, name: appleTheme.name, author: 'Tavern Notes Lite', builtIn: true, theme: appleTheme },
    ];
}

function readLiteCustomThemes() {
    try {
        const themes = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || '[]');
        return Array.isArray(themes) ? themes.filter(item => item?.id && item?.theme) : [];
    } catch {
        return [];
    }
}

function writeLiteCustomThemes(themes) {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themes.slice(0, 20)));
}

function getLiteThemeRecords() {
    return [...getLiteBuiltInThemes(), ...readLiteCustomThemes()];
}

function getLiteActiveThemeId() {
    const requested = normalizeAppleThemeId(localStorage.getItem(ACTIVE_THEME_KEY) || 'default');
    return getLiteThemeRecords().some(item => item.id === requested) ? requested : 'default';
}

function liteThemeResponse() {
    const records = getLiteThemeRecords();
    const activeId = getLiteActiveThemeId();
    const active = records.find(item => item.id === activeId) || records[0];
    return {
        ok: true,
        activeId,
        id: activeId,
        theme: active.theme,
        activeTheme: active.theme,
        themes: records.map(({ theme, ...summary }) => ({ ...summary, name: theme?.name || summary.name })),
    };
}

async function liteThemeApi(path, options = {}) {
    const url = new URL(path, 'https://tavern-notes-lite.local');
    const method = String(options.method || 'GET').toUpperCase();
    if ((url.pathname === '/theme' || url.pathname === '/themes') && method === 'GET') return liteThemeResponse();
    const activation = url.pathname.match(/^\/themes\/([^/]+)\/activate$/);
    if (activation && method === 'POST') {
        const id = normalizeAppleThemeId(decodeURIComponent(activation[1]));
        if (!getLiteThemeRecords().some(item => item.id === id)) throw new Error(t('invalidThemeFile'));
        localStorage.setItem(ACTIVE_THEME_KEY, id);
        return liteThemeResponse();
    }
    if (url.pathname === '/themes' && method === 'POST') {
        const payload = typeof options.body === 'string' ? JSON.parse(options.body) : (options.body || {});
        const theme = normalizeTheme(payload.theme || {});
        const existingId = payload.id && !['default', APPLE_THEME_ID].includes(payload.id) ? String(payload.id) : '';
        const id = existingId || `custom-${Date.now().toString(36)}`;
        const customThemes = readLiteCustomThemes().filter(item => item.id !== id);
        customThemes.push({ id, name: theme.name || t('unnamedTheme'), author: theme.author || '', builtIn: false, theme });
        writeLiteCustomThemes(customThemes);
        if (payload.activate !== false) localStorage.setItem(ACTIVE_THEME_KEY, id);
        return { ...liteThemeResponse(), id };
    }
    const deletion = url.pathname.match(/^\/themes\/([^/]+)$/);
    if (deletion && method === 'DELETE') {
        const id = decodeURIComponent(deletion[1]);
        if (['default', APPLE_THEME_ID].includes(id)) throw new Error(t('builtInThemeCannotDelete'));
        writeLiteCustomThemes(readLiteCustomThemes().filter(item => item.id !== id));
        localStorage.setItem(ACTIVE_THEME_KEY, 'default');
        return liteThemeResponse();
    }
    return null;
}

async function api(path, options = {}) {
    if (String(path).startsWith('/theme')) {
        const themed = await liteThemeApi(path, options);
        if (themed) return themed;
    }
    return liteApi(path, options, getLiteUserName());
}

function notify(message, kind = 'info') {
    setStatus(message);
    const toastrApi = globalThis.toastr;
    if (!toastrApi) return;
    if (kind === 'success') toastrApi.success(message);
    else if (kind === 'error') toastrApi.error(message);
    else toastrApi.info(message);
}

function setStatus(message) {
    state.status = message;
    document.querySelectorAll('.tavern-notes-lite-status').forEach(el => {
        el.textContent = message;
    });
}

function compareVersions(left, right) {
    const a = String(left || '').split(/[.-]/).map(part => Number.parseInt(part, 10) || 0);
    const b = String(right || '').split(/[.-]/).map(part => Number.parseInt(part, 10) || 0);
    const length = Math.max(a.length, b.length, 3);
    for (let i = 0; i < length; i++) {
        const diff = (a[i] || 0) - (b[i] || 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

async function getInstalledVersion() {
    try {
        const response = await fetch(`/scripts/extensions/third-party/tavern-notes-lite/manifest.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return EXTENSION_VERSION;
        const manifest = await response.json();
        return manifest.version || EXTENSION_VERSION;
    } catch {
        return EXTENSION_VERSION;
    }
}

function shouldNotifyUpdate(version) {
    const today = new Date().toDateString();
    try {
        const last = JSON.parse(localStorage.getItem(UPDATE_NOTICE_KEY) || '{}') || {};
        if (last.version === version && last.date === today) return false;
    } catch {
        // Ignore malformed notice cache.
    }
    localStorage.setItem(UPDATE_NOTICE_KEY, JSON.stringify({ version, date: today }));
    return true;
}

async function checkForTavernNotesUpdate() {
    try {
        const [installedVersion, remoteResponse] = await Promise.all([
            getInstalledVersion(),
            fetch(`${REMOTE_MANIFEST_URL}?t=${Date.now()}`, { cache: 'no-store' }),
        ]);
        if (!remoteResponse.ok) return;
        const remoteManifest = await remoteResponse.json();
        const remoteVersion = remoteManifest.version;
        if (!remoteVersion || compareVersions(remoteVersion, installedVersion) <= 0) return;
        if (!shouldNotifyUpdate(remoteVersion)) return;

        const message = t('updateAvailable', { version: remoteVersion });
        const title = t('updateAvailableTitle');
        const toastrApi = globalThis.toastr;
        if (toastrApi) {
            toastrApi.info(message, title, { timeOut: 12000, extendedTimeOut: 16000 });
        } else {
            setStatus(`${title}: ${message}`);
        }
    } catch (error) {
        console.debug('[Tavern Notes Lite] Update check skipped:', error);
    }
}

function saveLocalSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        language: state.language,
        launcherMode: state.launcherMode,
        floatingPosition: state.floatingPosition,
        autoCaptureUserInput: state.autoCaptureUserInput,
        collapseRepeatedUserInput: state.collapseRepeatedUserInput,
        userInputIgnoreExact: state.userInputIgnoreExact,
        userInputIgnorePrefixes: state.userInputIgnorePrefixes,
        showSelectionCaptureButton: state.showSelectionCaptureButton,
        showFloorCaptureButton: state.showFloorCaptureButton,
        floorCaptureSelector: state.floorCaptureSelector,
        appleGlassMode: state.appleGlassMode,
        defaultThemeMode: state.defaultThemeMode,
        currentUserName: state.currentUserName,
        recentTags: state.recentTags,
        shareCard: state.shareCardSettings,
    }));
}

function saveLanguageSetting(language) {
    state.language = ['auto', 'zh-CN', 'zh-TW', 'en', 'ko'].includes(language) ? language : 'auto';
    saveLocalSettings();
    updateAutoCaptureUserInputButton();
    updateSelectionCaptureButtonSetting();
    closeHeaderPopovers();
    updateFloorCaptureButtonSetting();
    updateFloorCaptureSelectorInput();
    updateAppleThemeModeButton();
    updateLauncherModeButton();
    updateFloatingLauncher();
    notify(t('languageSaved'), 'success');
}

function getVisibleFilters() {
    return FILTERS.filter(filter => state.autoCaptureUserInput || filter.id !== 'user_input');
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

function toggleAutoCaptureUserInput() {
    state.autoCaptureUserInput = !state.autoCaptureUserInput;
    if (!state.autoCaptureUserInput && state.filter === 'user_input') {
        state.filter = 'all';
        state.page = 1;
    }
    saveLocalSettings();
    updateAutoCaptureUserInputButton();
    renderFilterTabs();
    refreshNotes();
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

function toggleSelectionCaptureButtonSetting() {
    state.showSelectionCaptureButton = !state.showSelectionCaptureButton;
    saveLocalSettings();
    updateSelectionCaptureButtonSetting();
    if (!state.showSelectionCaptureButton) hideSelectionCaptureButton();
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

function removeFloorCaptureButtons() {
    document.querySelectorAll('.tnl-floor-capture').forEach(button => button.remove());
}

function stopFloorCaptureWatcher() {
    state.floorCaptureObserver?.disconnect();
    state.floorCaptureObserver = null;
    removeFloorCaptureButtons();
}

function toggleFloorCaptureButtonSetting() {
    state.showFloorCaptureButton = !state.showFloorCaptureButton;
    saveLocalSettings();
    updateFloorCaptureButtonSetting();
    if (state.showFloorCaptureButton) {
        watchChatMessages();
    } else {
        stopFloorCaptureWatcher();
    }
    notify(state.showFloorCaptureButton ? t('floorCaptureButtonOn') : t('floorCaptureButtonOff'), 'success');
}

function saveFloorCaptureSelector(value, silent = false) {
    const next = selectorFromFloorCaptureTag(value);
    state.floorCaptureSelector = next;
    saveLocalSettings();
    updateFloorCaptureSelectorInput();
    if (state.showFloorCaptureButton) addFloorCaptureButtons();
    document.querySelector('.tnl-floor-capture-advanced')?.removeAttribute('open');
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
function addInputRules(kind) {
    const input = document.querySelector(`[data-rule-input="${kind}"]`);
    const additions = normalizeInputIgnoreRules(input?.value);
    if (!additions.length) return;
    const key = inputRuleStateKey(kind);
    state[key] = normalizeInputIgnoreRules([...state[key], ...additions]);
    if (input) input.value = '';
    saveLocalSettings();
    renderInputRuleLists();
}
function deleteInputRule(kind, value) {
    const key = inputRuleStateKey(kind);
    state[key] = state[key].filter(rule => rule !== value);
    saveLocalSettings();
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

function saveUserInputCleanupSettings() {
    state.collapseRepeatedUserInput = document.querySelector('#tavern-notes-lite-collapse-repeated-input')?.checked !== false;
    saveLocalSettings();
    syncUserInputCleanupControls();
    notify(t('inputRulesSaved'), 'success');
}

async function scanAndCleanupUserInputs() {
    const preview = await api('/user-input-dedupe');
    if (!preview.duplicateNotes) { closeUserInputDedupePreview(); return notify(t('scanNoDuplicates'), 'success'); }
    const panel = document.querySelector('#tavern-notes-lite-input-dedupe-preview');
    const summary = panel?.querySelector('.tnl-dedupe-preview-summary');
    const list = panel?.querySelector('.tnl-dedupe-preview-list');
    if (summary) summary.textContent = t('scanPreview', preview);
    if (list) list.innerHTML = (preview.items || []).map(item => `<article class="tnl-dedupe-preview-item"><div><b>${htmlEscape(item.characterName || t('unnamedCharacter'))}</b><span>${htmlEscape(item.chatName || '')}</span><em>${htmlEscape(t('dedupeOccurrences', { count: item.occurrences, duplicates: item.duplicateNotes }))}</em></div><pre>${htmlEscape(item.content)}</pre></article>`).join('');
    state.pendingUserInputDedupeIds = (preview.items || []).map(item => item.id);
    panel?.classList.remove('tn-hidden');
    panel?.scrollIntoView({ block: 'nearest' });
}
function closeUserInputDedupePreview() { document.querySelector('#tavern-notes-lite-input-dedupe-preview')?.classList.add('tn-hidden'); state.pendingUserInputDedupeIds = []; }
async function applyUserInputDedupe() {
    if (!state.pendingUserInputDedupeIds.length) return;
    const result = await api('/user-input-dedupe', { method: 'POST', body: JSON.stringify({ ids: state.pendingUserInputDedupeIds }) });
    closeUserInputDedupePreview();
    notify(t('cleanupDone', result), 'success');
    await refreshNotes();
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

function getListPath() {
    const params = new URLSearchParams();
    params.set('limit', String(state.pageSize));
    params.set('offset', String((state.page - 1) * state.pageSize));
    if (state.query.trim()) params.set('q', state.query.trim());
    if (state.tagFilter) params.set('tag', state.tagFilter);
    const currentCharacter = getCurrentCharacter();
    if (currentCharacter.id !== null) params.set('currentCharacterId', String(currentCharacter.id));
    if (!state.autoCaptureUserInput) params.set('includeUserInput', 'false');
    if (state.filter === 'user_input') params.set('type', 'user_input');
    if (state.filter === 'excerpt') params.set('type', 'excerpt');
    if (state.characterFilter) {
        if (state.characterFilter.id !== null && state.characterFilter.id !== undefined && state.characterFilter.id !== '') {
            params.set('characterId', String(state.characterFilter.id));
        } else if (state.characterFilter.name) {
            params.set('characterName', state.characterFilter.name);
        }
    }
    return `/notes?${params.toString()}`;
}

function getCharactersPath() {
    const params = new URLSearchParams();
    if (state.query.trim()) params.set('q', state.query.trim());
    if (state.tagFilter) params.set('tag', state.tagFilter);
    if (!state.autoCaptureUserInput) params.set('includeUserInput', 'false');
    return `/characters?${params.toString()}`;
}

function getTagsPath() {
    const params = new URLSearchParams();
    if (!state.autoCaptureUserInput) params.set('includeUserInput', 'false');
    if (state.characterFilter) {
        if (state.characterFilter.id !== null && state.characterFilter.id !== undefined && state.characterFilter.id !== '') {
            params.set('characterId', String(state.characterFilter.id));
        } else if (state.characterFilter.name) {
            params.set('characterName', state.characterFilter.name);
        }
    }
    return `/tags?${params.toString()}`;
}

async function refreshNotes() {
    if (!state.autoCaptureUserInput && state.filter === 'user_input') {
        state.filter = 'all';
        state.page = 1;
    }
    try {
        const [data, characterData, tagData] = await Promise.all([
            api(getListPath()),
            api(getCharactersPath()),
            api(getTagsPath()),
        ]);
        state.notes = data.notes || [];
        state.characters = characterData.characters || [];
        state.tags = tagData.tags || [];
        const isCharacterDirectory = state.filter === 'characters' && !state.characterFilter;
        state.totalNotes = isCharacterDirectory ? state.characters.length : Number(data.totalNotes || 0);
        state.counts = data.counts || {};
        const maxPage = getMaxPage();
        if (state.page > maxPage) {
            state.page = maxPage;
            await refreshNotes();
            return;
        }
        renderNotes();
        if (isCharacterDirectory) {
            setStatus(t('shownCharacters', { count: state.characters.length }));
        } else {
            setStatus(t('shownNotes', { shown: state.notes.length, total: state.totalNotes }));
        }
    } catch (error) {
        notify(error.message, 'error');
    }
}

function getMaxPage() {
    return Math.max(1, Math.ceil(state.totalNotes / state.pageSize));
}

function isLongNote(note) {
    const content = String(note.content || '');
    return content.length > 120 || content.split(/\r?\n/).length > 3;
}

function renderNoteTags(note) {
    const tags = Array.isArray(note?.tags) ? note.tags : [];
    if (!tags.length) return '';
    return `<div class="tnl-note-tags">${tags.map(tag => `
        <button class="tnl-tag-chip ${state.tagFilter === tag ? 'active' : ''}" type="button" data-tag="${htmlEscape(tag)}" title="${htmlEscape(t('filterByTag', { tag }))}">
            <i class="fa-solid fa-tag"></i><span>${htmlEscape(tag)}</span>
        </button>
    `).join('')}</div>`;
}

function renderTagShelf() {
    const shelf = document.querySelector('#tavern-notes-lite-tag-shelf');
    if (!shelf) return;
    shelf.classList.remove('tnl-hidden');
    const homeTags = getHomeTags();
    shelf.innerHTML = `
        <button class="tnl-tag-filter tnl-tag-library-open" type="button">
            <i class="fa-solid fa-tags"></i><span>${htmlEscape(t('allTags'))}</span><small>${htmlEscape(state.tags.length)}</small>
        </button>
        ${state.tagFilter ? `
            <button class="tnl-tag-filter tnl-tag-clear active" type="button" data-tag="">
                <i class="fa-solid fa-xmark"></i><span>${htmlEscape(t('clearTagFilter'))}</span>
            </button>
        ` : ''}
        ${homeTags.map(tag => `
            <button class="tnl-tag-filter ${state.tagFilter === tag.name ? 'active' : ''}" type="button" data-tag="${htmlEscape(tag.name)}">
                <span>${htmlEscape(tag.name)}</span><small>${htmlEscape(tag.count)}</small>
            </button>
        `).join('')}
        ${!state.tags.length ? `
            <div class="tnl-tag-shelf-empty"><i class="fa-solid fa-pen-to-square"></i><span>${htmlEscape(t('tagShelfEmpty'))}</span></div>
        ` : ''}
    `;
}

function normalizeTagKey(tag) {
    return String(tag || '').trim().toLocaleLowerCase();
}

function rememberTag(tag) {
    const name = String(tag || '').trim();
    if (!name) return;
    const key = normalizeTagKey(name);
    state.recentTags = [name, ...state.recentTags.filter(item => normalizeTagKey(item) !== key)].slice(0, 16);
    saveLocalSettings();
}

function getHomeTags() {
    const tagsByKey = new Map(state.tags.map(tag => [normalizeTagKey(tag.name), tag]));
    const selected = [];
    const append = tag => {
        if (!tag || selected.some(item => normalizeTagKey(item.name) === normalizeTagKey(tag.name))) return;
        selected.push(tag);
    };
    if (state.tagFilter) append(tagsByKey.get(normalizeTagKey(state.tagFilter)));
    state.recentTags.forEach(name => append(tagsByKey.get(normalizeTagKey(name))));
    [...state.tags].sort((a, b) => Number(b.count || 0) - Number(a.count || 0) || a.name.localeCompare(b.name)).forEach(append);
    return selected.slice(0, 12);
}

function renderTagLibrary() {
    const list = document.querySelector('#tavern-notes-lite-tag-library-list');
    if (!list) return;
    const card = list.closest('.tnl-tag-library-card');
    card?.classList.toggle('is-empty', state.tags.length === 0);
    const query = normalizeTagKey(state.tagManagerQuery);
    const tags = state.tags
        .filter(tag => !query || normalizeTagKey(tag.name).includes(query))
        .sort((a, b) => state.tagManagerSort === 'name'
            ? a.name.localeCompare(b.name)
            : Number(b.count || 0) - Number(a.count || 0) || a.name.localeCompare(b.name));
    list.innerHTML = tags.length ? tags.map(tag => `
        <div class="tnl-tag-library-row ${state.tagFilter === tag.name ? 'active' : ''}">
            <button class="tnl-tag-library-item ${state.tagFilter === tag.name ? 'active' : ''}" type="button" data-tag="${htmlEscape(tag.name)}">
                <i class="fa-solid fa-tag"></i><span>${htmlEscape(tag.name)}</span><small>${htmlEscape(tag.count)}</small>
            </button>
            <button class="tnl-tag-rename" type="button" data-rename-tag="${htmlEscape(tag.name)}" data-tag-count="${htmlEscape(tag.count)}" title="${htmlEscape(t('renameTag'))}"><i class="fa-solid fa-pen"></i></button>
            <button class="tnl-tag-delete" type="button" data-delete-tag="${htmlEscape(tag.name)}" data-tag-count="${htmlEscape(tag.count)}" title="${htmlEscape(t('deleteTag'))}" aria-label="${htmlEscape(t('deleteTag'))}"><i class="fa-solid fa-trash-can"></i></button>
        </div>
    `).join('') : state.tags.length ? `<div class="tnl-tag-library-empty">${htmlEscape(t('noMatchingTags'))}</div>` : `
        <div class="tnl-tag-empty-guide">
            <div class="tnl-tag-empty-icon"><i class="fa-solid fa-tags"></i><i class="fa-solid fa-plus"></i></div>
            <strong>${htmlEscape(t('tagEmptyTitle'))}</strong>
            <p>${htmlEscape(t('tagEmptyIntro'))}</p>
            <ol>
                <li><b>1</b><span>${htmlEscape(t('tagEmptyStepEdit'))}</span></li>
                <li><b>2</b><span>${htmlEscape(t('tagEmptyStepAdd'))}</span></li>
                <li><b>3</b><span>${htmlEscape(t('tagEmptyStepSave'))}</span></li>
            </ol>
            <button class="tnl-tag-library-back" type="button"><i class="fa-solid fa-arrow-left"></i><span>${htmlEscape(t('backToNotes'))}</span></button>
        </div>`;
    document.querySelectorAll('#tavern-notes-lite-tag-library [data-tag-sort]').forEach(button => {
        button.classList.toggle('active', button.dataset.tagSort === state.tagManagerSort);
    });
}

function openTagLibrary() {
    const menu = document.querySelector('#tavern-notes-lite-tag-library');
    if (!menu) return;
    closeHeaderPopovers();
    state.tagManagerQuery = '';
    const search = document.querySelector('#tavern-notes-lite-tag-search');
    if (search) search.value = '';
    renderTagLibrary();
    menu.classList.add('open');
    menu.setAttribute('aria-hidden', 'false');
    setTimeout(() => search?.focus(), 0);
}

function closeTagLibrary() {
    const menu = document.querySelector('#tavern-notes-lite-tag-library');
    menu?.classList.remove('open');
    menu?.setAttribute('aria-hidden', 'true');
}

async function deleteTagEverywhere(tag, count) {
    if (!window.confirm(t('confirmDeleteTag', { tag, count }))) return;
    const result = await api(`/tags/${encodeURIComponent(tag)}`, { method: 'DELETE' });
    state.recentTags = state.recentTags.filter(item => normalizeTagKey(item) !== normalizeTagKey(tag));
    if (normalizeTagKey(state.tagFilter) === normalizeTagKey(tag)) state.tagFilter = '';
    state.page = 1;
    saveLocalSettings();
    await refreshNotes();
    renderTagLibrary();
    notify(t('tagDeleted', { tag, count: result.updated ?? count }), 'success');
}

async function renameTagEverywhere(tag, count) {
    const next = String(window.prompt(t('renameTagPrompt', { tag }), tag) || '').trim();
    if (!next || normalizeTagKey(next) === normalizeTagKey(tag)) return;
    const result = await api(`/tags/${encodeURIComponent(tag)}`, { method: 'PATCH', body: JSON.stringify({ name: next }) });
    state.recentTags = state.recentTags.map(item => normalizeTagKey(item) === normalizeTagKey(tag) ? result.newTag : item);
    if (normalizeTagKey(state.tagFilter) === normalizeTagKey(tag)) state.tagFilter = result.newTag;
    saveLocalSettings(); await refreshNotes(); renderTagLibrary();
    notify(t('tagRenamed', { oldTag: tag, newTag: result.newTag, count: result.updated ?? count }), 'success');
}

function setTagFilter(tag = '') {
    state.tagFilter = String(tag || '');
    if (state.tagFilter) rememberTag(state.tagFilter);
    state.page = 1;
    refreshNotes();
}

function updateArchiveReadingMode() {
    const panel = document.querySelector('#tavern-notes-lite-panel');
    const list = document.querySelector('#tavern-notes-lite-list');
    if (!panel || !list) return;
    if (panel.dataset.themeFlavor !== 'archive') {
        panel.classList.remove('tnl-archive-reading');
        return;
    }

    const threshold = panel.classList.contains('tnl-archive-reading') ? 4 : 24;
    panel.classList.toggle('tnl-archive-reading', list.scrollTop > threshold);
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

function renderVariantControls(note) {
    const variants = getNoteVariants(note);
    if (variants.length <= 1) return '';
    const index = getVariantIndex(note);
    return `
        <button class="tnl-variant-side tnl-variant-prev" type="button" ${index <= 0 ? 'disabled' : ''} title="上一个版本">
            <i class="fa-solid fa-chevron-left"></i>
        </button>
        <button class="tnl-variant-side tnl-variant-next" type="button" ${index >= variants.length - 1 ? 'disabled' : ''} title="下一个版本">
            <i class="fa-solid fa-chevron-right"></i>
        </button>
        <span class="tnl-variant-count">${index + 1}/${variants.length}</span>
    `;
}

function renderCharacterOverview() {
    if (state.filter !== 'characters' || state.characterFilter) return '';
    const current = getCurrentCharacterSummary();
    const currentKey = getCharacterKey(current);
    const userCharacter = state.characters.find(character => character.isUser || character.id === 'tavern-notes-user');
    const restCharacters = state.characters.filter(character => getCharacterKey(character) !== currentKey && character !== userCharacter);

    if (!state.characters.length && !current.name) {
        const emptyHint = state.autoCaptureUserInput ? t('noCharacterNotesHint') : t('noCharacterNotesHintNoUserInput');
        return `
            <div class="tnl-empty">
                <div class="tnl-empty-orb"><i class="fa-solid fa-user"></i></div>
                <div class="tnl-empty-title">${htmlEscape(t('noCharacterNotes'))}</div>
                <small>${htmlEscape(emptyHint)}</small>
            </div>
        `;
    }

    const renderCard = (character, isCurrent = false) => {
        const avatar = getCharacterAvatar(character);
        const userInputPart = state.autoCaptureUserInput ? ` · ${htmlEscape(t('userInput'))} ${htmlEscape(character.userInput)}` : '';
        return `
            <button class="tnl-character-card ${isCurrent ? 'tnl-character-current' : ''}" type="button"
                data-character-id="${htmlEscape(character.id ?? '')}"
                data-character-name="${htmlEscape(character.name || '')}">
                <span class="tnl-character-avatar">
                    ${avatar
                        ? `<img src="${htmlEscape(avatar)}" alt="${htmlEscape(character.name || t('characterName'))}" loading="lazy" />`
                        : `<span>${htmlEscape(getCharacterInitial(character.name))}</span>`}
                </span>
                <span class="tnl-character-info">
                    <b>${htmlEscape(character.name || t('unnamedCharacter'))}${isCurrent ? `<em>${htmlEscape(t('currentCharacter'))}</em>` : ''}</b>
                    <small>${htmlEscape(character.total)}${userInputPart} · ${htmlEscape(t('excerpt'))} ${htmlEscape(character.excerpt)}</small>
                </span>
                <i class="fa-solid fa-chevron-right"></i>
            </button>
        `;
    };

    const cards = restCharacters.map(character => renderCard(character)).join('');

    return `
        <section class="tnl-character-overview">
            <div class="tnl-section-title">
                <span>${htmlEscape(t('currentCharacter'))}</span>
                <small>${htmlEscape(t('priority'))}</small>
            </div>
            <div class="tnl-character-featured">${userCharacter ? renderCard(userCharacter) : ''}${getCharacterKey(userCharacter) !== currentKey ? renderCard(current, true) : ''}</div>
            <div class="tnl-section-title">
                <span>${htmlEscape(t('browseByCharacter'))}</span>
                <small>${htmlEscape(t('characterCount', { count: state.characters.length }))}</small>
            </div>
            ${cards ? `<div class="tnl-character-grid">${cards}</div>` : `<div class="tnl-character-empty-line">${htmlEscape(t('otherCharactersEmpty'))}</div>`}
        </section>
    `;
}

function renderCharacterScope() {
    if (!state.characterFilter) return '';
    const avatar = getCharacterAvatar(state.characterFilter);
    return `
        <section class="tnl-character-scope">
            <span class="tnl-character-avatar">
                ${avatar
                    ? `<img src="${htmlEscape(avatar)}" alt="${htmlEscape(state.characterFilter.name || t('characterName'))}" loading="lazy" />`
                    : `<span>${htmlEscape(getCharacterInitial(state.characterFilter.name))}</span>`}
            </span>
            <div>
                <b>${htmlEscape(state.characterFilter.name || t('unnamedCharacter'))}</b>
                <small>${htmlEscape(t('viewingCharacter'))}</small>
            </div>
            <button class="tnl-clear-character" type="button"><i class="fa-solid fa-arrow-left"></i><span>${htmlEscape(t('backCharacters'))}</span></button>
        </section>
    `;
}

function renderNoteArticles() {
    if (!state.notes.length) {
        const emptyHint = state.autoCaptureUserInput ? t('noNotesHint') : t('noNotesHintNoUserInput');
        return `
            <div class="tnl-empty">
                <div class="tnl-empty-orb"><i class="fa-regular fa-note-sticky"></i></div>
                <div class="tnl-empty-title">${htmlEscape(t('noNotes'))}</div>
                <small>${htmlEscape(emptyHint)}</small>
            </div>
        `;
    }

    return state.notes.map(note => {
        const activeNote = getActiveVariant(note);
        const created = activeNote.createdAt ? new Date(activeNote.createdAt).toLocaleString() : '';
        const messageId = activeNote.chat?.messageId ?? note.chat?.messageId ?? '-';
        const chatName = activeNote.chat?.name || note.chat?.name || '';
        return `
            <article class="tnl-note tnl-note-${htmlEscape(noteTypeClass(note.type))}" data-note-id="${htmlEscape(note.id)}" data-chat-name="${htmlEscape(chatName)}">
                ${renderVariantControls(note)}
                <div class="tnl-note-topline">
                    <span class="tnl-note-type">${htmlEscape(noteTypeLabel(note.type))}</span>
                    ${Number(activeNote.repeatCount || 1) > 1 ? `<span class="tnl-repeat-badge"><i class="fa-solid fa-repeat"></i>${htmlEscape(t('repeatedTimes', { count: activeNote.repeatCount }))}</span>` : ''}
                    <span class="tnl-note-character">${htmlEscape(note.character?.name || t('unnamedCharacter'))}</span>
                    <span class="tnl-note-muted">${htmlEscape(chatName)}</span>
                    <span class="tnl-note-muted">#${htmlEscape(messageId)}</span>
                    <span class="tnl-note-time">${htmlEscape(created)}</span>
                </div>
                <div class="tnl-note-body">
                    <div class="tnl-note-content">${renderQuotedText(activeNote.content)}</div>
                    ${isLongNote(activeNote) ? `<button class="tnl-expand" title="${htmlEscape(t('viewFull'))}">...</button>` : ''}
                </div>
                ${renderNoteTags(activeNote)}
                <div class="tnl-note-actions">
                    <button class="menu_button tnl-fill" title="${htmlEscape(t('fillInput'))}">
                        <i class="fa-solid fa-arrow-turn-down"></i><span>${htmlEscape(t('fillInput'))}</span>
                    </button>
                    <button class="menu_button tnl-copy" title="${htmlEscape(t('copy'))}">
                        <i class="fa-regular fa-copy"></i><span>${htmlEscape(t('copy'))}</span>
                    </button>
                    <button class="menu_button tnl-share" title="${htmlEscape(t('share'))}">
                        <i class="fa-solid fa-share-nodes"></i><span>${htmlEscape(t('share'))}</span>
                    </button>
                    <button class="menu_button tnl-edit" title="${htmlEscape(t('editNote'))}">
                        <i class="fa-solid fa-pen"></i><span>${htmlEscape(t('edit'))}</span>
                    </button>
                    <button class="menu_button tnl-delete" title="${htmlEscape(t('delete'))}">
                        <i class="fa-regular fa-trash-can"></i><span>${htmlEscape(t('delete'))}</span>
                    </button>
                </div>
            </article>
        `;
    }).join('');
}

function renderNotes() {
    const list = document.querySelector('#tavern-notes-lite-list');
    if (!list) return;

    renderFilterTabs();
    renderTagShelf();
    updateFilterCounts();
    updateCharacterScopeStyle();
    const isCharacterDirectory = state.filter === 'characters' && !state.characterFilter;
    list.innerHTML = isCharacterDirectory ? renderCharacterOverview() : `${renderCharacterScope()}${renderNoteArticles()}`;
    renderPagination(!isCharacterDirectory);
}

function updateCharacterScopeStyle() {
    const panel = document.querySelector('#tavern-notes-lite-panel');
    if (!panel) return;

    const avatar = getCharacterAvatar(state.characterFilter);
    panel.classList.toggle('tnl-character-scoped', Boolean(state.characterFilter && avatar));
    if (!state.characterFilter || !avatar) {
        panel.style.removeProperty('--tnl-scope-avatar');
        return;
    }

    panel.style.setProperty('--tnl-scope-avatar', `url("${avatar.replaceAll('"', '\\"')}")`);
}

function updateFilterCounts() {
    const scopedCharacter = state.characterFilter;
    const countMap = {
        all: scopedCharacter ? scopedCharacter.total : (state.counts.all ?? state.totalNotes),
        characters: state.characters.length,
        user_input: scopedCharacter ? scopedCharacter.userInput : (state.counts.user_input ?? 0),
        excerpt: scopedCharacter ? scopedCharacter.excerpt : (state.counts.excerpt ?? 0),
    };
    document.querySelectorAll('.tnl-filter-count').forEach(el => {
        const key = el.closest('.tnl-filter')?.dataset.filter;
        el.textContent = countMap[key] === '' ? '' : String(countMap[key] ?? '');
    });
}

function renderFilterTabs() {
    const nav = document.querySelector('.tnl-filters');
    if (!nav) return;
    nav.innerHTML = getVisibleFilters().map(filter => `
        <button class="tnl-filter ${filter.id === state.filter ? 'active' : ''}" data-filter="${filter.id}">
            <span class="tnl-filter-icon"><i class="fa-solid ${filter.icon}"></i></span>
            <span class="tnl-filter-text">
                <b>${htmlEscape(t(filter.label))}</b>
                <small>${htmlEscape(t(filter.hint))}</small>
            </span>
            <span class="tnl-filter-count"></span>
        </button>
    `).join('');
    updateFilterCounts();
}

function findNoteGroupFromElement(element) {
    const article = element.closest('.tnl-note');
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

async function saveNote(payload) {
    const data = await api('/notes', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    if (state.open) await refreshNotes();
    return data.note;
}

async function captureSelection() {
    if (state.disabledByFull) return;
    const currentSnapshot = getCurrentSelectionSnapshot();
    const cached = state.lastSelection;
    const canUseCached = cached?.text && Date.now() - cached.time < 10 * 60 * 1000;
    const selected = currentSnapshot?.text || (canUseCached ? cached.text : '');
    const messageId = currentSnapshot ? currentSnapshot.messageId : cached?.messageId;
    const source = currentSnapshot?.source || cached?.source || 'selected_text';

    if (!selected) {
        notify(t('selectTextFirst'));
        return;
    }

    await saveNote({
        type: 'excerpt',
        content: selected,
        character: getCurrentCharacter(),
        chat: {
            id: getChatName(),
            name: getChatName(),
            messageId,
        },
        source,
    });
    notify(t('captured'), 'success');
    dismissSelectionCaptureButton();
}

function getUserNoteCharacter() { return { id: 'tavern-notes-user', name: getShareCardUserName(), avatar: user_avatar || null, isUser: true }; }
function openNewNoteMenu() {
    const menu = document.querySelector('#tavern-notes-lite-new-note-menu');
    const content = document.querySelector('#tavern-notes-lite-new-note-content');
    const tags = document.querySelector('#tavern-notes-lite-new-note-tags');
    if (!menu) return; closeHeaderPopovers(); if (content) content.value = ''; if (tags) tags.value = t('inspirationTag');
    menu.classList.add('open'); menu.setAttribute('aria-hidden', 'false'); setTimeout(() => content?.focus(), 0);
}
function closeNewNoteMenu() { const menu = document.querySelector('#tavern-notes-lite-new-note-menu'); menu?.classList.remove('open'); menu?.setAttribute('aria-hidden', 'true'); }
async function saveNewUserNote() {
    const content = String(document.querySelector('#tavern-notes-lite-new-note-content')?.value || '').trim();
    if (!content) return notify(t('noteContentRequired'), 'warning');
    const tags = parseTagsInput(document.querySelector('#tavern-notes-lite-new-note-tags')?.value || t('inspirationTag'));
    await saveNote({ type: 'user_input', content, tags, character: getUserNoteCharacter(), chat: { id: getChatName(), name: getChatName(), messageId: null }, source: 'manual_inspiration', collapseRepeated: false });
    closeNewNoteMenu(); notify(t('newNoteSaved'), 'success'); await refreshNotes();
}
function closeHeaderPopovers() { document.querySelectorAll('.tnl-header-popover.open').forEach(menu => menu.classList.remove('open')); }
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
        excludeSelector: FLOOR_CAPTURE_EXCLUDE_SELECTOR,
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

async function captureMessageFloor(messageElement) {
    if (state.disabledByFull) return;
    const messageId = getMessageIdFromElement(messageElement);
    const message = messageId !== null ? chat?.[messageId] : null;
    const content = getMessageTextFromElement(messageElement, message?.mes)
        || htmlToPlainText(message?.mes || '').trim();

    if (!content) {
        notify(t('captureFloorEmpty'), 'warning');
        return;
    }

    await saveNote({
        type: 'excerpt',
        content,
        character: getMessageCharacterForCapture(messageId),
        chat: {
            id: getChatName(),
            name: getChatName(),
            messageId,
        },
        source: 'message_floor',
    });
    notify(t('captured'), 'success');
}

function getSelectionMessageId(selection = window.getSelection()) {
    if (!selection || selection.rangeCount === 0) return null;

    const nodes = [selection.anchorNode, selection.focusNode];
    for (const startNode of nodes) {
        let node = startNode;
        while (node && node !== document.body) {
            const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
            const message = element?.closest?.('[mesid], .mes');
            const id = message?.getAttribute?.('mesid') || message?.dataset?.mesid;
            if (id !== undefined && id !== null) return Number(id);
            node = node.parentNode;
        }
    }
    return null;
}

function rememberSelection() {
    if (!state.showSelectionCaptureButton) return;
    const snapshot = getCurrentSelectionSnapshot();
    if (!snapshot?.text) {
        hideSelectionCaptureButton();
        return;
    }
    state.lastSelection = {
        ...snapshot,
        time: Date.now(),
    };
    scheduleSelectionCaptureButton();
}

function selectionIsInsideIgnoredElement(selection = window.getSelection()) {
    if (!selection || selection.rangeCount === 0) return true;
    const nodes = [selection.anchorNode, selection.focusNode];
    return nodes.some(startNode => {
        let node = startNode;
        while (node && node !== document.body) {
            const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
            if (element?.closest?.('#tavern-notes-lite-panel, #tavern-notes-lite-selection-capture, select')) {
                return true;
            }
            node = node.parentNode;
        }
        return false;
    });
}

function getActiveInputSelection() {
    return getInputSelectionFromElement(document.activeElement);
}

function getInputSelectionFromElement(element, frameRect = null) {
    const tagName = String(element?.tagName || '').toUpperCase();
    if (!['INPUT', 'TEXTAREA'].includes(tagName)) return null;
    if (element.closest('#tavern-notes-lite-panel, #tavern-notes-lite-selection-capture')) return null;
    if (typeof element.selectionStart !== 'number' || typeof element.selectionEnd !== 'number') return null;
    const start = Math.min(element.selectionStart, element.selectionEnd);
    const end = Math.max(element.selectionStart, element.selectionEnd);
    const text = String(element.value || '').slice(start, end).trim();
    if (!text) return null;
    const rect = offsetRect(element.getBoundingClientRect(), frameRect);
    return {
        text,
        messageId: null,
        source: element === getInputBox() || element.closest('#send_form') ? 'input_selection' : 'selected_text',
        rect,
    };
}

function offsetRect(rect, offset = null) {
    if (!rect || !offset) return rect;
    return {
        left: rect.left + offset.left,
        right: rect.right + offset.left,
        top: rect.top + offset.top,
        bottom: rect.bottom + offset.top,
        width: rect.width,
        height: rect.height,
    };
}

function getSelectionRect(selection = window.getSelection(), offset = null) {
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(selection.rangeCount - 1);
    const rects = Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0);
    return offsetRect(rects.at(-1) || range.getBoundingClientRect(), offset);
}

function getRootSelection(root) {
    try {
        if (!root) return null;
        if (typeof root.getSelection === 'function') return root.getSelection();
        if (root.defaultView?.getSelection) return root.defaultView.getSelection();
        if (root.ownerDocument?.defaultView?.getSelection) return root.ownerDocument.defaultView.getSelection();
    } catch {
        return null;
    }
    return null;
}

function getSelectionSnapshotFromSelection(selection, offset = null) {
    const text = selection?.toString()?.trim();
    if (!text || selectionIsInsideIgnoredElement(selection)) return null;
    return {
        text,
        messageId: getSelectionMessageId(selection),
        source: 'selected_text',
        rect: getSelectionRect(selection, offset),
    };
}

function getFrameSelectionSnapshot(frame) {
    try {
        const frameRect = frame.getBoundingClientRect();
        const doc = frame.contentDocument;
        const win = frame.contentWindow;
        const inputSelection = getInputSelectionFromElement(doc?.activeElement, frameRect);
        if (inputSelection) return inputSelection;
        return getSelectionSnapshotFromSelection(win?.getSelection?.(), frameRect);
    } catch {
        return null;
    }
}

function getCurrentSelectionSnapshot() {
    const inputSelection = getActiveInputSelection();
    if (inputSelection) return inputSelection;

    const roots = [
        state.lastSelectionRoot,
        document,
        window,
    ].filter(Boolean);
    for (const root of roots) {
        const snapshot = getSelectionSnapshotFromSelection(getRootSelection(root));
        if (snapshot) return snapshot;
    }

    for (const frame of document.querySelectorAll('iframe')) {
        const snapshot = getFrameSelectionSnapshot(frame);
        if (snapshot) return snapshot;
    }
    return null;
}

function ensureSelectionCaptureButton() {
    let button = document.querySelector('#tavern-notes-lite-selection-capture');
    if (button) return button;
    button = document.createElement('button');
    button.id = 'tavern-notes-lite-selection-capture';
    button.className = 'tnl-selection-capture';
    button.type = 'button';
    button.innerHTML = `<i class="fa-solid fa-highlighter"></i><span>${htmlEscape(t('captureSelected'))}</span>`;
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', event => {
        event.preventDefault();
        captureSelection().catch(error => notify(error.message, 'error'));
        dismissSelectionCaptureButton();
    });
    document.body.append(button);
    return button;
}

function hideSelectionCaptureButton() {
    document.querySelector('#tavern-notes-lite-selection-capture')?.classList.remove('show');
}

function dismissSelectionCaptureButton() {
    state.lastSelection = null;
    clearTimeout(state.selectionButtonTimer);
    hideSelectionCaptureButton();
    try {
        window.getSelection()?.removeAllRanges();
    } catch {
        // Some embedded selections cannot be cleared from the parent page.
    }
    setTimeout(hideSelectionCaptureButton, 120);
}

function updateSelectionCaptureButton() {
    if (!state.showSelectionCaptureButton) {
        hideSelectionCaptureButton();
        return;
    }
    const snapshot = getCurrentSelectionSnapshot();
    if (!snapshot?.text) {
        hideSelectionCaptureButton();
        return;
    }
    const rect = snapshot.rect;
    if (!rect || (!rect.width && !rect.height)) {
        hideSelectionCaptureButton();
        return;
    }
    const button = ensureSelectionCaptureButton();
    button.title = t('captureSelectedTitle');
    button.setAttribute('aria-label', t('captureSelectedTitle'));
    button.querySelector('span')?.replaceChildren(document.createTextNode(t('captureSelected')));

    const margin = 8;
    const buttonWidth = button.offsetWidth || 92;
    const buttonHeight = button.offsetHeight || 34;
    const left = Math.min(
        Math.max(rect.right + margin, margin),
        window.innerWidth - buttonWidth - margin,
    );
    const top = Math.min(
        Math.max(rect.bottom + margin, margin),
        window.innerHeight - buttonHeight - margin,
    );
    button.style.left = `${left}px`;
    button.style.top = `${top}px`;
    button.classList.add('show');
}

function scheduleSelectionCaptureButton(event = null) {
    if (!state.showSelectionCaptureButton) {
        hideSelectionCaptureButton();
        return;
    }
    const root = event?.target?.getRootNode?.();
    if (root) state.lastSelectionRoot = root;
    clearTimeout(state.selectionButtonTimer);
    state.selectionButtonTimer = setTimeout(updateSelectionCaptureButton, 80);
}

function bindSelectionListeners(root) {
    if (!root || state.boundSelectionRoots.has(root)) return;
    state.boundSelectionRoots.add(root);
    root.addEventListener('selectionchange', rememberSelection);
    root.addEventListener('mouseup', scheduleSelectionCaptureButton);
    root.addEventListener('keyup', scheduleSelectionCaptureButton);
    root.addEventListener('select', scheduleSelectionCaptureButton, true);
    root.addEventListener('touchend', scheduleSelectionCaptureButton, { passive: true });
}

function bindIframeSelectionListeners() {
    for (const frame of document.querySelectorAll('iframe')) {
        try {
            if (frame.contentDocument) bindSelectionListeners(frame.contentDocument);
        } catch {
            // Cross-origin frames cannot be inspected; skip quietly.
        }
    }
}

function bindShadowSelectionListeners(root = document) {
    const elements = root.querySelectorAll?.('*') || [];
    for (const element of elements) {
        if (!element.shadowRoot) continue;
        bindSelectionListeners(element.shadowRoot);
        bindShadowSelectionListeners(element.shadowRoot);
    }
}

function watchSelectionFrames() {
    bindSelectionListeners(document);
    bindIframeSelectionListeners();
    bindShadowSelectionListeners();
    if (state.selectionFrameObserver) return;
    state.selectionFrameObserver = new MutationObserver(() => {
        bindIframeSelectionListeners();
        bindShadowSelectionListeners();
    });
    state.selectionFrameObserver.observe(document.body, { childList: true, subtree: true });
}

async function captureUserMessage(messageId) {
    if (state.disabledByFull) return;
    if (!state.autoCaptureUserInput) return;
    const message = chat?.[messageId];
    if (!message || !message.is_user || !String(message.mes || '').trim()) return;
    const content = String(message.mes || '').trim();
    if (state.userInputIgnoreExact.includes(content)
        || state.userInputIgnorePrefixes.some(prefix => content.startsWith(prefix))) return;
    const cacheKey = `${getChatName()}::${messageId}`;
    if (messageId === state.lastCapturedMessageId && state.capturedUserInputs[cacheKey] === content) return;
    if (state.capturedUserInputs[cacheKey] === content) return;
    state.lastCapturedMessageId = messageId;
    state.capturedUserInputs[cacheKey] = content;

    await saveNote({
        type: 'user_input',
        content,
        character: getCurrentCharacter(),
        chat: {
            id: getChatName(),
            name: getChatName(),
            messageId,
        },
        source: 'message_sent',
        collapseRepeated: state.collapseRepeatedUserInput,
    }).catch(error => notify(error.message, 'error'));
}

function setActiveFilter(filter) {
    if (!state.autoCaptureUserInput && filter === 'user_input') filter = 'all';
    state.filter = filter;
    if (filter === 'characters') state.characterFilter = null;
    state.page = 1;
    document.querySelectorAll('.tnl-filter').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === filter);
    });
    refreshNotes();
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
    state.page = 1;
    document.querySelectorAll('.tnl-filter').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === 'all');
    });
    refreshNotes();
}

function clearCharacterFilter() {
    state.characterFilter = null;
    state.filter = 'characters';
    state.page = 1;
    document.querySelectorAll('.tnl-filter').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === 'characters');
    });
    refreshNotes();
}

function buildPanel() {
    if (document.querySelector('#tavern-notes-lite-panel')) return;

    document.body.insertAdjacentHTML('beforeend', `
        <section id="tavern-notes-lite-panel" aria-label="${htmlEscape(t('appName'))}">
            <header class="tnl-header">
                <div class="tnl-brand-mark">${renderDefaultIcon(DEFAULT_OPEN_ICON_URL)}</div>
                <div class="tnl-heading">
                    <div class="tnl-title">${htmlEscape(t('appName'))} <span>@KKM</span></div>
                    <div class="tnl-subtitle">${htmlEscape(t('subtitle'))}</div>
                </div>
                <div class="tnl-window-actions">
                    <button id="tavern-notes-lite-launcher-mode" class="tnl-soft-button tnl-window-soft-button" title="${htmlEscape(t('switchLauncherMode'))}" aria-label="${htmlEscape(t('switchLauncherMode'))}">
                        <i class="fa-solid fa-circle-dot"></i><span>${htmlEscape(t(state.launcherMode === 'floating' ? 'floatingBall' : 'toolbarButtons'))}</span>
                    </button>
                    <label class="tnl-language-select" title="${htmlEscape(t('language'))}">
                        <i class="fa-solid fa-language"></i>
                        <select id="tavern-notes-lite-language">
                            ${LANGUAGE_OPTIONS.map(option => `<option value="${option.id}" ${option.id === state.language ? 'selected' : ''}>${option.id === 'auto' ? htmlEscape(t('autoLanguage')) : htmlEscape(option.label)}</option>`).join('')}
                        </select>
                    </label>
                    <button class="tnl-icon-button tnl-close" title="${htmlEscape(t('closeNotes'))}" aria-label="${htmlEscape(t('closeNotes'))}">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="tnl-header-actions">
                    <button id="tavern-notes-lite-new-note-open" class="tnl-soft-button"><i class="fa-solid fa-pen-to-square"></i><span>${htmlEscape(t('newNote'))}</span></button>
                    <button id="tavern-notes-lite-selection-capture-setting" class="tnl-soft-button ${state.showSelectionCaptureButton ? 'active' : ''}" title="${htmlEscape(t('selectionCaptureButtonTitle'))}"><i class="fa-solid fa-highlighter"></i><span>${htmlEscape(t('captureSelected'))}</span></button>
                    <button id="tavern-notes-lite-floor-capture-open" class="tnl-soft-button ${state.showFloorCaptureButton ? 'active' : ''}" title="${htmlEscape(t('floorCaptureEntryTitle'))}"><i class="fa-solid fa-file-lines"></i><span>${htmlEscape(t('captureFloor'))}</span></button>
                    <button id="tavern-notes-lite-theme" class="tnl-soft-button" title="${htmlEscape(t('openThemePanel'))}"><i class="fa-solid fa-palette"></i><span>${htmlEscape(t('theme'))}</span></button>
                    <button id="tavern-notes-lite-more-open" class="tnl-soft-button"><i class="fa-solid fa-ellipsis"></i><span>${htmlEscape(t('more'))}</span></button>
                    <div id="tavern-notes-lite-more-menu" class="tnl-header-popover tnl-header-secondary"><button id="tavern-notes-lite-auto-user-input" class="tnl-soft-button ${state.autoCaptureUserInput ? 'active' : ''}" title="${htmlEscape(t('autoCaptureUserInputTitle'))}"><i class="fa-solid fa-keyboard"></i><span>${htmlEscape(t('autoCaptureUserInput'))}</span></button><button id="tavern-notes-lite-user-input-cleanup-open" class="tnl-soft-button" title="${htmlEscape(t('userInputCleanupIntro'))}"><i class="fa-solid fa-filter-circle-xmark"></i><span>${htmlEscape(t('userInputCleanup'))}</span></button><button id="tavern-notes-lite-export" class="tnl-soft-button" title="${htmlEscape(t('exportNotes'))}"><i class="fa-solid fa-download"></i><span>${htmlEscape(t('exportNotes'))}</span></button><button id="tavern-notes-lite-reset-floating" class="tnl-soft-button" title="${htmlEscape(t('resetFloatingPosition'))}"><i class="fa-solid fa-location-crosshairs"></i><span>${htmlEscape(t('resetFloatingPosition'))}</span></button><button id="tavern-notes-lite-apple-mode-main" class="tnl-soft-button tnl-hidden"><i class="fa-solid fa-moon"></i><span>${htmlEscape(t('appleThemeNight'))}</span></button></div>
                </div>
            </header>
            <div class="tnl-search-row">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input id="tavern-notes-lite-search" class="text_pole" type="search" placeholder="${htmlEscape(t('searchPlaceholder'))}" />
            </div>
            <div id="tavern-notes-lite-tag-shelf" class="tnl-tag-shelf tnl-hidden" aria-label="${htmlEscape(t('tags'))}"></div>
            <div class="tnl-shell">
                <nav class="tnl-filters">
                    ${getVisibleFilters().map(filter => `
                        <button class="tnl-filter ${filter.id === 'all' ? 'active' : ''}" data-filter="${filter.id}">
                            <span class="tnl-filter-icon"><i class="fa-solid ${filter.icon}"></i></span>
                            <span class="tnl-filter-text">
                                <b>${htmlEscape(t(filter.label))}</b>
                                <small>${htmlEscape(t(filter.hint))}</small>
                            </span>
                            <span class="tnl-filter-count"></span>
                        </button>
                    `).join('')}
                </nav>
                <main id="tavern-notes-lite-list" class="tnl-list"></main>
            </div>
            <footer class="tnl-footer">
                <span class="tavern-notes-lite-status">${htmlEscape(t('connecting'))}</span>
                <div class="tnl-pagination">
                    <button id="tavern-notes-lite-prev" class="tnl-page-button" title="${htmlEscape(t('prevPage'))}"><i class="fa-solid fa-chevron-left"></i></button>
                    <span id="tavern-notes-lite-page-label">1 / 1</span>
                    <button id="tavern-notes-lite-next" class="tnl-page-button" title="${htmlEscape(t('nextPage'))}"><i class="fa-solid fa-chevron-right"></i></button>
                    <input id="tavern-notes-lite-page-input" type="number" min="1" value="1" />
                    <button id="tavern-notes-lite-page-jump" class="tnl-page-button">${htmlEscape(t('jumpPage'))}</button>
                </div>
            </footer>
            <div id="tavern-notes-lite-new-note-menu" aria-hidden="true"><form class="tnl-edit-card tnl-new-note-card"><button class="tnl-icon-button tnl-new-note-close" type="button"><i class="fa-solid fa-xmark"></i></button><div class="tnl-export-title">${htmlEscape(t('newNote'))}</div><p class="tnl-floor-capture-intro">${htmlEscape(t('newNoteUserHelp'))}</p><label class="tnl-edit-field"><span>${htmlEscape(t('noteContent'))}</span><textarea id="tavern-notes-lite-new-note-content" class="text_pole" maxlength="200000" required></textarea></label><label class="tnl-edit-field"><span>${htmlEscape(t('tags'))}</span><input id="tavern-notes-lite-new-note-tags" class="text_pole" value="${htmlEscape(t('inspirationTag'))}"></label><button class="menu_button tnl-new-note-save" type="submit"><i class="fa-solid fa-floppy-disk"></i><span>${htmlEscape(t('saveNote'))}</span></button></form></div>
            <div id="tavern-notes-lite-modal" aria-hidden="true">
                <div class="tnl-modal-card">
                    <button class="tnl-icon-button tnl-modal-close" title="${htmlEscape(t('close'))}" aria-label="${htmlEscape(t('close'))}"><i class="fa-solid fa-xmark"></i></button>
                    <div class="tnl-modal-kicker"></div>
                    <div class="tnl-modal-title"></div>
                    <div class="tnl-modal-content"></div>
                </div>
            </div>
            <div id="tavern-notes-lite-edit-menu" aria-hidden="true">
                <form class="tnl-edit-card">
                    <button class="tnl-icon-button tnl-edit-close" type="button" title="${htmlEscape(t('close'))}" aria-label="${htmlEscape(t('close'))}"><i class="fa-solid fa-xmark"></i></button>
                    <div class="tnl-export-title">${htmlEscape(t('editNote'))}</div>
                    <label class="tnl-edit-field">
                        <span>${htmlEscape(t('noteContent'))}</span>
                        <textarea id="tavern-notes-lite-edit-content" class="text_pole" maxlength="200000" required></textarea>
                    </label>
                    <div class="tnl-edit-field">
                        <span>${htmlEscape(t('tags'))}</span>
                        <div class="tnl-tag-editor">
                            <div id="tavern-notes-lite-edit-tag-chips" class="tnl-edit-tag-chips"></div>
                            <input id="tavern-notes-lite-edit-tags" type="text" maxlength="820" placeholder="${htmlEscape(t('tagsPlaceholder'))}" autocomplete="off" />
                        </div>
                        <small>${htmlEscape(t('tagsHelp'))}</small>
                    </div>
                    <div class="tnl-tag-suggestions-wrap">
                        <small>${htmlEscape(t('tagSuggestions'))}</small>
                        <div id="tavern-notes-lite-tag-suggestions" class="tnl-tag-suggestions"></div>
                    </div>
                    <button class="menu_button tnl-edit-save" type="submit"><i class="fa-solid fa-floppy-disk"></i><span>${htmlEscape(t('saveChanges'))}</span></button>
                </form>
            </div>
            <div id="tavern-notes-lite-tag-library" aria-hidden="true">
                <section class="tnl-tag-library-card">
                    <button class="tnl-icon-button tnl-tag-library-close" type="button" title="${htmlEscape(t('close'))}" aria-label="${htmlEscape(t('close'))}"><i class="fa-solid fa-xmark"></i></button>
                    <div class="tnl-tag-library-heading">
                        <span class="tnl-tag-library-mark"><i class="fa-solid fa-tags"></i></span>
                        <div><div class="tnl-export-title">${htmlEscape(t('tagLibrary'))}</div><p class="tnl-tag-library-intro">${htmlEscape(t('tagLibraryIntro'))}</p></div>
                    </div>
                    <label class="tnl-tag-library-search">
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <input id="tavern-notes-lite-tag-search" class="text_pole" type="search" placeholder="${htmlEscape(t('searchTags'))}" />
                    </label>
                    <div class="tnl-tag-sort" role="group">
                        <button class="tnl-tag-sort-button active" type="button" data-tag-sort="count"><i class="fa-solid fa-arrow-down-wide-short"></i><span>${htmlEscape(t('sortByCount'))}</span></button>
                        <button class="tnl-tag-sort-button" type="button" data-tag-sort="name"><i class="fa-solid fa-arrow-down-a-z"></i><span>${htmlEscape(t('sortByName'))}</span></button>
                    </div>
                    <div id="tavern-notes-lite-tag-library-list" class="tnl-tag-library-list"></div>
                </section>
            </div>
            <div id="tavern-notes-lite-export-menu" aria-hidden="true">
                <div class="tnl-export-card">
                    <div class="tnl-export-title">${htmlEscape(t('exportNotes'))}</div>
                    <div class="tnl-export-scope">
                        <div class="tnl-export-scope-label">${htmlEscape(t('exportScope'))}</div>
                        <div class="tnl-export-scope-options" role="group" aria-label="${htmlEscape(t('exportScope'))}">
                            <button class="tnl-export-scope-choice active" data-scope="all" type="button">${htmlEscape(t('allNotes'))}</button>
                            <button class="tnl-export-scope-choice" data-scope="page" type="button">${htmlEscape(t('currentPage'))}</button>
                        </div>
                        <small class="tnl-export-hint">${htmlEscape(t('exportHint'))}</small>
                    </div>
                    <button class="tnl-export-choice" data-format="json" title="JSON"><i class="fa-solid fa-file-code"></i><span>${htmlEscape(t('exportJson'))}</span></button>
                    <button class="tnl-export-choice" data-format="txt" title="TXT"><i class="fa-solid fa-file-lines"></i><span>${htmlEscape(t('exportTxt'))}</span></button>
                    <button id="tavern-notes-lite-import-json" class="tnl-export-choice" type="button"><i class="fa-solid fa-file-import"></i><span>${htmlEscape(t('importJson'))}</span></button>
                    <input id="tavern-notes-lite-import-json-file" type="file" accept=".json,application/json" hidden />
                    <aside class="tnl-lite-full-info">
                        <strong><i class="fa-solid fa-circle-info"></i>${htmlEscape(t('liteFullInfoTitle'))}</strong>
                        <p>${htmlEscape(t('liteFullJsonCompatibility'))}</p>
                        <p>${htmlEscape(t('liteLimitations'))}</p>
                        <p>${htmlEscape(t('fullAdvantages'))}</p>
                    </aside>
                </div>
            </div>
            <div id="tavern-notes-lite-floor-capture-menu" aria-hidden="true">
                <div class="tnl-floor-capture-card">
                    <button class="tnl-icon-button tnl-floor-capture-close" title="${htmlEscape(t('close'))}" aria-label="${htmlEscape(t('close'))}"><i class="fa-solid fa-xmark"></i></button>
                    <div class="tnl-export-title">${htmlEscape(t('floorCaptureSettingsTitle'))}</div>
                    <p class="tnl-floor-capture-intro">${htmlEscape(t('floorCaptureSettingsIntro'))}</p>
                    <button id="tavern-notes-lite-floor-capture-setting" class="tnl-soft-button tnl-floor-capture-toggle ${state.showFloorCaptureButton ? 'active' : ''}" title="${htmlEscape(t('floorCaptureButtonTitle'))}" aria-label="${htmlEscape(t('floorCaptureButtonTitle'))}">
                        <i class="fa-solid fa-file-lines"></i><span>${htmlEscape(t('floorCaptureButton'))}</span>
                    </button>
                    <div class="tnl-floor-capture-help">
                        <b>${htmlEscape(t('floorCaptureStepsTitle'))}</b>
                        <small>${htmlEscape(t('floorCaptureSteps'))}</small>
                    </div>
                    <div class="tnl-floor-capture-help">
                        <b>${htmlEscape(t('floorCaptureContentTitle'))}</b>
                        <small>${htmlEscape(t('floorCaptureContentHelp'))}</small>
                        <code>${htmlEscape(t('floorCaptureExample'))}</code>
                    </div>
                    <div class="tnl-floor-capture-help">
                        <b>${htmlEscape(t('floorCaptureTroubleTitle'))}</b>
                        <small>${htmlEscape(t('floorCaptureTroubleHelp'))}</small>
                    </div>
                    <details class="tnl-floor-capture-advanced">
                        <summary>${htmlEscape(t('floorCaptureAdvanced'))}</summary>
                        <div id="tavern-notes-lite-floor-capture-selector-summary" class="tnl-floor-capture-selector-summary"></div>
                        <label class="tnl-floor-selector-row" title="${htmlEscape(t('floorCaptureSelectorHelp'))}">
                            <span>${htmlEscape(t('floorCaptureSelectorLabel'))}</span>
                            <input id="tavern-notes-lite-floor-capture-selector" class="text_pole" type="text" value="${htmlEscape(getFloorCaptureTagName())}" placeholder="${htmlEscape(t('floorCaptureSelectorPlaceholder'))}" />
                        </label>
                        <small>${htmlEscape(t('floorCaptureSelectorHelp'))}</small>
                    </details>
                </div>
            </div>
            <div id="tavern-notes-lite-user-input-cleanup-menu" aria-hidden="true">
                <div class="tnl-user-input-cleanup-card">
                    <button class="tnl-icon-button tnl-user-input-cleanup-close" title="${htmlEscape(t('close'))}" aria-label="${htmlEscape(t('close'))}"><i class="fa-solid fa-xmark"></i></button>
                    <div class="tnl-export-title">${htmlEscape(t('userInputCleanupTitle'))}</div><p class="tnl-floor-capture-intro">${htmlEscape(t('userInputCleanupIntro'))}</p>
                    <label class="tnl-input-cleanup-toggle"><input id="tavern-notes-lite-collapse-repeated-input" type="checkbox" ${state.collapseRepeatedUserInput ? 'checked' : ''}><span><b>${htmlEscape(t('collapseRepeatedInput'))}</b><small>${htmlEscape(t('collapseRepeatedHelp'))}</small></span></label>
                    <div class="tnl-input-rule-search"><i class="fa-solid fa-magnifying-glass"></i><input id="tavern-notes-lite-input-rule-search" type="search" placeholder="${htmlEscape(t('filterInputRules'))}"></div>
                    <div class="tnl-input-rule-columns">${['exact', 'prefix'].map(kind => `<section class="tnl-input-rule-section"><div class="tnl-input-rule-heading"><b>${htmlEscape(t(kind === 'exact' ? 'ignoreExactLabel' : 'ignorePrefixLabel'))}</b><span data-rule-count="${kind}">0</span></div><div class="tnl-input-rule-add"><textarea data-rule-input="${kind}" rows="2" placeholder="${htmlEscape(t(kind === 'exact' ? 'ignoreExactPlaceholder' : 'ignorePrefixPlaceholder'))}"></textarea><button type="button" data-rule-add="${kind}" title="${htmlEscape(t('addInputRules'))}"><i class="fa-solid fa-plus"></i></button></div><div class="tnl-input-rule-list" data-rule-list="${kind}"></div></section>`).join('')}</div>
                    <section id="tavern-notes-lite-input-dedupe-preview" class="tnl-dedupe-preview tn-hidden"><div class="tnl-dedupe-preview-summary"></div><div class="tnl-dedupe-preview-list"></div><div class="tnl-dedupe-preview-actions"><button id="tavern-notes-lite-input-dedupe-cancel" type="button">${htmlEscape(t('cancelCleanup'))}</button><button id="tavern-notes-lite-input-dedupe-confirm" type="button"><i class="fa-solid fa-broom"></i><span>${htmlEscape(t('confirmCleanup'))}</span></button></div></section>
                    <div class="tnl-input-cleanup-actions"><button id="tavern-notes-lite-input-rules-save" class="tnl-soft-button"><i class="fa-solid fa-floppy-disk"></i><span>${htmlEscape(t('saveInputRules'))}</span></button><button id="tavern-notes-lite-input-dedupe-scan" class="tnl-history-cleanup-button"><i class="fa-solid fa-broom"></i><span>${htmlEscape(t('clearHistoryDuplicates'))}</span></button></div>
                </div>
            </div>
            <div id="tavern-notes-lite-theme-menu" aria-hidden="true">
                <div class="tnl-theme-card">
                    <button class="tnl-icon-button tnl-theme-close" title="${htmlEscape(t('closeThemePanel'))}" aria-label="${htmlEscape(t('closeThemePanel'))}"><i class="fa-solid fa-xmark"></i></button>
                    <div class="tnl-export-title">${htmlEscape(t('themeFiles'))}</div>
                    <div class="tnl-theme-name">${htmlEscape(t('currentTheme', { name: 'Soft Neomorphism' }))}</div>
                    <div class="tnl-theme-picker">
                        <select id="tavern-notes-lite-theme-select" title="${htmlEscape(t('switchTheme'))}"></select>
                        <button id="tavern-notes-lite-theme-import" class="tnl-theme-icon-button" title="${htmlEscape(t('importTheme'))}" aria-label="${htmlEscape(t('importTheme'))}"><i class="fa-solid fa-file-import"></i></button>
                        <button id="tavern-notes-lite-theme-delete" class="tnl-theme-icon-button" title="${htmlEscape(t('deleteTheme'))}" aria-label="${htmlEscape(t('deleteTheme'))}"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                    <input id="tavern-notes-lite-theme-file" type="file" accept=".json,application/json" hidden />
                </div>
            </div>
            <div id="tavern-notes-lite-share-menu" aria-hidden="true">
                <div class="tnl-share-card">
                    <button class="tnl-icon-button tnl-share-close" title="${htmlEscape(t('close'))}" aria-label="${htmlEscape(t('close'))}"><i class="fa-solid fa-xmark"></i></button>
                    <div class="tnl-share-preview-wrap">
                        <canvas id="tavern-notes-lite-share-canvas" width="900" height="1400"></canvas>
                    </div>
                    <div class="tnl-share-controls">
                        <div class="tnl-export-title">${htmlEscape(t('shareCard'))}</div>
                        <label class="tnl-share-label">${htmlEscape(t('theme'))}</label>
                        <div class="tnl-share-theme-row">
                            ${SHARE_CARD_THEMES.map(theme => `<button class="tnl-share-choice" data-share-theme="${theme.id}" type="button">${htmlEscape(t(theme.labelKey))}</button>`).join('')}
                        </div>
                        <label class="tnl-share-label">${htmlEscape(t('font'))}</label>
                        <input id="tavern-notes-lite-share-font" class="tnl-theme-input" type="text" placeholder='例如 STDongGuanTi, 思源宋体, serif' />
                        <label class="tnl-share-label">${htmlEscape(t('savedFonts'))}</label>
                        <select id="tavern-notes-lite-share-saved-fonts" class="tnl-theme-input"></select>
                        <label class="tnl-share-label">${htmlEscape(t('fontSize'))} <span id="tavern-notes-lite-share-font-size-value">80%</span></label>
                        <input id="tavern-notes-lite-share-font-size" type="range" min="65" max="110" step="5" value="80" />
                        <label class="tnl-share-label">${htmlEscape(t('fontImport'))}</label>
                        <textarea id="tavern-notes-lite-share-font-import" class="tnl-share-font-import" spellcheck="false" placeholder='https://fontsapi.zeoseven.com/488/main/result.css'></textarea>
                        <div class="tnl-share-help">
                            ${htmlEscape(t('fontHelp'))}
                            <a href="https://fonts.zeoseven.com/" target="_blank" rel="noopener noreferrer">${htmlEscape(t('findFonts'))}</a>
                        </div>
                        <button id="tavern-notes-lite-share-import-font" class="tnl-export-choice tnl-share-wide-action" type="button"><i class="fa-solid fa-font"></i><span>${htmlEscape(t('importFont'))}</span></button>
                        <label class="tnl-share-label">${htmlEscape(t('importLocalFont'))}</label>
                        <button id="tavern-notes-lite-share-import-local-font" class="tnl-export-choice tnl-share-wide-action" type="button"><i class="fa-solid fa-file-import"></i><span>${htmlEscape(t('importLocalFont'))}</span></button>
                        <label class="tnl-share-label">${htmlEscape(t('background'))}</label>
                        <div class="tnl-share-bg-row">
                            ${SHARE_CARD_BACKGROUNDS.map(color => `<button class="tnl-share-bg" data-share-bg="${color}" type="button" style="--share-bg:${color}"></button>`).join('')}
                        </div>
                        <label class="tnl-share-label">${htmlEscape(t('display'))}</label>
                        <div class="tnl-share-toggle-row">
                            <label><input id="tavern-notes-lite-share-show-character" type="checkbox" />${htmlEscape(t('characterName'))}</label>
                            <label><input id="tavern-notes-lite-share-show-date" type="checkbox" />${htmlEscape(t('date'))}</label>
                        </div>
                        <div class="tnl-share-actions">
                            <button id="tavern-notes-lite-share-redraw" class="tnl-export-choice" type="button"><i class="fa-solid fa-wand-magic-sparkles"></i><span>${htmlEscape(t('redrawPreview'))}</span></button>
                            <button id="tavern-notes-lite-share-download" class="tnl-export-choice" type="button"><i class="fa-solid fa-download"></i><span>${htmlEscape(t('exportPng'))}</span></button>
                        </div>
                        <input id="tavern-notes-lite-share-local-font-file" type="file" accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" hidden />
                    </div>
                    <style id="tavern-notes-lite-share-font-style"></style>
                </div>
            </div>
        </section>
    `);

    addInputToolbar();
    addExtensionsMenuEntry();
    updateSelectionCaptureButtonSetting();
    updateFloorCaptureButtonSetting();
    updateFloorCaptureSelectorInput();
    bindEvents();
}

function bindEvents() {
    window.addEventListener('resize', () => applyFloatingLauncherPosition(document.querySelector('#tavern-notes-lite-floating-launcher')), { passive: true });
    document.querySelector('#tavern-notes-lite-new-note-open')?.addEventListener('click', openNewNoteMenu);
    document.querySelector('#tavern-notes-lite-more-open')?.addEventListener('click', () => toggleHeaderPopover('tavern-notes-lite-more-menu'));
    document.querySelector('#tavern-notes-lite-reset-floating')?.addEventListener('click', resetFloatingLauncherPosition);
    document.querySelector('.tnl-new-note-close')?.addEventListener('click', closeNewNoteMenu);
    document.querySelector('#tavern-notes-lite-new-note-menu')?.addEventListener('click', event => { if (event.target.id === 'tavern-notes-lite-new-note-menu') closeNewNoteMenu(); });
    document.querySelector('#tavern-notes-lite-new-note-menu form')?.addEventListener('submit', event => { event.preventDefault(); saveNewUserNote().catch(error => notify(error.message, 'error')); });
    document.querySelector('#tavern-notes-lite-language')?.addEventListener('change', event => saveLanguageSetting(event.target.value));
    document.querySelector('#tavern-notes-lite-launcher-mode')?.addEventListener('click', toggleLauncherMode);
    document.querySelector('#tavern-notes-lite-apple-mode-main')?.addEventListener('click', () => {
        toggleAppleThemeMode().catch(error => notify(error.message, 'error'));
    });
    document.querySelector('#tavern-notes-lite-auto-user-input')?.addEventListener('click', toggleAutoCaptureUserInput);
    document.querySelector('#tavern-notes-lite-user-input-cleanup-open')?.addEventListener('click', openUserInputCleanupMenu);
    document.querySelector('.tnl-user-input-cleanup-close')?.addEventListener('click', closeUserInputCleanupMenu);
    document.querySelector('#tavern-notes-lite-input-rules-save')?.addEventListener('click', saveUserInputCleanupSettings);
    document.querySelector('#tavern-notes-lite-input-rule-search')?.addEventListener('input', renderInputRuleLists);
    document.querySelector('.tnl-user-input-cleanup-card')?.addEventListener('click', event => {
        const add = event.target.closest?.('[data-rule-add]');
        if (add) return addInputRules(add.dataset.ruleAdd);
        const remove = event.target.closest?.('[data-rule-delete]');
        if (remove) deleteInputRule(remove.dataset.ruleDelete, remove.dataset.ruleValue || '');
    });
    document.querySelector('#tavern-notes-lite-input-dedupe-scan')?.addEventListener('click', () => scanAndCleanupUserInputs().catch(error => notify(error.message, 'error')));
    document.querySelector('#tavern-notes-lite-input-dedupe-cancel')?.addEventListener('click', closeUserInputDedupePreview);
    document.querySelector('#tavern-notes-lite-input-dedupe-confirm')?.addEventListener('click', () => applyUserInputDedupe().catch(error => notify(error.message, 'error')));
    document.querySelector('#tavern-notes-lite-selection-capture-setting')?.addEventListener('click', toggleSelectionCaptureButtonSetting);
    document.querySelector('#tavern-notes-lite-floor-capture-open')?.addEventListener('click', openFloorCaptureMenu);
    document.querySelector('#tavern-notes-lite-floor-capture-setting')?.addEventListener('click', toggleFloorCaptureButtonSetting);
    document.querySelector('#tavern-notes-lite-theme')?.addEventListener('click', toggleThemeMenu);
    document.querySelector('.tnl-floor-capture-close')?.addEventListener('click', closeFloorCaptureMenu);
    document.querySelector('.tnl-theme-close')?.addEventListener('click', closeThemeMenu);
    document.querySelector('.tnl-close')?.addEventListener('click', closePanel);
    document.querySelector('#tavern-notes-lite-export')?.addEventListener('click', toggleExportMenu);
    document.querySelector('#tavern-notes-lite-search')?.addEventListener('input', event => {
        state.query = event.target.value;
        state.page = 1;
        clearTimeout(state.searchTimer);
        state.searchTimer = setTimeout(refreshNotes, 300);
    });
    document.querySelector('#tavern-notes-lite-tag-shelf')?.addEventListener('click', event => {
        if (event.target.closest?.('.tnl-tag-library-open')) {
            openTagLibrary();
            return;
        }
        const button = event.target.closest?.('.tnl-tag-filter');
        if (button) setTagFilter(button.dataset.tag || '');
    });
    document.querySelector('#tavern-notes-lite-floor-capture-selector')?.addEventListener('change', event => saveFloorCaptureSelector(event.target.value));
    document.querySelector('.tnl-filters')?.addEventListener('click', event => {
        const tab = event.target.closest?.('.tnl-filter');
        if (!tab) return;
        setActiveFilter(tab.dataset.filter || 'all');
    });
    document.querySelector('#tavern-notes-lite-list')?.addEventListener('click', handleNoteAction);
    document.querySelector('#tavern-notes-lite-list')?.addEventListener('scroll', updateArchiveReadingMode, { passive: true });
    document.querySelector('.tnl-modal-close')?.addEventListener('click', closeFullNote);
    document.querySelector('#tavern-notes-lite-modal')?.addEventListener('click', event => {
        if (event.target.id === 'tavern-notes-lite-modal') closeFullNote();
    });
    document.querySelector('.tnl-edit-close')?.addEventListener('click', closeEditNote);
    document.querySelector('#tavern-notes-lite-edit-menu')?.addEventListener('click', event => {
        if (event.target.id === 'tavern-notes-lite-edit-menu') closeEditNote();
    });
    document.querySelector('#tavern-notes-lite-edit-menu form')?.addEventListener('submit', event => {
        event.preventDefault();
        saveEditedNote().catch(error => notify(error.message, 'error'));
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
    document.querySelector('.tnl-tag-library-close')?.addEventListener('click', closeTagLibrary);
    document.querySelector('#tavern-notes-lite-tag-library')?.addEventListener('click', event => {
        if (event.target.id === 'tavern-notes-lite-tag-library') closeTagLibrary();
        if (event.target.closest?.('.tnl-tag-library-back')) closeTagLibrary();
        const deleteButton = event.target.closest?.('[data-delete-tag]');
        if (deleteButton) {
            deleteTagEverywhere(deleteButton.dataset.deleteTag || '', Number(deleteButton.dataset.tagCount || 0))
                .catch(error => notify(error.message, 'error'));
            return;
        }
        const renameButton = event.target.closest?.('[data-rename-tag]');
        if (renameButton) { renameTagEverywhere(renameButton.dataset.renameTag || '', Number(renameButton.dataset.tagCount || 0)).catch(error => notify(error.message, 'error')); return; }
        const tag = event.target.closest?.('.tnl-tag-library-item');
        if (tag) {
            setTagFilter(tag.dataset.tag || '');
            closeTagLibrary();
        }
        const sort = event.target.closest?.('[data-tag-sort]');
        if (sort) {
            state.tagManagerSort = sort.dataset.tagSort === 'name' ? 'name' : 'count';
            renderTagLibrary();
        }
    });
    document.querySelector('#tavern-notes-lite-tag-search')?.addEventListener('input', event => {
        state.tagManagerQuery = event.target.value || '';
        renderTagLibrary();
    });
    document.querySelector('#tavern-notes-lite-export-menu')?.addEventListener('click', event => {
        if (event.target.id === 'tavern-notes-lite-export-menu') closeExportMenu();
    });
    document.querySelector('#tavern-notes-lite-floor-capture-menu')?.addEventListener('click', event => {
        if (event.target.id === 'tavern-notes-lite-floor-capture-menu') closeFloorCaptureMenu();
    });
    document.querySelector('#tavern-notes-lite-user-input-cleanup-menu')?.addEventListener('click', event => {
        if (event.target.id === 'tavern-notes-lite-user-input-cleanup-menu') closeUserInputCleanupMenu();
    });
    document.querySelector('#tavern-notes-lite-theme-menu')?.addEventListener('click', event => {
        if (event.target.id === 'tavern-notes-lite-theme-menu') closeThemeMenu();
    });
    document.querySelector('#tavern-notes-lite-share-menu')?.addEventListener('click', event => {
        if (event.target.id === 'tavern-notes-lite-share-menu') closeShareCard();
    });
    document.querySelector('.tnl-share-close')?.addEventListener('click', closeShareCard);
    document.querySelectorAll('.tnl-share-choice').forEach(button => {
        button.addEventListener('click', () => updateShareCardSetting({ theme: button.dataset.shareTheme || 'calendar' }));
    });
    document.querySelectorAll('.tnl-share-bg').forEach(button => {
        button.addEventListener('click', () => updateShareCardSetting({ background: button.dataset.shareBg || '#f7f4ef' }));
    });
    document.querySelector('#tavern-notes-lite-share-font')?.addEventListener('input', event => updateShareCardSetting({ fontFamily: event.target.value || 'system-ui' }));
    document.querySelector('#tavern-notes-lite-share-saved-fonts')?.addEventListener('change', event => {
        applySavedShareFont(event.target.value).catch(error => notify(error.message, 'error'));
    });
    document.querySelector('#tavern-notes-lite-share-font-size')?.addEventListener('input', event => {
        updateShareCardSetting({ fontScale: Math.min(Math.max(Number(event.target.value || 80) / 100, 0.65), 1.1) });
    });
    document.querySelector('#tavern-notes-lite-share-font-import')?.addEventListener('input', event => {
        state.shareCardSettings = {
            ...state.shareCardSettings,
            fontImport: event.target.value || '',
        };
        saveLocalSettings();
    });
    document.querySelector('#tavern-notes-lite-share-show-character')?.addEventListener('change', event => updateShareCardSetting({ showCharacter: event.target.checked }));
    document.querySelector('#tavern-notes-lite-share-show-date')?.addEventListener('change', event => updateShareCardSetting({ showDate: event.target.checked }));
    document.querySelector('#tavern-notes-lite-share-import-font')?.addEventListener('click', () => importShareCardFont().catch(error => notify(error.message, 'error')));
    document.querySelector('#tavern-notes-lite-share-import-local-font')?.addEventListener('click', () => document.querySelector('#tavern-notes-lite-share-local-font-file')?.click());
    document.querySelector('#tavern-notes-lite-share-local-font-file')?.addEventListener('change', event => {
        importLocalShareCardFont(event).catch(error => notify(error.message, 'error'));
    });
    document.querySelector('#tavern-notes-lite-share-redraw')?.addEventListener('click', () => drawShareCard().catch(error => notify(error.message, 'error')));
    document.querySelector('#tavern-notes-lite-share-download')?.addEventListener('click', () => downloadShareCard().catch(error => notify(error.message, 'error')));
    document.querySelectorAll('#tavern-notes-lite-export-menu .tnl-export-choice[data-format]').forEach(button => {
        button.addEventListener('click', () => exportNotes(button.dataset.format).catch(error => notify(error.message, 'error')));
    });
    document.querySelectorAll('#tavern-notes-lite-export-menu .tnl-export-scope-choice').forEach(button => {
        button.addEventListener('click', () => setExportScope(button.dataset.scope || 'all'));
    });
    document.querySelector('#tavern-notes-lite-import-json')?.addEventListener('click', () => {
        document.querySelector('#tavern-notes-lite-import-json-file')?.click();
    });
    document.querySelector('#tavern-notes-lite-import-json-file')?.addEventListener('change', event => {
        importNotesJson(event).catch(error => notify(error.message || t('invalidBackup'), 'error'));
    });
    document.querySelector('#tavern-notes-lite-prev')?.addEventListener('click', () => goToPage(state.page - 1));
    document.querySelector('#tavern-notes-lite-next')?.addEventListener('click', () => goToPage(state.page + 1));
    document.querySelector('#tavern-notes-lite-page-jump')?.addEventListener('click', jumpToInputPage);
    document.querySelector('#tavern-notes-lite-page-input')?.addEventListener('keydown', event => {
        if (event.key === 'Enter') jumpToInputPage();
    });
    document.querySelector('#tavern-notes-lite-theme-import')?.addEventListener('click', () => document.querySelector('#tavern-notes-lite-theme-file')?.click());
    document.querySelector('#tavern-notes-lite-theme-delete')?.addEventListener('click', () => deleteSelectedTheme().catch(error => notify(error.message, 'error')));
    document.querySelector('#tavern-notes-lite-theme-select')?.addEventListener('change', event => {
        activateTheme(event.target.value).catch(error => notify(error.message, 'error'));
    });
    document.querySelector('#tavern-notes-lite-theme-file')?.addEventListener('change', event => {
        importThemeFile(event).catch(error => notify(error.message, 'error'));
    });
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        closeFullNote();
        closeEditNote();
        closeTagLibrary();
        closeExportMenu();
        closeThemeMenu();
        closeShareCard();
    });
}

async function handleNoteAction(event) {
    const button = event.target.closest('button');
    if (!button) return;

    if (button.classList.contains('tnl-tag-chip')) {
        setTagFilter(button.dataset.tag || '');
        return;
    }

    if (button.classList.contains('tnl-character-card')) {
        const id = button.dataset.characterId || null;
        const name = button.dataset.characterName || '未命名角色';
        const character = state.characters.find(item => String(item.id ?? '') === String(id ?? '') && item.name === name)
            || state.characters.find(item => item.name === name)
            || { id, name };
        setCharacterFilter(character);
        return;
    }

    if (button.classList.contains('tnl-clear-character')) {
        clearCharacterFilter();
        return;
    }

    const noteGroup = findNoteGroupFromElement(button);
    if (!noteGroup) return;

    if (button.classList.contains('tnl-variant-prev') || button.classList.contains('tnl-variant-next')) {
        const variants = getNoteVariants(noteGroup);
        const direction = button.classList.contains('tnl-variant-prev') ? -1 : 1;
        state.variantIndexByGroup[noteGroup.id] = Math.min(Math.max(getVariantIndex(noteGroup) + direction, 0), variants.length - 1);
        renderNotes();
        return;
    }

    const note = findNoteFromButton(button);
    if (!note) return;

    if (button.classList.contains('tnl-expand')) {
        openFullNote(note);
    } else if (button.classList.contains('tnl-copy')) {
        await navigator.clipboard.writeText(note.content);
        notify(t('copied'), 'success');
    } else if (button.classList.contains('tnl-fill')) {
        writeInput(note.content, false);
        closePanel();
        notify(t('filled'), 'success');
    } else if (button.classList.contains('tnl-share')) {
        openShareCard(note);
    } else if (button.classList.contains('tnl-edit')) {
        openEditNote(note);
    } else if (button.classList.contains('tnl-delete')) {
        const confirmed = await confirmDelete(note);
        if (!confirmed) return;
        await api(`/notes/${encodeURIComponent(note.id)}`, { method: 'DELETE' });
        await refreshNotes();
        notify(t('deleted'), 'success');
    }
}

function renderPagination(visible = true) {
    const pagination = document.querySelector('.tnl-pagination');
    if (pagination) pagination.classList.toggle('tnl-hidden', !visible);
    if (!visible) return;

    const maxPage = getMaxPage();
    const label = document.querySelector('#tavern-notes-lite-page-label');
    const input = document.querySelector('#tavern-notes-lite-page-input');
    const prev = document.querySelector('#tavern-notes-lite-prev');
    const next = document.querySelector('#tavern-notes-lite-next');
    if (label) label.textContent = `${state.page} / ${maxPage}`;
    if (input) {
        input.max = String(maxPage);
        input.value = String(state.page);
    }
    if (prev) prev.disabled = state.page <= 1;
    if (next) next.disabled = state.page >= maxPage;
}

function goToPage(page) {
    const maxPage = getMaxPage();
    const nextPage = Math.min(Math.max(Number(page) || 1, 1), maxPage);
    if (nextPage === state.page) return;
    state.page = nextPage;
    refreshNotes();
}

function jumpToInputPage() {
    const input = document.querySelector('#tavern-notes-lite-page-input');
    goToPage(input?.value || 1);
}

function exportFile(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
}

function downloadTextFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    exportFile(url, filename);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatBytes(bytes) {
    const value = Math.max(0, Number(bytes) || 0);
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

async function importNotesJson(event) {
    const input = event.currentTarget;
    const file = input?.files?.[0];
    if (input) input.value = '';
    if (!file) return;
    let payload;
    try {
        payload = JSON.parse(await file.text());
    } catch {
        throw new Error(t('invalidBackup'));
    }
    const result = await importLiteExport(payload).catch(() => {
        throw new Error(t('invalidBackup'));
    });
    state.page = 1;
    await refreshNotes();
    closeExportMenu();
    notify(t('importDone', result), 'success');
}

function toggleExportMenu() {
    const menu = document.querySelector('#tavern-notes-lite-export-menu');
    if (!menu) return;
    closeHeaderPopovers();
    setExportScope(state.exportScope);
    menu.classList.toggle('open');
    menu.setAttribute('aria-hidden', menu.classList.contains('open') ? 'false' : 'true');
}

function closeExportMenu() {
    const menu = document.querySelector('#tavern-notes-lite-export-menu');
    menu?.classList.remove('open');
    menu?.setAttribute('aria-hidden', 'true');
}

function setExportScope(scope = 'all') {
    state.exportScope = scope === 'page' ? 'page' : 'all';
    document.querySelectorAll('#tavern-notes-lite-export-menu .tnl-export-scope-choice').forEach(button => {
        button.classList.toggle('active', button.dataset.scope === state.exportScope);
    });
}

function toggleThemeMenu() {
    const menu = document.querySelector('#tavern-notes-lite-theme-menu');
    if (!menu) return;
    closeHeaderPopovers();
    if (menu.classList.contains('open')) {
        closeThemeMenu();
        return;
    }
    refreshThemeList().catch(() => {});
    menu.classList.add('open');
    menu.setAttribute('aria-hidden', 'false');
}

function closeThemeMenu() {
    const menu = document.querySelector('#tavern-notes-lite-theme-menu');
    menu?.classList.remove('open');
    menu?.setAttribute('aria-hidden', 'true');
}

function getExportNote(note) {
    const activeNote = getActiveVariant(note);
    return {
        ...note,
        ...activeNote,
        id: activeNote.id || note.id,
        type: activeNote.type || note.type,
        character: activeNote.character || note.character,
        chat: activeNote.chat || note.chat,
        tags: activeNote.tags || note.tags || [],
        variant: getNoteVariants(note).length > 1 ? {
            groupId: note.id,
            activeIndex: getVariantIndex(note),
            count: getNoteVariants(note).length,
        } : undefined,
    };
}

function buildCurrentPageExport() {
    return {
        ok: true,
        format: 'tavern-notes-export',
        version: 1,
        scope: 'current-page',
        exportedAt: new Date().toISOString(),
        page: state.page,
        pageSize: state.pageSize,
        filter: state.filter,
        query: state.query,
        characterFilter: state.characterFilter,
        totalNotes: state.totalNotes,
        notes: state.notes.map(getExportNote),
    };
}

function groupNotesByCharacterForText(notes) {
    const groups = new Map();
    for (const note of notes) {
        const characterName = note.character?.name || '未命名角色';
        const key = [
            note.character?.id ?? '',
            note.character?.avatar ?? '',
            characterName,
        ].map(value => String(value).replaceAll('|', '\\|')).join('|');

        if (!groups.has(key)) {
            groups.set(key, {
                characterName,
                notes: [],
            });
        }
        groups.get(key).notes.push(note);
    }
    return Array.from(groups.values());
}

function formatNoteForText(note, index) {
    const created = note.createdAt ? new Date(note.createdAt).toLocaleString('zh-CN', { hour12: false }) : '';
    const chatName = note.chat?.name || '';
    const message = note.chat?.messageId === null || note.chat?.messageId === undefined ? '' : `#${note.chat.messageId}`;
    const source = [created, chatName, message].filter(Boolean).join(' · ');
    const tags = Array.isArray(note.tags) ? note.tags : [];
    return [
        `${index + 1}. ${note.content || ''}`,
        tags.length ? `   #${tags.join(' #')}` : '',
        source ? `   ${source}` : '',
    ].filter(Boolean).join('\n');
}

function buildTextSection(title, notes, emptyText) {
    const lines = [`【${title}】`, ''];
    if (!notes.length) {
        lines.push(emptyText, '');
        return lines;
    }

    for (const group of groupNotesByCharacterForText(notes)) {
        lines.push(`《${group.characterName}》`);
        lines.push(`共 ${group.notes.length} 条${title}`);
        lines.push('');
        lines.push(group.notes.map(formatNoteForText).join('\n\n'));
        lines.push('');
    }
    return lines;
}

function textExportCountLine(notes) {
    const userInputCount = notes.filter(note => note.type === 'user_input').length;
    const excerptCount = notes.filter(note => note.type === 'excerpt').length;
    if (userInputCount === notes.length) return `共 ${notes.length} 条User 输入`;
    if (excerptCount === notes.length) return `共 ${notes.length} 条摘抄`;
    return `共 ${notes.length} 条笔记（User 输入 ${userInputCount} · 摘抄 ${excerptCount}）`;
}

function buildPlainTextExport(notes) {
    const groups = groupNotesByCharacterForText(notes);
    if (!groups.length) return '暂无笔记\n\n——来自酒馆笔记\n';

    const body = groups.map(group => [
        `《${group.characterName}》`,
        textExportCountLine(group.notes),
        '',
        group.notes
            .map(note => String(note.content || '').trim())
            .filter(Boolean)
            .join('\n\n'),
    ].filter(line => line !== '').join('\n')).join('\n\n');

    return `${body}\n\n——来自酒馆笔记\n`;
}

function buildCurrentPageTxtExport(exportData) {
    return buildPlainTextExport(exportData.notes || []);
}

async function exportNotes(format = 'json') {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const scope = state.exportScope === 'page' ? 'page' : 'all';
    if (scope === 'page') {
        const exportData = buildCurrentPageExport();
        if (!exportData.notes.length) throw new Error(t('noPageNotesToExport'));
        if (format === 'json') {
            downloadTextFile(JSON.stringify(exportData, null, 2), `tavern-notes-lite-current-page-${stamp}.json`, 'application/json;charset=utf-8');
        }
        if (format === 'txt') {
            downloadTextFile(buildCurrentPageTxtExport(exportData), `tavern-notes-lite-current-page-${stamp}.txt`, 'text/plain;charset=utf-8');
        }
    } else {
        const notes = await getAllLiteNotes();
        if (format === 'json') {
            const exportData = await getLiteExport(getLiteUserName());
            downloadTextFile(JSON.stringify(exportData, null, 2), `tavern-notes-lite-all-${stamp}.json`, 'application/json;charset=utf-8');
        }
        if (format === 'txt') {
            downloadTextFile(buildPlainTextExport(notes), `tavern-notes-lite-all-${stamp}.txt`, 'text/plain;charset=utf-8');
        }
    }
    await markLiteExported();
    closeExportMenu();
    notify(t('exportStarted'), 'success');
}

function openShareCard(note) {
    state.shareCardNote = note;
    const menu = document.querySelector('#tavern-notes-lite-share-menu');
    if (!menu) return;
    syncShareCardControls();
    menu.classList.add('open');
    menu.setAttribute('aria-hidden', 'false');
    drawShareCard().catch(error => notify(error.message, 'error'));
}

function closeShareCard() {
    const menu = document.querySelector('#tavern-notes-lite-share-menu');
    menu?.classList.remove('open');
    menu?.setAttribute('aria-hidden', 'true');
}

function syncShareCardControls() {
    const settings = state.shareCardSettings;
    document.querySelectorAll('.tnl-share-choice').forEach(button => {
        button.classList.toggle('active', button.dataset.shareTheme === settings.theme);
    });
    document.querySelectorAll('.tnl-share-bg').forEach(button => {
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
    applyShareFontImport();
}

function stripFontQuotes(value) {
    return String(value || '').trim().replace(/^['"]|['"]$/g, '');
}

function quoteFontFamily(value) {
    const clean = stripFontQuotes(value);
    if (!clean) return '';
    return `"${clean.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function getImportedFonts() {
    state.shareCardSettings.importedFonts = sanitizeImportedFonts(state.shareCardSettings.importedFonts);
    return state.shareCardSettings.importedFonts;
}

function renderSavedShareFonts(select) {
    if (!select) return;
    const fonts = getImportedFonts();
    select.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = fonts.length ? t('savedFontsPlaceholder') : t('noSavedFonts');
    select.append(placeholder);
    fonts.forEach(font => {
        const option = document.createElement('option');
        option.value = font.id;
        option.textContent = font.type === 'local' ? `${font.name} · local` : font.name;
        select.append(option);
    });
    const currentName = stripFontQuotes(state.shareCardSettings.fontFamily);
    const current = fonts.find(font => stripFontQuotes(font.name) === currentName);
    select.value = current?.id || '';
}

function rememberImportedFont(entry) {
    if (!entry?.name || (!entry.css && entry.type !== 'local')) return;
    const id = entry.id || `${entry.type || 'css'}:${stripFontQuotes(entry.name)}:${Date.now()}`;
    const next = {
        id,
        type: entry.type || 'css',
        name: stripFontQuotes(entry.name),
        css: entry.css || '',
        dataUrl: entry.dataUrl || '',
    };
    const fonts = getImportedFonts()
        .filter(font => font.id !== id && !(font.type === next.type && stripFontQuotes(font.name) === next.name));
    state.shareCardSettings.importedFonts = [next, ...fonts].slice(0, 16);
}

async function applySavedShareFont(fontId) {
    const font = getImportedFonts().find(item => item.id === fontId);
    if (!font) return;
    if (font.type === 'local') {
        await loadLocalShareFont(font);
        state.shareCardSettings = {
            ...state.shareCardSettings,
            fontFamily: quoteFontFamily(font.name),
            fontImport: '',
        };
    } else {
        state.shareCardSettings = {
            ...state.shareCardSettings,
            fontFamily: quoteFontFamily(font.name),
            fontImport: font.css || '',
        };
    }
    saveLocalSettings();
    syncShareCardControls();
    await drawShareCard();
}

function updateShareCardSetting(next) {
    state.shareCardSettings = {
        ...state.shareCardSettings,
        ...next,
    };
    saveLocalSettings();
    syncShareCardControls();
    drawShareCard().catch(error => notify(error.message, 'error'));
}

async function importShareCardFont() {
    const raw = String(state.shareCardSettings.fontImport || '').trim();
    if (!raw) {
        notify(t('pasteFontFirst'), 'warning');
        return;
    }
    const css = await buildShareFontCss(raw);
    const family = parseShareFontFamilyFromCss(css);
    if (family) rememberImportedFont({ type: 'css', name: stripFontQuotes(family), css });
    state.shareCardSettings = {
        ...state.shareCardSettings,
        fontImport: css,
        fontFamily: family || state.shareCardSettings.fontFamily || 'system-ui',
    };
    saveLocalSettings();
    syncShareCardControls();
    await drawShareCard();
    notify(family ? t('importedFont', { name: stripFontQuotes(family) }) : t('importedFontCode'), 'success');
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('File read failed.'));
        reader.readAsDataURL(file);
    });
}

function openFontDb() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error(t('localFontUnsupported')));
            return;
        }
        const request = indexedDB.open(FONT_DB_NAME, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(FONT_DB_STORE, { keyPath: 'id' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('IndexedDB open failed.'));
    });
}

async function putLocalFontData(id, dataUrl) {
    const db = await openFontDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(FONT_DB_STORE, 'readwrite');
        transaction.objectStore(FONT_DB_STORE).put({ id, dataUrl });
        transaction.oncomplete = () => {
            db.close();
            resolve();
        };
        transaction.onerror = () => {
            db.close();
            reject(transaction.error || new Error('IndexedDB write failed.'));
        };
    });
}

async function getLocalFontData(id) {
    const db = await openFontDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(FONT_DB_STORE, 'readonly');
        const request = transaction.objectStore(FONT_DB_STORE).get(id);
        request.onsuccess = () => resolve(request.result?.dataUrl || '');
        request.onerror = () => reject(request.error || new Error('IndexedDB read failed.'));
        transaction.oncomplete = () => db.close();
    });
}

async function loadLocalShareFont(font) {
    if (!window.FontFace || !document.fonts) throw new Error(t('localFontUnsupported'));
    const dataUrl = font.dataUrl || await getLocalFontData(font.id);
    if (!dataUrl) throw new Error(t('savedFontMissing'));
    const family = stripFontQuotes(font.name);
    const face = new FontFace(family, `url(${dataUrl})`);
    await face.load();
    document.fonts.add(face);
}

async function ensureSelectedLocalShareFontLoaded() {
    const family = stripFontQuotes(state.shareCardSettings.fontFamily);
    if (!family) return;
    const font = getImportedFonts().find(item => item.type === 'local' && stripFontQuotes(item.name) === family && item.dataUrl);
    if (font) await loadLocalShareFont(font);
}

async function importLocalShareCardFont(event) {
    const input = event.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const family = file.name.replace(/\.(ttf|otf|woff2?)$/i, '').trim() || 'Local Font';
    const dataUrl = await readFileAsDataUrl(file);
    const font = {
        id: `local:${family}:${Date.now()}`,
        type: 'local',
        name: family,
        dataUrl,
    };
    await loadLocalShareFont(font);
    await putLocalFontData(font.id, dataUrl);
    state.shareCardSettings = {
        ...state.shareCardSettings,
        fontFamily: quoteFontFamily(family),
        fontImport: '',
    };
    rememberImportedFont({ ...font, dataUrl: '' });
    saveLocalSettings();
    syncShareCardControls();
    await drawShareCard();
    notify(t('localFontImported', { name: family }), 'success');
}

function applyShareFontImport() {
    const style = document.querySelector('#tavern-notes-lite-share-font-style');
    if (!style) return;
    const css = sanitizeShareFontCss(state.shareCardSettings.fontImport || '');
    if (!css) {
        style.textContent = '';
        return;
    }
    style.textContent = css;
}

async function buildShareFontCss(raw) {
    const normalized = normalizeShareFontCss(raw);
    const url = extractShareFontCssUrl(normalized);
    let remoteCss = '';
    if (url) {
        try {
            const response = await fetch(url);
            if (response.ok) remoteCss = resolveShareFontCssUrls(await response.text(), url);
        } catch {
            remoteCss = '';
        }
    }
    const safeCss = sanitizeShareFontCss(`${normalized}\n${remoteCss}`);
    const family = parseShareFontFamilyFromCss(safeCss)
        || parseShareFontFamilyFromCss(normalized)
        || parseShareFontFamilyFromCss(remoteCss);
    return [
        safeCss,
        family ? `.tavern-notes-lite-share-font-probe { font-family: ${family}; }` : '',
    ].filter(Boolean).join('\n');
}

function normalizeShareFontCss(value) {
    const text = String(value || '').trim();
    if (/^https?:\/\/\S+$/i.test(text)) return `@import url("${text}");`;
    return text
        .split(/\r?\n/)
        .map(line => {
            const text = line.trim();
            if (/^https?:\/\/\S+$/i.test(text)) return `@import url("${text}");`;
            if (/^@import\b/i.test(text) && !/[;{}]\s*$/.test(text)) return `${text};`;
            return line;
        })
        .join('\n');
}

function sanitizeShareFontCss(value) {
    const css = String(value || '').replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = css.match(/@font-face\s*\{[^{}]*\}/gi) || [];
    return rules
        .filter(rule => !/<\/?script|javascript\s*:|expression\s*\(/i.test(rule))
        .join('\n');
}

function resolveShareFontCssUrls(value, stylesheetUrl) {
    return String(value || '').replace(/url\(\s*(['"]?)([^'"\)]+)\1\s*\)/gi, (match, quote, rawUrl) => {
        const fontUrl = String(rawUrl || '').trim();
        if (!fontUrl || /^(?:data:|blob:|https?:|\/\/|#)/i.test(fontUrl)) return match;
        try {
            return `url("${new URL(fontUrl, stylesheetUrl).href}")`;
        } catch {
            return match;
        }
    });
}

function extractShareFontCssUrl(css) {
    const importUrl = String(css || '').match(/@import\s+url\((['"]?)(.*?)\1\)/i);
    if (importUrl?.[2]) return importUrl[2].trim();
    const plainUrl = String(css || '').match(/https?:\/\/[^\s'")]+/i);
    return plainUrl?.[0] || '';
}

function shareCardFontStack() {
    const family = String(state.shareCardSettings.fontFamily || parseShareFontFamilyFromCss(state.shareCardSettings.fontImport) || '').trim();
    if (!family || family === 'system-ui') return 'system-ui, "Noto Serif SC", serif';
    return `${family}, "Noto Serif SC", "Microsoft YaHei", serif`;
}

function parseShareFontFamilyFromCss(css) {
    const match = String(css || '').match(/font-family\s*:\s*([^;}\n]+)/i);
    if (!match) return '';
    return match[1].trim();
}

async function waitForShareCardFonts(font) {
    if (!document.fonts) return;
    const timeout = new Promise(resolve => setTimeout(resolve, 900));
    const tasks = [];
    if (document.fonts.load) tasks.push(document.fonts.load(`32px ${font}`, '酒馆笔记分享卡'));
    if (document.fonts.ready) tasks.push(document.fonts.ready);
    await Promise.race([Promise.allSettled(tasks), timeout]);
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

function loadShareCardImage(url) {
    return new Promise(resolve => {
        if (!url) {
            resolve(null);
            return;
        }
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = url;
    });
}

function shareCardDateParts(note) {
    const date = note?.createdAt ? new Date(note.createdAt) : new Date();
    const month = date.toLocaleString('en-US', { month: 'long' }).toUpperCase();
    const weekday = date.toLocaleDateString('zh-CN', { weekday: 'long' });
    const zhDate = date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    });
    const zhDigits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    const zhYearDigits = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    const toZhNumber = value => {
        const number = Number(value);
        if (number <= 10) return number === 10 ? '十' : zhDigits[number];
        if (number < 20) return `十${zhDigits[number - 10]}`;
        const tens = Math.floor(number / 10);
        const ones = number % 10;
        return `${zhDigits[tens]}十${ones ? zhDigits[ones] : ''}`;
    };
    const zhYear = String(date.getFullYear()).split('').map(item => zhYearDigits[Number(item)] || item).join('');
    const zhMonth = toZhNumber(date.getMonth() + 1);
    const zhDay = toZhNumber(date.getDate());

    return {
        day: String(date.getDate()),
        month,
        year: String(date.getFullYear()),
        weekday,
        full: zhDate,
        vertical: `${date.getFullYear()}年 · ${date.getMonth() + 1}月 · ${date.getDate()}日`,
        verticalZh: `${zhYear}年·${zhMonth}月·${zhDay}日`,
    };
}

function isDarkShareCardColor(color) {
    const hex = String(color || '').replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(hex)) return false;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 145;
}

function wrapCanvasText(ctx, text, maxWidth) {
    const paragraphs = String(text || '').split(/\n+/).map(item => item.trim()).filter(Boolean);
    const lines = [];
    for (const paragraph of paragraphs) {
        let line = '';
        for (const char of Array.from(paragraph)) {
            const test = line + char;
            if (line && ctx.measureText(test).width > maxWidth) {
                lines.push(line);
                line = char;
            } else {
                line = test;
            }
        }
        if (line) lines.push(line);
        lines.push('');
    }
    if (lines[lines.length - 1] === '') lines.pop();
    return lines;
}

function roundedRectPath(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
}

function drawMultiline(ctx, lines, x, y, lineHeight, maxLines) {
    const visible = maxLines ? lines.slice(0, maxLines) : lines;
    visible.forEach((line, index) => {
        ctx.fillText(line, x, y + index * lineHeight);
    });
    if (maxLines && lines.length > maxLines) {
        ctx.fillText('...', x, y + visible.length * lineHeight);
    }
}

function drawMultilineFit(ctx, lines, x, y, lineHeight, maxY) {
    const maxLines = Math.max(1, Math.floor((maxY - y) / lineHeight));
    drawMultiline(ctx, lines, x, y, lineHeight, maxLines);
}

function hasLatinText(text) {
    return /[a-z]/i.test(String(text || ''));
}

function drawShareTitle(ctx, title, x, y, options = {}) {
    const {
        font,
        color,
        maxWidth = 360,
        largeSize = 72,
        smallSize = 38,
        verticalLine = false,
        lineColor = color,
    } = options;
    ctx.save();
    ctx.fillStyle = color;

    if (hasLatinText(title)) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = `600 ${smallSize}px ${font}`;
        const lines = wrapCanvasText(ctx, title, maxWidth).filter(Boolean).slice(0, 3);
        drawMultiline(ctx, lines, x, y, Math.round(smallSize * 1.35), 3);
        if (verticalLine) {
            ctx.strokeStyle = lineColor;
            ctx.globalAlpha = 0.26;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x - 28, y - smallSize);
            ctx.lineTo(x - 28, y + lines.length * smallSize * 1.35 + 12);
            ctx.stroke();
        }
    } else {
        ctx.font = `500 ${largeSize}px ${font}`;
        drawVerticalText(ctx, title, x + 34, y - largeSize, Math.round(largeSize * 1.04), verticalLine ? { lineRight: 64, lineColor } : {});
    }

    ctx.restore();
}

function drawVerticalText(ctx, text, x, y, lineHeight, options = {}) {
    const chars = Array.from(String(text || ''));
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const baseFont = ctx.font;
    let offset = 0;
    chars.forEach(char => {
        const isDot = char === '·' || char === '?' || char === '。';
        if (isDot) {
            ctx.save();
            ctx.font = baseFont.replace(/(\d+(?:\.\d+)?)px/, (_, size) => `${Math.max(10, Math.round(Number(size) * 0.48))}px`);
            ctx.fillText('·', x, y + offset + lineHeight * 0.18);
            ctx.restore();
            offset += lineHeight * 0.42;
            return;
        }
        ctx.font = baseFont;
        ctx.fillText(char, x, y + offset);
        offset += lineHeight;
    });
    if (options.lineLeft || options.lineRight) {
        const height = offset;
        ctx.strokeStyle = options.lineColor || ctx.fillStyle;
        ctx.lineWidth = options.lineWidth || 1;
        ctx.globalAlpha = options.lineAlpha ?? 0.34;
        if (options.lineLeft) {
            ctx.beginPath();
            ctx.moveTo(x - options.lineLeft, y - 8);
            ctx.lineTo(x - options.lineLeft, y + height + 2);
            ctx.stroke();
        }
        if (options.lineRight) {
            ctx.beginPath();
            ctx.moveTo(x + options.lineRight, y - 8);
            ctx.lineTo(x + options.lineRight, y + height + 2);
            ctx.stroke();
        }
    }
    ctx.restore();
}

function drawMobaiUserColumn(ctx, text, x, y, fontSize, font, color, lineColor) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `400 ${fontSize}px ${font}`;
    if (hasLatinText(text)) {
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 0, 0);
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = lineColor;
        ctx.globalAlpha = 0.34;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - 34, y - 28);
        ctx.lineTo(x - 34, y + 220);
        ctx.moveTo(x + 34, y - 28);
        ctx.lineTo(x + 34, y + 220);
        ctx.stroke();
        ctx.restore();
        return;
    }
    drawVerticalText(ctx, text, x, y, Math.round(fontSize * 1.42), { lineLeft: 32, lineRight: 32, lineColor });
    ctx.restore();
}

function drawCircleImage(ctx, image, x, y, size) {
    ctx.save();
    roundedRectPath(ctx, x, y, size, size, size / 2);
    ctx.clip();
    const scale = Math.max(size / image.width, size / image.height);
    const drawW = image.width * scale;
    const drawH = image.height * scale;
    ctx.drawImage(image, x + (size - drawW) / 2, y + (size - drawH) / 2, drawW, drawH);
    ctx.restore();
}

function drawCoverImage(ctx, image, x, y, width, height, radius = 0) {
    ctx.save();
    roundedRectPath(ctx, x, y, width, height, radius);
    ctx.clip();
    const scale = Math.max(width / image.width, height / image.height);
    const drawW = image.width * scale;
    const drawH = image.height * scale;
    ctx.drawImage(image, x + (width - drawW) / 2, y + (height - drawH) / 2, drawW, drawH);
    ctx.restore();
}

function drawShareAvatarBox(ctx, image, x, y, size, color, font, label) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.26;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, size, size);
    ctx.globalAlpha = 1;
    if (image) {
        drawCoverImage(ctx, image, x + 6, y + 6, size - 12, size - 12, 2);
    } else {
        ctx.fillStyle = 'rgba(10, 69, 38, 0.08)';
        ctx.fillRect(x + 6, y + 6, size - 12, size - 12);
        ctx.fillStyle = color;
        ctx.font = `700 34px ${font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(getCharacterInitial(label), x + size / 2, y + size / 2);
    }
    ctx.restore();
}

function drawShareCardFooter(ctx, layout) {
    const {
        width,
        height,
        font,
        userName,
        dateText,
        avatar,
        character,
        textColor,
        muted,
        lineColor,
        left = 88,
        right = width - 88,
        footerY = height - 244,
        avatarSize = 124,
        showMeta = true,
    } = layout;

    ctx.save();
    ctx.strokeStyle = lineColor;
    ctx.globalAlpha = 0.26;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, footerY);
    ctx.lineTo(right, footerY);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    if (showMeta) {
        ctx.fillStyle = textColor;
        ctx.font = `600 28px ${font}`;
        ctx.fillText(`${userName} · ${t('excerptedAt')} ${dateText}`, left, footerY + 94);
    }
    ctx.fillStyle = muted;
    ctx.font = `600 29px ${font}`;
    ctx.fillText(t('brandForShare'), left, footerY + (showMeta ? 148 : 112));

    drawShareAvatarBox(ctx, avatar, right - avatarSize, footerY + 44, avatarSize, textColor, font, character);
    ctx.restore();
}

function shareCardSourceLine(note, character) {
    const chatName = String(note?.chat?.name || '').trim();
    return ` / ${chatName || character}`;
}

async function drawShareCard() {
    const canvas = document.querySelector('#tavern-notes-lite-share-canvas');
    const note = state.shareCardNote;
    if (!canvas || !note) return;

    await ensureSelectedLocalShareFontLoaded();
    applyShareFontImport();
    const font = shareCardFontStack();
    await waitForShareCardFonts(font);
    const [characterAvatar, userAvatar] = await Promise.all([
        loadShareCardImage(getShareCardAvatarUrl(note)),
        loadShareCardImage(getShareCardUserAvatarUrl()),
    ]);

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const settings = state.shareCardSettings;
    const background = settings.background || '#eef7f2';
    const themeId = settings.theme || 'calendar';
    const darkBackground = isDarkShareCardColor(background);
    const textColor = settings.textColor || (darkBackground ? '#f6f3ed' : '#103f25');
    const muted = darkBackground ? 'rgba(246,243,237,0.62)' : 'rgba(16,63,37,0.64)';
    const lineColor = darkBackground ? 'rgba(246,243,237,0.42)' : 'rgba(16,63,37,0.26)';
    const dates = shareCardDateParts(note);
    const character = note.character?.name || '未命名角色';
    const content = String(note.content || '').trim();
    const userName = getShareCardUserName();
    const readFont = font;
    const fontScale = Math.min(Math.max(Number(settings.fontScale || 0.8), 0.65), 1.1);
    const s = size => Math.round(size * fontScale);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    if (themeId === 'calendar') {
        const calendarText = settings.textColor || (darkBackground ? '#f6f3ed' : '#211d19');
        const calendarMuted = darkBackground ? 'rgba(246,243,237,0.62)' : 'rgba(33,29,25,0.58)';
        const left = 126;
        const right = width - 126;
        let y = 180;

        ctx.textAlign = 'center';
        ctx.fillStyle = calendarText;
        ctx.font = `800 164px ${font}`;
        ctx.fillText(dates.day, width / 2, y + 48);
        ctx.font = `800 44px ${font}`;
        ctx.fillText(`${dates.month} ${dates.year}`, width / 2, y + 140);
        ctx.font = `400 27px ${font}`;
        ctx.fillStyle = calendarMuted;
        ctx.fillText(dates.weekday, width / 2, y + 196);
        ctx.strokeStyle = calendarMuted;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(width / 2 - 56, y + 275);
        ctx.lineTo(width / 2 + 56, y + 275);
        ctx.stroke();
        y += 360;

        ctx.textAlign = 'left';
        ctx.fillStyle = calendarText;
        ctx.font = `800 36px ${font}`;
        if (settings.showCharacter) {
            ctx.fillText(`《${character}》`, left, y);
            y += 76;
        }

        ctx.font = `700 34px ${font}`;
        const lines = wrapCanvasText(ctx, content, right - left);
        drawMultiline(ctx, lines, left, y, 68, 11);

        const footerY = height - 112;
        const avatarSize = 58;
        if (characterAvatar) {
            drawCircleImage(ctx, characterAvatar, right - avatarSize, footerY - avatarSize + 18, avatarSize);
        } else {
            ctx.save();
            roundedRectPath(ctx, right - avatarSize, footerY - avatarSize + 18, avatarSize, avatarSize, avatarSize / 2);
            ctx.fillStyle = darkBackground ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.08)';
            ctx.fill();
            ctx.fillStyle = calendarMuted;
            ctx.font = `700 26px ${font}`;
            ctx.textAlign = 'center';
            ctx.fillText(getCharacterInitial(character), right - avatarSize / 2, footerY - 2);
            ctx.restore();
        }

        ctx.textAlign = 'right';
        ctx.fillStyle = calendarMuted;
        ctx.font = `400 22px ${font}`;
        ctx.fillText(t('fromTavernNotes'), right - avatarSize - 18, footerY);
        return;
    }

    const left = 88;
    const right = width - 88;

    if (themeId === 'dialogue') {
        const avatarSize = 118;
        if (userAvatar) {
            drawCircleImage(ctx, userAvatar, left, 122, avatarSize);
        } else {
            ctx.save();
            roundedRectPath(ctx, left, 122, avatarSize, avatarSize, avatarSize / 2);
            ctx.fillStyle = 'rgba(18,63,37,0.12)';
            ctx.fill();
            ctx.fillStyle = textColor;
            ctx.font = `600 ${s(42)}px ${readFont}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(getCharacterInitial(userName), left + avatarSize / 2, 122 + avatarSize / 2);
            ctx.restore();
        }

        ctx.fillStyle = darkBackground ? '#fffaf2' : '#2b2824';
        ctx.font = `600 ${s(46)}px ${readFont}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(userName, left, 324);
        ctx.font = `600 ${s(31)}px ${readFont}`;
        ctx.fillText(`${t('excerptedAt')} ${dates.full}`, left, 390);

        const footerY = 1154;
        ctx.font = `400 ${s(46)}px ${readFont}`;
        const lines = wrapCanvasText(ctx, content, right - left);
        drawMultilineFit(ctx, lines, left, 520, s(88), 1016);

        ctx.fillStyle = muted;
        ctx.font = `400 ${s(29)}px ${readFont}`;
        drawMultiline(ctx, wrapCanvasText(ctx, shareCardSourceLine(note, character), right - left), left, 1040, s(44), 1);

        drawShareCardFooter(ctx, {
            width,
            height,
            font: readFont,
            userName,
            dateText: dates.full,
            avatar: characterAvatar,
            character,
            textColor: darkBackground ? '#fffaf2' : '#2b2824',
            muted,
            lineColor,
            left,
            right,
            footerY,
            showMeta: false,
        });
        return;
    }

    if (themeId === 'mobai') {
        const mobaiOffsetY = 38;
        const contentY = 552;
        const sourceY = 1088;
        const footerY = 1132;
        ctx.save();
        drawShareTitle(ctx, character, left, 196 + mobaiOffsetY, {
            font: readFont,
            color: textColor,
            maxWidth: 360,
            largeSize: s(64),
            smallSize: s(36),
            verticalLine: false,
            lineColor,
        });

        ctx.fillStyle = muted;
        ctx.font = `400 ${s(25)}px ${readFont}`;
        drawVerticalText(ctx, dates.verticalZh, right - 34, 142 + mobaiOffsetY, s(36), { lineLeft: 28, lineRight: 28, lineColor });
        drawMobaiUserColumn(ctx, `${userName}·${t('excerptedAt')}`, right - 126, 166 + mobaiOffsetY, s(25), readFont, muted, lineColor);
        ctx.restore();

        ctx.fillStyle = textColor;
        ctx.font = `400 ${s(38)}px ${readFont}`;
        ctx.textAlign = 'left';
        const contentRight = right - 70;
        const lines = wrapCanvasText(ctx, content, contentRight - left);
        drawMultilineFit(ctx, lines, left, contentY, s(70), 1042);

        ctx.fillStyle = muted;
        ctx.font = `400 ${s(29)}px ${readFont}`;
        ctx.fillText(shareCardSourceLine(note, character), left, sourceY);

        drawShareCardFooter(ctx, {
            width,
            height,
            font: readFont,
            userName,
            dateText: dates.full,
            avatar: characterAvatar,
            character,
            textColor,
            muted,
            lineColor,
            left,
            right,
            footerY,
            showMeta: false,
        });

        ctx.save();
        ctx.strokeStyle = textColor;
        ctx.globalAlpha = 0.88;
        ctx.lineWidth = 20;
        ctx.beginPath();
        ctx.moveTo(left - 18, height - 58);
        ctx.lineTo(right + 18, height - 58);
        ctx.stroke();
        ctx.restore();
        return;
    }

    drawShareTitle(ctx, character, left, 300, {
        font: readFont,
        color: textColor,
        maxWidth: 420,
        largeSize: s(76),
        smallSize: s(42),
        verticalLine: false,
        lineColor,
    });

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = textColor;
    ctx.font = `400 ${s(42)}px ${readFont}`;
    const lines = wrapCanvasText(ctx, content, right - left);
    drawMultilineFit(ctx, lines, left, 560, s(78), 1054);

    ctx.fillStyle = muted;
    ctx.font = `400 ${s(30)}px ${readFont}`;
    ctx.fillText(shareCardSourceLine(note, character), left, 1100);

    drawShareCardFooter(ctx, {
        width,
        height,
        font: readFont,
        userName,
        dateText: dates.full,
        avatar: characterAvatar,
        character,
        textColor,
        muted,
        lineColor,
        left,
        right,
        footerY: 1162,
    });
}

async function downloadShareCard() {
    await drawShareCard();
    const canvas = document.querySelector('#tavern-notes-lite-share-canvas');
    const note = state.shareCardNote;
    if (!canvas || !note) throw new Error(t('noShareCardToExport'));
    const stamp = new Date().toISOString().slice(0, 10);
    const character = (note.character?.name || '未命名角色').replace(/[\\/:*?"<>|]/g, '_');
    canvas.toBlob(blob => {
        if (!blob) {
            notify(t('shareCardExportFailed'), 'error');
            return;
        }
        const url = URL.createObjectURL(blob);
        exportFile(url, `${t('brandForShare')}-${character}-${stamp}.png`);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        notify(t('shareCardExported'), 'success');
    }, 'image/png');
}

async function confirmDelete(note) {
    const preview = String(note.content || '').slice(0, 40).replace(/\s+/g, ' ');
    return window.confirm(t('confirmDeleteNote', {
        preview,
        ellipsis: note.content.length > 40 ? '...' : '',
    }));
}

function openFullNote(note) {
    const modal = document.querySelector('#tavern-notes-lite-modal');
    if (!modal) return;
    modal.querySelector('.tnl-modal-kicker').textContent = `${noteTypeLabel(note.type)} · ${note.character?.name || '未命名角色'}`;
    modal.querySelector('.tnl-modal-title').textContent = note.createdAt ? new Date(note.createdAt).toLocaleString() : '全文';
    modal.querySelector('.tnl-modal-content').innerHTML = renderQuotedText(note.content);
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
}

function closeFullNote() {
    const modal = document.querySelector('#tavern-notes-lite-modal');
    modal?.classList.remove('open');
    modal?.setAttribute('aria-hidden', 'true');
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

function openEditNote(note) {
    const menu = document.querySelector('#tavern-notes-lite-edit-menu');
    if (!menu || !note) return;
    state.editingNote = note;
    state.editingTags = parseTagsInput(note.tags || []);
    const content = menu.querySelector('#tavern-notes-lite-edit-content');
    const tags = menu.querySelector('#tavern-notes-lite-edit-tags');
    if (content) content.value = note.content || '';
    if (tags) tags.value = '';
    renderEditTagChips();
    renderTagSuggestions();
    menu.classList.add('open');
    menu.setAttribute('aria-hidden', 'false');
    setTimeout(() => content?.focus(), 0);
}

function closeEditNote() {
    const menu = document.querySelector('#tavern-notes-lite-edit-menu');
    menu?.classList.remove('open');
    menu?.setAttribute('aria-hidden', 'true');
    state.editingNote = null;
    state.editingTags = [];
}

async function saveEditedNote() {
    const note = state.editingNote;
    if (!note) return;
    const content = String(document.querySelector('#tavern-notes-lite-edit-content')?.value || '').trim();
    if (!content) throw new Error(t('noteContentRequired'));
    commitEditTagInput();
    const tags = [...state.editingTags];
    await api(`/notes/${encodeURIComponent(note.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ content, tags }),
    });
    tags.forEach(rememberTag);
    closeEditNote();
    await refreshNotes();
    notify(t('noteUpdated'), 'success');
}

function normalizeTheme(theme) {
    return {
        ...DEFAULT_THEME,
        ...(theme || {}),
    variables: {
        '--tnl-theme-flavor': 'default',
            ...DEFAULT_THEME.variables,
            ...toLiteThemeVariables(theme?.variables),
        },
        assets: {
            ...DEFAULT_THEME.assets,
            ...(theme?.assets || {}),
        },
    };
}

function normalizeAppleThemeId(id = state.activeThemeId) {
    if (id === LEGACY_APPLE_THEME_DAY_ID || id === LEGACY_APPLE_THEME_NIGHT_ID) return APPLE_THEME_ID;
    return id;
}

function themeIsApple(theme = state.theme) {
    return String(theme?.variables?.['--tnl-theme-flavor'] || '').toLowerCase() === 'apple';
}

function applyAppleGlassMode(theme) {
    if (!themeIsApple(theme)) return theme;
    const mode = state.appleGlassMode === 'night' ? 'night' : 'day';
    const variables = mode === 'night' ? APPLE_GLASS_NIGHT_VARIABLES : APPLE_GLASS_DAY_VARIABLES;
    return {
        ...theme,
        variables: {
            ...theme.variables,
            ...APPLE_GLASS_SHARED_VARIABLES,
            ...variables,
        },
    };
}

function applyDefaultThemeMode(theme) {
    const isDefault = normalizeAppleThemeId(state.activeThemeId) === 'default'
        && String(theme?.variables?.['--tnl-theme-flavor'] || 'default').toLowerCase() === 'default';
    if (!isDefault || state.defaultThemeMode !== 'night') return theme;
    return { ...theme, variables: { ...theme.variables, ...DEFAULT_NIGHT_VARIABLES } };
}

function paintTheme(theme) {
    const clean = applyDefaultThemeMode(applyAppleGlassMode(normalizeTheme(theme)));
    const panel = document.querySelector('#tavern-notes-lite-panel');
    if (panel) {
        Object.entries(clean.variables).forEach(([key, value]) => {
            if (key.startsWith('--tnl-')) panel.style.setProperty(key, String(value));
        });
        const flavor = String(clean.variables['--tnl-theme-flavor'] || '').replace(/[^a-z0-9_-]/gi, '').toLowerCase();
        if (flavor) panel.dataset.themeFlavor = flavor;
        else delete panel.dataset.themeFlavor;
        if (flavor === 'default') panel.dataset.themeMode = state.defaultThemeMode;
        else delete panel.dataset.themeMode;
        if (flavor !== 'archive') panel.classList.remove('tnl-archive-reading');
        if (clean.assets.backgroundImage) {
            const image = String(clean.assets.backgroundImage).trim();
            const cssImage = /^(url|linear-gradient|radial-gradient|conic-gradient)\(/i.test(image) ? image : `url("${image}")`;
            panel.style.setProperty('--tnl-background-image', cssImage);
        } else {
            panel.style.removeProperty('--tnl-background-image');
        }
    }
    updateThemeIcons(clean);
    updateAppleThemeModeButton();
    return clean;
}

function applyTheme(theme) {
    const clean = paintTheme(theme);
    state.theme = clean;
    document.querySelector('.tnl-theme-name')?.replaceChildren(document.createTextNode(t('currentTheme', { name: clean.name || t('unnamedTheme') })));
    return clean;
}

function renderThemeSelect() {
    const select = document.querySelector('#tavern-notes-lite-theme-select');
    if (!select) return;
    const themes = state.themes?.length ? state.themes : [{ id: 'default', name: 'Soft Neomorphism' }];
    select.replaceChildren(...themes.map(theme => {
        const option = document.createElement('option');
        option.value = theme.id;
        option.textContent = theme.author ? `${theme.name} · ${theme.author}` : theme.name;
        return option;
    }));
    select.value = normalizeAppleThemeId(state.activeThemeId) || 'default';
    updateAppleThemeModeButton();
}

function isAppleThemeId(id = state.activeThemeId) {
    return normalizeAppleThemeId(id) === APPLE_THEME_ID;
}

function updateAppleThemeModeButton() {
    const buttons = [
        document.querySelector('#tavern-notes-lite-apple-mode-main'),
    ].filter(Boolean);
    if (!buttons.length) return;
    const isApple = isAppleThemeId();
    const isDefault = normalizeAppleThemeId(state.activeThemeId) === 'default';
    const isSupported = isApple || isDefault;
    const isNight = isApple ? state.appleGlassMode === 'night' : state.defaultThemeMode === 'night';
    for (const button of buttons) {
        button.classList.toggle('tnl-hidden', !isSupported);
        button.classList.toggle('active', isSupported && isNight);
        const title = t(isApple ? 'appleThemeModeTitle' : 'defaultThemeModeTitle');
        button.title = title;
        button.setAttribute('aria-label', title);
        button.querySelector('i')?.classList.toggle('fa-sun', isNight);
        button.querySelector('i')?.classList.toggle('fa-moon', !isNight);
        const labelKey = isApple ? (isNight ? 'appleThemeDay' : 'appleThemeNight') : (isNight ? 'defaultThemeDay' : 'defaultThemeNight');
        button.querySelector('span')?.replaceChildren(document.createTextNode(t(labelKey)));
    }
}

async function toggleAppleThemeMode() {
    if (normalizeAppleThemeId(state.activeThemeId) === 'default') {
        state.defaultThemeMode = state.defaultThemeMode === 'night' ? 'day' : 'night';
        saveLocalSettings();
        applyTheme(DEFAULT_THEME);
        notify(t(state.defaultThemeMode === 'night' ? 'defaultThemeNightOn' : 'defaultThemeDayOn'), 'success');
        return;
    }
    if (!isAppleThemeId()) {
        await activateTheme(APPLE_THEME_ID);
        return;
    }
    state.appleGlassMode = state.appleGlassMode === 'night' ? 'day' : 'night';
    saveLocalSettings();
    applyTheme(state.theme || DEFAULT_THEME);
    notify(t('appleThemeEnabled'), 'success');
}

function renderDefaultIcon(src, extraClass = '') {
    return `<img class="tavern-notes-lite-default-icon ${extraClass}" src="${htmlEscape(src)}" alt="" aria-hidden="true" draggable="false" />`;
}

function setDefaultIcon(target, src, extraClass = '') {
    const element = typeof target === 'string' ? document.querySelector(target) : target;
    if (!element) return;
    const current = element.querySelector('.tavern-notes-lite-default-icon');
    if (current?.tagName === 'IMG') {
        current.src = src;
        current.className = `tavern-notes-lite-default-icon ${extraClass}`.trim();
        updateDefaultIconContrast(current);
        return;
    }
    current?.remove();
    element.querySelector('i')?.remove();
    element.insertAdjacentHTML('afterbegin', renderDefaultIcon(src, extraClass));
    updateDefaultIconContrast(element.querySelector('.tavern-notes-lite-default-icon'));
}

function parseComputedRgb(value) {
    const numbers = String(value || '').match(/[\d.]+/g)?.map(Number) || [];
    if (numbers.length < 3 || numbers.slice(0, 3).some(number => !Number.isFinite(number))) return null;
    return {
        red: numbers[0],
        green: numbers[1],
        blue: numbers[2],
        alpha: Number.isFinite(numbers[3]) ? numbers[3] : 1,
    };
}

function getEffectiveIconBackground(icon) {
    let element = icon?.parentElement;
    while (element) {
        const color = parseComputedRgb(getComputedStyle(element).backgroundColor);
        if (color && color.alpha > 0.1) return color;
        element = element.parentElement;
    }
    return null;
}

function updateDefaultIconContrast(icon) {
    if (!(icon instanceof HTMLImageElement)) return;
    const background = getEffectiveIconBackground(icon);
    const brightness = background
        ? (background.red * 299 + background.green * 587 + background.blue * 114) / 1000
        : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 0 : 255);
    icon.classList.toggle('tavern-notes-lite-default-icon-light', brightness < 148);
}

function updateThemeIcons(theme = state.theme) {
    setDefaultIcon('.tnl-brand-mark', DEFAULT_OPEN_ICON_URL);
    setDefaultIcon('#tavern-notes-lite-open', DEFAULT_OPEN_ICON_URL, 'qr--button-icon');
    setDefaultIcon('#tavern-notes-lite-capture', DEFAULT_CAPTURE_ICON_URL, 'qr--button-icon');
    setDefaultIcon('#tavern-notes-lite-floating-open', DEFAULT_OPEN_ICON_URL);
    setDefaultIcon('#tavern-notes-lite-floating-capture', DEFAULT_CAPTURE_ICON_URL);
    requestAnimationFrame(() => {
        document.querySelectorAll('.tavern-notes-lite-default-icon').forEach(updateDefaultIconContrast);
    });
}

async function loadTheme() {
    try {
        await refreshThemeList();
    } catch {
        try {
            const data = await api('/theme');
            state.activeThemeId = normalizeAppleThemeId(data.activeId || 'default');
            applyTheme(data.theme || DEFAULT_THEME);
            renderThemeSelect();
        } catch {
            applyTheme(DEFAULT_THEME);
        }
    }
}

async function refreshThemeList() {
    const data = await api('/themes');
    state.themes = data.themes || [];
    state.activeThemeId = normalizeAppleThemeId(data.activeId || 'default');
    renderThemeSelect();
    applyTheme(data.activeTheme || DEFAULT_THEME);
}

async function activateTheme(id) {
    const data = await api(`/themes/${encodeURIComponent(id || 'default')}/activate`, { method: 'POST' });
    state.themes = data.themes || state.themes;
    state.activeThemeId = normalizeAppleThemeId(data.activeId || data.id || id || 'default');
    renderThemeSelect();
    applyTheme(data.theme || DEFAULT_THEME);
    notify(t('switchedTheme'), 'success');
}

async function saveTheme(theme, id = state.activeThemeId) {
    const clean = normalizeTheme(theme);
    const data = await api('/themes', {
        method: 'POST',
        body: JSON.stringify({ theme: clean, id: id === 'default' || isAppleThemeId(id) ? null : id, activate: true }),
    });
    state.themes = data.themes || state.themes;
    state.activeThemeId = normalizeAppleThemeId(data.activeId || data.id || state.activeThemeId || 'default');
    renderThemeSelect();
    applyTheme(data.theme || clean);
    return data;
}

async function importThemeFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const text = await file.text();
    const theme = JSON.parse(text);
    if (theme.format && theme.format !== 'tavern-notes-theme') throw new Error(t('invalidThemeFile'));
    await saveTheme(theme, null);
    notify(t('importedTheme'), 'success');
}

async function deleteSelectedTheme() {
    const id = document.querySelector('#tavern-notes-lite-theme-select')?.value || state.activeThemeId;
    if (!id || id === 'default' || isAppleThemeId(id)) {
        notify(id === 'default' ? t('defaultThemeCannotDelete') : t('builtInThemeCannotDelete'), 'warning');
        return;
    }
    const selected = state.themes.find(theme => theme.id === id);
    if (!window.confirm(t('confirmDeleteTheme', { name: selected?.name || id }))) return;
    const data = await api(`/themes/${encodeURIComponent(id)}`, { method: 'DELETE' });
    state.themes = data.themes || [];
    state.activeThemeId = normalizeAppleThemeId(data.activeId || 'default');
    renderThemeSelect();
    applyTheme(data.theme || state.theme || DEFAULT_THEME);
    notify(t('deletedTheme'), 'success');
}

function updateLauncherModeButton() {
    const button = document.querySelector('#tavern-notes-lite-launcher-mode');
    if (!button) return;
    const label = state.launcherMode === 'floating' ? t('floatingBall') : t('toolbarButtons');
    button.classList.toggle('active', state.launcherMode === 'floating');
    button.title = t('switchLauncherMode');
    button.setAttribute('aria-label', t('switchLauncherMode'));
    const span = button.querySelector('span');
    if (span) span.textContent = label;
}

function removeLauncherButtons() {
    document.querySelector('#tavern-notes-lite-open')?.remove();
    document.querySelector('#tavern-notes-lite-capture')?.remove();
}

function addFloorCaptureButtons(root = document) {
    if (!state.showFloorCaptureButton) {
        removeFloorCaptureButtons();
        return;
    }
    const selector = root === document ? '#chat .mes[mesid], #chat .mes[data-mesid]' : '.mes[mesid], .mes[data-mesid]';
    root.querySelectorAll?.(selector).forEach(messageElement => {
        if (messageElement.querySelector(':scope > .tnl-floor-capture')) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tnl-floor-capture';
        button.title = t('captureFloorTitle');
        button.setAttribute('aria-label', t('captureFloorTitle'));
        button.innerHTML = `<i class="fa-solid fa-file-lines"></i><span>${htmlEscape(t('captureFloor'))}</span>`;
        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            captureMessageFloor(messageElement).catch(error => notify(error.message, 'error'));
        });
        messageElement.append(button);
    });
}

function watchChatMessages() {
    if (!state.showFloorCaptureButton) {
        stopFloorCaptureWatcher();
        return;
    }
    addFloorCaptureButtons();
    if (state.floorCaptureObserver) return;
    const chatContainer = document.querySelector('#chat');
    if (!chatContainer) {
        setTimeout(watchChatMessages, 800);
        return;
    }
    state.floorCaptureObserver = new MutationObserver(() => addFloorCaptureButtons(chatContainer));
    state.floorCaptureObserver.observe(chatContainer, { childList: true, subtree: true });
}

function applyFloatingLauncherPosition(launcher) {
    if (!launcher || !state.floatingPosition) return;
    const x = Math.min(Math.max(8, Number(state.floatingPosition.x || 8)), Math.max(8, window.innerWidth - launcher.offsetWidth - 8));
    const y = Math.min(Math.max(8, Number(state.floatingPosition.y || 8)), Math.max(8, window.innerHeight - launcher.offsetHeight - 8));
    launcher.style.left = `${x}px`; launcher.style.top = `${y}px`; launcher.style.right = 'auto'; launcher.style.bottom = 'auto'; launcher.style.transform = 'none';
}
function bindFloatingLauncherDrag(launcher) {
    if (!launcher || launcher.dataset.dragBound) return; launcher.dataset.dragBound = 'true';
    launcher.addEventListener('pointerdown', event => {
        if (event.button !== undefined && event.button !== 0) return;
        const rect = launcher.getBoundingClientRect(); const sx = event.clientX; const sy = event.clientY; const ox = sx - rect.left; const oy = sy - rect.top;
        state.floatingDragMoved = false;
        const move = e => { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 5) state.floatingDragMoved = true; if (!state.floatingDragMoved) return; const x = Math.min(Math.max(8, e.clientX - ox), window.innerWidth - launcher.offsetWidth - 8); const y = Math.min(Math.max(8, e.clientY - oy), window.innerHeight - launcher.offsetHeight - 8); launcher.style.left = `${x}px`; launcher.style.top = `${y}px`; launcher.style.right = 'auto'; launcher.style.bottom = 'auto'; launcher.style.transform = 'none'; e.preventDefault(); };
        const up = e => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); if (!state.floatingDragMoved) return; const r = launcher.getBoundingClientRect(); state.floatingPosition = { x: r.left + r.width / 2 < window.innerWidth / 2 ? 8 : window.innerWidth - r.width - 8, y: r.top }; applyFloatingLauncherPosition(launcher); saveLocalSettings(); setTimeout(() => { state.floatingDragMoved = false; }, 0); e.preventDefault(); };
        window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', up, { passive: false }); window.addEventListener('pointercancel', up, { passive: false });
    });
}
function updateFloatingLauncher() {
    let launcher = document.querySelector('#tavern-notes-lite-floating-launcher');
    if (state.launcherMode !== 'floating') {
        launcher?.remove();
        return;
    }
    if (!launcher) {
        launcher = document.createElement('div');
        launcher.id = 'tavern-notes-lite-floating-launcher';
        launcher.innerHTML = `
            <button id="tavern-notes-lite-floating-open" class="tnl-floating-button tnl-floating-main" type="button" title="${htmlEscape(t('openNotes'))}" aria-label="${htmlEscape(t('openNotes'))}">
                ${renderDefaultIcon(DEFAULT_OPEN_ICON_URL)}
            </button>
            <button id="tavern-notes-lite-floating-capture" class="tnl-floating-button tnl-floating-capture" type="button" title="${htmlEscape(t('captureSelectedTitle'))}" aria-label="${htmlEscape(t('captureSelectedTitle'))}">
                ${renderDefaultIcon(DEFAULT_CAPTURE_ICON_URL)}
            </button>
        `;
        document.body.append(launcher);
        document.querySelector('#tavern-notes-lite-floating-open')?.addEventListener('click', () => {
            if (state.floatingDragMoved) return;
            if (state.open) closePanel();
            else openPanel();
        });
        document.querySelector('#tavern-notes-lite-floating-capture')?.addEventListener('click', () => { if (!state.floatingDragMoved) captureSelection().catch(error => notify(error.message, 'error')); });
    }
    bindFloatingLauncherDrag(launcher);
    requestAnimationFrame(() => applyFloatingLauncherPosition(launcher));
    launcher.querySelector('#tavern-notes-lite-floating-open')?.setAttribute('title', t('openNotes'));
    launcher.querySelector('#tavern-notes-lite-floating-open')?.setAttribute('aria-label', t('openNotes'));
    launcher.querySelector('#tavern-notes-lite-floating-capture')?.setAttribute('title', t('captureSelectedTitle'));
    launcher.querySelector('#tavern-notes-lite-floating-capture')?.setAttribute('aria-label', t('captureSelectedTitle'));
    updateThemeIcons();
}

function toggleLauncherMode() {
    state.launcherMode = state.launcherMode === 'floating' ? 'toolbar' : 'floating';
    saveLocalSettings();
    addInputToolbar();
    updateFloatingLauncher();
    updateLauncherModeButton();
    notify(state.launcherMode === 'floating' ? t('floatingLauncherShown') : t('toolbarLauncherShown'), 'success');
}

function resetFloatingLauncherPosition() { state.floatingPosition = null; saveLocalSettings(); const launcher = document.querySelector('#tavern-notes-lite-floating-launcher'); if (launcher) { launcher.style.removeProperty('left'); launcher.style.removeProperty('top'); launcher.style.removeProperty('right'); launcher.style.removeProperty('bottom'); launcher.style.removeProperty('transform'); } }

function addInputToolbar() {
    updateLauncherModeButton();
    if (state.launcherMode === 'floating') {
        removeLauncherButtons();
        updateFloatingLauncher();
        return;
    }
    updateFloatingLauncher();
    document.querySelector('#rightSendForm > #tavern-notes-lite-open')?.remove();
    document.querySelector('#rightSendForm > #tavern-notes-lite-capture')?.remove();

    const qrBar = document.querySelector('#qr--bar');
    const target = document.querySelector('#qr--bar > .qr--buttons') || qrBar;
    if (!target) {
        setTimeout(addInputToolbar, 800);
        return;
    }

    const existingOpen = document.querySelector('#tavern-notes-lite-open');
    const existingCapture = document.querySelector('#tavern-notes-lite-capture');
    if (existingOpen && existingCapture) {
        return;
    }

    document.querySelector('#tavern-notes-lite-open')?.remove();
    document.querySelector('#tavern-notes-lite-capture')?.remove();

    const openButton = document.createElement('div');
    openButton.id = 'tavern-notes-lite-open';
    openButton.className = 'qr--button tavern-notes-lite-qr-button interactable';
    openButton.title = t('openNotes');
    openButton.tabIndex = 0;
    openButton.innerHTML = `${renderDefaultIcon(DEFAULT_OPEN_ICON_URL, 'qr--button-icon')}<span class="qr--hidden">${htmlEscape(t('appName'))}</span>`;

    const captureButton = document.createElement('div');
    captureButton.id = 'tavern-notes-lite-capture';
    captureButton.className = 'qr--button tavern-notes-lite-qr-button interactable';
    captureButton.title = t('captureSelectedTitle');
    captureButton.tabIndex = 0;
    captureButton.innerHTML = `${renderDefaultIcon(DEFAULT_CAPTURE_ICON_URL, 'qr--button-icon')}<span class="qr--hidden">${htmlEscape(t('captureSelected'))}</span>`;

    target.append(openButton, captureButton);
    updateThemeIcons();

    openButton.addEventListener('click', openPanel);
    openButton.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') openPanel();
    });
    captureButton.addEventListener('click', () => captureSelection().catch(error => notify(error.message, 'error')));
    captureButton.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') captureSelection().catch(error => notify(error.message, 'error'));
    });
}

function watchQuickReplyBar() {
    if (state.qrBarObserver) return;
    const sendForm = document.querySelector('#send_form');
    if (!sendForm) {
        setTimeout(watchQuickReplyBar, 800);
        return;
    }
    state.qrBarObserver = new MutationObserver(() => addInputToolbar());
    state.qrBarObserver.observe(sendForm, { childList: true, subtree: true });
}

function addExtensionsMenuEntry() {
    const menu = document.querySelector('#extensionsMenu');
    if (!menu || document.querySelector('#tavern-notes-lite-menu-entry')) return;

    menu.insertAdjacentHTML('beforeend', `
        <div id="tavern-notes-lite-menu-entry" class="list-group-item flex-container flexGap5 interactable" title="${htmlEscape(t('openNotes'))}" tabindex="0">
            ${renderDefaultIcon(DEFAULT_OPEN_ICON_URL)}
            <span>${htmlEscape(t('appName'))}</span>
        </div>
    `);
    document.querySelector('#tavern-notes-lite-menu-entry')?.addEventListener('click', openPanel);
}

async function openPanel() {
    const panel = document.querySelector('#tavern-notes-lite-panel');
    if (!panel) return;
    state.open = true;
    panel.classList.remove('tnl-archive-reading');
    panel.classList.add('open');
    updateFloatingLauncher();
    await refreshNotes();
    const list = document.querySelector('#tavern-notes-lite-list');
    if (list) list.scrollTop = 0;
}

function closePanel() {
    const panel = document.querySelector('#tavern-notes-lite-panel');
    if (!panel) return;
    state.open = false;
    panel.classList.remove('open');
    updateFloatingLauncher();
}

function fullExtensionIsActive() {
    return Boolean(document.querySelector(FULL_EXTENSION_SELECTORS));
}

function disableLiteForFull() {
    if (state.disabledByFull) return;
    state.disabledByFull = true;
    removeMobileViewportGuard();
    stopFloorCaptureWatcher();
    state.qrBarObserver?.disconnect();
    state.qrBarObserver = null;
    state.selectionFrameObserver?.disconnect();
    state.selectionFrameObserver = null;
    document.querySelector('#tavern-notes-lite-panel')?.remove();
    document.querySelector('#tavern-notes-lite-floating-launcher')?.remove();
    document.querySelector('#tavern-notes-lite-open')?.remove();
    document.querySelector('#tavern-notes-lite-capture')?.remove();
    document.querySelector('#tavern-notes-lite-menu-entry')?.remove();
    document.querySelector('#tavern-notes-lite-selection-capture')?.remove();
    console.info('[Tavern Notes Lite] Full edition detected. Lite has paused to avoid duplicate capture.');
}

function watchForFullExtension() {
    if (state.fullGuardObserver || state.disabledByFull) return;
    state.fullGuardObserver = new MutationObserver(() => {
        if (!fullExtensionIsActive()) return;
        state.fullGuardObserver?.disconnect();
        state.fullGuardObserver = null;
        disableLiteForFull();
    });
    state.fullGuardObserver.observe(document.body, { childList: true, subtree: true });
}

async function updateLiteStorageStatus(showReminder = false) {
    const info = await getLiteStorageInfo();
    const size = formatBytes(info.approximateBytes);
    setStatus(t('liteStorageStatus', { size, count: info.count }));
    if (!showReminder || !info.count) return;
    const lastExportTime = Date.parse(info.lastExportAt || '');
    const backupOverdue = info.count >= 50 && (!Number.isFinite(lastExportTime)
        || Date.now() - lastExportTime > BACKUP_NOTICE_DAYS * 24 * 60 * 60 * 1000);
    if (info.approximateBytes >= STORAGE_NOTICE_BYTES || backupOverdue) {
        notify(t('liteBackupReminder', { size }), 'info');
    }
}

async function init() {
    if (state.initialized || state.disabledByFull) return;
    if (fullExtensionIsActive()) {
        disableLiteForFull();
        return;
    }
    state.initialized = true;
    installMobileViewportGuard();
    await openLiteDatabase();
    buildPanel();
    applyShareFontImport();
    await loadTheme();
    addInputToolbar();
    watchQuickReplyBar();
    watchChatMessages();
    setTimeout(() => checkForTavernNotesUpdate(), 5000);

    const status = await api('/status');
    state.currentUserName = status.user || state.currentUserName || '';
    saveLocalSettings();
    await updateLiteStorageStatus(true);
    watchForFullExtension();

    eventSource.on(event_types.MESSAGE_SENT, messageId => {
        if (state.disabledByFull) return;
        setTimeout(() => captureUserMessage(messageId), 100);
        setTimeout(addFloorCaptureButtons, 120);
    });
    eventSource.on(event_types.MESSAGE_EDITED, messageId => {
        if (state.disabledByFull) return;
        setTimeout(() => captureUserMessage(messageId), 100);
        setTimeout(addFloorCaptureButtons, 120);
    });
    eventSource.on(event_types.MESSAGE_UPDATED, messageId => {
        if (state.disabledByFull) return;
        setTimeout(() => captureUserMessage(messageId), 100);
        setTimeout(addFloorCaptureButtons, 120);
    });

    watchSelectionFrames();
    document.addEventListener('scroll', hideSelectionCaptureButton, true);
    window.addEventListener('resize', hideSelectionCaptureButton);
}

eventSource.on(event_types.APP_READY, init);
