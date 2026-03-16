import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { diff3Merge } from './diff3.js';

describe('diff3Merge', () => {
  test('identical files produce no conflicts', () => {
    const text = 'a\nb\nc';
    const result = diff3Merge(text, text, text);
    assert.equal(result.conflicts, 0);
    assert.ok(result.regions.length > 0);
    assert.ok(result.regions.every(r => r.type === 'unchanged'));
  });

  test('left-only change is auto-resolved', () => {
    const base = 'a\nb\nc';
    const left = 'a\nx\nc';
    const right = 'a\nb\nc';
    const result = diff3Merge(base, left, right);
    assert.equal(result.conflicts, 0);
    const leftOnly = result.regions.filter(r => r.type === 'left-only');
    assert.ok(leftOnly.length > 0);
    assert.deepEqual(leftOnly[0].resolvedLines, ['x']);
  });

  test('right-only change is auto-resolved', () => {
    const base = 'a\nb\nc';
    const left = 'a\nb\nc';
    const right = 'a\ny\nc';
    const result = diff3Merge(base, left, right);
    assert.equal(result.conflicts, 0);
    const rightOnly = result.regions.filter(r => r.type === 'right-only');
    assert.ok(rightOnly.length > 0);
    assert.deepEqual(rightOnly[0].resolvedLines, ['y']);
  });

  test('both sides changed differently creates conflict', () => {
    const base = 'a\nb\nc';
    const left = 'a\nx\nc';
    const right = 'a\ny\nc';
    const result = diff3Merge(base, left, right);
    assert.equal(result.conflicts, 1);
    const conflict = result.regions.find(r => r.type === 'conflict');
    assert.ok(conflict);
    assert.equal(conflict.resolvedLines, null);
  });

  test('both sides changed identically is auto-resolved', () => {
    const base = 'a\nb\nc';
    const left = 'a\nx\nc';
    const right = 'a\nx\nc';
    const result = diff3Merge(base, left, right);
    assert.equal(result.conflicts, 0);
    const both = result.regions.find(r => r.type === 'both-changed');
    assert.ok(both);
    assert.deepEqual(both.resolvedLines, ['x']);
  });

  test('empty base with insertions on both sides', () => {
    const result = diff3Merge('', 'a\nb', 'c\nd');
    assert.ok(result.conflicts >= 1);
  });

  test('all empty produces no regions', () => {
    const result = diff3Merge('', '', '');
    assert.equal(result.conflicts, 0);
  });
});
