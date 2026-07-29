import { createShareCardFilename, normalizeShareCardContent, normalizeShareCardSettings } from '../core/share-card-model.js';

export function createShareCardController({
    view,
    renderer,
    getSettings,
    updateSettings: saveSettings,
    resetSettings: resetSavedSettings,
    downloadBlob,
    brand,
    onEvent = () => {},
}) {
    let mounted = false;
    let currentNote = null;
    let generation = 0;
    let exporting = false;

    async function preview(settingsPatch = {}) {
        if (!mounted || !currentNote) return null;
        const request = ++generation;
        const settings = normalizeShareCardSettings({ ...getSettings(), ...settingsPatch });
        try {
            const value = await renderer.renderPreview({
                canvas: view.getCanvas(),
                note: normalizeShareCardContent(currentNote),
                settings,
            });
            return mounted && request === generation ? value : null;
        } catch (error) {
            if (mounted && request === generation) onEvent('error', error);
            return null;
        }
    }

    async function updateSettings(patch) {
        const result = await saveSettings(patch);
        if (result?.ok === false) return result;
        view.sync();
        await preview();
        return result;
    }

    async function exportImage() {
        if (!mounted || !currentNote || exporting) return null;
        exporting = true;
        onEvent('exporting', true);
        try {
            const settings = normalizeShareCardSettings(getSettings());
            const result = await renderer.renderExport({
                canvas: view.getCanvas(),
                note: normalizeShareCardContent(currentNote),
                settings,
            });
            if (!(result?.blob instanceof Blob) || result.blob.size === 0) {
                throw new Error('share-card-export-empty-result');
            }
            const filename = createShareCardFilename(currentNote, { brand });
            await downloadBlob(result.blob, filename);
            onEvent('exported');
            return { ...result, filename };
        } catch (error) {
            onEvent('error', error);
            return null;
        } finally {
            exporting = false;
            if (mounted) onEvent('exporting', false);
        }
    }

    function close() {
        generation += 1;
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
            currentNote = note;
            view.open();
            preview();
        },
        preview,
        updateSettings,
        async resetSettings() {
            const result = await resetSavedSettings();
            view.sync();
            await preview();
            return result;
        },
        exportImage,
        close,
        destroy() {
            mounted = false;
            generation += 1;
            currentNote = null;
            exporting = false;
            renderer.destroy();
            view.destroy();
        },
    };
}
