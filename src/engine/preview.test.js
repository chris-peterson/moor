import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { previewKindFor, renderMarkdown } from './preview.js';

describe('previewKindFor', () => {
  test('maps Markdown extensions', () => {
    assert.equal(previewKindFor('README.md'), 'markdown');
    assert.equal(previewKindFor('a/b/notes.markdown'), 'markdown');
    assert.equal(previewKindFor('UPPER.MD'), 'markdown');
  });

  test('maps SVG', () => {
    assert.equal(previewKindFor('icon.svg'), 'svg');
    assert.equal(previewKindFor('icon.SVG'), 'svg');
  });

  test('returns null for files without a visual representation', () => {
    assert.equal(previewKindFor('main.js'), null);
    assert.equal(previewKindFor('data.json'), null);
    assert.equal(previewKindFor('Makefile'), null);
    assert.equal(previewKindFor(''), null);
    assert.equal(previewKindFor(undefined), null);
  });
});

describe('renderMarkdown', () => {
  test('renders ATX headings at the right level', () => {
    assert.equal(renderMarkdown('# Title'), '<h1>Title</h1>');
    assert.equal(renderMarkdown('### Sub'), '<h3>Sub</h3>');
  });

  test('renders paragraphs, joining wrapped lines', () => {
    assert.equal(renderMarkdown('one\ntwo'), '<p>one two</p>');
  });

  test('separates paragraphs on a blank line', () => {
    assert.equal(renderMarkdown('a\n\nb'), '<p>a</p>\n<p>b</p>');
  });

  test('renders unordered and ordered lists', () => {
    assert.equal(renderMarkdown('- a\n- b'), '<ul><li>a</li><li>b</li></ul>');
    assert.equal(renderMarkdown('1. a\n2. b'), '<ol><li>a</li><li>b</li></ol>');
  });

  test('renders inline bold, italic, and code', () => {
    assert.equal(renderMarkdown('**b** *i* `c`'),
      '<p><strong>b</strong> <em>i</em> <code>c</code></p>');
  });

  test('renders links', () => {
    assert.equal(renderMarkdown('[moor](https://example.com)'),
      '<p><a href="https://example.com">moor</a></p>');
  });

  test('renders fenced code blocks verbatim, without inline parsing', () => {
    assert.equal(renderMarkdown('```\n**not bold**\n```'),
      '<pre><code>**not bold**</code></pre>');
  });

  test('renders blockquotes and horizontal rules', () => {
    assert.equal(renderMarkdown('> quoted'), '<blockquote>quoted</blockquote>');
    assert.equal(renderMarkdown('---'), '<hr>');
  });

  test('escapes embedded HTML so scripts cannot execute', () => {
    const html = renderMarkdown('<script>alert(1)</script>');
    assert.ok(!html.includes('<script>'), 'raw script tag must not survive');
    assert.ok(html.includes('&lt;script&gt;'), 'script source renders as text');
  });

  test('escapes HTML inside a heading', () => {
    const html = renderMarkdown('# <img src=x onerror=alert(1)>');
    assert.ok(!html.includes('<img'), 'raw img tag must not survive');
    assert.ok(html.includes('&lt;img'));
  });

  test('a literal digit between spaces is not mistaken for a code span', () => {
    assert.equal(renderMarkdown('there are 3 items'), '<p>there are 3 items</p>');
  });

  test('renders a GFM pipe table with a header and body', () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |';
    assert.equal(renderMarkdown(md),
      '<table><thead><tr><th>A</th><th>B</th></tr></thead>' +
      '<tbody><tr><td>1</td><td>2</td></tr><tr><td>3</td><td>4</td></tr></tbody></table>');
  });

  test('applies column alignment from the delimiter row', () => {
    const md = '| L | C | R |\n|:--|:-:|--:|\n| a | b | c |';
    const html = renderMarkdown(md);
    assert.ok(html.includes('<th style="text-align:left">L</th>'));
    assert.ok(html.includes('<th style="text-align:center">C</th>'));
    assert.ok(html.includes('<th style="text-align:right">R</th>'));
  });

  test('normalizes ragged rows to the header column count', () => {
    const md = '| A | B |\n|---|---|\n| only-one |';
    const html = renderMarkdown(md);
    assert.ok(html.includes('<tr><td>only-one</td><td></td></tr>'), html);
  });

  test('a pipe line without a delimiter row stays a paragraph', () => {
    assert.equal(renderMarkdown('a | b | c'), '<p>a | b | c</p>');
  });

  test('renders inline spans inside table cells', () => {
    const md = '| H |\n|---|\n| **bold** |';
    const html = renderMarkdown(md);
    assert.ok(html.includes('<td><strong>bold</strong></td>'), html);
  });

  test('emits a mermaid fence as an inert placeholder carrying its source', () => {
    const md = '```mermaid\ngraph TD\nA-->B\n```';
    const html = renderMarkdown(md);
    assert.equal(html, '<div class="mermaid-diagram" data-mermaid>graph TD\nA--&gt;B</div>');
    assert.ok(!html.includes('<pre>'), 'a mermaid fence is not a code block');
  });

  test('a non-mermaid fence with a language is still a code block', () => {
    assert.equal(renderMarkdown('```js\nconst x = 1;\n```'),
      '<pre><code>const x = 1;</code></pre>');
  });
});
