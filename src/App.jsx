import React, { useState, useEffect } from 'react';
import ReviewShell from './components/ReviewShell.jsx';

function buildQuitMessage() {
  const state = window.__moorQuitState;
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

function computeExitCode() {
  const state = window.__moorQuitState;
  if (!state || state.noInteraction) return 3;
  if (state.rejected > 0) return 1;
  if (state.unreviewed > 0) return 2;
  return 0;
}

function buildClosePayload() {
  const state = window.__moorQuitState;
  const exitCode = computeExitCode();
  return {
    exitCode,
    rejections: state?.rejections || [],
  };
}

export function App() {
  const [mode, setMode] = useState('loading');
  const [leftPath, setLeftPath] = useState('');
  const [rightPath, setRightPath] = useState('');
  const [directoryTree, setDirectoryTree] = useState(null);
  const [contextChannel, setContextChannel] = useState({ channelConfigured: false, input: null });

  const api = window.moor;

  useEffect(() => {
    if (!api?.getInitialContext) return;
    api.getInitialContext().then(setContextChannel);
  }, [api]);

  useEffect(() => {
    if (!api) return;
    api.onInitialPaths(async (paths) => {
      if (!paths?.left || !paths?.right) return;

      if (paths.isDirectory) {
        setLeftPath(paths.left);
        setRightPath(paths.right);
        const tree = await api.compareDirectories(paths.left, paths.right);
        setDirectoryTree(tree);
      } else {
        // A two-file comparison is a one-file directory diff. Route it through
        // the same ReviewShell as directory mode so it gets hunk counting,
        // rejection capture, and the MOOR_CONTEXT verdict. A bare FileDiffView
        // has none of that machinery and always exits 3 (review never counted).
        // Base the displayed paths on each file's parent dir so the sidebar and
        // header show the filename rather than an empty string.
        const parent = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
        const name = (paths.right || paths.left).split('/').pop();
        setLeftPath(parent(paths.left));
        setRightPath(parent(paths.right));
        setDirectoryTree({
          name,
          type: 'directory',
          status: 'modified',
          leftPath: parent(paths.left),
          rightPath: parent(paths.right),
          children: [
            { name, type: 'file', status: 'modified', leftPath: paths.left, rightPath: paths.right },
          ],
        });
      }
      setMode('directory');
    });
  }, [api]);

  useEffect(() => {
    if (!api?.onCloseRequested) return;
    api.onCloseRequested(() => {
      if (typeof window.__moorConfirmClose === 'function') {
        window.__moorConfirmClose();
        return;
      }
      const message = buildQuitMessage();
      if (!message || window.confirm(message)) {
        api.forceClose(buildClosePayload());
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
          {api ? 'Loading...' : 'Usage: moor file1 file2'}
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
          channelConfigured={contextChannel.channelConfigured}
          inputContext={contextChannel.input}
          onClose={() => window.close()}
        />
      </div>
    );
  }

  return null;
}

export default App;
