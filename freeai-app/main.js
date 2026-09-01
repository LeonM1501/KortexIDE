/**
 * Kortex IDE - Electron Main Process
 * Robust persistent project & session management, integrated bridge server on port 4000
 */
const { app, BrowserWindow, BrowserView, ipcMain, dialog, shell, nativeTheme, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { startBridgeServer, setBridgeWorkspace, getBridgePort } = require('./bridge-server');

// ─────────────────────────────────────────────────────────
// Persistence & Data Migration
// ─────────────────────────────────────────────────────────
const DATA_PATH = path.join(os.homedir(), '.kortex-ide');
const LEGACY_DATA_PATH = path.join(os.homedir(), '.freeai-ide');

const PROJECTS_FILE = path.join(DATA_PATH, 'projects.json');
const SESSIONS_FILE = path.join(DATA_PATH, 'sessions.json');

if (!fs.existsSync(DATA_PATH)) {
  fs.mkdirSync(DATA_PATH, { recursive: true });
}

// Auto-migrate legacy data from .freeai-ide if available
if (!fs.existsSync(PROJECTS_FILE) && fs.existsSync(path.join(LEGACY_DATA_PATH, 'projects.json'))) {
  try {
    fs.copyFileSync(path.join(LEGACY_DATA_PATH, 'projects.json'), PROJECTS_FILE);
  } catch {}
}
if (!fs.existsSync(SESSIONS_FILE) && fs.existsSync(path.join(LEGACY_DATA_PATH, 'sessions.json'))) {
  try {
    fs.copyFileSync(path.join(LEGACY_DATA_PATH, 'sessions.json'), SESSIONS_FILE);
  } catch {}
}

function loadJson(file, def) {
  try {
    if (!fs.existsSync(file)) return def;
    const content = fs.readFileSync(file, 'utf8');
    return JSON.parse(content) || def;
  } catch (e) {
    console.error('Error loading JSON from', file, e.message);
    return def;
  }
}

function saveJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving JSON to', file, e.message);
  }
}

let projects = loadJson(PROJECTS_FILE, []);
let sessions = loadJson(SESSIONS_FILE, []);

// ─────────────────────────────────────────────────────────
// Windows & Views
// ─────────────────────────────────────────────────────────
let mainWindow = null;
let chatView = null;
let isChatViewVisible = false;
const pendingAgentTasks = [];  // queued start-agent payloads waiting for page load
let chatViewReady = false;     // true after did-finish-load fired at least once

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 650,
    backgroundColor: '#111111',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#111111',
      symbolColor: '#e0e0e0',
      height: 38
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: false
    },
    show: false,
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    createBackgroundChatView();
  });

  mainWindow.on('resize', () => layoutViews());
  mainWindow.on('maximize', () => setTimeout(layoutViews, 50));
  mainWindow.on('unmaximize', () => setTimeout(layoutViews, 50));

  mainWindow.on('closed', () => { mainWindow = null; });
}

let lastAuthState = null;
let initialAuthChecked = false;

