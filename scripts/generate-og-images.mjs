#!/usr/bin/env node

import { Resvg } from '@resvg/resvg-js';
import wawoff from 'wawoff2';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import {
  buildOgCardSvg,
  getOgImagePath,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
} from '../lib/og-card.mjs';

const projectDir = process.cwd();
const manifestPath = join(projectDir, 'data', 'manifest.json');
const outputRoot = join(projectDir, 'public', 'og');
const fontSourceDir = join(projectDir, 'node_modules', 'lxgw-wenkai-webfont', 'files');

function outputPathForSlug(slug) {
  const relativeImagePath = getOgImagePath(slug).slice('/og/'.length);
  const outputPath = resolve(outputRoot, relativeImagePath);
  const fromRoot = relative(outputRoot, outputPath);
  if (!fromRoot || fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) {
    throw new Error(`OG image path escapes output root: ${slug}`);
  }
  return outputPath;
}

async function prepareFonts() {
  const fontDir = await mkdtemp(join(tmpdir(), 'portfolio-og-fonts-'));
  const sourceNames = (await readdir(fontSourceDir))
    .filter((name) => /^lxgwwenkai-regular-subset-.*\.woff2$/u.test(name))
    .sort();
  if (!sourceNames.length) throw new Error('LXGW WenKai font subsets were not found');

  const fontFiles = [];
  for (const name of sourceNames) {
    const source = await readFile(join(fontSourceDir, name));
    const target = join(fontDir, name.replace(/\.woff2$/u, '.ttf'));
    await writeFile(target, Buffer.from(await wawoff.decompress(source)));
    fontFiles.push(target);
  }
  return { fontDir, fontFiles };
}

export async function generateOgImages() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.items) || !manifest.items.length) {
    throw new Error('Publication Manifest must contain at least one item');
  }

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  const { fontDir, fontFiles } = await prepareFonts();

  try {
    for (const item of manifest.items) {
      const outputPath = outputPathForSlug(item.slug);
      await mkdir(dirname(outputPath), { recursive: true });
      const image = new Resvg(buildOgCardSvg(item), {
        font: {
          fontFiles,
          loadSystemFonts: false,
          defaultFontFamily: 'LXGW WenKai',
        },
        logLevel: 'off',
        textRendering: 2,
      }).render();
      if (image.width !== OG_IMAGE_WIDTH || image.height !== OG_IMAGE_HEIGHT) {
        throw new Error(`Unexpected OG image dimensions for ${item.slug}`);
      }
      await writeFile(outputPath, image.asPng());
    }
  } finally {
    await rm(fontDir, { recursive: true, force: true });
  }

  console.log(`generated ${manifest.items.length} article OG images in public/og`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await generateOgImages();
}
