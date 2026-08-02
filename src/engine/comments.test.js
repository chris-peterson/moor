import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commentToOutput, cycleAction, cycleActionDown, isBlocking } from './comments.js';

// commentToOutput (IM.OUT-02a): the sidecar projection for each comment target.
test('commentToOutput: changeset comment omits file / lines / target', () => {
  const out = commentToOutput({ id: 1, body: '  ship it  ', action: 'suggestion', target: { type: 'changeset' } });
  assert.deepEqual(out, { body: 'ship it', action: 'suggestion' });
});

test('commentToOutput: file comment includes file, no line fields', () => {
  const out = commentToOutput({ id: 2, body: 'rename this', action: 'nit', target: { type: 'file', file: 'src/a.js' } });
  assert.deepEqual(out, { body: 'rename this', action: 'nit', file: 'src/a.js' });
});

test('commentToOutput: range comment includes file + startLine/endLine', () => {
  const out = commentToOutput({
    id: 3, body: 'off by one', action: 'must-fix',
    target: { type: 'range', file: 'src/a.js', startLine: 10, endLine: 12, startRow: 4, endRow: 6 },
  });
  assert.deepEqual(out, { body: 'off by one', action: 'must-fix', file: 'src/a.js', startLine: 10, endLine: 12 });
});

test('commentToOutput: commit-message comment carries target and no file', () => {
  const out = commentToOutput({
    id: 4, body: 'Subject is vague — name the bug and mention T-123',
    action: 'must-fix', target: { type: 'commit-message' },
  });
  assert.deepEqual(out, {
    body: 'Subject is vague — name the bug and mention T-123',
    action: 'must-fix',
    target: 'commit-message',
  });
});

test('commentToOutput: missing target defaults to a bare changeset shape', () => {
  const out = commentToOutput({ body: 'x', action: 'suggestion' });
  assert.deepEqual(out, { body: 'x', action: 'suggestion' });
});

// Action helpers back the composer / panel cycling and the exit-code gate.
test('cycleAction walks question → nit → suggestion → must-fix → question', () => {
  assert.equal(cycleAction('question'), 'nit');
  assert.equal(cycleAction('nit'), 'suggestion');
  assert.equal(cycleAction('suggestion'), 'must-fix');
  assert.equal(cycleAction('must-fix'), 'question');
});

test('cycleActionDown walks the reverse', () => {
  assert.equal(cycleActionDown('must-fix'), 'suggestion');
  assert.equal(cycleActionDown('suggestion'), 'nit');
  assert.equal(cycleActionDown('nit'), 'question');
  assert.equal(cycleActionDown('question'), 'must-fix');
});

test('isBlocking is true only for must-fix', () => {
  assert.equal(isBlocking('must-fix'), true);
  assert.equal(isBlocking('suggestion'), false);
  assert.equal(isBlocking('nit'), false);
  assert.equal(isBlocking('question'), false);
});
