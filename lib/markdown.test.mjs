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
  assert.ok(html.includes('<h1 class="first-heading">简介</h1>'), 'non-duplicate h1 kept');
});

test('only the FIRST h1 is compared against the title', () => {
  const md = '# 标题\n\n段落\n\n# 标题\n\n结尾';
  const html = renderToStaticMarkup(renderMarkdown(md, [], { title: '标题' }));
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1, 'only the first duplicate is dropped');
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

test('renderMarkdown assigns precomputed heading ids in document order', () => {
  const md = '# A\n\n## B\n\n### C';
  const html = renderToStaticMarkup(renderMarkdown(md, [], { headingIds: ['a', 'b', 'c'] }));
  assert.ok(html.includes('<h1 id="a" class="first-heading">'), 'h1 id assigned');
  assert.ok(html.includes('<h2 id="b">'), 'h2 id assigned');
  assert.ok(html.includes('<h3 id="c">'), 'h3 id assigned');
});

test('a deduped leading h1 does not consume a heading id slot', () => {
  const md = '# 标题\n\n## B';
  const html = renderToStaticMarkup(renderMarkdown(md, [], { title: '标题', headingIds: ['b'] }));
  assert.ok(!html.includes('<h1'), 'duplicate h1 dropped');
  assert.ok(html.includes('<h2 id="b" class="first-heading">'), 'h2 gets the first id');
});

test('code fences get a header bar with language and a copy button', () => {
  const html = renderToStaticMarkup(renderMarkdown('```js\nconst x = 1\n```'));
  assert.ok(html.includes('class="code-block"'), 'fence wrapped in code-block');
  assert.ok(html.includes('code-block-lang') && html.includes('>js<'), 'language label shown');
  assert.ok(html.includes('复制'), 'copy button rendered');
  assert.ok(html.includes('<pre><code'), 'pre wraps the code element (pre code selectors keep matching)');
});

test('headings with ids get a hover "#" anchor', () => {
  const md = '# A\n\n## B';
  const html = renderToStaticMarkup(renderMarkdown(md, [], { headingIds: ['a', 'b'] }));
  assert.ok(html.includes('heading-anchor'), 'anchor rendered inside headings');
  assert.ok(html.includes('href="#a"') && html.includes('href="#b"'), 'anchor targets the heading id');
  assert.ok(html.includes('<h2 id="b"><a'), 'h2 opens with its anchor child');
});

test('the first rendered heading gets first-heading (deduped h1 does not count)', () => {
  const html = renderToStaticMarkup(
    renderMarkdown('# 标题\n\n## 背景\n\n## 开搞', [], { title: '标题', headingIds: ['bg', 'kg'] })
  );
  assert.ok(!html.includes('<h1'), 'duplicate h1 dropped');
  assert.ok(html.includes('<h2 id="bg" class="first-heading"'), 'first rendered h2 marked');
  assert.equal((html.match(/class="first-heading"/g) || []).length, 1, 'exactly one first-heading');
});

test('a kept leading h1 is the first heading', () => {
  const html = renderToStaticMarkup(
    renderMarkdown('# 简介\n\n## 背景', [], { headingIds: ['intro'] })
  );
  assert.ok(html.includes('<h1 id="intro" class="first-heading"'), 'kept h1 marked');
});