async function checkChatGPTAuth(autoOpenIfLoggedOut = false) {
  if (!chatView || chatView.webContents.isDestroyed()) return { loggedIn: false };
  try {
    const authStatus = await chatView.webContents.executeJavaScript(`
      (function() {
        try {
          const url = window.location.href;
          const isAuthUrl = url.includes('/auth') || url.includes('/login');
          const hasPrompt = Boolean(document.querySelector('#prompt-textarea') || document.querySelector('div[contenteditable="true"]'));
          const hasLoginBtn = Boolean(
            document.querySelector('button[data-testid="login-button"]') ||
            document.querySelector('a[href*="/auth/login"]') ||
            document.querySelector('a[href*="/login"]') ||
            document.querySelector('button[data-testid="signup-button"]')
          );
          const hasUserAvatar = Boolean(
            document.querySelector('img[alt*="User"]') ||
            document.querySelector('button[data-testid="accounts-profile-button"]')
          );
          
          if (hasPrompt || hasUserAvatar) return { loggedIn: true, url };
          if (hasLoginBtn || isAuthUrl) return { loggedIn: false, url };
          
          const bodyText = document.body ? (document.body.innerText || '') : '';
          if (/Log in|Anmelden|Sign up|Registrieren|Welcome to ChatGPT|Loggen Sie sich ein/i.test(bodyText) && !hasPrompt) {
            return { loggedIn: false, url };
          }
          return { loggedIn: hasPrompt, url };
        } catch(e) {
          return { loggedIn: false, error: e.message };
        }
      })()
    `);

    const loggedIn = Boolean(authStatus && authStatus.loggedIn);
    const url = authStatus?.url || chatView.webContents.getURL();

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('chatgpt-auth-state', {
        loggedIn,
        url,
        lastChecked: Date.now()
      });
    }

    if (!loggedIn && autoOpenIfLoggedOut) {
      if (!isChatViewVisible) {
        isChatViewVisible = true;
        layoutViews();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('chatgpt-drawer-visibility', true);
        }
      }
    } else if (loggedIn && lastAuthState === false) {
      // User was logged out and just logged in!
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('chatgpt-login-success', { url });
      }
    }
    lastAuthState = loggedIn;
    return { loggedIn, url };
  } catch (e) {
    return { loggedIn: false, error: e.message };
  }
}

// ─────────────────────────────────────────────────────────
// ChatGPT Background View
// ─────────────────────────────────────────────────────────
function createBackgroundChatView() {
  chatView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'preload-chatgpt.js'),
      contextIsolation: true,
      nodeIntegration: false,
      partition: 'persist:chatgpt',
      spellcheck: false,
      webSecurity: true,
      backgroundThrottling: false
    }
  });

  mainWindow.addBrowserView(chatView);
  layoutViews();

  chatView.webContents.loadURL('https://chatgpt.com');
  chatView.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  chatView.webContents.on('did-start-loading', () => {
    chatViewReady = false;
  });

  chatView.webContents.on('did-finish-load', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('chatgpt-ready', chatView.webContents.getURL());
    }
    injectAgentScript();
    setTimeout(() => {
      checkChatGPTAuth(!initialAuthChecked);
      initialAuthChecked = true;
    }, 1200);
  });

  chatView.webContents.on('did-navigate', (_, url) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('chatgpt-navigated', url);
    }
    // Avoid killing a running agent: only re-inject if agent is idle (see agent-inject.js hot-patch guard)
    setTimeout(async () => {
      try {
        const running = await chatView.webContents.executeJavaScript('Boolean(window.__kortexAgentState && window.__kortexAgentState.running)').catch(()=>false);
        if (!running) await injectAgentScript();
      } catch { await injectAgentScript().catch(()=>{}); }
    }, 1500);
    setTimeout(() => checkChatGPTAuth(false), 2000);
  });

  chatView.webContents.on('did-navigate-in-page', (_, url) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('chatgpt-navigated', url);
    }
    setTimeout(async () => {
      try {
        const running = await chatView.webContents.executeJavaScript('Boolean(window.__kortexAgentState && window.__kortexAgentState.running)').catch(()=>false);
        if (!running) await injectAgentScript();
      } catch { await injectAgentScript().catch(()=>{}); }
    }, 1000);
    setTimeout(() => checkChatGPTAuth(false), 1500);
  });

  chatView.webContents.on('page-title-updated', (_, title) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('chatgpt-title', title);
    }
  });
}

function layoutViews() {
  if (!mainWindow || !chatView) return;
  if (isChatViewVisible) {
    const [w, h] = mainWindow.getContentSize();
    const modalW = Math.min(w - 100, 1100);
    const modalH = Math.min(h - 100, 750);
    chatView.setBounds({
      x: Math.floor((w - modalW) / 2),
      y: Math.floor((h - modalH) / 2) + 20,
      width: modalW,
      height: modalH
    });
  } else {
    chatView.setBounds({ x: -6000, y: -6000, width: 1280, height: 800 });
  }
}

