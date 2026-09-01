/**
 * Kortex IDE — Native UI Logic & Universal Persistence v5
 * Supports Pinning, Renaming, Deleting chats and Dedicated Action Cards for File/Folder Inspecting
 */

// ── Universal Bridge & API Adapter ────────────────────
if (!window.freeai) {
  const BRIDGE_URL = 'http://127.0.0.1:4000';
  const listeners = {};

  window.freeai = {
    listFiles: async (opts) => {
      try {
        const res = await fetch(`${BRIDGE_URL}/api/list_files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(opts)
        });
        return await res.json();
      } catch (e) { return { success: false, error: e.message }; }
    },
    readFile: async (opts) => {
      try {
        const res = await fetch(`${BRIDGE_URL}/api/read_file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(opts)
        });
        return await res.json();
      } catch (e) { return { success: false, error: e.message }; }
    },
    writeFile: async (opts) => {
      try {
        const res = await fetch(`${BRIDGE_URL}/api/write_file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(opts)
        });
        return await res.json();
      } catch (e) { return { success: false, error: e.message }; }
    },
    editFile: async (opts) => {
      try {
        const res = await fetch(`${BRIDGE_URL}/api/edit_file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(opts)
        });
        return await res.json();
      } catch (e) { return { success: false, error: e.message }; }
    },
    deleteFile: async (opts) => {
      try {
        const res = await fetch(`${BRIDGE_URL}/api/delete_file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(opts)
        });
        return await res.json();
      } catch (e) { return { success: false, error: e.message }; }
    },
    executeCmd: async (opts) => {
      try {
        const res = await fetch(`${BRIDGE_URL}/api/run_command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(opts)
        });
        return await res.json();
      } catch (e) { return { success: false, error: e.message }; }
    },
    listProjects: async () => {
      try {
        const res = await fetch(`${BRIDGE_URL}/api/read_file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: 'C:/Users/meier/.kortex-ide/projects.json' })
        });
        const data = await res.json();
        return data.success && data.content ? JSON.parse(data.content) : [];
      } catch { return []; }
    },
    listSessions: async () => {
      try {
        const res = await fetch(`${BRIDGE_URL}/api/read_file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: 'C:/Users/meier/.kortex-ide/sessions.json' })
        });
        const data = await res.json();
        return data.success && data.content ? JSON.parse(data.content) : [];
      } catch { return []; }
    },
    addProject: async (opts) => {
      const list = await window.freeai.listProjects();
      const existing = list.find(p => p.path === opts.path);
      if (existing) return existing;
      const proj = { id: Date.now().toString(), name: opts.path.split(/[/\\]/).pop(), path: opts.path, createdAt: new Date().toISOString() };
      list.unshift(proj);
      await fetch(`${BRIDGE_URL}/api/write_file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'C:/Users/meier/.kortex-ide/projects.json', content: JSON.stringify(list, null, 2) })
      });
      return proj;
    },
    addSession: async (session) => {
      const list = await window.freeai.listSessions();
      const newSess = { ...session, id: session.id || Date.now().toString(), createdAt: new Date().toISOString() };
      list.unshift(newSess);
      await fetch(`${BRIDGE_URL}/api/write_file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'C:/Users/meier/.kortex-ide/sessions.json', content: JSON.stringify(list, null, 2) })
      });
      return newSess;
    },
    updateSession: async (updates) => {
      const list = await window.freeai.listSessions();
      const idx = list.findIndex(s => s.id === updates.id);
      if (idx !== -1) list[idx] = { ...list[idx], ...updates };
      else list.unshift(updates);
      await fetch(`${BRIDGE_URL}/api/write_file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'C:/Users/meier/.kortex-ide/sessions.json', content: JSON.stringify(list, null, 2) })
      });
      return list[idx] || null;
    },
    removeSession: async (opts) => {
      let list = await window.freeai.listSessions();
      list = list.filter(s => s.id !== opts.id);
      await fetch(`${BRIDGE_URL}/api/write_file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'C:/Users/meier/.kortex-ide/sessions.json', content: JSON.stringify(list, null, 2) })
      });
      return true;
    },
    pickFolder: async () => {
      try {
        const res = await fetch(`${BRIDGE_URL}/api/pick-folder`, { method: 'POST' });
        const data = await res.json();
        return data.success ? data.workspace : null;
      } catch { return null; }
    },
    pickImage: async () => null,
    minimizeWindow: () => {},
    maximizeWindow: () => {},
    closeWindow: () => {},
    setZoom: (level) => { document.body.style.zoom = 1 + (level * 0.1); },
    getZoom: () => 0,
    newChat: () => {},
    startAgent: () => {},
    stopAgent: () => {},
    toggleChatView: () => false,
    on: (evt, cb) => {
      if (!listeners[evt]) listeners[evt] = [];
      listeners[evt].push(cb);
    },
    off: (evt, cb) => {
      if (!listeners[evt]) return;
      listeners[evt] = listeners[evt].filter(f => f !== cb);
    },
    send: () => {}
  };
}

// ── State ─────────────────────────────────────────────
const APP_STATE = {
  projects: [],
  sessions: [],
  activeProject: null,
  activeSession: null,
  workspace: '',
  isAgentRunning: false,
  agentStartTime: 0,
  agentTimerInterval: null,
  currentAssistantEl: null,
  currentAssistantTurn: null,
  activeRightTab: 'diff',
  rightPanelOpen: false,
  currentThoughtBlock: null,
  currentQuestionResolve: null,
  contextMenuTargetSession: null,
  appMode: 'kortex',
  openEditors: [],
  activeEditorPath: null,
  fileTreeData: [],
  expandedFolders: new Set(),
  terminalHistory: [],
  terminalHistoryIdx: -1,
  chatgptAuthStatus: { loggedIn: false }
};

let sessionSaveTimer = null;
let pendingSessionSnapshot = null;
let pendingSessionResolvers = [];

// ── Image Attachment State ────────────────────────────
let ATTACHED_IMAGES = [];

// ── Speech-to-Text State ──────────────────────────────
let SPEECH_RECOGNITION = null;
let IS_RECORDING = false;
let ACTIVE_MIC_INPUT = null;
let MIC_BASE_TEXT = '';

