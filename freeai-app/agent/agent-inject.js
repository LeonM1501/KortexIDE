/**
 * Kortex Agent Inject Script v6
 * - Intelligent task routing: direct answers for greetings & general questions without unnecessary file reads
 * - Robust tool parser: handles malformed backticks, <pre><code> DOM blocks, and flat/nested JSON params
 * - Declared tool handshake with watchdog auto-retry on connection stalls
 * - Clean stop & reset lifecycle
 */
(function () {
  'use strict';

  const bridge = window.__freeaiBridge;
  function emit(type, payload) {
    try { bridge && bridge.sendEvent({ type, payload, ts: Date.now() }); } catch {}
  }

  // ── State ─────────────────────────────────────────────
  let AGENT_STATE = {
    running: false,
    workspace: '',
    task: '',
    step: 0,
    maxSteps: 250,
    pollMs: 400,
    responseTimeoutMs: 180000,
    stallTimeoutMs: 15000,
    retryLimit: 2,
    startTime: 0,
    lastPrompt: '',
    awaitingAssistantCount: 0,
    conversationOnly: false
  };

  let loopTimer = null;
  let lastStreamedText = '';
  let _toolResultResolve = null;
  let _toolResultTimer = null;

  // ── DOM Helpers ───────────────────────────────────────
  function getInput() {
    return document.querySelector('#prompt-textarea') ||
           document.querySelector('div#prompt-textarea') ||
           document.querySelector('div[contenteditable="true"][id*="prompt"]') ||
           document.querySelector('div[contenteditable="true"][role="textbox"]') ||
           document.querySelector('div[contenteditable="true"]') ||
           document.querySelector('textarea[data-id="root"]') ||
           document.querySelector('textarea');
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }

  function getSendBtn() {
    const candidates = Array.from(document.querySelectorAll(
      'button[data-testid="send-button"], button[data-testid="fruitjuice-send-button"], button[data-testid*="send"], button[aria-label*="Send"], button[aria-label*="Senden"], button[aria-label*="Prompt senden"], form button[type="submit"]'
    ));
    const filtered = candidates.filter(btn => {
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      const testId = (btn.getAttribute('data-testid') || '').toLowerCase();
      if (testId.includes('speech') || testId.includes('voice') || testId.includes('mic')) return false;
      if (label.includes('sprach') || label.includes('voice') || label.includes('diktier') || label.includes('record')) return false;
      return true;
    });
    return filtered.find(isVisible) || filtered[0] || candidates.find(isVisible) || candidates[0] || null;
  }

  function getStopBtn() {
    const candidates = [
      ...document.querySelectorAll('button[data-testid="stop-button"], button[aria-label*="Stop"], button[aria-label*="stop"], button[aria-label*="Generierung stoppen"], button[aria-label*="Antwort stoppen"]')
    ];
    return candidates.find(isVisible) || null;
  }

  function getAssistantTurns() {
    return Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
  }

  function getTurnText(turn) {
    return turn ? (turn.innerText || turn.textContent || '') : '';
  }

  function hasErrorOrInterruption(turn) {
    const errorPattern = /Verbindung unterbrochen|There was an error generating|There was an error|Network error|Fehler bei der Generierung|Generation stopped/i;
    if (errorPattern.test(getTurnText(turn))) return true;
    return Array.from(document.querySelectorAll('[role="alert"]'))
      .some(node => errorPattern.test(getTurnText(node)));
  }

  function isStreaming() {
    return Boolean(getStopBtn() || Array.from(document.querySelectorAll('.result-streaming, [data-is-streaming="true"], [aria-busy="true"]')).some(isVisible));
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── Text Cleaning ─────────────────────────────────────
  function extractCleanText(rawText) {
    if (!rawText) return '';
    let text = rawText;

    // Remove <thought>...</thought>
    text = text.replace(/<thought>[\s\S]*?<\/thought>/gi, '');
    const openThoughtMatch = /<thought>/i.exec(text);
    if (openThoughtMatch) text = text.substring(0, openThoughtMatch.index);

    // Remove tool_call or json code blocks with tool payload
    text = text.replace(/```(?:json|tool_call)?\s*([\s\S]*?)\s*```/gi, (block, body) => {
      return tryParse(body) ? '' : block;
    });

    // Cut at tool_call keyword
    const toolCallKw = text.search(/\btool_call\b/i);
    if (toolCallKw !== -1) text = text.substring(0, toolCallKw);

    // Cut at JSON tool object ({"tool":..., {"name":..., {"action":...)
    const jsonToolPattern = /\{[\s\r\n]*"(?:tool|action|name)"\s*:/i;
    const jsonMatch = jsonToolPattern.exec(text);
    if (jsonMatch) text = text.substring(0, jsonMatch.index);

    // Strip trailing braces, unclosed code fences, and trailing JSON/tool_call keywords
    text = text.replace(/[\}\]]\s*$/, '');
    text = text.replace(/`+\s*$/, '');
    text = text.replace(/(?:^|\n|\s+)(?:json|tool_call)\s*$/i, '');

    const trimmed = text.trim();
    if (/^[\{\}\[\]\s]+$/.test(trimmed)) return '';
    return trimmed;
  }

  function extractThought(rawText) {
    if (!rawText) return '';
    const match = rawText.match(/<thought>([\s\S]*?)<\/thought>/i);
    if (match) return match[1].trim();
    const openMatch = /<thought>/i.exec(rawText);
    if (openMatch) return rawText.substring(openMatch.index + openMatch[0].length).trim();
    return '';
  }

  // ── Prompt Submission (React-compatible) ──────────────
  async function submitPrompt(text, retries = 15) {
    AGENT_STATE.lastPrompt = text;
    AGENT_STATE.awaitingAssistantCount = getAssistantTurns().length;
    let input = getInput();
    if (!input) {
      if (retries <= 0) {
        if (AGENT_STATE.running) {
          emit('agent:error', { message: 'Das ChatGPT-Eingabefeld konnte nicht gefunden werden.' });
          AGENT_STATE.running = false;
        }
        return false;
      }
      await sleep(600);
      return submitPrompt(text, retries - 1);
    }

    input.focus();

    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
      const nativeSetter =
        Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set ||
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (nativeSetter) {
        nativeSetter.call(input, text);
      } else {
        input.value = text;
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // Contenteditable (ProseMirror in ChatGPT)
      input.focus();
      try {
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        document.execCommand('insertText', false, text);
      } catch (e) {}

      if (!input.innerText || !input.innerText.trim()) {
        input.innerHTML = '';
        const p = document.createElement('p');
        p.innerText = text;
        input.appendChild(p);
      }
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    await sleep(400);
    if (!AGENT_STATE.running) return false;
    let btn = getSendBtn();
    for (let i = 0; i < 20 && (!btn || btn.disabled); i++) {
      await sleep(200);
      btn = getSendBtn();
    }
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }

    // Fallback: Dispatch Enter key
    const keyOptions = { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 };
    input.dispatchEvent(new KeyboardEvent('keydown', keyOptions));
    input.dispatchEvent(new KeyboardEvent('keyup', keyOptions));
    await sleep(400);
    return Boolean(getSendBtn() || getAssistantTurns().length > AGENT_STATE.awaitingAssistantCount);
  }

  // ── Tool Call Parser ──────────────────────────────────
  function parseToolCall(turnEl) {
    if (!turnEl) return null;
    const text = turnEl.innerText || turnEl.textContent || '';

    // Strategy 1: DOM code elements (pre, code, monospace containers)
    const codeEls = turnEl.querySelectorAll('pre, code, div[class*="font-mono"], div[class*="code"]');
    for (const el of codeEls) {
      const txt = el.innerText || el.textContent || '';
      const result = tryParse(txt);
      if (result) return result;
    }

    // Strategy 2: Code blocks in text
    const blockMatch = text.match(/`{1,3}(?:tool_call|json)?\s*([\s\S]*?)\s*`{0,3}/i);
    if (blockMatch) {
      const r = tryParse(blockMatch[1]);
      if (r) return r;
    }

    // Strategy 3: Full text scanning
    return tryParse(text);
  }

  function tryParse(str) {
    if (!str) return null;
    let cleaned = str
      .replace(/^(?:tool_call|json)\s*/i, '')
      .replace(/^copy\s*code\s*/i, '')
      .replace(/`+$/g, '')
      .trim();

    // 1. Markdown code block extraction (scan from START to get FIRST tool)
    const codeBlocks = Array.from(str.matchAll(/`{1,3}(?:json|tool_call)?\s*([\s\S]*?)\s*`{0,3}/gi));
    for (let i = 0; i < codeBlocks.length; i++) {
      const blockContent = codeBlocks[i][1].trim();
      const s = blockContent.indexOf('{');
      const e = blockContent.lastIndexOf('}');
      if (s !== -1 && e > s) {
        const cand = blockContent.substring(s, e + 1);
        try {
          const obj = JSON.parse(cand);
          if (obj && (obj.tool || obj.action || obj.name)) return normalize(obj);
        } catch {}
      }
    }

    // 2. Scan string for valid JSON objects from start to end (first tool)
    const toolKeywords = Array.from(cleaned.matchAll(/"(?:tool|action|name)"\s*:\s*"([^"]+)"/gi));
    for (let i = 0; i < toolKeywords.length; i++) {
      const match = toolKeywords[i];
      const matchIdx = match.index;
      const s = cleaned.lastIndexOf('{', matchIdx);
      if (s === -1) continue;

      let depth = 0;
      let e = -1;
      let inString = false;
      let escape = false;
      for (let j = s; j < cleaned.length; j++) {
        const char = cleaned[j];
        if (escape) { escape = false; continue; }
        if (char === '\\') { escape = true; continue; }
        if (char === '"') { inString = !inString; continue; }
        if (!inString) {
          if (char === '{') depth++;
          else if (char === '}') {
            depth--;
            if (depth === 0) { e = j; break; }
          }
        }
      }

      if (e > s) {
        const candidate = cleaned.substring(s, e + 1);
        try {
          const obj = JSON.parse(candidate);
          if (obj && (obj.tool || obj.action || obj.name)) return normalize(obj);
        } catch {}
        try {
          const obj = JSON.parse(candidate.replace(/\\/g, '/'));
          if (obj && (obj.tool || obj.action || obj.name)) return normalize(obj);
        } catch {}
      }
    }

    return null;
  }

  function normalize(obj) {
    const RESERVED = new Set(['tool', 'action', 'name', 'parameters', 'args', 'params']);
    const baseTool = obj.tool || obj.action || obj.name;
    let parameters = obj.parameters || obj.args || obj.params || {};

    if (Object.keys(parameters).length === 0) {
      const lifted = {};
      for (const key of Object.keys(obj)) {
        if (!RESERVED.has(key)) lifted[key] = obj[key];
      }
      if (Object.keys(lifted).length > 0) parameters = lifted;
    }

    return { tool: baseTool, parameters };
  }

  // ── Stable Response Watcher ───────────────────────────
  async function waitForAssistantResponseStable() {
    const expectedCount = AGENT_STATE.awaitingAssistantCount;
    const startedAt = Date.now();
    let lastText = '';
    let lastProgressAt = Date.now();
    let turnAppearedAt = 0;
    let observedTurn = null;

    while (AGENT_STATE.running) {
      const turns = getAssistantTurns();
      if (turns.length > expectedCount) {
        const turn = turns[turns.length - 1];
        if (turn !== observedTurn) {
          observedTurn = turn;
          turnAppearedAt = Date.now();
          lastText = '';
          lastProgressAt = turnAppearedAt;
        }
        const text = getTurnText(turn);
        if (text !== lastText) {
          lastText = text;
          lastProgressAt = Date.now();
          const thought = extractThought(text);
          const clean = extractCleanText(text);
          if (thought) emit('agent:thought', { thought, elapsedSec: Math.round((Date.now() - AGENT_STATE.startTime) / 1000) });
          if (clean) emit('agent:text-chunk', { text: clean, isComplete: !isStreaming() });
        }

        if (hasErrorOrInterruption(turn)) return { turn, error: true };
        if (isStreaming()) {
          // Stall watchdog: If no new token received for stallTimeoutMs (15s)
          if (Date.now() - lastProgressAt > AGENT_STATE.stallTimeoutMs) {
            return { turn, timeout: true };
          }
          await sleep(AGENT_STATE.pollMs);
          continue;
        }

        if (!text.trim() && Date.now() - turnAppearedAt < 5000) {
          await sleep(AGENT_STATE.pollMs);
          continue;
        }
        await sleep(600);
        return { turn };
      }

      if (Date.now() - startedAt > AGENT_STATE.responseTimeoutMs) return { timeout: true };
      await sleep(AGENT_STATE.pollMs);
    }
    return null;
  }

  async function retryCurrentPrompt(reason, attempt) {
    if (attempt >= AGENT_STATE.retryLimit || !AGENT_STATE.lastPrompt) return false;
    emit('agent:status', {
      message: `${reason} — versuche aktuellen Schritt automatisch erneut (${attempt + 1}/${AGENT_STATE.retryLimit}).`,
      level: 'warning'
    });
    const stopBtn = getStopBtn();
    if (stopBtn) stopBtn.click();
    await sleep(1000);
    return submitPrompt(AGENT_STATE.lastPrompt);
  }

  // ── Unified ReAct Agent Loop ──────────────────────────
  async function runLoopStable(retryAttempt = 0) {
    if (!AGENT_STATE.running) return;
    if (AGENT_STATE.step > AGENT_STATE.maxSteps) {
      emit('agent:error', { message: 'Maximale Schrittzahl erreicht.' });
      AGENT_STATE.running = false;
      return;
    }

    emit('agent:step', { step: AGENT_STATE.step, elapsedSec: Math.round((Date.now() - AGENT_STATE.startTime) / 1000) });
    const response = await waitForAssistantResponseStable();
    if (!AGENT_STATE.running || !response) return;

    if (response.error || response.timeout) {
      const reason = response.error ? 'ChatGPT meldet eine unterbrochene Verbindung' : 'Antwort hat zu lange pausiert (Timeout)';
      if (await retryCurrentPrompt(reason, retryAttempt)) {
        loopTimer = setTimeout(() => runLoopStable(retryAttempt + 1), 600);
      } else {
        emit('agent:error', { message: `${reason}. Der Agent wurde angehalten.` });
        AGENT_STATE.running = false;
      }
      return;
    }

    const turn = response.turn;
    const fullRaw = getTurnText(turn);
    const cleanText = extractCleanText(fullRaw);
    const thought = extractThought(fullRaw);
    if (thought) emit('agent:thought', { thought, elapsedSec: Math.round((Date.now() - AGENT_STATE.startTime) / 1000) });

    const toolCall = parseToolCall(turn);

    // If pure conversation (greetings, general chat, or question without tools)
    if (AGENT_STATE.conversationOnly || (!toolCall && AGENT_STATE.step === 1 && cleanText)) {
      if (cleanText) emit('agent:text-chunk', { text: cleanText, isComplete: true });
      emit('agent:completed', { summary: cleanText || fullRaw });
      AGENT_STATE.running = false;
      return;
    }

    if (cleanText && toolCall && toolCall.tool !== 'task_completed') {
      emit('agent:thought', { thought: cleanText, elapsedSec: Math.round((Date.now() - AGENT_STATE.startTime) / 1000) });
    } else if (cleanText) {
      emit('agent:text-chunk', { text: cleanText, isComplete: true });
    }

    if (toolCall && toolCall.tool === 'task_completed') {
      const summary = (toolCall.parameters?.summary || cleanText || 'Aufgabe erfolgreich abgeschlossen!').trim();
      emit('agent:completed', { summary });
      AGENT_STATE.running = false;
      return;
    }

    if (!toolCall) {
      // Check if ChatGPT mentions a file it needs
      const mentionedFileMatch = cleanText.match(/(?:schick|lese|öffne|prüf|analysier|zeig|send|brauche).*?([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)/i);
      if (mentionedFileMatch && mentionedFileMatch[1] && !mentionedFileMatch[1].startsWith('http') && !mentionedFileMatch[1].endsWith('.com')) {
        const targetPath = mentionedFileMatch[1].replace(/^[./\\]+/, '').trim();
        await submitPrompt(`[KORTEX IDE SYSTEM] Du kannst die Datei direkt selbst lesen. Rufe folgenden Befehl auf:\n\`\`\`json\n{ "tool": "read_file", "parameters": { "path": ${JSON.stringify(targetPath)} } }\n\`\`\``);
      } else if (AGENT_STATE.step > 1 && cleanText.length > 30 && !/schick mir|bitte senden|kannst du mir/i.test(cleanText)) {
        emit('agent:completed', { summary: cleanText });
        AGENT_STATE.running = false;
        return;
      } else {
        await submitPrompt('[KORTEX IDE SYSTEM] Bitte führe den nächsten Schritt als JSON-Tool-Befehl aus oder beende mit task_completed.');
      }
      AGENT_STATE.step++;
      loopTimer = setTimeout(() => runLoopStable(0), 500);
      return;
    }

    // Interactive user question
    if (toolCall.tool === 'ask_question') {
      emit('agent:ask-question', {
        question: toolCall.parameters?.question || 'Entscheidung erforderlich',
        options: toolCall.parameters?.options || [],
        step: AGENT_STATE.step
      });
      const userAnswer = await waitForToolResult(600000);
      if (!AGENT_STATE.running || userAnswer === null) return;
      await submitPrompt(`[TOOL RESULT for ask_question]\nAntwort des Benutzers: ${JSON.stringify(userAnswer)}\nFahre direkt mit dem nächsten Schritt fort.`);
      AGENT_STATE.step++;
      loopTimer = setTimeout(() => runLoopStable(0), 500);
      return;
    }

    // Execute standard tool
    emit('agent:tool-call', {
      tool: toolCall.tool,
      parameters: toolCall.parameters || {},
      step: AGENT_STATE.step,
      elapsedSec: Math.round((Date.now() - AGENT_STATE.startTime) / 1000)
    });

    const result = await waitForToolResult(120000);
    if (!AGENT_STATE.running || result === null) return;

    await submitPrompt(`[TOOL RESULT for ${toolCall.tool}]\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\nErgebnis empfangen. Führe nun genau den nächsten EINZELNEN Schritt aus (1 Satz lautes Denken + genau 1 JSON-Tool-Block, oder schließe mit task_completed ab).`);
    AGENT_STATE.step++;
    loopTimer = setTimeout(() => runLoopStable(0), 500);
  }

  // ── Tool Result Handshake ─────────────────────────────
  window.__freeaiToolResult = function (result) {
    if (_toolResultResolve) {
      const resolve = _toolResultResolve;
      _toolResultResolve = null;
      if (_toolResultTimer) {
        clearTimeout(_toolResultTimer);
        _toolResultTimer = null;
      }
      resolve(result);
    }
  };

  function waitForToolResult(ms) {
    return new Promise(resolve => {
      if (_toolResultResolve) _toolResultResolve(null);
      _toolResultResolve = resolve;
      _toolResultTimer = setTimeout(() => {
        if (_toolResultResolve === resolve) {
          _toolResultResolve = null;
          _toolResultTimer = null;
          resolve({ __freeaiTimeout: true, success: false, error: 'Tool-Ergebnis Timeout.' });
        }
      }, ms);
    });
  }

  // ── Conversation Intent Detection ─────────────────────
  function isConversationalTask(text) {
    const value = String(text || '').trim().toLowerCase();
    if (!value) return false;
    // Common greetings and casual questions
    if (/^(hi|hallo|hey|hello|servus|moin|guten tag|guten morgen|guten abend|danke|vielen dank|wer bist du|wie gehts|wie geht es dir|was kannst du|hilfe)\b/.test(value)) {
      return true;
    }
    // Check if task involves explicit coding/workspace actions
    const codingIntent = /(erstelle|baue|entwickle|programmi|codi|implement|ändere|aendere|fixe|reparier|behebe|schreib|öffne|oeffne|datei|projekt|code|funktion|bug|fehler|terminal|befehl|install|deploy|analys|prüf|pruef|änderung|aenderung|refactor|delete|lösche|lese|read)/i;
    return !codingIntent.test(value) && value.split(/\s+/).length <= 25;
  }

  // ── Public API ────────────────────────────────────────
  window.__freeaiStartAgent = function ({ task, workspace, projectSnapshot }) {
    if (loopTimer) clearTimeout(loopTimer);
    const isConv = isConversationalTask(task);

    AGENT_STATE = {
      ...AGENT_STATE,
      running: true,
      workspace,
      task,
      step: 1,
      startTime: Date.now(),
      conversationOnly: isConv
    };
    lastStreamedText = '';
    emit('agent:started', { task, workspace });

    let prompt = '';

    if (isConv) {
      // Clean, direct prompt for conversation / questions
      prompt = `Der Nutzer schreibt folgende Nachricht in der Kortex IDE:
"${task}"

📌 REGEL FÜR DIESE ANFRAGE:
- Antworte direkt, freundlich und präzise auf die Frage des Nutzers.
- Da dies eine normale Frage/Begrüßung ist, führe KEINE Tool-Aufrufe, KEINE Dateisuchen und KEINE Datei-Analysen aus.`;
    } else {
      // Full Autonomous Coding Agent Prompt
      const normalizedPath = (workspace || '').replace(/\\/g, '/');
      const snapshotBlock = projectSnapshot
        ? `\n\n📂 PROJEKTSTRUKTUR:\n\`\`\`\n${projectSnapshot}\n\`\`\``
        : '\n\n📂 PROJEKTSTRUKTUR: Der Projektordner ist derzeit leer.';

      prompt = `Du bist KORTEX — der autonome Software-Agent in der Kortex IDE.
Du bearbeitest Entwicklungs- und Code-Aufgaben im lokalen Projekt des Nutzers vollständig selbstständig über JSON-Tool-Befehle.

📌 WICHTIGE ARBEITSREGELN:
1. RELEVANZ: Führe Datei-Operationen NUR DANN aus, wenn sie für die konkrete Benutzeraufgabe wirklich erforderlich sind!
2. AUTONOMIE: Frage den Nutzer niemals nach Dateien, die du per read_file selbst lesen kannst.
3. WÄHREND DER SCHRITTE ("Lautes Denken"):
   - Schreibe VOR dem JSON-Block genau 1 kurzen Satz ("Lautes Denken"), der beschreibt, was du jetzt tust (z.B. "Erstelle zunächst den Umsetzungsplan...", "Lese nun index.js...").
   - Schreibe während der Schritte KEINE langen Texte, keine vorzeitigen Auswertungen und keinen Code im Fließtext.
4. ⛔ EISERNE TOOL-REGEL:
   - Gib pro Antwort IMMER GENAU EINEN (1) EINZIGEN JSON-Tool-Block am Ende deiner Antwort aus!
   - Führe NIEMALS mehrere Tools in einer einzigen Antwort aus (z.B. niemals create_plan und step_done oder task_completed gleichzeitig in derselben Nachricht!).
   - Warte nach JEDEM Tool-Aufruf auf das Ergebnis [TOOL RESULT] der Kortex IDE!
5. ABSCHLUSS: Erst wenn alle Schritte vollständig ausgeführt sind, schließe ab mit:
\`\`\`json
{ "tool": "task_completed", "parameters": { "summary": "Ausführliche Erklärung und Zusammenfassung aller Änderungen..." } }
\`\`\`

6. VERFÜGBARE TOOLS (immer genau 1 Block pro Schritt):
- { "tool": "list_files", "parameters": { "maxDepth": 5 } }
- { "tool": "read_file", "parameters": { "path": "dateiname" } }
- { "tool": "create_plan", "parameters": { "title": "...", "steps": [...] } }
- { "tool": "step_done", "parameters": { "stepId": 1 } }
- { "tool": "write_file", "parameters": { "path": "...", "content": "..." } }
- { "tool": "edit_file", "parameters": { "path": "...", "targetContent": "...", "replacementContent": "..." } }
- { "tool": "delete_file", "parameters": { "path": "..." } }
- { "tool": "run_command", "parameters": { "command": "npm test" } }
- { "tool": "ask_question", "parameters": { "question": "...", "options": [...] } }
- { "tool": "task_completed", "parameters": { "summary": "..." } }

PROJEKTORDNER: ${normalizedPath}${snapshotBlock}

AUFGABE DES BENUTZERS:
${task}

➡️ Starte jetzt mit dem ersten Schritt (nur 1 Gedankensatz + genau 1 JSON-Block).`;
    }

    submitPrompt(prompt).then((sent) => {
      if (!sent) {
        AGENT_STATE.running = false;
        emit('agent:error', { message: 'Die Anfrage konnte nicht an ChatGPT übermittelt werden.' });
        return;
      }
      loopTimer = setTimeout(() => runLoopStable(0), 600);
    }).catch((error) => {
      AGENT_STATE.running = false;
      emit('agent:error', { message: `Senden fehlgeschlagen: ${error.message || error}` });
    });
  };

  window.__freeaiStopAgent = function () {
    AGENT_STATE.running = false;
    if (loopTimer) {
      clearTimeout(loopTimer);
      loopTimer = null;
    }
    if (_toolResultResolve) {
      const resolve = _toolResultResolve;
      _toolResultResolve = null;
      if (_toolResultTimer) {
        clearTimeout(_toolResultTimer);
        _toolResultTimer = null;
      }
      resolve(null);
    }
    const stopBtn = getStopBtn();
    if (stopBtn) stopBtn.click();
    emit('agent:stopped', {});
  };

  console.log('⚡ Kortex Agent Inject Script v6 initialisiert.');
})();
