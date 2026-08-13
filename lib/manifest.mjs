// Manifest data module — the single seam the pages consume after the cutover.
// Exposes the same shapes as the legacy Notion modules so list pages only swap
// their import; the archive category stays in lists (it is a URL category,
// not a visibility switch).
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const dataDir = process.env.MANIFEST_DATA_DIR ?? join(process.cwd(), 'data');

let cache;

export async function loadManifest() {
  if (!cache) {
    const raw = await readFile(join(dataDir, 'manifest.json'), 'utf-8');
    cache = JSON.parse(raw);
  }
  return cache;
}

/**
 * @param {{ includePages?: boolean }} options — kept for call-site compatibility;
 *   every Manifest entry is a published post (archive included).
 */
export async function getAllPosts({ includePages = false } = {}) {
  const { items } = await loadManifest();
  const posts = items
    .map((item) => ({
      id: item.slug,
      date: Date.parse(item.date),
      type: 'Post',
      slug: item.slug,
      tags: Array.isArray(item.tags) ? item.tags : [],
      summary: item.summary ?? '',
      title: item.title ?? '',
      status: 'Published',
    }))
    .filter((p) => p.title && p.slug && Number.isFinite(p.date));
  posts.sort((a, b) => b.date - a.date);
  return posts;
}

export function getAllTagsFromPosts(posts) {
  const taggedPosts = posts.filter((post) => post.tags);
  const tags = [...taggedPosts.map((p) => p.tags).flat()];
  const tagObj = {};
  tags.forEach((tag) => {
    if (tag in tagObj) {
      tagObj[tag]++;
    } else {
      tagObj[tag] = 1;
    }
  });
  return tagObj;
}