// ── Modern Robust Markdown Parser ─────────────────────
function parseMarkdown(md) {
  if (!md) return '';

  // 1. Strip trailing or dangling JSON blocks and JSON keywords
  let text = md
    .replace(/```(?:json|tool_call)?\s*\{[\s\S]*?\}\s*```/gi, '')
    .replace(/\{[\s\r\n]*"(?:tool|action|name)"\s*:[\s\S]*?\}\s*$/gi, '')
    .replace(/(?:^|\n|\s+)(?:JSON|tool_call)\s*$/gi, '')
    .trim();

  // 2. Escape HTML entities
  text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 3. Fenced code blocks
  const codeBlocks = [];
  text = text.replace(/```([a-z0-9_+-]*)\n([\s\S]*?)```/gim, (_, lang, code) => {
    const placeholder = `%%CODE_BLOCK_${codeBlocks.length}%%`;
    const l = lang ? lang.toLowerCase() : 'code';
    codeBlocks.push(
      `<div class="code-block-wrapper">` +
        `<div class="code-block-header">` +
          `<span class="code-block-lang">${l}</span>` +
          `<button class="code-copy-btn" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(code.trim())}'));this.innerText='Kopiert!';setTimeout(()=>this.innerText='Kopieren',2000)">Kopieren</button>` +
        `</div>` +
        `<pre><code>${code.trim()}</code></pre>` +
      `</div>`
    );
    return placeholder;
  });

  // 4. Inline code
  text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // 4b. Safe external links and horizontal separators.
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>');
  text = text.replace(/^\s*(?:\*\s*){3,}$/gim, '<hr class="md-rule">');

  // 5. Headings
  text = text.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // 6. Emphasis
  text = text.replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  text = text.replace(/\*(.*?)\*/gim, '<em>$1</em>');
  text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  text = text.replace(/_([^_]+)_/g, '<em>$1</em>');

  // 7. Blockquotes
  text = text.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

  // 8. Lists (Bullet & Numbered)
  const lines = text.split('\n');
  const outLines = [];
  let inUl = false;
  let inOl = false;
  let inTable = false;
  let tableHeaderDone = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    let line = lines[lineIndex];
    const nextLine = lines[lineIndex + 1] || '';
    const isTableRow = /^\s*\|?.+\|.+\|?\s*$/.test(line);
    const isTableSeparator = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(nextLine);
    if (!inTable && isTableRow && isTableSeparator) {
      if (inUl) { outLines.push('</ul>'); inUl = false; }
      if (inOl) { outLines.push('</ol>'); inOl = false; }
      inTable = true;
      tableHeaderDone = false;
      const cells = line.replace(/^\s*\|?|\|?\s*$/g, '').split('|').map(cell => cell.trim());
      outLines.push('<table class="md-table"><thead><tr>' + cells.map(cell => `<th>${cell}</th>`).join('') + '</tr></thead><tbody>');
      lineIndex++;
      tableHeaderDone = true;
      continue;
    }
    if (inTable && isTableRow) {
      const cells = line.replace(/^\s*\|?|\|?\s*$/g, '').split('|').map(cell => cell.trim());
      outLines.push('<tr>' + cells.map(cell => `<td>${cell}</td>`).join('') + '</tr>');
      continue;
    }
    if (inTable) {
      outLines.push('</tbody></table>');
      inTable = false;
    }
    const ulMatch = line.match(/^\s*[-*+]\s+(.*)$/);
    const olMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);

    if (ulMatch) {
      if (inOl) { outLines.push('</ol>'); inOl = false; }
      if (!inUl) { outLines.push('<ul class="md-list">'); inUl = true; }
      outLines.push(`<li>${ulMatch[1]}</li>`);
    } else if (olMatch) {
      if (inUl) { outLines.push('</ul>'); inUl = false; }
      if (!inOl) { outLines.push('<ol class="md-list">'); inOl = true; }
      outLines.push(`<li><span class="list-num">${olMatch[1]}.</span> ${olMatch[2]}</li>`);
    } else {
      if (inUl) { outLines.push('</ul>'); inUl = false; }
      if (inOl) { outLines.push('</ol>'); inOl = false; }
      outLines.push(line);
    }
  }
  if (inUl) outLines.push('</ul>');
  if (inOl) outLines.push('</ol>');
  if (inTable) outLines.push('</tbody></table>');

  text = outLines.join('\n');

  // 9. Paragraphs (split by double newlines, except around block tags)
  const blocks = text.split(/\n\n+/);
  const formattedBlocks = blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (/^(<(?:h[1-6]|ul|ol|li|blockquote|div|pre|table|hr)|%%CODE_BLOCK_)/i.test(trimmed)) {
      return trimmed;
    }
    return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`;
  });

  let result = formattedBlocks.join('\n');

  // 10. Restore code blocks
  codeBlocks.forEach((cb, idx) => {
    result = result.replace(`%%CODE_BLOCK_${idx}%%`, cb);
  });

  return result;
}

// ── Diff Engine (LCS-based Unified Diff) ───────────────
function computeDiff(oldContent, newContent) {
  const oldLines = oldContent ? oldContent.split('\n') : [];
  const newLines = newContent ? newContent.split('\n') : [];

  if (!oldContent && !newContent) return { lines: [], additions: 0, deletions: 0 };
  if (!oldContent) {
    return {
      lines: newLines.map((l, i) => ({ type: 'add', content: l, lineNum: i + 1 })),
      additions: newLines.length,
      deletions: 0
    };
  }
  if (!newContent) {
    return {
      lines: oldLines.map((l, i) => ({ type: 'del', content: l, lineNum: i + 1 })),
      additions: 0,
      deletions: oldLines.length
    };
  }

  const N = oldLines.length;
  const M = newLines.length;
  const dp = new Int32Array((N + 1) * (M + 1));
  const idx = (r, c) => r * (M + 1) + c;

  for (let i = 1; i <= N; i++) {
    for (let j = 1; j <= M; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[idx(i, j)] = dp[idx(i - 1, j - 1)] + 1;
      } else {
        const up = dp[idx(i - 1, j)];
        const left = dp[idx(i, j - 1)];
        dp[idx(i, j)] = up >= left ? up : left;
      }
    }
  }

  const rawDiff = [];
  let i = N, j = M;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      rawDiff.push({ type: 'ctx', content: oldLines[i - 1], oldNum: i, newNum: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[idx(i, j - 1)] >= dp[idx(i - 1, j)])) {
      rawDiff.push({ type: 'add', content: newLines[j - 1], newNum: j });
      j--;
    } else if (i > 0 && (j === 0 || dp[idx(i, j - 1)] < dp[idx(i - 1, j)])) {
      rawDiff.push({ type: 'del', content: oldLines[i - 1], oldNum: i });
      i--;
    }
  }
  rawDiff.reverse();

  let additions = 0, deletions = 0;
  rawDiff.forEach(d => {
    if (d.type === 'add') additions++;
    else if (d.type === 'del') deletions++;
  });

  const changeIndices = [];
  rawDiff.forEach((d, k) => {
    if (d.type === 'add' || d.type === 'del') changeIndices.push(k);
  });

  if (changeIndices.length === 0) {
    return { lines: [], additions: 0, deletions: 0 };
  }

  const CTX = 3;
  const groups = [];
  for (const cIdx of changeIndices) {
    const start = Math.max(0, cIdx - CTX);
    const end = Math.min(rawDiff.length - 1, cIdx + CTX);
    if (groups.length > 0 && start <= groups[groups.length - 1].end + 1) {
      groups[groups.length - 1].end = Math.max(groups[groups.length - 1].end, end);
    } else {
      groups.push({ start, end });
    }
  }

  const result = [];
  for (const g of groups) {
    const hunkLines = rawDiff.slice(g.start, g.end + 1);
    const firstChange = hunkLines.find(l => l.newNum || l.oldNum);
    const startNum = firstChange ? (firstChange.newNum || firstChange.oldNum) : 1;
    result.push({ type: 'hunk', content: `@@ lines around ${startNum} @@`, lineNum: startNum });
    hunkLines.forEach(l => {
      result.push({
        type: l.type,
        content: l.content,
        lineNum: l.type === 'del' ? l.oldNum : (l.newNum || l.oldNum)
      });
    });
  }

  return { lines: result, additions, deletions };
}

// ── Initialize App ────────────────────────────────────
async function init() {
  APP_STATE.projects = await window.freeai.listProjects();
  APP_STATE.sessions = await window.freeai.listSessions();

  if (APP_STATE.projects.length > 0) {
    selectProject(APP_STATE.projects[0]);
  }

  renderSidebarProjects();
  setupEventListeners();
  setupTitlebarMenus();
  setupImageAttachments();
  setupSpeechRecognition();
  setupAgentIpcListeners();
  setupContextMenuListeners();
  setupIdeInteractions();
  setupIdeTerminal();
  setupIdeMenus();
  setupAuthListeners();

  const updateBridgeStatus = (status) => {
    const port = status?.port;
    const label = document.getElementById('ide-bridge-status-label');
    const output = document.getElementById('bridge-output-status');
    if (label) label.textContent = port ? `⚡ Bridge: Port ${port}` : '⚡ Bridge: offline';
    if (output) output.textContent = port
      ? `[Info] Preload and Bridge communication active on Port ${port}.`
      : '[Warn] Bridge wartet auf einen freien Port...';
  };
  try { updateBridgeStatus(await window.freeai.getBridgeStatus()); } catch { updateBridgeStatus(null); }
  window.freeai.on('bridge-status', updateBridgeStatus);

  // Check ChatGPT auth state on startup & auto-open drawer if logged out
  try {
    await window.freeai.checkAuth(true);
  } catch (e) {
    console.log('checkAuth init note:', e.message);
  }

  window.freeai.on('chatgpt-ready', () => {
    document.getElementById('chatgpt-status-dot').className = 'status-indicator-dot';
    document.getElementById('chatgpt-status-label').textContent = 'ChatGPT Connected';
    const ideDot = document.getElementById('ide-chatgpt-status-dot');
    const ideLabel = document.getElementById('ide-chatgpt-status-label');
    if (ideDot) ideDot.className = 'status-indicator-dot';
    if (ideLabel) ideLabel.textContent = 'ChatGPT Connected';
  });

  // Track ChatGPT URL navigation and bind it to the active session
  window.freeai.on('chatgpt-navigated', async (url) => {
    if (!url) return;
    if (APP_STATE.activeSession && (url.includes('/c/') || url.startsWith('https://chatgpt.com'))) {
      if (APP_STATE.activeSession.chatgptUrl !== url) {
        APP_STATE.activeSession.chatgptUrl = url;
        await saveActiveSession();
      }
    }
  });
}

// ── Persistence Helper ────────────────────────────────
function saveActiveSession() {
  if (!APP_STATE.activeSession) return Promise.resolve();
  // Coalesce rapid stream/tool updates and serialize the actual writes. This
  // prevents a slow older snapshot from overwriting the newest session.
  pendingSessionSnapshot = JSON.parse(JSON.stringify(APP_STATE.activeSession));
  const promise = new Promise(resolve => pendingSessionResolvers.push(resolve));
  if (sessionSaveTimer) clearTimeout(sessionSaveTimer);
  sessionSaveTimer = setTimeout(flushSessionSave, 250);
  return promise;
}

function flushSessionSave() {
  sessionSaveTimer = null;
  const snapshot = pendingSessionSnapshot;
  pendingSessionSnapshot = null;
  const resolvers = pendingSessionResolvers;
  pendingSessionResolvers = [];
  if (!snapshot) {
    resolvers.forEach(resolve => resolve());
    return;
  }
  const previousQueue = APP_STATE.sessionSaveQueue || Promise.resolve();
  APP_STATE.sessionSaveQueue = previousQueue
    .catch(() => {})
    .then(() => window.freeai.updateSession(snapshot))
    .then(async () => {
      APP_STATE.sessions = await window.freeai.listSessions();
      renderSidebarProjects();
    })
    .then(() => resolvers.forEach(resolve => resolve()))
    .catch(() => resolvers.forEach(resolve => resolve()));
}

// ── Project & Session Management ──────────────────────
function selectProject(proj) {
  APP_STATE.activeProject = proj;
  APP_STATE.workspace = proj ? proj.path : '';
  
  const name = proj ? proj.name : 'No Project';
  document.getElementById('bc-project').textContent = name;
  document.getElementById('empty-selected-project-label').textContent = name;
  
  renderSidebarProjects();
  refreshFileTree();
}

function selectSession(session) {
  if (APP_STATE.isAgentRunning && APP_STATE.activeSession?.id !== session.id) {
    try { window.freeai.stopAgent(); } catch (e) {}
    APP_STATE.isAgentRunning = false;
    if (APP_STATE.agentTimerInterval) {
      clearInterval(APP_STATE.agentTimerInterval);
      APP_STATE.agentTimerInterval = null;
    }
    setAgentRunningUI(false);
  }

  APP_STATE.activeSession = session;
  APP_STATE.currentAssistantEl = null;
  APP_STATE.currentAssistantTurn = null;
  const project = APP_STATE.projects.find(p => p.id === session.projectId);
  if (project) {
    APP_STATE.activeProject = project;
    APP_STATE.workspace = project.path;
    document.getElementById('bc-project').textContent = project.name;
    document.getElementById('empty-selected-project-label').textContent = project.name;
    refreshFileTree();
  }

  document.getElementById('bc-session').textContent = session.title || 'Conversation';
  
  document.getElementById('view-empty-state').classList.add('hidden');
  document.getElementById('view-conversation').classList.remove('hidden');

  renderConversationTurns(session);
  renderIdeAgentStream(session);
  renderSidebarProjects();
  updateDiffUI(session.diffEntries || []);

  // Synchronize ChatGPT view to this specific conversation
  if (session.chatgptUrl) {
    window.freeai.loadChatgptUrl(session.chatgptUrl);
  }
}

function startNewConversation() {
  if (APP_STATE.isAgentRunning) {
    try { window.freeai.stopAgent(); } catch (e) {}
    APP_STATE.isAgentRunning = false;
  }
  if (APP_STATE.agentTimerInterval) {
    clearInterval(APP_STATE.agentTimerInterval);
    APP_STATE.agentTimerInterval = null;
  }
  if (APP_STATE.currentThoughtBlock) {
    APP_STATE.currentThoughtBlock = null;
  }

  setAgentRunningUI(false);

  const dotKortex = document.getElementById('chatgpt-status-dot');
  const labelKortex = document.getElementById('chatgpt-status-label');
  const dotIde = document.getElementById('ide-chatgpt-status-dot');
  const labelIde = document.getElementById('ide-chatgpt-status-label');
  if (dotKortex) dotKortex.className = 'status-indicator-dot';
  if (labelKortex) labelKortex.textContent = 'ChatGPT Connected';
  if (dotIde) dotIde.className = 'status-indicator-dot';
  if (labelIde) labelIde.textContent = 'ChatGPT Connected';

  APP_STATE.activeSession = null;
  APP_STATE.currentAssistantEl = null;
  APP_STATE.currentAssistantTurn = null;
  document.getElementById('bc-session').textContent = 'New Conversation';
  document.getElementById('view-conversation').classList.add('hidden');
  document.getElementById('view-empty-state').classList.remove('hidden');
  
  const convStream = document.getElementById('conversation-stream');
  if (convStream) convStream.innerHTML = '';
  const ideStream = document.getElementById('ide-agent-stream');
  if (ideStream) ideStream.innerHTML = '';

  const heroInput = document.getElementById('prompt-input-hero');
  if (heroInput) {
    heroInput.value = '';
    heroInput.focus();
  }
  const bottomInput = document.getElementById('prompt-input-bottom');
  if (bottomInput) bottomInput.value = '';
  const ideInput = document.getElementById('ide-agent-prompt-input');
  if (ideInput) ideInput.value = '';

  window.freeai.newChat();
  updatePinnedPlanWidget(null);
  renderSidebarProjects();
}

// ── Sidebar Projects & Sessions (with Pin & 3-Dots) ───
function renderSidebarProjects() {
  const container = document.getElementById('projects-list-container');
  container.innerHTML = '';

  if (!APP_STATE.projects || APP_STATE.projects.length === 0) {
    container.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:11px;text-align:center;">Keine Projekte. Klicke auf + um deinen Projektordner hinzuzufügen.</div>';
    return;
  }

  APP_STATE.projects.forEach(project => {
    const isProjectActive = APP_STATE.activeProject?.id === project.id;
    
    // Sort sessions: Pinned first, then by date descending
    const projectSessions = (APP_STATE.sessions || [])
      .filter(s => s.projectId === project.id)
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });

    const group = document.createElement('div');
    group.className = 'project-tree-group' + (isProjectActive ? '' : ' collapsed');

    group.innerHTML = `
      <div class="project-tree-header ${isProjectActive ? 'active' : ''}" title="${escHtml(project.path)}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
        <span style="overflow:hidden;text-overflow:ellipsis;flex:1;">${escHtml(project.name)}</span>
      </div>
      <div class="project-tree-items">
        ${projectSessions.length === 0
          ? '<div style="padding:4px 16px;color:var(--text-muted);font-size:11px;">Keine Chats</div>'
          : projectSessions.map(s => {
            const isSessActive = APP_STATE.activeSession?.id === s.id;
            return `
              <div class="conv-tree-item ${isSessActive ? 'active' : ''}" data-sess-id="${s.id}">
                <div class="conv-title-wrapper">
                  ${s.pinned ? '<span class="conv-pin-icon" title="Angeheftet"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M16 3l1 1-2.5 4.5 3.5 3.5-1 1-4-1-4 4v4l-1 1-1-1v-4l-4-4-1 1-1-1 3.5-3.5L4 4l1-1 4.5 2.5L14 3h2z"/></svg></span>' : ''}
                  <span class="conv-title-text">${escHtml(s.title || 'Conversation')}</span>
                </div>
                <div class="conv-meta-right">
                  ${isSessActive ? '<span class="conv-active-dot"></span>' : `<span class="conv-age-pill">${timeAgo(s.createdAt)}</span>`}
                  <button class="conv-more-btn" title="Chat-Optionen" data-sess-id="${s.id}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/><circle cx="5" cy="12" r="2.2"/></svg>
                  </button>
                </div>
              </div>
            `;
          }).join('')
        }
      </div>
    `;

    group.querySelector('.project-tree-header').addEventListener('click', () => {
      group.classList.toggle('collapsed');
      selectProject(project);
    });

    group.querySelectorAll('.conv-tree-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const s = APP_STATE.sessions.find(x => x.id === el.dataset.sessId);
        if (s) selectSession(s);
      });
    });

    // 3-Dots Button Click Listener
    group.querySelectorAll('.conv-more-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const s = APP_STATE.sessions.find(x => x.id === btn.dataset.sessId);
        if (s) openConversationContextMenu(e, s);
      });
    });

    container.appendChild(group);
  });
}

// ── Context Menu (Pin / Rename / Delete) ──────────────
function openConversationContextMenu(event, session) {
  APP_STATE.contextMenuTargetSession = session;
  const menu = document.getElementById('conv-context-menu');
  const pinLabel = document.getElementById('ctx-pin-label');

  pinLabel.textContent = session.pinned ? 'Loslösen' : 'Anheften';

  const rect = event.currentTarget.getBoundingClientRect();
  menu.style.left = `${Math.min(window.innerWidth - 160, rect.right + 4)}px`;
  menu.style.top = `${Math.min(window.innerHeight - 130, rect.top)}px`;
  menu.classList.remove('hidden');
}

function hideConversationContextMenu() {
  const menu = document.getElementById('conv-context-menu');
  if (menu) menu.classList.add('hidden');
}

function setupContextMenuListeners() {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#conv-context-menu') && !e.target.closest('.conv-more-btn')) {
      hideConversationContextMenu();
    }
  });

  // Action: Pin / Unpin
  document.getElementById('ctx-action-pin').addEventListener('click', async () => {
    const s = APP_STATE.contextMenuTargetSession;
    hideConversationContextMenu();
    if (!s) return;
    s.pinned = !s.pinned;
    await window.freeai.updateSession(s);
    APP_STATE.sessions = await window.freeai.listSessions();
    renderSidebarProjects();
    showToast(s.pinned ? '📌 Angeheftet' : '📌 Losgelöst', s.title || 'Chat');
  });

  // Action: Rename
  document.getElementById('ctx-action-rename').addEventListener('click', () => {
    const s = APP_STATE.contextMenuTargetSession;
    hideConversationContextMenu();
    if (!s) return;
    const modal = document.getElementById('rename-modal-overlay');
    const input = document.getElementById('rename-input');
    input.value = s.title || '';
    modal.classList.remove('hidden');
    input.focus();
    input.select();
  });

  // Action: Delete
  document.getElementById('ctx-action-delete').addEventListener('click', async () => {
    const s = APP_STATE.contextMenuTargetSession;
    hideConversationContextMenu();
    if (!s) return;
    
    // Also delete or clear conversation in ChatGPT
    if (s.chatgptUrl) {
      try {
        window.freeai.deleteChatgptSession({ chatgptUrl: s.chatgptUrl, id: s.id });
      } catch (e) {
        console.warn('ChatGPT session removal error:', e);
      }
    }

    await window.freeai.removeSession({ id: s.id });
    APP_STATE.sessions = await window.freeai.listSessions();
    
    if (APP_STATE.activeSession?.id === s.id) {
      startNewConversation();
    }
    renderSidebarProjects();
    showToast('🗑️ Gelöscht', 'Chat wurde erfolgreich entfernt');
  });

  // Rename Modal handlers
  const saveRename = async () => {
    const modal = document.getElementById('rename-modal-overlay');
    const input = document.getElementById('rename-input');
    const newTitle = input.value.trim();
    const s = APP_STATE.contextMenuTargetSession;
    modal.classList.add('hidden');

    if (s && newTitle) {
      s.title = newTitle;
      await window.freeai.updateSession(s);
      APP_STATE.sessions = await window.freeai.listSessions();
      if (APP_STATE.activeSession?.id === s.id) {
        document.getElementById('bc-session').textContent = newTitle;
      }
      renderSidebarProjects();
      showToast('✏️ Umbenannt', newTitle);
    }
  };

  document.getElementById('btn-rename-save').addEventListener('click', saveRename);
  document.getElementById('btn-rename-cancel').addEventListener('click', () => {
    document.getElementById('rename-modal-overlay').classList.add('hidden');
  });
  document.getElementById('rename-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveRename();
    } else if (e.key === 'Escape') {
      document.getElementById('rename-modal-overlay').classList.add('hidden');
    }
  });
  document.getElementById('rename-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'rename-modal-overlay') {
      document.getElementById('rename-modal-overlay').classList.add('hidden');
    }
  });
}

// ── Conversation Stream Rendering (Dual Stream: Kortex & IDE) ──
function renderTurnsIntoContainer(session, stream) {
  if (!stream) return;
  stream.innerHTML = '';
  if (!session) return;

  const turns = session.turns || [];
  turns.forEach(item => {
    if (item.type === 'user') {
      const userEl = document.createElement('div');
      userEl.className = 'timeline-turn-user';
      const imagesHtml = (item.attachedImages && item.attachedImages.length > 0)
        ? `<div class="user-attached-images-preview">${item.attachedImages.map(img => `
            <div class="user-img-card">
              <img src="${img.dataUrl}" alt="${escHtml(img.name)}" class="user-bubble-thumb" />
              <span class="user-bubble-img-name">${escHtml(img.name)}</span>
            </div>
          `).join('')}</div>`
        : '';
      userEl.innerHTML = `<div class="user-msg-bubble">${imagesHtml}<div class="user-msg-text">${escHtml(item.text)}</div></div>`;
      stream.appendChild(userEl);
    } else if (item.type === 'thought') {
      stream.appendChild(createThoughtCard(item));
    } else if (item.type === 'action_read') {
      stream.appendChild(createActionReadRow(item));
    } else if (item.type === 'action_explore') {
      stream.appendChild(createActionExploreRow(item));
    } else if (item.type === 'file_change') {
      stream.appendChild(createFileChangeRow(item));
    } else if (item.type === 'plan') {
      stream.appendChild(createPlanCard(item));
    } else if (item.type === 'terminal') {
      stream.appendChild(createTerminalRow(item));
    } else if (item.type === 'assistant') {
      if (item.text && item.text.trim()) {
        const asstEl = document.createElement('div');
        asstEl.className = 'timeline-assistant-turn';
        asstEl.innerHTML = `<div class="markdown-body">${parseMarkdown(item.text)}</div>`;
        stream.appendChild(asstEl);
      }
    }
  });

  const latestPlan = (session.turns || []).slice().reverse().find(t => t.type === 'plan');
  updatePinnedPlanWidget(latestPlan || null);

  stream.scrollTop = stream.scrollHeight;
}

function renderConversationTurns(session) {
  renderTurnsIntoContainer(session, document.getElementById('conversation-stream'));
}

function renderIdeAgentStream(session) {
  renderTurnsIntoContainer(session, document.getElementById('ide-agent-stream'));
}

function appendTurnToBothStreams(createFn) {
  const kortexStream = document.getElementById('conversation-stream');
  const ideStream = document.getElementById('ide-agent-stream');

  let kortexEl = null;
  let ideEl = null;

  if (kortexStream) {
    kortexEl = createFn();
    kortexStream.appendChild(kortexEl);
    kortexStream.scrollTop = kortexStream.scrollHeight;
  }
  if (ideStream) {
    ideEl = createFn();
    ideStream.appendChild(ideEl);
    ideStream.scrollTop = ideStream.scrollHeight;
  }

  return { kortexEl, ideEl };
}

// ── Pinned Plan Widget (Always pinned at top of chat stream) ──
function updatePinnedPlanWidget(planItem) {
  const containers = [
    document.getElementById('conversation-pinned-plan'),
    document.getElementById('ide-agent-pinned-plan')
  ];

  if (!planItem || !planItem.steps || planItem.steps.length === 0) {
    containers.forEach(c => {
      if (c) {
        c.classList.add('hidden');
        c.innerHTML = '';
      }
    });
    return;
  }

  const steps = planItem.steps || [];
  const doneCount = steps.filter(s => s.done).length;
  const totalCount = steps.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  containers.forEach(c => {
    if (!c) return;
    c.classList.remove('hidden');

    c.innerHTML = `
      <div class="pinned-plan-header">
        <div class="pinned-plan-title-group">
          <span class="pinned-plan-badge">Plan</span>
          <span class="pinned-plan-title-text">${escHtml(planItem.title || 'Aufgabenplan')}</span>
        </div>
        <div class="pinned-plan-stats-group">
          <div class="pinned-plan-count-label">${doneCount} von ${totalCount} (${pct}%)</div>
          <div class="pinned-plan-progress-bar">
            <div class="pinned-plan-progress-fill" style="width: ${pct}%;"></div>
          </div>
          <svg class="pinned-plan-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
      <div class="pinned-plan-steps">
        ${steps.map(s => `
          <div class="plan-step-row ${s.done ? 'is-done' : ''}" data-step-id="${s.id}">
            <div class="plan-checkbox ${s.done ? 'checked' : ''}">
              ${s.done ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            </div>
            <span class="plan-step-label">${escHtml(s.title)}</span>
          </div>
        `).join('')}
      </div>
    `;

    const header = c.querySelector('.pinned-plan-header');
    header?.addEventListener('click', () => {
      c.classList.toggle('collapsed');
    });

    c.querySelectorAll('.plan-step-row').forEach(row => {
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        const stepId = Number(row.dataset.stepId);
        const isDone = row.classList.toggle('is-done');
        const cb = row.querySelector('.plan-checkbox');
        if (cb) {
          cb.classList.toggle('checked', isDone);
          cb.innerHTML = isDone ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '';
        }

        const step = planItem.steps.find(s => Number(s.id) === stepId);
        if (step) step.done = isDone;

        saveActiveSession();
        updatePinnedPlanWidget(planItem);
      });
    });
  });
}

// ── Plan Checklist Card ───────────────────────────────
function createPlanCard(item) {
  const card = document.createElement('div');
  card.className = 'plan-checklist-card';
  card.dataset.planId = item.id || Date.now();

  const steps = item.steps || [];
  const doneCount = steps.filter(s => s.done).length;

  card.innerHTML = `
    <div class="plan-card-header">
      <div class="plan-header-title">
        <span class="plan-header-badge">Plan</span>
        <span class="plan-count-label">${doneCount} von ${steps.length} Aufgaben erledigt</span>
      </div>
      <svg class="plan-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
    </div>
    <div class="plan-steps-list">
      ${steps.map(s => `
        <div class="plan-step-row ${s.done ? 'is-done' : ''}" data-step-id="${s.id}">
          <div class="plan-checkbox ${s.done ? 'checked' : ''}">
            ${s.done ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
          </div>
          <span class="plan-step-label">${escHtml(s.title)}</span>
        </div>
      `).join('')}
    </div>
  `;

  // Toggle Collapse
  card.querySelector('.plan-card-header').addEventListener('click', () => {
    card.classList.toggle('collapsed');
  });

  // Interactive toggle on step click
  card.querySelectorAll('.plan-step-row').forEach(row => {
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      const stepId = Number(row.dataset.stepId);
      const isDone = row.classList.toggle('is-done');
      const cb = row.querySelector('.plan-checkbox');
      cb.classList.toggle('checked', isDone);
      cb.innerHTML = isDone ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '';

      if (item.steps) {
        const step = item.steps.find(s => Number(s.id) === stepId);
        if (step) step.done = isDone;
      }
      const newDoneCount = item.steps.filter(s => s.done).length;
      const countLabel = card.querySelector('.plan-count-label');
      if (countLabel) countLabel.textContent = `${newDoneCount} von ${item.steps.length} Aufgaben erledigt`;

      saveActiveSession();
      updatePinnedPlanWidget(item);
    });
  });

  updatePinnedPlanWidget(item);
  return card;
}

// ── Thought Card (Pure Thinking) ──────────────────────
function createThoughtCard(item) {
  const card = document.createElement('div');
  card.className = 'timeline-thought-card open';
  card.id = `thought-card-${item.id || Date.now()}`;

  const sec = item.elapsedSec || 1;
  card.innerHTML = `
    <div class="thought-header">
      <svg class="chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      <span class="thought-timer-label">Thought for ${sec}s</span>
    </div>
    <div class="thought-body-text">${escHtml(item.thought || 'Überlege die optimale Struktur und Umsetzung...')}</div>
  `;

  card.querySelector('.thought-header').addEventListener('click', () => {
    card.classList.toggle('open');
  });

  return card;
}

// ── Action Row: Read File ─────────────────────────────
function createActionReadRow(item) {
  const row = document.createElement('div');
  row.className = 'file-action-inline-card';
  row.dataset.path = item.path;

  const fileName = (item.path || '').split(/[/\\]/).pop();

  row.innerHTML = `
    <div class="file-action-left">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      <span class="file-action-type">Read file</span>
      <span class="file-action-path">/${escHtml(item.path || fileName)}</span>
    </div>
    <div class="file-action-meta">
      <span class="action-tag ${item.success === false ? 'error' : 'read'}">${item.success === false ? 'error' : 'read'}</span>
    </div>
  `;

  row.addEventListener('click', () => {
    if (APP_STATE.appMode === 'ide') {
      openFileInEditor(item.path);
    } else {
      openRightTab('files');
    }
  });

  return row;
}

// ── Action Row: Explored Project ──────────────────────
function createActionExploreRow(item) {
  const row = document.createElement('div');
  row.className = 'file-action-inline-card';

  row.innerHTML = `
    <div class="file-action-left">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="1.8"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
      <span class="file-action-type">Explored project</span>
      <span class="file-action-path">${item.totalFiles || 'All'} files found</span>
    </div>
    <div class="file-action-meta">
      <span class="action-tag explore">scanned</span>
    </div>
  `;

  row.addEventListener('click', () => {
    if (APP_STATE.appMode === 'ide') {
      refreshIdeFileTree();
    } else {
      openRightTab('files');
    }
  });

  return row;
}

// ── Inline File Change Card (Test.txt +5 -2) ──────────
function createFileChangeRow(item) {
  const row = document.createElement('div');
  row.className = 'file-change-inline-card';
  row.dataset.path = item.path;

  const fileName = (item.path || '').split(/[/\\]/).pop();
  const add = item.additions || 0;
  const del = item.deletions || 0;

  row.innerHTML = `
    <div class="file-change-left">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <span class="file-change-name">${escHtml(fileName)}</span>
      <span class="file-change-path">/${escHtml(item.path)}</span>
    </div>
    <div class="file-change-stats">
      ${add > 0 ? `<span class="add">+${add}</span>` : ''}
      ${del > 0 ? `<span class="del">-${del}</span>` : ''}
    </div>
  `;

  row.addEventListener('click', () => {
    if (APP_STATE.appMode === 'ide') {
      openFileInEditor(item.path);
    } else {
      openRightTab('diff');
      const card = document.querySelector(`.diff-card[data-file="${item.path}"]`);
      if (card) {
        card.classList.add('open');
        card.scrollIntoView({ behavior: 'smooth' });
      }
    }
  });

  return row;
}

// ── Terminal Command Row ──────────────────────────────
function createTerminalRow(item) {
  const row = document.createElement('div');
  row.className = 'terminal-cmd-inline-card';

  row.innerHTML = `
    <div class="terminal-cmd-header">
      <span>> ${escHtml(item.command)}</span>
      <span style="color:var(--text-muted);font-size:11px;">✓ ${item.executionTimeMs || 50}ms</span>
    </div>
    ${item.output ? `<div class="terminal-cmd-output">${escHtml(item.output)}</div>` : ''}
  `;

  row.addEventListener('click', () => {
    row.classList.toggle('open');
  });

  return row;
}

// ── Execute Prompt & Agent Loop ───────────────────────
function ensureLiveAssistantTurn() {
  if (APP_STATE.currentAssistantEl) return APP_STATE.currentAssistantEl;

  const kortexStream = document.getElementById('conversation-stream');
  const ideStream = document.getElementById('ide-agent-stream');

  const kortexEl = document.createElement('div');
  kortexEl.className = 'timeline-assistant-turn agent-live-turn';
  kortexEl.innerHTML = '<div class="markdown-body"></div>';
  if (kortexStream) kortexStream.appendChild(kortexEl);

  const ideEl = document.createElement('div');
  ideEl.className = 'timeline-assistant-turn agent-live-turn';
  ideEl.innerHTML = '<div class="markdown-body"></div>';
  if (ideStream) ideStream.appendChild(ideEl);

  APP_STATE.currentAssistantEl = { kortexEl, ideEl };
  APP_STATE.currentAssistantTurn = { type: 'assistant', text: '' };
  if (APP_STATE.activeSession) APP_STATE.activeSession.turns.push(APP_STATE.currentAssistantTurn);

  return APP_STATE.currentAssistantEl;
}

function renderLiveAssistantText(text) {
  const el = ensureLiveAssistantTurn();
  const html = parseMarkdown(text);
  if (el.kortexEl) {
    const body = el.kortexEl.querySelector('.markdown-body');
    if (body) body.innerHTML = html;
  }
  if (el.ideEl) {
    const body = el.ideEl.querySelector('.markdown-body');
    if (body) body.innerHTML = html;
  }
  if (APP_STATE.currentAssistantTurn) APP_STATE.currentAssistantTurn.text = text;

  const kortexStream = document.getElementById('conversation-stream');
  const ideStream = document.getElementById('ide-agent-stream');
  if (kortexStream) kortexStream.scrollTop = kortexStream.scrollHeight;
  if (ideStream) ideStream.scrollTop = ideStream.scrollHeight;
}

async function executePrompt(promptText) {
  if (!promptText || !promptText.trim()) return;
  if (!APP_STATE.workspace) {
    showToast('Kein Projekt gewählt', 'Bitte wähle zuerst einen Projektordner aus!', 'error');
    openProjectPicker();
    return;
  }

  document.getElementById('view-empty-state').classList.add('hidden');
  document.getElementById('view-conversation').classList.remove('hidden');

  if (!APP_STATE.activeSession) {
    const newSess = await window.freeai.addSession({
      projectId: APP_STATE.activeProject?.id || '1',
      title: promptText.substring(0, 45),
      turns: [],
      diffEntries: []
    });
    APP_STATE.sessions = await window.freeai.listSessions();
    APP_STATE.activeSession = newSess;
    document.getElementById('bc-session').textContent = newSess.title;
    renderSidebarProjects();
  }

  // 1. Add User Turn & Attachments
  const currentImages = [...ATTACHED_IMAGES];
  ATTACHED_IMAGES = [];
  renderAttachedImages();

  const userTurn = {
    type: 'user',
    text: promptText,
    attachedImages: currentImages.length > 0 ? currentImages : undefined
  };
  APP_STATE.activeSession.turns.push(userTurn);
  saveActiveSession();

  const createUserBubble = () => {
    const userEl = document.createElement('div');
    userEl.className = 'timeline-turn-user';
    const imagesHtml = currentImages.length > 0
      ? `<div class="user-attached-images-preview">${currentImages.map(img => `
          <div class="user-img-card">
            <img src="${img.dataUrl}" alt="${escHtml(img.name)}" class="user-bubble-thumb" />
            <span class="user-bubble-img-name">${escHtml(img.name)}</span>
          </div>
        `).join('')}</div>`
      : '';
    userEl.innerHTML = `<div class="user-msg-bubble">${imagesHtml}<div class="user-msg-text">${escHtml(promptText)}</div></div>`;
    return userEl;
  };
  appendTurnToBothStreams(createUserBubble);

  // 2. Start Live Timer & Thought Block
  APP_STATE.isAgentRunning = true;
  APP_STATE.agentStartTime = Date.now();

  const setStatusDots = (className, labelText) => {
    const dotKortex = document.getElementById('chatgpt-status-dot');
    const labelKortex = document.getElementById('chatgpt-status-label');
    const dotIde = document.getElementById('ide-chatgpt-status-dot');
    const labelIde = document.getElementById('ide-chatgpt-status-label');
    if (dotKortex) dotKortex.className = className;
    if (labelKortex) labelKortex.textContent = labelText;
    if (dotIde) dotIde.className = className;
    if (labelIde) labelIde.textContent = labelText;
  };

  setStatusDots('status-indicator-dot working', 'Agent Working...');
  setAgentRunningUI(true);

  const thoughtItem = {
    id: Date.now(),
    type: 'thought',
    thought: 'Überlege und plane die Umsetzung...',
    elapsedSec: 1
  };
  APP_STATE.currentThoughtBlock = thoughtItem;
  APP_STATE.activeSession.turns.push(thoughtItem);
  saveActiveSession();

  appendTurnToBothStreams(() => createThoughtCard(thoughtItem));

  // Live Timer Update
  if (APP_STATE.agentTimerInterval) clearInterval(APP_STATE.agentTimerInterval);
  APP_STATE.agentTimerInterval = setInterval(() => {
    if (APP_STATE.isAgentRunning && APP_STATE.currentThoughtBlock) {
      const elapsed = Math.round((Date.now() - APP_STATE.agentStartTime) / 1000);
      APP_STATE.currentThoughtBlock.elapsedSec = elapsed;
      document.querySelectorAll(`#thought-card-${APP_STATE.currentThoughtBlock.id} .thought-timer-label`).forEach(lbl => {
        lbl.textContent = `Thought for ${elapsed}s`;
      });
    }
  }, 1000);

  // 3. Assistant turn is created lazily
  APP_STATE.currentAssistantEl = null;
  APP_STATE.currentAssistantTurn = null;

  const inputHero = document.getElementById('prompt-input-hero');
  const inputBottom = document.getElementById('prompt-input-bottom');
  const inputIde = document.getElementById('ide-agent-prompt-input');
  if (inputHero) inputHero.value = '';
  if (inputBottom) inputBottom.value = '';
  if (inputIde) inputIde.value = '';

  // 4. Auto-Scan Project Structure
  let projectSnapshot = null;
  const snapRes = await window.freeai.listFiles({ workspacePath: APP_STATE.workspace });
  if (snapRes.success && snapRes.files) {
    projectSnapshot = snapRes.files.length === 0
      ? '(Projektordner ist leer)'
      : snapRes.files.map(f => `${f.type === 'directory' ? '[DIR] ' : '[FILE]'} ${f.path}${f.size ? ' (' + f.size + ' B)' : ''}`).join('\n');
  }

  // 5. Build Final Prompt with Image Context
  let finalPrompt = promptText;
  if (currentImages.length > 0) {
    const imgDescriptions = currentImages.map((img, idx) => {
      return `[ANGEHÄNGTES BILD ${idx + 1}: "${img.name}"]\n- Format: ${(img.ext || 'PNG').toUpperCase()}\n- Größe: ${Math.round((img.size || 0) / 1024)} KB\n- Visuelle Vorgabe / Screenshot: Der Nutzer hat dieses Bild als visuelle Vorlage / Mockup angehängt. Analysiere das Design, die Elemente und das Layout und setze die Anforderungen exakt wie im Bild dargestellt um.`;
    }).join('\n\n');
    finalPrompt = `${imgDescriptions}\n\n[BENUTZER-ANFRAGE]\n${promptText}`;
  }

  // 6. Start Agent in ChatGPT
  try {
    const started = await window.freeai.startAgent({
      task: finalPrompt,
      workspace: APP_STATE.workspace,
      projectSnapshot
    });
    if (started === false) throw new Error('ChatGPT-Ansicht ist noch nicht bereit.');
  } catch (error) {
    APP_STATE.isAgentRunning = false;
    if (APP_STATE.agentTimerInterval) clearInterval(APP_STATE.agentTimerInterval);
    setAgentRunningUI(false);
    setStatusDots('status-indicator-dot dot-amber', 'ChatGPT nicht bereit');
    showToast('Agent konnte nicht starten', error.message, 'error', 8000);
  }
}