function injectAgentScript() {
  if (!chatView || chatView.webContents.isDestroyed()) return Promise.resolve(false);
  const agentScript = fs.readFileSync(path.join(__dirname, 'agent', 'agent-inject.js'), 'utf8');
  return chatView.webContents.executeJavaScript(agentScript)
    .then(() => {
      chatViewReady = true;
      // Fire all queued tasks in order. A single overwritten pending promise
      // used to leave start-agent callers hanging during navigation.
      while (pendingAgentTasks.length) {
        const { payload, resolve } = pendingAgentTasks.shift();
        chatView.webContents
          .executeJavaScript(`Boolean(window.__freeaiStartAgent) && window.__freeaiStartAgent(${payload})`)
          .then((started) => resolve(started !== false))
          .catch(() => resolve(false));
      }
      return true;
    })
    .catch(err => {
      console.error('Agent inject error:', err.message);
      return false;
    });
}

// ─────────────────────────────────────────────────────────
// IPC: File System Operations
// ─────────────────────────────────────────────────────────
ipcMain.handle('fs:list-files', async (_, { workspacePath, maxDepth = 6 }) => {
  try {
    const result = [];
    const IGNORED_DIRS = new Set([
      '.git', 'node_modules', '.DS_Store', '__pycache__', 'dist', 'build', '.next',
      'dist-installer', 'release', 'win-unpacked', 'win-unpacked.tmp', 'locales',
      'Bilder', 'bilder', '.gemini', '.agents', '.vscode', '.idea'
    ]);
    const IGNORED_EXTS = new Set([
      'exe', 'zip', 'asar', 'pak', 'dll', 'tmp', 'dat', 'bin', 'pdb', 'log', '7z', 'rar', 'tar', 'gz'
    ]);

    function walk(dir, depth, relBase = '') {
      if (depth > maxDepth) return;
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (IGNORED_DIRS.has(entry.name) || entry.name.endsWith('.tmp') || entry.name.startsWith('.')) continue;
          const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
          const absPath = path.join(dir, entry.name);
          result.push({ type: 'directory', path: relPath, name: entry.name });
          walk(absPath, depth + 1, relPath);
        } else {
          const ext = (path.extname(entry.name) || '').toLowerCase().replace('.', '');
          if (IGNORED_EXTS.has(ext) || entry.name.startsWith('.')) continue;
          const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
          const absPath = path.join(dir, entry.name);
          const stat = fs.statSync(absPath);
          result.push({ type: 'file', path: relPath, name: entry.name, size: stat.size });
        }
      }
    }
    if (!workspacePath || !fs.existsSync(workspacePath)) {
      return { success: true, files: [], totalFiles: 0, totalDirectories: 0 };
    }
    walk(workspacePath, 0);
    return {
      success: true,
      files: result,
      totalFiles: result.filter(f => f.type === 'file').length,
      totalDirectories: result.filter(f => f.type === 'directory').length
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('fs:read-file', async (_, { workspacePath, filePath }) => {
  try {
    const absPath = path.join(workspacePath, filePath);
    if (!fs.existsSync(absPath)) return { success: false, error: 'File not found: ' + filePath };
    const ext = (path.extname(filePath) || '').toLowerCase().replace('.', '');
    const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(ext);
    if (isImage) {
      const buffer = fs.readFileSync(absPath);
      const mime = ext === 'svg' ? 'image/svg+xml' : (ext === 'ico' ? 'image/x-icon' : `image/${ext === 'jpg' ? 'jpeg' : ext}`);
      const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
      const stat = fs.statSync(absPath);
      return { success: true, path: filePath, isImage: true, ext, dataUrl, size: stat.size, name: path.basename(filePath) };
    }
    const content = fs.readFileSync(absPath, 'utf8');
    const lines = content.split('\n');
    return { success: true, path: filePath, content, totalLines: lines.length, isImage: false, name: path.basename(filePath) };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('fs:write-file', async (_, { workspacePath, filePath, content }) => {
  try {
    const absPath = path.join(workspacePath, filePath);
    let oldContent = null;
    if (fs.existsSync(absPath)) {
      oldContent = fs.readFileSync(absPath, 'utf8');
    }
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, content, 'utf8');
    const stat = fs.statSync(absPath);
    return {
      success: true,
      path: filePath,
      size: stat.size,
      oldContent,
      newContent: content,
      isNew: oldContent === null,
      message: `File written: ${filePath} (${stat.size} bytes)`
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('fs:edit-file', async (_, { workspacePath, filePath, targetContent, replacementContent, allowMultiple }) => {
  try {
    const absPath = path.join(workspacePath, filePath);
    if (!fs.existsSync(absPath)) return { success: false, error: 'File not found: ' + filePath };
    const oldContent = fs.readFileSync(absPath, 'utf8');
    if (!oldContent.includes(targetContent)) {
      return { success: false, error: `targetContent not found in ${filePath}` };
    }
    const newContent = allowMultiple
      ? oldContent.split(targetContent).join(replacementContent)
      : oldContent.replace(targetContent, replacementContent);
    fs.writeFileSync(absPath, newContent, 'utf8');
    return { success: true, path: filePath, oldContent, newContent, message: `File edited: ${filePath}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('fs:delete-file', async (_, { workspacePath, filePath }) => {
  try {
    const absPath = path.join(workspacePath, filePath);
    if (!fs.existsSync(absPath)) return { success: false, error: 'Not found: ' + filePath };
    let oldContent = null;
    try { oldContent = fs.readFileSync(absPath, 'utf8'); } catch {}
    const stat = fs.statSync(absPath);
    if (stat.isDirectory()) {
      fs.rmSync(absPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(absPath);
    }
    return { success: true, path: filePath, oldContent, message: `Deleted: ${filePath}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('fs:execute-cmd', async (_, { workspacePath, command, timeoutMs = 120000 }) => {
  return new Promise((resolve) => {
    const start = Date.now();
    const proc = spawn('cmd.exe', ['/c', command], {
      cwd: workspacePath || os.homedir(),
      env: { ...process.env },
      shell: false
    });
    let stdout = '', stderr = '';
    let isResolved = false;
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      if (isResolved) return;
      isResolved = true;
      try { proc.kill(); } catch {}
      resolve({ success: false, exitCode: -1, stdout, stderr: 'Timeout', executionTimeMs: timeoutMs });
    }, timeoutMs);

    proc.on('close', (code) => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timer);
      resolve({
        success: code === 0,
        exitCode: code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        executionTimeMs: Date.now() - start
      });
    });
    proc.on('error', err => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timer);
      resolve({ success: false, exitCode: 1, stdout: '', stderr: err.message, executionTimeMs: 0 });
    });
  });
});

// ─────────────────────────────────────────────────────────
// IPC: Projects & Sessions (Persistent)
// ─────────────────────────────────────────────────────────
ipcMain.handle('projects:list', () => {
  projects = loadJson(PROJECTS_FILE, []);
  return projects;
});

ipcMain.handle('projects:add', (_, { name, path: projectPath }) => {
  projects = loadJson(PROJECTS_FILE, []);
  const existing = projects.find(p => p.path === projectPath);
  if (existing) {
    setBridgeWorkspace(projectPath);
    return existing;
  }
  const project = {
    id: Date.now().toString(),
    name: name || path.basename(projectPath),
    path: projectPath,
    createdAt: new Date().toISOString()
  };
  projects.unshift(project);
  saveJson(PROJECTS_FILE, projects);
  setBridgeWorkspace(projectPath);
  return project;
});

ipcMain.handle('projects:remove', (_, { id }) => {
  projects = loadJson(PROJECTS_FILE, []).filter(p => p.id !== id);
  saveJson(PROJECTS_FILE, projects);
  return true;
});

ipcMain.handle('sessions:list', () => {
  sessions = loadJson(SESSIONS_FILE, []);
  return sessions;
});

ipcMain.handle('sessions:add', (_, session) => {
  sessions = loadJson(SESSIONS_FILE, []);
  const newSession = {
    ...session,
    id: session.id || Date.now().toString(),
    createdAt: session.createdAt || new Date().toISOString()
  };
  sessions.unshift(newSession);
  if (sessions.length > 500) sessions = sessions.slice(0, 500);
  saveJson(SESSIONS_FILE, sessions);
  return newSession;
});

ipcMain.handle('sessions:update', (_, { id, ...updates }) => {
  sessions = loadJson(SESSIONS_FILE, []);
  const idx = sessions.findIndex(s => s.id === id);
  if (idx !== -1) {
    sessions[idx] = { ...sessions[idx], ...updates };
  } else {
    sessions.unshift({ id, ...updates });
  }
  saveJson(SESSIONS_FILE, sessions);
  return sessions[idx] || null;
});

ipcMain.handle('sessions:remove', (_, { id }) => {
  sessions = loadJson(SESSIONS_FILE, []).filter(s => s.id !== id);
  saveJson(SESSIONS_FILE, sessions);
  return true;
});

// ─────────────────────────────────────────────────────────
// IPC: ChatGPT Control & Backend Bridge
// ─────────────────────────────────────────────────────────
ipcMain.handle('chatgpt:new-chat', async () => {
  if (!chatView || chatView.webContents.isDestroyed()) return false;
  try {
    const currentUrl = chatView.webContents.getURL();
    if (currentUrl.includes('chatgpt.com')) {
      const clicked = await chatView.webContents.executeJavaScript(`
        (function() {
          try {
            const newChatBtn = document.querySelector('a[href="/"], a[data-testid="create-new-chat-button"], button[aria-label*="New chat"], button[aria-label*="Neuer Chat"], a[aria-label*="New chat"], a[aria-label*="Neuer Chat"]');
            if (newChatBtn) {
              newChatBtn.click();
              return true;
            }
            if (window.location.pathname !== '/') {
              window.history.pushState({}, '', '/');
              window.dispatchEvent(new PopStateEvent('popstate'));
              return true;
            }
            return false;
          } catch(e) {
            return false;
          }
        })()
      `).catch(() => false);

      if (clicked) {
        setTimeout(() => injectAgentScript().catch(() => {}), 600);
        return true;
      }
    }
  } catch (e) {}

  chatViewReady = false;
  chatView.webContents.loadURL('https://chatgpt.com/').catch(() => {});
  return true;
});

ipcMain.handle('chatgpt:load-url', async (_, { url }) => {
  if (!chatView || chatView.webContents.isDestroyed()) return false;
  const currentUrl = chatView.webContents.getURL();
  const targetUrl = (url && url.startsWith('http')) ? url : 'https://chatgpt.com/';
  if (currentUrl !== targetUrl) {
    chatViewReady = false;
    await chatView.webContents.loadURL(targetUrl).catch(() => {});
  }
  return true;
});

ipcMain.handle('chatgpt:delete-session', async (_, { chatgptUrl }) => {
  if (!chatView || chatView.webContents.isDestroyed()) return false;
  try {
    const currentUrl = chatView.webContents.getURL();
    if (chatgptUrl && currentUrl.includes(chatgptUrl)) {
      chatViewReady = false;
      chatView.webContents.loadURL('https://chatgpt.com/').catch(() => {});
    }
    if (chatgptUrl) {
      const match = chatgptUrl.match(/\/c\/([a-zA-Z0-9-]+)/);
      const convId = match ? match[1] : '';
      await chatView.webContents.executeJavaScript(`
        (function() {
          try {
            const link = document.querySelector('a[href*="${convId || chatgptUrl}"]');
            if (link) {
              const container = link.closest('li') || link.parentElement;
              const menuBtn = container ? (container.querySelector('button[aria-haspopup="menu"]') || container.querySelector('button')) : null;
              if (menuBtn) {
                menuBtn.click();
                setTimeout(() => {
                  const deleteBtn = Array.from(document.querySelectorAll('div[role="menuitem"], button')).find(el => /löschen|delete/i.test(el.innerText || ''));
                  if (deleteBtn) {
                    deleteBtn.click();
                    setTimeout(() => {
                      const confirmBtn = Array.from(document.querySelectorAll('button')).find(el => /löschen|delete|confirm/i.test(el.innerText || ''));
                      if (confirmBtn) confirmBtn.click();
                    }, 300);
                  }
                }, 300);
              }
            }
          } catch(e) {}
        })();
      `).catch(() => {});
    }
  } catch (e) {
    console.warn('Error deleting chatgpt session:', e.message);
  }
  return true;
});

ipcMain.handle('chatgpt:inject-prompt', async (_, { prompt }) => {
  if (!chatView || chatView.webContents.isDestroyed()) return false;
  const escaped = JSON.stringify(prompt);
  await chatView.webContents.executeJavaScript(`window.__freeaiInjectPrompt && window.__freeaiInjectPrompt(${escaped})`).catch(() => {});
  return true;
});

ipcMain.handle('chatgpt:start-agent', async (_, { task, workspace, projectSnapshot }) => {
  if (!chatView || chatView.webContents.isDestroyed()) return false;
  setBridgeWorkspace(workspace);
  const payload = JSON.stringify({ task, workspace, projectSnapshot });

  // If page is currently in full reload/loadURL, queue the payload for when did-finish-load triggers injectAgentScript
  if (!chatViewReady && chatView.webContents.isLoading()) {
    const queuedPromise = new Promise((resolve) => {
      const pending = { payload, resolve };
      pendingAgentTasks.push(pending);
      setTimeout(() => {
        const index = pendingAgentTasks.indexOf(pending);
        if (index !== -1) {
          pendingAgentTasks.splice(index, 1);
          resolve(false);
        }
      }, 25000);
    });
    // Don't just hang if did-finish-load fired without clearing
    setTimeout(async () => {
      if (pendingAgentTasks.some(p => p.payload === payload)) {
        await injectAgentScript().catch(() => {});
      }
    }, 2000);
    return await queuedPromise;
  }

  // Resilient retry loop (up to 15s) ensuring script is injected and ChatGPT DOM is ready
  const maxWaitMs = 15000;
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    try {
      if (chatView.webContents.isLoading()) {
        await new Promise(r => setTimeout(r, 400));
        continue;
      }

      let ready = await chatView.webContents.executeJavaScript('Boolean(window.__freeaiStartAgent)').catch(() => false);
      if (!ready) {
        await injectAgentScript().catch(() => false);
        ready = await chatView.webContents.executeJavaScript('Boolean(window.__freeaiStartAgent)').catch(() => false);
      }

      if (ready) {
        const started = await chatView.webContents.executeJavaScript(`window.__freeaiStartAgent(${payload})`).catch(() => false);
        return started !== false;
      }
    } catch (e) {
      console.warn('startAgent retry error:', e.message);
    }
    await new Promise(r => setTimeout(r, 400));
  }

  // Final fallback injection & start
  try {
    await injectAgentScript().catch(() => false);
    const started = await chatView.webContents.executeJavaScript(`Boolean(window.__freeaiStartAgent) && window.__freeaiStartAgent(${payload})`).catch(() => false);
    return started !== false;
  } catch (e) {
    return false;
  }
});

ipcMain.handle('chatgpt:stop-agent', async () => {
  if (!chatView) return false;
  while (pendingAgentTasks.length) pendingAgentTasks.shift().resolve(false);
  await chatView.webContents.executeJavaScript(`window.__freeaiStopAgent && window.__freeaiStopAgent()`);
  return true;
});

ipcMain.handle('chatgpt:toggle-view', (_, visible) => {
  isChatViewVisible = typeof visible === 'boolean' ? visible : !isChatViewVisible;
  layoutViews();
  return isChatViewVisible;
});

ipcMain.handle('chatgpt:get-url', () => chatView ? chatView.webContents.getURL() : null);

ipcMain.handle('chatgpt:check-auth', async (_, autoOpen = false) => {
  return await checkChatGPTAuth(autoOpen);
});

ipcMain.handle('ui:pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Projektordner auswählen'
  });
  if (result.canceled || !result.filePaths.length) return null;
  setBridgeWorkspace(result.filePaths[0]);
  return result.filePaths[0];
});

ipcMain.handle('ui:pick-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: 'Bild auswählen',
    filters: [
      { name: 'Bilder', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'] }
    ]
  });
  if (result.canceled || !result.filePaths.length) return null;
  const filePath = result.filePaths[0];
  const stats = fs.statSync(filePath);
  const ext = path.extname(filePath).replace('.', '').toLowerCase();
  const buffer = fs.readFileSync(filePath);
  const base64 = `data:image/${ext === 'svg' ? 'svg+xml' : ext};base64,${buffer.toString('base64')}`;
  return {
    filePath,
    name: path.basename(filePath),
    size: stats.size,
    ext,
    dataUrl: base64
  };
});

