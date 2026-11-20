// Tests for the parts of the device tools (§14.3) that run without Electron: allowed-folder path checks, the local files
// tool on a temp folder, blocked-app matching, coordinate scaling and key parsing.
// Run: npm run build && node scripts/test-device.mjs   (or `npm run test:device`)
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dist = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../dist/device');
const { isInside, resolveAllowed } = require(path.join(dist, 'paths.js'));
const { runFiles, FILE_LIMITS } = require(path.join(dist, 'files.js'));
const { matchBlockedApp, cleanBlockedList } = require(path.join(dist, 'blocked.js'));
const { screenshotSize, shotToDip, assertInShot, dipToPhysical, fitWidth } = require(path.join(dist, 'coords.js'));
const { parseKeyCombo } = require(path.join(dist, 'keys.js'));

let passed = 0;
let failed = 0;
async function test(name, fn) {
    try {
        await fn();
        passed++;
        console.log(`  ok   ${name}`);
    } catch (e) {
        failed++;
        console.log(`  FAIL ${name}\n       ${e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n       ') : e}`);
    }
}
const rejects = (p, re) => assert.rejects(p, re);
const WIN = process.platform === 'win32';

console.log('Path checks');
await test('win32: inside, case-insensitive', () => {
    assert.equal(isInside('C:\\Users\\a\\Docs\\x.txt', 'C:\\Users\\a\\docs', 'win32'), true);
    assert.equal(isInside('c:\\users\\A\\DOCS', 'C:\\Users\\a\\Docs', 'win32'), true);
});
await test('win32: sibling with same prefix is outside', () => assert.equal(isInside('C:\\Users\\a\\Docs2\\x', 'C:\\Users\\a\\Docs', 'win32'), false));
await test('win32: .. traversal is outside', () => assert.equal(isInside('C:\\Users\\a\\Docs\\..\\Secret\\x', 'C:\\Users\\a\\Docs', 'win32'), false));
await test('win32: other drive is outside', () => assert.equal(isInside('D:\\Users\\a\\Docs\\x', 'C:\\Users\\a\\Docs', 'win32'), false));
await test('posix: case-sensitive', () => assert.equal(isInside('/home/a/DOCS/x', '/home/a/Docs', 'linux'), false));
await test('posix: .. traversal is outside', () => assert.equal(isInside('/home/a/Docs/../.ssh/id_rsa', '/home/a/Docs', 'linux'), false));
await test('posix: root itself and trailing separator', () => {
    assert.equal(isInside('/home/a/Docs', '/home/a/Docs/', 'linux'), true);
    assert.equal(isInside('/home/a/Docs/sub/f', '/home/a/Docs', 'darwin'), true);
});

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'as-device-test-'));
const allowed = path.join(tmp, 'Allowed');
const outside = path.join(tmp, 'Outside');
await fs.mkdir(path.join(allowed, 'sub', 'node_modules', 'report-pkg'), { recursive: true });
await fs.mkdir(path.join(allowed, '.git'), { recursive: true });
await fs.mkdir(outside, { recursive: true });
await fs.writeFile(path.join(outside, 'secret.txt'), 'secret');
await fs.writeFile(path.join(allowed, 'sub', 'report-q3.txt'), 'q3');
await fs.writeFile(path.join(allowed, '.git', 'report-config'), 'x');
const realAllowed = await fs.realpath(allowed);
const roots = [realAllowed];
const trashed = [];
const deps = { fs, trash: async (p) => (trashed.push(p), fs.rm(p)) };
const files = (req) => runFiles(req, [allowed], deps);

let linkMade = false;
try {
    await fs.symlink(outside, path.join(allowed, 'escape'), WIN ? 'junction' : 'dir');
    linkMade = true;
} catch {
    /* no symlink permission */
}

