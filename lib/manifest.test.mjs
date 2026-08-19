import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// The data module reads MANIFEST_DATA_DIR (default <cwd>/data); point it at a fixture.
const fixtureDir = await mkdtemp(join(tmpdir(), 'manifest-test-'));
process.env.MANIFEST_DATA_DIR = fixtureDir;
const { getAllPosts, getAllTagsFromPosts, getCategoryCountsFromPosts, getPostBySlug, loadManifest } = await import('../lib/manifest.mjs');

const fixtureManifest = {
  schemaVersion: 1,
  items: [
    { category: 'archive', slug: '/archive/redis', title: 'Redis', summary: '早期笔记', date: '2018-01-03', tags: ['Redis'] },
    { category: 'articles', slug: '/articles/babel', title: 'Babel', summary: 'babel 笔记', date: '2019-11-22', tags: ['Babel', '前端'] },
    { category: 'topics', slug: '/topics/react', title: 'React 事件传播', summary: '原理学习', date: '2025-04-07', tags: ['React'] },
    { category: 'articles', slug: '/articles/broken', title: '', summary: 'x', date: '2020-01-01', tags: [] },
  ],
};

test.before(async () => {
  await writeFile(join(fixtureDir, 'manifest.json'), JSON.stringify(fixtureManifest));
});

test('getAllPosts maps Manifest items to the legacy post shape', async () => {
  const posts = await getAllPosts({ includePages: false });
  assert.equal(posts.length, 3); // empty-title item filtered out
  const bySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));

  const babel = bySlug['/articles/babel'];
  assert.equal(babel.title, 'Babel');
  assert.equal(babel.type, 'Post');
  assert.equal(babel.status, 'Published');
  assert.equal(babel.id, '/articles/babel');
  assert.equal(babel.category, 'articles');
  assert.deepEqual(babel.tags, ['Babel', '前端']);
  assert.equal(typeof babel.date, 'number');
  assert.ok(babel.date > 0);
});

test('getAllPosts sorts by date descending', async () => {
  const posts = await getAllPosts();
  assert.deepEqual(
    posts.map((p) => p.slug),
    ['/topics/react', '/articles/babel', '/archive/redis'],
  );
});

test('archive items stay in the lists', async () => {
  const posts = await getAllPosts();
  assert.ok(posts.some((p) => p.slug === '/archive/redis'));
});

test('getAllTagsFromPosts counts tags across posts', async () => {
  const posts = await getAllPosts();
  const tags = getAllTagsFromPosts(posts);
  assert.deepEqual(tags, { Redis: 1, Babel: 1, '前端': 1, React: 1 });
});

test('getCategoryCountsFromPosts includes empty publication categories', async () => {
  const posts = await getAllPosts();
  assert.deepEqual(getCategoryCountsFromPosts(posts), {
    all: 3,
    articles: 1,
    topics: 1,
    learning: 0,
    archive: 1,
  });
});

test('getPostBySlug returns the mapped post and the raw item', async () => {
  const { post, item } = await getPostBySlug('/archive/redis');
  assert.equal(post.slug, '/archive/redis');
  assert.equal(post.title, 'Redis');
  assert.equal(post.type, 'Post');
  assert.equal(item.category, 'archive');

  const missing = await getPostBySlug('/does-not-exist');
  assert.equal(missing.post, null);
  assert.equal(missing.item, null);
});

test('loadManifest caches the parsed manifest', async () => {
  const first = await loadManifest();
  const second = await loadManifest();
  assert.equal(first.schemaVersion, 1);
  assert.equal(first, second); // same cached object
});
