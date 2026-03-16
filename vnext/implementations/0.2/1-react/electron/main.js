import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, statSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

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
  ipcMain.handle('read-file', async (_event, { filePath }) => {
    const buf = await fs.readFile(filePath);
    if (buf.includes(0)) return '\x00BINARY';
    return buf.toString('utf-8');
  });

  ipcMain.handle('compare-directories', async (_event, { leftPath, rightPath }) => {
    const { compareDirectories } = await import('../src/engine/directory.js');
    return compareDirectories(leftPath, rightPath);
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

  mainWindow.maximize();
  mainWindow.show();
  app.focus({ steal: true });
  mainWindow.focus();
});

app.on('window-all-closed', () => {
  app.quit();
});