await test('resolve: relative to allowed folder', async () => {
    const r = await resolveAllowed('sub/report-q3.txt', roots, fs, { mustExist: true });
    assert.equal(r.path, path.join(realAllowed, 'sub', 'report-q3.txt'));
});
await test('resolve: "<folder name>/..." form', async () => {
    const r = await resolveAllowed('Allowed/sub/report-q3.txt', roots, fs, { mustExist: true });
    assert.equal(r.path, path.join(realAllowed, 'sub', 'report-q3.txt'));
});
await test('resolve: ../ traversal refused', () => rejects(resolveAllowed('../Outside/secret.txt', roots, fs, { mustExist: true }), /outside the folders/));
await test('resolve: absolute path outside refused', () => rejects(resolveAllowed(path.join(outside, 'secret.txt'), roots, fs, { mustExist: true }), /outside the folders/));
await test('resolve: absolute path with .. inside the string refused', () => rejects(resolveAllowed(path.join(allowed, '..', 'Outside', 'secret.txt'), roots, fs, { mustExist: true }), /outside the folders/));
await test('resolve: non-existing target allowed only for create', async () => {
    const r = await resolveAllowed('new/deep/file.txt', roots, fs, { mustExist: false });
    assert.equal(r.exists, false);
    assert.equal(r.path, path.join(realAllowed, 'new', 'deep', 'file.txt'));
    await rejects(resolveAllowed('new/deep/file.txt', roots, fs, { mustExist: true }), /Not found/);
});
await test('resolve: link inside pointing outside refused' + (linkMade ? '' : ' (skipped: cannot create links)'), async () => {
    if (!linkMade) return;
    await rejects(resolveAllowed('escape/secret.txt', roots, fs, { mustExist: true }), /outside the folders/);
    await rejects(files({ action: 'write', path: 'escape/new.txt', content: 'x' }), /outside the folders/);
});
if (WIN) {
    await test('resolve: different case on Windows is the same folder', async () => {
        const r = await resolveAllowed(path.join(allowed.toUpperCase(), 'SUB', 'REPORT-Q3.TXT'), roots, fs, { mustExist: true });
        assert.equal(r.exists, true);
    });
    await test('resolve: alternate data streams and device paths refused', async () => {
        await rejects(resolveAllowed('sub/report-q3.txt:hidden', roots, fs, { mustExist: false }), /Invalid path/);
        await rejects(resolveAllowed('\\\\.\\PhysicalDrive0', roots, fs, { mustExist: true }), /Device paths/);
    });
}
await test('resolve: no allowed folders', () => rejects(resolveAllowed('x', [], fs, { mustExist: true }), /No folders are allowed/));

