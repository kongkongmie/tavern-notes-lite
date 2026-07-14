import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8' };

createServer(async (request, response) => {
    try {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        const file = resolve(root, `.${pathname}`);
        if (file !== root && !file.startsWith(`${root}${sep}`)) throw new Error('Invalid path');
        response.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
        response.end(await readFile(file));
    } catch (error) {
        response.statusCode = 404;
        response.end(error.message);
    }
}).listen(8765, '127.0.0.1', () => console.log('storage smoke server ready'));
