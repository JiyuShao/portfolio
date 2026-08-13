import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildRedirects, loadRedirects } from './redirects.mjs';

const fixtureManifest = {
  schemaVersion: 1,
  items: [
    { slug: '/articles/babel', aliases: ['/archive/babel', '/articles/babel-js'] },
    { slug: '/topics/react', aliases: [] },
    { slug: '/archive/redis', aliases: ['old-redis'] },
    { slug: '/archive/tcp', aliases: [null, 42, ''] },
  ],
};

test('buildRedirects maps every alias to its canonical slug as 301', () => {
  const rules = buildRedirects(fixtureManifest);
  assert.deepEqual(rules, [
    { source: '/archive/babel', destination: '/articles/babel', permanent: true },
    { source: '/articles/babel-js', destination: '/articles/babel', permanent: true },
    { source: '/old-redis', destination: '/archive/redis', permanent: true },
  ]);
});

test('buildRedirects tolerates missing manifest shape', () => {
  assert.deepEqual(buildRedirects(null), []);
  assert.deepEqual(buildRedirects({}), []);
});

test('loadRedirects reads the fetched manifest and returns [] when absent', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'redirects-test-'));
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(fixtureManifest));
  const rules = await loadRedirects(dir);
  assert.equal(rules.length, 3);

  const emptyDir = await mkdtemp(join(tmpdir(), 'redirects-empty-'));
  assert.deepEqual(await loadRedirects(emptyDir), []);
});
