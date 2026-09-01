const test = require('node:test');
const assert = require('node:assert/strict');
const { normalize, tryParse } = require('../agent/tool-call-parser');

test('parses the documented Kortex tool shape', () => {
  assert.deepEqual(
    tryParse('```json\n{"tool":"read_file","parameters":{"path":"src/app.js"}}\n```'),
    { tool: 'read_file', parameters: { path: 'src/app.js' } }
  );
});

test('parses ChatGPT function-call envelopes and JSON argument strings', () => {
  assert.deepEqual(
    normalize({ type: 'function', function: { name: 'functions.edit_file', arguments: '{"path":"a.js","targetContent":"a","replacementContent":"b"}' } }),
    { tool: 'edit_file', parameters: { path: 'a.js', targetContent: 'a', replacementContent: 'b' } }
  );
});

test('finds the first valid tool after malformed prose JSON', () => {
  assert.deepEqual(
    tryParse('Example {"tool":"not_a_real_tool"}. Actual call: {"name":"list_files","arguments":{"maxDepth":5}}'),
    { tool: 'list_files', parameters: { maxDepth: 5 } }
  );
});

test('supports lifted parameters without weakening the tool allowlist', () => {
  assert.deepEqual(tryParse('{"action":"run_command","command":"npm test"}'), {
    tool: 'run_command',
    parameters: { command: 'npm test' }
  });
  assert.equal(tryParse('{"name":"open_browser","arguments":{"url":"https://example.com"}}'), null);
});

test('rejects invalid argument payloads', () => {
  assert.equal(normalize({ name: 'read_file', arguments: 'not json' }), null);
});