console.log('Local files');
await test('list: empty path lists the allowed folders', async () => {
    const r = await files({ action: 'list' });
    assert.equal(r.entries.length, 1);
    assert.equal(r.entries[0].path, realAllowed);
    assert.equal(r.entries[0].kind, 'folder');
});
await test('list: folder contents', async () => {
    const r = await files({ action: 'list', path: 'sub' });
    assert.deepEqual(r.entries.map((e) => e.name).sort(), ['node_modules', 'report-q3.txt']);
    assert.equal(r.truncated, false);
});
await test('list: outside refused', () => rejects(files({ action: 'list', path: outside }), /outside the folders/));
await test('search: name match, skips node_modules and .git, never follows links out', async () => {
    const r = await files({ action: 'search', query: 'REPORT' });
    assert.deepEqual(r.entries.map((e) => e.name), ['report-q3.txt']);
    const s = await files({ action: 'search', query: 'secret' });
    assert.equal(s.entries.length, 0);
});
await test('write: creates parent folders', async () => {
    const r = await files({ action: 'write', path: 'notes/today.md', content: '# Hi' });
    assert.equal(r.ok, true);
    assert.equal(await fs.readFile(path.join(allowed, 'notes', 'today.md'), 'utf8'), '# Hi');
});
await test('write: refuses to overwrite without overwrite:true', () => rejects(files({ action: 'write', path: 'notes/today.md', content: 'x' }), /already exists/));
await test('write: overwrite:true replaces', async () => {
    await files({ action: 'write', path: 'notes/today.md', content: '# Bye', overwrite: true });
    assert.equal(await fs.readFile(path.join(allowed, 'notes', 'today.md'), 'utf8'), '# Bye');
});
await test('write: outside refused', () => rejects(files({ action: 'write', path: '../Outside/x.txt', content: 'x' }), /outside the folders/));
await test('write: over 10 MB refused', () => rejects(files({ action: 'write', path: 'big.bin', content: Buffer.alloc(FILE_LIMITS.WRITE_MAX_BYTES + 1).toString('base64'), encoding: 'base64' }), /too large/));
await test('read: text', async () => {
    const r = await files({ action: 'read', path: 'notes/today.md' });
    assert.equal(r.encoding, 'utf8');
    assert.equal(r.content, '# Bye');
    assert.equal(r.mimetype, 'text/markdown');
    assert.equal(r.truncated, false);
});
await test('read: binary as base64', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    await files({ action: 'write', path: 'img.png', content: png.toString('base64'), encoding: 'base64' });
    const r = await files({ action: 'read', path: 'img.png' });
    assert.equal(r.encoding, 'base64');
    assert.equal(r.mimetype, 'image/png');
    assert.deepEqual(Buffer.from(r.content, 'base64'), png);
});
await test('read: unknown extension sniffed as text', async () => {
    await files({ action: 'write', path: 'README', content: 'plain words' });
    const r = await files({ action: 'read', path: 'README' });
    assert.equal(r.encoding, 'utf8');
    assert.equal(r.content, 'plain words');
});
await test('read: text over 200 KB is truncated', async () => {
    await files({ action: 'write', path: 'long.txt', content: 'a'.repeat(300 * 1024) });
    const r = await files({ action: 'read', path: 'long.txt' });
    assert.equal(r.truncated, true);
    assert.equal(r.content.length, FILE_LIMITS.TEXT_MAX_BYTES);
    assert.equal(r.size, 300 * 1024);
});
await test('read: over 5 MB refused', async () => {
    await fs.writeFile(path.join(allowed, 'huge.txt'), Buffer.alloc(FILE_LIMITS.READ_MAX_BYTES + 1, 97));
    await rejects(files({ action: 'read', path: 'huge.txt' }), /too large/);
});
await test('read: outside refused', () => rejects(files({ action: 'read', path: path.join(outside, 'secret.txt') }), /outside the folders/));
await test('move: rename with a bare name', async () => {
    const r = await files({ action: 'move', path: 'notes/today.md', to: 'renamed.md' });
    assert.equal(r.path, path.join(realAllowed, 'notes', 'renamed.md'));
    await fs.access(r.path);
});
await test('move: into another folder', async () => {
    const r = await files({ action: 'move', path: 'notes/renamed.md', to: 'archive/2024/renamed.md' });
    assert.equal(r.path, path.join(realAllowed, 'archive', '2024', 'renamed.md'));
});
await test('move: destination exists refused', () => rejects(files({ action: 'move', path: 'long.txt', to: 'README' }), /already exists/));
await test('move: outside refused', () => rejects(files({ action: 'move', path: 'long.txt', to: path.join(outside, 'long.txt') }), /outside the folders/));
await test('move: the allowed folder itself refused', () => rejects(files({ action: 'move', path: allowed, to: 'x' }), /allowed folder itself/));
await test('move: folder into itself refused', () => rejects(files({ action: 'move', path: 'archive', to: 'archive/2024/inner' }), /into itself/));
await test('delete: file goes to trash', async () => {
    const r = await files({ action: 'delete', path: 'long.txt' });
    assert.equal(r.ok, true);
    assert.equal(trashed.at(-1), path.join(realAllowed, 'long.txt'));
});
await test('delete: folders refused', () => rejects(files({ action: 'delete', path: 'archive' }), /Only files/));
await test('delete: outside refused', () => rejects(files({ action: 'delete', path: path.join(outside, 'secret.txt') }), /outside the folders/));
await test('unknown action refused', () => rejects(files({ action: 'chmod', path: 'x' }), /Unknown local files action/));
await test('outside file untouched', async () => assert.equal(await fs.readFile(path.join(outside, 'secret.txt'), 'utf8'), 'secret'));

