/**
 * FreeAI - Autonomous Coding Agent for ChatGPT Web
 * content.js - Vollständiger Agent Loop, DOM Controller, Bridge Client & UI
 */

(function () {
  'use strict';

  // Verhindere doppelte Initialisierung
  if (window.__FREEAI_INITIALIZED__) return;
  window.__FREEAI_INITIALIZED__ = true;

  console.log('⚡ FreeAI Autonomous Agent Extension geladen.');

  // ============================================================
  // 1. Agent State & Konfiguration
  // ============================================================
  const CONFIG = {
    bridgeUrl: 'http://localhost:4000',
    pollIntervalMs: 800,
    maxWaitResponseSeconds: 180,
    maxSteps: 150
  };

  async function discoverBridge() {
    const ports = Array.from({ length: 11 }, (_, index) => 4000 + index);
    const results = await Promise.all(ports.map(async (port) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 350);
      try {
        const response = await fetch(`http://localhost:${port}/api/status`, { signal: controller.signal });
        const data = await response.json();
        return response.ok && data.status === 'online' ? { port, data } : null;
      } catch { return null; }
      finally { clearTimeout(timer); }
    }));
    const found = results.find(Boolean);
    if (found) CONFIG.bridgeUrl = `http://localhost:${found.port}`;
    return found;
  }

  const STATE = {
    status: 'IDLE', // IDLE, RUNNING, WAITING_STREAM, EXECUTING_TOOL, PAUSED, COMPLETED, ERROR
    workspace: '',
    bridgeOnline: false,
    currentTask: '',
    step: 0,
    lastProcessedMessage: '',
    isMinimized: false,
    logs: []
  };

  // ============================================================
  // 2. Toast Notification System
  // ============================================================
  let toastContainer = null;

  function initToastContainer() {
    if (document.getElementById('freeai-toast-container')) {
      toastContainer = document.getElementById('freeai-toast-container');
      return;
    }
    toastContainer = document.createElement('div');
    toastContainer.id = 'freeai-toast-container';
    document.body.appendChild(toastContainer);
  }

  function showToast(title, description, type = 'info', durationMs = 4500, icon = '⚡') {
    initToastContainer();

    const toast = document.createElement('div');
    toast.className = `freeai-toast toast-${type}`;

    const iconMap = {
      info: '💡',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      tool: '🛠️',
      file: '📝',
      cmd: '⚡',
      ai: '🤖'
    };

    const displayIcon = iconMap[type] || icon;

    toast.innerHTML = `
      <div class="freeai-toast-header">
        <span class="freeai-toast-icon">${displayIcon}</span>
        <span>${escapeHtml(title)}</span>
      </div>
      <div class="freeai-toast-body">${escapeHtml(description)}</div>
      <div class="freeai-toast-progress" style="animation-duration: ${durationMs}ms;"></div>
    `;

    toast.addEventListener('click', () => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    });

    toastContainer.appendChild(toast);

    // Animiert einblenden
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Auto-Dismiss
    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }
    }, durationMs);
  }

  function addLog(message, type = 'info') {
    const time = new Date().toLocaleTimeString('de-DE');
    STATE.logs.push({ time, message, type });
    if (STATE.logs.length > 200) STATE.logs.shift();

    const logContainer = document.getElementById('freeai-log-content');
    if (logContainer) {
      const entry = document.createElement('div');
      entry.className = 'freeai-log-entry';
      entry.innerHTML = `<span class="freeai-log-time">[${time}]</span> <span>${escapeHtml(message)}</span>`;
      logContainer.appendChild(entry);
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  }

  // ============================================================
  // 3. Bridge Server API Client
  // ============================================================
  async function callBridge(endpoint, body = null, method = 'POST') {
    try {
      const options = {
        method: method,
        headers: { 'Content-Type': 'application/json' }
      };
      if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${CONFIG.bridgeUrl}${endpoint}`, options);
      const data = await response.json();
      return { ok: response.ok, status: response.status, data };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function checkBridgeStatus() {
    let res = await callBridge('/api/status', null, 'GET');
    if (!res.ok) {
      const found = await discoverBridge();
      if (found) res = { ok: true, status: 200, data: found.data };
    }
    const dot = document.getElementById('freeai-status-dot');
    const text = document.getElementById('freeai-status-text');
    const wsInput = document.getElementById('freeai-workspace-input');

    if (res.ok && res.data.status === 'online') {
      STATE.bridgeOnline = true;
      if (!STATE.workspace && res.data.workspace) {
        STATE.workspace = res.data.workspace;
        if (wsInput) wsInput.value = res.data.workspace;
      }
      if (dot) dot.className = 'freeai-status-dot online';
      if (text) text.innerText = 'Bridge: Online';
    } else {
      STATE.bridgeOnline = false;
      if (dot) dot.className = 'freeai-status-dot';
      if (text) text.innerText = 'Bridge: Offline (start-bridge.bat starten)';
    }
  }

  async function setWorkspaceFolder(newPath) {
    if (!newPath) return;
    const res = await callBridge('/api/set-workspace', { path: newPath, createIfNotExists: true });
    if (res.ok && res.data.success) {
      STATE.workspace = res.data.workspace;
      showToast('Workspace gewechselt', STATE.workspace, 'success');
      addLog(`📂 Workspace gesetzt auf: ${STATE.workspace}`);
    } else {
      showToast('Fehler bei Workspace-Wechsel', res.data ? res.data.error : res.error, 'error');
    }
  }

  async function pickFolderNative() {
    showToast('Ordnerauswahl', 'Öffne Windows Ordner-Dialog...', 'info');
    const res = await callBridge('/api/pick-folder');
    if (res.ok && res.data.success) {
      STATE.workspace = res.data.workspace;
      const wsInput = document.getElementById('freeai-workspace-input');
      if (wsInput) wsInput.value = STATE.workspace;
      showToast('Projektordner gewählt', STATE.workspace, 'success');
      addLog(`📂 Ordner ausgewählt: ${STATE.workspace}`);
    }
  }

  // ============================================================
  // 4. ChatGPT DOM Controller (Robuste Interaktion)
  // ============================================================
  function getPromptInput() {
    return (
      document.querySelector('#prompt-textarea') ||
      document.querySelector('div[contenteditable="true"]') ||
      document.querySelector('textarea[data-id="root"]') ||
      document.querySelector('textarea')
    );
  }

  function getSendButton() {
    return (
      document.querySelector('button[data-testid="send-button"]') ||
      document.querySelector('button[aria-label="Send prompt"]') ||
      document.querySelector('button[aria-label="Prompt senden"]') ||
      document.querySelector('button[data-testid="fruitjuice-send-button"]') ||
      document.querySelector('form button[type="submit"]')
    );
  }

  function isChatGptStreaming() {
    const stopBtn = (
      document.querySelector('button[data-testid="stop-button"]') ||
      document.querySelector('button[aria-label="Stop streaming"]') ||
      document.querySelector('button[aria-label="Generierung beenden"]') ||
      document.querySelector('.result-streaming') ||
      document.querySelector('[data-testid="conversation-turn-streaming"]')
    );
    return !!stopBtn;
  }

  function setPromptText(text) {
    const input = getPromptInput();
    if (!input) {
      console.error('[FreeAI] Prompt-Eingabefeld in ChatGPT nicht gefunden!');
      return false;
    }

    input.focus();

    if (input.tagName === 'TEXTAREA') {
      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // ContentEditable Div (ChatGPT Standard)
      input.innerHTML = '';
      const p = document.createElement('p');
      p.innerText = text;
      input.appendChild(p);

      // Trigger synthetic input events für React / ProseMirror
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
      }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    return true;
  }

  async function submitPrompt(text) {
    const success = setPromptText(text);
    if (!success) {
      showToast('Senden fehlgeschlagen', 'ChatGPT Eingabefeld nicht erreichbar', 'error');
      addLog('❌ Eingabefeld in ChatGPT nicht gefunden', 'error');
      return false;
    }

    // Kurze Pause, damit React den State aktualisieren kann
    await sleep(250);

    const sendBtn = getSendButton();
    if (sendBtn && !sendBtn.disabled) {
      sendBtn.click();
      return true;
    }

    // Fallback: Enter Key simulieren
    const input = getPromptInput();
    if (input) {
      const enterEvent = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13
      });
      input.dispatchEvent(enterEvent);
      return true;
    }

    return false;
  }

  function getLatestAssistantTurn() {
    const assistantTurns = document.querySelectorAll(
      '[data-message-author-role="assistant"], .agent-turn, div[class*="text-message"][data-message-author-role="assistant"]'
    );

    if (!assistantTurns || assistantTurns.length === 0) {
      return null;
    }

    return assistantTurns[assistantTurns.length - 1];
  }

  function getLatestAssistantMessage() {
    const lastTurn = getLatestAssistantTurn();
    if (!lastTurn) return null;
    return lastTurn.innerText || lastTurn.textContent || '';
  }

  // ============================================================
  // 5. Tool Call Parser & Execution Engine (Ultra-Robust)
  // ============================================================
  
  /**
   * Universelle und fehlertolerante Extraktion von Tool-Calls aus DOM und Text
   */
  function parseToolCall(messageText, turnElement = null) {
    const element = turnElement || getLatestAssistantTurn();

    // Strategie 1: Durchsuche direkt alle <pre> und <code> Elemente im DOM der letzten Nachricht
    if (element) {
      const codeElements = element.querySelectorAll('pre, code, div[class*="code"], div[class*="font-mono"]');
      for (const codeEl of codeElements) {
        const codeText = codeEl.innerText || codeEl.textContent || '';
        const parsed = tryParseJsonTool(codeText);
        if (parsed) return parsed;
      }
    }

    // Strategie 2: Suche im gesamten Text der Nachricht nach JSON-Strukturen
    if (messageText) {
      // 2a. Markdown Codeblöcke ```tool_call ... ``` oder ```json ... ```
      const codeBlockMatch = messageText.match(/```(?:tool_call|json|javascript|js)?\s*([\s\S]*?)\s*```/i);
      if (codeBlockMatch) {
        const parsed = tryParseJsonTool(codeBlockMatch[1]);
        if (parsed) return parsed;
      }

      // 2b. Suche nach beliebigen JSON Blöcken mit { ... }
      const parsed = tryParseJsonTool(messageText);
      if (parsed) return parsed;
    }

    return null;
  }

  /**
   * Versucht einen Text als Tool-JSON zu parsen inkl. automatischer Reparatur von Windows-Backslashes
   */
  function tryParseJsonTool(str) {
    if (!str) return null;

    // Bereinige führende Header wie "tool_call", "json", "Copy code"
    let cleaned = str.replace(/^(?:tool_call|json|javascript|js)\s*/i, '')
                     .replace(/^copy\s*code\s*/i, '')
                     .trim();

    // Suche nach der ersten '{' und der passenden korrespondierenden '}'
    const startIdx = cleaned.indexOf('{');
    if (startIdx === -1) return null;

    const lastIdx = cleaned.lastIndexOf('}');
    if (lastIdx <= startIdx) return null;

    const candidate = cleaned.substring(startIdx, lastIdx + 1).trim();

    // Versuch 1: Normales JSON.parse
    try {
      const obj = JSON.parse(candidate);
      if (obj && (obj.tool || obj.action || obj.name)) {
          return {
            tool: obj.tool || obj.action || obj.name,
            parameters: obj.parameters || obj.args || obj.params || {}
          };
      }
    } catch (e1) {}

    // Versuch 2: Reparatur von Windows Backslashes (z.B. "C:\Users\meier" -> "C:/Users/meier")
    try {
      const repairedBackslashes = candidate.replace(/\\/g, '/');
      const obj = JSON.parse(repairedBackslashes);
      if (obj && (obj.tool || obj.action || obj.name)) {
        return {
          tool: obj.tool || obj.action || obj.name,
          parameters: obj.parameters || obj.args || obj.params || {}
        };
      }
    } catch (e2) {}

    // Versuch 3: Relaxed JSON Regex Extraktion (falls JSON unvollständig oder leicht fehlerhaft formatiert ist)
    try {
      const toolMatch = candidate.match(/"(?:tool|action|name)"\s*:\s*"([^"]+)"/i);
      if (toolMatch) {
        const toolName = toolMatch[1];
        
        // Versuche parameters zu extrahieren
        let params = {};
        const paramsMatch = candidate.match(/"(?:parameters|args|params)"\s*:\s*(\{[\s\S]*?\})/i);
        if (paramsMatch) {
          try {
            params = JSON.parse(paramsMatch[1].replace(/\\/g, '/'));
          } catch (e3) {
            const pathMatch = paramsMatch[1].match(/"path"\s*:\s*"([^"]+)"/i);
            if (pathMatch) params.path = pathMatch[1];
            const cmdMatch = paramsMatch[1].match(/"command"\s*:\s*"([^"]+)"/i);
            if (cmdMatch) params.command = cmdMatch[1];
            const contentMatch = paramsMatch[1].match(/"content"\s*:\s*"([\s\S]*)"/i);
            if (contentMatch) params.content = contentMatch[1];
          }
        }
        return {
          tool: toolName,
          parameters: params
        };
      }
    } catch (e4) {}

    return null;
  }

  /**
   * Prüft, ob ChatGPT seinen eingebauten Code-Interpreter genutzt hat
   * oder versucht hat, Code/Befehle als reinen Text auszugeben.
   */
  function detectAttemptedTextAction(messageText) {
    if (!messageText) return null;

    // ⚠️ WICHTIGSTE ERKENNUNG: Eingebauter Code-Interpreter (Python-Sandbox)
    // ChatGPT läuft bash/python in seiner Cloud-Sandbox statt unsere Tools zu nutzen.
    // Typische Signale: "Arbeitsverzeichnis überprüft", "Analyzing", Python-Blocks mit pwd/ls
    const interpreterSignals = [
      /arbeitsverzeichnis\s+überprüft/i,
      /analysier(?:e|t|end|ing)/i,
      /```python[\s\S]*?bash\s*-[\s\S]*?```/i,  // Python-Block mit bash-Befehlen darin
      /ich\s+(?:kann|habe|werde).*?(?:ausführen|python|interpreter|sandbox)/i,
      /in\s+dieser\s+umgebung.*?nicht\s+(?:verfügbar|zugriff|möglich)/i,
      /ich\s+habe\s+keinen\s+zugriff/i,
      /die\s+von\s+dir\s+beschriebenen.*?tools?.*?nicht/i
    ];
    for (const sig of interpreterSignals) {
      if (sig.test(messageText)) {
        return { type: 'interpreter_misuse', snippet: 'Code-Interpreter statt FreeAI-Tool verwendet' };
      }
    }

    // Suche nach bash / sh / powershell / cmd Codeblöcken
    const cmdBlock = messageText.match(/```(?:bash|sh|powershell|cmd|terminal|shell)\s*([\s\S]*?)\s*```/i);
    if (cmdBlock) {
      return { type: 'command', snippet: cmdBlock[1].trim().split('\n')[0] };
    }

    // Suche nach direkten HTML/CSS/JS/PY Code-Blöcken (Datei als Chat-Text)
    const codeBlock = messageText.match(/```(?:html|css|javascript|js|python|py|tsx|jsx|php)\s*([\s\S]*?)\s*```/i);
    if (codeBlock) {
      return { type: 'code', snippet: 'Code-Block als Chattext statt write_file' };
    }

    return null;
  }

  async function executeAgentTool(toolName, params) {
    updateAgentUIState('EXECUTING_TOOL', `Führe Tool aus: ${toolName}...`);

    switch (toolName) {
      case 'list_files': {
        showToast('ChatGPT fragt nach Dateien', params.path ? `Pfad: ${params.path}` : 'Kompletter Workspace', 'tool');
        addLog(`📂 Tool 'list_files' ausgeführt (${params.path || '.'})`);
        const res = await callBridge('/api/list-files', { path: params.path || '', maxDepth: params.maxDepth || 6 });
        if (res.ok && res.data.success) {
          const filesSummary = res.data.files.map(f => `${f.type === 'directory' ? '[DIR]' : '[FILE]'} ${f.path} (${f.size || 0} B)`).join('\n');
          return {
            tool: 'list_files',
            success: true,
            totalFiles: res.data.totalFiles,
            totalDirectories: res.data.totalDirectories,
            files: filesSummary || 'Ordner ist leer'
          };
        } else {
          return { tool: 'list_files', success: false, error: res.data ? res.data.error : res.error };
        }
      }

      case 'read_file': {
        showToast('ChatGPT liest Datei', params.path, 'file');
        addLog(`📖 Tool 'read_file' aufgerufen: ${params.path}`);
        const res = await callBridge('/api/read-file', {
          path: params.path,
          startLine: params.startLine,
          endLine: params.endLine
        });
        if (res.ok && res.data.success) {
          return {
            tool: 'read_file',
            success: true,
            path: res.data.path,
            totalLines: res.data.totalLines,
            content: res.data.content
          };
        } else {
          return { tool: 'read_file', success: false, error: res.data ? res.data.error : res.error };
        }
      }

      case 'write_file': {
        showToast('ChatGPT schreibt Datei', `${params.path} (${(params.content || '').length} Zeichen)`, 'file');
        addLog(`💾 Tool 'write_file' aufgerufen: ${params.path}`);
        const res = await callBridge('/api/write-file', {
          path: params.path,
          content: params.content
        });
        if (res.ok && res.data.success) {
          return {
            tool: 'write_file',
            success: true,
            path: res.data.path,
            size: res.data.size,
            message: res.data.message
          };
        } else {
          return { tool: 'write_file', success: false, error: res.data ? res.data.error : res.error };
        }
      }

      case 'edit_file': {
        showToast('ChatGPT bearbeitet Datei', params.path, 'file');
        addLog(`✏️ Tool 'edit_file' aufgerufen: ${params.path}`);
        const res = await callBridge('/api/edit-file', {
          path: params.path,
          targetContent: params.targetContent,
          replacementContent: params.replacementContent,
          allowMultiple: params.allowMultiple || false
        });
        if (res.ok && res.data.success) {
          return {
            tool: 'edit_file',
            success: true,
            path: res.data.path,
            message: res.data.message
          };
        } else {
          return { tool: 'edit_file', success: false, error: res.data ? res.data.error : res.error };
        }
      }

      case 'delete_file': {
        showToast('ChatGPT löscht Datei', params.path, 'warning');
        addLog(`🗑️ Tool 'delete_file' aufgerufen: ${params.path}`);
        const res = await callBridge('/api/delete-file', { path: params.path });
        if (res.ok && res.data.success) {
          return { tool: 'delete_file', success: true, message: res.data.message };
        } else {
          return { tool: 'delete_file', success: false, error: res.data ? res.data.error : res.error };
        }
      }

      case 'run_command': {
        showToast('ChatGPT führt Befehl aus', params.command, 'cmd');
        addLog(`⚡ Tool 'run_command': ${params.command}`);
        const res = await callBridge('/api/execute-cmd', {
          command: params.command,
          cwd: params.cwd,
          timeoutMs: params.timeoutMs || 120000
        });
        if (res.ok && res.data.success) {
          addLog(`✅ Befehl beendet (ExitCode ${res.data.exitCode}) in ${res.data.executionTimeMs}ms`);
          return {
            tool: 'run_command',
            success: true,
            exitCode: res.data.exitCode,
            stdout: res.data.stdout,
            stderr: res.data.stderr,
            executionTimeMs: res.data.executionTimeMs
          };
        } else {
          addLog(`❌ Befehl mit Fehler beendet: ${res.data ? res.data.stderr : res.error}`, 'error');
          return {
            tool: 'run_command',
            success: false,
            exitCode: res.data ? res.data.exitCode : 1,
            stdout: res.data ? res.data.stdout : '',
            stderr: res.data ? res.data.stderr : res.error
          };
        }
      }

      case 'task_completed': {
        STATE.status = 'COMPLETED';
        showToast('🎉 Aufgabe abgeschlossen!', params.summary || 'ChatGPT hat das Projekt fertiggestellt und eine Zusammenfassung erstellt.', 'success', 10000);
        addLog(`🎉 AGENT FERTIG: ${params.summary || 'Projekt erfolgreich abgeschlossen'}`);
        updateAgentUIState('COMPLETED', 'Fertiggestellt - Zusammenfassung im Chat');
        return null;
      }

      default: {
        addLog(`❓ Unbekanntes Tool: ${toolName}`, 'warning');
        return {
          tool: toolName,
          success: false,
          error: `Unbekanntes Tool '${toolName}'. Verfügbare Tools: list_files, read_file, write_file, edit_file, delete_file, run_command, task_completed.`
        };
      }
    }
  }

  // ============================================================
  // 6. System Prompt Builder
  // ============================================================
  function buildInitialSystemPrompt(task, workspacePath, projectSnapshot) {
    const normalizedPath = (workspacePath || '').replace(/\\/g, '/');

    // Projektstruktur-Block — wurde bereits VOR dem Chat-Start abgerufen
    const snapshotBlock = projectSnapshot
      ? `\n\n📂 AKTUELLE PROJEKTSTRUKTUR (automatisch abgerufen beim Start):\n\`\`\`\n${projectSnapshot}\n\`\`\`\nNutze diese Information als Grundlage für deine Planung!`
      : `\n\n📂 PROJEKTSTRUKTUR: Ordner ist leer oder konnte nicht gelesen werden.`;

    return `[FREEAI AUTONOMOUS AGENT - SYSTEM PROTOKOLL v2]

Du bist der FreeAI Autonomous Coding Agent. Du hast ECHTE AUSFÜHRUNGSRECHTE auf dem lokalen PC des Nutzers.

╔══════════════════════════════════════════════════╗
║  WIE DAS SYSTEM FUNKTIONIERT                     ║
╠══════════════════════════════════════════════════╣
║  Eine Chrome Extension überwacht deinen Chat.    ║
║  Wenn du einen tool_call Block ausgibst, führt   ║
║  die Extension diesen SOFORT auf dem echten PC   ║
║  aus und sendet das Ergebnis als [TOOL RESULT]   ║
║  zurück. Das passiert vollautomatisch!           ║
╚══════════════════════════════════════════════════╝

🔴 VERBOTE (NIEMALS TUN):
1. ❌ NUTZE NICHT deinen eingebauten Python/Code-Interpreter!
   Du bist NICHT in deiner eigenen Sandbox. bash -lc, pwd, ls -la, Python etc. in deiner
   Cloud-Umgebung funktionieren hier NICHT und haben keinen Zugriff auf den PC des Nutzers.
   → Nutze stattdessen: run_command Tool (führt Befehle DIREKT auf dem PC aus)
2. ❌ ERSTELLE KEINE ZIP-Dateien oder Download-Links!
   → Nutze stattdessen: write_file Tool (schreibt Dateien direkt auf die Festplatte)
3. ❌ Gib KEINEN Code als normalen Chattext aus!
   → Nutze stattdessen: write_file Tool
4. ❌ Schreib KEINE Anleitungen wie "Führe folgenden Befehl aus..."!
   → Nutze stattdessen: run_command Tool

🟢 PFLICHTABLAUF - IMMER IN DIESER REIHENFOLGE:

╔══════════════════════════════════════════════════════════════════╗
║  PHASE 1 — VERSTEHEN (bereits erledigt, Struktur ist oben!)   ║
║  Die Projektstruktur wurde VOR diesem Chat automatisch          ║
║  abgerufen und dir oben angezeigt. Du kennst den Stand.        ║
║                                                                  ║
║  PHASE 2 — ERKUNDEN (falls nötig)                              ║
║  Lies relevante Dateien mit read_file, bevor du sie änderst.   ║
║  Nutze list_files erneut wenn du Unterordner erkunden willst.  ║
║                                                                  ║
║  PHASE 3 — UMSETZEN                                             ║
║  write_file (neu) / edit_file (anpassen) / delete_file (löschen)║
║  run_command für Terminal-Befehle                              ║
║                                                                  ║
║  PHASE 4 — ABSCHLIESSEN                                         ║
║  task_completed mit detaillierter Zusammenfassung               ║
╚══════════════════════════════════════════════════════════════════╝

Jede deiner Antworten enthält genau EINEN \`\`\`tool_call Block.
Du wartest auf [TOOL RESULT], dann folgst du mit dem nächsten Block.

📋 VERFÜGBARE TOOLS:

\`\`\`tool_call
{ "tool": "list_files", "parameters": {} }
\`\`\`

\`\`\`tool_call
{ "tool": "read_file", "parameters": { "path": "index.html" } }
\`\`\`

\`\`\`tool_call
{ "tool": "write_file", "parameters": { "path": "index.html", "content": "<!DOCTYPE html>..." } }
\`\`\`

\`\`\`tool_call
{ "tool": "edit_file", "parameters": { "path": "datei.txt", "targetContent": "alt", "replacementContent": "neu" } }
\`\`\`

\`\`\`tool_call
{ "tool": "delete_file", "parameters": { "path": "temp.txt" } }
\`\`\`

\`\`\`tool_call
{ "tool": "run_command", "parameters": { "command": "npm install" } }
\`\`\`

\`\`\`tool_call
{ "tool": "task_completed", "parameters": { "summary": "Alle Dateien erfolgreich erstellt!" } }
\`\`\`

---
PROJEKTORDNER AUF DEM PC: ${normalizedPath}${snapshotBlock}

AUFGABE:
${task}

➡️ STARTE JETZT MIT PHASE 2 oder 3 (je nach Bedarf)!
Du hast die Projektstruktur oben bereits. Lese bei Bedarf relevante Dateien mit read_file
und setze dann die Aufgabe um. Nutze NICHT deinen Python/Code-Interpreter!`;
  }

  // ============================================================
  // 7. Der Autonome Agent Loop
  // ============================================================
  let agentLoopTimer = null;


  async function startAgent() {
    await checkBridgeStatus();
    if (!STATE.bridgeOnline) {
      showToast('Bridge Server nicht erreichbar', 'Bitte starte start-bridge.bat im bridge-server Ordner!', 'error');
      addLog('❌ Konnte nicht starten: Bridge Server Offline', 'error');
      return;
    }

    const taskInput = document.getElementById('freeai-task-input');
    const task = (taskInput ? taskInput.value.trim() : '') || STATE.currentTask;

    if (!task) {
      showToast('Keine Aufgabe eingegeben', 'Bitte gib eine Aufgabe für den Agenten ein.', 'warning');
      return;
    }

    STATE.currentTask = task;
    STATE.status = 'RUNNING';
    STATE.step = 1;
    STATE.lastProcessedMessage = '';

    updateAgentUIState('RUNNING', 'Erkunde Projektstruktur...');
    showToast('Agent gestartet', `Erkunde Projektstruktur in: ${STATE.workspace || '(kein Ordner)'}`, 'info');
    addLog(`🚀 AGENT GESTARTET: ${task}`);

    // -------------------------------------------------------
    // AUTOMATISCHE PROJEKTERKUNDUNG vor dem ersten Chat-Prompt
    // -------------------------------------------------------
    addLog('📂 Lese Projektstruktur automatisch (list_files)...');
    let projectSnapshot = null;
    const snapRes = await callBridge('/api/list-files', { path: '', maxDepth: 6 });
    if (snapRes.ok && snapRes.data && snapRes.data.success) {
      const files = snapRes.data.files || [];
      if (files.length === 0) {
        projectSnapshot = '(Ordner ist leer — noch keine Dateien vorhanden)';
      } else {
        projectSnapshot = files
          .map(f => `${f.type === 'directory' ? '[DIR] ' : '[FILE]'} ${f.path}${f.size ? ' (' + f.size + ' B)' : ''}`)
          .join('\n');
      }
      addLog(`✅ Projektstruktur gelesen: ${files.length} Einträge`);
      showToast('📂 Projektstruktur gelesen', `${files.length} Dateien/Ordner gefunden`, 'success');
    } else {
      projectSnapshot = '(Projektstruktur konnte nicht gelesen werden — Bridge offline oder Ordner nicht gesetzt)';
      addLog('⚠️ Projektstruktur konnte nicht gelesen werden', 'warning');
    }

    // Initialen Prompt absenden (mit eingebetteter Projektstruktur)
    updateAgentUIState('RUNNING', 'Sende Aufgabe an ChatGPT...');
    const initialPrompt = buildInitialSystemPrompt(task, STATE.workspace, projectSnapshot);
    const sent = await submitPrompt(initialPrompt);

    if (!sent) {
      STATE.status = 'ERROR';
      updateAgentUIState('ERROR', 'Konnte Prompt nicht in ChatGPT eingeben');
      return;
    }

    // Starte den Loop-Checker
    runAgentStepLoop();
  }

  function pauseAgent() {
    STATE.status = 'PAUSED';
    if (agentLoopTimer) clearTimeout(agentLoopTimer);
    updateAgentUIState('PAUSED', 'Agent pausiert');
    showToast('Agent pausiert', 'Du kannst den Agenten jederzeit fortsetzen.', 'warning');
    addLog('⏸️ Agent pausiert');
  }

  function stopAgent() {
    STATE.status = 'IDLE';
    if (agentLoopTimer) clearTimeout(agentLoopTimer);
    updateAgentUIState('IDLE', 'Agent gestoppt');
    showToast('Agent gestoppt', 'Agent wurde zurückgesetzt.', 'info');
    addLog('⏹️ Agent gestoppt');
  }

  async function runAgentStepLoop() {
    if (STATE.status !== 'RUNNING') return;

    if (STATE.step > CONFIG.maxSteps) {
      STATE.status = 'ERROR';
      showToast('Schrittlimit erreicht', `Maximales Limit von ${CONFIG.maxSteps} Schritten erreicht.`, 'warning');
      updateAgentUIState('ERROR', 'Schrittlimit erreicht');
      return;
    }

    // 1. Warte, bis ChatGPT mit dem Streamen / Generieren fertig ist
    updateAgentUIState('WAITING_STREAM', `ChatGPT denkt nach (Schritt ${STATE.step})...`);

    // Gib ChatGPT Zeit zum Starten des Streamings
    await sleep(1500);

    let streamWaitSeconds = 0;
    while (isChatGptStreaming()) {
      if (STATE.status !== 'RUNNING') return;
      await sleep(CONFIG.pollIntervalMs);
      streamWaitSeconds += CONFIG.pollIntervalMs / 1000;

      if (streamWaitSeconds > CONFIG.maxWaitResponseSeconds) {
        showToast('Timeout', 'ChatGPT hat zu lange gebraucht.', 'error');
        addLog('❌ Timeout beim Warten auf ChatGPT Antwort', 'error');
        STATE.status = 'ERROR';
        updateAgentUIState('ERROR', 'Timeout');
        return;
      }
    }

    // Beruhigungs-Pause nach Streaming-Ende, damit das React DOM vollständig gerendert ist
    await sleep(1200);

    // 2. Extrahiere die letzte Antwort von ChatGPT
    const latestTurn = getLatestAssistantTurn();
    const latestMessage = latestTurn ? (latestTurn.innerText || latestTurn.textContent || '') : '';
    
    if (!latestMessage && !latestTurn) {
      addLog('⏳ Warte auf erste Antwort von ChatGPT...');
      agentLoopTimer = setTimeout(runAgentStepLoop, CONFIG.pollIntervalMs * 2);
      return;
    }

    // 3. Suche nach Tool-Calls in der Nachricht (DOM <pre><code>, Text & globale Codeblöcke)
    const toolCall = parseToolCall(latestMessage, latestTurn);

    if (!toolCall) {
      // Prüfe, ob ChatGPT trotzdem eine Fertigstellung signalisiert hat
      if (latestMessage.includes('task_completed') || latestMessage.includes('"task_completed"')) {
        STATE.status = 'COMPLETED';
        showToast('🎉 Aufgabe abgeschlossen!', 'Projekt fertiggestellt. Zusammenfassung verfügbar.', 'success', 8000);
        addLog('🎉 AGENT FERTIG: Aufgabe abgeschlossen.');
        updateAgentUIState('COMPLETED', 'Fertiggestellt - Zusammenfassung im Chat');
        return;
      }

      // ChatGPT hat KEINEN Tool-Call generiert → Erkenne die Art des Fehlers
      const attempted = detectAttemptedTextAction(latestMessage);
      
      showToast('⚠️ ChatGPT Korrektur nötig!', 'Sende Korrekturaufforderung...', 'warning', 5000);
      addLog(`⚠️ Kein tool_call erkannt (Typ: ${attempted ? attempted.type : 'unbekannt'}). Sende Korrektur...`, 'warning');

      let reminderPrompt = '';

      if (attempted && attempted.type === 'interpreter_misuse') {
        // 🔴 KRITISCHSTER FALL: ChatGPT hat seinen eingebauten Python/Code-Interpreter genutzt
        addLog('🔴 FEHLER: ChatGPT hat Python/Code-Interpreter statt FreeAI-Tools genutzt!', 'error');
        reminderPrompt = `[FREEAI FEHLERKORREKTUR: FALSCHES TOOL VERWENDET!]

🔴 Du hast deinen eingebauten Python/Code-Interpreter verwendet (bash -lc, pwd, ls -la etc.)!
DAS FUNKTIONIERT HIER NICHT. Deine Sandbox hat keinen Zugriff auf den PC des Nutzers.

Du hast gesagt: "Ich kann nicht auf C:/Users/... zugreifen" oder ähnliches.
DAS STIMMT NICHT - du kannst es, aber NUR über die FreeAI-Tools!

✅ SO FUNKTIONIERT ES RICHTIG:
Die FreeAI Chrome Extension führt deine \`\`\`tool_call Blöcke auf dem ECHTEN PC aus.
Du musst NUR den JSON-Block ausgeben - KEIN Python, KEIN Bash, KEIN Code-Interpreter!

Beispiel - jetzt sofort ausführen:
\`\`\`tool_call
{
  "tool": "write_file",
  "parameters": {
    "path": "index.html",
    "content": "<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hallo!</h1></body></html>"
  }
}
\`\`\`

Schreibe JETZT genau so einen tool_call Block und warte auf [TOOL RESULT]!`;

      } else if (attempted && attempted.type === 'command') {
        reminderPrompt = `[FREEAI KORREKTUR: BEFEHL ALS TOOL AUSFÜHREN]

Du hast den Befehl "${attempted.snippet}" als Text ausgegeben.
Nutze stattdessen das run_command Tool:

\`\`\`tool_call
{
  "tool": "run_command",
  "parameters": {
    "command": "${attempted.snippet.replace(/"/g, '\\"')}"
  }
}
\`\`\`

Schreibe JETZT diesen tool_call Block!`;

      } else if (attempted && attempted.type === 'code') {
        reminderPrompt = `[FREEAI KORREKTUR: DATEI DIREKT SCHREIBEN]

Du hast Code als Chattext ausgegeben. Nutze stattdessen das write_file Tool:

\`\`\`tool_call
{
  "tool": "write_file",
  "parameters": {
    "path": "DATEINAME_HIER.html",
    "content": "VOLLSTÄNDIGER DATEIINHALT HIER"
  }
}
\`\`\`

Schreibe JETZT diesen tool_call Block mit dem vollständigen Dateiinhalt!`;

      } else {
        // Generischer Reminder
        reminderPrompt = `[FREEAI KORREKTUR: TOOL_CALL BLOCK FEHLT]

Deine letzte Antwort enthielt keinen gültigen \`\`\`tool_call Block.
Schreibe JETZT den nächsten Schritt als tool_call:

\`\`\`tool_call
{
  "tool": "write_file",
  "parameters": {
    "path": "index.html",
    "content": "<!DOCTYPE html>..."
  }
}
\`\`\`

ODER falls alles fertig ist:
\`\`\`tool_call
{
  "tool": "task_completed",
  "parameters": {
    "summary": "Deine Zusammenfassung hier"
  }
}
\`\`\``;
      }

      await submitPrompt(reminderPrompt);
      STATE.step++;
      agentLoopTimer = setTimeout(runAgentStepLoop, 2000);
      return;
    } else {
      // 4. Führe den Tool-Call aus
      addLog(`⚙️ Führe Schritt ${STATE.step} aus: Tool '${toolCall.tool}'`);
      const result = await executeAgentTool(toolCall.tool, toolCall.parameters);

      if (STATE.status === 'COMPLETED') {
        // Task fertig! ChatGPT hat task_completed aufgerufen und seine Zusammenfassung geliefert.
        return;
      }

      if (result) {
        // 5. Sende das Resultat als nächste Nachricht zurück an ChatGPT
        updateAgentUIState('SENDING_RESULT', `Sende Ergebnis von '${toolCall.tool}'...`);
        const resultPrompt = `[TOOL RESULT for ${toolCall.tool}]
\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\`
Ergebnis erfolgreich verarbeitet. Fahre jetzt direkt mit dem nächsten Schritt fort. Rufe das nächste Tool im Format \`\`\`tool_call { ... } \`\`\` auf (z.B. write_file oder run_command), oder beende mit "task_completed" falls alles fertig ist.`;

        await sleep(500);
        const sent = await submitPrompt(resultPrompt);
        if (!sent) {
          showToast('Senden fehlgeschlagen', 'Konnte Tool-Ergebnis nicht absenden', 'error');
          addLog('❌ Konnte Tool-Ergebnis nicht absenden', 'error');
        }

        STATE.step++;
        const stepDisplay = document.getElementById('freeai-step-display');
        if (stepDisplay) stepDisplay.innerText = `Schritt: ${STATE.step}`;
      }
    }

    // 6. Nächste Runde im Loop
    if (STATE.status === 'RUNNING') {
      agentLoopTimer = setTimeout(runAgentStepLoop, CONFIG.pollIntervalMs);
    }
  }

  // ============================================================
  // 8. Agent UI (Floating Glassmorphic HUD & Launcher Pill)
  // ============================================================
  function updateAgentUIState(state, actionText) {
    const badge = document.getElementById('freeai-agent-badge');
    const actionDisplay = document.getElementById('freeai-action-text');

    if (badge) {
      badge.className = `freeai-agent-state-badge state-${state.toLowerCase()}`;
      badge.innerText = state;
    }
    if (actionDisplay && actionText) {
      actionDisplay.innerHTML = `<span class="freeai-spinner"></span> ${escapeHtml(actionText)}`;
      if (state === 'IDLE' || state === 'COMPLETED') {
        actionDisplay.innerHTML = `<span>${escapeHtml(actionText)}</span>`;
      }
    }
  }

  function injectAgentUI() {
    if (document.getElementById('freeai-agent-hud')) return;

    // HUD Container
    const hud = document.createElement('div');
    hud.id = 'freeai-agent-hud';

    hud.innerHTML = `
      <!-- Header -->
      <div class="freeai-header" id="freeai-hud-header">
        <div class="freeai-logo-group">
          <span class="freeai-logo-badge">FREE AI</span>
          <span class="freeai-title">Autonomous Coding IDE</span>
        </div>
        <div class="freeai-header-actions">
          <button class="freeai-btn-icon" id="freeai-btn-minimize" title="Minimieren">➖</button>
        </div>
      </div>

      <!-- Status & Workspace -->
      <div class="freeai-section">
        <div class="freeai-status-row">
          <div class="freeai-status-indicator">
            <span class="freeai-status-dot" id="freeai-status-dot"></span>
            <span id="freeai-status-text">Prüfe Bridge...</span>
          </div>
          <button class="freeai-btn-secondary" id="freeai-btn-reconnect" title="Verbindung neu prüfen">🔄 Reconnect</button>
        </div>

        <div class="freeai-workspace-box">
          <span class="freeai-label">Projektordner auf PC</span>
          <div class="freeai-input-group">
            <input type="text" class="freeai-input" id="freeai-workspace-input" placeholder="C:\\MeinProjekt..." value="${escapeHtml(STATE.workspace)}" />
            <button class="freeai-btn-secondary" id="freeai-btn-browse" title="Ordner auswählen">📂 Browse</button>
          </div>
        </div>

        <!-- Task Prompt Area -->
        <div class="freeai-task-area">
          <span class="freeai-label">Aufgabe für ChatGPT (Unendlich Free)</span>
          <textarea class="freeai-textarea" id="freeai-task-input" placeholder="z. B. Baue mir eine vollständige Landingpage mit modernem Dark Mode, responsivem Navigationsmenü und Kontaktformular..."></textarea>
          
          <div class="freeai-pills-row">
            <span class="freeai-pill" data-prompt="Baue eine moderne, responsive Website mit HTML, CSS und JS">🌐 Website erstellen</span>
            <span class="freeai-pill" data-prompt="Erstelle eine interaktive Todo-App mit LocalStorage, Filter und Dark Mode">📝 Todo App</span>
            <span class="freeai-pill" data-prompt="Analysiere die Dateien im Projekt, finde Fehler und behebe sie">🔍 Projekt analysieren & fixen</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="freeai-actions-row">
          <button class="freeai-btn-primary" id="freeai-btn-start">
            <span>▶️</span> <span>Agent Starten</span>
          </button>
          <button class="freeai-btn-secondary" id="freeai-btn-pause" style="display:none;">
            <span>⏸️</span> <span>Pause</span>
          </button>
          <button class="freeai-btn-danger" id="freeai-btn-stop" style="display:none;">
            <span>⏹️</span> <span>Stop</span>
          </button>
        </div>

        <!-- Progress Card -->
        <div class="freeai-progress-card">
          <div class="freeai-progress-header">
            <span class="freeai-agent-state-badge state-idle" id="freeai-agent-badge">IDLE</span>
            <span class="freeai-step-count" id="freeai-step-display">Schritt: 0</span>
          </div>
          <div class="freeai-current-action" id="freeai-action-text">Bereit für deine Aufgabe</div>
        </div>
      </div>

      <!-- Activity Console Log -->
      <div class="freeai-log-section">
        <div class="freeai-log-header">
          <span>Aktivitäts-Protokoll</span>
          <span id="freeai-btn-clear-log" style="cursor:pointer; color:#6366f1;">Leeren</span>
        </div>
        <div class="freeai-log-content" id="freeai-log-content">
          <div class="freeai-log-entry">
            <span class="freeai-log-time">[Init]</span>
            <span>FreeAI Agent HUD initialisiert. Bereit.</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(hud);

    // Launcher Pill (für minimierten Zustand)
    const launcher = document.createElement('div');
    launcher.id = 'freeai-launcher-pill';
    launcher.style.display = 'none';
    launcher.innerHTML = `
      <span class="freeai-logo-badge">FREE AI</span>
      <span>IDE Agent</span>
    `;
    launcher.addEventListener('click', () => {
      hud.classList.remove('minimized');
      launcher.style.display = 'none';
      STATE.isMinimized = false;
    });
    document.body.appendChild(launcher);

    // Event Listener anhängen
    setupUIEventListeners(hud, launcher);

    // Initial Status prüfen
    checkBridgeStatus();
  }

  function setupUIEventListeners(hud, launcher) {
    // Minimieren Button
    document.getElementById('freeai-btn-minimize').addEventListener('click', () => {
      hud.classList.add('minimized');
      launcher.style.display = 'flex';
      STATE.isMinimized = true;
    });

    // Reconnect Button
    document.getElementById('freeai-btn-reconnect').addEventListener('click', async () => {
      showToast('Prüfe Verbindung', 'Verbinde mit Bridge Server...', 'info');
      await checkBridgeStatus();
    });

    // Workspace Input Change
    const wsInput = document.getElementById('freeai-workspace-input');
    wsInput.addEventListener('change', (e) => {
      setWorkspaceFolder(e.target.value.trim());
    });

    // Browse Button
    document.getElementById('freeai-btn-browse').addEventListener('click', pickFolderNative);

    // Quick Prompt Pills
    document.querySelectorAll('.freeai-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const taskInput = document.getElementById('freeai-task-input');
        if (taskInput) {
          taskInput.value = pill.getAttribute('data-prompt');
          taskInput.focus();
        }
      });
    });

    // Start / Pause / Stop Buttons
    const startBtn = document.getElementById('freeai-btn-start');
    const pauseBtn = document.getElementById('freeai-btn-pause');
    const stopBtn = document.getElementById('freeai-btn-stop');

    startBtn.addEventListener('click', () => {
      startBtn.style.display = 'none';
      pauseBtn.style.display = 'flex';
      stopBtn.style.display = 'flex';
      startAgent();
    });

    pauseBtn.addEventListener('click', () => {
      if (STATE.status === 'RUNNING') {
        pauseAgent();
        pauseBtn.innerHTML = '<span>▶️</span> <span>Weiter</span>';
      } else if (STATE.status === 'PAUSED') {
        STATE.status = 'RUNNING';
        pauseBtn.innerHTML = '<span>⏸️</span> <span>Pause</span>';
        updateAgentUIState('RUNNING', 'Agent fortgesetzt...');
        runAgentStepLoop();
      }
    });

    stopBtn.addEventListener('click', () => {
      stopAgent();
      startBtn.style.display = 'flex';
      pauseBtn.style.display = 'none';
      stopBtn.style.display = 'none';
    });

    // Log leeren
    document.getElementById('freeai-btn-clear-log').addEventListener('click', () => {
      const logContent = document.getElementById('freeai-log-content');
      if (logContent) logContent.innerHTML = '';
      STATE.logs = [];
    });
  }

  // Hilfsfunktion: HTML Escaping
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================
  // 9. Startup & Initialisierung
  // ============================================================
  // Warte kurz, bis die ChatGPT-Seite geladen ist
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(injectAgentUI, 1500));
  } else {
    setTimeout(injectAgentUI, 1500);
  }

  // Regelmäßige Bridge-Statusprüfung alle 10 Sekunden
  setInterval(checkBridgeStatus, 10000);

})();
