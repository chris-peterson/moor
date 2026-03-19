import React, { useState, useEffect, useCallback } from 'react';
import FileDiffView from './components/FileDiffView.jsx';
import ReviewShell from './components/ReviewShell.jsx';

function buildQuitMessage() {
  const state = window.__kdiff4QuitState;
  if (!state) return null;

  const parts = [];
  if (state.rejected > 0) {
    parts.push(`${state.rejected} rejected`);
  }
  if (state.unreviewed > 0) {
    parts.push(`${state.unreviewed} unreviewed`);
  }
  if (parts.length === 0) return null;
  return `${parts.join(', ')} change${(state.rejected + state.unreviewed) === 1 ? '' : 's'}.\n\nQuit anyway?`;
}

export function App() {
  const [mode, setMode] = useState('loading');
  const [leftPath, setLeftPath] = useState('');
  const [rightPath, setRightPath] = useState('');
  const [leftContent, setLeftContent] = useState('');
  const [rightContent, setRightContent] = useState('');
  const [directoryTree, setDirectoryTree] = useState(null);

  const api = window.kdiff4;

  useEffect(() => {
    if (!api) return;
    api.onInitialPaths(async (paths) => {
      if (!paths?.left || !paths?.right) return;
      setLeftPath(paths.left);
      setRightPath(paths.right);

      if (paths.isDirectory) {
        const tree = await api.compareDirectories(paths.left, paths.right);
        setDirectoryTree(tree);
        setMode('directory');
      } else {
        const [l, r] = await Promise.all([
          api.readFile(paths.left),
          api.readFile(paths.right),
        ]);
        setLeftContent(l);
        setRightContent(r);
        setMode('diff');
      }
    });
  }, [api]);

  useEffect(() => {
    if (!api?.onCloseRequested) return;
    api.onCloseRequested(() => {
      const message = buildQuitMessage();
      if (!message || window.confirm(message)) {
        api.forceClose();
      }
    });
  }, [api]);

  const containerStyle = {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  if (mode === 'loading') {
    return (
      <div style={{ ...containerStyle, alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
          {api ? 'Loading...' : 'Usage: kdiff4 file1 file2'}
        </span>
      </div>
    );
  }

  if (mode === 'directory' && directoryTree) {
    return (
      <div style={containerStyle}>
        <ReviewShell
          tree={directoryTree}
          leftPath={leftPath}
          rightPath={rightPath}
          api={api}
          onClose={() => window.close()}
        />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <FileDiffView
        leftPath={leftPath}
        rightPath={rightPath}
        leftContent={leftContent}
        rightContent={rightContent}
      />
    </div>
  );
}

export default App;
