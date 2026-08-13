// Alias redirect rules derived from the fetched Manifest — 301 permanent.
// Unknown root-level old URLs are NOT redirected (declared behaviour); they 404
// because the catch-all detail route only serves enumerated canonical slugs.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export function buildRedirects(manifest) {
  const redirects = [];
  for (const item of manifest?.items ?? []) {
    for (const alias of item.aliases ?? []) {
      if (typeof alias !== 'string' || !alias) continue;
      const source = alias.startsWith('/') ? alias : '/' + alias;
      redirects.push({ source, destination: item.slug, permanent: true });
    }
  }
  return redirects;
}

/** Load the fetched manifest and derive redirects; empty when not fetched yet. */
export async function loadRedirects(dataDir = join(process.cwd(), 'data')) {
  try {
    const manifest = JSON.parse(await readFile(join(dataDir, 'manifest.json'), 'utf-8'));
    return buildRedirects(manifest);
  } catch {
    return []; // manifest not fetched yet (fresh clone / tooling runs)
  }
}
