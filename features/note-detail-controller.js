import { createNoteDetailModel } from '../core/note-detail-model.js';

export function createNoteDetailController({
    view,
    formatType,
    closeActionMenus = () => {},
    copyText,
    fillInput,
    editNote,
    confirmDelete,
    deleteNote,
    shareNote,
    closePanel = () => {},
    notify = () => {},
}) {
    let mounted = false;
    let currentNote = null;
    let variantId = null;

    function model() {
        return createNoteDetailModel(currentNote, { variantId, formatType });
    }

    async function action(name) {
        const detail = model();
        if (!mounted || !detail) return;
        const note = detail.note;
        if (name === 'copy') {
            await copyText(note.content);
            notify('copied');
        } else if (name === 'fill') {
            await fillInput(note.content);
            close();
            closePanel();
            notify('filled');
        } else if (name === 'share') {
            close();
            shareNote(note);
        } else if (name === 'edit') {
            close();
            editNote(note);
        } else if (name === 'delete' && await confirmDelete(note)) {
            const result = await deleteNote(note.id);
            if (result?.ok === false) return result;
            close();
            notify('deleted');
        }
    }

    function close() {
        variantId = null;
        currentNote = null;
        view.close();
    }

    return {
        mount() {
            if (mounted) return;
            view.mount();
            mounted = true;
        },
        open(note) {
            if (!mounted || !note) return;
            closeActionMenus();
            currentNote = note;
            variantId = null;
            view.open(model());
        },
        switchVariant(nextVariantId) {
            if (!mounted || !currentNote) return;
            variantId = nextVariantId;
            view.open(model());
        },
        copyContent: () => action('copy'),
        fillInput: () => action('fill'),
        edit: () => action('edit'),
        remove: () => action('delete'),
        share: () => action('share'),
        handleAction: action,
        close,
        destroy() {
            mounted = false;
            currentNote = null;
            variantId = null;
            view.destroy();
        },
    };
}
