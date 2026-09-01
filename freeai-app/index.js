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
  contextMenuTargetSession: null
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

  window.freeai.on('chatgpt-ready', () => {
    document.getElementById('chatgpt-status-dot').className = 'status-indicator-dot';
    document.getElementById('chatgpt-status-label').textContent = 'ChatGPT Connected';
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
  renderSidebarProjects();
  updateDiffUI(session.diffEntries || []);

  // Synchronize ChatGPT view to this specific conversation
  if (session.chatgptUrl) {
    window.freeai.loadChatgptUrl(session.chatgptUrl);
  }
}

function startNewConversation() {
  APP_STATE.activeSession = null;
  APP_STATE.currentAssistantEl = null;
  APP_STATE.currentAssistantTurn = null;
  document.getElementById('bc-session').textContent = 'New Conversation';
  document.getElementById('view-conversation').classList.add('hidden');
  document.getElementById('view-empty-state').classList.remove('hidden');
  document.getElementById('conversation-stream').innerHTML = '';
  document.getElementById('prompt-input-hero').value = '';
  document.getElementById('prompt-input-hero').focus();
  window.freeai.newChat();
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

// ── Conversation Stream Rendering ─────────────────────
function renderConversationTurns(session) {
  const stream = document.getElementById('conversation-stream');
  stream.innerHTML = '';

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

  stream.scrollTop = stream.scrollHeight;
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
    });
  });

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
    openRightTab('files');
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
    openRightTab('files');
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
    openRightTab('diff');
    const card = document.querySelector(`.diff-card[data-file="${item.path}"]`);
    if (card) {
      card.classList.add('open');
      card.scrollIntoView({ behavior: 'smooth' });
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
  const stream = document.getElementById('conversation-stream');
  const el = document.createElement('div');
  el.className = 'timeline-assistant-turn agent-live-turn';
  el.innerHTML = '<div class="markdown-body"></div>';
  stream.appendChild(el);
  APP_STATE.currentAssistantEl = el;
  APP_STATE.currentAssistantTurn = { type: 'assistant', text: '' };
  if (APP_STATE.activeSession) APP_STATE.activeSession.turns.push(APP_STATE.currentAssistantTurn);
  return el;
}

function renderLiveAssistantText(text) {
  const el = ensureLiveAssistantTurn();
  const body = el.querySelector('.markdown-body');
  if (body) body.innerHTML = parseMarkdown(text);
  if (APP_STATE.currentAssistantTurn) APP_STATE.currentAssistantTurn.text = text;
  const stream = document.getElementById('conversation-stream');
  stream.scrollTop = stream.scrollHeight;
}

