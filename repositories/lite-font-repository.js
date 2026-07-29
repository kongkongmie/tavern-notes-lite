import { createIndexedDbFontRepository } from './full-font-repository.js';

export function createLiteFontRepository(options) {
    return createIndexedDbFontRepository(options);
}
