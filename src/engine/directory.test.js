import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compareDirectories } from './directory.js';

function findFile(node, name) {
  if (node.type === 'file' && node.name === name) return node;
  if (!node.children) return null;
  for (const c of node.children) {
    const f = findFile(c, name);
    if (f) return f;
  }
  return null;
}

describe('compareDirectories — rename detection', () => {
  let root;

  before(async () => {
    root = await mkdtemp(join(tmpdir(), 'moor-dir-test-'));
    await mkdir(join(root, 'left/src'), { recursive: true });
    await mkdir(join(root, 'right/src'), { recursive: true });
    await mkdir(join(root, 'left/old'), { recursive: true });
    await mkdir(join(root, 'right/new'), { recursive: true });

    // Same-directory rename (git mv foo.txt bar.txt)
    await writeFile(join(root, 'left/src/foo.txt'), 'same content\n');
    await writeFile(join(root, 'right/src/bar.txt'), 'same content\n');

    // Cross-directory move (git mv old/file.txt new/file.txt)
    await writeFile(join(root, 'left/old/file.txt'), 'moved content\n');
    await writeFile(join(root, 'right/new/file.txt'), 'moved content\n');

    // Genuine left-only (deleted)
    await writeFile(join(root, 'left/deleted.txt'), 'gone\n');

    // Genuine right-only (added)
    await writeFile(join(root, 'right/added.txt'), 'fresh\n');

    // Modified file (same name, different content)
    await writeFile(join(root, 'left/mod.txt'), 'before\n');
    await writeFile(join(root, 'right/mod.txt'), 'after\n');
  });

  after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test('detects same-directory rename with identical content', async () => {
    const tree = await compareDirectories(join(root, 'left'), join(root, 'right'));
    const renamed = findFile(tree, 'bar.txt');
    assert.ok(renamed, 'rename destination present');
    assert.equal(renamed.status, 'renamed');
    assert.equal(renamed.fromName, 'foo.txt');
    assert.ok(renamed.leftPath.endsWith('left/src/foo.txt'));
    assert.ok(renamed.rightPath.endsWith('right/src/bar.txt'));
    assert.equal(findFile(tree, 'foo.txt'), null, 'rename source removed');
  });

  test('detects cross-directory move', async () => {
    const tree = await compareDirectories(join(root, 'left'), join(root, 'right'));
    // Both sides have a file.txt — only the destination should remain as 'renamed'.
    const dest = findFile(tree.children.find(c => c.name === 'new'), 'file.txt');
    assert.ok(dest, 'destination present');
    assert.equal(dest.status, 'renamed');
    assert.ok(dest.leftPath.endsWith('left/old/file.txt'));

    const sourceDir = tree.children.find(c => c.name === 'old');
    const sourceFile = sourceDir?.children?.find(c => c.name === 'file.txt');
    assert.equal(sourceFile, undefined, 'rename source removed from old dir');
  });

  test('preserves genuine left-only and right-only entries', async () => {
    const tree = await compareDirectories(join(root, 'left'), join(root, 'right'));
    const deleted = findFile(tree, 'deleted.txt');
    const added = findFile(tree, 'added.txt');
    assert.equal(deleted?.status, 'left-only');
    assert.equal(added?.status, 'right-only');
  });

  test('preserves modified entries', async () => {
    const tree = await compareDirectories(join(root, 'left'), join(root, 'right'));
    const mod = findFile(tree, 'mod.txt');
    assert.equal(mod?.status, 'modified');
  });

  test('summary reflects post-rename counts', async () => {
    const tree = await compareDirectories(join(root, 'left'), join(root, 'right'));
    assert.equal(tree.summary.renamed, 2);
    assert.equal(tree.summary.leftOnly, 1);
    assert.equal(tree.summary.rightOnly, 1);
    assert.equal(tree.summary.modified, 1);
  });

  test('does not match files with differing content', async () => {
    const local = await mkdtemp(join(tmpdir(), 'moor-dir-nomatch-'));
    await writeFile(join(local, 'a.txt'), 'alpha\n');
    await mkdir(join(local, 'right'));
    await writeFile(join(local, 'right/b.txt'), 'beta\n');
    await mkdir(join(local, 'left'));
    await writeFile(join(local, 'left/a.txt'), 'alpha\n');

    const tree = await compareDirectories(join(local, 'left'), join(local, 'right'));
    const a = findFile(tree, 'a.txt');
    const b = findFile(tree, 'b.txt');
    assert.equal(a?.status, 'left-only');
    assert.equal(b?.status, 'right-only');

    await rm(local, { recursive: true, force: true });
  });
});
