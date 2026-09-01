const test = require('node:test');
const assert = require('node:assert/strict');
const { capture, findNewTurn } = require('../agent/response-tracker');

function turn(id, text) {
  return {
    innerText: text,
    getAttribute(name) {
      return name === 'data-message-id' ? id : null;
    }
  };
}

test('detects a normally appended assistant turn', () => {
  const first = turn('a', 'first response');
  const second = turn('b', 'second response');
  assert.equal(findNewTurn(capture([first]), [first, second]), second);
});

test('detects a new turn when ChatGPT virtualizes the list at the same length', () => {
  const oldTurn = turn('a', 'create_plan');
  const newTurn = turn('b', 'read_file');
  assert.equal(findNewTurn(capture([oldTurn]), [newTurn]), newTurn);
});

test('detects content changes when ChatGPT reuses the same DOM element', () => {
  const recycled = turn('', 'create_plan');
  const previous = capture([recycled]);
  recycled.innerText = 'read_file';
  assert.equal(findNewTurn(previous, [recycled]), recycled);
});

test('does not treat an unchanged assistant turn as a new response', () => {
  const unchanged = turn('a', 'create_plan');
  assert.equal(findNewTurn(capture([unchanged]), [unchanged]), null);
});
