import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';

const DEFAULT_IGNORED = new Set([
  '.git', 'node_modules', '.svn', '.hg', '__pycache__',
  '.DS_Store', 'dist', 'build', '.next', 'target',
]);

function normalizeLineEndings(text) {
  return text.replace(/\r/g, '');
}

async function safeReaddir(dirPath) {
  try {
    return await readdir(dirPath, { withFileTypes: true });
  } catch (err) {
    console.warn(`Skipping directory (${err.code}): ${dirPath}`);
    return [];
  }
}

async function safeReadFile(filePath) {
  try {
    return normalizeLineEndings(await readFile(filePath, 'utf-8'));
  } catch (err) {
    console.warn(`Cannot read file (${err.code}): ${filePath}`);
    return null;
  }
}

async function compareFiles(leftPath, rightPath) {
  const [leftContent, rightContent] = await Promise.all([
    safeReadFile(leftPath),
    safeReadFile(rightPath),
  ]);

  if (leftContent === null || rightContent === null) return 'modified';
  return leftContent === rightContent ? 'identical' : 'modified';
}

function sortChildren(children) {
  return children.sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });
}

async function buildTree(leftPath, rightPath, ignoredSet) {
  const [leftEntries, rightEntries] = await Promise.all([
    leftPath ? safeReaddir(leftPath) : [],
    rightPath ? safeReaddir(rightPath) : [],
  ]);

  const leftMap = new Map();
  for (const entry of leftEntries) {
    if (!ignoredSet.has(entry.name)) {
      leftMap.set(entry.name, entry);
    }
  }

  const rightMap = new Map();
  for (const entry of rightEntries) {
    if (!ignoredSet.has(entry.name)) {
      rightMap.set(entry.name, entry);
    }
  }

  const allNames = new Set([...leftMap.keys(), ...rightMap.keys()]);
  const children = [];

  const childPromises = Array.from(allNames).map(async (name) => {
    const leftEntry = leftMap.get(name);
    const rightEntry = rightMap.get(name);
    const lPath = leftPath ? join(leftPath, name) : null;
    const rPath = rightPath ? join(rightPath, name) : null;

    const isLeftDir = leftEntry?.isDirectory();
    const isRightDir = rightEntry?.isDirectory();
    const isDir = isLeftDir || isRightDir;

    if (leftEntry && !rightEntry) {
      if (isDir) {
        const subtree = await buildTree(lPath, null, ignoredSet);
        return {
          name,
          type: 'directory',
          status: 'left-only',
          children: subtree,
          leftPath: lPath,
          rightPath: null,
          summary: summarize(subtree, 'left-only'),
        };
      }
      return { name, type: 'file', status: 'left-only', leftPath: lPath, rightPath: null };
    }

    if (!leftEntry && rightEntry) {
      if (isDir) {
        const subtree = await buildTree(null, rPath, ignoredSet);
        return {
          name,
          type: 'directory',
          status: 'right-only',
          children: subtree,
          leftPath: null,
          rightPath: rPath,
          summary: summarize(subtree, 'right-only'),
        };
      }
      return { name, type: 'file', status: 'right-only', leftPath: null, rightPath: rPath };
    }

    // Both sides exist
    if (isLeftDir && isRightDir) {
      const subtree = await buildTree(lPath, rPath, ignoredSet);
      const summary = summarize(subtree);
      const status = summary.modified === 0 && summary.leftOnly === 0 && summary.rightOnly === 0
        ? 'identical'
        : 'modified';
      return { name, type: 'directory', status, children: subtree, leftPath: lPath, rightPath: rPath, summary };
    }

    // Type mismatch (one is file, other is dir) — treat as modified
    if (isDir) {
      return { name, type: 'file', status: 'modified', leftPath: lPath, rightPath: rPath };
    }

    const fileStatus = await compareFiles(lPath, rPath);
    return { name, type: 'file', status: fileStatus, leftPath: lPath, rightPath: rPath };
  });

  const results = await Promise.all(childPromises);
  return sortChildren(results);
}

function summarize(children, forceStatus) {
  const summary = { identical: 0, modified: 0, leftOnly: 0, rightOnly: 0 };

  for (const child of children) {
    if (child.type === 'directory' && child.summary) {
      summary.identical += child.summary.identical;
      summary.modified += child.summary.modified;
      summary.leftOnly += child.summary.leftOnly;
      summary.rightOnly += child.summary.rightOnly;
    } else {
      const status = forceStatus || child.status;
      switch (status) {
        case 'identical': summary.identical++; break;
        case 'modified': summary.modified++; break;
        case 'left-only': summary.leftOnly++; break;
        case 'right-only': summary.rightOnly++; break;
      }
    }
  }

  return summary;
}

export async function compareDirectories(leftPath, rightPath, ignoredDirs) {
  const ignoredSet = ignoredDirs
    ? new Set(ignoredDirs)
    : DEFAULT_IGNORED;

  const children = await buildTree(leftPath, rightPath, ignoredSet);
  const summary = summarize(children);

  const rootName = (leftPath || rightPath || '').split('/').pop();
  const status = summary.modified === 0 && summary.leftOnly === 0 && summary.rightOnly === 0
    ? 'identical'
    : 'modified';

  return {
    name: rootName,
    type: 'directory',
    status,
    children,
    leftPath,
    rightPath,
    summary,
  };
}
