const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kdiff4', {
  readFile: (filePath) => ipcRenderer.invoke('read-file', { filePath }),
  onInitialPaths: (callback) => ipcRenderer.once('initial-paths', (_event, data) => callback(data)),
});
