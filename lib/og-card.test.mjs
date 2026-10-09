import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
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

test('OG CLI generates PNGs when its checkout path needs URL encoding', { timeout: 60_000 }, async (t) => {
  const tempParent = process.env.CLAUDE_JOB_DIR ? join(process.env.CLAUDE_JOB_DIR, 'tmp') : tmpdir();
  const root = await mkdtemp(join(tempParent, 'portfolio-og-中文 #%-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const directory of ['scripts', 'lib', 'data']) await mkdir(join(root, directory));
  await copyFile(new URL('../scripts/generate-og-images.mjs', import.meta.url), join(root, 'scripts/generate-og-images.mjs'));
  await copyFile(new URL('./og-card.mjs', import.meta.url), join(root, 'lib/og-card.mjs'));
  await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(root, 'node_modules'), 'junction');
  const item = {
    slug: '/learning/中文-cli', title: '中文路径下的分享卡片', summary: 'Verify the real command-line entry point.',
    category: 'learning', date: '2026-01-01',
  };
  await writeFile(join(root, 'data/manifest.json'), JSON.stringify({ items: [item] }));
  const { stdout } = await promisify(execFile)(process.execPath, ['scripts/generate-og-images.mjs'], {
    cwd: root, env: { ...process.env, TMPDIR: tempParent }, timeout: 55_000,
  });
  assert.match(stdout, /generated 1 article OG images/u);
  const png = await readFile(join(root, 'public', getOgImagePath(item.slug).slice(1)));
  assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.equal(png.readUInt32BE(16), OG_IMAGE_WIDTH);
  assert.equal(png.readUInt32BE(20), OG_IMAGE_HEIGHT);
});
