const port = Number(process.env.CDP_PORT || 9223);
const targetUrl = process.env.TARGET_URL || 'http://127.0.0.1:8000/';

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function findPage() {
    for (let attempt = 0; attempt < 30; attempt += 1) {
        try {
            const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
            const page = pages.find(item => item.type === 'page');
            if (page) return page;
        } catch {
            // Chrome may still be starting.
        }
        await wait(250);
    }
    throw new Error('Chrome DevTools endpoint did not become ready.');
}

const page = await findPage();
const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
const exceptions = [];
let nextId = 1;

socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') {
        exceptions.push(message.params.exceptionDetails?.text || 'Unknown page exception');
    }
});

await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
});

function command(method, params = {}) {
    const id = nextId;
    nextId += 1;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

await command('Runtime.enable');
await command('Page.enable');
await command('Page.navigate', { url: targetUrl });
await wait(12000);

const evaluation = await command('Runtime.evaluate', {
    expression: `JSON.stringify({
        title: document.title,
        readyState: document.readyState,
        hasChat: Boolean(document.querySelector('#chat')),
        fullPanel: Boolean(document.querySelector('#tavern-notes-panel')),
        litePanel: Boolean(document.querySelector('#tavern-notes-lite-panel')),
        fullLauncher: Boolean(document.querySelector('#tavern-notes-open, #tavern-notes-floating-launcher')),
        liteLauncher: Boolean(document.querySelector('#tavern-notes-lite-open, #tavern-notes-lite-floating-launcher')),
    })`,
    returnByValue: true,
});

const result = JSON.parse(evaluation.result.value);
console.log(JSON.stringify({ ...result, exceptions }, null, 2));
socket.close();

if (exceptions.length) process.exitCode = 1;
if (!result.hasChat) process.exitCode = 2;
if (result.fullPanel && result.litePanel) process.exitCode = 3;
