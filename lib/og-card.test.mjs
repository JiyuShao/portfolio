import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOgCardSvg,
  getOgImagePath,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  wrapCardText,
} from './og-card.mjs';

test('getOgImagePath maps canonical content slugs to generated PNGs', () => {
  assert.equal(
    getOgImagePath('/articles/hardware-clock-32x32'),
    '/og/articles/hardware-clock-32x32.png',
  );
  assert.equal(getOgImagePath('/topics/多人协作算法'), '/og/topics/多人协作算法.png');
  assert.throws(() => getOgImagePath('/articles/../private'), /invalid slug/);
});

test('wrapCardText limits long titles without dropping the truncation signal', () => {
  const lines = wrapCardText('这是一篇很长很长而且需要在分享卡片上保持清晰层级的文章标题', 8, 2);
  assert.equal(lines.length, 2);
  assert.match(lines.at(-1), /…$/u);
});

test('buildOgCardSvg creates a complete escaped social card', () => {
  const svg = buildOgCardSvg({
    title: 'A < B & C',
    summary: '带标题与摘要的分享卡片',
    category: 'articles',
    date: '2025-03-31',
  });

  assert.match(svg, new RegExp(`width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}"`));
  assert.match(svg, /A &lt; B &amp; C/u);
  assert.match(svg, /文章 \/ ARTICLE · 2025\.03\.31/u);
  assert.match(svg, /Real, Simple, Stupid\./u);
});
