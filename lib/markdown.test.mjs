import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { mapImageSrc, renderMarkdown } from './markdown.mjs';

test('mapImageSrc rewrites known attachment refs and keeps everything else', () => {
  const attachments = [
    { logicalPath: '_attachments/foo.png', artifactPath: 'attachments/abc123.png' },
  ];
  assert.equal(mapImageSrc('_attachments/foo.png', attachments), '/attachments/abc123.png');
  assert.equal(mapImageSrc('https://example.com/x.png', attachments), 'https://example.com/x.png');
  assert.equal(mapImageSrc('_attachments/missing.png', []), '_attachments/missing.png');
  assert.equal(mapImageSrc(undefined, attachments), undefined);
});

test('renderMarkdown renders GFM tables, highlighted code, raw details/summary, and rewrites images', () => {
  const md = [
    '| a | b |',
    '| - | - |',
    '| 1 | 2 |',
    '',
    '```js',
    'const x = 1',
    '```',
    '',
    '<details><summary>展开</summary>内容</details>',
    '',
    '![img](_attachments/foo.png)',
  ].join('\n');
  const attachments = [
    { logicalPath: '_attachments/foo.png', artifactPath: 'attachments/abc123.png' },
  ];
  const html = renderToStaticMarkup(renderMarkdown(md, attachments));

  assert.ok(html.includes('<table>'), 'GFM table rendered');
  assert.ok(html.includes('hljs'), 'code block highlighted');
  assert.ok(html.includes('<details>') && html.includes('<summary>'), 'raw details/summary rendered');
  assert.ok(html.includes('src="/attachments/abc123.png"'), 'image rewritten to content-addressed URL');
});

test('renderMarkdown strips non-whitelisted raw HTML', () => {
  const md = '<script>alert(1)</script>\n\n<iframe src="https://evil.example"></iframe>\n\n正常段落';
  const html = renderToStaticMarkup(renderMarkdown(md, []));
  assert.ok(!html.includes('<script>'), 'script stripped');
  assert.ok(!html.includes('<iframe'), 'iframe stripped');
  assert.ok(html.includes('正常段落'), 'text preserved');
});

test('renderMarkdown keeps code fences intact (no HTML interpretation inside them)', () => {
  const md = [
    '```jsx',
    '<div className="top-level" onClick={() => {}} />',
    '```',
  ].join('\n');
  const html = renderToStaticMarkup(renderMarkdown(md, []));
  assert.ok(html.includes('&lt;div'), 'code content escaped, not rendered as HTML');
});
