const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('moor', {
  readFile: (filePath) => ipcRenderer.invoke('read-file', { filePath }),
  readFileAsDataUrl: (filePath) => ipcRenderer.invoke('read-file-as-data-url', { filePath }),
  compareDirectories: (leftPath, rightPath) => ipcRenderer.invoke('compare-directories', { leftPath, rightPath }),
  onInitialPaths: (callback) => ipcRenderer.once('initial-paths', (_event, data) => callback(data)),
  openInEditor: (filePath, line, column) => ipcRenderer.invoke('open-in-editor', { filePath, line, column }),
  onCloseRequested: (callback) => ipcRenderer.on('close-requested', () => callback()),
  forceClose: (payload) => ipcRenderer.send('force-close', payload),
});
