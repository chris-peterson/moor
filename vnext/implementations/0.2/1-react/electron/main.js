import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, statSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let exitCode = 0;

function parseLaunchArgs() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (args.length === 2) {
    const leftStat = statSync(args[0], { throwIfNoEntry: false });
    const rightStat = statSync(args[1], { throwIfNoEntry: false });
    const isDirectory = leftStat?.isDirectory() || rightStat?.isDirectory();
    return { left: args[0], right: args[1], isDirectory };
  }
  return null;
}

app.whenReady().then(async () => {
  const { VSCodeNavigator } = await import('./vscode-navigator.js');
  const navigator = new VSCodeNavigator();

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

  ipcMain.handle('open-in-editor', async (_event, { filePath, line, column }) => {
    if (path.isAbsolute(filePath)) {
      return navigator.openAbsolutePath(filePath, line, column);
    }
    return navigator.openAtLine(filePath, line, column);
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

  if (launchArgs) {
    mainWindow.setTitle(`kdiff4 — ${launchArgs.left} vs ${launchArgs.right}`);
  }

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
  ipcMain.on('force-close', (_event, code) => {
    forceClose = true;
    exitCode = code ?? 0;
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
  const exitFile = process.env.KDIFF4_EXIT_FILE;
  if (exitFile) {
    writeFileSync(exitFile, String(exitCode));
  }
  process.exit(exitCode);
});