ipcMain.handle('ui:minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
  return true;
});

ipcMain.handle('ui:maximize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
  return true;
});

ipcMain.handle('ui:close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
  return true;
});

ipcMain.handle('ui:set-zoom', (_, level) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.setZoomLevel(level);
  }
  return true;
});

ipcMain.handle('ui:get-zoom', () => {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents.getZoomLevel() : 0;
});

ipcMain.handle('bridge:get-status', () => ({
  online: Boolean(getBridgePort()),
  port: getBridgePort()
}));

// ─────────────────────────────────────────────────────────
// Agent Event Routing
// ─────────────────────────────────────────────────────────
ipcMain.on('agent:event', (_, event) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('agent:event', event);
  }
});

ipcMain.on('chatgpt:tool-result', async (_, { result }) => {
  if (!chatView || chatView.webContents.isDestroyed()) return;
  try {
    // Keep objects as objects. Turning them into a string here and then
    // serializing them again in the agent produced escaped JSON such as
    // {\"success\":true}, which made the next model step unreliable.
    const jsValue = typeof result === 'string' ? result : (result ?? null);
    await chatView.webContents.executeJavaScript(
      `if (window.__freeaiToolResult) { window.__freeaiToolResult(${JSON.stringify(jsValue)}); }`
    );
  } catch (e) {
    console.error('Tool result inject error:', e.message);
  }
});