// ── Agent Running UI Helper ───────────────────────────
function setAgentRunningUI(running) {
  const sendHero = document.getElementById('btn-send-hero');
  const sendBottom = document.getElementById('btn-send-bottom');
  const sendIde = document.getElementById('ide-agent-btn-send');
  const stopHero = document.getElementById('btn-stop-hero');
  const stopBottom = document.getElementById('btn-stop-bottom');
  const stopIde = document.getElementById('ide-agent-btn-stop');
  const inputHero = document.getElementById('prompt-input-hero');
  const inputBottom = document.getElementById('prompt-input-bottom');
  const inputIde = document.getElementById('ide-agent-prompt-input');

  if (running) {
    sendHero && sendHero.classList.add('hidden');
    sendBottom && sendBottom.classList.add('hidden');
    sendIde && sendIde.classList.add('hidden');
    stopHero && stopHero.classList.remove('hidden');
    stopBottom && stopBottom.classList.remove('hidden');
    stopIde && stopIde.classList.remove('hidden');
    if (inputHero) { inputHero.disabled = true; inputHero.style.opacity = '0.5'; }
    if (inputBottom) { inputBottom.disabled = true; inputBottom.style.opacity = '0.5'; }
    if (inputIde) { inputIde.disabled = true; inputIde.style.opacity = '0.5'; }
  } else {
    sendHero && sendHero.classList.remove('hidden');
    sendBottom && sendBottom.classList.remove('hidden');
    sendIde && sendIde.classList.remove('hidden');
    stopHero && stopHero.classList.add('hidden');
    stopBottom && stopBottom.classList.add('hidden');
    stopIde && stopIde.classList.add('hidden');
    if (inputHero) { inputHero.disabled = false; inputHero.style.opacity = ''; }
    if (inputBottom) { inputBottom.disabled = false; inputBottom.style.opacity = ''; inputBottom.focus(); }
    if (inputIde) { inputIde.disabled = false; inputIde.style.opacity = ''; inputIde.focus(); }
  }
}

// ── Agent IPC Handshake ───────────────────────────────
function setupAgentIpcListeners() {
  window.freeai.on('agent:event', async (event) => {
    const { type, payload } = event;

    switch (type) {
      case 'agent:step': {
        if (APP_STATE.currentAssistantEl) {
          if (APP_STATE.currentAssistantEl.kortexEl) {
            APP_STATE.currentAssistantEl.kortexEl.classList.remove('agent-live-turn');
            APP_STATE.currentAssistantEl.kortexEl.classList.add('agent-progress-turn');
          }
          if (APP_STATE.currentAssistantEl.ideEl) {
            APP_STATE.currentAssistantEl.ideEl.classList.remove('agent-live-turn');
            APP_STATE.currentAssistantEl.ideEl.classList.add('agent-progress-turn');
          }
        }
        APP_STATE.currentAssistantEl = null;
        APP_STATE.currentAssistantTurn = null;
        break;
      }

      case 'agent:status': {
        showToast('Agent-Status', payload.message || 'Agent arbeitet weiter …', payload.level || 'info', 5000);
        break;
      }

      case 'agent:thought': {
        const text = (payload.thought || '').trim();
        if (!text || /^[\{\}\[\]\s]+$/.test(text) || text.startsWith('tool_call')) {
          return;
        }

        if (APP_STATE.isAgentRunning) {
          if (!APP_STATE.currentThoughtBlock) {
            APP_STATE.currentThoughtBlock = {
              id: Date.now(),
              type: 'thought',
              thought: text,
              elapsedSec: payload.elapsedSec || Math.round((Date.now() - (APP_STATE.agentStartTime || Date.now())) / 1000) || 1
            };
            if (APP_STATE.activeSession) {
              APP_STATE.activeSession.turns.push(APP_STATE.currentThoughtBlock);
            }
            appendTurnToBothStreams(() => createThoughtCard(APP_STATE.currentThoughtBlock));
          } else {
            APP_STATE.currentThoughtBlock.thought = text;
            document.querySelectorAll(`#thought-card-${APP_STATE.currentThoughtBlock.id} .thought-body-text`).forEach(b => {
              b.textContent = text;
            });
          }
          saveActiveSession();
        }
        break;
      }

      case 'agent:text-chunk': {
        const text = (payload.text || '').trim();
        if (!text || /^[\{\}\[\]\s]+$/.test(text) || text.startsWith('tool_call')) return;
        renderLiveAssistantText(text);
        saveActiveSession();
        break;
      }

      case 'agent:ask-question': {
        showInteractiveQuestionModal(payload.question, payload.options);
        break;
      }

      case 'agent:tool-call': {
        if (APP_STATE.currentThoughtBlock) {
          document.querySelectorAll(`#thought-card-${APP_STATE.currentThoughtBlock.id}`).forEach(c => c.classList.remove('open'));
          APP_STATE.currentThoughtBlock = null;
        }
        const { tool, parameters } = payload;
        showToast('Agent führt Tool aus', tool, 'tool', 3000);
        const result = await executeToolLocally(tool, parameters);
        if (APP_STATE.activeSession) renderIdeAgentStream(APP_STATE.activeSession);
        window.freeai.send('chatgpt:tool-result', { result });
        break;
      }

      case 'agent:completed': {
        APP_STATE.isAgentRunning = false;
        const summary = (payload.summary || '').trim();

        if (APP_STATE.currentThoughtBlock) {
          const thoughtText = (APP_STATE.currentThoughtBlock.thought || '').trim();
          const thoughtId = APP_STATE.currentThoughtBlock.id;
          if (thoughtText && (summary.includes(thoughtText.substring(0, 30)) || thoughtText.includes(summary.substring(0, 30)))) {
            document.querySelectorAll(`#thought-card-${thoughtId}`).forEach(c => c.remove());
            if (APP_STATE.activeSession) {
              APP_STATE.activeSession.turns = APP_STATE.activeSession.turns.filter(t => t.id !== thoughtId);
            }
          } else {
            document.querySelectorAll(`#thought-card-${thoughtId}`).forEach(c => c.classList.remove('open'));
          }
          APP_STATE.currentThoughtBlock = null;
        }
        if (APP_STATE.agentTimerInterval) clearInterval(APP_STATE.agentTimerInterval);
        setAgentRunningUI(false);

        const dotKortex = document.getElementById('chatgpt-status-dot');
        const labelKortex = document.getElementById('chatgpt-status-label');
        const dotIde = document.getElementById('ide-chatgpt-status-dot');
        const labelIde = document.getElementById('ide-chatgpt-status-label');
        if (dotKortex) dotKortex.className = 'status-indicator-dot';
        if (labelKortex) labelKortex.textContent = 'ChatGPT Connected';
        if (dotIde) dotIde.className = 'status-indicator-dot';
        if (labelIde) labelIde.textContent = 'ChatGPT Connected';

        if (summary) {
          if (APP_STATE.currentAssistantEl) {
            renderLiveAssistantText(summary);
            if (APP_STATE.currentAssistantEl.kortexEl) {
              APP_STATE.currentAssistantEl.kortexEl.classList.remove('agent-live-turn');
              APP_STATE.currentAssistantEl.kortexEl.classList.add('agent-final-turn');
            }
            if (APP_STATE.currentAssistantEl.ideEl) {
              APP_STATE.currentAssistantEl.ideEl.classList.remove('agent-live-turn');
              APP_STATE.currentAssistantEl.ideEl.classList.add('agent-final-turn');
            }
          } else {
            appendTurnToBothStreams(() => {
              const asstEl = document.createElement('div');
              asstEl.className = 'timeline-assistant-turn agent-final-turn';
              asstEl.innerHTML = `<div class="markdown-body">${parseMarkdown(summary)}</div>`;
              return asstEl;
            });
            if (APP_STATE.activeSession) APP_STATE.activeSession.turns.push({ type: 'assistant', text: summary });
          }
          APP_STATE.currentAssistantEl = null;
          APP_STATE.currentAssistantTurn = null;

          const docBody = document.getElementById('doc-walkthrough-body');
          const docTitle = document.getElementById('doc-walkthrough-title');
          if (docBody) docBody.innerHTML = parseMarkdown(summary);
          if (docTitle) docTitle.textContent = APP_STATE.activeSession?.title || 'Walkthrough';
        }

        showToast('🎉 Aufgabe abgeschlossen!', summary ? (summary.substring(0, 70) + '...') : 'Fertiggestellt', 'success', 8000);
        saveActiveSession();
        refreshFileTree();
        refreshIdeFileTree();
        break;
      }

      case 'agent:stopped':
      case 'agent:error': {
        APP_STATE.isAgentRunning = false;
        if (APP_STATE.currentThoughtBlock) {
          document.querySelectorAll(`#thought-card-${APP_STATE.currentThoughtBlock.id}`).forEach(c => c.classList.remove('open'));
          APP_STATE.currentThoughtBlock = null;
        }
        if (APP_STATE.agentTimerInterval) clearInterval(APP_STATE.agentTimerInterval);
        setAgentRunningUI(false);

        const dotKortex = document.getElementById('chatgpt-status-dot');
        const labelKortex = document.getElementById('chatgpt-status-label');
        const dotIde = document.getElementById('ide-chatgpt-status-dot');
        const labelIde = document.getElementById('ide-chatgpt-status-label');
        const statusClass = type === 'agent:error' ? 'status-indicator-dot dot-amber' : 'status-indicator-dot';
        const statusText = type === 'agent:error' ? 'ChatGPT Error' : 'ChatGPT Connected';
        if (dotKortex) dotKortex.className = statusClass;
        if (labelKortex) labelKortex.textContent = statusText;
        if (dotIde) dotIde.className = statusClass;
        if (labelIde) labelIde.textContent = statusText;

        if (type === 'agent:error') showToast('Fehler', payload.message, 'error');
        break;
      }
    }
  });
}

