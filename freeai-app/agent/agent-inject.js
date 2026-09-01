/**
 * Kortex Agent Inject Script v5
 * - React-compatible submitPrompt (native value setter)
 * - Robust tool parser: accepts "name" key + flat params
 * - create_plan / step_done tools for task checklists
 * - Strict system prompt: no unsolicited changes, mandatory planning
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
    stallTimeoutMs: 45000,
    retryLimit: 2,
    startTime: 0,
    lastPrompt: '',
    awaitingAssistantCount: 0,
    conversationOnly: false
  };
  let loopTimer = null;
  let lastStreamedText = '';

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
    // Generic ChatGPT surfaces contain normal actions such as "Regenerate".
    // Only concrete error text is allowed to trigger an automatic retry.
    const errorPattern = /Verbindung unterbrochen|There was an error generating|There was an error|Network error|Fehler bei der Generierung|Generation stopped/i;
    if (errorPattern.test(getTurnText(turn))) return true;
    return Array.from(document.querySelectorAll('[role="alert"]'))
      .some(node => errorPattern.test(getTurnText(node)));
  }

  function isStreaming() {
    return Boolean(getStopBtn() || Array.from(document.querySelectorAll('.result-streaming, [data-is-streaming="true"], [aria-busy="true"]')).some(isVisible));
  }

  function getLastAssistantTurn() {
    const turns = document.querySelectorAll('[data-message-author-role="assistant"]');
    return turns.length ? turns[turns.length - 1] : null;
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
    text = text.replace(/```[a-zA-Z0-9_\-]*\s*$/, '');
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

    // Strategy 1: code blocks
    const blockMatch = text.match(/```(?:tool_call|json)?\s*([\s\S]*?)\s*```/i);
    if (blockMatch) {
      const r = tryParse(blockMatch[1]);
      if (r) return r;
    }

    // Strategy 2: DOM code elements
    const codeEls = turnEl.querySelectorAll('pre, code, div[class*="font-mono"]');
    for (const el of codeEls) {
      const txt = el.innerText || el.textContent || '';
      const result = tryParse(txt);
      if (result) return result;
    }

    return tryParse(text);
  }

  function tryParse(str) {
    if (!str) return null;
    let cleaned = str.replace(/^(?:tool_call|json)\s*/i, '').replace(/^copy\s*code\s*/i, '').trim();

    // 1. If wrapped in Markdown code block ```json ... ``` or ```tool_call ... ```
    const codeBlocks = Array.from(str.matchAll(/```(?:json|tool_call)?\s*([\s\S]*?)\s*```/gi));
    for (let i = codeBlocks.length - 1; i >= 0; i--) {
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

    // 2. Scan string for valid JSON objects from end to start
    const toolKeywords = Array.from(cleaned.matchAll(/"(?:tool|action|name)"\s*:\s*"([^"]+)"/gi));
    for (let i = toolKeywords.length - 1; i >= 0; i--) {
      const match = toolKeywords[i];
      const matchIdx = match.index;
      const s = cleaned.lastIndexOf('{', matchIdx);
      if (s === -1) continue;
      
      // Find matching closing brace
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

  // ── Agent Loop ────────────────────────────────────────
  async function runLoop() {
    if (!AGENT_STATE.running) return;
    if (AGENT_STATE.step > AGENT_STATE.maxSteps) {
      emit('agent:error', { message: 'Max steps reached' });
      AGENT_STATE.running = false;
      return;
    }

    emit('agent:step', { step: AGENT_STATE.step, elapsedSec: Math.round((Date.now() - AGENT_STATE.startTime) / 1000) });

    await sleep(600);
    let lastProgressTime = Date.now();
    let lastSeenText = '';
    let retriedThisTurn = false;

    while (isStreaming()) {
      if (!AGENT_STATE.running) return;
      const turn = getLastAssistantTurn();
      const rawText = turn ? (turn.innerText || turn.textContent || '') : '';

      if (rawText !== lastSeenText) {
        lastSeenText = rawText;
        lastProgressTime = Date.now();
      }

      // Check for connection interruption or 10s stall
      const hasError = hasErrorOrInterruption();
      const stalledFor10s = (Date.now() - lastProgressTime) > 10000;

      if ((hasError || stalledFor10s) && AGENT_STATE.lastPrompt && !retriedThisTurn) {
        retriedThisTurn = true;
        console.warn('⚡ Kortex Watchdog: Disconnect or 10s stall detected. Aborting and resending...');
        emit('agent:text-chunk', { text: `*(⚠️ Verbindung unterbrochen / Timeout — sende Anfrage nach 10s Pause automatisch erneut...)*`, isComplete: false });
        const stopBtn = getStopBtn();
        if (stopBtn) stopBtn.click();
        await sleep(1500);
        await submitPrompt(AGENT_STATE.lastPrompt);
        lastProgressTime = Date.now();
        lastSeenText = '';
        await sleep(1000);
        continue;
      }

      if (turn) {
        const clean = extractCleanText(rawText);
        const thought = extractThought(rawText);

        if (thought) emit('agent:thought', { thought, elapsedSec: Math.round((Date.now() - AGENT_STATE.startTime) / 1000) });
        if (clean && clean !== lastStreamedText) {
          emit('agent:text-chunk', { text: clean, isComplete: false });
          lastStreamedText = clean;
        }
      }
      await sleep(AGENT_STATE.pollMs);
    }
    await sleep(800);

    // Post-stream check for error banner
    if (hasErrorOrInterruption() && AGENT_STATE.lastPrompt && !retriedThisTurn) {
      console.warn('⚡ Kortex Watchdog: Post-stream error detected. Aborting and resending...');
      const stopBtn = getStopBtn();
      if (stopBtn) stopBtn.click();
      await sleep(1500);
      await submitPrompt(AGENT_STATE.lastPrompt);
      loopTimer = setTimeout(runLoop, 1500);
      return;
    }

    const turn = getLastAssistantTurn();
    const fullRaw = turn ? (turn.innerText || turn.textContent || '') : '';
    const cleanText = extractCleanText(fullRaw);
    const thought = extractThought(fullRaw);

    if (thought) emit('agent:thought', { thought, elapsedSec: Math.round((Date.now() - AGENT_STATE.startTime) / 1000) });
    if (cleanText) emit('agent:text-chunk', { text: cleanText, isComplete: true });

    const toolCall = parseToolCall(turn);

    if (toolCall && toolCall.tool === 'task_completed') {
      const summary = (cleanText.length > 50) ? cleanText : (toolCall.parameters?.summary || cleanText || 'Aufgabe erfolgreich abgeschlossen!');
      emit('agent:completed', { summary });
      AGENT_STATE.running = false;
      return;
    }

    if (!toolCall) {
      // Check if ChatGPT is asking for files or mentioning a file it wants to inspect
      const mentionedFileMatch = cleanText.match(/(?:schick|lese|öffne|prüf|analysier|zeig|send|brauche).*?([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)/i);
      if (mentionedFileMatch && mentionedFileMatch[1] && !mentionedFileMatch[1].startsWith('http') && !mentionedFileMatch[1].endsWith('.com')) {
        const targetPath = mentionedFileMatch[1].replace(/^[./\\]+/, '').trim();
        const autoReminder = `[KORTEX IDE SYSTEM] Du hast vollen Lesezugriff auf das Projekt und musst mich nicht danach fragen. Bitte lies "${targetPath}" direkt selbst über:\n\`\`\`json\n{ "tool": "read_file", "parameters": { "path": "${targetPath}" } }\n\`\`\``;
        await submitPrompt(autoReminder);
        AGENT_STATE.step++;
        loopTimer = setTimeout(runLoop, 2000);
        return;
      }

      // If it looks like a final answer (contains analysis / response and didn't ask for more files)
      if (AGENT_STATE.step > 1 && cleanText.length > 50 && !/schick mir|bitte senden|kannst du mir/i.test(cleanText)) {
        emit('agent:completed', { summary: cleanText });
        AGENT_STATE.running = false;
        return;
      }

      const reminder = `[KORTEX IDE SYSTEM] Bitte fahre autonom fort und antworte mit einem JSON-Aktionsblock.\nFormat: { "tool": "read_file" | "create_plan" | "write_file" | "edit_file" | "run_command" | "task_completed", "parameters": { ... } }`;
      await submitPrompt(reminder);
      AGENT_STATE.step++;
      loopTimer = setTimeout(runLoop, 2000);
      return;
    }

    if (toolCall.tool === 'ask_question') {
      emit('agent:ask-question', {
        question: toolCall.parameters.question || 'Entscheidung erforderlich',
        options: toolCall.parameters.options || [],
        step: AGENT_STATE.step
      });

      const userAnswer = await waitForToolResult(600000);
      if (!AGENT_STATE.running) return;

      if (userAnswer) {
        const resultPrompt = `[TOOL RESULT for ask_question]\nAntwort des Benutzers: "${userAnswer}"\nFahre nun direkt mit dem nächsten Schritt als JSON-Befehl fort.`;
        await submitPrompt(resultPrompt);
        AGENT_STATE.step++;
      }

      if (AGENT_STATE.running) loopTimer = setTimeout(runLoop, AGENT_STATE.pollMs);
      return;
    }

    // All other tools (including create_plan, step_done)
    emit('agent:tool-call', {
      tool: toolCall.tool,
      parameters: toolCall.parameters,
      step: AGENT_STATE.step,
      elapsedSec: Math.round((Date.now() - AGENT_STATE.startTime) / 1000)
    });

    const result = await waitForToolResult(60000);
    if (!AGENT_STATE.running) return;

    if (result) {
      const resultPrompt = `[TOOL RESULT for ${toolCall.tool}]\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\nErgebnis empfangen.\nFühre jetzt direkt den NÄCHSTEN Schritt aus.\nErinnerung: Während der Tool-Schritte KEINE langen Texte an den Nutzer schreiben — nur 1 kurzer Gedankensatz + JSON-Befehl! Erst bei task_completed die finale Antwort liefern.`;
      await submitPrompt(resultPrompt);
      AGENT_STATE.step++;
    }

    if (AGENT_STATE.running) loopTimer = setTimeout(runLoop, AGENT_STATE.pollMs);
  }

  // ── Tool Result Handshake ─────────────────────────────
  // Stable response state machine. It waits for a new assistant turn before
  // parsing anything, so a completed previous turn can never be executed twice.
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
          if (Date.now() - lastProgressAt > AGENT_STATE.stallTimeoutMs) return { turn, timeout: true };
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
      message: `${reason} — der aktuelle Schritt wird automatisch erneut gesendet (${attempt + 1}/${AGENT_STATE.retryLimit}).`,
      level: 'warning'
    });
    const stopBtn = getStopBtn();
    if (stopBtn) stopBtn.click();
    await sleep(900);
    return submitPrompt(AGENT_STATE.lastPrompt);
  }

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
      const reason = response.error ? 'ChatGPT meldet eine unterbrochene Antwort' : 'ChatGPT antwortet zu lange nicht';
      if (await retryCurrentPrompt(reason, retryAttempt)) {
        loopTimer = setTimeout(() => runLoopStable(retryAttempt + 1), 500);
      } else {
        emit('agent:error', { message: `${reason}. Der Agent wurde angehalten, damit kein Schritt doppelt ausgeführt wird.` });
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
      if (AGENT_STATE.conversationOnly && cleanText) {
        emit('agent:completed', { summary: cleanText });
        AGENT_STATE.running = false;
        return;
      }

      const mentionedFileMatch = cleanText.match(/(?:schick|lese|öffne|prüf|analysier|zeig|send|brauche).*?([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)/i);
      if (mentionedFileMatch && mentionedFileMatch[1] && !mentionedFileMatch[1].startsWith('http') && !mentionedFileMatch[1].endsWith('.com')) {
        const targetPath = mentionedFileMatch[1].replace(/^[./\\]+/, '').trim();
        await submitPrompt(`[KORTEX IDE SYSTEM] Lies die Datei direkt über einen JSON-Tool-Call. Frage den Nutzer nicht nach Dateien.\n{ "tool": "read_file", "parameters": { "path": ${JSON.stringify(targetPath)} } }`);
      } else if (!(AGENT_STATE.step > 1 && cleanText.length > 50 && !/schick mir|bitte senden|kannst du mir/i.test(cleanText))) {
        await submitPrompt('[KORTEX IDE SYSTEM] Fahre autonom fort und antworte mit genau einem JSON-Aktionsblock. Nutze read_file, write_file, edit_file, run_command oder task_completed.');
      } else {
        emit('agent:completed', { summary: cleanText });
        AGENT_STATE.running = false;
        return;
      }
      AGENT_STATE.step++;
      loopTimer = setTimeout(() => runLoopStable(0), 500);
      return;
    }

    if (toolCall.tool === 'ask_question') {
      emit('agent:ask-question', {
        question: toolCall.parameters.question || 'Entscheidung erforderlich',
        options: toolCall.parameters.options || [],
        step: AGENT_STATE.step
      });
      const userAnswer = await waitForToolResult(600000);
      if (!AGENT_STATE.running || userAnswer === null) return;
      await submitPrompt(`[TOOL RESULT for ask_question]\nAntwort des Benutzers: ${JSON.stringify(userAnswer)}\nFahre direkt mit dem nächsten JSON-Schritt fort.`);
      AGENT_STATE.step++;
      loopTimer = setTimeout(() => runLoopStable(0), 500);
      return;
    }

    emit('agent:tool-call', {
      tool: toolCall.tool,
      parameters: toolCall.parameters,
      step: AGENT_STATE.step,
      elapsedSec: Math.round((Date.now() - AGENT_STATE.startTime) / 1000)
    });
    const result = await waitForToolResult(120000);
    if (!AGENT_STATE.running || result === null) return;
    await submitPrompt(`[TOOL RESULT for ${toolCall.tool}]\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\nErgebnis empfangen. Führe direkt den nächsten Schritt aus. Während der Tool-Schritte keine langen Texte schreiben; nutze genau einen JSON-Aktionsblock.`);
    AGENT_STATE.step++;
    loopTimer = setTimeout(() => runLoopStable(0), 500);
  }

  let _toolResultTimer = null;

  window.__freeaiToolResult = function (result) {
    if (_toolResultResolve) {
      const resolve = _toolResultResolve;
      _toolResultResolve = null;
      clearTimeout(_toolResultTimer);
      _toolResultTimer = null;
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
          resolve({ __freeaiTimeout: true, success: false, error: 'Tool-Ergebnis wurde nicht rechtzeitig empfangen.' });
        }
      }, ms);
    });
  }

  function isConversationalTask(text) {
    const value = String(text || '').trim().toLowerCase();
    if (!value) return false;
    if (/^(hi|hey|hello|hallo|moin|servus|guten morgen|guten tag|guten abend|danke|wer bist du|wie geht es dir)\b/.test(value)) return true;
    const codingIntent = /(erstelle|baue|entwickle|programmi|codi|implement|ändere|aendere|fixe|reparier|behebe|schreib|erstellt|öffne|oeffne|datei|projekt|code|funktion|bug|fehler|terminal|befehl|install|deploy|analys|prüf|pruef|änderung|aenderung|refactor)/i;
    return !codingIntent.test(value) && value.split(/\s+/).length <= 32;
  }

  // ── Public API ────────────────────────────────────────
  window.__freeaiStartAgent = function ({ task, workspace, projectSnapshot }) {
    if (loopTimer) clearTimeout(loopTimer);
    AGENT_STATE = {
      ...AGENT_STATE,
      running: true,
      workspace,
      task,
      step: 1,
      startTime: Date.now(),
      conversationOnly: isConversationalTask(task)
    };
    lastStreamedText = '';
    emit('agent:started', { task, workspace });

    const normalizedPath = (workspace || '').replace(/\\/g, '/');
    const snapshotBlock = projectSnapshot
      ? `\n\n📂 PROJEKTSTRUKTUR:\n\`\`\`\n${projectSnapshot}\n\`\`\``
      : '\n\n📂 PROJEKTSTRUKTUR: Der Projektordner ist derzeit leer.';

    const prompt = `Du bist KORTEX — ein hochintelligenter, autonomer Software-Agent in der Kortex IDE.
Du führst Entwicklungs- und Analyseaufgaben im Projekt des Nutzers vollständig selbstständig durch.
Du hast vollen Zugriff auf das Projekt über einfache JSON-Befehlsblöcke.

📌 WICHTIGE ARBEITSWEISE & KOMMUNIKATIONSREGEL:
1. AUTONOMIE: Frage den Nutzer NIEMALS nach Dateien! Du kannst jede Datei im Projekt selbst lesen. Rufe einfach:
\`\`\`json
{ "tool": "read_file", "parameters": { "path": "pfad/zur/datei.js" } }
\`\`\`

2. KOMMUNIKATION:
- Bei einer Begrüßung oder normalen Wissensfrage antworte ganz normal und freundlich. Führe dafür keine Tool-Schleife aus.
- WÄHREND DER SCHRITTE (Tools ausführen): Schreibe KEINE langen Texte an den Nutzer! Schreibe VOR dem JSON-Block nur 1 kurzen Gedanken-/Analysesatz (z.B. "Prüfe nun bridge-server.js...").
- ERST WENN DU FERTIG BIST (task_completed): Schreibe deine ausführliche, vollständige Erklärung/Antwort für den Nutzer und schließe am Ende ab mit:
\`\`\`json
{ "tool": "task_completed", "parameters": { "summary": "Deine ausführliche Antwort..." } }
\`\`\`

3. WORKFLOW BEI CODE-ÄNDERUNGEN:
- Erst Kontext sammeln (per list_files / read_file)
- Dann Plan erstellen per create_plan:
\`\`\`json
{ "tool": "create_plan", "parameters": { "title": "...", "steps": [{"id":1,"title":"Schritt 1"},{"id":2,"title":"Schritt 2"}] } }
\`\`\`
- Dann die Schritte mit write_file / edit_file umsetzen und nach jedem Schritt step_done aufrufen.
- Am Ende mit task_completed abschließen.

4. VERFÜGBARE BEFEHLE (immer exakt EIN JSON-Block am Ende deiner Antwort):
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

➡️ Starte jetzt direkt autonom mit der Analyse bzw. dem ersten Schritt.`;

    submitPrompt(prompt).then((sent) => {
      if (!sent) {
        AGENT_STATE.running = false;
        emit('agent:error', { message: 'Die Aufgabe konnte nicht an ChatGPT gesendet werden.' });
        return;
      }
      loopTimer = setTimeout(() => runLoopStable(0), 500);
    }).catch((error) => {
      AGENT_STATE.running = false;
      emit('agent:error', { message: `Senden fehlgeschlagen: ${error.message || error}` });
    });
  };

  window.__freeaiStopAgent = function () {
    AGENT_STATE.running = false;
    if (loopTimer) clearTimeout(loopTimer);
    if (_toolResultResolve) {
      const resolve = _toolResultResolve;
      _toolResultResolve = null;
      clearTimeout(_toolResultTimer);
      _toolResultTimer = null;
      resolve(null);
    }
    emit('agent:stopped', {});
  };

  window.__freeaiInjectPrompt = function (text) {
    submitPrompt(text);
  };

  emit('agent:ready', { url: location.href });
  console.log('⚡ Kortex Agent v5 ready');
})();