ipcMain.handle('audio:transcribe', async (_, { audioBase64 }) => {
  try {
    if (!audioBase64) return { success: false, error: 'Keine Audiodaten übergeben' };
    const buffer = Buffer.from(audioBase64, 'base64');
    const tempWavPath = path.join(os.tmpdir(), `kortex-voice-${Date.now()}.wav`);
    fs.writeFileSync(tempWavPath, buffer);

    const psScript = `
      Add-Type -AssemblyName System.Speech;
      $engine = $null;
      try {
        $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine('MS-1031-80-DESK');
      } catch {
        try {
          $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine('MS-1033-80-DESK');
        } catch {
          $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine;
        }
      }
      $grammar = New-Object System.Speech.Recognition.DictationGrammar;
      $engine.LoadGrammar($grammar);
      $engine.SetInputToWaveFile('${tempWavPath.replace(/\\/g, '\\\\')}');
      $res = $engine.Recognize();
      if ($res -and $res.Text) { Write-Output $res.Text }
    `;

    return new Promise((resolve) => {
      const child = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', psScript]);
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.on('close', () => {
        try { if (fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath); } catch {}
        const text = stdout.trim();
        if (text) {
          resolve({ success: true, text });
        } else {
          resolve({ success: false, error: 'Kein Text erkannt' });
        }
      });
    });
  } catch (e) {
    console.error('Audio transcription error:', e);
    return { success: false, error: e.message };
  }
});

// ─────────────────────────────────────────────────────────
// App Lifecycle
// ─────────────────────────────────────────────────────────
app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark';

  // Grant microphone & media permissions
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') return callback(true);
    callback(true);
  });
  session.defaultSession.setPermissionCheckHandler(() => true);

  // Start the integrated bridge on the first free port from 4000 onward.
  const initialWs = projects.length > 0 ? projects[0].path : process.cwd();
  startBridgeServer(initialWs, (newWs, port) => {
    console.log('⚡ Bridge Server workspace set to:', newWs);
    if (mainWindow && !mainWindow.isDestroyed() && port) {
      mainWindow.webContents.send('bridge-status', { online: true, port });
    }
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
});
