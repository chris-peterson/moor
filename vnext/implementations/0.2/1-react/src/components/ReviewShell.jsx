import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Sidebar from './Sidebar.jsx';
import FileDiffView from './FileDiffView.jsx';
import FileNavbar from './FileNavbar.jsx';
import { computeLineChanges } from '../engine/diff.js';

const BINARY_SENTINEL = '\x00BINARY';

function countHunks(leftContent, rightContent) {
  if (!leftContent && !rightContent) return 0;
  if (leftContent === BINARY_SENTINEL || rightContent === BINARY_SENTINEL) return 1;
  const leftLines = leftContent ? leftContent.split('\n') : [];
  const rightLines = rightContent ? rightContent.split('\n') : [];
  const hunks = computeLineChanges(leftLines, rightLines);
  let count = 0;
  for (let i = 0; i < hunks.length; i++) {
    if (hunks[i].type === 'equal') continue;
    if (hunks[i].type === 'delete' && hunks[i + 1]?.type === 'insert') {
      count++;
      i++;
    } else {
      count++;
    }
  }
  return count;
}

function flattenTree(node, list = []) {
  if (node.type === 'file' && node.status !== 'identical') {
    list.push(node);
  }
  if (node.children) {
    for (const child of node.children) {
      flattenTree(child, list);
    }
  }
  return list;
}

