import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Sidebar from './Sidebar.jsx';
import FileDiffView from './FileDiffView.jsx';
import FileNavbar from './FileNavbar.jsx';
import ContextHeader, { hasExpandableDetails, commitMessageOf, MessageEditTextarea, splitMessage } from './ContextHeader.jsx';
import KeyboardHelp from './KeyboardHelp.jsx';
import { computeLineChanges, countDisplayHunks, computeContentLineStats, BINARY_SENTINEL } from '../engine/diff.js';
import { DEFAULT_ACTION, isBlocking, commentToOutput, actionLabel, actionChipStyle, cycleAction } from '../engine/comments.js';

const emptySet = new Set();

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
  const [targetRow, setTargetRow] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [hunkCounts, setHunkCounts] = useState({});
  const [lineStats, setLineStats] = useState({});
  const [perFileReviewedHunks, setPerFileReviewedHunks] = useState({});
  const shellRef = useRef(null);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [draggingSidebar, setDraggingSidebar] = useState(false);
  const [fileContents, setFileContents] = useState({});
  // BF-03: file keys the reviewer forced to text comparison, overriding the
  // binary verdict for the residual case where a real NUL sits in the first
  // 8000 bytes (the detection heuristic's blind spot).
  const [forcedTextKeys, setForcedTextKeys] = useState(() => new Set());
  const [quitDialog, setQuitDialog] = useState(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // CO-01: one list of comments, each { id, body, action, target }. target is
  // { type:'changeset' } | { type:'file', file } | { type:'range', file,
  // startLine, endLine, startRow, endRow }. The row fields anchor the inline
  // bar; the line fields are what reaches the sidecar (commentToOutput).
  const [comments, setComments] = useState([]);
  const [commentsPanelOpen, setCommentsPanelOpen] = useState(false);
  const commentIdRef = useRef(0);
  // CO-10: the reviewer's edited commit message (null until they edit it).
  // Editing the message as prose is lower-friction than describing the change
  // as a series of comments; the edited text rides back through the sidecar.
  const originalMessage = useMemo(() => commitMessageOf(inputContext), [inputContext]);
  const [editedMessage, setEditedMessage] = useState(null);

  const totalLineStats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const s of Object.values(lineStats)) {
      added += s.added;
      removed += s.removed;
    }
    return { added, removed };
  }, [lineStats]);

  // Gate the d/D keys on the same predicate ContextHeader uses for its expand
  // affordance, so the keyboard toggle and the on-screen button agree. Expanding
  // always reveals at least the commit-message annotation control (CO-09), so a
  // present input title is enough on its own.
  const hasDetails = useMemo(
    () => hasExpandableDetails(inputContext) || totalLineStats.added > 0 || totalLineStats.removed > 0,
    [inputContext, totalLineStats],
  );

  const toggleDetails = useCallback(() => setDetailsExpanded(v => !v), []);

  // CO-06: create a comment. `partial` carries body / action / target overrides;
  // a bare call seeds a `fix-now` changeset comment (DEFAULT_ACTION) to type into.
  const addComment = useCallback((partial = {}) => {
    const id = ++commentIdRef.current;
    setComments(prev => [...prev, {
      id,
      body: partial.body ?? '',
      action: partial.action ?? DEFAULT_ACTION,
      target: partial.target ?? { type: 'changeset' },
    }]);
    return id;
  }, []);

  const updateComment = useCallback((id, patch) => {
    setComments(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const setCommentAction = useCallback((id, action) => {
    setComments(prev => prev.map(c => (c.id === id ? { ...c, action } : c)));
  }, []);

  const deleteComment = useCallback((id) => {
    setComments(prev => prev.filter(c => c.id !== id));
  }, []);

  // NV-19: open the comments panel to manage existing comments (list / edit /
  // action / delete). Adding is done from each target's own surface — the panel
  // is no longer a target picker (CO-08).
  const openComments = useCallback(() => {
    setCommentsPanelOpen(true);
  }, []);

  // Prune empty-body comments when the panel closes so a seeded-but-unused
  // changeset / file comment vanishes (CO-08 delete is otherwise explicit).
  const closeComments = useCallback(() => {
    setComments(prev => prev.filter(c => (c.body || '').trim()));
    setCommentsPanelOpen(false);
  }, []);

  // CO-05: add a comment on the overall changeset, then open the panel to type
  // it. The target is inferred from the surface (the change-region control or
  // the `c` key) — no picker.
  const addChangesetComment = useCallback(() => {
    addComment({ target: { type: 'changeset' } });
    setCommentsPanelOpen(true);
  }, [addComment]);

  // CO-05: add a comment on the current file, then open the panel to type it
  // (a file comment has no line anchor, so it is edited in the panel).
  const addFileComment = useCallback((fileKey) => {
    if (!fileKey) return;
    addComment({ target: { type: 'file', file: fileKey } });
    setCommentsPanelOpen(true);
  }, [addComment]);

  // CO-09: annotate the commit message. Expand the details pane so the message
  // is in view, then open the panel to type the comment (the message has no
  // line anchor, so it is edited in the panel like a file / changeset comment).
  const addMessageComment = useCallback(() => {
    addComment({ target: { type: 'commit-message' } });
    setDetailsExpanded(true);
    setCommentsPanelOpen(true);
  }, [addComment]);

  // The output-ready projection (IM.OUT-02a): drop ids / anchor rows and empty
  // bodies. Always written, even when empty.
  const outComments = useMemo(
    () => comments.map(commentToOutput).filter(c => c.body),
    [comments],
  );

  // The `output` section the sidecar carries (IM.OUT-02a plus the edited commit
  // message, IM.OUT-07). commitMessage is present only once the reviewer has
  // actually changed the text, so an untouched review omits it entirely.
  const outputPayload = useMemo(() => {
    const payload = { comments: outComments };
    if (editedMessage != null && editedMessage !== originalMessage) {
      payload.commitMessage = { original: originalMessage, edited: editedMessage };
    }
    return payload;
  }, [outComments, editedMessage, originalMessage]);

  // CO-09: the comments annotating the commit message — rendered inline in the
  // expanded details pane so the annotations sit next to the message.
  const messageComments = useMemo(
    () => comments.filter(c => c.target?.type === 'commit-message'),
    [comments],
  );

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
      const stats = {};
      for (let i = 0; i < entries.length; i++) {
        contents[i] = entries[i];
        counts[i] = hunkCountFor(entries[i].left, entries[i].right);
        stats[i] = computeContentLineStats(entries[i].left, entries[i].right);
      }
      setHunkCounts(counts);
      setFileContents(contents);
      setLineStats(stats);
    })();
    return () => { cancelled = true; };
  }, [api, files]);

  const currentFile = files[currentIndex] || null;
  const currentFileKey = currentFile ? (currentFile.rightPath || currentFile.leftPath) : null;

  const currentForcedText = currentFileKey != null && forcedTextKeys.has(currentFileKey);

  // Prefer the prefetched content; fall back to a direct read if a file is
  // selected before the startup prefetch has populated this index. A file the
  // reviewer forced to text (BF-03) is always re-read with asText so the binary
  // verdict is bypassed — the cached content is the pre-force binary sentinel.
  useEffect(() => {
    if (!currentFile) return;
    const cached = fileContents[currentIndex];
    if (cached && !currentForcedText) {
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
        currentFile.leftPath ? api.readFile(currentFile.leftPath, currentForcedText) : Promise.resolve(''),
        currentFile.rightPath ? api.readFile(currentFile.rightPath, currentForcedText) : Promise.resolve(''),
      ]);
      if (cancelled) return;
      setLeftContent(left);
      setRightContent(right);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [currentFile, currentIndex, fileContents, api, currentForcedText]);

  // BF-03: force the current file to text comparison. Re-reading as text and
  // folding the result back into the prefetch caches means the hunk counter and
  // review tracking treat it as the text file it now is, not a binary blob
  // (which reports zero hunks).
  const forceCurrentAsText = useCallback(() => {
    if (!api || !currentFile || currentFileKey == null) return;
    setForcedTextKeys(prev => {
      if (prev.has(currentFileKey)) return prev;
      const next = new Set(prev);
      next.add(currentFileKey);
      return next;
    });
    (async () => {
      const [left, right] = await Promise.all([
        currentFile.leftPath ? api.readFile(currentFile.leftPath, true) : Promise.resolve(''),
        currentFile.rightPath ? api.readFile(currentFile.rightPath, true) : Promise.resolve(''),
      ]);
      const idx = currentIndex;
      setFileContents(prev => ({ ...prev, [idx]: { left, right } }));
      setHunkCounts(prev => ({ ...prev, [idx]: hunkCountFor(left, right) }));
      setLineStats(prev => ({ ...prev, [idx]: computeContentLineStats(left, right) }));
    })();
  }, [api, currentFile, currentFileKey, currentIndex]);

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
    setTargetRow(null);
    setCurrentIndex(index);
  }, [files.length]);

  // IM.OUT-03: jump to a file's first fix-now comment (its anchor row).
  const navigateToFixNow = useCallback((fileIndex) => {
    if (fileIndex < 0 || fileIndex >= files.length) return;
    const key = files[fileIndex].rightPath || files[fileIndex].leftPath;
    const rows = comments
      .filter(c => isBlocking(c.action) && c.target?.type === 'range' && c.target.file === key)
      .map(c => c.target.startRow ?? 0);
    setTargetRow(rows.length ? Math.min(...rows) : null);
    setCurrentIndex(fileIndex);
  }, [files, comments]);

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

  // The range comments anchored in the current file — FileDiffView renders these
  // as inline bars and owns their editing.
  const currentFileComments = useMemo(
    () => comments.filter(c => c.target?.type === 'range' && c.target.file === currentFileKey),
    [comments, currentFileKey],
  );

  const fixNowComments = useMemo(() => comments.filter(c => isBlocking(c.action) && (c.body || '').trim()), [comments]);
  const totalFixNow = fixNowComments.length;

  // RV-04: files carrying a fix-now comment go red in the sidebar.
  const fixNowFiles = useMemo(() => {
    const paths = new Set(fixNowComments.map(c => c.target?.file).filter(Boolean));
    const set = new Set();
    files.forEach((file, i) => {
      if (paths.has(file.rightPath || file.leftPath)) set.add(i);
    });
    return set;
  }, [fixNowComments, files]);

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

  // IM.OUT-03: one badge per file with fix-now comments, in the header.
  const fixNowBadges = useMemo(() => {
    const counts = new Map();
    for (const c of fixNowComments) {
      const f = c.target?.file;
      if (f) counts.set(f, (counts.get(f) || 0) + 1);
    }
    const badges = [];
    files.forEach((file, i) => {
      const key = file.rightPath || file.leftPath;
      if (counts.has(key)) {
        badges.push({ fileIndex: i, count: counts.get(key), name: (key || '').split('/').pop() });
      }
    });
    return badges;
  }, [fixNowComments, files]);

  useEffect(() => {
    if (!hunkCountingDone && files.length > 0) {
      window.__moorQuitState = { noInteraction: true, fixNow: 0, unreviewed: files.length, comments: [] };
      return () => { window.__moorQuitState = null; };
    }
    const unreviewed = Math.max(0, totalChanges - reviewedChanges);
    window.__moorQuitState = {
      fixNow: totalFixNow,
      unreviewed,
      comments: outComments,
    };
    return () => { window.__moorQuitState = null; };
  }, [hunkCountingDone, files, totalChanges, reviewedChanges, totalFixNow, outComments]);

  useEffect(() => {
    if (!api?.writeOutput) return;
    // Coalesce rapid state changes (typing a comment body fires per-keystroke
    // effects) into one IPC write per frame.
    const handle = requestAnimationFrame(() => {
      api.writeOutput(outputPayload);
    });
    return () => cancelAnimationFrame(handle);
  }, [api, outputPayload]);

  const closeWithExitCode = useCallback((exitCode) => {
    if (window.moor?.forceClose) {
      window.moor.forceClose({ exitCode, ...outputPayload });
    } else {
      onClose();
    }
  }, [outputPayload, onClose]);

  const unreviewedCount = Math.max(0, totalChanges - reviewedChanges);

  const requestClose = useCallback(() => {
    // Any feedback at all (fix-now or advisory) routes through the send-feedback
    // dialog. Only a feedback-free close with unreviewed hunks gets the plain
    // quit-anyway prompt.
    if (outComments.length > 0) {
      setQuitDialog({ mode: 'feedback' });
    } else if (unreviewedCount > 0) {
      setQuitDialog({ mode: 'unreviewed' });
    } else {
      closeWithExitCode(0);
    }
  }, [outComments.length, unreviewedCount, closeWithExitCode]);

  // The top-bar verdict. Approve is the affirmative close: finalize clean (exit
  // 0), carrying any advisory comments. It is disabled while fix-now comments
  // block the change — resolving or dropping them is the way forward.
  const approveDisabled = totalFixNow > 0;
  const handleApprove = useCallback(() => {
    if (totalFixNow > 0) return;
    // Approving without having viewed everything is legitimate but easy to do by
    // accident — confirm first, showing how much was actually reviewed. A fully
    // reviewed changeset approves straight through.
    if (unreviewedCount > 0) {
      setQuitDialog({ mode: 'approve' });
    } else {
      closeWithExitCode(0);
    }
  }, [totalFixNow, unreviewedCount, closeWithExitCode]);

  // Reject requests changes, and a rejection needs an actionable reason. With
  // fix-now feedback already present, confirm and send it (EC-02, exit 1);
  // otherwise seed a blocking changeset comment and open the panel so the
  // reviewer states why before the review can finalize.
  const handleReject = useCallback(() => {
    if (totalFixNow > 0) {
      setQuitDialog({ mode: 'feedback' });
    } else {
      addComment({ action: 'fix-now', target: { type: 'changeset' } });
      setCommentsPanelOpen(true);
    }
  }, [totalFixNow, addComment]);

  useEffect(() => {
    window.__moorConfirmClose = requestClose;
    return () => {
      if (window.__moorConfirmClose === requestClose) {
        window.__moorConfirmClose = null;
      }
    };
  }, [requestClose]);

  // DD-12: the send-feedback dialog reveals every comment the author will
  // receive — fix-now and advisory alike — grouped by file, with the
  // changeset-level ones in their own bucket. Each item carries its action so
  // the reviewer sees the disposition, not just the text.
  const feedbackSummary = useMemo(() => {
    const groups = new Map();
    for (const c of comments) {
      const body = (c.body || '').trim();
      if (!body) continue;
      const t = c.target || {};
      let key, label;
      if (t.file) {
        key = t.file;
        label = relativePath(t.file, rightPath || leftPath);
      } else if (t.type === 'commit-message') {
        key = '__commit_message__';
        label = 'commit message';
      } else {
        key = '__changeset__';
        label = 'whole changeset';
      }
      if (!groups.has(key)) groups.set(key, { key, label, items: [] });
      groups.get(key).items.push({ id: c.id, body, action: c.action });
    }
    return [...groups.values()].map(g => ({ ...g, count: g.items.length }));
  }, [comments, leftPath, rightPath]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

      // Ignore keys chorded with a modifier — Cmd+F, Cmd+D, Cmd+=, etc. belong
      // to the OS / app menu.
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // NV-18: the help overlay takes precedence; ? or Escape dismisses it.
      if (helpOpen) {
        if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); setHelpOpen(false); }
        return;
      }
      if (e.key === '?') { e.preventDefault(); setHelpOpen(true); return; }

      if (commentsPanelOpen) {
        if (e.key === 'Escape') { e.preventDefault(); closeComments(); }
        return;
      }

      if (quitDialog) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setQuitDialog(null);
        }
        return;
      }

      switch (e.key) {
        case 'd': // NV-17: either casing toggles details
        case 'D':
          if (hasDetails) { e.preventDefault(); toggleDetails(); }
          break;
        case 'f': // DD-16: either casing toggles the file sidebar
        case 'F':
          e.preventDefault();
          setSidebarCollapsed(v => !v);
          break;
        case '=': // zoom in — no modifier required
        case '+':
          e.preventDefault();
          api?.zoomBy?.(1);
          break;
        case '-': // zoom out
        case '_':
          e.preventDefault();
          api?.zoomBy?.(-1);
          break;
        case '0': // reset zoom
          e.preventDefault();
          api?.zoomReset?.();
          break;
        case 'n': // NV-19: open the comments panel (manage)
        case 'N':
          e.preventDefault();
          openComments();
          break;
        case 'c': // NV-23: comment on the changeset (CO-05)
        case 'C':
          e.preventDefault();
          addChangesetComment();
          break;
        case 'm': // NV-22: comment on the commit message (CO-09)
        case 'M':
          e.preventDefault();
          addMessageComment();
          break;
        case 'q':
        case 'Escape':
          e.preventDefault();
          requestClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [requestClose, quitDialog, helpOpen, hasDetails, toggleDetails, api, commentsPanelOpen, openComments, closeComments, addChangesetComment, addMessageComment]);

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
        fixNowBadges={fixNowBadges}
        viewedChanges={reviewedChanges}
        totalChanges={totalChanges}
        allViewed={allReviewed}
        onNavigateToFixNow={navigateToFixNow}
        detailsExpanded={detailsExpanded}
        onToggleDetails={toggleDetails}
        lineStats={totalLineStats}
        messageComments={messageComments}
        onAddMessageComment={addMessageComment}
        originalMessage={originalMessage}
        editedMessage={editedMessage}
        onEditMessage={setEditedMessage}
        onAddChangesetComment={addChangesetComment}
        commentCount={outComments.length}
        onOpenComments={openComments}
        onApprove={handleApprove}
        onReject={handleReject}
        approveDisabled={approveDisabled}
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
              fixNowFiles={fixNowFiles}
              onSelect={navigateTo}
              width={sidebarWidth}
              onCollapse={() => setSidebarCollapsed(true)}
              fileStats={lineStats}
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
            <div style={contentMessageStyle('var(--text-muted)')}>Loading...</div>
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
              startAtRow={targetRow}
              reviewedHunks={currentReviewedHunks}
              onReviewedHunksChange={handleReviewedHunksChange}
              fileComments={currentFileComments}
              onAddComment={addComment}
              onUpdateComment={updateComment}
              onSetCommentAction={setCommentAction}
              onDeleteComment={deleteComment}
              onAddFileComment={addFileComment}
              onForceText={forceCurrentAsText}
              paused={helpOpen || commentsPanelOpen}
            />
          ) : (
            <div style={contentMessageStyle('var(--text-secondary)')}>No differences found</div>
          )}
        </div>
      </div>
      <FileNavbar
        currentFilePath={currentFile ? relativePath(currentFile.rightPath || currentFile.leftPath, rightPath || leftPath) : ''}
      />
      {quitDialog && (
        <QuitDialog
          mode={quitDialog.mode}
          fixNowCount={totalFixNow}
          unreviewedCount={unreviewedCount}
          feedbackSummary={feedbackSummary}
          originalMessage={originalMessage}
          editedMessage={editedMessage}
          onEditMessage={setEditedMessage}
          onCancel={() => setQuitDialog(null)}
          // Sending feedback keeps the spec's exit-code verdict: fix-now blocks
          // (1), otherwise unreviewed hunks signal incomplete (2), else clean (0).
          onSendReviewFeedback={() => closeWithExitCode(totalFixNow > 0 ? 1 : unreviewedCount > 0 ? 2 : 0)}
          onQuitAnyway={() => closeWithExitCode(2)}
          onApproveAnyway={() => closeWithExitCode(0)}
        />
      )}
      {commentsPanelOpen && (
        <CommentsPanel
          comments={comments}
          basePath={rightPath || leftPath}
          onUpdate={updateComment}
          onSetAction={setCommentAction}
          onDelete={deleteComment}
          onClose={closeComments}
        />
      )}
      {helpOpen && <KeyboardHelp onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

const contentMessageStyle = (color) => ({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color,
  fontFamily: 'var(--font-ui)',
});

// Shared dialog chrome (issue #6): the quit / feedback / approve modes render
// through one set of tokens so they read as a single finished surface.
const dialogStyles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'var(--overlay-scrim)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    fontFamily: 'var(--font-ui)',
  },
  dialog: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '20px 24px',
    minWidth: '420px',
    maxWidth: '640px',
    color: 'var(--text-primary)',
    boxShadow: 'var(--shadow-modal)',
  },
  heading: { margin: '0 0 10px 0', fontSize: '15px', fontWeight: 600, letterSpacing: '0.01em' },
  body: { fontSize: '13px', lineHeight: 1.5, color: 'var(--text-secondary)' },
  buttonRow: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' },
};

