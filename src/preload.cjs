const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getAvailableShips: () => ipcRenderer.invoke('get-available-ships'),
  getShipMetadata: () => ipcRenderer.invoke('get-ship-metadata'),
  refreshShipMetadata: () => ipcRenderer.invoke('refresh-ship-metadata'),
  refreshShipCatalogAndMetadata: () => ipcRenderer.invoke('refresh-ship-catalog-and-metadata'),
  onSettingsUpdated: (callback) => ipcRenderer.on('settings-updated', (event, settings) => callback(settings)),
  onShipMetadataUpdated: (callback) => ipcRenderer.on('ship-metadata-updated', (event, metadata) => callback(metadata)),
  minimizeSettings: () => ipcRenderer.invoke('minimize-settings'),
  closeSettings: () => ipcRenderer.invoke('close-settings'),
  openSettings: () => ipcRenderer.invoke('open-settings'),
});
