import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import { statSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function parseLaunchArgs() {
  const args = process.argv.slice(2).filter(a =>
    !a.startsWith('--inspect') &&
    !a.startsWith('--remote-debugging') &&
    !a.startsWith('--')
  );

  const mergeIdx = args.indexOf('-m');
  const outputIdx = args.indexOf('-o');

  if (mergeIdx !== -1) {
    const base = args[mergeIdx + 1];
    const left = args[mergeIdx + 2];
    const right = args[mergeIdx + 3];
    const output = outputIdx !== -1 ? args[outputIdx + 1] : undefined;
    return { mode: 'merge', base, left, right, output };
  }

  const paths = args.filter(a => !a.startsWith('-'));
  if (paths.length === 2) {
    const leftStat = statSync(paths[0], { throwIfNoEntry: false });
    const rightStat = statSync(paths[1], { throwIfNoEntry: false });
    const isDir = leftStat?.isDirectory() || rightStat?.isDirectory();
    return { mode: isDir ? 'compare' : 'diff', left: paths[0], right: paths[1] };
  }

  return null;
}

app.whenReady().then(async () => {
  ipcMain.handle('compare-directories', async (_event, { leftPath, rightPath }) => {
    const { compareDirectories } = await import('../src/engine/directory.js');
    return compareDirectories(leftPath, rightPath);
  });

  ipcMain.handle('read-file', async (_event, { filePath }) => {
    const buf = await fs.readFile(filePath);
    if (buf.includes(0)) return '\x00BINARY';
    return buf.toString('utf-8');
  });

  ipcMain.handle('save-file', async (_event, { filePath, content }) => {
    await fs.writeFile(filePath, content, 'utf-8');
  });

  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'] });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('get-launch-args', () => parseLaunchArgs());

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
    const title = launchArgs.mode === 'merge'
      ? `kdiff4 — merge → ${launchArgs.output || 'unsaved'}`
      : `kdiff4 — ${launchArgs.left} vs ${launchArgs.right}`;
    mainWindow.setTitle(title);
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

  mainWindow.maximize();
  mainWindow.show();
  app.focus({ steal: true });
  mainWindow.focus();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      app.whenReady().then(() => {});
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
