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
    const t = layout.translate;
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

async function drawShareCard({
    canvas,
    note,
    settings,
    font,
    characterAvatarUrl,
    userAvatarUrl,
    userName,
    translate,
}) {
    if (!canvas) throw new Error('share-card-canvas-unavailable');
    if (!note) throw new Error('share-card-note-unavailable');
    const [characterAvatar, userAvatar] = await Promise.all([
        loadShareCardImage(characterAvatarUrl),
        loadShareCardImage(userAvatarUrl),
    ]);
    const ctx = canvas.getContext('2d');
    const t = translate;
    const width = canvas.width;
    const height = canvas.height;
    const background = settings.background || '#eef7f2';
    const themeId = settings.theme || 'calendar';
    const darkBackground = isDarkShareCardColor(background);
    const textColor = settings.textColor || (darkBackground ? '#f6f3ed' : '#103f25');
    const muted = darkBackground ? 'rgba(246,243,237,0.62)' : 'rgba(16,63,37,0.64)';
    const lineColor = darkBackground ? 'rgba(246,243,237,0.42)' : 'rgba(16,63,37,0.26)';
    const dates = shareCardDateParts(note);
    const character = note.character?.name || '未命名角色';
    const content = String(note.content || '').trim();
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
        return canvas;
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

        drawShareCardFooter(ctx, { translate,
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
        return canvas;
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

        drawShareCardFooter(ctx, { translate,
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
        return canvas;
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

    drawShareCardFooter(ctx, { translate,
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
    return canvas;
}


function dataUrlToBlob(dataUrl, fallbackType = 'image/png') {
    const [header, payload] = String(dataUrl || '').split(',', 2);
    if (!payload) throw new Error('share-card-export-empty-result');
    const binary = atob(payload);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    const mime = header.match(/^data:([^;]+)/)?.[1] || fallbackType;
    return new Blob([bytes], { type: mime });
}

export function canvasToBlob(canvas, type = 'image/png', quality) {
    return new Promise((resolve, reject) => {
        if (!canvas || typeof canvas.toBlob !== 'function') {
            reject(new Error('share-card-canvas-to-blob-unavailable'));
            return;
        }
        const resolveFallback = () => {
            try {
                const fallback = dataUrlToBlob(canvas.toDataURL(type, quality), type);
                if (!(fallback instanceof Blob) || fallback.size === 0) {
                    reject(new Error('share-card-export-empty-result'));
                    return;
                }
                resolve(fallback);
            } catch (error) {
                reject(error);
            }
        };
        try {
            canvas.toBlob(blob => {
                if (blob instanceof Blob && blob.size > 0) {
                    resolve(blob);
                    return;
                }
                resolveFallback();
            }, type, quality);
        } catch (error) {
            reject(error);
        }
    });
}

export function createShareCardRenderer({
    resolveFont,
    loadFont,
    waitForFont,
    getCharacterAvatarUrl,
    getUserAvatarUrl,
    getUserName,
    translate,
}) {
    async function render(input) {
        let descriptor = { font: 'system-ui, "Noto Serif SC", serif' };
        try {
            descriptor = await resolveFont(input.settings) || descriptor;
            await loadFont(descriptor);
            await waitForFont(descriptor.font);
        } catch {
            descriptor = { font: 'system-ui, "Noto Serif SC", serif' };
        }
        return drawShareCard({
            ...input,
            font: descriptor.font,
            characterAvatarUrl: getCharacterAvatarUrl(input.note),
            userAvatarUrl: getUserAvatarUrl(),
            userName: getUserName(),
            translate,
        });
    }

    return {
        renderPreview: render,
        async renderExport(input) {
            const canvas = await render(input);
            const blob = await canvasToBlob(canvas, 'image/png');
            if (!(blob instanceof Blob) || blob.size === 0) {
                throw new Error('share-card-export-empty-result');
            }
            return {
                blob,
                mimeType: 'image/png',
                width: canvas.width,
                height: canvas.height,
            };
        },
        destroy() {},
    };
}
