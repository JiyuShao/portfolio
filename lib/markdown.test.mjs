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

test('renderMarkdown drops a leading h1 that duplicates the page title', () => {
  const md = '# 原理学习（操作系统、W3C、Chrome）\n\n正文段落';
  const html = renderToStaticMarkup(renderMarkdown(md, [], { title: '原理学习（操作系统、W3C、Chrome）' }));
  assert.ok(!html.includes('<h1'), 'duplicate title h1 dropped');
  assert.ok(html.includes('正文段落'), 'body kept');
});

test('renderMarkdown keeps a leading h1 that differs from the page title', () => {
  const md = '# 简介\n\n正文段落';
  const html = renderToStaticMarkup(renderMarkdown(md, [], { title: '原理学习（操作系统、W3C、Chrome）' }));
  assert.ok(html.includes('<h1>简介</h1>'), 'non-duplicate h1 kept');
});

test('only the FIRST h1 is compared against the title', () => {
  const md = '# 标题\n\n段落\n\n# 标题\n\n结尾';
  const html = renderToStaticMarkup(renderMarkdown(md, [], { title: '标题' }));
  assert.equal((html.match(/<h1>/g) || []).length, 1, 'only the first duplicate is dropped');
});

test('renderMarkdown turns [!info] callout blockquotes into styled boxes', () => {
  const md = [
    '> [!info] 开源协议：Apache License 2.0',
    '> Apache License 2.',
    '> [https://example.com](https://example.com)',
  ].join('\n');
  const html = renderToStaticMarkup(renderMarkdown(md, []));
  assert.ok(html.includes('class="callout callout-info"'), 'callout div with type class rendered');
  assert.ok(html.includes('<strong>开源协议：Apache License 2.0</strong>'), 'link title bolded');
  assert.ok(html.includes('Apache License 2.'), 'description kept');
  assert.ok(html.includes('href="https://example.com"'), 'link kept');
  assert.ok(!html.includes('[!info]'), 'callout marker syntax removed');
});

test('renderMarkdown styles [!important] callouts and keeps plain blockquotes', () => {
  const md = [
    '> [!important] 注意安全',
    '> 内容',
    '',
    '> 普通引用',
  ].join('\n');
  const html = renderToStaticMarkup(renderMarkdown(md, []));
  assert.ok(html.includes('class="callout callout-important"'), 'important callout rendered');
  assert.ok(!html.includes('[!important]'), 'marker removed');
  assert.ok(html.includes('<blockquote>'), 'plain blockquote untouched');
});
