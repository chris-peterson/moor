import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commentToOutput, cycleAction, cycleActionDown, isBlocking } from './comments.js';

// commentToOutput (IM.OUT-02a): the sidecar projection for each comment target.
test('commentToOutput: changeset comment omits file / lines / target', () => {
  const out = commentToOutput({ id: 1, body: '  ship it  ', action: 'consider', target: { type: 'changeset' } });
  assert.deepEqual(out, { body: 'ship it', action: 'consider' });
});

test('commentToOutput: file comment includes file, no line fields', () => {
  const out = commentToOutput({ id: 2, body: 'rename this', action: 'fix-later', target: { type: 'file', file: 'src/a.js' } });
  assert.deepEqual(out, { body: 'rename this', action: 'fix-later', file: 'src/a.js' });
});

test('commentToOutput: range comment includes file + startLine/endLine', () => {
  const out = commentToOutput({
    id: 3, body: 'off by one', action: 'fix-now',
    target: { type: 'range', file: 'src/a.js', startLine: 10, endLine: 12, startRow: 4, endRow: 6 },
  });
  assert.deepEqual(out, { body: 'off by one', action: 'fix-now', file: 'src/a.js', startLine: 10, endLine: 12 });
});

test('commentToOutput: commit-message comment carries target and no file', () => {
  const out = commentToOutput({
    id: 4, body: 'Subject is vague — name the bug and mention T-123',
    action: 'fix-now', target: { type: 'commit-message' },
  });
  assert.deepEqual(out, {
    body: 'Subject is vague — name the bug and mention T-123',
    action: 'fix-now',
    target: 'commit-message',
  });
});

test('commentToOutput: missing target defaults to a bare changeset shape', () => {
  const out = commentToOutput({ body: 'x', action: 'consider' });
  assert.deepEqual(out, { body: 'x', action: 'consider' });
});

// Action helpers back the composer / panel cycling and the exit-code gate.
test('cycleAction walks consider → fix-later → fix-now → consider', () => {
  assert.equal(cycleAction('consider'), 'fix-later');
  assert.equal(cycleAction('fix-later'), 'fix-now');
  assert.equal(cycleAction('fix-now'), 'consider');
});

test('cycleActionDown walks the reverse', () => {
  assert.equal(cycleActionDown('fix-now'), 'fix-later');
  assert.equal(cycleActionDown('fix-later'), 'consider');
  assert.equal(cycleActionDown('consider'), 'fix-now');
});

test('isBlocking is true only for fix-now', () => {
  assert.equal(isBlocking('fix-now'), true);
  assert.equal(isBlocking('fix-later'), false);
  assert.equal(isBlocking('consider'), false);
});
