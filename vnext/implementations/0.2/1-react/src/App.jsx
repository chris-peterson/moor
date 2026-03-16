import React, { useState, useEffect, useCallback } from 'react';
import Welcome from './components/Welcome.jsx';
import ReviewShell from './components/ReviewShell.jsx';
import FileDiffView from './components/FileDiffView.jsx';

export function App() {
  const [mode, setMode] = useState('welcome');
  const [directoryTree, setDirectoryTree] = useState(null);
  const [leftPath, setLeftPath] = useState('');
  const [rightPath, setRightPath] = useState('');
  const [leftContent, setLeftContent] = useState('');
  const [rightContent, setRightContent] = useState('');

  const api = window.kdiff4;

  const handleCompareDirectories = useCallback(async (left, right) => {
    if (!api) return;
    setLeftPath(left);
    setRightPath(right);
    const tree = await api.compareDirectories(left, right);
    setDirectoryTree(tree);
    setMode('review');
  }, [api]);

  const handleDiffFiles = useCallback(async (left, right) => {
    if (!api) return;
    setLeftPath(left);
    setRightPath(right);
    const [l, r] = await Promise.all([
      api.readFile(left),
      api.readFile(right),
    ]);
    setLeftContent(l);
    setRightContent(r);
    setMode('diff');
  }, [api]);

  const handleStartMerge = useCallback(async (base, left, right, outputPath) => {
    if (!api) return;
    const [baseContent, leftContent, rightContent] = await Promise.all([
      api.readFile(base),
      api.readFile(left),
      api.readFile(right),
    ]);
    setMode('merge');
  }, [api]);

  const handleClose = useCallback(() => {
    if (api) {
      window.close();
    } else {
      setMode('welcome');
    }
  }, [api]);

  useEffect(() => {
    if (api && api.onInitialPaths) {
      api.onInitialPaths((paths) => {
        if (paths.mode === 'diff' && paths.left && paths.right) {
          handleDiffFiles(paths.left, paths.right);
        } else if (paths.mode === 'compare' && paths.left && paths.right) {
          handleCompareDirectories(paths.left, paths.right);
        }
      });
    }
  }, [api, handleCompareDirectories, handleDiffFiles]);

  const containerStyle = {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  if (mode === 'diff') {
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

  if (mode === 'review' && directoryTree) {
    return (
      <div style={containerStyle}>
        <ReviewShell
          tree={directoryTree}
          leftPath={leftPath}
          rightPath={rightPath}
          api={api}
          onClose={handleClose}
        />
      </div>
    );
  }

  if (mode === 'welcome') {
    return (
      <div style={containerStyle}>
        <Welcome onCompare={handleCompareDirectories} onMerge={handleStartMerge} api={api} />
      </div>
    );
  }

  return (
    <div style={{ ...containerStyle, alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>Loading...</p>
    </div>
  );
}

export default App;
