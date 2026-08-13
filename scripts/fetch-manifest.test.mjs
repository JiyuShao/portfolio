import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createTar } from './tar-lite.mjs';
import { fetchAndUnpack, unpackArtifact, parseChecksumFromBody } from './fetch-manifest.mjs';

const SCHEMA = 1;
const TAG = 'manifest/v1/abc12345';

function makeTarball(entries = [], schemaVersion = SCHEMA) {
  const manifest = Buffer.from(
    JSON.stringify({ schemaVersion, items: [{ slug: '/articles/a', title: 'A' }] }),
  );
  return gzipSync(createTar([{ name: 'manifest.json', data: manifest }, ...entries]));
}

/** Minimal route-based fetch mock; records every URL it is asked for. */
function mockFetch(routes) {
  const impl = async (url, init = {}) => {
    impl.calls.push(url);
    const route = routes.find((r) => r.match(url));
    if (!route) return { ok: false, status: 404, json: async () => ({}) };
    const res = route.respond(url, init);
    res.ok = res.ok ?? res.status < 400;
    if (!res.json) res.json = async () => ({});
    return res;
  };
  impl.calls = [];
  return impl;
}

function releaseRoute({ body, sha, asset }) {
  return {
    match: (url) => url.includes('/releases/'),
    respond: () => ({
      status: 200,
      json: async () => ({
        tag_name: TAG,
        body: body ?? `Artifact: \`manifest-v1-abc12345.tar.gz\`\nSHA-256: \`${sha}\``,
        assets: asset === null ? [] : [{ browser_download_url: 'https://dl.example/artifact.tar.gz' }],
      }),
    }),
  };
}

async function fixtureDirs() {
  const dir = await mkdtemp(join(tmpdir(), 'fetch-test-'));
  return {
    dataDir: join(dir, 'data'),
    attachmentsDir: join(dir, 'public', 'attachments'),
    stateFile: join(dir, 'data', '.fetched-tag'),
  };
}

test('fetchAndUnpack downloads latest release, verifies and unpacks', async () => {
  const tarball = makeTarball([{ name: 'attachments/abc123.png', data: Buffer.from('png') }]);
  const sha = createHash('sha256').update(tarball).digest('hex');
  const dirs = await fixtureDirs();
  const fetchImpl = mockFetch([
    releaseRoute({ sha }),
    {
      match: (url) => url.includes('dl.example'),
      respond: () => ({ status: 200, arrayBuffer: async () => tarball.buffer.slice(tarball.byteOffset, tarball.byteOffset + tarball.byteLength) }),
    },
  ]);

  const result = await fetchAndUnpack({
    repo: 'JiyuShao/notebook', tag: 'latest', token: 'x',
    dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
    supportedSchemaVersion: SCHEMA, stateFile: dirs.stateFile, fetchImpl,
  });

  assert.equal(result.tagName, TAG);
  assert.equal(result.skipped, false);
  const manifest = JSON.parse(await readFile(join(dirs.dataDir, 'manifest.json'), 'utf-8'));
  assert.equal(manifest.schemaVersion, SCHEMA);
  assert.equal(await readFile(join(dirs.attachmentsDir, 'abc123.png'), 'utf-8'), 'png');
  assert.equal(await readFile(dirs.stateFile, 'utf-8'), TAG);
  assert.equal(fetchImpl.calls[0], 'https://api.github.com/repos/JiyuShao/notebook/releases/latest');
  assert.equal(fetchImpl.calls[1], 'https://dl.example/artifact.tar.gz');
});

test('checksum mismatch fails naming expected vs actual', async () => {
  const tarball = makeTarball();
  const dirs = await fixtureDirs();
  const fetchImpl = mockFetch([releaseRoute({ sha: 'f'.repeat(64) }), {
    match: (url) => url.includes('dl.example'),
    respond: () => ({ status: 200, arrayBuffer: async () => tarball.buffer.slice(tarball.byteOffset, tarball.byteOffset + tarball.byteLength) }),
  }]);

  await assert.rejects(
    fetchAndUnpack({
      repo: 'JiyuShao/notebook', tag: 'latest', token: 'x',
      dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
      supportedSchemaVersion: SCHEMA, stateFile: dirs.stateFile, fetchImpl,
    }),
    /checksum mismatch: expected f{64}, got [0-9a-f]{64}/,
  );
});

