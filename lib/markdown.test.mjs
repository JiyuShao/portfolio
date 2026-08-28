import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { mapAttachmentSrc, mapImageSrc, normalizeExportedMarkdown, renderMarkdown } from './markdown.mjs';

test('mapImageSrc rewrites known attachment refs and keeps everything else', () => {
  const attachments = [
    { logicalPath: '_attachments/foo.png', artifactPath: 'attachments/abc123.png' },
  ];
  assert.equal(mapImageSrc('_attachments/foo.png', attachments), '/attachments/abc123.png');
  assert.equal(mapImageSrc('https://example.com/x.png', attachments), 'https://example.com/x.png');
  assert.equal(mapImageSrc('_attachments/missing.png', []), '_attachments/missing.png');
  assert.equal(mapImageSrc(undefined, attachments), undefined);
});

test('mapAttachmentSrc maps non-image attachments through the same inventory', () => {
  const attachments = [
    { logicalPath: '_attachments/demo.mp4', artifactPath: 'attachments/video-hash.mp4' },
  ];
  assert.equal(mapAttachmentSrc('_attachments/demo.mp4', attachments), '/attachments/video-hash.mp4');
});

test('renderMarkdown turns a local MP4 attachment link into a playable video', () => {
  const attachments = [
    {
      logicalPath: '_attachments/demo.mp4',
      artifactPath: 'attachments/video-hash.mp4',
      mediaType: 'application/octet-stream',
    },
  ];
  const html = renderToStaticMarkup(renderMarkdown('[demo.mp4](_attachments/demo.mp4)', attachments));

  assert.ok(html.includes('class="article-video"'), 'video wrapper rendered');
  assert.ok(html.includes('<video controls="" playsinline="" preload="metadata"'), 'video controls rendered');
  assert.ok(html.includes('src="/attachments/video-hash.mp4"'), 'video attachment URL rewritten');
  assert.ok(html.includes('type="video/mp4"'), 'video MIME inferred from extension');
});

test('renderMarkdown leaves ordinary and unknown video links as links', () => {
  const md = '[资料](_attachments/guide.pdf)\n\n[外部视频](https://example.com/demo.mp4)';
  const html = renderToStaticMarkup(renderMarkdown(md, []));
  assert.equal((html.match(/<a /g) || []).length, 2);
  assert.ok(!html.includes('<video'), 'unknown links are never embedded');
});

test('renderMarkdown normalizes resource headings and standalone links', () => {
  const md = [
    '# 相关资料',
    '',
    '[https://blog.example.com/articles/42](https://blog.example.com/articles/42)',
    '',
    '[有标题的资料](https://docs.example.com/guide)',
  ].join('\n');
  const html = renderToStaticMarkup(renderMarkdown(md, [], { headingIds: ['references'] }));

  assert.ok(html.includes('<h2 class="resource-heading first-heading" id="references"'));
  assert.ok(html.includes('>References</h2>'));
  assert.ok(html.includes('<ul class="resource-list">'));
  assert.equal((html.match(/class="resource-link"/g) || []).length, 2);
  assert.ok(html.includes('resource-link-title">blog.example.com'));
  assert.ok(html.includes('resource-link-meta">blog.example.com/articles/42'));
  assert.ok(html.includes('resource-link-title">有标题的资料'));
});

test('renderMarkdown keeps explanatory links inside resource prose lightweight', () => {
  const md = [
    '# References',
    '',
    '补充说明里可以阅读 [普通链接](https://example.com/context)。',
    '',
    '- [独立资料](https://example.com/reference)',
  ].join('\n');
  const html = renderToStaticMarkup(renderMarkdown(md, [], { headingIds: ['references'] }));

  assert.equal((html.match(/class="resource-link"/g) || []).length, 1);
  assert.ok(html.includes('<a href="https://example.com/context">普通链接</a>'));
  assert.ok(html.includes('<ul class="resource-list">'));
});