async function executePrompt(promptText) {
  if (!promptText.trim()) return;
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

  const stream = document.getElementById('conversation-stream');

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
  stream.appendChild(userEl);

  // 2. Start Live Timer & Thought Block
  APP_STATE.isAgentRunning = true;
  APP_STATE.agentStartTime = Date.now();
  document.getElementById('chatgpt-status-dot').className = 'status-indicator-dot working';
  document.getElementById('chatgpt-status-label').textContent = 'Agent Working...';
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

  const thoughtCardEl = createThoughtCard(thoughtItem);
  stream.appendChild(thoughtCardEl);

  // Live Timer Update
  if (APP_STATE.agentTimerInterval) clearInterval(APP_STATE.agentTimerInterval);
  APP_STATE.agentTimerInterval = setInterval(() => {
    if (APP_STATE.isAgentRunning && APP_STATE.currentThoughtBlock) {
      const elapsed = Math.round((Date.now() - APP_STATE.agentStartTime) / 1000);
      APP_STATE.currentThoughtBlock.elapsedSec = elapsed;
      const label = thoughtCardEl.querySelector('.thought-timer-label');
      if (label) label.textContent = `Thought for ${elapsed}s`;
    }
  }, 1000);

  // 3. Assistant turn is created lazily when the first readable text arrives.
  APP_STATE.currentAssistantEl = null;
  APP_STATE.currentAssistantTurn = null;

  stream.scrollTop = stream.scrollHeight;

  document.getElementById('prompt-input-hero').value = '';
  document.getElementById('prompt-input-bottom').value = '';

  // 4. Auto-Scan Project Structure
  let projectSnapshot = null;
  const snapRes = await window.freeai.listFiles({ workspacePath: APP_STATE.workspace });
  if (snapRes.success && snapRes.files) {
    projectSnapshot = snapRes.files.length === 0
      ? '(Projektordner ist leer)'
      : snapRes.files.map(f => `${f.type === 'directory' ? '[DIR] ' : '[FILE]'} ${f.path}${f.size ? ' (' + f.size + ' B)' : ''}`).join('\n');
  }

  // 5. Build Final Prompt with Image Context (Vision to Text representation)
  let finalPrompt = promptText;
  if (currentImages.length > 0) {
    const imgDescriptions = currentImages.map((img, idx) => {
      return `[ANGEHÄNGTES BILD ${idx + 1}: "${img.name}"]\n- Format: ${(img.ext || 'PNG').toUpperCase()}\n- Größe: ${Math.round((img.size || 0) / 1024)} KB\n- Visuelle Vorgabe / Screenshot: Der Nutzer hat dieses Bild als visuelle Vorlage / Mockup angehängt. Analysiere das Design, die Elemente und das Layout und setze die Anforderungen exakt wie im Bild dargestellt um.`;
    }).join('\n\n');
    finalPrompt = `${imgDescriptions}\n\n[BENUTZER-ANFRAGE]\n${promptText}`;
  }

  // 6. Start Agent in ChatGPT. Keep the IDE UI recoverable if BrowserView or
  // IPC is temporarily unavailable; otherwise it looked like the task died.
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
    document.getElementById('chatgpt-status-label').textContent = 'ChatGPT nicht bereit';
    showToast('Agent konnte nicht starten', error.message, 'error', 8000);
  }
}

// ── Agent Running UI Helper ───────────────────────────
function setAgentRunningUI(running) {
  const sendHero = document.getElementById('btn-send-hero');
  const sendBottom = document.getElementById('btn-send-bottom');
  const stopHero = document.getElementById('btn-stop-hero');
  const stopBottom = document.getElementById('btn-stop-bottom');
  const inputHero = document.getElementById('prompt-input-hero');
  const inputBottom = document.getElementById('prompt-input-bottom');

  if (running) {
    sendHero && sendHero.classList.add('hidden');
    sendBottom && sendBottom.classList.add('hidden');
    stopHero && stopHero.classList.remove('hidden');
    stopBottom && stopBottom.classList.remove('hidden');
    if (inputHero) { inputHero.disabled = true; inputHero.style.opacity = '0.5'; }
    if (inputBottom) { inputBottom.disabled = true; inputBottom.style.opacity = '0.5'; }
  } else {
    sendHero && sendHero.classList.remove('hidden');
    sendBottom && sendBottom.classList.remove('hidden');
    stopHero && stopHero.classList.add('hidden');
    stopBottom && stopBottom.classList.add('hidden');
    if (inputHero) { inputHero.disabled = false; inputHero.style.opacity = ''; }
    if (inputBottom) { inputBottom.disabled = false; inputBottom.style.opacity = ''; inputBottom.focus(); }
  }
}

