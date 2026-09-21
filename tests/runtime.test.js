const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createStorage() {
    const values = new Map();
    return {
        getItem: key => values.get(key) || null,
        setItem: (key, value) => values.set(key, String(value))
    };
}

function loadRuntime() {
    const sessionStorage = createStorage();
    const localStorage = createStorage();
    const context = {
        window: { location: { href: 'https://www.ecoledirecte.com/E/42/EmploiDuTemps', pathname: '/E/42/EmploiDuTemps' } },
        sessionStorage,
        localStorage,
        URL,
        TextDecoder,
        Uint8Array,
        atob: value => Buffer.from(value, 'base64').toString('binary')
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'runtime.js'), 'utf8'), context);
    return { ed: context.window.EDPrint, sessionStorage, localStorage };
}

test('runtime stores and retrieves a captured token', () => {
    const { ed, sessionStorage } = loadRuntime();
    ed.saveToken('a'.repeat(24));
    assert.equal(ed.getToken(), 'a'.repeat(24));
    assert.equal(sessionStorage.getItem('ed_live_token'), 'a'.repeat(24));
});

test('runtime ignores short tokens and reads fallback storage', () => {
    const { ed, localStorage } = loadRuntime();
    ed.saveToken('short');
    localStorage.setItem('X-Token', '"stored-token"');
    assert.equal(ed.getToken(), 'stored-token');
});

test('runtime extracts student id and escapes HTML', () => {
    const { ed } = loadRuntime();
    assert.equal(ed.getEleveId(), '42');
    assert.equal(ed.escapeHtml('<b>A & B</b>'), '&lt;b&gt;A &amp; B&lt;/b&gt;');
});

test('manifest scripts exist and tests are not listed for deployment', () => {
    const root = path.join(__dirname, '..');
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
    const scripts = manifest.content_scripts.flatMap(contentScript => contentScript.js);
    assert.ok(scripts.includes('runtime.js'));
    assert.ok(scripts.includes('interception.js'));
    assert.ok(scripts.includes('schedule.js'));
    assert.ok(scripts.includes('homework.js'));
    assert.ok(scripts.includes('content.js'));
    assert.ok(scripts.every(file => fs.existsSync(path.join(root, file))));
    assert.ok(scripts.every(file => !file.startsWith('tests/')));
});