// ── Interactive Question Modal ────────────────────────
function showInteractiveQuestionModal(questionText, rawOptions) {
  const overlay = document.getElementById('question-modal-overlay');
  const titleEl = document.getElementById('q-modal-title');
  const container = document.getElementById('q-modal-options');

  titleEl.textContent = questionText || 'Entscheidung erforderlich';
  container.innerHTML = '';

  let selectedValue = '';

  const defaultOpts = [
    { title: 'Standard / Empfohlen', description: 'Empfohlene Vorgehensweise', recommended: true },
    { title: 'Alternative Option', description: 'Alternative Architektur oder Technologie' },
    { title: 'Minimalistischer Ansatz', description: 'Schnelle, schlanke Umsetzung' }
  ];
  const opts = (rawOptions && rawOptions.length > 0) ? rawOptions.slice(0, 3) : defaultOpts;

  opts.forEach((opt, idx) => {
    const isFirst = idx === 0;
    const card = document.createElement('div');
    card.className = 'q-option-card' + (isFirst ? ' selected' : '');
    card.dataset.val = opt.title;

    if (isFirst) selectedValue = opt.title;

    card.innerHTML = `
      <div class="q-radio-circle"></div>
      <div class="q-option-text">
        <div class="q-option-title">${escHtml(opt.title)} ${opt.recommended ? '<span style="color:#3b82f6;font-size:11px;font-weight:600;margin-left:4px;">(Empfohlen)</span>' : ''}</div>
        <div class="q-option-desc">${escHtml(opt.description || '')}</div>
      </div>
    `;

    card.addEventListener('click', () => {
      container.querySelectorAll('.q-option-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedValue = opt.title;
    });

    container.appendChild(card);
  });

  // Custom Option
  const customCard = document.createElement('div');
  customCard.className = 'q-option-card';
  customCard.innerHTML = `
    <div class="q-radio-circle"></div>
    <div class="q-option-text">
      <div class="q-option-title">Eigene Antwort eingeben</div>
      <input type="text" class="q-custom-input" id="q-custom-text-input" placeholder="Eigene Antwort eingeben..." />
    </div>
  `;

  const customInput = customCard.querySelector('#q-custom-text-input');

  customCard.addEventListener('click', () => {
    container.querySelectorAll('.q-option-card').forEach(c => c.classList.remove('selected'));
    customCard.classList.add('selected');
    customInput.focus();
    selectedValue = customInput.value;
  });

  customInput.addEventListener('input', () => {
    container.querySelectorAll('.q-option-card').forEach(c => c.classList.remove('selected'));
    customCard.classList.add('selected');
    selectedValue = customInput.value;
  });

  container.appendChild(customCard);

  overlay.classList.remove('hidden');

  const submitBtn = document.getElementById('btn-q-submit');
  const dismissBtn = document.getElementById('btn-q-dismiss');

  const onConfirm = () => {
    overlay.classList.add('hidden');
    const finalAnswer = selectedValue.trim() || 'Fortfahren wie empfohlen';
    window.freeai.send('chatgpt:tool-result', { result: JSON.stringify(finalAnswer) });
    submitBtn.removeEventListener('click', onConfirm);
    dismissBtn.removeEventListener('click', onDismiss);
  };

  const onDismiss = () => {
    overlay.classList.add('hidden');
    window.freeai.send('chatgpt:tool-result', { result: JSON.stringify('Keine Präferenz / Standard wählen') });
    submitBtn.removeEventListener('click', onConfirm);
    dismissBtn.removeEventListener('click', onDismiss);
  };

  submitBtn.addEventListener('click', onConfirm);
  dismissBtn.addEventListener('click', onDismiss);
}

// ── Tool Execution Locally ────────────────────────────
async function executeToolLocally(tool, params) {
  params = params || {};
  const ws = APP_STATE.workspace;
  const stream = document.getElementById('conversation-stream');

  // Collapse thought cards once actions begin
  document.querySelectorAll('.timeline-thought-card.open').forEach(c => c.classList.remove('open'));

  try {
    switch (tool) {
      case 'list_files': {
        const res = await window.freeai.listFiles({ workspacePath: ws, maxDepth: params.maxDepth || 6 });
        if (res.success) {
          const actionItem = {
            type: 'action_explore',
            path: params.workspacePath || ws,
            totalFiles: res.totalFiles || (res.files ? res.files.length : 0)
          };
          const row = createActionExploreRow(actionItem);
          stream.appendChild(row);
          stream.scrollTop = stream.scrollHeight;

          if (APP_STATE.activeSession) {
            APP_STATE.activeSession.turns.push(actionItem);
            saveActiveSession();
          }

          const filesSummary = res.files.map(f => `${f.type === 'directory' ? '[DIR] ' : '[FILE]'} ${f.path}${f.size ? ' (' + f.size + ' B)' : ''}`).join('\n');
          return { tool, success: true, totalFiles: res.totalFiles, files: filesSummary || '(leer)' };
        }
        return res;
      }

      case 'read_file': {
        const res = await window.freeai.readFile({ workspacePath: ws, filePath: params.path });
        const actionItem = {
          type: 'action_read',
          path: params.path,
          name: (params.path || '').split(/[/\\]/).pop(),
          size: res.content ? res.content.length : 0,
          success: res.success
        };
        const row = createActionReadRow(actionItem);
        stream.appendChild(row);
        stream.scrollTop = stream.scrollHeight;

        if (APP_STATE.activeSession) {
          APP_STATE.activeSession.turns.push(actionItem);
          saveActiveSession();
        }
        return res;
      }

      case 'write_file': {
        const res = await window.freeai.writeFile({ workspacePath: ws, filePath: params.path, content: params.content || '' });
        if (res.success) {
          const diff = computeDiff(res.oldContent, res.newContent);
          const diffEntry = {
            path: params.path,
            name: params.path.split(/[/\\]/).pop(),
            status: res.isNew ? 'new' : 'modified',
            additions: diff.additions,
            deletions: diff.deletions,
            lines: diff.lines
          };

          const fileRow = createFileChangeRow(diffEntry);
          stream.appendChild(fileRow);
          stream.scrollTop = stream.scrollHeight;

          if (APP_STATE.activeSession) {
            APP_STATE.activeSession.turns.push({ type: 'file_change', ...diffEntry });
            if (!APP_STATE.activeSession.diffEntries) APP_STATE.activeSession.diffEntries = [];
            APP_STATE.activeSession.diffEntries.push(diffEntry);
            saveActiveSession();
          }
          updateDiffUI(APP_STATE.activeSession?.diffEntries || [diffEntry]);
          refreshFileTree();
          refreshIdeFileTree();
        }
        return res;
      }

      case 'edit_file': {
        const res = await window.freeai.editFile({
          workspacePath: ws,
          filePath: params.path,
          targetContent: params.targetContent,
          replacementContent: params.replacementContent,
          allowMultiple: params.allowMultiple || false
        });
        if (res.success) {
          const diff = computeDiff(res.oldContent, res.newContent);
          const diffEntry = {
            path: params.path,
            name: params.path.split(/[/\\]/).pop(),
            status: 'modified',
            additions: diff.additions,
            deletions: diff.deletions,
            lines: diff.lines
          };

          const fileRow = createFileChangeRow(diffEntry);
          stream.appendChild(fileRow);
          stream.scrollTop = stream.scrollHeight;

          if (APP_STATE.activeSession) {
            APP_STATE.activeSession.turns.push({ type: 'file_change', ...diffEntry });
            if (!APP_STATE.activeSession.diffEntries) APP_STATE.activeSession.diffEntries = [];
            APP_STATE.activeSession.diffEntries.push(diffEntry);
            saveActiveSession();
          }
          updateDiffUI(APP_STATE.activeSession?.diffEntries || [diffEntry]);
          refreshIdeFileTree();
        }
        return res;
      }

      case 'delete_file': {
        const res = await window.freeai.deleteFile({ workspacePath: ws, filePath: params.path });
        if (res.success) {
          const fileRow = createFileChangeRow({ path: params.path, additions: 0, deletions: 1 });
          stream.appendChild(fileRow);
          refreshFileTree();
          refreshIdeFileTree();
        }
        return res;
      }

      case 'run_command': {
        const res = await window.freeai.executeCmd({ workspacePath: ws, command: params.command, timeoutMs: 60000 });
        const termItem = {
          type: 'terminal',
          command: params.command,
          executionTimeMs: res.executionTimeMs || 50,
          output: res.stdout || res.stderr || '(Keine Ausgabe)'
        };
        const termRow = createTerminalRow(termItem);
        stream.appendChild(termRow);
        stream.scrollTop = stream.scrollHeight;
        if (APP_STATE.activeSession) {
          APP_STATE.activeSession.turns.push(termItem);
          saveActiveSession();
        }
        return res;
      }

      case 'create_plan': {
        const rawSteps = params.steps || [];
        const planItem = {
          type: 'plan',
          id: Date.now(),
          title: params.title || 'Aufgabenplan',
          steps: rawSteps.map((s, idx) => ({
            id: s.id !== undefined ? s.id : idx + 1,
            title: typeof s === 'string' ? s : (s.title || `Schritt ${idx + 1}`),
            done: !!s.done
          }))
        };

        const planCard = createPlanCard(planItem);
        stream.appendChild(planCard);
        stream.scrollTop = stream.scrollHeight;

        if (APP_STATE.activeSession) {
          APP_STATE.activeSession.turns.push(planItem);
          saveActiveSession();
        }

        return {
          success: true,
          message: `Plan mit ${planItem.steps.length} Schritten erfolgreich erstellt.`,
          totalSteps: planItem.steps.length
        };
      }

      case 'step_done': {
        const targetId = params.stepId !== undefined ? Number(params.stepId) : null;
        let doneCount = 0;
        let totalCount = 0;

        if (APP_STATE.activeSession && APP_STATE.activeSession.turns) {
          for (const turn of APP_STATE.activeSession.turns) {
            if (turn.type === 'plan' && turn.steps) {
              const step = targetId !== null
                ? turn.steps.find(s => Number(s.id) === targetId)
                : turn.steps.find(s => !s.done);
              if (step) step.done = true;
              doneCount = turn.steps.filter(s => s.done).length;
              totalCount = turn.steps.length;
            }
          }
          saveActiveSession();
        }

        const cards = stream.querySelectorAll('.plan-checklist-card');
        const card = cards.length ? cards[cards.length - 1] : null;
        if (card) {
          if (targetId !== null) {
            const row = card.querySelector(`.plan-step-row[data-step-id="${targetId}"]`);
            if (row) {
              row.classList.add('is-done');
              const cb = row.querySelector('.plan-checkbox');
              if (cb) {
                cb.classList.add('checked');
                cb.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
              }
            }
          } else {
            const nextPendingRow = card.querySelector('.plan-step-row:not(.is-done)');
            if (nextPendingRow) {
              nextPendingRow.classList.add('is-done');
              const cb = nextPendingRow.querySelector('.plan-checkbox');
              if (cb) {
                cb.classList.add('checked');
                cb.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
              }
            }
          }
          const counterEl = card.querySelector('.plan-count-label');
          if (counterEl && totalCount > 0) {
            counterEl.textContent = `${doneCount} von ${totalCount} Aufgaben erledigt`;
          }
        }

        const activePlan = APP_STATE.activeSession?.turns?.slice().reverse().find(t => t.type === 'plan');
        if (activePlan) {
          updatePinnedPlanWidget(activePlan);
        }

        return {
          success: true,
          message: `Schritt als erledigt markiert. (${doneCount}/${totalCount})`,
          doneCount,
          totalCount
        };
      }

      default:
        return { success: false, error: `Unbekanntes Tool: ${tool}` };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── Right Panel & Diff Viewer ─────────────────────────
function openRightTab(tabName) {
  APP_STATE.activeRightTab = tabName;
  APP_STATE.rightPanelOpen = true;

  const panel = document.getElementById('right-panel');
  panel.classList.remove('hidden');

  document.querySelectorAll('.r-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
  document.querySelectorAll('.right-tab-content').forEach(tc => tc.classList.toggle('active', tc.id === `panel-tab-${tabName}`));
}

function updateDiffUI(diffEntries) {
  const container = document.getElementById('diff-files-list');
  container.innerHTML = '';

  const totalAdd = diffEntries.reduce((acc, f) => acc + (f.additions || 0), 0);
  const totalDel = diffEntries.reduce((acc, f) => acc + (f.deletions || 0), 0);

  document.getElementById('diff-total-files').textContent = `${diffEntries.length} file${diffEntries.length !== 1 ? 's' : ''} changed`;
  document.getElementById('diff-stat-add').textContent = `+${totalAdd}`;
  document.getElementById('diff-stat-del').textContent = `-${totalDel}`;

  if (diffEntries.length === 0) {
    container.innerHTML = '<div style="padding:32px;color:var(--text-muted);text-align:center;font-size:12px;">Noch keine Dateiänderungen</div>';
    return;
  }

  diffEntries.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'diff-card open';
    card.dataset.file = entry.path;

    const badgeLabel = entry.status === 'new' ? 'NEW' : entry.status === 'deleted' ? 'DEL' : 'MOD';

    card.innerHTML = `
      <div class="diff-card-header">
        <span class="diff-badge ${entry.status}">${badgeLabel}</span>
        <span class="diff-path">${escHtml(entry.path)}</span>
        <span class="diff-counters"><span class="add">+${entry.additions || 0}</span> <span class="del">-${entry.deletions || 0}</span></span>
      </div>
      <div class="diff-body-pre">
        ${(entry.lines || []).map(l => {
          const cls = l.type === 'add' ? 'add' : l.type === 'del' ? 'del' : l.type === 'hunk' ? 'hunk' : '';
          const prefix = l.type === 'add' ? '+' : l.type === 'del' ? '-' : l.type === 'hunk' ? '' : ' ';
          return `<div class="d-line ${cls}"><span class="d-num">${l.lineNum || ''}</span><span class="d-content">${prefix}${escHtml(l.content || '')}</span></div>`;
        }).join('')}
      </div>
    `;

    card.querySelector('.diff-card-header').addEventListener('click', () => {
      card.classList.toggle('open');
    });

    container.appendChild(card);
  });
}

// ── File Tree ─────────────────────────────────────────
async function refreshFileTree() {
  if (!APP_STATE.workspace) return;
  const res = await window.freeai.listFiles({ workspacePath: APP_STATE.workspace });
  const container = document.getElementById('file-tree-container');
  container.innerHTML = '';
  document.getElementById('file-explorer-path').textContent = APP_STATE.workspace;

  if (!res.success || !res.files || res.files.length === 0) {
    container.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:12px;">Ordner ist leer</div>';
    return;
  }

  res.files.forEach(f => {
    const item = document.createElement('div');
    item.className = `f-item ${f.type}`;
    const depth = (f.path.match(/\//g) || []).length;
    const icon = f.type === 'directory'
      ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>'
      : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
    item.innerHTML = `<span style="display:inline-block;width:${depth * 14}px"></span>${icon} <span>${escHtml(f.name)}</span>`;
    container.appendChild(item);
  });
}

// ── Project Picker Dropdown ───────────────────────────
function openProjectPicker() {
  const modal = document.getElementById('project-picker-modal');
  modal.classList.remove('hidden');
  renderProjectPickerList();
  document.getElementById('project-search-input').focus();
}

function closeProjectPicker() {
  document.getElementById('project-picker-modal').classList.add('hidden');
}

function renderProjectPickerList() {
  const container = document.getElementById('project-dropdown-list');
  const search = document.getElementById('project-search-input').value.toLowerCase();
  container.innerHTML = '';

  APP_STATE.projects
    .filter(p => p.name.toLowerCase().includes(search) || p.path.toLowerCase().includes(search))
    .forEach(p => {
      const isAct = APP_STATE.activeProject?.id === p.id;
      const item = document.createElement('div');
      item.className = `dropdown-item ${isAct ? 'active' : ''}`;
      item.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;">${escHtml(p.name)}</span>
        ${isAct ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
      `;
      item.addEventListener('click', () => {
        selectProject(p);
        closeProjectPicker();
      });
      container.appendChild(item);
    });
}

// ── Toast Notifications ───────────────────────────────
function showToast(title, desc, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : '⚡'}</span>
    <div>
      <div class="toast-title">${escHtml(title)}</div>
      ${desc ? `<div class="toast-desc">${escHtml(desc)}</div>` : ''}
    </div>
  `;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Setup UI Event Listeners ──────────────────────────
function setupEventListeners() {
  document.getElementById('btn-new-conv').addEventListener('click', startNewConversation);
  document.getElementById('empty-project-trigger').addEventListener('click', openProjectPicker);
  document.getElementById('breadcrumb').addEventListener('click', openProjectPicker);
  document.getElementById('project-search-input').addEventListener('input', renderProjectPickerList);

  document.getElementById('act-new-project').addEventListener('click', async () => {
    closeProjectPicker();
    const folder = await window.freeai.pickFolder();
    if (folder) {
      const proj = await window.freeai.addProject({ path: folder });
      APP_STATE.projects = await window.freeai.listProjects();
      selectProject(proj);
    }
  });

  document.getElementById('btn-add-project').addEventListener('click', async () => {
    const folder = await window.freeai.pickFolder();
    if (folder) {
      const proj = await window.freeai.addProject({ path: folder });
      APP_STATE.projects = await window.freeai.listProjects();
      selectProject(proj);
    }
  });

  document.getElementById('act-no-project').addEventListener('click', () => {
    selectProject(null);
    closeProjectPicker();
  });

  document.getElementById('project-picker-modal').addEventListener('click', (e) => {
    if (e.target.id === 'project-picker-modal') closeProjectPicker();
  });

  // Prompt Hero Box
  const heroInput = document.getElementById('prompt-input-hero');
  const heroSendBtn = document.getElementById('btn-send-hero');
  heroInput.addEventListener('input', () => {
    heroSendBtn.classList.toggle('active', heroInput.value.trim().length > 0);
  });
  heroInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executePrompt(heroInput.value);
    }
  });
  heroSendBtn.addEventListener('click', () => executePrompt(heroInput.value));

  // Prompt Bottom Box
  const bottomInput = document.getElementById('prompt-input-bottom');
  const bottomSendBtn = document.getElementById('btn-send-bottom');
  bottomInput.addEventListener('input', () => {
    bottomSendBtn.classList.toggle('active', bottomInput.value.trim().length > 0);
  });
  bottomInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executePrompt(bottomInput.value);
    }
  });
  bottomSendBtn.addEventListener('click', () => executePrompt(bottomInput.value));

  // Stop Agent Buttons
  const stopAgentHandler = async () => {
    await window.freeai.stopAgent();
    APP_STATE.isAgentRunning = false;
    if (APP_STATE.agentTimerInterval) clearInterval(APP_STATE.agentTimerInterval);
    setAgentRunningUI(false);
    document.getElementById('chatgpt-status-dot').className = 'status-indicator-dot';
    document.getElementById('chatgpt-status-label').textContent = 'ChatGPT Connected';
    showToast('⏹ Agent gestoppt', 'Der Agent wurde manuell gestoppt.', 'info');
  };
  document.getElementById('btn-stop-hero').addEventListener('click', stopAgentHandler);
  document.getElementById('btn-stop-bottom').addEventListener('click', stopAgentHandler);

  // Right Panel Tabs
  document.querySelectorAll('.r-tab').forEach(tab => {
    tab.addEventListener('click', () => openRightTab(tab.dataset.tab));
  });
  document.getElementById('btn-close-right-panel').addEventListener('click', () => {
    document.getElementById('right-panel').classList.add('hidden');
    APP_STATE.rightPanelOpen = false;
  });
  document.getElementById('btn-toggle-diff-header').addEventListener('click', () => {
    if (APP_STATE.rightPanelOpen) {
      document.getElementById('right-panel').classList.add('hidden');
      APP_STATE.rightPanelOpen = false;
    } else {
      openRightTab('diff');
    }
  });

  // ChatGPT Webview Drawer
  document.getElementById('btn-chatgpt-browser').addEventListener('click', async () => {
    const visible = await window.freeai.toggleChatView();
    const overlay = document.getElementById('chatgpt-drawer-overlay');
    overlay.classList.toggle('hidden', !visible);
  });
  document.getElementById('btn-close-chatgpt-drawer').addEventListener('click', async () => {
    await window.freeai.toggleChatView(false);
    document.getElementById('chatgpt-drawer-overlay').classList.add('hidden');
  });

  document.getElementById('btn-refresh-tree').addEventListener('click', refreshFileTree);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeProjectPicker();
      hideConversationContextMenu();
      document.getElementById('rename-modal-overlay').classList.add('hidden');
      document.getElementById('chatgpt-drawer-overlay').classList.add('hidden');
      window.freeai.toggleChatView(false);
    }
  });
}