console.log('Blocked apps');
await test('terminals, password managers, settings', () => {
    assert.equal(matchBlockedApp({ name: 'Windows Terminal', path: 'C:\\Program Files\\WindowsApps\\WindowsTerminal.exe' }), 'Terminal');
    assert.equal(matchBlockedApp({ name: 'cmd.exe', path: 'C:\\Windows\\System32\\cmd.exe' }), 'cmd');
    assert.equal(matchBlockedApp({ name: 'Windows PowerShell', path: 'C:\\...\\powershell.exe' }), 'PowerShell');
    assert.equal(matchBlockedApp({ name: '1Password 7' }), '1Password');
    assert.equal(matchBlockedApp({ name: 'KeePassXC' }), 'KeePassXC');
    assert.equal(matchBlockedApp({ name: 'Terminal', bundleId: 'com.apple.Terminal' }), 'Terminal');
    assert.equal(matchBlockedApp({ name: 'System Settings', bundleId: 'com.apple.systempreferences' }), 'System Settings');
    assert.equal(matchBlockedApp({ name: 'Consent', path: 'C:\\Windows\\System32\\consent.exe' }), 'consent');
});
await test('window title only matches exactly (Control Panel hosted by Explorer)', () => {
    assert.equal(matchBlockedApp({ name: 'Windows Explorer', path: 'C:\\Windows\\explorer.exe', title: 'Control Panel' }), 'Control Panel');
    assert.equal(matchBlockedApp({ name: 'Google Chrome', path: 'C:\\chrome.exe', title: 'Settings - Google Chrome' }), null);
});
await test('ordinary apps allowed', () => {
    assert.equal(matchBlockedApp({ name: 'Notepad', path: 'C:\\Windows\\notepad.exe' }), null);
    assert.equal(matchBlockedApp({ name: 'Microsoft Excel' }), null);
    assert.equal(matchBlockedApp(null), null);
});
await test('Agent Space by name and by process id', () => {
    assert.equal(matchBlockedApp({ name: 'Agent Space' }), 'Agent Space');
    assert.equal(matchBlockedApp({ name: 'Electron', processId: 4242 }, [], [4242]), 'Agent Space');
});
await test("user's extra list", () => {
    assert.equal(matchBlockedApp({ name: 'Slack' }, ['slack']), 'slack');
    assert.deepEqual(cleanBlockedList([' Slack ', 'slack', '', 3, 'FinanceApp']), ['Slack', '3', 'FinanceApp']);
});

console.log('Coordinates');
await test('Windows 150 % display: 1920×1080 px scaled to 1280×720', () => {
    const d = { bounds: { x: 1280, y: 0, width: 1280, height: 720 }, scaleFactor: 1.5 };
    assert.deepEqual(screenshotSize(d), { width: 1280, height: 720 });
    assert.deepEqual(shotToDip(0, 0, d, screenshotSize(d)), { x: 1280, y: 0 });
    assert.deepEqual(shotToDip(1279, 719, d, screenshotSize(d)), { x: 2559, y: 719 });
    assert.deepEqual(dipToPhysical({ x: 100, y: 50 }, 1.5), { x: 150, y: 75 });
});
await test('Retina Mac: 1440×900 pt (2880×1800 px) → 1280×800 shot, back to points', () => {
    const d = { bounds: { x: 0, y: 0, width: 1440, height: 900 }, scaleFactor: 2 };
    const shot = screenshotSize(d);
    assert.deepEqual(shot, { width: 1280, height: 800 });
    assert.deepEqual(shotToDip(640, 400, d, shot), { x: 720, y: 450 });
});
await test('display left of / above the primary (negative origin)', () => {
    const d = { bounds: { x: -1920, y: -200, width: 1920, height: 1080 }, scaleFactor: 1 };
    const shot = screenshotSize(d);
    assert.deepEqual(shot, { width: 1280, height: 720 });
    assert.deepEqual(shotToDip(640, 360, d, shot), { x: -960, y: 340 });
});
await test('small display is never scaled up', () => assert.deepEqual(fitWidth(1024, 768, 1280), { width: 1024, height: 768 }));
await test('coordinates outside the screenshot refused', () => {
    assert.throws(() => assertInShot(1280, 10, { width: 1280, height: 720 }), /outside the screenshot/);
    assert.throws(() => assertInShot(-1, 10, { width: 1280, height: 720 }), /outside the screenshot/);
    assert.throws(() => assertInShot('5', 10, { width: 1280, height: 720 }), /must be numbers/);
});

console.log('Keys');
await test('combos', () => {
    assert.deepEqual(parseKeyCombo('ctrl+c', 'win32'), ['LeftControl', 'C']);
    assert.deepEqual(parseKeyCombo('cmd+shift+t', 'darwin'), ['LeftCmd', 'LeftShift', 'T']);
    assert.deepEqual(parseKeyCombo('cmd+v', 'win32'), ['LeftControl', 'V']);
    assert.deepEqual(parseKeyCombo('Enter'), ['Enter']);
    assert.deepEqual(parseKeyCombo('ctrl++', 'win32'), ['LeftControl', 'Equal']);
    assert.deepEqual(parseKeyCombo('alt+F4', 'win32'), ['LeftAlt', 'F4']);
    assert.throws(() => parseKeyCombo('ctrl+banana'), /Unknown key/);
    assert.throws(() => parseKeyCombo(''), /needs/);
});

await fs.rm(tmp, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
