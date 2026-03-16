import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { diffLines, diffChars, computeLineChanges } from './diff.js';

describe('computeLineChanges', () => {
  test('identical arrays produce a single equal hunk', () => {
    const hunks = computeLineChanges(['a', 'b', 'c'], ['a', 'b', 'c']);
    assert.equal(hunks.length, 1);
    assert.equal(hunks[0].type, 'equal');
  });

  test('detects insertion', () => {
    const hunks = computeLineChanges(['a', 'c'], ['a', 'b', 'c']);
    const types = hunks.map(h => h.type);
    assert.ok(types.includes('insert'));
  });

  test('detects deletion', () => {
    const hunks = computeLineChanges(['a', 'b', 'c'], ['a', 'c']);
    const types = hunks.map(h => h.type);
    assert.ok(types.includes('delete'));
  });

  test('empty vs non-empty', () => {
    const hunks = computeLineChanges([], ['a', 'b']);
    assert.equal(hunks.length, 1);
    assert.equal(hunks[0].type, 'insert');
  });

  test('non-empty vs empty', () => {
    const hunks = computeLineChanges(['a', 'b'], []);
    assert.equal(hunks.length, 1);
    assert.equal(hunks[0].type, 'delete');
  });

  test('both empty', () => {
    const hunks = computeLineChanges([], []);
    assert.equal(hunks.length, 0);
  });
});

describe('diffLines', () => {
  test('splits text and diffs', () => {
    const hunks = diffLines('a\nb\nc', 'a\nx\nc');
    const types = hunks.map(h => h.type);
    assert.ok(types.includes('equal'));
    assert.ok(types.includes('delete') || types.includes('insert'));
  });

  test('handles empty strings', () => {
    const hunks = diffLines('', '');
    assert.equal(hunks.length, 0);
  });
});

describe('diffChars (hybrid word/char)', () => {
  test('identical strings', () => {
    const parts = diffChars('hello world', 'hello world');
    assert.equal(parts.length, 1);
    assert.equal(parts[0].type, 'equal');
    assert.equal(parts[0].value, 'hello world');
  });

  test('completely different words use word-level', () => {
    const parts = diffChars('"port": 3000,', '"port": 8080,');
    const deleted = parts.filter(p => p.type === 'delete').map(p => p.value).join('');
    const inserted = parts.filter(p => p.type === 'insert').map(p => p.value).join('');
    assert.equal(deleted, '3000');
    assert.equal(inserted, '8080');
  });

  test('empty strings', () => {
    const parts = diffChars('', '');
    assert.equal(parts.length, 0);
  });

  test('single clean edit within a word uses char-level', () => {
    const parts = diffChars('localhost', 'localpost');
    const deleted = parts.filter(p => p.type === 'delete').map(p => p.value).join('');
    const inserted = parts.filter(p => p.type === 'insert').map(p => p.value).join('');
    assert.equal(deleted, 'h');
    assert.equal(inserted, 'p');
  });

  test('boolean change highlights whole word', () => {
    const parts = diffChars('"debug": true,', '"debug": false,');
    const deleted = parts.filter(p => p.type === 'delete').map(p => p.value).join('');
    const inserted = parts.filter(p => p.type === 'insert').map(p => p.value).join('');
    assert.equal(deleted, 'true');
    assert.equal(inserted, 'false');
  });
});