// ── Titlebar Menus & Shortcuts ────────────────────────
function setupTitlebarMenus() {
  const menuWrappers = [
    { id: 'tb-menu-file', dropdownId: 'dropdown-file' },
    { id: 'tb-menu-view', dropdownId: 'dropdown-view' },
    { id: 'tb-menu-window', dropdownId: 'dropdown-window' }
  ];

  function closeAllMenus() {
    document.querySelectorAll('.tb-dropdown-menu').forEach(m => m.classList.add('hidden'));
    document.querySelectorAll('.tb-menu-item').forEach(b => b.classList.remove('active'));
  }

  menuWrappers.forEach(({ id, dropdownId }) => {
    const btn = document.getElementById(id);
    const dd = document.getElementById(dropdownId);
    if (!btn || !dd) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isCurrentlyHidden = dd.classList.contains('hidden');
      closeAllMenus();
      if (isCurrentlyHidden) {
        dd.classList.remove('hidden');
        btn.classList.add('active');
      }
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.tb-menu-wrapper')) {
      closeAllMenus();
    }
  });

  // Menu Actions: File
  document.getElementById('item-new-conv')?.addEventListener('click', () => {
    closeAllMenus();
    startNewConversation();
  });
  document.getElementById('item-create-project')?.addEventListener('click', () => {
    closeAllMenus();
    document.getElementById('btn-add-project').click();
  });
  document.getElementById('item-command-palette')?.addEventListener('click', () => {
    closeAllMenus();
    openProjectPicker();
  });

  // Menu Actions: View
  document.getElementById('item-zoom-in')?.addEventListener('click', async () => {
    closeAllMenus();
    const current = await window.freeai.getZoom();
    await window.freeai.setZoom(current + 0.5);
  });
  document.getElementById('item-zoom-out')?.addEventListener('click', async () => {
    closeAllMenus();
    const current = await window.freeai.getZoom();
    await window.freeai.setZoom(Math.max(-2, current - 0.5));
  });
  document.getElementById('item-zoom-reset')?.addEventListener('click', async () => {
    closeAllMenus();
    await window.freeai.setZoom(0);
  });

  // Menu Actions: Window
  document.getElementById('item-win-minimize')?.addEventListener('click', () => {
    closeAllMenus();
    window.freeai.minimizeWindow();
  });
  document.getElementById('item-win-maximize')?.addEventListener('click', () => {
    closeAllMenus();
    window.freeai.maximizeWindow();
  });
  document.getElementById('item-win-close')?.addEventListener('click', () => {
    closeAllMenus();
    window.freeai.closeWindow();
  });

  // Global Keyboard Shortcuts
  document.addEventListener('keydown', async (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'O' || e.key === 'o')) {
      e.preventDefault();
      startNewConversation();
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
      e.preventDefault();
      openProjectPicker();
    }
    if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      const current = await window.freeai.getZoom();
      await window.freeai.setZoom(current + 0.5);
    }
    if (e.ctrlKey && e.key === '-') {
      e.preventDefault();
      const current = await window.freeai.getZoom();
      await window.freeai.setZoom(Math.max(-2, current - 0.5));
    }
    if (e.ctrlKey && e.key === '0') {
      e.preventDefault();
      await window.freeai.setZoom(0);
    }
  });
}

// ── Image Attachment Handling ─────────────────────────
function renderAttachedImages() {
  const trays = [document.getElementById('image-tray-hero'), document.getElementById('image-tray-bottom')];
  trays.forEach(tray => {
    if (!tray) return;
    tray.innerHTML = '';
    if (ATTACHED_IMAGES.length === 0) {
      tray.classList.add('hidden');
      return;
    }
    tray.classList.remove('hidden');

    ATTACHED_IMAGES.forEach((img, idx) => {
      const chip = document.createElement('div');
      chip.className = 'image-attachment-chip';
      chip.innerHTML = `
        <img src="${img.dataUrl}" alt="${escHtml(img.name)}" class="chip-thumb" />
        <span class="chip-name" title="${escHtml(img.name)}">${escHtml(img.name)}</span>
        <span class="chip-remove" data-index="${idx}" title="Entfernen">✕</span>
      `;
      chip.querySelector('.chip-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        ATTACHED_IMAGES.splice(idx, 1);
        renderAttachedImages();
      });
      tray.appendChild(chip);
    });
  });
}

function setupImageAttachments() {
  const heroAddBtn = document.getElementById('btn-add-context');
  const bottomAddBtn = document.getElementById('btn-add-context-bottom');

  const onAddImage = async () => {
    const img = await window.freeai.pickImage();
    if (img) {
      ATTACHED_IMAGES.push(img);
      renderAttachedImages();
      showToast('🖼️ Bild angehängt', img.name, 'success', 2500);
    }
  };

  heroAddBtn && heroAddBtn.addEventListener('click', onAddImage);
  bottomAddBtn && bottomAddBtn.addEventListener('click', onAddImage);

  // Drag and drop on prompt cards
  const setupCardDnd = (cardEl) => {
    if (!cardEl) return;
    cardEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      cardEl.classList.add('drag-over');
    });
    cardEl.addEventListener('dragleave', () => {
      cardEl.classList.remove('drag-over');
    });
    cardEl.addEventListener('drop', (e) => {
      e.preventDefault();
      cardEl.classList.remove('drag-over');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        for (const file of e.dataTransfer.files) {
          if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (re) => {
              ATTACHED_IMAGES.push({
                name: file.name,
                size: file.size,
                ext: file.name.split('.').pop() || 'png',
                dataUrl: re.target.result
              });
              renderAttachedImages();
              showToast('🖼️ Bild angehängt', file.name, 'success', 2500);
            };
            reader.readAsDataURL(file);
          }
        }
      }
    });
  };

  setupCardDnd(document.getElementById('card-prompt-hero'));
  setupCardDnd(document.getElementById('card-prompt-bottom'));

  // Paste image handler on textareas
  const setupPaste = (inputEl) => {
    if (!inputEl) return;
    inputEl.addEventListener('paste', (e) => {
      if (e.clipboardData && e.clipboardData.items) {
        for (const item of e.clipboardData.items) {
          if (item.type.indexOf('image') !== -1) {
            const file = item.getAsFile();
            if (file) {
              const reader = new FileReader();
              reader.onload = (re) => {
                ATTACHED_IMAGES.push({
                  name: `screenshot-${Date.now().toString().slice(-4)}.png`,
                  size: file.size,
                  ext: 'png',
                  dataUrl: re.target.result
                });
                renderAttachedImages();
                showToast('📋 Screenshot angehängt', 'Aus Zwischenablage eingefügt', 'success', 2500);
              };
              reader.readAsDataURL(file);
            }
          }
        }
      }
    });
  };

  setupPaste(document.getElementById('prompt-input-hero'));
  setupPaste(document.getElementById('prompt-input-bottom'));
}

// ── Speech-to-Text (Microphone & Web Audio Engine) ────
let MEDIA_RECORDER = null;
let AUDIO_STREAM = null;
let RECORDED_CHUNKS = [];
let SPEECH_REC_INSTANCE = null;

async function startVoiceRecording(targetInput) {
  try {
    ACTIVE_MIC_INPUT = targetInput;
    MIC_BASE_TEXT = targetInput.value.trim();
    IS_RECORDING = true;
    RECORDED_CHUNKS = [];

    const micHero = document.getElementById('btn-mic-hero');
    const micBottom = document.getElementById('btn-mic-bottom');
    if (micHero) micHero.classList.add('recording');
    if (micBottom) micBottom.classList.add('recording');

    // 1. Capture Microphone Stream
    AUDIO_STREAM = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // 2. Setup MediaRecorder
    MEDIA_RECORDER = new MediaRecorder(AUDIO_STREAM);
    MEDIA_RECORDER.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) RECORDED_CHUNKS.push(e.data);
    };
    MEDIA_RECORDER.start(100);

    // 3. Try Web Speech API for live interim feedback
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        SPEECH_REC_INSTANCE = new SpeechRec();
        SPEECH_REC_INSTANCE.continuous = true;
        SPEECH_REC_INSTANCE.interimResults = true;
        SPEECH_REC_INSTANCE.lang = 'de-DE';
        SPEECH_REC_INSTANCE.onresult = (event) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            interim += event.results[i][0].transcript;
          }
          if (ACTIVE_MIC_INPUT && interim) {
            ACTIVE_MIC_INPUT.value = (MIC_BASE_TEXT ? MIC_BASE_TEXT + ' ' : '') + interim;
            ACTIVE_MIC_INPUT.dispatchEvent(new Event('input'));
            ACTIVE_MIC_INPUT.scrollTop = ACTIVE_MIC_INPUT.scrollHeight;
          }
        };
        SPEECH_REC_INSTANCE.onerror = () => {};
        SPEECH_REC_INSTANCE.start();
      } catch (e) {
        console.log('Web Speech interim init:', e.message);
      }
    }

    showToast('🎙️ Spracheingabe aktiv', 'Sprich jetzt... Klicke erneut auf das Mikrofon zum Beenden.', 'info', 4000);
  } catch (err) {
    console.error('Microphone error:', err);
    IS_RECORDING = false;
    const micHero = document.getElementById('btn-mic-hero');
    const micBottom = document.getElementById('btn-mic-bottom');
    if (micHero) micHero.classList.remove('recording');
    if (micBottom) micBottom.classList.remove('recording');
    showToast('Mikrofonfehler', 'Zugriff auf das Mikrofon fehlgeschlagen: ' + err.message, 'error');
  }
}

async function stopVoiceRecording() {
  if (!IS_RECORDING) return;
  IS_RECORDING = false;

  const micHero = document.getElementById('btn-mic-hero');
  const micBottom = document.getElementById('btn-mic-bottom');
  if (micHero) micHero.classList.remove('recording');
  if (micBottom) micBottom.classList.remove('recording');

  if (SPEECH_REC_INSTANCE) {
    try { SPEECH_REC_INSTANCE.stop(); } catch {}
    SPEECH_REC_INSTANCE = null;
  }

  if (MEDIA_RECORDER && MEDIA_RECORDER.state !== 'inactive') {
    MEDIA_RECORDER.stop();
  }
  if (AUDIO_STREAM) {
    AUDIO_STREAM.getTracks().forEach(t => t.stop());
    AUDIO_STREAM = null;
  }

  showToast('⏳ Verarbeite Sprache...', 'Audio wird in Text umgewandelt...', 'info', 2000);

  // Convert WebM/Audio chunks to WAV PCM via Web Audio
  setTimeout(async () => {
    try {
      if (RECORDED_CHUNKS.length === 0) return;
      const blob = new Blob(RECORDED_CHUNKS, { type: 'audio/webm' });
      const arrayBuffer = await blob.arrayBuffer();
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      // Convert AudioBuffer to 16-bit PCM WAV
      const wavBuffer = audioBufferToWav(decodedBuffer);
      const base64Wav = bufferToBase64(wavBuffer);

      const result = await window.freeai.transcribeAudio(base64Wav);
      if (result && result.success && result.text) {
        if (ACTIVE_MIC_INPUT) {
          const prev = MIC_BASE_TEXT ? MIC_BASE_TEXT + ' ' : '';
          ACTIVE_MIC_INPUT.value = prev + result.text;
          ACTIVE_MIC_INPUT.dispatchEvent(new Event('input'));
          ACTIVE_MIC_INPUT.focus();
        }
        showToast('✅ Spracheingabe eingefügt', result.text, 'success', 3000);
      } else {
        showToast('Spracheingabe', result?.error || 'Kein Text erkannt', 'info', 2500);
      }
    } catch (e) {
      console.warn('WAV processing error:', e);
    }
  }, 300);
}

function audioBufferToWav(buffer) {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const channelData = buffer.getChannelData(0);
  const numSamples = channelData.length;
  const blockAlign = numChannels * (bitDepth / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * (bitDepth / 8);
  
  const bufferLength = 44 + dataSize;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  
  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  
  let offset = 44;
  for (let i = 0; i < numSamples; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  
  return arrayBuffer;
}

function bufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function setupSpeechRecognition() {
  // Mikrofon-Funktion vorübergehend gesperrt
}

// ── App Mode Switcher (Kortex Studio <-> IDE Mode) ────
function switchAppMode(mode) {
  APP_STATE.appMode = mode;
  const kortexView = document.getElementById('kortex-studio-view');
  const ideView = document.getElementById('ide-view');

  if (mode === 'ide') {
    kortexView.classList.add('hidden');
    ideView.classList.remove('hidden');

    const wsName = APP_STATE.activeProject?.name || 'FreeAI';
    const projLabel = document.getElementById('ide-title-project-name');
    const folderLabel = document.getElementById('ide-workspace-folder-label');
    const bcWs = document.getElementById('ide-bc-workspace');
    if (projLabel) projLabel.textContent = wsName;
    if (folderLabel) folderLabel.textContent = wsName.toUpperCase();
    if (bcWs) bcWs.textContent = wsName;

    // Synchronize file tree, tabs, open editors, agent stream
    refreshIdeFileTree();
    renderOpenEditorsList();
    renderIdeTabs();
    if (APP_STATE.activeSession) {
      renderIdeAgentStream(APP_STATE.activeSession);
    }

    // Auto-open first file if none open
    if (!APP_STATE.activeEditorPath && APP_STATE.workspace) {
      autoOpenDefaultFile();
    }
  } else {
    ideView.classList.add('hidden');
    kortexView.classList.remove('hidden');

    if (APP_STATE.activeSession) {
      renderConversationTurns(APP_STATE.activeSession);
    }
  }
}

// ── Auto-Open Default File in IDE ─────────────────────
async function autoOpenDefaultFile() {
  if (!APP_STATE.workspace) return;
  const res = await window.freeai.listFiles({ workspacePath: APP_STATE.workspace, maxDepth: 2 });
  if (res.success && res.files && res.files.length > 0) {
    const preferredNames = ['bridge-server.js', 'package.json', 'README.md', 'main.js', 'index.js', 'index.html'];
    let target = res.files.find(f => f.type === 'file' && preferredNames.includes(f.path.split(/[/\\]/).pop()));
    if (!target) {
      target = res.files.find(f => f.type === 'file');
    }
    if (target) {
      openFileInEditor(target.path);
    }
  }
}

// ── IDE File Explorer Tree ────────────────────────────
async function refreshIdeFileTree() {
  if (!APP_STATE.workspace) return;
  const res = await window.freeai.listFiles({ workspacePath: APP_STATE.workspace, maxDepth: 6 });
  if (!res || !res.success || !res.files) return;
  APP_STATE.fileTreeData = res.files;
  renderIdeFileTree();
}

function renderIdeFileTree() {
  const container = document.getElementById('ide-file-tree-root');
  if (!container) return;
  container.innerHTML = '';

  if (!APP_STATE.fileTreeData || APP_STATE.fileTreeData.length === 0) {
    container.innerHTML = '<div class="ide-empty-hint">Ordner ist leer</div>';
    return;
  }

  const tree = buildTreeFromFlatList(APP_STATE.fileTreeData);
  renderTreeNode(tree, container, 0);
}

function buildTreeFromFlatList(files) {
  const root = { name: '', isDir: true, path: '', children: {} };
  files.forEach(f => {
    const parts = f.path.split('/');
    let curr = root;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const isLast = i === parts.length - 1;
      const fullPath = parts.slice(0, i + 1).join('/');
      if (!curr.children[p]) {
        curr.children[p] = {
          name: p,
          path: fullPath,
          isDir: isLast ? (f.type === 'directory') : true,
          size: f.size || 0,
          children: {}
        };
      }
      curr = curr.children[p];
    }
  });
  return root;
}

function renderTreeNode(node, containerEl, depth = 0) {
  const sortedKeys = Object.keys(node.children).sort((a, b) => {
    const na = node.children[a];
    const nb = node.children[b];
    if (na.isDir && !nb.isDir) return -1;
    if (!na.isDir && nb.isDir) return 1;
    return a.localeCompare(b);
  });

  sortedKeys.forEach(k => {
    const child = node.children[k];
    const row = document.createElement('div');
    row.className = 'tree-node' + (APP_STATE.activeEditorPath === child.path ? ' active' : '');
    row.dataset.path = child.path;

    const isExpanded = APP_STATE.expandedFolders.has(child.path);
    const indentWidth = depth * 14;

    const ext = (child.name.split('.').pop() || '').toLowerCase();
    const iconHtml = child.isDir
      ? `<span class="tree-chevron ${isExpanded ? 'open' : ''}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></span><span class="tree-icon icon-folder">📁</span>`
      : `<span class="tree-indent" style="width:14px"></span>${getFileIconHtml(ext, child.name)}`;

    row.innerHTML = `
      <span class="tree-indent" style="width:${indentWidth}px"></span>
      ${iconHtml}
      <span class="tree-label">${escHtml(child.name)}</span>
    `;

    if (child.isDir) {
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        if (APP_STATE.expandedFolders.has(child.path)) {
          APP_STATE.expandedFolders.delete(child.path);
        } else {
          APP_STATE.expandedFolders.add(child.path);
        }
        renderIdeFileTree();
      });
      containerEl.appendChild(row);

      if (isExpanded) {
        renderTreeNode(child, containerEl, depth + 1);
      }
    } else {
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        openFileInEditor(child.path);
      });
      containerEl.appendChild(row);
    }
  });
}

