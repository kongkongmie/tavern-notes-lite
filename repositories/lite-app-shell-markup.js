export function renderLiteAppShellMarkup({ state, translate: t, escapeHtml: htmlEscape, languageOptions, getVisibleFilters, getFloorCaptureTagName, extensionVersion, renderThemeViewMarkup, themeCapabilities, shareCardThemes, shareCardBackgrounds, brandIconMarkup }) {
    return `
        <section id="tavern-notes-lite-panel" aria-label="${htmlEscape(t('appName'))}">
            <header class="tnl-header">
                <div class="tnl-brand-mark">${brandIconMarkup}</div>
                <div class="tnl-heading">
                    <div class="tnl-title">${htmlEscape(t('appName'))} <span>@KKM</span><button id="tavern-notes-lite-update-indicator" class="tnl-update-indicator tnl-hidden" type="button" title="${htmlEscape(t('viewUpdate'))}" aria-label="${htmlEscape(t('viewUpdate'))}"><i></i><span data-update-indicator-version></span></button></div>
                    <div class="tnl-subtitle">${htmlEscape(t('subtitle'))}</div>
                </div>
                <div class="tnl-window-actions">
                    <button id="tavern-notes-lite-launcher-mode" class="tnl-soft-button tnl-window-soft-button" title="${htmlEscape(t('switchLauncherMode'))}" aria-label="${htmlEscape(t('switchLauncherMode'))}">
                        <i class="fa-solid fa-circle-dot"></i><span>${htmlEscape(t(state.launcherMode === 'floating' ? 'floatingBall' : 'toolbarButtons'))}</span>
                    </button>
                    <label class="tnl-language-select" title="${htmlEscape(t('language'))}">
                        <i class="fa-solid fa-language"></i>
                        <select id="tavern-notes-lite-language" aria-label="${htmlEscape(t('language'))}">
                            ${languageOptions.map(option => `<option value="${option.id}" ${option.id === state.language ? 'selected' : ''}>${option.id === 'auto' ? htmlEscape(t('autoLanguage')) : htmlEscape(option.label)}</option>`).join('')}
                        </select>
                    </label>
                    <button id="tavern-notes-lite-theme" class="tnl-icon-button" title="${htmlEscape(t('openThemePanel'))}" aria-label="${htmlEscape(t('openThemePanel'))}"><i class="fa-solid fa-palette"></i></button>
                    <button class="tnl-icon-button tnl-close" title="${htmlEscape(t('closeNotes'))}" aria-label="${htmlEscape(t('closeNotes'))}">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="tnl-header-actions">
                    <button id="tavern-notes-lite-new-note-open" class="tnl-soft-button" title="${htmlEscape(t('newNote'))}" aria-label="${htmlEscape(t('newNote'))}"><i class="fa-solid fa-pen-to-square"></i><span>${htmlEscape(t('newNote'))}</span></button>
                    <button id="tavern-notes-lite-selection-capture-setting" class="tnl-soft-button ${state.showSelectionCaptureButton ? 'active' : ''}" title="${htmlEscape(t('selectionCaptureButtonTitle'))}"><i class="fa-solid fa-highlighter"></i><span>${htmlEscape(t('captureSelected'))}</span></button>
                    <button id="tavern-notes-lite-floor-capture-open" class="tnl-soft-button ${state.showFloorCaptureButton ? 'active' : ''}" title="${htmlEscape(t('floorCaptureEntryTitle'))}"><i class="fa-solid fa-file-lines"></i><span>${htmlEscape(t('captureFloor'))}</span></button>
                    <button id="tavern-notes-lite-more-open" class="tnl-soft-button" title="${htmlEscape(t('more'))}" aria-label="${htmlEscape(t('more'))}"><i class="fa-solid fa-ellipsis"></i><span>${htmlEscape(t('more'))}</span></button>
                    <div id="tavern-notes-lite-more-menu" class="tnl-header-popover tnl-header-secondary"><button id="tavern-notes-lite-auto-user-input" class="tnl-soft-button ${state.autoCaptureUserInput ? 'active' : ''}" title="${htmlEscape(t('autoCaptureUserInputTitle'))}"><i class="fa-solid fa-keyboard"></i><span>${htmlEscape(t('autoCaptureUserInput'))}</span></button><button id="tavern-notes-lite-user-input-cleanup-open" class="tnl-soft-button" title="${htmlEscape(t('userInputCleanupIntro'))}"><i class="fa-solid fa-filter-circle-xmark"></i><span>${htmlEscape(t('userInputCleanup'))}</span></button><button id="tavern-notes-lite-export" class="tnl-soft-button" title="${htmlEscape(t('exportNotes'))}"><i class="fa-solid fa-download"></i><span>${htmlEscape(t('exportNotes'))}</span></button><button id="tavern-notes-lite-update-open" class="tnl-soft-button" title="${htmlEscape(t('updateCenter'))}"><i class="fa-solid fa-clock-rotate-left"></i><span>${htmlEscape(t('updateCenter'))}</span></button><button id="tavern-notes-lite-reset-floating" class="tnl-soft-button" title="${htmlEscape(t('resetFloatingPosition'))}"><i class="fa-solid fa-location-crosshairs"></i><span>${htmlEscape(t('resetFloatingPosition'))}</span></button><button id="tavern-notes-lite-apple-mode-main" class="tnl-soft-button tnl-hidden"><i class="fa-solid fa-moon"></i><span>${htmlEscape(t('appleThemeNight'))}</span></button></div>
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
                    <div class="tnl-modal-actions">
                        <button type="button" data-modal-action="fill" title="${htmlEscape(t('fillInput'))}" aria-label="${htmlEscape(t('fillInput'))}"><i class="fa-solid fa-arrow-turn-down"></i><span>${htmlEscape(t('fillInput'))}</span></button>
                        <button type="button" data-modal-action="copy" title="${htmlEscape(t('copy'))}" aria-label="${htmlEscape(t('copy'))}"><i class="fa-solid fa-copy"></i><span>${htmlEscape(t('copy'))}</span></button>
                        <button type="button" data-modal-action="share" title="${htmlEscape(t('share'))}" aria-label="${htmlEscape(t('share'))}"><i class="fa-solid fa-share-nodes"></i><span>${htmlEscape(t('share'))}</span></button>
                        <button type="button" data-modal-action="edit" title="${htmlEscape(t('edit'))}" aria-label="${htmlEscape(t('edit'))}"><i class="fa-solid fa-pen"></i><span>${htmlEscape(t('edit'))}</span></button>
                        <button type="button" data-modal-action="delete" title="${htmlEscape(t('delete'))}" aria-label="${htmlEscape(t('delete'))}"><i class="fa-solid fa-trash"></i><span>${htmlEscape(t('delete'))}</span></button>
                    </div>
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
                    <section class="tnl-floor-exclude-section">
                        <div><b>${htmlEscape(t('excludeTagsTitle'))}</b><small>${htmlEscape(t('excludeTagsHelp'))}</small></div>
                        <div class="tnl-floor-exclude-add"><input id="tavern-notes-lite-floor-exclude-input" class="text_pole" type="text" placeholder="${htmlEscape(t('excludeTagPlaceholder'))}"><button id="tavern-notes-lite-floor-exclude-add" type="button" title="${htmlEscape(t('addExcludedTag'))}" aria-label="${htmlEscape(t('addExcludedTag'))}"><i class="fa-solid fa-plus"></i><span>${htmlEscape(t('addExcludedTag'))}</span></button></div>
                        <div id="tavern-notes-lite-floor-exclude-tags" class="tnl-floor-exclude-tags"></div>
                    </section>
                    <section class="tnl-floor-content-tag-section">
                        <div><b>${htmlEscape(t('floorCaptureAdvanced'))}</b><small>${htmlEscape(t('floorCaptureSelectorHelp'))}</small></div>
                        <div id="tavern-notes-lite-floor-capture-selector-summary" class="tnl-floor-capture-selector-summary"></div>
                        <div class="tnl-floor-selector-add">
                            <input id="tavern-notes-lite-floor-capture-selector" class="text_pole" type="text" value="${htmlEscape(getFloorCaptureTagName())}" placeholder="${htmlEscape(t('floorCaptureSelectorPlaceholder'))}" />
                            <button id="tavern-notes-lite-floor-capture-selector-save" type="button"><i class="fa-solid fa-floppy-disk"></i><span>${htmlEscape(t('save'))}</span></button>
                        </div>
                    </section>
                </div>
            </div>
            <div id="tavern-notes-lite-update-menu" aria-hidden="true">
                <section class="tnl-update-card">
                    <button class="tnl-icon-button tnl-update-close" type="button" title="${htmlEscape(t('close'))}" aria-label="${htmlEscape(t('close'))}"><i class="fa-solid fa-xmark"></i></button>
                    <div class="tnl-update-heading"><span><i class="fa-solid fa-clock-rotate-left"></i></span><div><div class="tnl-export-title">${htmlEscape(t('updateCenter'))}</div><p>${htmlEscape(t('updateCenterIntro'))}</p></div></div>
                    <div class="tnl-update-summary"><div><small>${htmlEscape(t('installedVersion'))}</small><b data-update-installed>v${htmlEscape(extensionVersion)}</b></div><i class="fa-solid fa-arrow-right"></i><div><small>${htmlEscape(t('latestVersion'))}</small><b data-update-latest>—</b></div><strong data-update-status>${htmlEscape(t('checkUpdates'))}</strong></div>
                    <div class="tnl-update-actions"><button id="tavern-notes-lite-update-check" type="button"><i class="fa-solid fa-rotate"></i><span>${htmlEscape(t('checkUpdates'))}</span></button><button id="tavern-notes-lite-update-manager" type="button"><i class="fa-solid fa-cubes"></i><span>${htmlEscape(t('openExtensionManager'))}</span></button><button id="tavern-notes-lite-update-repository" type="button"><i class="fa-brands fa-github"></i><span>${htmlEscape(t('openRepository'))}</span></button></div>
                    <small class="tnl-update-instructions">${htmlEscape(t('updateInstructions'))}</small>
                    <div class="tnl-update-log-heading"><i class="fa-regular fa-clipboard"></i><b>${htmlEscape(t('changelogTitle'))}</b></div>
                    <div id="tavern-notes-lite-update-log" class="tnl-update-log"><div class="tnl-update-empty">${htmlEscape(t('noChangelog'))}</div></div>
                </section>
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
            ${renderThemeViewMarkup({
                idPrefix: 'tavern-notes-lite',
                classPrefix: 'tnl',
                translate: t,
                escapeHtml: htmlEscape,
                capabilities: themeCapabilities,
            })}
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
                            ${shareCardThemes.map(theme => `<button class="tnl-share-choice" data-share-theme="${theme.id}" type="button">${htmlEscape(t(theme.labelKey))}</button>`).join('')}
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
                            ${shareCardBackgrounds.map(color => `<button class="tnl-share-bg" data-share-bg="${color}" type="button" style="--share-bg:${color}"></button>`).join('')}
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
    `;
}
