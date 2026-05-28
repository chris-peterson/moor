import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Sidebar from './Sidebar.jsx';
import FileDiffView from './FileDiffView.jsx';
import FileNavbar from './FileNavbar.jsx';
import ContextHeader from './ContextHeader.jsx';
import { computeLineChanges, countDisplayHunks, computeHunkStartLines, BINARY_SENTINEL } from '../engine/diff.js';

const emptySet = new Set();
const emptyMap = new Map();

function useIndexedSetter(setState, currentIndex, empty) {
  return useCallback((updater) => {
    setState(prev => ({
      ...prev,
      [currentIndex]: typeof updater === 'function' ? updater(prev[currentIndex] || empty) : updater,
    }));
  }, [setState, currentIndex, empty]);
}

function hunkCountFor(leftContent, rightContent) {
  if (!leftContent && !rightContent) return 0;
  if (leftContent === BINARY_SENTINEL || rightContent === BINARY_SENTINEL) return 1;
  const leftLines = leftContent ? leftContent.split('\n') : [];
  const rightLines = rightContent ? rightContent.split('\n') : [];
  return countDisplayHunks(computeLineChanges(leftLines, rightLines));
}

function relativePath(fullPath, base) {
  if (!fullPath || !base) return fullPath || '';
  if (fullPath.startsWith(base)) {
    const rel = fullPath.slice(base.length);
    return rel.startsWith('/') ? rel.slice(1) : rel;
  }
  return fullPath;
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

export function ReviewShell({ tree, leftPath, rightPath, api, channelConfigured, inputContext, onClose }) {
  const files = useMemo(() => flattenTree(tree), [tree]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [leftContent, setLeftContent] = useState('');
  const [rightContent, setRightContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [navigatedBackward, setNavigatedBackward] = useState(false);
  const [targetHunk, setTargetHunk] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [hunkCounts, setHunkCounts] = useState({});
  const [perFileReviewedHunks, setPerFileReviewedHunks] = useState({});
  const [perFileRejectedHunks, setPerFileRejectedHunks] = useState({});
  const [perFileRejectionReasons, setPerFileRejectionReasons] = useState({});
  const shellRef = useRef(null);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [draggingSidebar, setDraggingSidebar] = useState(false);
  const [searchQuery, setSearchQuery] = useState(null);
  const [fileContents, setFileContents] = useState({});
  const [quitDialog, setQuitDialog] = useState(null);

  const handleSidebarResizerMouseDown = useCallback((e) => {
    e.preventDefault();
    setDraggingSidebar(true);
    const onMouseMove = (e) => {
      setSidebarWidth(Math.max(120, Math.min(500, e.clientX)));
    };
    const onMouseUp = () => {
      setDraggingSidebar(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  useEffect(() => {
    if (!api || files.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(files.map(async (file) => {
        const [left, right] = await Promise.all([
          file.leftPath ? api.readFile(file.leftPath) : Promise.resolve(''),
          file.rightPath ? api.readFile(file.rightPath) : Promise.resolve(''),
        ]);
        return { left, right };
      }));
      if (cancelled) return;
      const counts = {};
      const contents = {};
      for (let i = 0; i < entries.length; i++) {
        contents[i] = entries[i];
        counts[i] = hunkCountFor(entries[i].left, entries[i].right);
      }
      setHunkCounts(counts);
      setFileContents(contents);
    })();
    return () => { cancelled = true; };
  }, [api, files]);

  const currentFile = files[currentIndex] || null;

  // Prefer the prefetched content; fall back to a direct read if a file is
  // selected before the startup prefetch has populated this index.
  useEffect(() => {
    if (!currentFile) return;
    const cached = fileContents[currentIndex];
    if (cached) {
      setLeftContent(cached.left);
      setRightContent(cached.right);
      setLoading(false);
      return;
    }
    if (!api) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [left, right] = await Promise.all([
        currentFile.leftPath ? api.readFile(currentFile.leftPath) : Promise.resolve(''),
        currentFile.rightPath ? api.readFile(currentFile.rightPath) : Promise.resolve(''),
      ]);
      if (cancelled) return;
      setLeftContent(left);
      setRightContent(right);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [currentFile, currentIndex, fileContents, api]);

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
    setTargetHunk(null);
    setCurrentIndex(index);
  }, [files.length]);

  const navigateToRejection = useCallback((fileIndex) => {
    if (fileIndex < 0 || fileIndex >= files.length) return;
    const rejected = perFileRejectedHunks[fileIndex];
    const firstRejected = rejected ? Math.min(...rejected) : null;
    setTargetHunk(firstRejected);
    setCurrentIndex(fileIndex);
  }, [files.length, perFileRejectedHunks]);

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

  const navigatePrevFile = useCallback(() => {
    setNavigatedBackward(false);
    if (currentIndex > 0) {
      navigateTo(currentIndex - 1);
    }
  }, [currentIndex, navigateTo]);

  const currentReviewedHunks = perFileReviewedHunks[currentIndex] || emptySet;
  const handleReviewedHunksChange = useIndexedSetter(setPerFileReviewedHunks, currentIndex, emptySet);

  const currentRejectedHunks = perFileRejectedHunks[currentIndex] || emptySet;
  const handleRejectedHunksChange = useIndexedSetter(setPerFileRejectedHunks, currentIndex, emptySet);

  const currentRejectionReasons = perFileRejectionReasons[currentIndex] || emptyMap;
  const handleRejectionReasonsChange = useIndexedSetter(setPerFileRejectionReasons, currentIndex, emptyMap);

  const handleSearchChange = useCallback((query) => {
    setSearchQuery(query);
  }, []);

  const searchHiddenFiles = useMemo(() => {
    if (!searchQuery) return null;
    const q = searchQuery.toLowerCase();
    const hidden = new Set();
    for (let i = 0; i < files.length; i++) {
      const c = fileContents[i];
      if (!c) continue;
      const leftMatch = c.left && c.left.toLowerCase().includes(q);
      const rightMatch = c.right && c.right.toLowerCase().includes(q);
      if (!leftMatch && !rightMatch) hidden.add(i);
    }
    return hidden;
  }, [searchQuery, files, fileContents]);

  const totalRejected = Object.values(perFileRejectedHunks).reduce((n, s) => n + s.size, 0);

  const rejectedFiles = useMemo(() => {
    const set = new Set();
    for (const [idx, hunks] of Object.entries(perFileRejectedHunks)) {
      if (hunks && hunks.size > 0) set.add(Number(idx));
    }
    return set;
  }, [perFileRejectedHunks]);

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

  const hunkCountingDone = Object.keys(hunkCounts).length >= files.length;

  const liveRejections = useMemo(() => {
    if (!hunkCountingDone) return [];
    const rejections = [];
    for (const [fileIdxStr, rejected] of Object.entries(perFileRejectedHunks)) {
      const fileIdx = Number(fileIdxStr);
      const file = files[fileIdx];
      if (!file || !rejected || rejected.size === 0) continue;
      const filePath = file.rightPath || file.leftPath;
      const content = fileContents[fileIdx];
      const starts = content ? computeHunkStartLines(content.left, content.right) : [];
      const reasons = perFileRejectionReasons[fileIdx];
      for (const hunkIdx of rejected) {
        const line = starts[hunkIdx]?.line ?? 1;
        const reason = reasons?.get(hunkIdx) ?? null;
        rejections.push({ file: filePath, hunk: hunkIdx, line, reason });
      }
    }
    return rejections;
  }, [hunkCountingDone, files, perFileRejectedHunks, perFileRejectionReasons, fileContents]);

  const rejectionBadges = useMemo(() => {
    const badges = [];
    for (let i = 0; i < files.length; i++) {
      const rejected = perFileRejectedHunks[i];
      if (rejected && rejected.size > 0) {
        const file = files[i];
        const name = (file.rightPath || file.leftPath || '').split('/').pop();
        badges.push({ fileIndex: i, count: rejected.size, name });
      }
    }
    return badges;
  }, [files, perFileRejectedHunks]);

  useEffect(() => {
    if (!hunkCountingDone && files.length > 0) {
      window.__moorQuitState = { noInteraction: true, rejected: 0, unreviewed: files.length, rejections: [] };
      return () => { window.__moorQuitState = null; };
    }
    const unreviewed = totalChanges - reviewedChanges - totalRejected;
    window.__moorQuitState = {
      rejected: totalRejected,
      unreviewed: Math.max(0, unreviewed),
      rejections: liveRejections,
    };
    return () => { window.__moorQuitState = null; };
  }, [hunkCountingDone, files, totalChanges, reviewedChanges, totalRejected, liveRejections]);

  useEffect(() => {
    if (!api?.writeOutput) return;
    // Coalesce rapid state changes (typing a rejection reason fires per-keystroke
    // effects) into one IPC write per frame.
    const handle = requestAnimationFrame(() => {
      api.writeOutput({ rejections: liveRejections });
    });
    return () => cancelAnimationFrame(handle);
  }, [api, liveRejections]);

  const closeWithExitCode = useCallback((exitCode) => {
    if (window.moor?.forceClose) {
      window.moor.forceClose({ exitCode, rejections: liveRejections });
    } else {
      onClose();
    }
  }, [liveRejections, onClose]);

  const unreviewedCount = Math.max(0, totalChanges - reviewedChanges - totalRejected);

  const requestClose = useCallback(() => {
    if (totalRejected > 0) {
      setQuitDialog({ mode: 'rejected' });
    } else if (unreviewedCount > 0) {
      setQuitDialog({ mode: 'unreviewed' });
    } else {
      closeWithExitCode(0);
    }
  }, [totalRejected, unreviewedCount, closeWithExitCode]);

  useEffect(() => {
    window.__moorConfirmClose = requestClose;
    return () => {
      if (window.__moorConfirmClose === requestClose) {
        window.__moorConfirmClose = null;
      }
    };
  }, [requestClose]);

  const rejectionSummary = useMemo(() => {
    const summary = [];
    for (const [fileIdxStr, hunks] of Object.entries(perFileRejectedHunks)) {
      if (!hunks || hunks.size === 0) continue;
      const fileIdx = Number(fileIdxStr);
      const file = files[fileIdx];
      if (!file) continue;
      const reasons = perFileRejectionReasons[fileIdx];
      const filePath = relativePath(file.rightPath || file.leftPath, rightPath || leftPath);
      const items = [...hunks].sort((a, b) => a - b).map(hunkIdx => ({
        hunk: hunkIdx,
        reason: reasons?.get(hunkIdx) || null,
      }));
      summary.push({ fileIdx, filePath, count: hunks.size, items });
    }
    return summary;
  }, [files, perFileRejectedHunks, perFileRejectionReasons, leftPath, rightPath]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (searchQuery != null) return;

      if (quitDialog) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setQuitDialog(null);
        }
        return;
      }

      switch (e.key) {
        case 'q':
        case 'Escape':
          e.preventDefault();
          requestClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [requestClose, searchQuery, quitDialog]);

  useEffect(() => {
    if (shellRef.current) shellRef.current.focus();
  }, []);

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
      <ContextHeader
        context={inputContext}
        channelConfigured={channelConfigured}
        rejectionBadges={rejectionBadges}
        viewedChanges={reviewedChanges}
        totalChanges={totalChanges}
        allViewed={allReviewed}
        onNavigateToRejection={navigateToRejection}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {draggingSidebar && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: 'col-resize' }} />
        )}
        {sidebarCollapsed ? (
          <div
            onClick={() => setSidebarCollapsed(false)}
            style={{
              width: '28px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              paddingTop: '8px',
              background: 'var(--bg-surface)',
              borderRight: '1px solid var(--border)',
              cursor: 'pointer',
            }}
            title="Show sidebar"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="12" height="12" rx="2" stroke="var(--text-muted)" strokeWidth="1.2" />
              <line x1="5" y1="1" x2="5" y2="13" stroke="var(--text-muted)" strokeWidth="1.2" />
            </svg>
          </div>
        ) : (
          <>
            <Sidebar
              tree={tree}
              files={files}
              currentIndex={currentIndex}
              viewed={viewed}
              rejectedFiles={rejectedFiles}
              onSelect={navigateTo}
              width={sidebarWidth}
              onCollapse={() => setSidebarCollapsed(true)}
              hiddenFiles={searchHiddenFiles}
            />
            <div
              onMouseDown={handleSidebarResizerMouseDown}
              style={{
                width: '4px',
                flexShrink: 0,
                cursor: 'col-resize',
                background: draggingSidebar ? 'var(--color-accent)' : 'transparent',
              }}
              onMouseEnter={(e) => { if (!draggingSidebar) e.currentTarget.style.background = 'var(--color-accent)'; }}
              onMouseLeave={(e) => { if (!draggingSidebar) e.currentTarget.style.background = 'transparent'; }}
            />
          </>
        )}
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
              leftFullPath={currentFile.leftPath}
              rightFullPath={currentFile.rightPath}
              leftContent={leftContent}
              rightContent={rightContent}
              onNavigateNext={navigateNext}
              onNavigatePrev={navigatePrev}
              onNavigatePrevFile={navigatePrevFile}
              startAtEnd={navigatedBackward}
              startAtHunk={targetHunk}
              reviewedHunks={currentReviewedHunks}
              onReviewedHunksChange={handleReviewedHunksChange}
              rejectedHunks={currentRejectedHunks}
              onRejectedHunksChange={handleRejectedHunksChange}
              rejectionReasons={currentRejectionReasons}
              onRejectionReasonsChange={handleRejectionReasonsChange}
              onSearchChange={handleSearchChange}
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
        currentFilePath={currentFile ? relativePath(currentFile.rightPath || currentFile.leftPath, rightPath || leftPath) : ''}
      />
      {quitDialog && (
        <QuitDialog
          mode={quitDialog.mode}
          rejectedCount={totalRejected}
          unreviewedCount={unreviewedCount}
          rejectionSummary={rejectionSummary}
          onCancel={() => setQuitDialog(null)}
          onSendReviewFeedback={() => closeWithExitCode(1)}
          onQuitAnyway={() => closeWithExitCode(2)}
          onApproveAnyway={() => closeWithExitCode(0)}
        />
      )}
    </div>
  );
}