function getFileIconHtml(ext, name = '') {
  if (ext === 'js' || ext === 'mjs' || ext === 'cjs') return '<span class="tree-icon icon-js">JS</span>';
  if (ext === 'ts' || ext === 'tsx') return '<span class="tree-icon icon-ts">TS</span>';
  if (ext === 'json') return '<span class="tree-icon icon-json">{}</span>';
  if (ext === 'html' || ext === 'htm') return '<span class="tree-icon icon-html">&lt;&gt;</span>';
  if (ext === 'css' || ext === 'scss' || ext === 'less') return '<span class="tree-icon icon-css">#</span>';
  if (ext === 'md' || ext === 'markdown') return '<span class="tree-icon icon-md">M↓</span>';
  if (ext === 'ps1' || ext === 'bat' || ext === 'sh' || ext === 'cmd') return '<span class="tree-icon icon-ps1">&gt;_</span>';
  if (ext === 'py') return '<span class="tree-icon icon-py">PY</span>';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) return '<span class="tree-icon icon-img">🖼</span>';
  return '<span class="tree-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>';
}

// ── Multi-Tab Code Editor & Image Viewer ──────────────
async function openFileInEditor(filePath, forceContent = null) {
  let editor = APP_STATE.openEditors.find(e => e.path === filePath);

  if (!editor) {
    let content = forceContent;
    let isImage = false;
    let dataUrl = '';
    let size = 0;

    const name = filePath.split(/[/\\]/).pop() || 'Untitled';
    const ext = (name.split('.').pop() || '').toLowerCase();
    const imgExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];

    if (content === null) {
      const res = await window.freeai.readFile({ workspacePath: APP_STATE.workspace, filePath });
      if (res.success) {
        if (res.isImage || imgExts.includes(ext)) {
          isImage = true;
          dataUrl = res.dataUrl || '';
          size = res.size || 0;
        } else {
          content = res.content || '';
        }
      } else {
        content = '';
      }
    } else if (imgExts.includes(ext)) {
      isImage = true;
      dataUrl = forceContent;
    }

    editor = {
      path: filePath,
      name,
      ext,
      isImage,
      dataUrl,
      size,
      content: content || '',
      originalContent: content || '',
      isDirty: false
    };
    APP_STATE.openEditors.push(editor);
  }

  APP_STATE.activeEditorPath = filePath;
  renderIdeTabs();
  renderOpenEditorsList();
  displayActiveEditorContent();
  renderIdeFileTree();
}

function closeEditorTab(filePath, e = null) {
  if (e) e.stopPropagation();
  const idx = APP_STATE.openEditors.findIndex(ed => ed.path === filePath);
  if (idx === -1) return;

  APP_STATE.openEditors.splice(idx, 1);

  if (APP_STATE.activeEditorPath === filePath) {
    if (APP_STATE.openEditors.length > 0) {
      const nextIdx = Math.min(idx, APP_STATE.openEditors.length - 1);
      APP_STATE.activeEditorPath = APP_STATE.openEditors[nextIdx].path;
    } else {
      APP_STATE.activeEditorPath = null;
    }
  }

  renderIdeTabs();
  renderOpenEditorsList();
  displayActiveEditorContent();
}

function renderIdeTabs() {
  const container = document.getElementById('ide-tabs-list');
  if (!container) return;
  container.innerHTML = '';

  APP_STATE.openEditors.forEach(ed => {
    const isActive = ed.path === APP_STATE.activeEditorPath;
    const tab = document.createElement('div');
    tab.className = `ide-tab ${isActive ? 'active' : ''} ${ed.isDirty ? 'dirty' : ''}`;
    tab.dataset.path = ed.path;

    tab.innerHTML = `
      ${getFileIconHtml(ed.ext, ed.name)}
      <span class="ide-tab-title">${escHtml(ed.name)}</span>
      <span class="ide-tab-dirty"></span>
      <span class="ide-tab-close" title="Schließen">✕</span>
    `;

    tab.addEventListener('click', () => {
      APP_STATE.activeEditorPath = ed.path;
      renderIdeTabs();
      renderOpenEditorsList();
      displayActiveEditorContent();
    });

    tab.querySelector('.ide-tab-close').addEventListener('click', (ev) => {
      closeEditorTab(ed.path, ev);
    });

    container.appendChild(tab);
  });
}

