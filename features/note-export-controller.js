function stamp(now) {
    return now().toISOString().replace(/[:.]/g, '-');
}

export function prepareNoteForExport(note, { getVariants, getVariantIndex, getActiveVariant }) {
    const active = getActiveVariant(note);
    const variants = getVariants(note);
    return {
        ...note,
        ...active,
        id: active.id || note.id,
        type: active.type || note.type,
        character: active.character || note.character,
        chat: active.chat || note.chat,
        tags: active.tags || note.tags || [],
        variant: variants.length > 1 ? {
            groupId: note.id,
            activeIndex: getVariantIndex(note),
            count: variants.length,
        } : undefined,
    };
}

export function buildPlainTextExport(notes) {
    const groups = new Map();
    for (const note of notes || []) {
        const name = note.character?.name || '未命名角色';
        const key = [note.character?.id ?? '', note.character?.avatar ?? '', name].map(value => String(value).replaceAll('|', '\\|')).join('|');
        if (!groups.has(key)) groups.set(key, { name, notes: [] });
        groups.get(key).notes.push(note);
    }
    if (!groups.size) return '暂无笔记\n\n——来自酒馆笔记\n';
    const body = [...groups.values()].map(group => {
        const user = group.notes.filter(note => note.type === 'user_input').length;
        const excerpt = group.notes.filter(note => note.type === 'excerpt').length;
        const count = user === group.notes.length
            ? `共 ${group.notes.length} 条User 输入`
            : excerpt === group.notes.length
                ? `共 ${group.notes.length} 条摘抄`
                : `共 ${group.notes.length} 条笔记（User 输入 ${user} · 摘抄 ${excerpt}）`;
        return [`《${group.name}》`, count, '', group.notes.map(note => String(note.content || '').trim()).filter(Boolean).join('\n\n')].join('\n');
    }).join('\n\n');
    return `${body}\n\n——来自酒馆笔记\n`;
}

export function createNoteExportController({
    repository,
    listController,
    getQueryState,
    getListState,
    getNoteUiState,
    patchNoteUiState,
    replaceQueryState,
    refresh = () => listController.reloadCurrentPage(),
    prepareVisibleNote = note => note,
    download,
    getExportOptions = () => ({}),
    currentPageEdition = '',
    getCurrentPageMeta = () => ({}),
    now = () => new Date(),
}) {
    let mounted = false;

    async function run(flag, operation) {
        if (!mounted) return { ok: false, stale: true };
        patchNoteUiState({ [flag]: true });
        try {
            const value = await operation();
            return { ok: true, value };
        } catch (error) {
            return { ok: false, error };
        } finally {
            if (mounted) patchNoteUiState({ [flag]: false });
        }
    }

    function currentPageData() {
        const query = getQueryState();
        const list = getListState();
        return {
            ok: true,
            format: 'tavern-notes-export',
            version: 1,
            scope: 'current-page',
            exportedAt: now().toISOString(),
            page: query.page,
            pageSize: query.pageSize,
            filter: query.type,
            query: query.search,
            characterFilter: query.characterId,
            totalNotes: list.total,
            notes: listController.getVisibleNotes().map(prepareVisibleNote),
            ...getCurrentPageMeta(),
        };
    }

    async function exportAll(format) {
        return run('exportRunning', async () => {
            const exported = await repository.exportNotes({ format, ...getExportOptions() });
            const edition = exported.source === 'lite' ? '-lite' : '';
            const content = format === 'json'
                ? JSON.stringify(exported.data, null, 2)
                : typeof exported.data === 'string' ? exported.data : buildPlainTextExport(exported.notes || []);
            const type = format === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8';
            download(content, `tavern-notes${edition}-all-${stamp(now)}.${format}`, type);
            return exported;
        });
    }

    async function exportPage(format) {
        return run('exportRunning', async () => {
            const data = currentPageData();
            if (!data.notes.length) throw new Error('NO_PAGE_NOTES');
            const content = format === 'json' ? JSON.stringify(data, null, 2) : buildPlainTextExport(data.notes);
            const type = format === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8';
            download(content, `tavern-notes${currentPageEdition}-current-page-${stamp(now)}.${format}`, type);
            return data;
        });
    }

    return {
        mount() {
            mounted = true;
        },
        importJson(fileOrData, options) {
            return run('importRunning', async () => {
                let payload;
                try {
                    payload = typeof fileOrData?.text === 'function'
                        ? JSON.parse(await fileOrData.text())
                        : typeof fileOrData === 'string' ? JSON.parse(fileOrData) : fileOrData;
                } catch {
                    throw new Error('INVALID_BACKUP');
                }
                if (payload?.format !== 'tavern-notes-export' || !Array.isArray(payload.notes)) throw new Error('INVALID_BACKUP');
                const result = await repository.importNotes(payload, options);
                replaceQueryState({ ...getQueryState(), page: 1 });
                await refresh();
                return result;
            });
        },
        exportAllJson: () => exportAll('json'),
        exportAllTxt: () => exportAll('txt'),
        exportCurrentPageJson: () => exportPage('json'),
        exportCurrentPageTxt: () => exportPage('txt'),
        destroy() {
            mounted = false;
            if (getNoteUiState().importRunning || getNoteUiState().exportRunning) {
                patchNoteUiState({ importRunning: false, exportRunning: false });
            }
        },
    };
}
