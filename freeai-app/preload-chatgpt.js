/**
 * Preload for the ChatGPT BrowserView
 * Injects the agent communication bridge
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__freeaiBridge', {
  sendEvent: (event) => ipcRenderer.send('agent:event', event)
});