function renderOpenEditorsList() {
  const listEl = document.getElementById('list-open-editors');
  if (!listEl) return;
  listEl.innerHTML = '';

  if (APP_STATE.openEditors.length === 0) {
    listEl.innerHTML = '<div class="ide-empty-hint">Keine Editoren geöffnet</div>';
    return;
  }

  APP_STATE.openEditors.forEach(ed => {
    const isActive = ed.path === APP_STATE.activeEditorPath;
    const row = document.createElement('div');
    row.className = `open-editor-row ${isActive ? 'active' : ''}`;
    row.dataset.path = ed.path;

    row.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;overflow:hidden;text-overflow:ellipsis;">
        ${getFileIconHtml(ed.ext, ed.name)}
        <span>${escHtml(ed.name)}</span>
        <span style="color:#666;font-size:10px;margin-left:4px;">${escHtml(ed.path)}</span>
      </div>
      <span class="close-tab-icon">✕</span>
    `;

    row.addEventListener('click', () => {
      APP_STATE.activeEditorPath = ed.path;
      renderIdeTabs();
      renderOpenEditorsList();
      displayActiveEditorContent();
    });

    row.querySelector('.close-tab-icon').addEventListener('click', (ev) => {
      closeEditorTab(ed.path, ev);
    });

    listEl.appendChild(row);
  });
}

function displayActiveEditorContent() {
  const textarea = document.getElementById('ide-code-textarea');
  const codeLayer = document.getElementById('ide-highlighted-code');
  const gutter = document.getElementById('ide-line-numbers');
  const minimap = document.getElementById('ide-minimap-code');
  const titleFile = document.getElementById('ide-title-active-file');
  const bcFile = document.getElementById('ide-bc-file');
  const bcSymbol = document.getElementById('ide-bc-symbol-name');
  const sbLang = document.getElementById('sb-language');

  const editorMain = document.getElementById('ide-code-editor-main');
  const imageViewer = document.getElementById('ide-image-viewer');
  const diffViewer = document.getElementById('ide-diff-viewport');
  const splitPreview = document.getElementById('ide-split-preview');

  if (!APP_STATE.activeEditorPath) {
    if (editorMain) editorMain.classList.remove('hidden');
    if (imageViewer) imageViewer.classList.add('hidden');
    if (diffViewer) diffViewer.classList.add('hidden');
    if (textarea) textarea.value = '';
    if (codeLayer) codeLayer.innerHTML = '<span style="color:#666;">Keine Datei geöffnet. Klicke im Explorer auf eine Datei oder erstelle eine neue Datei.</span>';
    if (gutter) gutter.innerHTML = '<div>1</div>';
    if (minimap) minimap.textContent = '';
    if (splitPreview) splitPreview.textContent = '';
    if (titleFile) titleFile.textContent = 'Untitled';
    if (bcFile) bcFile.textContent = 'None';
    if (bcSymbol) bcSymbol.textContent = 'None';
    if (sbLang) sbLang.textContent = 'Plain Text';
    return;
  }

  const editor = APP_STATE.openEditors.find(e => e.path === APP_STATE.activeEditorPath);
  if (!editor) return;

  if (titleFile) titleFile.textContent = editor.name;
  if (bcFile) bcFile.textContent = editor.name;

  if (editor.isImage) {
    // Show Image Viewer
    if (editorMain) editorMain.classList.add('hidden');
    if (diffViewer) diffViewer.classList.add('hidden');
    if (imageViewer) imageViewer.classList.remove('hidden');

    const imgEl = document.getElementById('img-viewer-element');
    const nameEl = document.getElementById('img-viewer-filename');
    const dimEl = document.getElementById('img-viewer-dimensions');
    const sizeEl = document.getElementById('img-viewer-size');

    if (nameEl) nameEl.textContent = editor.name;
    if (sizeEl) sizeEl.textContent = editor.size ? `${(editor.size / 1024).toFixed(1)} KB` : 'Image';
    if (sbLang) sbLang.textContent = `Image (${editor.ext.toUpperCase()})`;

    if (imgEl) {
      imgEl.src = editor.dataUrl;
      imgEl.onload = () => {
        if (dimEl) dimEl.textContent = `${imgEl.naturalWidth} × ${imgEl.naturalHeight} px`;
      };
    }
    resetImageZoom();
    return;
  }

  // Text / Code File
  if (imageViewer) imageViewer.classList.add('hidden');
  if (editorMain) editorMain.classList.remove('hidden');

  const content = editor.content || '';
  if (textarea) textarea.value = content;
  if (splitPreview) splitPreview.textContent = content;

  const langMap = {
    js: 'JavaScript', ts: 'TypeScript', json: 'JSON', html: 'HTML', css: 'CSS',
    md: 'Markdown', py: 'Python', ps1: 'PowerShell', bat: 'Batch', c: 'C', cpp: 'C++', rs: 'Rust'
  };
  if (sbLang) sbLang.textContent = langMap[editor.ext] || editor.ext.toUpperCase() || 'Plain Text';

  updateEditorSyntax(content, editor.ext);
}

// Image Zoom Helper State
let currentImgZoom = 1.0;
function setImageZoom(zoom) {
  currentImgZoom = Math.max(0.2, Math.min(zoom, 4.0));
  const imgEl = document.getElementById('img-viewer-element');
  const levelEl = document.getElementById('img-zoom-level');
  if (imgEl) {
    imgEl.style.transform = `scale(${currentImgZoom})`;
  }
  if (levelEl) {
    levelEl.textContent = `${Math.round(currentImgZoom * 100)}%`;
  }
}

function resetImageZoom() {
  setImageZoom(1.0);
}

function setupImageViewerControls() {
  document.getElementById('img-btn-zoom-in')?.addEventListener('click', () => {
    setImageZoom(currentImgZoom + 0.25);
  });
  document.getElementById('img-btn-zoom-out')?.addEventListener('click', () => {
    setImageZoom(currentImgZoom - 0.25);
  });
  document.getElementById('img-btn-reset-zoom')?.addEventListener('click', () => {
    resetImageZoom();
  });
  document.getElementById('img-btn-fit-zoom')?.addEventListener('click', () => {
    const wrap = document.getElementById('image-viewer-canvas-wrap');
    const img = document.getElementById('img-viewer-element');
    if (wrap && img && img.naturalWidth) {
      const scaleX = (wrap.clientWidth - 80) / img.naturalWidth;
      const scaleY = (wrap.clientHeight - 80) / img.naturalHeight;
      setImageZoom(Math.min(scaleX, scaleY, 1.0));
    }
  });
}

function updateEditorSyntax(code, ext) {
  const codeLayer = document.getElementById('ide-highlighted-code');
  const gutter = document.getElementById('ide-line-numbers');
  const minimap = document.getElementById('ide-minimap-code');
  const splitPreview = document.getElementById('ide-split-preview');
  if (splitPreview) splitPreview.textContent = code || '';

  const lines = code.split('\n');
  const totalLines = lines.length;

  let gutterHtml = '';
  for (let i = 1; i <= totalLines; i++) {
    gutterHtml += `<div>${i}</div>`;
  }
  if (gutter) gutter.innerHTML = gutterHtml;

  const highlighted = highlightSyntax(code, ext);
  if (codeLayer) codeLayer.innerHTML = highlighted;

  if (minimap) minimap.textContent = code.substring(0, 3000);
}

function highlightSyntax(code, ext) {
  if (!code) return '';
  const lang = (ext || '').toLowerCase();

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 1. JSON Syntax Highlighting
  if (lang === 'json') {
    const jsonRegex = /("(?:\\.|[^"\\])*")(?:\s*(:))?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|\b(true|false|null)\b|([{}[\],:])/g;
    return code.replace(jsonRegex, (match, strVal, colon, numVal, boolVal, punct) => {
      if (strVal) {
        if (colon) {
          return `<span class="tok-prop">${escapeHtml(strVal)}</span>${colon}`;
        }
        return `<span class="tok-str">${escapeHtml(strVal)}</span>`;
      }
      if (numVal) {
        return `<span class="tok-num">${escapeHtml(numVal)}</span>`;
      }
      if (boolVal) {
        return `<span class="tok-kw">${escapeHtml(boolVal)}</span>`;
      }
      if (punct) {
        return `<span class="tok-op">${escapeHtml(punct)}</span>`;
      }
      return escapeHtml(match);
    });
  }

  // 2. General Code Syntax Highlighting (JS, TS, Python, CSS, HTML, C, CPP, Rust, etc.)
  const codeRegex = /((?:\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*))|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b(?:function|async|await|return|const|let|var|import|export|from|class|extends|if|else|switch|case|try|catch|finally|throw|new|this|typeof|instanceof|true|false|null|undefined|while|for|do|break|continue|default|module|require|yield|super|interface|type|implements|public|private|protected|def|elif|self|print|echo|fn|mut|struct|enum|impl|trait|where|pub|use|namespace|using|template|typename)\b)|(\b(?:\d+(?:\.\d+)?|0x[0-9a-fA-F]+)\b)|(\b(?:string|number|boolean|any|void|Promise|Array|Object|Set|Map|Buffer|Error|Record|unknown|never|int|float|str|bool|dict|list|tuple|i32|i64|u32|u64|usize|f32|f64|String|Vec)\b)|(\b[a-zA-Z_$][a-zA-Z0-9_$]*\b)(?=\s*\()|([a-zA-Z_$][a-zA-Z0-9_$]*)|([+\-*/%=&|!<>?:;.,{}()[\]])/g;

  return code.replace(codeRegex, (match, cmt, str, kw, num, typ, fn, ident, op) => {
    if (cmt) return `<span class="tok-cmt">${escapeHtml(cmt)}</span>`;
    if (str) return `<span class="tok-str">${escapeHtml(str)}</span>`;
    if (kw) return `<span class="tok-kw">${escapeHtml(kw)}</span>`;
    if (num) return `<span class="tok-num">${escapeHtml(num)}</span>`;
    if (typ) return `<span class="tok-typ">${escapeHtml(typ)}</span>`;
    if (fn) return `<span class="tok-fn">${escapeHtml(fn)}</span>`;
    if (ident) return escapeHtml(ident);
    if (op) return `<span class="tok-op">${escapeHtml(op)}</span>`;
    return escapeHtml(match);
  });
}

async function saveActiveEditor() {
  if (!APP_STATE.activeEditorPath) return;
  const editor = APP_STATE.openEditors.find(e => e.path === APP_STATE.activeEditorPath);
  if (!editor || editor.isImage) return;

  const res = await window.freeai.writeFile({
    workspacePath: APP_STATE.workspace,
    filePath: editor.path,
    content: editor.content
  });

  if (res.success) {
    editor.originalContent = editor.content;
    editor.isDirty = false;
    renderIdeTabs();
    renderOpenEditorsList();
    showToast('💾 Gespeichert', `${editor.name} (${res.size || editor.content.length} Bytes)`, 'success', 2000);
  } else {
    showToast('Speichern fehlgeschlagen', res.error, 'error');
  }
}

// ── Setup IDE Interactions ────────────────────────────
function setupIdeInteractions() {
  // Mode Switchers
  document.getElementById('btn-open-ide')?.addEventListener('click', () => switchAppMode('ide'));
  document.getElementById('btn-back-to-kortex')?.addEventListener('click', () => switchAppMode('kortex'));
  document.getElementById('ide-act-switch-kortex')?.addEventListener('click', () => switchAppMode('kortex'));

  // Activity Bar Navigation
  const actButtons = [
    { btnId: 'act-btn-explorer', paneId: 'ide-pane-explorer' },
    { btnId: 'act-btn-search', paneId: 'ide-pane-search' },
    { btnId: 'act-btn-git', paneId: 'ide-pane-git' },
    { btnId: 'act-btn-debug', paneId: 'ide-pane-debug' },
    { btnId: 'act-btn-ext', paneId: 'ide-pane-extensions' }
  ];

  actButtons.forEach(({ btnId, paneId }) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', () => {
      actButtons.forEach(b => {
        document.getElementById(b.btnId)?.classList.remove('active');
        document.getElementById(b.paneId)?.classList.add('hidden');
      });
      btn.classList.add('active');
      document.getElementById(paneId)?.classList.remove('hidden');
    });
  });

  // Accordion Sections
  document.querySelectorAll('.ide-accordion-header').forEach(hdr => {
    hdr.addEventListener('click', () => {
      const section = hdr.closest('.ide-accordion-section');
      if (section) section.classList.toggle('collapsed');
    });
  });

  // Explorer Top Actions
  document.getElementById('ide-btn-new-file')?.addEventListener('click', async () => {
    const name = prompt('Dateiname (z.B. app.js):');
    if (!name || !name.trim()) return;
    const filePath = name.trim();
    await window.freeai.writeFile({ workspacePath: APP_STATE.workspace, filePath, content: '' });
    await refreshIdeFileTree();
    openFileInEditor(filePath, '');
    showToast('📄 Neue Datei erstellt', filePath, 'success');
  });

  document.getElementById('ide-btn-new-folder')?.addEventListener('click', async () => {
    const name = prompt('Ordnername:');
    if (!name || !name.trim()) return;
    const folderPath = name.trim();
    await window.freeai.writeFile({ workspacePath: APP_STATE.workspace, filePath: `${folderPath}/.gitkeep`, content: '' });
    await refreshIdeFileTree();
    showToast('📁 Neuer Ordner erstellt', folderPath, 'success');
  });

  document.getElementById('ide-btn-refresh-files')?.addEventListener('click', refreshIdeFileTree);

  document.getElementById('ide-btn-collapse-all')?.addEventListener('click', () => {
    APP_STATE.expandedFolders.clear();
    renderIdeFileTree();
  });

  // Tab Actions
  document.getElementById('ide-btn-new-tab')?.addEventListener('click', () => {
    const scratchCount = APP_STATE.openEditors.filter(e => e.name.startsWith('scratch')).length + 1;
    const scratchName = `scratch-${scratchCount}.js`;
    openFileInEditor(scratchName, '// Scratchpad\n');
  });

  document.getElementById('ide-btn-toggle-diff')?.addEventListener('click', () => {
    const diffView = document.getElementById('ide-diff-viewport');
    const editorMain = document.getElementById('ide-code-editor-main');
    if (diffView && editorMain) {
      const isHidden = diffView.classList.contains('hidden');
      diffView.classList.toggle('hidden', !isHidden);
      editorMain.classList.toggle('hidden', isHidden);
      if (isHidden && APP_STATE.activeSession) {
        const body = document.getElementById('ide-diff-body');
        if (body) {
          body.innerHTML = '';
          (APP_STATE.activeSession.diffEntries || []).forEach(entry => {
            const card = document.createElement('div');
            card.className = 'diff-card open';
            card.innerHTML = `
              <div class="diff-card-header">
                <span class="diff-badge ${entry.status}">${entry.status.toUpperCase()}</span>
                <span class="diff-path">${escHtml(entry.path)}</span>
              </div>
              <div class="diff-body-pre">
                ${(entry.lines || []).map(l => `<div class="d-line ${l.type}"><span class="d-num">${l.lineNum || ''}</span><span class="d-content">${escHtml(l.content || '')}</span></div>`).join('')}
              </div>
            `;
            body.appendChild(card);
          });
        }
      }
    }
  });

  document.getElementById('ide-btn-split-editor')?.addEventListener('click', () => {
    const viewport = document.getElementById('ide-code-viewport');
    if (!viewport) return;
    const active = viewport.classList.toggle('ide-split-active');
    let preview = document.getElementById('ide-split-preview');
    if (active && !preview) {
      preview = document.createElement('pre');
      preview.id = 'ide-split-preview';
      viewport.appendChild(preview);
      displayActiveEditorContent();
    } else if (!active && preview) {
      preview.remove();
    }
    showToast('Editor', active ? 'Geteilte Vorschau aktiviert.' : 'Geteilte Vorschau geschlossen.', 'info', 2200);
  });

  document.getElementById('ide-btn-more-editor-actions')?.addEventListener('click', () => {
    if (APP_STATE.activeEditorPath) saveActiveEditor();
    else showToast('Editor', 'Keine Datei geöffnet.', 'info');
  });

  document.getElementById('ide-btn-close-diff')?.addEventListener('click', () => {
    document.getElementById('ide-diff-viewport')?.classList.add('hidden');
    document.getElementById('ide-code-editor-main')?.classList.remove('hidden');
  });

  document.getElementById('ide-btn-chatgpt-browser')?.addEventListener('click', async () => {
    const overlay = document.getElementById('chatgpt-drawer-overlay');
    overlay?.classList.remove('hidden');
    await window.freeai.toggleChatView(true);
    await window.freeai.checkAuth(false);
  });

  document.getElementById('ide-act-settings')?.addEventListener('click', () => {
    showToast('Einstellungen', 'Die IDE verwendet das Kortex-Studio-Modell GPT-5.6 Luna.', 'info');
  });

  document.getElementById('ide-win-min')?.addEventListener('click', () => window.freeai.minimizeWindow());
  document.getElementById('ide-win-max')?.addEventListener('click', () => window.freeai.maximizeWindow());
  document.getElementById('ide-win-close')?.addEventListener('click', () => window.freeai.closeWindow());

  setupIdeEditorInput();
  setupImageViewerControls();
  setupIdeSearch();
  setupIdeGit();
  setupIdeBottomPanel();
  setupIdeAgentSidebar();
}

// ── Setup IDE Code Editor Input & Hotkeys ─────────────
function setupIdeEditorInput() {
  const textarea = document.getElementById('ide-code-textarea');
  if (!textarea) return;

  textarea.addEventListener('input', () => {
    if (!APP_STATE.activeEditorPath) return;
    const editor = APP_STATE.openEditors.find(e => e.path === APP_STATE.activeEditorPath);
    if (!editor) return;

    editor.content = textarea.value;
    editor.isDirty = (editor.content !== editor.originalContent);

    renderIdeTabs();
    renderOpenEditorsList();
    updateEditorSyntax(editor.content, editor.ext);
  });

  // Tab key & auto-indent
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      textarea.value = val.substring(0, start) + '  ' + val.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 2;
      textarea.dispatchEvent(new Event('input'));
    } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      saveActiveEditor();
    }
  });

  // Track cursor pos
  const updateCursorPos = () => {
    const pos = textarea.selectionStart;
    const val = textarea.value.substring(0, pos);
    const line = val.split('\n').length;
    const col = pos - val.lastIndexOf('\n');
    const sbPos = document.getElementById('sb-cursor-pos');
    if (sbPos) sbPos.textContent = `Ln ${line}, Col ${col}`;

    document.querySelectorAll('#ide-line-numbers > div').forEach((d, idx) => {
      d.classList.toggle('active-line', idx + 1 === line);
    });
  };

  textarea.addEventListener('keyup', updateCursorPos);
  textarea.addEventListener('click', updateCursorPos);

  // Sync scroll
  textarea.addEventListener('scroll', () => {
    const highlight = document.getElementById('ide-code-highlight-layer');
    const gutter = document.getElementById('ide-gutter');
    if (highlight) {
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
    }
    if (gutter) {
      gutter.scrollTop = textarea.scrollTop;
    }
  });
}

// ── Setup IDE Agent Sidebar ───────────────────────────
function setupIdeAgentSidebar() {
  const idePromptInput = document.getElementById('ide-agent-prompt-input');
  const ideSendBtn = document.getElementById('ide-agent-btn-send');
  const ideStopBtn = document.getElementById('ide-agent-btn-stop');
  const ideAddContextBtn = document.getElementById('ide-agent-btn-add-context');
  const ideModelBadge = document.getElementById('ide-agent-model-badge');
  const ideNewChatBtn = document.getElementById('ide-agent-new-chat-btn');

  if (idePromptInput) {
    idePromptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = idePromptInput.value.trim();
        if (text) executePrompt(text);
      }
    });
  }

  ideSendBtn?.addEventListener('click', () => {
    const text = idePromptInput?.value?.trim();
    if (text) executePrompt(text);
  });

  ideStopBtn?.addEventListener('click', async () => {
    await window.freeai.stopAgent();
    APP_STATE.isAgentRunning = false;
    if (APP_STATE.agentTimerInterval) clearInterval(APP_STATE.agentTimerInterval);
    setAgentRunningUI(false);
    showToast('⏹ Agent gestoppt', 'Agent wurde gestoppt.', 'info');
  });

  ideAddContextBtn?.addEventListener('click', async () => {
    const img = await window.freeai.pickImage();
    if (img) {
      ATTACHED_IMAGES.push(img);
      renderAttachedImages();
      showToast('🖼️ Bild angehängt', img.name, 'success', 2500);
    }
  });

  ideModelBadge?.addEventListener('click', () => {
    showToast('⚡ KI-Modell', 'GPT-5.6 Luna – identisch mit Kortex Studio.', 'info');
  });

  ideNewChatBtn?.addEventListener('click', () => {
    startNewConversation();
  });
}

// ── Setup IDE Search & Replace ────────────────────────
function setupIdeSearch() {
  const searchInput = document.getElementById('ide-search-input');
  const runBtn = document.getElementById('ide-btn-run-search');
  const resultsContainer = document.getElementById('ide-search-results-list');

  const doSearch = async () => {
    const query = searchInput.value.trim();
    if (!query) return;
    resultsContainer.innerHTML = '<div class="ide-empty-hint">Suche in Dateien...</div>';

    const res = await window.freeai.listFiles({ workspacePath: APP_STATE.workspace, maxDepth: 6 });
    if (!res.success || !res.files) return;

    resultsContainer.innerHTML = '';
    let matchCount = 0;

    for (const f of res.files) {
      if (f.type !== 'file') continue;
      const fileRes = await window.freeai.readFile({ workspacePath: APP_STATE.workspace, filePath: f.path });
      if (fileRes.success && fileRes.content && fileRes.content.toLowerCase().includes(query.toLowerCase())) {
        matchCount++;
        const fileBlock = document.createElement('div');
        fileBlock.innerHTML = `<div class="search-match-file">${getFileIconHtml(f.path.split('.').pop(), f.name)} <span>${escHtml(f.path)}</span></div>`;
        fileBlock.querySelector('.search-match-file').addEventListener('click', () => openFileInEditor(f.path));

        const lines = fileRes.content.split('\n');
        lines.forEach((l, idx) => {
          if (l.toLowerCase().includes(query.toLowerCase())) {
            const lineRow = document.createElement('div');
            lineRow.className = 'search-match-line';
            lineRow.textContent = `${idx + 1}: ${l.trim()}`;
            lineRow.addEventListener('click', () => openFileInEditor(f.path));
            fileBlock.appendChild(lineRow);
          }
        });

        resultsContainer.appendChild(fileBlock);
      }
    }

    if (matchCount === 0) {
      resultsContainer.innerHTML = '<div class="ide-empty-hint">Keine Ergebnisse gefunden.</div>';
    }
  };

  runBtn?.addEventListener('click', doSearch);
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });

  document.getElementById('ide-btn-replace-all')?.addEventListener('click', async () => {
    const query = searchInput?.value || '';
    const replacement = document.getElementById('ide-replace-input')?.value || '';
    if (!query) return showToast('Ersetzen', 'Bitte zuerst einen Suchtext eingeben.', 'error');
    if (!window.confirm(`Alle Vorkommen von „${query}“ im Workspace ersetzen?`)) return;
    const res = await window.freeai.listFiles({ workspacePath: APP_STATE.workspace, maxDepth: 6 });
    let changed = 0;
    for (const file of (res.files || [])) {
      if (file.type !== 'file') continue;
      const current = await window.freeai.readFile({ workspacePath: APP_STATE.workspace, filePath: file.path });
      if (!current.success || typeof current.content !== 'string' || !current.content.includes(query)) continue;
      await window.freeai.writeFile({
        workspacePath: APP_STATE.workspace,
        filePath: file.path,
        content: current.content.split(query).join(replacement)
      });
      changed++;
    }
    await refreshIdeFileTree();
    showToast('Ersetzen abgeschlossen', `${changed} Datei(en) aktualisiert.`, 'success');
    doSearch();
  });
}

// ── Setup IDE Git Source Control ──────────────────────
function setupIdeGit() {
  document.getElementById('ide-btn-commit')?.addEventListener('click', async () => {
    const msg = document.getElementById('ide-git-commit-msg')?.value?.trim();
    if (!msg) {
      showToast('Git', 'Bitte Commit-Nachricht eingeben', 'error');
      return;
    }
    const res = await window.freeai.executeCmd({ workspacePath: APP_STATE.workspace, command: `git commit -am "${msg}"` });
    showToast('Git Commit', res.stdout || res.stderr || 'Änderungen committet', 'success');
    document.getElementById('ide-git-commit-msg').value = '';
  });
}

// ── Setup IDE Bottom Panel Tabs & Resizing ────────────
function setupIdeBottomPanel() {
  const panelTabs = [
    { tabId: 'tab-bot-problems', paneId: 'bot-pane-problems', controlsId: 'panel-controls-filter' },
    { tabId: 'tab-bot-output', paneId: 'bot-pane-output', controlsId: null },
    { tabId: 'tab-bot-debug', paneId: 'bot-pane-debug', controlsId: 'panel-controls-filter' },
    { tabId: 'tab-bot-terminal', paneId: 'bot-pane-terminal', controlsId: 'panel-controls-terminal' },
    { tabId: 'tab-bot-ports', paneId: 'bot-pane-ports', controlsId: null }
  ];

  panelTabs.forEach(({ tabId, paneId, controlsId }) => {
    const tab = document.getElementById(tabId);
    if (!tab) return;
    tab.addEventListener('click', () => {
      panelTabs.forEach(t => {
        document.getElementById(t.tabId)?.classList.remove('active');
        document.getElementById(t.paneId)?.classList.remove('active');
      });
      tab.classList.add('active');
      document.getElementById(paneId)?.classList.add('active');

      const termCtrl = document.getElementById('panel-controls-terminal');
      const filterCtrl = document.getElementById('panel-controls-filter');

      if (controlsId === 'panel-controls-terminal') {
        termCtrl?.classList.remove('hidden');
        filterCtrl?.classList.add('hidden');
      } else if (controlsId === 'panel-controls-filter') {
        termCtrl?.classList.add('hidden');
        filterCtrl?.classList.remove('hidden');
      } else {
        termCtrl?.classList.add('hidden');
        filterCtrl?.classList.add('hidden');
      }
    });
  });

  // Panel size controls
  document.getElementById('ide-btn-toggle-panel-size')?.addEventListener('click', () => {
    const panel = document.getElementById('ide-bottom-panel');
    if (panel) panel.classList.toggle('maximized');
  });

  document.getElementById('ide-btn-close-panel')?.addEventListener('click', () => {
    const panel = document.getElementById('ide-bottom-panel');
    if (panel) panel.classList.toggle('collapsed');
  });

  // Problems Pane Actions
  document.getElementById('btn-send-problems-agent')?.addEventListener('click', () => {
    const prompt = "Analysiere den Workspace auf echte Fehler und behebe nur gefundene Probleme.";
    const idePromptInput = document.getElementById('ide-agent-prompt-input');
    if (idePromptInput) {
      idePromptInput.value = prompt;
      idePromptInput.focus();
    }
    executePrompt(prompt);
  });

  document.getElementById('btn-send-file-problems-agent')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const prompt = "Prüfe und korrigiere unbekannte CSS-Eigenschaften in freeai-app/renderer/index.css.";
    const idePromptInput = document.getElementById('ide-agent-prompt-input');
    if (idePromptInput) {
      idePromptInput.value = prompt;
      idePromptInput.focus();
    }
    executePrompt(prompt);
  });

  // Ports Pane Actions (Screenshot 160540)
  document.getElementById('btn-forward-port')?.addEventListener('click', () => {
    const port = prompt('Portnummer eingeben (z.B. 3000, 8080):', '3000');
    if (port && port.trim()) {
      showToast('🔌 Port Weiterleitung', `Port ${port.trim()} wird über Localhost bereitgestellt.`, 'success', 3000);
      const portsPane = document.getElementById('bot-pane-ports');
      if (portsPane) {
        portsPane.innerHTML = `
          <div style="padding:16px 20px;display:flex;flex-direction:column;gap:10px;">
            <div style="font-size:12.5px;color:#ffffff;font-weight:600;">Weitergeleitete Ports (1)</div>
            <div style="display:flex;align-items:center;gap:12px;background:#252526;padding:8px 14px;border-radius:4px;font-family:var(--font-mono);font-size:12px;color:#4ade80;">
              <span>● ${port.trim()} (Localhost)</span>
              <span style="color:#888888;">http://localhost:${port.trim()}</span>
              <span style="margin-left:auto;color:#3b82f6;cursor:pointer;" onclick="showToast('Port','Kopiert!','info')">Kopieren</span>
            </div>
            <button class="btn-forward-port" id="btn-forward-another" style="margin-top:8px;">Weiteren Port hinzufügen</button>
          </div>
        `;
        document.getElementById('btn-forward-another')?.addEventListener('click', () => setupIdeBottomPanel());
      }
    }
  });
}

// ── Setup IDE Terminal Multi-Session Interactive Execution ──
let TERMINAL_SESSIONS = [];
let ACTIVE_TERMINAL_ID = 'term-1';

function setupIdeTerminal() {
  const input = document.getElementById('ide-terminal-cmd-input');
  if (!input) return;

  const ws = APP_STATE.workspace || 'C:\\Users\\meier\\Documents\\FreeAI';
  TERMINAL_SESSIONS = [
    {
      id: 'term-1',
      name: '1: powershell',
      history: [],
      historyIdx: 0,
      cwd: ws,
      htmlContent: `<div class="term-line prompt-history"><span class="term-gutter-circle">○</span><span class="term-prompt-txt">PS ${ws}&gt;</span> <span class="term-cmd-val"></span></div>`
    }
  ];
  ACTIVE_TERMINAL_ID = 'term-1';

  function renderTerminalSidebar() {
    const sidebar = document.getElementById('ide-term-sidebar');
    if (!sidebar) return;
    sidebar.innerHTML = '';

    TERMINAL_SESSIONS.forEach(sess => {
      const isActive = (sess.id === ACTIVE_TERMINAL_ID);
      const item = document.createElement('div');
      item.className = `ide-term-session-item ${isActive ? 'active' : ''}`;
      item.dataset.termId = sess.id;
      item.title = `${sess.name} (Klicken zum Wechseln)`;

      item.innerHTML = `
        <div class="ide-term-session-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
          <span>${escHtml(sess.name)}</span>
        </div>
        <button class="ide-term-close-btn" title="PowerShell schließen (Löschen)">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.ide-term-close-btn')) return;
        switchTerminalSession(sess.id);
      });

      item.querySelector('.ide-term-close-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        closeTerminalSession(sess.id);
      });

      sidebar.appendChild(item);
    });
  }

  function switchTerminalSession(termId) {
    const log = document.getElementById('ide-terminal-output');
    const prevSess = TERMINAL_SESSIONS.find(s => s.id === ACTIVE_TERMINAL_ID);
    if (prevSess && log) {
      prevSess.htmlContent = log.innerHTML;
    }

    const sess = TERMINAL_SESSIONS.find(s => s.id === termId) || TERMINAL_SESSIONS[0];
    if (!sess) return;
    ACTIVE_TERMINAL_ID = sess.id;

    const selectorTitle = document.getElementById('ide-term-selector-title');
    if (selectorTitle) selectorTitle.textContent = sess.name;

    const prefix = document.getElementById('ide-term-prompt-prefix');
    if (prefix) {
      prefix.textContent = `PS ${sess.cwd || APP_STATE.workspace || 'C:\\Users\\meier\\Documents\\FreeAI'}>`;
    }

    if (log) {
      log.innerHTML = sess.htmlContent || `<div class="term-line prompt-history"><span class="term-gutter-circle">○</span><span class="term-prompt-txt">PS ${sess.cwd}&gt;</span> <span class="term-cmd-val"></span></div>`;
      log.scrollTop = log.scrollHeight;
    }

    renderTerminalSidebar();
    if (input) {
      input.value = '';
      input.focus();
    }
  }

  function createNewTerminalSession() {
    const log = document.getElementById('ide-terminal-output');
    const prevSess = TERMINAL_SESSIONS.find(s => s.id === ACTIVE_TERMINAL_ID);
    if (prevSess && log) {
      prevSess.htmlContent = log.innerHTML;
    }

    const newId = `term-${Date.now()}`;
    const sessionNum = TERMINAL_SESSIONS.length + 1;
    const curWs = APP_STATE.workspace || 'C:\\Users\\meier\\Documents\\FreeAI';
    const newSession = {
      id: newId,
      name: `${sessionNum}: powershell`,
      history: [],
      historyIdx: 0,
      cwd: curWs,
      htmlContent: `
        <div class="term-line system" style="padding-left:22px;">Windows PowerShell [Session ${sessionNum}]</div>
        <div class="term-line prompt-history"><span class="term-gutter-circle">○</span><span class="term-prompt-txt">PS ${curWs}&gt;</span> <span class="term-cmd-val"></span></div>
      `
    };
    TERMINAL_SESSIONS.push(newSession);
    switchTerminalSession(newId);
    showToast('PowerShell', `Neue PowerShell-Sitzung (${newSession.name}) erstellt.`, 'success', 2000);
  }

  function closeTerminalSession(termId) {
    if (TERMINAL_SESSIONS.length <= 1) {
      const sess = TERMINAL_SESSIONS[0];
      const curWs = APP_STATE.workspace || 'C:\\Users\\meier\\Documents\\FreeAI';
      sess.history = [];
      sess.historyIdx = 0;
      sess.htmlContent = `<div class="term-line prompt-history"><span class="term-gutter-circle">○</span><span class="term-prompt-txt">PS ${curWs}&gt;</span> <span class="term-cmd-val"></span></div>`;
      switchTerminalSession(sess.id);
      showToast('PowerShell', 'PowerShell-Ausgabe zurückgesetzt.', 'info', 1800);
      return;
    }

    const idx = TERMINAL_SESSIONS.findIndex(s => s.id === termId);
    if (idx === -1) return;

    const closingActive = (ACTIVE_TERMINAL_ID === termId);
    TERMINAL_SESSIONS.splice(idx, 1);

    // Re-number remaining sessions
    TERMINAL_SESSIONS.forEach((s, i) => {
      s.name = `${i + 1}: powershell`;
    });

    if (closingActive) {
      const nextIdx = Math.min(idx, TERMINAL_SESSIONS.length - 1);
      switchTerminalSession(TERMINAL_SESSIONS[nextIdx].id);
    } else {
      renderTerminalSidebar();
      const selectorTitle = document.getElementById('ide-term-selector-title');
      const current = TERMINAL_SESSIONS.find(s => s.id === ACTIVE_TERMINAL_ID);
      if (selectorTitle && current) selectorTitle.textContent = current.name;
    }
    showToast('PowerShell', 'PowerShell-Sitzung gelöscht.', 'info', 1800);
  }

  // Initial render
  renderTerminalSidebar();
  switchTerminalSession(ACTIVE_TERMINAL_ID);

  input.addEventListener('keydown', async (e) => {
    const currentSess = TERMINAL_SESSIONS.find(s => s.id === ACTIVE_TERMINAL_ID);
    if (!currentSess) return;

    if (e.key === 'Enter') {
      const cmd = input.value.trim();
      if (!cmd) return;
      input.value = '';

      currentSess.history.push(cmd);
      currentSess.historyIdx = currentSess.history.length;

      const log = document.getElementById('ide-terminal-output');
      const ws = currentSess.cwd || APP_STATE.workspace || 'C:\\Users\\meier\\Documents\\FreeAI';

      const cmdEl = document.createElement('div');
      cmdEl.className = 'term-line command';
      cmdEl.innerHTML = `<span class="term-gutter-circle">○</span><span class="term-prompt-txt">PS ${ws}&gt;</span> <span class="term-cmd-val">${escHtml(cmd)}</span>`;
      log.appendChild(cmdEl);
      log.scrollTop = log.scrollHeight;

      if (cmd === 'clear' || cmd === 'cls') {
        log.innerHTML = '';
        currentSess.htmlContent = '';
        return;
      }

      try {
        const res = await window.freeai.executeCmd({ workspacePath: ws, command: cmd });
        if (res && res.stdout) {
          const outEl = document.createElement('div');
          outEl.className = 'term-line';
          outEl.style.paddingLeft = '22px';
          outEl.textContent = res.stdout;
          log.appendChild(outEl);
        }
        if (res && res.stderr) {
          const errEl = document.createElement('div');
          errEl.className = 'term-line error';
          errEl.style.paddingLeft = '22px';
          errEl.textContent = res.stderr;
          log.appendChild(errEl);
        }
      } catch (err) {
        const errEl = document.createElement('div');
        errEl.className = 'term-line error';
        errEl.style.paddingLeft = '22px';
        errEl.textContent = `Error: ${err.message}`;
        log.appendChild(errEl);
      }

      log.scrollTop = log.scrollHeight;
      currentSess.htmlContent = log.innerHTML;
    } else if (e.key === 'ArrowUp') {
      if (currentSess.historyIdx > 0) {
        currentSess.historyIdx--;
        input.value = currentSess.history[currentSess.historyIdx] || '';
      }
    } else if (e.key === 'ArrowDown') {
      if (currentSess.historyIdx < currentSess.history.length - 1) {
        currentSess.historyIdx++;
        input.value = currentSess.history[currentSess.historyIdx] || '';
      } else {
        currentSess.historyIdx = currentSess.history.length;
        input.value = '';
      }
    }
  });

  // Top Buttons: New, Split, Kill/Clear, 3-Dots Menu
  document.getElementById('ide-btn-new-term')?.addEventListener('click', () => {
    createNewTerminalSession();
  });

  document.getElementById('ide-btn-split-term')?.addEventListener('click', () => {
    createNewTerminalSession();
  });

  document.getElementById('ide-btn-clear-term')?.addEventListener('click', () => {
    closeTerminalSession(ACTIVE_TERMINAL_ID);
  });

  // 3-Dots Terminal Context Popover
  const moreBtn = document.getElementById('ide-btn-more-term');
  const termCtxMenu = document.getElementById('term-context-menu');

  moreBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!termCtxMenu) return;
    const isHidden = termCtxMenu.classList.contains('hidden');
    document.querySelectorAll('.context-menu-popover').forEach(m => m.classList.add('hidden'));

    if (isHidden) {
      const rect = moreBtn.getBoundingClientRect();
      termCtxMenu.style.position = 'fixed';
      termCtxMenu.style.top = `${rect.bottom + 6}px`;
      termCtxMenu.style.left = `${Math.max(10, rect.right - 230)}px`;
      termCtxMenu.classList.remove('hidden');
    }
  });

  document.getElementById('term-action-new')?.addEventListener('click', () => {
    termCtxMenu?.classList.add('hidden');
    createNewTerminalSession();
  });

  document.getElementById('term-action-clear')?.addEventListener('click', () => {
    termCtxMenu?.classList.add('hidden');
    const log = document.getElementById('ide-terminal-output');
    if (log) log.innerHTML = '';
    const sess = TERMINAL_SESSIONS.find(s => s.id === ACTIVE_TERMINAL_ID);
    if (sess) sess.htmlContent = '';
    showToast('Terminal', 'Ausgabe geleert.', 'info', 1800);
  });

  document.getElementById('term-action-delete')?.addEventListener('click', () => {
    termCtxMenu?.classList.add('hidden');
    closeTerminalSession(ACTIVE_TERMINAL_ID);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#term-context-menu') && !e.target.closest('#ide-btn-more-term')) {
      termCtxMenu?.classList.add('hidden');
    }
  });
}