// A dialog button with hover feedback, so the button row reads as finished
// rather than flat. `variant` picks the emphasis; DD-14 keyboard nav still finds
// it (it renders a real <button>) and autoFocus / onClick pass straight through.
function DialogButton({ variant = 'default', children, style, ...props }) {
  const [hover, setHover] = useState(false);
  const base = {
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
    padding: '6px 14px',
    borderRadius: '4px',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    transition: 'background 0.12s ease, opacity 0.12s ease',
  };
  const variants = {
    default: { ...base, background: hover ? 'var(--bg-hover)' : 'var(--bg-deep)', color: 'var(--text-primary)' },
    primary: { ...base, background: 'var(--color-accent)', borderColor: 'var(--color-accent)', color: 'var(--bg-deep)', fontWeight: 600, opacity: hover ? 0.9 : 1 },
  };
  return (
    <button
      type="button"
      style={{ ...variants[variant], ...style }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...props}
    >{children}</button>
  );
}

// CO-10 at the approve gate (issue #6): the current commit message with an
// inline edit affordance, so the reviewer's last look before finalizing can
// also be their last chance to fix the message. Edits flow through the same
// onEditMessage path as the change-header editor (IM.OUT-07); reverting restores
// the original and drops the sidecar payload.
function ApproveMessagePanel({ originalMessage, editedMessage, onEditMessage }) {
  const [editing, setEditing] = useState(false);
  const effectiveMessage = editedMessage != null ? editedMessage : (originalMessage || '');
  const isEdited = editedMessage != null && editedMessage !== originalMessage;
  if (!effectiveMessage) return null;
  const { title, body } = splitMessage(effectiveMessage);

  const wrap = { border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--bg-deep)', padding: '10px 12px', marginTop: '4px' };
  const label = { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' };
  const labelText = { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' };
  const editedBadge = { padding: '1px 6px', borderRadius: '3px', background: 'var(--color-accent-bg)', border: '1px solid var(--color-accent-border)', color: 'var(--color-accent)', fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' };
  const chip = { display: 'inline-flex', alignItems: 'center', background: 'transparent', border: '1px solid var(--color-accent-border)', color: 'var(--color-accent)', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '3px', cursor: 'pointer' };
  const subject = { fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' };
  const bodyText = { fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.55, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '4px 0 0 0', maxHeight: '160px', overflow: 'auto' };

  return (
    <div style={wrap}>
      <div style={label}>
        <span style={labelText}>commit message</span>
        {isEdited && <span style={editedBadge}>edited</span>}
        <span style={{ flex: 1 }} />
        {!editing && (
          <button type="button" style={chip} onClick={() => setEditing(true)} title="Edit the commit message directly">✎ edit</button>
        )}
        {isEdited && !editing && (
          <button type="button" style={chip} onClick={() => onEditMessage?.(null)} title="Discard your edits and restore the original message">revert</button>
        )}
      </div>
      {editing ? (
        <MessageEditTextarea
          defaultValue={effectiveMessage}
          onSave={(text) => { onEditMessage?.(text); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <div style={subject}>{title}</div>
          {body && <div style={bodyText}>{body}</div>}
        </>
      )}
    </div>
  );
}

function QuitDialog({ mode, fixNowCount, unreviewedCount, feedbackSummary, originalMessage, editedMessage, onEditMessage, onCancel, onSendReviewFeedback, onQuitAnyway, onApproveAnyway }) {
  const dialogRef = useRef(null);

  const handleDialogKeyDown = (e) => {
    // Modal: swallow all keys so they don't reach the underlying diff view.
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }
    // While the message editor is focused, Tab / arrows belong to the textarea
    // (indent, caret movement), not the dialog's button cycle (DD-14).
    if (e.target.tagName === 'TEXTAREA') return;
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

  const { overlay, dialog, heading, body, buttonRow } = dialogStyles;

  if (mode === 'approve') {
    return (
      <div style={overlay} onClick={onCancel}>
        <div ref={dialogRef} style={dialog} onClick={(e) => e.stopPropagation()} onKeyDown={handleDialogKeyDown} role="dialog" aria-modal="true">
          <h2 style={heading}>Approve without viewing everything?</h2>
          <div style={body}>
            You have {unreviewedCount} unreviewed hunk{unreviewedCount === 1 ? '' : 's'}.
            Resuming picks up where you left off; approving now finalizes the review as clean.
          </div>
          <ApproveMessagePanel originalMessage={originalMessage} editedMessage={editedMessage} onEditMessage={onEditMessage} />
          {/* The low-friction default is to keep reviewing (primary + focused):
              finalizing a review you haven't finished should take the extra,
              deliberate reach for the secondary action. */}
          <div style={buttonRow}>
            <DialogButton onClick={onApproveAnyway}>Approve anyway</DialogButton>
            <DialogButton variant="primary" onClick={onCancel} autoFocus>Resume review</DialogButton>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'feedback') {
    const totalComments = feedbackSummary.reduce((n, g) => n + g.count, 0);
    const summaryLine = fixNowCount > 0
      ? `${fixNowCount} fix-now comment${fixNowCount === 1 ? '' : 's'} of ${totalComments} total across ${feedbackSummary.length} location${feedbackSummary.length === 1 ? '' : 's'}.`
      : `${totalComments} comment${totalComments === 1 ? '' : 's'} across ${feedbackSummary.length} location${feedbackSummary.length === 1 ? '' : 's'}.`;
    return (
      <div style={overlay} onClick={onCancel}>
        <div ref={dialogRef} style={dialog} onClick={(e) => e.stopPropagation()} onKeyDown={handleDialogKeyDown} role="dialog" aria-modal="true">
          <h2 style={heading}>Review feedback</h2>
          <div style={{ ...body, marginBottom: '12px' }}>{summaryLine}</div>
          <div style={{ maxHeight: '320px', overflow: 'auto', border: '1px solid var(--border)', borderRadius: '4px', padding: '10px 12px', background: 'var(--bg-deep)' }}>
            {feedbackSummary.map(({ key, label, count, items }) => (
              <div key={key} style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({count})</span>
                </div>
                <ul style={{ margin: '4px 0 0 0', paddingLeft: '18px', fontSize: '12px', color: 'var(--text-secondary)', listStyle: 'none' }}>
                  {items.map(({ id, body: itemBody, action }) => (
                    <li key={id} style={{ display: 'flex', gap: '6px', alignItems: 'baseline', marginBottom: '3px' }}>
                      <span style={actionChipStyle(action, { flexShrink: 0, fontSize: '9px', letterSpacing: '0.06em', padding: '1px 5px' })}>{actionLabel(action)}</span>
                      <span>{itemBody || '(no description)'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div style={buttonRow}>
            <DialogButton onClick={onCancel}>Cancel</DialogButton>
            {fixNowCount === 0 && unreviewedCount > 0 && (
              <DialogButton onClick={onApproveAnyway}>Approve anyway</DialogButton>
            )}
            <DialogButton variant="primary" onClick={onSendReviewFeedback} autoFocus>Send review feedback</DialogButton>
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
          You have {unreviewedCount} unreviewed hunk{unreviewedCount === 1 ? '' : 's'} remaining.
        </div>
        <div style={buttonRow}>
          <DialogButton onClick={onCancel}>Cancel</DialogButton>
          <DialogButton onClick={onApproveAnyway}>Approve anyway</DialogButton>
          <DialogButton variant="primary" onClick={onQuitAnyway} autoFocus>Quit anyway</DialogButton>
        </div>
      </div>
    </div>
  );
}

function targetLabel(comment, basePath) {
  const t = comment.target || {};
  if (t.type === 'range') {
    const loc = t.startLine === t.endLine ? `:${t.startLine}` : `:${t.startLine}-${t.endLine}`;
    return `${relativePath(t.file, basePath)}${loc}`;
  }
  if (t.type === 'file') return relativePath(t.file, basePath);
  if (t.type === 'commit-message') return 'commit message';
  return 'changeset';
}

// CO-08: the comments panel manages every comment (changeset / commit message /
// file / range) — its target, body, and action. Editing is inline; the action
// chip cycles consider → fix-later → fix-now; deleting confirms first. Adding is
// done from each target's own surface, so the panel is not a target picker.
function CommentsPanel({ comments, basePath, onUpdate, onSetAction, onDelete, onClose }) {
  const [confirmingId, setConfirmingId] = useState(null);
  const lastRef = useRef(null);

  useEffect(() => {
    if (lastRef.current) {
      lastRef.current.focus();
      const len = lastRef.current.value.length;
      lastRef.current.setSelectionRange(len, len);
    }
  }, [comments.length]);

  const overlay = {
    position: 'fixed',
    inset: 0,
    background: 'var(--overlay-scrim)',
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
    minWidth: '520px',
    maxWidth: '680px',
    color: 'var(--text-primary)',
    boxShadow: 'var(--shadow-modal)',
  };
  const heading = { margin: '0 0 6px 0', fontSize: '15px', fontWeight: 600 };
  const sub = { fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' };
  const list = { display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '50vh', overflow: 'auto', margin: '12px 0' };
  const card = { border: '1px solid var(--border)', borderRadius: '4px', padding: '8px 10px', background: 'var(--bg-deep)' };
  const cardTop = { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', minHeight: '18px' };
  const locStyle = { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-right)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
  const footer = { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px' };
  const baseBtn = {
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
    padding: '6px 14px',
    borderRadius: '4px',
    border: '1px solid var(--border)',
    background: 'var(--bg-deep)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
  };
  const primaryBtn = { ...baseBtn, background: 'var(--color-accent)', borderColor: 'var(--color-accent)', color: 'var(--bg-deep)', fontWeight: 600 };
  const xBtn = { background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: '0 2px' };
  const confirmBtn = { ...baseBtn, padding: '2px 8px', fontSize: '11px', color: 'var(--color-conflict)', borderColor: 'var(--color-conflict)' };
  const keepBtn = { ...baseBtn, padding: '2px 8px', fontSize: '11px' };

  const textareaStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '6px 8px',
    fontSize: '13px',
    fontFamily: 'var(--font-ui)',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: '3px',
    outline: 'none',
    resize: 'vertical',
  };

  const actionChip = (action) => actionChipStyle(action, { cursor: 'pointer' });

  return (
    <div style={overlay} onClick={onClose}>
      <div
        style={dialog}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') onClose(); }}
        role="dialog"
        aria-modal="true"
      >
        <h2 style={heading}>Comments</h2>
        <div style={sub}>Feedback for the author. Set an action — only <strong>fix now</strong> blocks shipping.</div>
        <div style={list}>
          {comments.length === 0 && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 0' }}>
              No comments yet — add one from a line (Space), the file header, the commit message (<kbd>m</kbd>), or the changeset (<kbd>c</kbd>).
            </div>
          )}
          {comments.map((c, i) => (
            <div key={c.id} style={card}>
              <div style={cardTop}>
                <span style={locStyle}>{targetLabel(c, basePath)}</span>
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  style={actionChip(c.action)}
                  title="Cycle action: consider → fix later → fix now"
                  onClick={() => onSetAction(c.id, cycleAction(c.action))}
                >{actionLabel(c.action)}</button>
                {confirmingId === c.id ? (
                  <>
                    <button type="button" style={confirmBtn} onClick={() => onDelete(c.id)}>Delete</button>
                    <button type="button" style={keepBtn} onClick={() => setConfirmingId(null)}>Keep</button>
                  </>
                ) : (
                  <button type="button" style={xBtn} title="Delete comment" onClick={() => setConfirmingId(c.id)}>✕</button>
                )}
              </div>
              <textarea
                ref={i === comments.length - 1 ? lastRef : null}
                value={c.body}
                onChange={(e) => onUpdate(c.id, { body: e.target.value })}
                // TE-01: Enter activates the panel's primary action (Done);
                // Shift+Enter inserts a newline. Escape is handled by the dialog.
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onClose();
                  }
                }}
                rows={2}
                placeholder="Comment for the author…"
                style={textareaStyle}
              />
            </div>
          ))}
        </div>
        <div style={footer}>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
            Enter to finish · Shift+Enter newline
          </span>
          <button type="button" style={primaryBtn} onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

export default ReviewShell;