test('schema mismatch fails naming both versions', async () => {
  const tarball = makeTarball([], 2);
  const dirs = await fixtureDirs();
  const fetchImpl = mockFetch([releaseRoute({ sha: createHash('sha256').update(tarball).digest('hex') }), {
    match: (url) => url.includes('dl.example'),
    respond: () => ({ status: 200, arrayBuffer: async () => tarball.buffer.slice(tarball.byteOffset, tarball.byteOffset + tarball.byteLength) }),
  }]);

  await assert.rejects(
    fetchAndUnpack({
      repo: 'JiyuShao/notebook', tag: 'latest', token: 'x',
      dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
      supportedSchemaVersion: SCHEMA, stateFile: dirs.stateFile, fetchImpl,
    }),
    /schema mismatch: artifact is v2, consumer supports v1/,
  );
});

test('no published release fails with actionable message', async () => {
  const dirs = await fixtureDirs();
  const fetchImpl = mockFetch([]); // 404 for everything

  await assert.rejects(
    fetchAndUnpack({
      repo: 'JiyuShao/notebook', tag: 'latest', token: 'x',
      dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
      supportedSchemaVersion: SCHEMA, stateFile: dirs.stateFile, fetchImpl,
    }),
    /no published Manifest release found — run the Notebook publish CLI first/,
  );
});

test('already-fetched tag skips the download entirely', async () => {
  const dirs = await fixtureDirs();
  const tarball = makeTarball();
  const sha = createHash('sha256').update(tarball).digest('hex');
  const fetchImpl = mockFetch([releaseRoute({ sha }), {
    match: (url) => url.includes('dl.example'),
    respond: () => ({ status: 200, arrayBuffer: async () => tarball.buffer.slice(tarball.byteOffset, tarball.byteOffset + tarball.byteLength) }),
  }]);

  // first fetch
  await fetchAndUnpack({
    repo: 'JiyuShao/notebook', tag: TAG, token: 'x',
    dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
    supportedSchemaVersion: SCHEMA, stateFile: dirs.stateFile, fetchImpl,
  });
  // second fetch: same tag → skip
  const result = await fetchAndUnpack({
    repo: 'JiyuShao/notebook', tag: TAG, token: 'x',
    dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
    supportedSchemaVersion: SCHEMA, stateFile: dirs.stateFile, fetchImpl,
  });

  assert.equal(result.skipped, true);
  assert.equal(result.manifest, null);
  // only the first fetch downloaded the artifact
  const downloads = fetchImpl.calls.filter((u) => u.includes('dl.example')).length;
  assert.equal(downloads, 1);
});

test('unsafe entry paths are rejected before writing', async () => {
  const dirs = await fixtureDirs();
  await assert.rejects(
    unpackArtifact({
      gz: makeTarball([{ name: '../evil.txt', data: Buffer.from('x') }]),
      expected: null, supportedSchemaVersion: SCHEMA,
      dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
    }),
    /artifact contains unsafe entry paths/,
  );
});

test('local tarball path works without a token and with optional checksum', async () => {
  const dirs = await fixtureDirs();
  const tarball = makeTarball([{ name: 'attachments/local.png', data: Buffer.from('local') }]);
  const manifest = await unpackArtifact({
    gz: tarball, expected: null, supportedSchemaVersion: SCHEMA,
    dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
  });
  assert.equal(manifest.schemaVersion, SCHEMA);
  assert.equal(await readFile(join(dirs.attachmentsDir, 'local.png'), 'utf-8'), 'local');

  // wrong checksum fails even on the local path
  await assert.rejects(
    unpackArtifact({
      gz: tarball, expected: 'f'.repeat(64), supportedSchemaVersion: SCHEMA,
      dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
    }),
    /checksum mismatch/,
  );
});

test('parseChecksumFromBody extracts the published SHA-256', () => {
  assert.equal(
    parseChecksumFromBody('Artifact: `x.tar.gz`\nSHA-256: `' + 'a'.repeat(64) + '`'),
    'a'.repeat(64),
  );
  assert.equal(parseChecksumFromBody('no checksum'), null);
});

test('explicit-tag fetch hits the release-by-tag endpoint', async () => {
  const tarball = makeTarball();
  const sha = createHash('sha256').update(tarball).digest('hex');
  const dirs = await fixtureDirs();
  const fetchImpl = mockFetch([releaseRoute({ sha }), {
    match: (url) => url.includes('dl.example'),
    respond: () => ({ status: 200, arrayBuffer: async () => tarball.buffer.slice(tarball.byteOffset, tarball.byteOffset + tarball.byteLength) }),
  }]);

  await fetchAndUnpack({
    repo: 'JiyuShao/notebook', tag: TAG, token: 'x',
    dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
    supportedSchemaVersion: SCHEMA, stateFile: dirs.stateFile, fetchImpl,
  });
  assert.ok(fetchImpl.calls[0].includes('/releases/tags/manifest%2Fv1%2Fabc12345'));
});
