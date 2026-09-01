/**
 * Kortex Agent Inject Script v8
 * - Robust ProseMirror & React DOM prompt injector with multi-layer verification
 * - 7s submission watchdog: auto-resends prompt if ChatGPT fails to start generating
 * - Exact single-tool parsing from start of response
 * - Reliable tool result handshake with immediate turn progression
 */
 (function () {
  'use strict';

  const bridge = window.__freeaiBridge;
  const toolParser = window.__kortexToolCallParser;
  const responseTracker = window.__kortexResponseTracker;
  if (!toolParser) throw new Error('Kortex tool-call parser was not injected.');
  if (!responseTracker) throw new Error('Kortex response tracker was not injected.');
  function emit(type, payload) {
    try { bridge && bridge.sendEvent({ type, payload, ts: Date.now() }); } catch {}
  }

  // ── Idempotent guard: preserve running agent across SPA navigations (chatgpt.com uses pushState) ──
  // Re-injecting while an agent run is active previously reset AGENT_STATE.running=false and
  // overwrote window.__freeaiToolResult, causing the pending tool-result handshake to hang forever ("Plugin antwortet nicht").
  if (window.__kortexAgentInjected && window.__kortexAgentState && window.__kortexAgentState.running) {
    console.log('⚡ Kortex Agent re-inject skipped — agent still running, preserving state');
    // Ensure bridge reference stays fresh even on hot re-inject
    try { window.__freeaiBridge = window.__freeaiBridge || bridge; } catch {}
    return;
  }
  // If already injected but idle, preserve timers/resolvers and just refresh functions below
  const _prevState = window.__kortexAgentState;
  const _prevLoopTimer = window.__kortexLoopTimer;
  const _prevResolve = window.__kortexToolResolve;
  const _prevTimer = window.__kortexToolTimer;
  const _pendingToolResults = Array.isArray(window.__kortexPendingToolResults)
    ? window.__kortexPendingToolResults
    : [];

  // ── State ─────────────────────────────────────────────
  let AGENT_STATE = _prevState || {
    running: false,
    workspace: '',
    task: '',
    step: 0,
    maxSteps: 250,
    pollMs: 350,
    responseTimeoutMs: 180000,
    stallTimeoutMs: 15000,
    submitTimeoutMs: 7000,
    retryLimit: 3,
    startTime: 0,
    lastPrompt: '',
    awaitingAssistant: null,
    conversationOnly: false
  };

  let loopTimer = _prevLoopTimer || null;
  let _toolResultResolve = _prevResolve || null;
  let _toolResultTimer = _prevTimer || null;

  // Expose state on window so future re-injects can preserve it
  window.__kortexAgentState = AGENT_STATE;
  window.__kortexLoopTimer = loopTimer;
  window.__kortexToolResolve = _toolResultResolve;
  window.__kortexToolTimer = _toolResultTimer;
  window.__kortexPendingToolResults = _pendingToolResults;
  window.__kortexAgentInjected = true;

  function _syncLoopTimer(t) { loopTimer = t; window.__kortexLoopTimer = t; }

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

  const getTurnText = responseTracker.getTurnText;

  function hasErrorOrInterruption(turn) {
    const errorPattern = /Verbindung unterbrochen|There was an error generating|There was an error|Network error|Fehler bei der Generierung|Generation stopped/i;
    if (errorPattern.test(getTurnText(turn))) return true;
    return Array.from(document.querySelectorAll('[role="alert"]'))
      .some(node => errorPattern.test(getTurnText(node)));
  }

  function isStreaming(turn = null) {
    if (getStopBtn()) return true;
    const scope = turn || getAssistantTurns().at(-1);
    if (!scope) return false;
    if (scope.matches?.('.result-streaming, [data-is-streaming="true"], [aria-busy="true"]') && isVisible(scope)) return true;
    return Array.from(scope.querySelectorAll?.('.result-streaming, [data-is-streaming="true"]') || []).some(isVisible);
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
      return toolParser.tryParse(body) ? '' : block;
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

  // ── Ultra-Reliable Prompt Submission ──────────────────
  function setElementText(input, text) {
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
      input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      return;
    }

    // Contenteditable ProseMirror in ChatGPT
    input.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = text;
    input.appendChild(p);

    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(p);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('insertText', false, text);
    } catch (e) {}

    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text
    }));
    input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  }

  async function triggerSendClick(input) {
    input.focus();

    // 1. Try send button
    for (let i = 0; i < 15; i++) {
      const btn = getSendBtn();
      if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
        btn.click();
        break;
      }
      await sleep(150);
    }

    // 2. Try Enter Key
    const keyOpts = { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 };
    input.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
    input.dispatchEvent(new KeyboardEvent('keyup', keyOpts));

    // 3. Try Form Submit
    const form = input.closest('form');
    if (form) {
      try { form.requestSubmit(); } catch (e) {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    }
  }

  async function submitPrompt(text, maxRetries = 3) {
    AGENT_STATE.lastPrompt = text;
    const initialAssistant = responseTracker.capture(getAssistantTurns());
    AGENT_STATE.awaitingAssistant = initialAssistant;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (!AGENT_STATE.running) return false;

      const input = getInput();
      if (!input) {
        await sleep(800);
        continue;
      }

      setElementText(input, text);
      await sleep(350);
      await triggerSendClick(input);

      // Verify that send actually started
      for (let check = 0; check < 15; check++) {
        await sleep(200);
        if (isStreaming() || responseTracker.findNewTurn(initialAssistant, getAssistantTurns())) {
          return true;
        }
      }

      console.warn(`[Kortex Agent] Prompt attempt ${attempt} not picked up, retrying...`);
      await sleep(400);
    }

    return isStreaming() || Boolean(responseTracker.findNewTurn(initialAssistant, getAssistantTurns()));
  }

  // ── Stable Response Watcher with Auto-Resend Watchdog ──
  async function waitForAssistantResponseStable() {
    const expectedAssistant = AGENT_STATE.awaitingAssistant || responseTracker.capture([]);
    const startedAt = Date.now();
    let lastText = '';
    let lastProgressAt = Date.now();
    let turnAppearedAt = 0;
    let observedTurn = null;
    let autoResent = false;

    while (AGENT_STATE.running) {
      const turns = getAssistantTurns();
      const newTurn = responseTracker.findNewTurn(expectedAssistant, turns);

      // If no new turn appeared after 7 seconds, auto-resubmit the prompt
      if (!newTurn && !isStreaming()) {
        if (!autoResent && Date.now() - startedAt > AGENT_STATE.submitTimeoutMs) {
          autoResent = true;
          console.log('[Kortex Agent] Keine Antwort gestartet — sende Prompt erneut...');
          await submitPrompt(AGENT_STATE.lastPrompt, 2);
        }
      }

      if (newTurn) {
        const turn = newTurn;
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
          if (clean) emit('agent:text-chunk', { text: clean, isComplete: !isStreaming(turn) });
        }

        if (hasErrorOrInterruption(turn)) return { turn, error: true };
        if (isStreaming(turn)) {
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

  function scheduleRunLoop(retryAttempt = 0, delayMs = 500) {
    _syncLoopTimer(setTimeout(() => {
      runLoopStable(retryAttempt).catch(error => {
        console.error('[Kortex Agent] Agent loop failed:', error);
        AGENT_STATE.running = false;
        if (window.__kortexAgentState) window.__kortexAgentState.running = false;
        emit('agent:error', { message: `Agent-Schleife abgebrochen: ${error.message || error}` });
      });
    }, delayMs));
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
        scheduleRunLoop(retryAttempt + 1, 600);
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

    const toolCall = toolParser.parseToolCall(turn);

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
      scheduleRunLoop();
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
      scheduleRunLoop();
      return;
    }

    // ── Enforce Schritt 1 = list_files für Analyse-Aufgaben ──
    if (AGENT_STATE.step === 1 && toolCall.tool !== 'list_files' && /analys/i.test(AGENT_STATE.task || '')) {
      emit('agent:status', { message: `Korrektur: Schritt 1 muss list_files sein — leite um (statt ${toolCall.tool}).`, level: 'warning' });
      await submitPrompt(`[KORTEX IDE SYSTEM-KORREKTUR] FEHLER: Dein Schritt 1 war { "tool": "${toolCall.tool}" } — aber bei "Analysiere das Projekt" ist Schritt 1 ZWINGEND list_files!\nFühre JETZT korrekt aus (1 Satz + 1 JSON):\n\`\`\`json\n{ "tool": "list_files", "parameters": { "maxDepth": 5 } }\n\`\`\``);
      AGENT_STATE.step++;
      scheduleRunLoop();
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
    scheduleRunLoop();
  }

  // ── Tool Result Handshake (window-persisted so re-inject does not lose pending resolver) ──
  window.__freeaiToolResult = function (result) {
    const resolver = _toolResultResolve || window.__kortexToolResolve;
    if (resolver) {
      const resolve = resolver;
      _toolResultResolve = null;
      window.__kortexToolResolve = null;
      if (_toolResultTimer) { clearTimeout(_toolResultTimer); _toolResultTimer = null; }
      if (window.__kortexToolTimer) { clearTimeout(window.__kortexToolTimer); window.__kortexToolTimer = null; }
      resolve(result);
      return true;
    }
    if (AGENT_STATE.running) {
      _pendingToolResults.splice(0, _pendingToolResults.length, result);
      return true;
    }
    return false;
  };

  function waitForToolResult(ms) {
    return new Promise(resolve => {
      if (_pendingToolResults.length) {
        resolve(_pendingToolResults.shift());
        return;
      }
      if (_toolResultResolve) _toolResultResolve(null);
      _toolResultResolve = resolve;
      window.__kortexToolResolve = resolve;
      if (_toolResultTimer) clearTimeout(_toolResultTimer);
      _toolResultTimer = setTimeout(() => {
        if ((_toolResultResolve === resolve) || (window.__kortexToolResolve === resolve)) {
          _toolResultResolve = null;
          window.__kortexToolResolve = null;
          _toolResultTimer = null;
          window.__kortexToolTimer = null;
          resolve({ __freeaiTimeout: true, success: false, error: 'Tool-Ergebnis Timeout.' });
        }
      }, ms);
      window.__kortexToolTimer = _toolResultTimer;
    });
  }

  // ── Conversation Intent Detection ─────────────────────
  function isConversationalTask(text) {
    const value = String(text || '').trim().toLowerCase();
    if (!value) return false;
    if (/^(hi|hallo|hey|hello|servus|moin|guten tag|guten morgen|guten abend|danke|vielen dank|wer bist du|wie gehts|wie geht es dir|was kannst du|hilfe)\b/.test(value)) {
      return true;
    }
    const codingIntent = /(erstelle|baue|entwickle|programmi|codi|implement|ändere|aendere|fixe|reparier|behebe|schreib|öffne|oeffne|datei|projekt|code|funktion|bug|fehler|terminal|befehl|install|deploy|analys|prüf|pruef|änderung|aenderung|refactor|delete|lösche|lese|read)/i;
    return !codingIntent.test(value) && value.split(/\s+/).length <= 25;
  }

  // ── Public API ────────────────────────────────────────
  window.__freeaiStartAgent = function ({ task, workspace, projectSnapshot }) {
    if (loopTimer) clearTimeout(loopTimer);
    if (window.__kortexLoopTimer) { try { clearTimeout(window.__kortexLoopTimer); } catch {} }
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
    window.__kortexAgentState = AGENT_STATE;
    window.__kortexLoopTimer = loopTimer;
    emit('agent:started', { task, workspace });

    let prompt = '';

    if (isConv) {
      prompt = `Der Nutzer schreibt folgende Nachricht in der Kortex IDE:
"${task}"

📌 REGEL FÜR DIESE ANFRAGE:
- Antworte direkt, freundlich und präzise auf die Frage des Nutzers.
- Da dies eine normale Frage/Begrüßung ist, führe KEINE Tool-Aufrufe, KEINE Dateisuchen und KEINE Datei-Analysen aus.`;
    } else {
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

📌 ZWINGENDER ARBEITSABLAUF — IMMER EINHALTEN:
- SCHRITT 1 IST IMMER list_files (maxDepth 5): Bevor du IRGENDEINE Datei liest/schreibst, verifiziere LIVE die vollständige Dateiliste. Das Snapshot unten ist nur Momentaufnahme — der list_files-Call ist Pflicht!
- ERST AB SCHRITT 2: Gezielt read_file für relevante Dateien (z.B. nach list_files).
- VERBOT: Niemals Schritt 1 mit read_file/write_file/edit_file beginnen. Bei "Analysiere das Projekt" / "Analyisere" / "Projekt analysieren" ist Schritt 1 ZWINGEND list_files, danach create_plan + read_file der Hauptdateien.
- Beispiel korrekter Start für "Analysiere das Projekt":
  Lautes Denken: "Starte mit vollständiger Projekt-Exploration..."
  \`\`\`json
  { "tool": "list_files", "parameters": { "maxDepth": 5 } }
  \`\`\`

PROJEKTORDNER: ${normalizedPath}${snapshotBlock}

AUFGABE DES BENUTZERS:
${task}

➡️ Starte jetzt mit dem ersten Schritt (nur 1 Gedankensatz + genau 1 JSON-Block). Denke daran: Schritt 1 = list_files!`;
    }

    submitPrompt(prompt).then((sent) => {
      if (!sent) {
        AGENT_STATE.running = false;
        window.__kortexAgentState.running = false;
        emit('agent:error', { message: 'Die Anfrage konnte nicht an ChatGPT übermittelt werden.' });
        return;
      }
      scheduleRunLoop(0, 600);
    }).catch((error) => {
      AGENT_STATE.running = false;
      window.__kortexAgentState.running = false;
      emit('agent:error', { message: `Senden fehlgeschlagen: ${error.message || error}` });
    });
  };

  window.__freeaiStopAgent = function () {
    AGENT_STATE.running = false;
    if (window.__kortexAgentState) window.__kortexAgentState.running = false;
    if (loopTimer) {
      clearTimeout(loopTimer);
      loopTimer = null;
    }
    if (window.__kortexLoopTimer) { try { clearTimeout(window.__kortexLoopTimer); } catch {} window.__kortexLoopTimer = null; }
    const resolver = _toolResultResolve || window.__kortexToolResolve;
    if (resolver) {
      _toolResultResolve = null;
      window.__kortexToolResolve = null;
      if (_toolResultTimer) { clearTimeout(_toolResultTimer); _toolResultTimer = null; }
      if (window.__kortexToolTimer) { clearTimeout(window.__kortexToolTimer); window.__kortexToolTimer = null; }
      resolver(null);
    }
    const stopBtn = getStopBtn();
    if (stopBtn) stopBtn.click();
    emit('agent:stopped', {});
  };

  console.log('⚡ Kortex Agent Inject Script v8 initialisiert.');
})();