// ── Setup IDE Top Dropdown Menus ──────────────────────
async function runActiveIdeFile(debug = false) {
  const editor = APP_STATE.openEditors.find(e => e.path === APP_STATE.activeEditorPath);
  if (!editor || editor.isImage) {
    showToast('Keine Datei geöffnet', 'Öffne zuerst eine ausführbare Datei im Editor.', 'error');
    return;
  }

  const ext = editor.ext.toLowerCase();
  const command = ['js', 'mjs', 'cjs'].includes(ext)
    ? `node "${editor.path}"`
    : ext === 'py'
      ? `python "${editor.path}"`
      : ext === 'ps1'
        ? `powershell -ExecutionPolicy Bypass -File "${editor.path}"`
        : ['bat', 'cmd'].includes(ext)
          ? `call "${editor.path}"`
          : null;
  if (!command) {
    showToast('Datei nicht ausführbar', `Für .${ext || 'txt'} ist kein Startbefehl hinterlegt.`, 'info');
    return;
  }

  document.getElementById('tab-bot-terminal')?.click();
  const log = document.getElementById('ide-terminal-output');
  if (log) {
    const line = document.createElement('div');
    line.className = 'term-line command';
    line.textContent = `${debug ? '[Debug] ' : ''}> ${command}`;
    log.appendChild(line);
  }
  const result = await window.freeai.executeCmd({ workspacePath: APP_STATE.workspace, command, timeoutMs: 120000 });
  if (log && (result.stdout || result.stderr)) {
    const output = document.createElement('div');
    output.className = `term-line ${result.success ? '' : 'error'}`;
    output.style.paddingLeft = '22px';
    output.textContent = result.stdout || result.stderr;
    log.appendChild(output);
    log.scrollTop = log.scrollHeight;
  }
  const outputStatus = document.getElementById('ide-output-log');
  if (outputStatus) {
    const row = document.createElement('div');
    row.className = `term-line ${result.success ? 'success' : 'error'}`;
    row.textContent = `[${new Date().toLocaleTimeString()}] ${result.success ? 'Ausführung beendet' : 'Ausführung fehlgeschlagen'}: ${editor.name}`;
    outputStatus.appendChild(row);
  }
}

function setupIdeMenus() {
  const menuItems = [
    { btnId: 'ide-menu-file', ddId: 'ide-dropdown-file' },
    { btnId: 'ide-menu-edit', ddId: 'ide-dropdown-edit' },
    { btnId: 'ide-menu-selection', ddId: 'ide-dropdown-selection' },
    { btnId: 'ide-menu-view', ddId: 'ide-dropdown-view' },
    { btnId: 'ide-menu-go', ddId: 'ide-dropdown-go' },
    { btnId: 'ide-menu-run', ddId: 'ide-dropdown-run' },
    { btnId: 'ide-menu-terminal', ddId: 'ide-dropdown-terminal' },
    { btnId: 'ide-menu-help', ddId: 'ide-dropdown-help' }
  ];

  function closeAllIdeMenus() {
    document.querySelectorAll('.ide-dropdown-menu').forEach(m => m.classList.add('hidden'));
    document.querySelectorAll('.ide-menu-item').forEach(b => b.classList.remove('active'));
  }

  menuItems.forEach(({ btnId, ddId }) => {
    const btn = document.getElementById(btnId);
    const dd = document.getElementById(ddId);
    if (!btn || !dd) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = dd.classList.contains('hidden');
      closeAllIdeMenus();
      if (isHidden) {
        dd.classList.remove('hidden');
        btn.classList.add('active');
      }
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.ide-menu-item')) {
      closeAllIdeMenus();
    }
  });

  // Action bindings
  document.getElementById('ide-act-new-file')?.addEventListener('click', () => {
    closeAllIdeMenus();
    document.getElementById('ide-btn-new-file')?.click();
  });
  document.getElementById('ide-act-save-file')?.addEventListener('click', () => {
    closeAllIdeMenus();
    saveActiveEditor();
  });
  document.getElementById('ide-act-new-term')?.addEventListener('click', () => {
    closeAllIdeMenus();
    document.getElementById('tab-bot-terminal')?.click();
    document.getElementById('ide-terminal-cmd-input')?.focus();
  });
  document.getElementById('ide-act-toggle-terminal')?.addEventListener('click', () => {
    closeAllIdeMenus();
    const panel = document.getElementById('ide-bottom-panel');
    if (panel) panel.classList.toggle('collapsed');
  });
  document.getElementById('ide-act-new-agent-chat')?.addEventListener('click', () => {
    closeAllIdeMenus();
    startNewConversation();
  });
  document.getElementById('ide-act-open-folder')?.addEventListener('click', async () => {
    closeAllIdeMenus();
    const folder = await window.freeai.pickFolder();
    if (folder) {
      const proj = await window.freeai.addProject({ path: folder });
      APP_STATE.projects = await window.freeai.listProjects();
      selectProject(proj);
    }
  });

  const bindMenuAction = (id, handler) => {
    document.getElementById(id)?.addEventListener('click', async () => {
      closeAllIdeMenus();
      try { await handler(); } catch (error) { showToast('IDE-Aktion fehlgeschlagen', error.message, 'error'); }
    });
  };

  bindMenuAction('ide-item-new-file', () => document.getElementById('ide-btn-new-file')?.click());
  bindMenuAction('ide-item-open-file', async () => {
    const filePath = window.prompt('Relativen Dateipfad öffnen:');
    if (filePath?.trim()) await openFileInEditor(filePath.trim());
  });
  bindMenuAction('ide-item-open-folder', async () => {
    const folder = await window.freeai.pickFolder();
    if (folder) {
      const project = await window.freeai.addProject({ path: folder });
      APP_STATE.projects = await window.freeai.listProjects();
      selectProject(project);
      switchAppMode('ide');
    }
  });
  bindMenuAction('ide-item-save-file', saveActiveEditor);
  bindMenuAction('ide-item-save-all', async () => {
    for (const editor of APP_STATE.openEditors) {
      if (editor.isDirty && !editor.isImage) {
        APP_STATE.activeEditorPath = editor.path;
        await saveActiveEditor();
      }
    }
    showToast('Gespeichert', 'Alle geänderten Dateien wurden gespeichert.', 'success', 2500);
  });
  bindMenuAction('ide-item-close-editor', () => {
    if (APP_STATE.activeEditorPath) closeEditorTab(APP_STATE.activeEditorPath);
  });
  bindMenuAction('ide-item-close-folder', () => {
    APP_STATE.openEditors = [];
    APP_STATE.activeEditorPath = null;
    APP_STATE.fileTreeData = [];
    selectProject(null);
    renderIdeTabs();
    renderOpenEditorsList();
    displayActiveEditorContent();
  });
  bindMenuAction('ide-item-exit-to-kortex', () => switchAppMode('kortex'));

  bindMenuAction('ide-item-undo', () => document.execCommand('undo'));
  bindMenuAction('ide-item-redo', () => document.execCommand('redo'));
  bindMenuAction('ide-item-cut', () => document.execCommand('cut'));
  bindMenuAction('ide-item-copy', () => document.execCommand('copy'));
  bindMenuAction('ide-item-paste', async () => {
    const textarea = document.getElementById('ide-code-textarea');
    if (textarea) {
      textarea.focus();
      try { textarea.setRangeText(await navigator.clipboard.readText(), textarea.selectionStart, textarea.selectionEnd, 'end'); textarea.dispatchEvent(new Event('input')); } catch { document.execCommand('paste'); }
    }
  });
  bindMenuAction('ide-item-find', () => {
    document.getElementById('ide-search-input')?.focus();
    document.getElementById('act-btn-search')?.click();
  });
  bindMenuAction('ide-item-replace', () => {
    document.getElementById('act-btn-search')?.click();
    document.getElementById('ide-replace-input')?.focus();
  });
  bindMenuAction('ide-item-find-in-files', () => {
    document.getElementById('act-btn-search')?.click();
    document.getElementById('ide-search-input')?.focus();
  });
  bindMenuAction('ide-item-select-all', () => document.getElementById('ide-code-textarea')?.select());
  bindMenuAction('ide-item-expand-sel', () => {
    const textarea = document.getElementById('ide-code-textarea');
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const left = text.slice(0, start).search(/\S+$/);
    const rightMatch = text.slice(end).match(/^\S+/);
    textarea.selectionStart = left === -1 ? start : left;
    textarea.selectionEnd = rightMatch ? end + rightMatch[0].length : end;
  });
  bindMenuAction('ide-item-duplicate-line', () => {
    const textarea = document.getElementById('ide-code-textarea');
    if (!textarea) return;
    const lineStart = textarea.value.lastIndexOf('\n', textarea.selectionStart - 1) + 1;
    const lineEndIndex = textarea.value.indexOf('\n', textarea.selectionStart);
    const lineEnd = lineEndIndex === -1 ? textarea.value.length : lineEndIndex;
    const line = textarea.value.slice(lineStart, lineEnd);
    textarea.setRangeText(`${line}\n`, lineEnd, lineEnd, 'end');
    textarea.dispatchEvent(new Event('input'));
  });

  const activateIdePane = (pane, tabId = null) => {
    document.querySelector(`#${tabId || `act-btn-${pane}`}`)?.click();
    if (tabId) document.getElementById(tabId)?.click();
  };
  bindMenuAction('ide-item-view-explorer', () => activateIdePane('explorer'));
  bindMenuAction('ide-item-view-search', () => activateIdePane('search'));
  bindMenuAction('ide-item-view-git', () => activateIdePane('git'));
  bindMenuAction('ide-item-view-terminal', () => activateIdePane('explorer', 'tab-bot-terminal'));
  bindMenuAction('ide-item-view-problems', () => activateIdePane('explorer', 'tab-bot-problems'));
  bindMenuAction('ide-item-view-output', () => activateIdePane('explorer', 'tab-bot-output'));
  bindMenuAction('ide-item-go-file', () => activateIdePane('search'));
  bindMenuAction('ide-item-go-line', () => {
    const line = Math.max(1, Number(window.prompt('Zeile auswählen:', '1')) || 1);
    const textarea = document.getElementById('ide-code-textarea');
    if (!textarea) return;
    const lines = textarea.value.split('\n');
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = lines.slice(0, line - 1).reduce((total, value) => total + value.length + 1, 0);
  });
  bindMenuAction('ide-item-new-terminal', () => document.getElementById('ide-btn-new-term')?.click());
  bindMenuAction('ide-item-clear-terminal', () => document.getElementById('ide-btn-clear-term')?.click());
  bindMenuAction('ide-item-run-active-file', () => runActiveIdeFile());
  bindMenuAction('ide-item-run-no-debug', () => runActiveIdeFile());
  bindMenuAction('ide-item-start-debug', () => runActiveIdeFile(true));
  bindMenuAction('ide-item-about', () => showToast('Kortex IDE', 'Kortex Studio mit GPT-5.6 Luna und integriertem Projekt-Bridge.', 'info', 5000));
  bindMenuAction('ide-item-chatgpt-auth', async () => {
    document.getElementById('ide-btn-chatgpt-browser')?.click();
    await window.freeai.checkAuth(false);
  });

  // Window Controls in IDE Header
  document.getElementById('ide-btn-minimize')?.addEventListener('click', () => window.freeai.minimizeWindow());
  document.getElementById('ide-btn-maximize')?.addEventListener('click', () => window.freeai.maximizeWindow());
  document.getElementById('ide-btn-close')?.addEventListener('click', () => window.freeai.closeWindow());
}

// ── Setup Auth State Listeners & Auto-Login Drawer ────
function setupAuthListeners() {
  window.freeai.on('chatgpt-auth-state', (state) => {
    const isLogged = Boolean(state && state.loggedIn);
    APP_STATE.chatgptAuthStatus = state;

    const dotKortex = document.getElementById('chatgpt-status-dot');
    const labelKortex = document.getElementById('chatgpt-status-label');
    const dotIde = document.getElementById('ide-chatgpt-status-dot');
    const labelIde = document.getElementById('ide-chatgpt-status-label');

    if (isLogged) {
      if (dotKortex) dotKortex.className = 'status-indicator-dot';
      if (labelKortex) labelKortex.textContent = 'ChatGPT Connected';
      if (dotIde) dotIde.className = 'status-indicator-dot';
      if (labelIde) labelIde.textContent = 'ChatGPT Connected';
    } else {
      if (dotKortex) dotKortex.className = 'status-indicator-dot dot-amber';
      if (labelKortex) labelKortex.textContent = 'Nicht angemeldet';
      if (dotIde) dotIde.className = 'status-indicator-dot dot-amber';
      if (labelIde) labelIde.textContent = 'Nicht angemeldet';
    }
  });

  window.freeai.on('chatgpt-drawer-visibility', (visible) => {
    const overlay = document.getElementById('chatgpt-drawer-overlay');
    if (overlay) overlay.classList.toggle('hidden', !visible);
  });

  window.freeai.on('chatgpt-login-success', () => {
    const overlay = document.getElementById('chatgpt-drawer-overlay');
    if (overlay) overlay.classList.add('hidden');
    window.freeai.toggleChatView(false);

    const dotKortex = document.getElementById('chatgpt-status-dot');
    const labelKortex = document.getElementById('chatgpt-status-label');
    const dotIde = document.getElementById('ide-chatgpt-status-dot');
    const labelIde = document.getElementById('ide-chatgpt-status-label');
    if (dotKortex) dotKortex.className = 'status-indicator-dot';
    if (labelKortex) labelKortex.textContent = 'ChatGPT Connected';
    if (dotIde) dotIde.className = 'status-indicator-dot';
    if (labelIde) labelIde.textContent = 'ChatGPT Connected';

    showToast('✅ ChatGPT verbunden', 'Erfolgreich angemeldet!', 'success', 4000);
  });
}

// ── Helpers ───────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (d > 0) return `${d}d`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return 'now';
}

// ── Start ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
