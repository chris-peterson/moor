import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commentToOutput } from './comments.js';

// commentToOutput (IM.OUT-02a): the sidecar projection for each comment target.
test('commentToOutput: changeset comment omits file / lines / target', () => {
  const out = commentToOutput({ id: 1, body: '  ship it  ', target: { type: 'changeset' } });
  assert.deepEqual(out, { body: 'ship it' });
});

test('commentToOutput: file comment includes file, no line fields', () => {
  const out = commentToOutput({ id: 2, body: 'rename this', target: { type: 'file', file: 'src/a.js' } });
  assert.deepEqual(out, { body: 'rename this', file: 'src/a.js' });
});

test('commentToOutput: range comment includes file + startLine/endLine', () => {
  const out = commentToOutput({
    id: 3, body: 'off by one',
    target: { type: 'range', file: 'src/a.js', startLine: 10, endLine: 12, startRow: 4, endRow: 6 },
  });
  assert.deepEqual(out, { body: 'off by one', file: 'src/a.js', startLine: 10, endLine: 12 });
});

test('commentToOutput: commit-message comment carries target and no file', () => {
  const out = commentToOutput({
    id: 4, body: 'Subject is vague — name the bug and mention T-123',
    target: { type: 'commit-message' },
  });
  assert.deepEqual(out, {
    body: 'Subject is vague — name the bug and mention T-123',
    target: 'commit-message',
  });
});

test('commentToOutput: missing target defaults to a bare changeset shape', () => {
  const out = commentToOutput({ body: 'x' });
  assert.deepEqual(out, { body: 'x' });
});

// CO-03: no severity survives the projection, so a caller can't be handed a
// tier that moor no longer models.
test('commentToOutput: never emits an action field', () => {
  const out = commentToOutput({ id: 5, body: 'x', action: 'must-fix', target: { type: 'changeset' } });
  assert.deepEqual(out, { body: 'x' });
});