// ── Agent IPC Handshake ───────────────────────────────
function setupAgentIpcListeners() {
  window.freeai.on('agent:event', async (event) => {
    const { type, payload } = event;
    const stream = document.getElementById('conversation-stream');

    switch (type) {
      case 'agent:step': {
        // Every response after a tool result gets its own readable assistant
        // bubble. The previous one remains as a compact progress message.
        if (APP_STATE.currentAssistantEl) {
          APP_STATE.currentAssistantEl.classList.remove('agent-live-turn');
          APP_STATE.currentAssistantEl.classList.add('agent-progress-turn');
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
            stream.appendChild(createThoughtCard(APP_STATE.currentThoughtBlock));
          } else {
            APP_STATE.currentThoughtBlock.thought = text;
            const body = document.querySelector(`#thought-card-${APP_STATE.currentThoughtBlock.id} .thought-body-text`);
            if (body) body.textContent = text;
          }
          stream.scrollTop = stream.scrollHeight;
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
          const card = document.getElementById(`thought-card-${APP_STATE.currentThoughtBlock.id}`);
          if (card) card.classList.remove('open');
          APP_STATE.currentThoughtBlock = null;
        }
        const { tool, parameters } = payload;
        showToast('Agent führt Tool aus', tool, 'tool', 3000);
        const result = await executeToolLocally(tool, parameters);
        window.freeai.send('chatgpt:tool-result', { result });
        break;
      }

      case 'agent:completed': {
        APP_STATE.isAgentRunning = false;
        const summary = (payload.summary || '').trim();

        if (APP_STATE.currentThoughtBlock) {
          const thoughtText = (APP_STATE.currentThoughtBlock.thought || '').trim();
          const card = document.getElementById(`thought-card-${APP_STATE.currentThoughtBlock.id}`);
          if (thoughtText && (summary.includes(thoughtText.substring(0, 30)) || thoughtText.includes(summary.substring(0, 30)))) {
            if (card) card.remove();
            if (APP_STATE.activeSession) {
              APP_STATE.activeSession.turns = APP_STATE.activeSession.turns.filter(t => t.id !== APP_STATE.currentThoughtBlock.id);
            }
          } else {
            if (card) card.classList.remove('open');
          }
          APP_STATE.currentThoughtBlock = null;
        }
        if (APP_STATE.agentTimerInterval) clearInterval(APP_STATE.agentTimerInterval);
        setAgentRunningUI(false);
        document.getElementById('chatgpt-status-dot').className = 'status-indicator-dot';
        document.getElementById('chatgpt-status-label').textContent = 'ChatGPT Ready';

        if (summary) {
          if (APP_STATE.currentAssistantEl) {
            renderLiveAssistantText(summary);
            APP_STATE.currentAssistantEl.classList.remove('agent-live-turn');
            APP_STATE.currentAssistantEl.classList.add('agent-final-turn');
          } else {
            const asstEl = document.createElement('div');
            asstEl.className = 'timeline-assistant-turn agent-final-turn';
            asstEl.innerHTML = `<div class="markdown-body">${parseMarkdown(summary)}</div>`;
            stream.appendChild(asstEl);
            if (APP_STATE.activeSession) APP_STATE.activeSession.turns.push({ type: 'assistant', text: summary });
          }
          APP_STATE.currentAssistantEl = null;
          APP_STATE.currentAssistantTurn = null;
          stream.scrollTop = stream.scrollHeight;
          document.getElementById('doc-walkthrough-body').innerHTML = parseMarkdown(summary);
          document.getElementById('doc-walkthrough-title').textContent = APP_STATE.activeSession?.title || 'Walkthrough';
        }

        showToast('🎉 Aufgabe abgeschlossen!', summary ? (summary.substring(0, 70) + '...') : 'Fertiggestellt', 'success', 8000);
        saveActiveSession();
        refreshFileTree();
        break;
      }

      case 'agent:stopped':
      case 'agent:error': {
        APP_STATE.isAgentRunning = false;
        if (APP_STATE.currentThoughtBlock) {
          const card = document.getElementById(`thought-card-${APP_STATE.currentThoughtBlock.id}`);
          if (card) card.classList.remove('open');
          APP_STATE.currentThoughtBlock = null;
        }
        if (APP_STATE.agentTimerInterval) clearInterval(APP_STATE.agentTimerInterval);
        setAgentRunningUI(false);
        document.getElementById('chatgpt-status-dot').className = 'status-indicator-dot';
        document.getElementById('chatgpt-status-label').textContent = type === 'agent:error' ? 'ChatGPT Error' : 'ChatGPT Ready';
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
        }
        return res;
      }

      case 'delete_file': {
        const res = await window.freeai.deleteFile({ workspacePath: ws, filePath: params.path });
        if (res.success) {
          const fileRow = createFileChangeRow({ path: params.path, additions: 0, deletions: 1 });
          stream.appendChild(fileRow);
          refreshFileTree();
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
