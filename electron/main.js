import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { existsSync, statSync, writeFileSync, readFileSync, renameSync } from 'fs';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let exitCode = 3;
let closePayload = null;
let reviewer = null;
let contextPath = null;
let contextInput = null;
try { reviewer = execSync('git config user.name', { encoding: 'utf-8' }).trim(); } catch {};

const VALUE_FLAGS = new Set(['--title', '--context']);

function parseLaunchArgs() {
  const argv = process.argv.slice(2);
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (VALUE_FLAGS.has(a)) { i++; continue; }
    if (a.startsWith('--')) continue;
    positional.push(a);
  }
  if (positional.length === 2) {
    const leftStat = statSync(positional[0], { throwIfNoEntry: false });
    const rightStat = statSync(positional[1], { throwIfNoEntry: false });
    const isDirectory = leftStat?.isDirectory() || rightStat?.isDirectory();
    return { left: positional[0], right: positional[1], isDirectory };
  }
  return null;
}

function parseFlag(name) {
  const argv = process.argv.slice(2);
  const long = `--${name}`;
  const inline = `--${name}=`;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === long && i + 1 < argv.length) return argv[i + 1];
    if (a.startsWith(inline)) return a.slice(inline.length);
  }
  return null;
}

function resolveContextPath() {
  return parseFlag('context') ?? process.env.MOOR_CONTEXT ?? null;
}

function readContextInput(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    const raw = readFileSync(filePath, 'utf-8');
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw);
    return parsed.input ?? null;
  } catch (err) {
    console.error(`[moor] failed to read context input from ${filePath}: ${err.message}`);
    return null;
  }
}

function writeContextOutput(output) {
  if (!contextPath) return;
  const payload = {
    input: contextInput,
    output: {
      ...output,
      reviewer: reviewer ?? null,
    },
  };
  // Write to a temp path and rename so a watching reader never observes a
  // truncated JSON file mid-write — rename is atomic on POSIX filesystems.
  const tmp = `${contextPath}.tmp-${process.pid}`;
  try {
    writeFileSync(tmp, JSON.stringify(payload, null, 2));
    renameSync(tmp, contextPath);
  } catch (err) {
    console.error(`[moor] failed to write context output to ${contextPath}: ${err.message}`);
  }
}

function deriveProject() {
  try {
    const toplevel = execSync('git rev-parse --show-toplevel', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!toplevel) return null;
    const home = os.homedir();
    const display = toplevel === home || toplevel.startsWith(home + path.sep)
      ? '~' + toplevel.slice(home.length)
      : toplevel;
    return `${path.basename(toplevel)} (${display})`;
  } catch {}
  return null;
}

function isGitDifftoolTmpPath(p) {
  if (!p) return false;
  // git difftool --dir-diff drops the trees in $TMPDIR/git-difftool.<hash>/{left,right}.
  // Surfacing those paths in the window title is useless — they're random,
  // unrelated to the user's repo, and obscure the project name.
  const tmpdir = os.tmpdir();
  return p.startsWith(tmpdir) && /git-difftool\./.test(p);
}

function deriveContext(launchArgs) {
  const cliTitle = parseFlag('title');
  if (cliTitle) return cliTitle;
  if (process.env.MOOR_TITLE) return process.env.MOOR_TITLE;
  if (launchArgs) {
    if (isGitDifftoolTmpPath(launchArgs.left) && isGitDifftoolTmpPath(launchArgs.right)) {
      return 'git diff';
    }
    return `${launchArgs.left} vs ${launchArgs.right}`;
  }
  return null;
}

function deriveWindowTitle(launchArgs) {
  const project = deriveProject();
  const context = deriveContext(launchArgs);
  if (project && context) return `${project} - ${context}`;
  if (project) return project;
  if (context) return context;
  return 'moor';
}

app.whenReady().then(async () => {
  contextPath = resolveContextPath();
  if (contextPath) {
    contextInput = readContextInput(contextPath);
  }

  ipcMain.handle('read-file', async (_event, { filePath }) => {
    const buf = await fs.readFile(filePath);
    if (buf.includes(0)) return '\x00BINARY';
    return buf.toString('utf-8');
  });

  const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico']);
  const MIME_MAP = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

  ipcMain.handle('read-file-as-data-url', async (_event, { filePath }) => {
    const ext = path.extname(filePath).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) return null;
    const buf = await fs.readFile(filePath);
    const mime = MIME_MAP[ext] || 'application/octet-stream';
    return `data:${mime};base64,${buf.toString('base64')}`;
  });

  ipcMain.handle('compare-directories', async (_event, { leftPath, rightPath }) => {
    const { compareDirectories } = await import('../src/engine/directory.js');
    return compareDirectories(leftPath, rightPath);
  });

  ipcMain.handle('open-in-default-app', async (_event, { filePath }) => {
    // shell.openPath returns '' on success, or an error message string.
    const error = await shell.openPath(filePath);
    if (error) {
      console.error('[open-in-default-app]', error);
      return { ok: false, error };
    }
    return { ok: true };
  });

  ipcMain.handle('get-initial-context', () => ({
    channelConfigured: contextPath !== null,
    input: contextInput,
  }));

  ipcMain.on('write-output', (_event, output) => {
    writeContextOutput(output);
  });

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    backgroundColor: '#0a0e17',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const launchArgs = parseLaunchArgs();

  mainWindow.on('page-title-updated', (e) => e.preventDefault());
  mainWindow.setTitle(deriveWindowTitle(launchArgs));

  mainWindow.webContents.on('did-finish-load', () => {
    if (launchArgs) {
      mainWindow.webContents.send('initial-paths', launchArgs);
    }
    mainWindow.webContents.focus();
  });

  const distIndex = path.join(__dirname, '..', 'dist', 'index.html');
  if (existsSync(distIndex)) {
    await mainWindow.loadFile(distIndex);
  } else {
    await mainWindow.loadURL('http://localhost:5173');
  }

  let forceClose = false;
  ipcMain.on('force-close', (_event, payload) => {
    forceClose = true;
    if (typeof payload === 'object' && payload !== null) {
      exitCode = payload.exitCode ?? 0;
      closePayload = payload;
    } else {
      exitCode = payload ?? 0;
      closePayload = { exitCode, comments: [] };
    }
    mainWindow.close();
  });

  mainWindow.on('close', (e) => {
    if (!forceClose) {
      e.preventDefault();
      mainWindow.webContents.send('close-requested');
    }
  });

  mainWindow.maximize();
  mainWindow.show();
  app.focus({ steal: true });
  mainWindow.focus();
});

app.on('window-all-closed', () => {
  const data = closePayload || { exitCode, comments: [] };
  writeContextOutput(data);
  process.exit(exitCode);
});