function QuitDialog({ mode, rejectedCount, unreviewedCount, rejectionSummary, onCancel, onSendReviewFeedback, onQuitAnyway, onApproveAnyway }) {
  const dialogRef = useRef(null);

  const handleDialogKeyDown = (e) => {
    // Modal: swallow all keys so they don't reach the underlying diff view.
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key !== 'Tab' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const root = dialogRef.current;
    if (!root) return;
    const buttons = Array.from(root.querySelectorAll('button'));
    if (buttons.length === 0) return;
    e.preventDefault();
    const currentIdx = buttons.indexOf(document.activeElement);
    const dir = (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) ? -1 : 1;
    const nextIdx = currentIdx === -1
      ? (dir === 1 ? 0 : buttons.length - 1)
      : (currentIdx + dir + buttons.length) % buttons.length;
    buttons[nextIdx].focus();
  };

  const overlay = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    fontFamily: 'var(--font-ui)',
  };
  const dialog = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '20px 24px',
    minWidth: '420px',
    maxWidth: '640px',
    color: 'var(--text-primary)',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
  };
  const heading = { margin: '0 0 12px 0', fontSize: '15px', fontWeight: 600 };
  const body = { fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' };
  const buttonRow = { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' };
  const baseBtn = {
    fontFamily: 'inherit',
    fontSize: '13px',
    padding: '6px 14px',
    borderRadius: '4px',
    border: '1px solid var(--border)',
    background: 'var(--bg-deep)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
  };
  const primaryBtn = { ...baseBtn, background: 'var(--color-accent)', borderColor: 'var(--color-accent)', color: 'var(--bg-deep)', fontWeight: 600 };

  if (mode === 'rejected') {
    return (
      <div style={overlay} onClick={onCancel}>
        <div ref={dialogRef} style={dialog} onClick={(e) => e.stopPropagation()} onKeyDown={handleDialogKeyDown} role="dialog" aria-modal="true">
          <h2 style={heading}>Review feedback</h2>
          <div style={body}>
            {rejectedCount} rejected change{rejectedCount === 1 ? '' : 's'} across {rejectionSummary.length} file{rejectionSummary.length === 1 ? '' : 's'}.
          </div>
          <div style={{ maxHeight: '320px', overflow: 'auto', border: '1px solid var(--border)', borderRadius: '4px', padding: '10px 12px', background: 'var(--bg-deep)' }}>
            {rejectionSummary.map(({ fileIdx, filePath, count, items }) => (
              <div key={fileIdx} style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {filePath} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({count})</span>
                </div>
                <ul style={{ margin: '4px 0 0 0', paddingLeft: '18px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {items.map(({ hunk, reason }) => (
                    <li key={hunk}>
                      hunk {hunk + 1}{reason ? `: ${reason}` : ' (no reason)'}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div style={buttonRow}>
            <button style={baseBtn} onClick={onCancel}>Cancel</button>
            <button style={primaryBtn} onClick={onSendReviewFeedback} autoFocus>Send review feedback</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={overlay} onClick={onCancel}>
      <div ref={dialogRef} style={dialog} onClick={(e) => e.stopPropagation()} onKeyDown={handleDialogKeyDown} role="dialog" aria-modal="true">
        <h2 style={heading}>Quit?</h2>
        <div style={body}>
          {unreviewedCount} unreviewed change{unreviewedCount === 1 ? '' : 's'} remaining.
        </div>
        <div style={buttonRow}>
          <button style={baseBtn} onClick={onCancel}>Cancel</button>
          <button style={baseBtn} onClick={onApproveAnyway}>Approve anyway</button>
          <button style={primaryBtn} onClick={onQuitAnyway} autoFocus>Quit anyway</button>
        </div>
      </div>
    </div>
  );
}

export default ReviewShell;
