const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kdiff4', {
  readFile: (filePath) => ipcRenderer.invoke('read-file', { filePath }),
  compareDirectories: (leftPath, rightPath) => ipcRenderer.invoke('compare-directories', { leftPath, rightPath }),
  onInitialPaths: (callback) => ipcRenderer.once('initial-paths', (_event, data) => callback(data)),
  openInEditor: (filePath, line, column) => ipcRenderer.invoke('open-in-editor', { filePath, line, column }),
  onCloseRequested: (callback) => ipcRenderer.on('close-requested', () => callback()),
  forceClose: () => ipcRenderer.send('force-close'),
});
