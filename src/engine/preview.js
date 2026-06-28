// FUT-01 / BF-02: rendered preview for files that carry a visual
// representation alongside their source. previewKindFor maps a path to the
// preview it supports; renderMarkdown turns Markdown source into HTML. SVG
// needs no transform — the browser renders the source markup directly — so it
// has a kind here but no render function.

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd']);
const SVG_EXTENSIONS = new Set(['.svg']);

function extensionOf(path) {
  if (!path) return '';
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot === -1 ? '' : base.slice(dot).toLowerCase();
}

export function previewKindFor(path) {
  const ext = extensionOf(path);
  if (MARKDOWN_EXTENSIONS.has(ext)) return 'markdown';
  if (SVG_EXTENSIONS.has(ext)) return 'svg';
  return null;
}

function escapeHtml(str) {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// A sentinel that escaped text can't contain — markdown is UTF-8 text already
// confirmed free of null bytes (the binary check rejects those upstream), so a
// NUL placeholder for extracted code spans never collides with real content.
const CODE_SENTINEL = String.fromCharCode(0);
const CODE_SPAN_RE = new RegExp(`${CODE_SENTINEL}(\\d+)${CODE_SENTINEL}`, 'g');

// Inline spans: code, links, bold, italic. The input is already HTML-escaped,
// so the markup characters this matches (`*`, backtick, `[`) are literal
// source, and any HTML in the source survives as inert escaped text. Code spans
// are pulled out first so their contents aren't reinterpreted as bold/italic.
function renderInline(text) {
  const codeSpans = [];
  let out = text.replace(/`([^`]+)`/g, (_, code) => {
    codeSpans.push(code);
    return `${CODE_SENTINEL}${codeSpans.length - 1}${CODE_SENTINEL}`;
  });
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) =>
    `<a href="${href}">${label}</a>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(CODE_SPAN_RE, (_, i) => `<code>${codeSpans[Number(i)]}</code>`);
  return out;
}

// A line-oriented Markdown subset: ATX headings, fenced code blocks, unordered
// and ordered lists, blockquotes, horizontal rules, and paragraphs, with inline
// spans inside each. The source is HTML-escaped up front so embedded HTML
// (a raw <script>, an onerror attribute) renders as visible text rather than
// live markup.
export function renderMarkdown(source) {
  const lines = escapeHtml(source ?? '').split('\n');
  const blocks = [];
  let paragraph = [];
  let listItems = null;
  let listOrdered = false;
  let inFence = false;
  let fenceLines = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (listItems) {
      const tag = listOrdered ? 'ol' : 'ul';
      blocks.push(`<${tag}>${listItems.map(i => `<li>${renderInline(i)}</li>`).join('')}</${tag}>`);
      listItems = null;
    }
  };

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      if (inFence) {
        blocks.push(`<pre><code>${fenceLines.join('\n')}</code></pre>`);
        fenceLines = [];
        inFence = false;
      } else {
        flushParagraph();
        flushList();
        inFence = true;
      }
      continue;
    }
    if (inFence) {
      fenceLines.push(line);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      blocks.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
      continue;
    }

    if (/^\s*([-*_])\1\1+\s*$/.test(line)) {
      flushParagraph();
      flushList();
      blocks.push('<hr>');
      continue;
    }

    const quote = line.match(/^&gt;\s?(.*)$/);
    if (quote) {
      flushParagraph();
      flushList();
      blocks.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (unordered || ordered) {
      flushParagraph();
      const ordItem = Boolean(ordered);
      if (listItems && listOrdered !== ordItem) flushList();
      if (!listItems) { listItems = []; listOrdered = ordItem; }
      listItems.push((unordered || ordered)[1]);
      continue;
    }

    if (line.trim() === '') {
      flushParagraph();
      flushList();
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  if (inFence) blocks.push(`<pre><code>${fenceLines.join('\n')}</code></pre>`);
  flushParagraph();
  flushList();
  return blocks.join('\n');
}
