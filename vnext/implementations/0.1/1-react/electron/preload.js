const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kdiff4', {
  compareDirectories: (leftPath, rightPath) => ipcRenderer.invoke('compare-directories', { leftPath, rightPath }),
  readFile: (filePath) => ipcRenderer.invoke('read-file', { filePath }),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', { filePath, content }),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  selectFile: () => ipcRenderer.invoke('select-file'),
  getLaunchArgs: () => ipcRenderer.invoke('get-launch-args'),
  onInitialPaths: (callback) => ipcRenderer.once('initial-paths', (_event, data) => callback(data)),
});
