(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.__kortexResponseTracker = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function getTurnText(turn) {
    return turn ? String(turn.innerText || turn.textContent || '') : '';
  }

  function getTurnKey(turn) {
    if (!turn) return '';
    const ownKey = turn.getAttribute?.('data-message-id') || turn.getAttribute?.('data-testid');
    if (ownKey) return ownKey;
    const container = turn.closest?.('[data-message-id], [data-testid^="conversation-turn-"]');
    return container?.getAttribute?.('data-message-id') || container?.getAttribute?.('data-testid') || '';
  }

  function capture(turns) {
    const list = Array.from(turns || []);
    const element = list[list.length - 1] || null;
    return {
      count: list.length,
      element,
      key: getTurnKey(element),
      text: getTurnText(element)
    };
  }

  function findNewTurn(previous, turns) {
    const current = capture(turns);
    if (!current.element) return null;
    if (!previous?.element) return current.element;
    if (current.count > previous.count) return current.element;
    if (current.key && previous.key && current.key !== previous.key) return current.element;
    if (current.element !== previous.element && current.text !== previous.text) return current.element;
    if (current.element === previous.element && current.text !== previous.text) return current.element;
    return null;
  }

  return { capture, findNewTurn, getTurnKey, getTurnText };
});
