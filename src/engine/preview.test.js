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
});
