import { execFile } from 'child_process';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import os from 'os';

const VSCODE_VARIANTS = [
  { name: 'Code',           dirName: 'Code',           bins: ['code'] },
  { name: 'Code - Insiders', dirName: 'Code - Insiders', bins: ['code-insiders'] },
  { name: 'Cursor',         dirName: 'Cursor',          bins: ['cursor'] },
  { name: 'VSCodium',       dirName: 'VSCodium',        bins: ['codium'] },
];

const MAC_APP_PATHS = {
  'code':          '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
  'code-insiders': '/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code-insiders',
  'cursor':        '/Applications/Cursor.app/Contents/Resources/app/bin/cursor',
  'codium':        '/Applications/VSCodium.app/Contents/Resources/app/bin/codium',
};

class VSCodeNavigator {
  constructor(opts = {}) {
    this.preferWorkspace = opts.preferWorkspace || null;
    this.reuseWindow = opts.reuseWindow !== false;
    this._variant = opts.variant
      ? VSCODE_VARIANTS.find(v => v.name === opts.variant) || VSCODE_VARIANTS[0]
      : null;
    this._binPath = null;
  }

  async openAtLine(repoRelativePath, line, column = 1) {
    const variant = this._variant || this._detectVariant();
    const bin = await this._resolveBin(variant);
    if (!bin) {
      return { found: false, error: `Could not find CLI for ${variant.name}` };
    }

    const { open, recent } = this._getWorkspaces(variant);

    const sorted = this._prioritize([...open], this.preferWorkspace);
    for (const ws of sorted) {
      const fullPath = path.join(ws, repoRelativePath);
      if (this._fileExists(fullPath)) {
        await this._exec(bin, ['--goto', `${fullPath}:${line}:${column}`]);
        return { found: true, alreadyOpen: true, workspace: ws, filePath: fullPath };
      }
    }

    const recentSorted = this._prioritize([...recent], this.preferWorkspace);
    for (const ws of recentSorted) {
      const fullPath = path.join(ws, repoRelativePath);
      if (this._fileExists(fullPath)) {
        const args = this.reuseWindow ? ['--reuse-window'] : ['--new-window'];
        args.push(ws, '--goto', `${fullPath}:${line}:${column}`);
        await this._exec(bin, args);
        return { found: true, alreadyOpen: false, workspace: ws, filePath: fullPath };
      }
    }

    return { found: false, error: `File "${repoRelativePath}" not found in any workspace` };
  }

  async openAbsolutePath(absolutePath, line, column = 1) {
    const variant = this._variant || this._detectVariant();
    const bin = await this._resolveBin(variant);
    if (!bin) {
      return { found: false, error: `Could not find CLI for ${variant.name}` };
    }

    await this._exec(bin, ['--goto', `${absolutePath}:${line}:${column}`]);
    return { found: true, filePath: absolutePath };
  }

  listWorkspaces() {
    const variant = this._variant || this._detectVariant();
    return this._getWorkspaces(variant);
  }

  findFile(repoRelativePath) {
    const variant = this._variant || this._detectVariant();
    const { open, recent } = this._getWorkspaces(variant);
    const results = [];

    for (const ws of open) {
      const fp = path.join(ws, repoRelativePath);
      if (this._fileExists(fp)) results.push({ workspace: ws, filePath: fp, isOpen: true });
    }
    for (const ws of recent) {
      const fp = path.join(ws, repoRelativePath);
      if (this._fileExists(fp) && !results.some(r => r.workspace === ws)) {
        results.push({ workspace: ws, filePath: fp, isOpen: false });
      }
    }
    return results;
  }

  _getWorkspaces(variant) {
    const open = this._getOpenWorkspaces(variant);
    const recent = this._getRecentWorkspaces(variant);
    const openSet = new Set(open);
    const filteredRecent = recent.filter(ws => !openSet.has(ws));
    return { open, recent: filteredRecent };
  }

  _getOpenWorkspaces(variant) {
    try {
      const storagePath = this._globalStoragePath(variant, 'storage.json');
      if (!this._fileExists(storagePath)) return [];
      const data = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
      const ws = data?.windowsState;
      if (!ws) return [];

      const folders = [];
      const lastFolder = this._extractFolder(ws.lastActiveWindow);
      if (lastFolder) folders.push(lastFolder);

      for (const w of ws.openedWindows ?? []) {
        const f = this._extractFolder(w);
        if (f && !folders.includes(f)) folders.push(f);
      }
      return folders;
    } catch {
      return [];
    }
  }

