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

function mapPost(item) {
  return {
    id: item.slug,
    date: Date.parse(item.date),
    type: 'Post',
    slug: item.slug,
    category: item.category ?? 'articles',
    tags: Array.isArray(item.tags) ? item.tags : [],
    summary: item.summary ?? '',
    title: item.title ?? '',
    status: 'Published',
  };
}

/**
 * @param {{ includePages?: boolean, includeArchive?: boolean }} options — kept for call-site compatibility;
 *   every Manifest entry is a published post (archive included by default).
 */
export async function getAllPosts({ includePages = false, includeArchive = true } = {}) {
  const { items } = await loadManifest();
  const posts = items
    .map(mapPost)
    .filter((p) => p.title && p.slug && Number.isFinite(p.date))
    .filter((p) => includeArchive || p.category !== 'archive');
  posts.sort((a, b) => b.date - a.date);
  return posts;
}

/** Look up one entry by canonical slug; returns { post, item } or nulls. */
export async function getPostBySlug(slug) {
  const { items } = await loadManifest();
  const item = items.find((i) => i.slug === slug);
  return item ? { post: mapPost(item), item } : { post: null, item: null };
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

export function getCategoryCountsFromPosts(posts) {
  const counts = {
    all: posts.length,
    articles: 0,
    topics: 0,
    learning: 0,
    archive: 0,
  };

  posts.forEach((post) => {
    if (post.category in counts && post.category !== 'all') {
      counts[post.category]++;
    }
  });

  return counts;
}