export function ReviewShell({ tree, leftPath, rightPath, api, onClose }) {
  const files = useMemo(() => flattenTree(tree), [tree]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [leftContent, setLeftContent] = useState('');
  const [rightContent, setRightContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [navigatedBackward, setNavigatedBackward] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [hunkCounts, setHunkCounts] = useState({});
  const [perFileReviewedHunks, setPerFileReviewedHunks] = useState({});
  const [perFileRejectedHunks, setPerFileRejectedHunks] = useState({});
  const shellRef = useRef(null);

  useEffect(() => {
    if (!api || files.length === 0) return;
    let cancelled = false;
    (async () => {
      const counts = {};
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const [left, right] = await Promise.all([
          file.leftPath ? api.readFile(file.leftPath) : Promise.resolve(''),
          file.rightPath ? api.readFile(file.rightPath) : Promise.resolve(''),
        ]);
        if (cancelled) return;
        counts[i] = countHunks(left, right);
      }
      setHunkCounts(counts);
    })();
    return () => { cancelled = true; };
  }, [api, files]);

  const currentFile = files[currentIndex] || null;
  const loadIdRef = useRef(0);

  const loadFile = useCallback(async (file) => {
    if (!api || !file) return;
    const id = ++loadIdRef.current;
    setLoading(true);
    const [left, right] = await Promise.all([
      file.leftPath ? api.readFile(file.leftPath) : Promise.resolve(''),
      file.rightPath ? api.readFile(file.rightPath) : Promise.resolve(''),
    ]);
    if (id !== loadIdRef.current) return;
    setLeftContent(left);
    setRightContent(right);
    setLoading(false);
  }, [api]);

  useEffect(() => {
    if (currentFile) {
      loadFile(currentFile);
    }
  }, [currentFile, loadFile]);

  const viewed = useMemo(() => {
    const set = new Set();
    for (let i = 0; i < files.length; i++) {
      const count = hunkCounts[i];
      const reviewed = perFileReviewedHunks[i];
      if (count > 0 && reviewed && reviewed.size >= count) {
        set.add(i);
      }
    }
    return set;
  }, [files, hunkCounts, perFileReviewedHunks]);

  const navigateTo = useCallback((index) => {
    if (index < 0 || index >= files.length) return;
    setCurrentIndex(index);
  }, [files.length]);

  const navigateNext = useCallback(() => {
    setNavigatedBackward(false);
    if (currentIndex < files.length - 1) {
      navigateTo(currentIndex + 1);
    }
  }, [currentIndex, files.length, navigateTo]);

  const navigatePrev = useCallback(() => {
    setNavigatedBackward(true);
    if (currentIndex > 0) {
      navigateTo(currentIndex - 1);
    }
  }, [currentIndex, navigateTo]);

  const currentReviewedHunks = perFileReviewedHunks[currentIndex] || null;
  const handleReviewedHunksChange = useCallback((updater) => {
    setPerFileReviewedHunks(prev => ({
      ...prev,
      [currentIndex]: typeof updater === 'function' ? updater(prev[currentIndex] || new Set()) : updater,
    }));
  }, [currentIndex]);

  const currentRejectedHunks = perFileRejectedHunks[currentIndex] || null;
  const handleRejectedHunksChange = useCallback((updater) => {
    setPerFileRejectedHunks(prev => ({
      ...prev,
      [currentIndex]: typeof updater === 'function' ? updater(prev[currentIndex] || new Set()) : updater,
    }));
  }, [currentIndex]);

  const totalRejected = Object.values(perFileRejectedHunks).reduce((n, s) => n + s.size, 0);

  const totalChanges = Object.values(hunkCounts).reduce((a, b) => a + b, 0);
  const reviewedChanges = Object.values(perFileReviewedHunks).reduce((n, s) => n + s.size, 0);
  const allReviewed = totalChanges > 0 && reviewedChanges >= totalChanges;

  const prevAllReviewed = useRef(false);
  useEffect(() => {
    if (allReviewed && !prevAllReviewed.current && totalChanges > 0) {
      setShowToast(true);
      const timer = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(timer);
    }
    prevAllReviewed.current = allReviewed;
  }, [allReviewed, totalChanges]);

  useEffect(() => {
    const unreviewed = totalChanges - reviewedChanges - totalRejected;
    window.__kdiff4QuitState = {
      rejected: totalRejected,
      unreviewed: Math.max(0, unreviewed),
    };
    return () => { window.__kdiff4QuitState = null; };
  }, [totalChanges, reviewedChanges, totalRejected]);

  const confirmAndClose = useCallback(() => {
    const state = window.__kdiff4QuitState;
    const parts = [];
    if (state?.rejected > 0) parts.push(`${state.rejected} rejected`);
    if (state?.unreviewed > 0) parts.push(`${state.unreviewed} unreviewed`);
    if (parts.length === 0 || window.confirm(`${parts.join(', ')} change${(state.rejected + state.unreviewed) === 1 ? '' : 's'}.\n\nQuit anyway?`)) {
      if (window.kdiff4?.forceClose) {
        window.kdiff4.forceClose();
      } else {
        onClose();
      }
    }
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

      switch (e.key) {
        case 'q':
        case 'Escape':
          e.preventDefault();
          confirmAndClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [confirmAndClose]);

  useEffect(() => {
    if (shellRef.current) shellRef.current.focus();
  }, []);

  const relativePath = (fullPath, base) => {
    if (!fullPath || !base) return fullPath || '';
    if (fullPath.startsWith(base)) {
      const rel = fullPath.slice(base.length);
      return rel.startsWith('/') ? rel.slice(1) : rel;
    }
    return fullPath;
  };

  return (
    <div
      ref={shellRef}
      tabIndex={-1}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        outline: 'none',
      }}
    >
      {showToast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--color-equal)',
          color: 'var(--bg-deep)',
          fontFamily: 'var(--font-ui)',
          fontSize: '13px',
          fontWeight: 600,
          padding: '8px 20px',
          borderRadius: '6px',
          zIndex: 1000,
          animation: 'toast-fade 3s ease-in-out',
        }}>
          Review Complete!
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar
          tree={tree}
          files={files}
          currentIndex={currentIndex}
          viewed={viewed}
          onSelect={navigateTo}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {loading ? (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-ui)',
            }}>
              Loading...
            </div>
          ) : currentFile ? (
            <FileDiffView
              leftPath={relativePath(currentFile.leftPath, leftPath)}
              rightPath={relativePath(currentFile.rightPath, rightPath)}
              leftContent={leftContent}
              rightContent={rightContent}
              onNavigateNext={navigateNext}
              onNavigatePrev={navigatePrev}
              startAtEnd={navigatedBackward}
              onHunkChange={() => {}}
              reviewedHunks={currentReviewedHunks}
              onReviewedHunksChange={handleReviewedHunksChange}
              rejectedHunks={currentRejectedHunks}
              onRejectedHunksChange={handleRejectedHunksChange}
            />
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)',
            }}>
              No differences found
            </div>
          )}
        </div>
      </div>
      <FileNavbar
        files={files}
        currentIndex={currentIndex}
        allViewed={allReviewed}
        hunkCounts={hunkCounts}
        viewed={viewed}
        perFileReviewedHunks={perFileReviewedHunks}
        currentFilePath={currentFile ? relativePath(currentFile.rightPath || currentFile.leftPath, rightPath || leftPath) : ''}
      />
    </div>
  );
}

export default ReviewShell;
