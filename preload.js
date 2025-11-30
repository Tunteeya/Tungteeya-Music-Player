const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
  // optional: listen for messages from main if you add them later
  on: (channel, fn) => {
    // whitelist channels if you extend later
    const valid = [];
    if (!valid.includes(channel)) return;
    ipcRenderer.on(channel, (event, ...args) => fn(...args));
  }
});
