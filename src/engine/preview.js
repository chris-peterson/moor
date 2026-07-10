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

// A GFM pipe-table row splits on unescaped `|`, dropping the optional leading
// and trailing pipe. Cells are already HTML-escaped, so a literal `|` in source
// text would arrive as `|` — table columns win over inline pipes, matching GFM.
function splitTableRow(line) {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  return trimmed.split('|').map(c => c.trim());
}

// The delimiter row under a table header: each cell is dashes with optional
// leading/trailing colons marking alignment (`:--` left, `:-:` center, `--:`
// right). Its presence is what promotes the preceding line from a paragraph
// with pipes into a table.
function parseTableDelimiter(line) {
  if (!/\|/.test(line)) return null;
  const cells = splitTableRow(line);
  const aligns = [];
  for (const cell of cells) {
    if (!/^:?-+:?$/.test(cell)) return null;
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    aligns.push(right && left ? 'center' : right ? 'right' : left ? 'left' : null);
  }
  return aligns.length ? aligns : null;
}

function renderTable(headerLine, aligns, bodyLines) {
  const cellHtml = (text, align, tag) => {
    const style = align ? ` style="text-align:${align}"` : '';
    return `<${tag}${style}>${renderInline(text)}</${tag}>`;
  };
  const header = splitTableRow(headerLine);
  const head = `<thead><tr>${header.map((c, i) => cellHtml(c, aligns[i], 'th')).join('')}</tr></thead>`;
  const rows = bodyLines.map(line => {
    const cells = splitTableRow(line);
    // Normalize each row to the header's column count (GFM: extra cells are
    // dropped, missing cells render empty).
    const tds = header.map((_, i) => cellHtml(cells[i] ?? '', aligns[i], 'td'));
    return `<tr>${tds.join('')}</tr>`;
  }).join('');
  return `<table>${head}<tbody>${rows}</tbody></table>`;
}

// A line-oriented Markdown subset: ATX headings, fenced code blocks, GFM pipe
// tables, unordered and ordered lists, blockquotes, horizontal rules, and
// paragraphs, with inline spans inside each. The source is HTML-escaped up
// front so embedded HTML (a raw <script>, an onerror attribute) renders as
// visible text rather than live markup. A ```mermaid fence is emitted as an
// inert placeholder (data-mermaid) carrying its source; the renderer turns it
// into an SVG diagram before display (BF-04), keeping this function pure and
// synchronous.
export function renderMarkdown(source) {
  const lines = escapeHtml(source ?? '').split('\n');
  const blocks = [];
  let paragraph = [];
  let listItems = null;
  let listOrdered = false;

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

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const fence = line.match(/^\s*```\s*(\S*)/);
    if (fence) {
      flushParagraph();
      flushList();
      const lang = fence[1];
      const fenceLines = [];
      li++;
      while (li < lines.length && !/^\s*```/.test(lines[li])) {
        fenceLines.push(lines[li]);
        li++;
      }
      // li now rests on the closing fence (or past the end for an unterminated
      // block); the loop's own li++ steps past it.
      if (lang.toLowerCase() === 'mermaid') {
        blocks.push(`<div class="mermaid-diagram" data-mermaid>${fenceLines.join('\n')}</div>`);
      } else {
        blocks.push(`<pre><code>${fenceLines.join('\n')}</code></pre>`);
      }
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

    // A table is a header row immediately followed by a delimiter row; without
    // the delimiter the line is just a paragraph that happens to contain pipes.
    if (/\|/.test(line) && li + 1 < lines.length) {
      const aligns = parseTableDelimiter(lines[li + 1]);
      if (aligns) {
        flushParagraph();
        flushList();
        const bodyLines = [];
        let bi = li + 2;
        while (bi < lines.length && lines[bi].trim() !== '' && /\|/.test(lines[bi])) {
          bodyLines.push(lines[bi]);
          bi++;
        }
        blocks.push(renderTable(line, aligns, bodyLines));
        li = bi - 1;
        continue;
      }
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

  flushParagraph();
  flushList();
  return blocks.join('\n');
}
