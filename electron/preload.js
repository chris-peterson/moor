const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('moor', {
  zoomBy: (delta) => webFrame.setZoomLevel(webFrame.getZoomLevel() + delta),
  zoomReset: () => webFrame.setZoomLevel(0),
  readFile: (filePath, asText = false) => ipcRenderer.invoke('read-file', { filePath, asText }),
  readFileAsDataUrl: (filePath) => ipcRenderer.invoke('read-file-as-data-url', { filePath }),
  compareDirectories: (leftPath, rightPath) => ipcRenderer.invoke('compare-directories', { leftPath, rightPath }),
  onInitialPaths: (callback) => ipcRenderer.once('initial-paths', (_event, data) => callback(data)),
  openInDefaultApp: (filePath) => ipcRenderer.invoke('open-in-default-app', { filePath }),
  onCloseRequested: (callback) => ipcRenderer.on('close-requested', () => callback()),
  forceClose: (payload) => ipcRenderer.send('force-close', payload),
  getInitialContext: () => ipcRenderer.invoke('get-initial-context'),
  writeOutput: (payload) => ipcRenderer.send('write-output', payload),
});