test('normalizeExportedMarkdown makes the first list item after summary parse as a list', () => {
  const md = '<details>\n\n<summary>模块</summary>\n- 第一项\n\n- 第二项\n\n</details>';
  const normalized = normalizeExportedMarkdown(md);
  const html = renderToStaticMarkup(renderMarkdown(md, []));

  assert.ok(normalized.includes('</summary>\n\n- 第一项'), 'blank line inserted after summary');
  assert.ok(html.includes('<details><summary>模块</summary><div class="details-content"><ul>'));
  assert.equal((html.match(/<li>/g) || []).length, 2, 'both markers belong to one parsed list');
  assert.ok(html.includes('第一项') && html.includes('第二项'));
  assert.ok(!html.includes('\n- 第一项'), 'first marker is no longer raw text');
});

test('normalizeExportedMarkdown does not rewrite summary-looking text inside code fences', () => {
  const md = '```html\n<summary>示例</summary>\n- 原样保留\n```';
  assert.equal(normalizeExportedMarkdown(md), md);
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
    { logicalPath: '_attachments/foo.png', artifactPath: 'attachments/abc123.png', mediaType: 'image/png' },
  ];
  const html = renderToStaticMarkup(renderMarkdown(md, attachments));

  assert.ok(html.includes('<table>'), 'GFM table rendered');
  assert.ok(html.includes('hljs'), 'code block highlighted');
  assert.ok(html.includes('<details>') && html.includes('<summary>'), 'raw details/summary rendered');
  assert.ok(html.includes('src="/attachments/abc123.png"'), 'image rewritten to content-addressed URL');
  assert.ok(html.includes('loading="lazy"') && html.includes('decoding="async"'), 'legacy images load lazily');
});

test('renderMarkdown uses responsive image output when Manifest dimensions are available', () => {
  const attachments = [{
    logicalPath: '_attachments/photo.png',
    artifactPath: 'attachments/photo-hash.png',
    mediaType: 'image/png',
    width: 1600,
    height: 900,
  }];
  const html = renderToStaticMarkup(renderMarkdown('![示例](_attachments/photo.png)', attachments));
  assert.ok(html.includes('width="1600"') && html.includes('height="900"'), 'intrinsic size rendered');
  assert.ok(html.includes('/_next/image?url=%2Fattachments%2Fphoto-hash.png'), 'Next image optimizer used');
  assert.ok(html.includes('sizes="(min-width: 768px) 48rem, calc(100vw - 2.5rem)"'));
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
  assert.ok(html.includes('<h2 class="first-heading">简介</h2>'), 'body h1 becomes a semantic h2');
});

test('only the FIRST h1 is compared against the title', () => {
  const md = '# 标题\n\n段落\n\n# 标题\n\n结尾';
  const html = renderToStaticMarkup(renderMarkdown(md, [], { title: '标题' }));
  assert.equal((html.match(/<h2[ >]/g) || []).length, 1, 'only the first duplicate is dropped');
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
  assert.ok(html.includes('<h2 id="a" class="first-heading">'), 'source h1 becomes h2 with id');
  assert.ok(html.includes('<h3 id="b">'), 'source h2 becomes h3 with id');
  assert.ok(html.includes('<h4 id="c">'), 'source h3 becomes h4 with id');
});

test('a deduped leading h1 does not consume a heading id slot', () => {
  const md = '# 标题\n\n## B';
  const html = renderToStaticMarkup(renderMarkdown(md, [], { title: '标题', headingIds: ['b'] }));
  assert.ok(!html.includes('<h1'), 'duplicate h1 dropped');
  assert.ok(html.includes('<h3 id="b" class="first-heading">'), 'source h2 gets the first id');
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
  assert.ok(html.includes('<h3 id="b"><a'), 'shifted h3 opens with its anchor child');
});

test('the first rendered heading gets first-heading (deduped h1 does not count)', () => {
  const html = renderToStaticMarkup(
    renderMarkdown('# 标题\n\n## 背景\n\n## 开搞', [], { title: '标题', headingIds: ['bg', 'kg'] })
  );
  assert.ok(!html.includes('<h1'), 'duplicate h1 dropped');
  assert.ok(html.includes('<h3 id="bg" class="first-heading"'), 'first rendered body heading marked');
  assert.equal((html.match(/class="first-heading"/g) || []).length, 1, 'exactly one first-heading');
});

test('a kept leading h1 is the first heading', () => {
  const html = renderToStaticMarkup(
    renderMarkdown('# 简介\n\n## 背景', [], { headingIds: ['intro'] })
  );
  assert.ok(html.includes('<h2 id="intro" class="first-heading"'), 'kept source h1 marked as body h2');
});