  _getRecentWorkspaces(variant) {
    const sqliteResult = this._getRecentFromSqlite(variant);
    if (sqliteResult.length > 0) return sqliteResult;
    return this._getRecentFromJson(variant);
  }

  _getRecentFromSqlite(variant) {
    try {
      const require = createRequire(import.meta.url);
      const Database = require('better-sqlite3');
      const dbPath = this._globalStoragePath(variant, 'state.vscdb');
      if (!this._fileExists(dbPath)) return [];

      const db = new Database(dbPath, { readonly: true, fileMustExist: true });
      let folders = [];
      try {
        const row = db.prepare(
          "SELECT value FROM ItemTable WHERE key = 'history.recentlyOpenedPathsList'"
        ).get();
        if (row) {
          const parsed = JSON.parse(row.value);
          folders = (parsed.entries ?? [])
            .filter(e => e.folderUri)
            .map(e => this._uriToPath(e.folderUri))
            .filter(Boolean);
        }
      } finally {
        db.close();
      }
      return folders;
    } catch {
      return [];
    }
  }

  _getRecentFromJson(variant) {
    try {
      const storagePath = this._globalStoragePath(variant, 'storage.json');
      if (!this._fileExists(storagePath)) return [];
      const data = JSON.parse(fs.readFileSync(storagePath, 'utf8'));

      const recentRoots = data?.openedPathsList?.entries
        ?? data?.lastKnownMenubarData?.menus?.File?.items
            ?.find(i => i.id === 'submenuitem.MenubarRecentMenu')
            ?.submenu?.items
        ?? [];

      return recentRoots
        .map(e => {
          const uri = e.folderUri ?? e.uri?.path ?? e.uri?.external;
          return uri ? this._uriToPath(uri) : null;
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  _globalStoragePath(variant, filename) {
    const appSupport = path.join(os.homedir(), 'Library', 'Application Support');
    return path.join(appSupport, variant.dirName, 'User', 'globalStorage', filename);
  }

  _extractFolder(windowEntry) {
    if (!windowEntry) return null;
    const raw = windowEntry.folder ?? windowEntry.folderUri;
    if (!raw) return null;
    return this._uriToPath(typeof raw === 'string' ? raw : raw.path ?? raw.external ?? '');
  }

  _uriToPath(uri) {
    if (!uri) return null;
    try {
      if (uri.startsWith('file://')) {
        return decodeURIComponent(new URL(uri).pathname);
      }
      if (uri.includes('://') && !uri.startsWith('/')) return null;
      return decodeURIComponent(uri);
    } catch {
      return null;
    }
  }

  _prioritize(workspaces, preferred) {
    if (!preferred) return workspaces;
    const norm = path.resolve(preferred);
    const idx = workspaces.findIndex(ws => path.resolve(ws) === norm);
    if (idx > 0) {
      workspaces.unshift(workspaces.splice(idx, 1)[0]);
    }
    return workspaces;
  }

  _fileExists(p) {
    try { return fs.statSync(p).isFile(); } catch { return false; }
  }

  _detectVariant() {
    for (const v of VSCODE_VARIANTS) {
      const storageDir = path.join(
        os.homedir(), 'Library', 'Application Support', v.dirName
      );
      try {
        if (fs.statSync(storageDir).isDirectory()) return v;
      } catch { /* continue */ }
    }
    return VSCODE_VARIANTS[0];
  }

  async _resolveBin(variant) {
    if (this._binPath) return this._binPath;

    for (const bin of variant.bins) {
      if (await this._binExists(bin)) {
        this._binPath = bin;
        return bin;
      }
      const macPath = MAC_APP_PATHS[bin];
      if (macPath && this._fileExists(macPath)) {
        this._binPath = macPath;
        return macPath;
      }
    }
    return null;
  }

  _binExists(name) {
    return new Promise(resolve => {
      execFile('which', [name], err => resolve(!err));
    });
  }

  _exec(bin, args) {
    return new Promise((resolve, reject) => {
      execFile(bin, args, { timeout: 10000 }, (err, stdout, stderr) => {
        if (err) reject(err);
        else resolve(stdout);
      });
    });
  }
}

export { VSCodeNavigator };
