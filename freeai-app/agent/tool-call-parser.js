(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.__kortexToolCallParser = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const ALLOWED_TOOLS = new Set([
    'list_files',
    'read_file',
    'write_file',
    'edit_file',
    'delete_file',
    'run_command',
    'create_plan',
    'step_done',
    'ask_question',
    'task_completed'
  ]);

  function parseArguments(value) {
    if (value == null) return {};
    if (typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value !== 'string') return null;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  function normalizeToolName(value) {
    if (typeof value !== 'string') return '';
    const name = value.trim().replace(/^(?:functions|tools)\./i, '').toLowerCase();
    return ALLOWED_TOOLS.has(name) ? name : '';
  }

  function normalize(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;

    const envelope = obj.tool_call || obj.function_call;
    if (envelope && typeof envelope === 'object') obj = envelope;

    const functionPayload = obj.function && typeof obj.function === 'object' ? obj.function : null;
    const rawName = functionPayload?.name || obj.tool || obj.action || obj.name;
    const tool = normalizeToolName(rawName);
    if (!tool) return null;

    const explicitArgs = functionPayload?.arguments ?? obj.parameters ?? obj.arguments ?? obj.args ?? obj.params;
    let parameters = parseArguments(explicitArgs);
    if (parameters === null) return null;

    if (explicitArgs == null) {
      const reserved = new Set(['type', 'tool', 'action', 'name', 'function', 'tool_call', 'function_call']);
      parameters = Object.fromEntries(Object.entries(obj).filter(([key]) => !reserved.has(key)));
    }

    return { tool, parameters };
  }

  function balancedJsonObjects(text) {
    const objects = [];
    for (let start = 0; start < text.length; start++) {
      if (text[start] !== '{') continue;
      let depth = 0;
      let inString = false;
      let escaped = false;

      for (let index = start; index < text.length; index++) {
        const char = text[index];
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === '\\' && inString) {
          escaped = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (inString) continue;
        if (char === '{') depth++;
        if (char === '}' && --depth === 0) {
          objects.push(text.slice(start, index + 1));
          start = index;
          break;
        }
      }
    }
    return objects;
  }

  function tryParse(text) {
    if (typeof text !== 'string' || !text.trim()) return null;
    const cleaned = text
      .replace(/^\s*(?:copy\s+code|tool_call|json)\s*/i, '')
      .replace(/```(?:json|tool_call)?/gi, '')
      .replace(/```/g, '')
      .trim();

    for (const candidate of balancedJsonObjects(cleaned)) {
      try {
        const result = normalize(JSON.parse(candidate));
        if (result) return result;
      } catch {
        // Keep scanning. Prose may contain a malformed example before the real call.
      }
    }
    return null;
  }

  function parseToolCall(turnEl) {
    if (!turnEl) return null;
    const codeElements = turnEl.querySelectorAll?.(
      'pre code, pre, code, [data-testid*="code-block"], div[class*="font-mono"]'
    ) || [];
    for (const element of codeElements) {
      const result = tryParse(element.innerText || element.textContent || '');
      if (result) return result;
    }
    return tryParse(turnEl.innerText || turnEl.textContent || '');
  }

  return { ALLOWED_TOOLS, normalize, parseToolCall, tryParse };
});
