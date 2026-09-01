/**
 * Preload script for the IDE renderer window
 * Exposes safe IPC bridges to the renderer
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('freeai', {
  // File System
  listFiles: (opts) => ipcRenderer.invoke('fs:list-files', opts),
  readFile: (opts) => ipcRenderer.invoke('fs:read-file', opts),
  writeFile: (opts) => ipcRenderer.invoke('fs:write-file', opts),
  editFile: (opts) => ipcRenderer.invoke('fs:edit-file', opts),
  deleteFile: (opts) => ipcRenderer.invoke('fs:delete-file', opts),
  executeCmd: (opts) => ipcRenderer.invoke('fs:execute-cmd', opts),

  // Projects & Sessions
  listProjects: () => ipcRenderer.invoke('projects:list'),
  addProject: (opts) => ipcRenderer.invoke('projects:add', opts),
  removeProject: (opts) => ipcRenderer.invoke('projects:remove', opts),
  listSessions: () => ipcRenderer.invoke('sessions:list'),
  addSession: (session) => ipcRenderer.invoke('sessions:add', session),
  updateSession: (updates) => ipcRenderer.invoke('sessions:update', updates),
  removeSession: (opts) => ipcRenderer.invoke('sessions:remove', opts),

  // ChatGPT Control
  newChat: () => ipcRenderer.invoke('chatgpt:new-chat'),
  loadChatgptUrl: (url) => ipcRenderer.invoke('chatgpt:load-url', { url }),
  deleteChatgptSession: (opts) => ipcRenderer.invoke('chatgpt:delete-session', opts),
  injectPrompt: (opts) => ipcRenderer.invoke('chatgpt:inject-prompt', opts),
  startAgent: (opts) => ipcRenderer.invoke('chatgpt:start-agent', opts),
  stopAgent: () => ipcRenderer.invoke('chatgpt:stop-agent'),
  toggleChatView: (visible) => ipcRenderer.invoke('chatgpt:toggle-view', visible),
  getChatUrl: () => ipcRenderer.invoke('chatgpt:get-url'),
  checkAuth: (autoOpen) => ipcRenderer.invoke('chatgpt:check-auth', autoOpen),

  // UI & Window Controls
  pickFolder: () => ipcRenderer.invoke('ui:pick-folder'),
  pickImage: () => ipcRenderer.invoke('ui:pick-image'),
  minimizeWindow: () => ipcRenderer.invoke('ui:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('ui:maximize'),
  closeWindow: () => ipcRenderer.invoke('ui:close'),
  setZoom: (level) => ipcRenderer.invoke('ui:set-zoom', level),
  getZoom: () => ipcRenderer.invoke('ui:get-zoom'),
  getBridgeStatus: () => ipcRenderer.invoke('bridge:get-status'),
  transcribeAudio: (audioBase64) => ipcRenderer.invoke('audio:transcribe', { audioBase64 }),

  // Events from main
  on: (channel, cb) => {
    const allowed = [
      'chatgpt-ready', 'chatgpt-navigated', 'chatgpt-title',
      'chatgpt-auth-state', 'chatgpt-drawer-visibility', 'chatgpt-login-success',
      'agent:event', 'new-chat', 'folder-opened',
      'toggle-sidebar', 'toggle-diff-panel', 'open-settings', 'bridge-status'
    ];
    if (allowed.includes(channel)) {
      ipcRenderer.on(channel, (_, ...args) => cb(...args));
    }
  },
  off: (channel, cb) => ipcRenderer.removeListener(channel, cb),
  send: (channel, data) => ipcRenderer.send(channel, data)
});
