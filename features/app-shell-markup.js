import { uiClass } from '../core/ui-class-names.js';

export function renderAppShellMarkup({
    state,
    translate: t,
    escapeHtml: htmlEscape,
    languageOptions,
    getVisibleFilters,
    getFloorCaptureTagName,
    extensionVersion,
    renderThemeViewMarkup,
    renderThemeStudioMarkup,
    themeCapabilities,
    shareCardThemes,
    shareCardBackgrounds,
    idPrefix,
    classPrefix,
    brandIconMarkup,
    capabilities = {},
    cleanupScanLabelKey = 'scanDuplicates',
}) {
    const ui = name => uiClass(name, { classPrefix });
    const storageModeBadge = capabilities.storageMode
        ? `<button id="${idPrefix}-storage-mode" class="${classPrefix}-storage-mode-badge" type="button" title="${htmlEscape(t('chooseStorageMode'))}">${htmlEscape(t(state.storageMode === 'lite' ? 'storageModeLite' : 'storageModeFull'))}</button>`
        : '';
    const storageModeAction = capabilities.storageMode
        ? `<button id="${idPrefix}-storage-mode-open" class="${ui('soft-button')}" title="${htmlEscape(t('chooseStorageMode'))}"><i class="fa-solid fa-database"></i><span>${htmlEscape(t('chooseStorageMode'))}</span></button>`
        : '';
    const subtitleMarkup = storageModeBadge
        ? `<div class="${ui('subtitle')}">${storageModeBadge}</div>`
        : '';
    const compatibilityInfo = capabilities.compatibilityInfo
        ? `<aside class="${classPrefix}-lite-full-info">
                        <strong><i class="fa-solid fa-circle-info"></i>${htmlEscape(t('liteFullInfoTitle'))}</strong>
                        <p>${htmlEscape(t('liteFullJsonCompatibility'))}</p>
                        <p>${htmlEscape(t('liteLimitations'))}</p>
                        <p>${htmlEscape(t('fullAdvantages'))}</p>
                    </aside>`
        : '';
    return `
        <section id="${idPrefix}-panel" aria-label="${htmlEscape(t('appName'))}">
            <header class="${ui('header')}">
                <div class="${ui('brand-mark')}">${brandIconMarkup}</div>
                <div class="${ui('heading')}">
                    <div class="${ui('title')}">${htmlEscape(t('appName'))} <span>@KKM</span><button id="${idPrefix}-update-indicator" class="${ui('update-indicator')} ${ui('hidden')}" type="button" title="${htmlEscape(t('viewUpdate'))}" aria-label="${htmlEscape(t('viewUpdate'))}"><i></i><span data-update-indicator-version></span></button></div>
                    ${subtitleMarkup}
                </div>
                <div class="${ui('window-actions')}">
                    <button id="${idPrefix}-launcher-mode" class="${ui('soft-button')} ${ui('window-soft-button')}" title="${htmlEscape(t('switchLauncherMode'))}" aria-label="${htmlEscape(t('switchLauncherMode'))}">
                        <i class="fa-solid fa-circle-dot"></i><span>${htmlEscape(t(state.launcherMode === 'floating' ? 'floatingBall' : 'toolbarButtons'))}</span>
                    </button>
                    <label class="${ui('language-select')}" title="${htmlEscape(t('language'))}">
                        <i class="fa-solid fa-language"></i>
                        <select id="${idPrefix}-language" aria-label="${htmlEscape(t('language'))}">
                            ${languageOptions.map(option => `<option value="${option.id}" ${option.id === state.language ? 'selected' : ''}>${option.id === 'auto' ? htmlEscape(t('autoLanguage')) : htmlEscape(option.label)}</option>`).join('')}
                        </select>
                    </label>
                    <button id="${idPrefix}-theme" class="${ui('icon-button')}" title="${htmlEscape(t('openThemePanel'))}" aria-label="${htmlEscape(t('openThemePanel'))}"><i class="fa-solid fa-palette"></i></button>
                    <button class="${ui('icon-button')} ${ui('close')}" title="${htmlEscape(t('closeNotes'))}" aria-label="${htmlEscape(t('closeNotes'))}">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <button class="${ui('reading-mode-expand')}" type="button" title="${htmlEscape(t('expandToolbar'))}" aria-label="${htmlEscape(t('expandToolbar'))}">
                    <i class="fa-solid fa-chevron-down"></i><span>${htmlEscape(t('expandToolbar'))}</span>
                </button>
                <div class="${ui('header-actions')}">
                    <button id="${idPrefix}-new-note-open" class="${ui('soft-button')}" title="${htmlEscape(t('newNote'))}" aria-label="${htmlEscape(t('newNote'))}"><i class="fa-solid fa-pen-to-square"></i><span>${htmlEscape(t('newNote'))}</span></button>
                    <button id="${idPrefix}-selection-capture-setting" class="${ui('soft-button')} ${state.showSelectionCaptureButton ? 'active' : ''}" title="${htmlEscape(t('selectionCaptureButtonTitle'))}"><i class="fa-solid fa-highlighter"></i><span>${htmlEscape(t('captureSelected'))}</span></button>
                    <button id="${idPrefix}-floor-capture-open" class="${ui('soft-button')} ${state.showFloorCaptureButton ? 'active' : ''}" title="${htmlEscape(t('floorCaptureEntryTitle'))}"><i class="fa-solid fa-file-lines"></i><span>${htmlEscape(t('captureFloor'))}</span></button>
                    <button id="${idPrefix}-more-open" class="${ui('soft-button')}" title="${htmlEscape(t('more'))}" aria-label="${htmlEscape(t('more'))}"><i class="fa-solid fa-ellipsis"></i><span>${htmlEscape(t('more'))}</span></button>
                    <div id="${idPrefix}-more-menu" class="${ui('header-popover')} ${ui('header-secondary')}"><button id="${idPrefix}-auto-user-input" class="${ui('soft-button')} ${state.autoCaptureUserInput ? 'active' : ''}" title="${htmlEscape(t('autoCaptureUserInputTitle'))}"><i class="fa-solid fa-keyboard"></i><span>${htmlEscape(t('autoCaptureUserInput'))}</span></button><button id="${idPrefix}-user-input-cleanup-open" class="${ui('soft-button')}" title="${htmlEscape(t('userInputCleanupIntro'))}"><i class="fa-solid fa-filter-circle-xmark"></i><span>${htmlEscape(t('userInputCleanup'))}</span></button><button id="${idPrefix}-export" class="${ui('soft-button')}" title="${htmlEscape(t('exportNotes'))}"><i class="fa-solid fa-download"></i><span>${htmlEscape(t('exportNotes'))}</span></button>${storageModeAction}<button id="${idPrefix}-update-open" class="${ui('soft-button')}" title="${htmlEscape(t('updateCenter'))}"><i class="fa-solid fa-clock-rotate-left"></i><span>${htmlEscape(t('updateCenter'))}</span></button><button id="${idPrefix}-reset-floating" class="${ui('soft-button')}" title="${htmlEscape(t('resetFloatingPosition'))}"><i class="fa-solid fa-location-crosshairs"></i><span>${htmlEscape(t('resetFloatingPosition'))}</span></button><button id="${idPrefix}-apple-mode-main" class="${ui('soft-button')} ${ui('hidden')}"><i class="fa-solid fa-moon"></i><span>${htmlEscape(t('appleThemeNight'))}</span></button></div>
                </div>
            </header>
            <div id="${idPrefix}-notice" class="${ui('notice')}" role="status" aria-live="polite"></div>
            <div class="${ui('search-row')}">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input id="${idPrefix}-search" class="text_pole" type="search" placeholder="${htmlEscape(t('searchPlaceholder'))}" />
            </div>
            <div id="${idPrefix}-tag-shelf" class="${ui('tag-shelf')} ${ui('hidden')}" aria-label="${htmlEscape(t('tags'))}"></div>
            <div class="${ui('shell')}">
                <nav class="${ui('filters')}">
                    ${getVisibleFilters().map(filter => `
                        <button class="${ui('filter')} ${filter.id === 'all' ? 'active' : ''}" data-filter="${filter.id}">
                            <span class="${ui('filter-icon')}"><i class="fa-solid ${filter.icon}"></i></span>
                            <span class="${ui('filter-text')}">
                                <b>${htmlEscape(t(filter.label))}</b>
                                <small>${htmlEscape(t(filter.hint))}</small>
                            </span>
                            <span class="${ui('filter-count')}"></span>
                        </button>
                    `).join('')}
                </nav>
                <main id="${idPrefix}-list" class="${ui('list')}"></main>
            </div>
            <footer class="${ui('footer')}">
                <span class="${idPrefix}-status">${htmlEscape(t('connecting'))}</span>
                <div class="${ui('pagination')}">
                    <button id="${idPrefix}-prev" class="${ui('page-button')}" title="${htmlEscape(t('prevPage'))}"><i class="fa-solid fa-chevron-left"></i></button>
                    <span id="${idPrefix}-page-label">1 / 1</span>
                    <button id="${idPrefix}-next" class="${ui('page-button')}" title="${htmlEscape(t('nextPage'))}"><i class="fa-solid fa-chevron-right"></i></button>
                    <input id="${idPrefix}-page-input" type="number" min="1" value="1" />
                    <button id="${idPrefix}-page-jump" class="${ui('page-button')}">${htmlEscape(t('jumpPage'))}</button>
                </div>
            </footer>
            <div id="${idPrefix}-new-note-menu" aria-hidden="true"><form class="${ui('edit-card')} ${ui('new-note-card')}"><button class="${ui('icon-button')} ${ui('new-note-close')}" type="button"><i class="fa-solid fa-xmark"></i></button><div class="${ui('export-title')}">${htmlEscape(t('newNote'))}</div><p class="${classPrefix}-floor-capture-intro">${htmlEscape(t('newNoteUserHelp'))}</p><label class="${classPrefix}-edit-field"><span>${htmlEscape(t('noteContent'))}</span><textarea id="${idPrefix}-new-note-content" class="text_pole" maxlength="200000" required></textarea></label><label class="${classPrefix}-edit-field"><span>${htmlEscape(t('tags'))}</span><input id="${idPrefix}-new-note-tags" class="text_pole" value="${htmlEscape(t('inspirationTag'))}"></label><button class="menu_button ${ui('new-note-save')}" type="submit"><i class="fa-solid fa-floppy-disk"></i><span>${htmlEscape(t('saveNote'))}</span></button></form></div>
            <div id="${idPrefix}-modal" aria-hidden="true">
                <div class="${ui('modal-card')}">
                    <button class="${ui('icon-button')} ${ui('modal-close')}" title="${htmlEscape(t('close'))}" aria-label="${htmlEscape(t('close'))}"><i class="fa-solid fa-xmark"></i></button>
                    <div class="${ui('modal-kicker')}"></div>
                    <div class="${ui('modal-title')}"></div>
                    <div class="${ui('modal-content')}"></div>
                    <div class="${ui('modal-actions')}">
                        <button type="button" data-modal-action="fill" title="${htmlEscape(t('fillInput'))}" aria-label="${htmlEscape(t('fillInput'))}"><i class="fa-solid fa-arrow-turn-down"></i><span>${htmlEscape(t('fillInput'))}</span></button>
                        <button type="button" data-modal-action="copy" title="${htmlEscape(t('copy'))}" aria-label="${htmlEscape(t('copy'))}"><i class="fa-solid fa-copy"></i><span>${htmlEscape(t('copy'))}</span></button>
                        <button type="button" data-modal-action="share" title="${htmlEscape(t('share'))}" aria-label="${htmlEscape(t('share'))}"><i class="fa-solid fa-share-nodes"></i><span>${htmlEscape(t('share'))}</span></button>
                        <button type="button" data-modal-action="edit" title="${htmlEscape(t('edit'))}" aria-label="${htmlEscape(t('edit'))}"><i class="fa-solid fa-pen"></i><span>${htmlEscape(t('edit'))}</span></button>
                        <button type="button" data-modal-action="delete" title="${htmlEscape(t('delete'))}" aria-label="${htmlEscape(t('delete'))}"><i class="fa-solid fa-trash"></i><span>${htmlEscape(t('delete'))}</span></button>
                    </div>
                </div>
            </div>
            <div id="${idPrefix}-edit-menu" aria-hidden="true">
                <form class="${ui('edit-card')}">
                    <button class="${ui('icon-button')} ${ui('edit-close')}" type="button" title="${htmlEscape(t('close'))}" aria-label="${htmlEscape(t('close'))}"><i class="fa-solid fa-xmark"></i></button>
                    <div class="${ui('export-title')}">${htmlEscape(t('editNote'))}</div>
                    <label class="${classPrefix}-edit-field">
                        <span>${htmlEscape(t('noteContent'))}</span>
                        <textarea id="${idPrefix}-edit-content" class="text_pole" maxlength="200000" required></textarea>
                    </label>
                    <div class="${classPrefix}-edit-field">
                        <span>${htmlEscape(t('tags'))}</span>
                        <div class="${classPrefix}-tag-editor">
                            <div id="${idPrefix}-edit-tag-chips" class="${classPrefix}-edit-tag-chips"></div>
                            <input id="${idPrefix}-edit-tags" type="text" maxlength="820" placeholder="${htmlEscape(t('tagsPlaceholder'))}" autocomplete="off" />
                        </div>
                        <small>${htmlEscape(t('tagsHelp'))}</small>
                    </div>
                    <div class="${classPrefix}-tag-suggestions-wrap">
                        <small>${htmlEscape(t('tagSuggestions'))}</small>
                        <div id="${idPrefix}-tag-suggestions" class="${classPrefix}-tag-suggestions"></div>
                    </div>
                    <button class="menu_button ${ui('edit-save')}" type="submit"><i class="fa-solid fa-floppy-disk"></i><span>${htmlEscape(t('saveChanges'))}</span></button>
                </form>
            </div>
            <div id="${idPrefix}-tag-library" aria-hidden="true">
                <section class="${ui('tag-library-card')}">
                    <button class="${ui('icon-button')} ${ui('tag-library-close')}" type="button" title="${htmlEscape(t('close'))}" aria-label="${htmlEscape(t('close'))}"><i class="fa-solid fa-xmark"></i></button>
                    <div class="${ui('tag-library-heading')}">
                        <span class="${classPrefix}-tag-library-mark"><i class="fa-solid fa-tags"></i></span>
                        <div><div class="${ui('export-title')}">${htmlEscape(t('tagLibrary'))}</div><p class="${classPrefix}-tag-library-intro">${htmlEscape(t('tagLibraryIntro'))}</p></div>
                    </div>
                    <label class="${classPrefix}-tag-library-search">
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <input id="${idPrefix}-tag-search" class="text_pole" type="search" placeholder="${htmlEscape(t('searchTags'))}" />
                    </label>
                    <div class="${classPrefix}-tag-sort" role="group">
                        <button class="${classPrefix}-tag-sort-button active" type="button" data-tag-sort="count"><i class="fa-solid fa-arrow-down-wide-short"></i><span>${htmlEscape(t('sortByCount'))}</span></button>
                        <button class="${classPrefix}-tag-sort-button" type="button" data-tag-sort="name"><i class="fa-solid fa-arrow-down-a-z"></i><span>${htmlEscape(t('sortByName'))}</span></button>
                    </div>
                    <div id="${idPrefix}-tag-library-list" class="${classPrefix}-tag-library-list"></div>
                </section>
            </div>
            <div id="${idPrefix}-export-menu" aria-hidden="true">
                <div class="${ui('export-card')}">
                    <div class="${ui('export-title')}">${htmlEscape(t('exportNotes'))}</div>
                    <div class="${classPrefix}-export-scope">
                        <div class="${classPrefix}-export-scope-label">${htmlEscape(t('exportScope'))}</div>
                        <div class="${classPrefix}-export-scope-options" role="group" aria-label="${htmlEscape(t('exportScope'))}">
                            <button class="${ui('export-scope-choice')} active" data-scope="all" type="button">${htmlEscape(t('allNotes'))}</button>
                            <button class="${ui('export-scope-choice')}" data-scope="page" type="button">${htmlEscape(t('currentPage'))}</button>
                        </div>
                        <small class="${classPrefix}-export-hint">${htmlEscape(t('exportHint'))}</small>
                    </div>
                    <button class="${ui('export-choice')}" data-format="json" title="JSON"><i class="fa-solid fa-file-code"></i><span>${htmlEscape(t('exportJson'))}</span></button>
                    <button class="${ui('export-choice')}" data-format="txt" title="TXT"><i class="fa-solid fa-file-lines"></i><span>${htmlEscape(t('exportTxt'))}</span></button>
                    <button id="${idPrefix}-import-json" class="${ui('export-choice')}" type="button"><i class="fa-solid fa-file-import"></i><span>${htmlEscape(t('importJson'))}</span></button>
                    <input id="${idPrefix}-import-json-file" type="file" accept=".json,application/json" hidden />
                    ${compatibilityInfo}
                </div>
            </div>
            <div id="${idPrefix}-floor-capture-menu" aria-hidden="true">
                <div class="${ui('floor-capture-card')}">
                    <button class="${ui('icon-button')} ${ui('floor-capture-close')}" title="${htmlEscape(t('close'))}" aria-label="${htmlEscape(t('close'))}"><i class="fa-solid fa-xmark"></i></button>
                    <div class="${ui('export-title')}">${htmlEscape(t('floorCaptureSettingsTitle'))}</div>
                    <p class="${classPrefix}-floor-capture-intro">${htmlEscape(t('floorCaptureSettingsIntro'))}</p>
                    <button id="${idPrefix}-floor-capture-setting" class="${ui('soft-button')} ${classPrefix}-floor-capture-toggle ${state.showFloorCaptureButton ? 'active' : ''}" title="${htmlEscape(t('floorCaptureButtonTitle'))}" aria-label="${htmlEscape(t('floorCaptureButtonTitle'))}">
                        <i class="fa-solid fa-file-lines"></i><span>${htmlEscape(t('floorCaptureButton'))}</span>
                    </button>
                    <div class="${classPrefix}-floor-capture-help">
                        <b>${htmlEscape(t('floorCaptureStepsTitle'))}</b>
                        <small>${htmlEscape(t('floorCaptureSteps'))}</small>
                    </div>
                    <div class="${classPrefix}-floor-capture-help">
                        <b>${htmlEscape(t('floorCaptureContentTitle'))}</b>
                        <small>${htmlEscape(t('floorCaptureContentHelp'))}</small>
                        <code>${htmlEscape(t('floorCaptureExample'))}</code>
                    </div>
                    <div class="${classPrefix}-floor-capture-help">
                        <b>${htmlEscape(t('floorCaptureTroubleTitle'))}</b>
                        <small>${htmlEscape(t('floorCaptureTroubleHelp'))}</small>
                    </div>
                    <section class="${classPrefix}-floor-exclude-section">
                        <div><b>${htmlEscape(t('excludeTagsTitle'))}</b><small>${htmlEscape(t('excludeTagsHelp'))}</small></div>
                        <div class="${classPrefix}-floor-exclude-add"><input id="${idPrefix}-floor-exclude-input" class="text_pole" type="text" placeholder="${htmlEscape(t('excludeTagPlaceholder'))}"><button id="${idPrefix}-floor-exclude-add" type="button" title="${htmlEscape(t('addExcludedTag'))}" aria-label="${htmlEscape(t('addExcludedTag'))}"><i class="fa-solid fa-plus"></i><span>${htmlEscape(t('addExcludedTag'))}</span></button></div>
                        <div id="${idPrefix}-floor-exclude-tags" class="${classPrefix}-floor-exclude-tags"></div>
                    </section>
                    <section class="${classPrefix}-floor-content-tag-section">
                        <div><b>${htmlEscape(t('floorCaptureAdvanced'))}</b><small>${htmlEscape(t('floorCaptureSelectorHelp'))}</small></div>
                        <div id="${idPrefix}-floor-capture-selector-summary" class="${classPrefix}-floor-capture-selector-summary"></div>
                        <div class="${classPrefix}-floor-selector-add">
                            <input id="${idPrefix}-floor-capture-selector" class="text_pole" type="text" value="${htmlEscape(getFloorCaptureTagName())}" placeholder="${htmlEscape(t('floorCaptureSelectorPlaceholder'))}" />
                            <button id="${idPrefix}-floor-capture-selector-save" type="button"><i class="fa-solid fa-floppy-disk"></i><span>${htmlEscape(t('save'))}</span></button>
                        </div>
                    </section>
                </div>
            </div>
            <div id="${idPrefix}-update-menu" aria-hidden="true">
                <section class="${ui('update-card')}">
                    <button class="${ui('icon-button')} ${ui('update-close')}" type="button" title="${htmlEscape(t('close'))}" aria-label="${htmlEscape(t('close'))}"><i class="fa-solid fa-xmark"></i></button>
                    <div class="${ui('update-heading')}"><span><i class="fa-solid fa-clock-rotate-left"></i></span><div><div class="${ui('export-title')}">${htmlEscape(t('updateCenter'))}</div><p>${htmlEscape(t('updateCenterIntro'))}</p></div></div>
                    <div class="${classPrefix}-update-summary"><div><small>${htmlEscape(t('installedVersion'))}</small><b data-update-installed>v${htmlEscape(extensionVersion)}</b></div><i class="fa-solid fa-arrow-right"></i><div><small>${htmlEscape(t('latestVersion'))}</small><b data-update-latest>—</b></div><strong data-update-status>${htmlEscape(t('checkUpdates'))}</strong></div>
                    <div class="${classPrefix}-update-actions"><button id="${idPrefix}-update-check" type="button"><i class="fa-solid fa-rotate"></i><span>${htmlEscape(t('checkUpdates'))}</span></button><button id="${idPrefix}-update-manager" type="button"><i class="fa-solid fa-cubes"></i><span>${htmlEscape(t('openExtensionManager'))}</span></button><button id="${idPrefix}-update-repository" type="button"><i class="fa-brands fa-github"></i><span>${htmlEscape(t('openRepository'))}</span></button></div>
                    <small class="${classPrefix}-update-instructions">${htmlEscape(t('updateInstructions'))}</small>
                    <div class="${classPrefix}-update-log-heading"><i class="fa-regular fa-clipboard"></i><b>${htmlEscape(t('changelogTitle'))}</b></div>
                    <div id="${idPrefix}-update-log" class="${classPrefix}-update-log"><div class="${classPrefix}-update-empty">${htmlEscape(t('noChangelog'))}</div></div>
                </section>
            </div>
            <div id="${idPrefix}-user-input-cleanup-menu" aria-hidden="true">
                <div class="${ui('user-input-cleanup-card')}">
                    <button class="${ui('icon-button')} ${ui('user-input-cleanup-close')}" title="${htmlEscape(t('close'))}" aria-label="${htmlEscape(t('close'))}"><i class="fa-solid fa-xmark"></i></button>
                    <div class="${ui('export-title')}">${htmlEscape(t('userInputCleanupTitle'))}</div>
                    <p class="${classPrefix}-floor-capture-intro">${htmlEscape(t('userInputCleanupIntro'))}</p>
                    <label class="${classPrefix}-input-cleanup-toggle"><input id="${idPrefix}-collapse-repeated-input" type="checkbox" ${state.collapseRepeatedUserInput ? 'checked' : ''}><span><b>${htmlEscape(t('collapseRepeatedInput'))}</b><small>${htmlEscape(t('collapseRepeatedHelp'))}</small></span></label>
                    <div class="${classPrefix}-input-rule-search"><i class="fa-solid fa-magnifying-glass"></i><input id="${idPrefix}-input-rule-search" type="search" placeholder="${htmlEscape(t('filterInputRules'))}"></div>
                    <div class="${classPrefix}-input-rule-columns">
                        ${['exact', 'prefix'].map(kind => `<section class="${classPrefix}-input-rule-section"><div class="${classPrefix}-input-rule-heading"><b>${htmlEscape(t(kind === 'exact' ? 'ignoreExactLabel' : 'ignorePrefixLabel'))}</b><span data-rule-count="${kind}">0</span></div><div class="${classPrefix}-input-rule-add"><textarea data-rule-input="${kind}" rows="2" placeholder="${htmlEscape(t(kind === 'exact' ? 'ignoreExactPlaceholder' : 'ignorePrefixPlaceholder'))}"></textarea><button type="button" data-rule-add="${kind}" title="${htmlEscape(t('addInputRules'))}"><i class="fa-solid fa-plus"></i></button></div><div class="${classPrefix}-input-rule-list" data-rule-list="${kind}"></div></section>`).join('')}
                    </div>
                    <section id="${idPrefix}-input-dedupe-preview" class="${classPrefix}-dedupe-preview ${ui('hidden')}"><div class="${ui('dedupe-preview-summary')}"></div><div class="${ui('dedupe-preview-list')}"></div><div class="${classPrefix}-dedupe-preview-actions"><button id="${idPrefix}-input-dedupe-cancel" type="button">${htmlEscape(t('cancelCleanup'))}</button><button id="${idPrefix}-input-dedupe-confirm" type="button"><i class="fa-solid fa-broom"></i><span>${htmlEscape(t('confirmCleanup'))}</span></button></div></section>
                    <div class="${classPrefix}-input-cleanup-actions"><button id="${idPrefix}-input-rules-save" class="${ui('soft-button')}"><i class="fa-solid fa-floppy-disk"></i><span>${htmlEscape(t('saveInputRules'))}</span></button><button id="${idPrefix}-input-dedupe-scan" class="${classPrefix}-history-cleanup-button"><i class="fa-solid fa-broom"></i><span>${htmlEscape(t(cleanupScanLabelKey))}</span></button></div>
                </div>
            </div>
            ${renderThemeViewMarkup({
                idPrefix,
                classPrefix,
                translate: t,
                escapeHtml: htmlEscape,
                capabilities: themeCapabilities,
                studioMarkup: renderThemeStudioMarkup({
                    translate: t,
                    escapeHtml: htmlEscape,
                    idPrefix,
                    classPrefix,
                }),
            })}
            <div id="${idPrefix}-share-menu" aria-hidden="true">
                <div class="${ui('share-card')}">
                    <button class="${ui('icon-button')} ${ui('share-close')}" title="${htmlEscape(t('close'))}" aria-label="${htmlEscape(t('close'))}"><i class="fa-solid fa-xmark"></i></button>
                    <div class="${classPrefix}-share-preview-wrap">
                        <canvas id="${idPrefix}-share-canvas" width="900" height="1400"></canvas>
                    </div>
                    <div class="${classPrefix}-share-controls">
                        <div class="${ui('export-title')}">${htmlEscape(t('shareCard'))}</div>
                        <label class="${classPrefix}-share-label">${htmlEscape(t('theme'))}</label>
                        <div class="${classPrefix}-share-theme-row">
                            ${shareCardThemes.map(theme => `<button class="${ui('share-choice')}" data-share-theme="${theme.id}" type="button">${htmlEscape(t(theme.labelKey))}</button>`).join('')}
                        </div>
                        <label class="${classPrefix}-share-label">${htmlEscape(t('font'))}</label>
                        <input id="${idPrefix}-share-font" class="${classPrefix}-theme-input" type="text" placeholder='例如 STDongGuanTi, 思源宋体, serif' />
                        <label class="${classPrefix}-share-label">${htmlEscape(t('savedFonts'))}</label>
                        <select id="${idPrefix}-share-saved-fonts" class="${classPrefix}-theme-input"></select>
                        <label class="${classPrefix}-share-label">${htmlEscape(t('fontSize'))} <span id="${idPrefix}-share-font-size-value">80%</span></label>
                        <input id="${idPrefix}-share-font-size" type="range" min="65" max="110" step="5" value="80" />
                        <label class="${classPrefix}-share-label">${htmlEscape(t('fontImport'))}</label>
                        <textarea id="${idPrefix}-share-font-import" class="${classPrefix}-share-font-import" spellcheck="false" placeholder='https://fontsapi.zeoseven.com/488/main/result.css'></textarea>
                        <div class="${classPrefix}-share-help">
                            ${htmlEscape(t('fontHelp'))}
                            <a href="https://fonts.zeoseven.com/" target="_blank" rel="noopener noreferrer">${htmlEscape(t('findFonts'))}</a>
                        </div>
                        <button id="${idPrefix}-share-import-font" class="${ui('export-choice')} ${classPrefix}-share-wide-action" type="button"><i class="fa-solid fa-font"></i><span>${htmlEscape(t('importFont'))}</span></button>
                        <label class="${classPrefix}-share-label">${htmlEscape(t('importLocalFont'))}</label>
                        <button id="${idPrefix}-share-import-local-font" class="${ui('export-choice')} ${classPrefix}-share-wide-action" type="button"><i class="fa-solid fa-file-import"></i><span>${htmlEscape(t('importLocalFont'))}</span></button>
                        <label class="${classPrefix}-share-label">${htmlEscape(t('background'))}</label>
                        <div class="${classPrefix}-share-bg-row">
                            ${shareCardBackgrounds.map(color => `<button class="${ui('share-bg')}" data-share-bg="${color}" type="button" style="--share-bg:${color}"></button>`).join('')}
                        </div>
                        <div class="${classPrefix}-share-custom-color-row">
                            <label><span>${htmlEscape(t('customBackground'))}</span><input id="${idPrefix}-share-custom-background" type="color" value="#eef7f2" /></label>
                            <label><span>${htmlEscape(t('customTextColor'))}</span><input id="${idPrefix}-share-custom-text-color" type="color" value="#103f25" /></label>
                        </div>
                        <label class="${classPrefix}-share-label">${htmlEscape(t('display'))}</label>
                        <div class="${classPrefix}-share-toggle-row">
                            <label><input id="${idPrefix}-share-show-character" type="checkbox" />${htmlEscape(t('characterName'))}</label>
                            <label><input id="${idPrefix}-share-show-date" type="checkbox" />${htmlEscape(t('date'))}</label>
                        </div>
                        <div class="${classPrefix}-share-actions">
                            <button id="${idPrefix}-share-redraw" class="${ui('export-choice')}" type="button"><i class="fa-solid fa-wand-magic-sparkles"></i><span>${htmlEscape(t('redrawPreview'))}</span></button>
                            <button id="${idPrefix}-share-download" class="${ui('export-choice')}" type="button"><i class="fa-solid fa-download"></i><span>${htmlEscape(t('exportPng'))}</span></button>
                        </div>
                        <input id="${idPrefix}-share-local-font-file" type="file" accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" hidden />
                    </div>
                    <style id="${idPrefix}-share-font-style"></style>
                </div>
            </div>
        </section>
    `;
}
