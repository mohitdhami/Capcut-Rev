const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return '';
    }
  },
  selectMedia: () => ipcRenderer.invoke('media:select'),
  probeFile: (p) => ipcRenderer.invoke('media:probe', p),
  mediaUrl: (p) => ipcRenderer.invoke('media:url', p),
  saveProject: (json) => ipcRenderer.invoke('project:save', json),
  saveProjectToPath: (filePath, json) => ipcRenderer.invoke('project:save-as-path', { filePath, json }),
  openProject: () => ipcRenderer.invoke('project:open'),
  chooseExportPath: (name) => ipcRenderer.invoke('export:choose', name),
  startExport: (job) => ipcRenderer.invoke('export:start', job),
  cancelExport: (id) => ipcRenderer.send('export:cancel', id),
  onExportProgress: (cb) => {
    const listener = (_e, data) => cb(data);
    ipcRenderer.on('export:progress', listener);
    return () => ipcRenderer.removeListener('export:progress', listener);
  },
  writeTempFile: (name, dataBase64) => ipcRenderer.invoke('temp:write', { name, dataBase64 }),
  revealInFolder: (p) => ipcRenderer.invoke('shell:reveal', p),
  getFonts: () => ipcRenderer.invoke('app:fonts'),
  getPaths: () => ipcRenderer.invoke('app:paths'),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
  onMenuAction: (cb) => {
    const listener = (_e, action) => cb(action);
    ipcRenderer.on('menu:action', listener);
    return () => ipcRenderer.removeListener('menu:action', listener);
  },
  platform: process.platform,
});
