export function getNoteDetailVariants(note) {
    return Array.isArray(note?.variants) && note.variants.length ? note.variants : [note].filter(Boolean);
}

export function createNoteDetailModel(note, { variantId = null, formatType = value => value || '' } = {}) {
    if (!note) return null;
    const variants = getNoteDetailVariants(note);
    const active = variants.find(item => String(item?.id) === String(variantId))
        || variants.find(item => item?.id === note.activeVariantId)
        || variants[variants.length - 1]
        || note;
    const tags = Array.isArray(active.tags) ? active.tags : [];
    return {
        note: active,
        id: active.id,
        content: String(active.content || ''),
        kicker: `${formatType(active.type)} · ${active.character?.name || '未命名角色'}`,
        title: active.createdAt ? new Date(active.createdAt).toLocaleString() : '全文',
        chatName: active.chat?.name || '',
        messageId: active.chat?.messageId ?? '-',
        tags,
        variants: variants.map(item => ({
            id: item?.id,
            active: item === active,
        })),
        actions: {
            copy: Boolean(active.content),
            fill: Boolean(active.content),
            share: true,
            edit: true,
            delete: active.id != null,
        },
    };
}
