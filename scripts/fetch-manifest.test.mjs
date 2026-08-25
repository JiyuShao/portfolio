import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { gunzipSync, gzipSync } from 'node:zlib';
import { createTar } from './tar-lite.mjs';
import { fetchAndUnpack, unpackArtifact, parseChecksumFromBody } from './fetch-manifest.mjs';

const SCHEMA = 1;
const TAG = 'manifest/v1/abc12345';
const ASSET = 'manifest-v1-abc12345.tar.gz';
const SOURCE_COMMIT = 'abc12345' + '0'.repeat(32);
const SCRIPT = fileURLToPath(new URL('./fetch-manifest.mjs', import.meta.url));
const temporaryRoots = [];

function item(attachments = [], overrides = {}) {
  return {
    category: 'articles',
    slug: '/articles/a',
    canonicalPath: '/articles/a',
    aliases: ['/old/a'],
    title: 'A',
    summary: 'Summary',
    date: '2026-08-24',
    tags: ['test'],
    body: 'Body',
    attachments,
    ...overrides,
  };
}

function attachment(name, data) {
  const hash = createHash('sha256').update(data).digest('hex');
  return {
    logicalPath: `_attachments/${name}`,
    artifactPath: `attachments/${hash}${extname(name).toLowerCase()}`,
    contentHash: `sha256-${hash}`,
    mediaType: 'image/png',
  };
}

function makeTarball({ entries = [], manifest = { schemaVersion: SCHEMA, sourceCommit: SOURCE_COMMIT, items: [item()] } } = {}) {
  return gzipSync(createTar([
    { name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest)) },
    ...entries,
  ]));
}

function mockFetch(routes) {
  const impl = async (url, init = {}) => {
    impl.calls.push(url);
    const route = routes.find((candidate) => candidate.match(url));
    if (!route) return { ok: false, status: 404, json: async () => ({}) };
    const res = route.respond(url, init);
    res.ok = res.ok ?? res.status < 400;
    if (!res.json) res.json = async () => ({});
    return res;
  };
  impl.calls = [];
  return impl;
}

function releaseRoute({
  body,
  sha,
  assets,
  draft = false,
  prerelease = false,
  tagName = TAG,
  includeDraft = true,
  includePrerelease = true,
}) {
  return {
    match: (url) => url.includes('/releases/latest') || url.includes('/releases/tags/'),
    respond: () => ({
      status: 200,
      json: async () => ({
        tag_name: tagName,
        body: body ?? `Artifact: \`${ASSET}\`\nSHA-256: \`${sha}\``,
        ...(includeDraft ? { draft } : {}),
        ...(includePrerelease ? { prerelease } : {}),
        assets: assets ?? [{
          id: 1,
          name: ASSET,
          browser_download_url: 'https://attacker.example/artifact.tar.gz',
        }],
      }),
    }),
  };
}

async function fixtureDirs() {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'fetch-test-')));
  temporaryRoots.push(dir);
  return {
    root: join(dir, 'site'),
    dataDir: join(dir, 'site', 'data'),
    attachmentsDir: join(dir, 'site', 'public', 'attachments'),
    stateFile: join(dir, 'site', 'data', '.fetched-tag'),
  };
}

async function seedInstalled(dirs) {
  await mkdir(dirs.dataDir, { recursive: true });
  await mkdir(dirs.attachmentsDir, { recursive: true });
  await writeFile(join(dirs.dataDir, 'manifest.json'), JSON.stringify({ schemaVersion: SCHEMA, items: [] }));
  await writeFile(join(dirs.attachmentsDir, 'old.png'), 'old');
  await writeFile(dirs.stateFile, JSON.stringify({
    tagName: 'old',
    checksum: '0'.repeat(64),
    manifestHash: '0'.repeat(64),
  }));
}

function manifestBytes(manifest = { schemaVersion: SCHEMA, sourceCommit: SOURCE_COMMIT, items: [item()] }) {
  return Buffer.from(JSON.stringify(manifest));
}

function manifestHash(manifest) {
  return createHash('sha256').update(manifestBytes(manifest)).digest('hex');
}

function updateFirstHeaderChecksum(archive) {
  archive.fill(0x20, 148, 156);
  let checksum = 0;
  for (const byte of archive.subarray(0, 512)) checksum += byte;
  archive.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
}

function mutateTarball(mutator) {
  const archive = Buffer.from(gunzipSync(makeTarball()));
  mutator(archive);
  return gzipSync(archive);
}

function downloadRoute(tarball, id = 1) {
  return {
    match: (url) => url === `https://api.github.com/repos/JiyuShao/notebook/releases/assets/${id}`,
    respond: () => ({ status: 200, arrayBuffer: async () => tarball }),
  };
}

after(async () => {
  for (const root of temporaryRoots) await rm(root, { recursive: true, force: true });
});

test('downloads the exact declared stable Release asset and installs one snapshot', async () => {
  const data = Buffer.from('png');
  const image = attachment('abc.png', data);
  const tarball = makeTarball({
    manifest: { schemaVersion: SCHEMA, sourceCommit: SOURCE_COMMIT, items: [item([image])] },
    entries: [{ name: image.artifactPath, data }],
  });
  const sha = createHash('sha256').update(tarball).digest('hex');
  const dirs = await fixtureDirs();
  const fetchImpl = mockFetch([
    releaseRoute({
      sha,
      assets: [
        { id: 2, name: 'wrong.tar.gz', browser_download_url: 'https://attacker.example/wrong.tar.gz' },
        { id: 1, name: ASSET, browser_download_url: 'https://attacker.example/artifact.tar.gz' },
      ],
    }),
    downloadRoute(tarball),
  ]);

  const result = await fetchAndUnpack({
    repo: 'JiyuShao/notebook', tag: 'latest', token: 'x',
    dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
    supportedSchemaVersion: SCHEMA, stateFile: dirs.stateFile, fetchImpl,
  });

  assert.equal(result.tagName, TAG);
  assert.equal(result.skipped, false);
  assert.deepEqual(fetchImpl.calls, [
    'https://api.github.com/repos/JiyuShao/notebook/releases/latest',
    'https://api.github.com/repos/JiyuShao/notebook/releases/assets/1',
  ]);
  assert.equal(fetchImpl.calls.some((url) => url.includes('attacker.example')), false);
  assert.equal(await readFile(join(dirs.attachmentsDir, basename(image.artifactPath)), 'utf-8'), 'png');
  assert.deepEqual(JSON.parse(await readFile(dirs.stateFile, 'utf-8')), {
    tagName: TAG,
    checksum: sha,
    manifestHash: result.manifest && manifestHash(result.manifest),
  });
});

test('draft, prerelease, and incomplete stable flags are rejected before download', async () => {
  for (const flags of [
    { draft: true },
    { prerelease: true },
    { includeDraft: false },
    { includePrerelease: false },
  ]) {
    const dirs = await fixtureDirs();
    const fetchImpl = mockFetch([releaseRoute({ sha: '0'.repeat(64), ...flags })]);
    await assert.rejects(
      fetchAndUnpack({
        repo: 'JiyuShao/notebook', tag: 'latest', token: 'x',
        dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
        supportedSchemaVersion: SCHEMA, stateFile: dirs.stateFile, fetchImpl,
      }),
      /not a published stable Release/,
    );
    assert.equal(fetchImpl.calls.length, 1);
  }
});

test('Release requires exactly one matching asset with a positive integer id', async () => {
  const tarball = makeTarball();
  const sha = createHash('sha256').update(tarball).digest('hex');
  for (const assets of [
    [],
    [{ name: ASSET }],
    [{ id: 0, name: ASSET }],
    [{ id: 1.5, name: ASSET }],
    [{ id: 1, name: ASSET }, { id: 2, name: ASSET }],
  ]) {
    const dirs = await fixtureDirs();
    const fetchImpl = mockFetch([releaseRoute({ sha, assets })]);
    await assert.rejects(
      fetchAndUnpack({
        repo: 'JiyuShao/notebook', tag: TAG, token: 'x',
        dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
        supportedSchemaVersion: SCHEMA, stateFile: dirs.stateFile, fetchImpl,
      }),
      /exactly one downloadable Manifest asset/,
    );
    assert.equal(fetchImpl.calls.length, 1);
  }
});

test('Release body requires one exact Artifact and SHA-256 declaration', async () => {
  const tarball = makeTarball();
  const sha = createHash('sha256').update(tarball).digest('hex');
  for (const body of [
    `NotArtifact: \`${ASSET}\`\nNotSHA-256: \`${sha}\``,
    `Artifact: \`${ASSET}\`\nSHA-256: \`${sha}\`\nSHA-256: \`${sha}\``,
    `Artifact: \`../${ASSET}\`\nSHA-256: \`${sha}\``,
  ]) {
    const dirs = await fixtureDirs();
    const fetchImpl = mockFetch([releaseRoute({ sha, body })]);
    await assert.rejects(
      fetchAndUnpack({
        repo: 'JiyuShao/notebook', tag: TAG, token: 'x',
        dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
        supportedSchemaVersion: SCHEMA, stateFile: dirs.stateFile, fetchImpl,
      }),
      /no exact Artifact and SHA-256 declaration/,
    );
    assert.equal(fetchImpl.calls.length, 1);
  }
});

test('same tag reauthenticates the artifact and skips only local replacement', async () => {
  const tarball = makeTarball();
  const sha = createHash('sha256').update(tarball).digest('hex');
  const dirs = await fixtureDirs();
  const fetchImpl = mockFetch([releaseRoute({ sha }), downloadRoute(tarball)]);
  let installs = 0;
  const options = {
    repo: 'JiyuShao/notebook', tag: TAG, token: 'x',
    dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
    supportedSchemaVersion: SCHEMA, stateFile: dirs.stateFile, fetchImpl,
    beforeInstall: async () => { installs += 1; },
  };

  await fetchAndUnpack(options);
  assert.equal((await fetchAndUnpack(options)).skipped, true);
  assert.equal(installs, 1);
  assert.equal(fetchImpl.calls.filter((url) => url.endsWith('/releases/assets/1')).length, 2);
});

test('tampered same-tag cache is restored from the authenticated artifact', async () => {
  const manifest = { schemaVersion: SCHEMA, sourceCommit: SOURCE_COMMIT, items: [item()] };
  const tarball = makeTarball({ manifest });
  const sha = createHash('sha256').update(tarball).digest('hex');
  for (const corrupt of ['manifest', 'checksum', 'state-shape']) {
    const dirs = await fixtureDirs();
    await mkdir(dirs.dataDir, { recursive: true });
    await mkdir(dirs.attachmentsDir, { recursive: true });
    const installedManifest = corrupt === 'manifest'
      ? { ...manifest, items: [item([], { title: 'TAMPERED', body: 'TAMPERED' })] }
      : manifest;
    await writeFile(join(dirs.dataDir, 'manifest.json'), manifestBytes(installedManifest));
    await writeFile(dirs.stateFile, JSON.stringify({
      tagName: TAG,
      checksum: corrupt === 'checksum' ? '0'.repeat(64) : sha,
      manifestHash: manifestHash(manifest),
      ...(corrupt === 'state-shape' ? { untrusted: true } : {}),
    }));
    const fetchImpl = mockFetch([releaseRoute({ sha }), downloadRoute(tarball)]);

    const result = await fetchAndUnpack({
      repo: 'JiyuShao/notebook', tag: TAG, token: 'x',
      dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
      supportedSchemaVersion: SCHEMA, stateFile: dirs.stateFile, fetchImpl,
    });

    assert.equal(result.skipped, false);
    assert.ok((await readFile(join(dirs.dataDir, 'manifest.json'))).equals(manifestBytes(manifest)));
    assert.equal(fetchImpl.calls.filter((url) => url.endsWith('/releases/assets/1')).length, 1);
  }
});

test('missing, stale, or byte-tampered attachment caches are reinstalled', async () => {
  const data = Buffer.from('authenticated-image');
  const image = attachment('image.png', data);
  const manifest = {
    schemaVersion: SCHEMA,
    sourceCommit: SOURCE_COMMIT,
    items: [item([image])],
  };
  const tarball = makeTarball({
    manifest,
    entries: [{ name: image.artifactPath, data }],
  });
  const sha = createHash('sha256').update(tarball).digest('hex');
  const installedName = basename(image.artifactPath);
  for (const corrupt of ['missing', 'stale', 'bytes']) {
    const dirs = await fixtureDirs();
    const fetchImpl = mockFetch([releaseRoute({ sha }), downloadRoute(tarball)]);
    const options = {
      repo: 'JiyuShao/notebook', tag: TAG, token: 'x',
      dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
      supportedSchemaVersion: SCHEMA, stateFile: dirs.stateFile, fetchImpl,
    };
    await fetchAndUnpack(options);
    if (corrupt === 'missing') await rm(join(dirs.attachmentsDir, installedName));
    if (corrupt === 'stale') await writeFile(join(dirs.attachmentsDir, 'stale.png'), 'stale');
    if (corrupt === 'bytes') await writeFile(join(dirs.attachmentsDir, installedName), 'tampered');

    const result = await fetchAndUnpack(options);
    assert.equal(result.skipped, false);
    assert.ok((await readFile(join(dirs.attachmentsDir, installedName))).equals(data));
    assert.deepEqual(await readdir(dirs.attachmentsDir), [installedName]);
  }
});

test('symlinked attachment cache entries fail closed instead of being trusted', async () => {
  const data = Buffer.from('authenticated-image');
  const image = attachment('image.png', data);
  const manifest = {
    schemaVersion: SCHEMA,
    sourceCommit: SOURCE_COMMIT,
    items: [item([image])],
  };
  const tarball = makeTarball({
    manifest,
    entries: [{ name: image.artifactPath, data }],
  });
  const sha = createHash('sha256').update(tarball).digest('hex');
  const dirs = await fixtureDirs();
  const fetchImpl = mockFetch([releaseRoute({ sha }), downloadRoute(tarball)]);
  const options = {
    repo: 'JiyuShao/notebook', tag: TAG, token: 'x',
    dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
    supportedSchemaVersion: SCHEMA, stateFile: dirs.stateFile, fetchImpl,
  };
  await fetchAndUnpack(options);
  const installed = join(dirs.attachmentsDir, basename(image.artifactPath));
  await rm(installed);
  await writeFile(join(dirname(dirs.root), 'outside-image'), 'tampered');
  await symlink(join(dirname(dirs.root), 'outside-image'), installed);

  await assert.rejects(fetchAndUnpack(options), /attachment cache must contain regular files/);
});

test('stale attachments are removed by snapshot replacement', async () => {
  const dirs = await fixtureDirs();
  await seedInstalled(dirs);
  await unpackArtifact({
    gz: makeTarball(), supportedSchemaVersion: SCHEMA,
    dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
  });

  await assert.rejects(readFile(join(dirs.attachmentsDir, 'old.png')), /ENOENT/);
});

test('unsafe, duplicate, malformed, or inventory-mismatched artifacts preserve old output', async () => {
  const image = Buffer.from('image');
  const validManifest = {
    schemaVersion: SCHEMA,
    sourceCommit: SOURCE_COMMIT,
    items: [item([attachment('a.png', image)])],
  };
  const cases = [
    makeTarball({ entries: [{ name: '../evil', data: image }] }),
    makeTarball({ entries: [
      { name: 'attachments/Case.png', data: image },
      { name: 'attachments/case.png', data: image },
    ] }),
    makeTarball({ manifest: { schemaVersion: SCHEMA } }),
    makeTarball({ manifest: validManifest }),
    makeTarball({ manifest: validManifest, entries: [{ name: 'attachments/a.png', data: Buffer.from('wrong') }] }),
  ];
  const malformedTar = Buffer.from(gunzipSync(makeTarball()));
  malformedTar[257] = 0;
  cases.push(gzipSync(malformedTar));

  for (const gz of cases) {
    const dirs = await fixtureDirs();
    await seedInstalled(dirs);
    await assert.rejects(
      unpackArtifact({
        gz, supportedSchemaVersion: SCHEMA,
        dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
      }),
    );
    assert.equal(await readFile(join(dirs.attachmentsDir, 'old.png'), 'utf-8'), 'old');
  }
});

test('Manifest route and per-item attachment identities are globally unique', async () => {
  const image = Buffer.from('image');
  const imageRef = attachment('a.png', image);
  const second = item([], {
    category: 'topics',
    slug: '/topics/b',
    canonicalPath: '/topics/b',
    aliases: ['/old/b'],
    title: 'B',
  });
  const manifests = [
    { schemaVersion: SCHEMA, sourceCommit: SOURCE_COMMIT, items: [item(), { ...second, slug: '/articles/a', canonicalPath: '/articles/a' }] },
    { schemaVersion: SCHEMA, sourceCommit: SOURCE_COMMIT, items: [item([], { aliases: ['/articles/a'] })] },
    { schemaVersion: SCHEMA, sourceCommit: SOURCE_COMMIT, items: [item(), { ...second, aliases: ['/old/a'] }] },
    { schemaVersion: SCHEMA, sourceCommit: SOURCE_COMMIT, items: [item([imageRef, imageRef])] },
    {
      schemaVersion: SCHEMA,
      sourceCommit: SOURCE_COMMIT,
      items: [item([{ ...imageRef, artifactPath: 'attachments/not-content-addressed.png' }])],
    },
  ];

  for (const manifest of manifests) {
    const dirs = await fixtureDirs();
    await seedInstalled(dirs);
    await assert.rejects(
      unpackArtifact({
        gz: makeTarball({ manifest, entries: [{ name: imageRef.artifactPath, data: image }] }),
        supportedSchemaVersion: SCHEMA,
        dataDir: dirs.dataDir,
        attachmentsDir: dirs.attachmentsDir,
      }),
      /duplicate route|duplicate logicalPath|invalid Manifest item/,
    );
    assert.equal(await readFile(join(dirs.attachmentsDir, 'old.png'), 'utf8'), 'old');
  }
});

test('Manifest category and canonical URL namespace remain independent', async () => {
  const dirs = await fixtureDirs();
  const manifest = {
    schemaVersion: SCHEMA,
    sourceCommit: SOURCE_COMMIT,
    items: [item([], { category: 'topics', slug: '/articles/a', canonicalPath: '/articles/a' })],
  };
  await unpackArtifact({
    gz: makeTarball({ manifest }),
    supportedSchemaVersion: SCHEMA,
    dataDir: dirs.dataDir,
    attachmentsDir: dirs.attachmentsDir,
  });
  assert.ok((await readFile(join(dirs.dataDir, 'manifest.json'))).equals(manifestBytes(manifest)));
});

test('failure after the old snapshot is moved aside restores it', async () => {
  const dirs = await fixtureDirs();
  await seedInstalled(dirs);

  await assert.rejects(
    unpackArtifact({
      gz: makeTarball(), supportedSchemaVersion: SCHEMA,
      dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
      afterBackup: async () => { throw new Error('injected replacement failure'); },
    }),
    /injected replacement failure/,
  );
  assert.equal(await readFile(join(dirs.attachmentsDir, 'old.png'), 'utf-8'), 'old');
  assert.deepEqual(JSON.parse(await readFile(join(dirs.dataDir, 'manifest.json'), 'utf-8')), {
    schemaVersion: SCHEMA,
    items: [],
  });
});

test('interrupted backup and partial install states restore the previous snapshot', async () => {
  for (const partialInstall of [false, true]) {
    const dirs = await fixtureDirs();
    await seedInstalled(dirs);
    const backup = await mkdtemp(join(dirname(dirs.root), `.${basename(dirs.root)}-previous-`));
    await mkdir(join(backup, 'public'), { recursive: true });
    await writeFile(join(backup, '.install-backup'), JSON.stringify({
      version: 1,
      hadData: true,
      hadAttachments: true,
    }));
    await rename(dirs.dataDir, join(backup, 'data'));
    if (partialInstall) {
      await rename(dirs.attachmentsDir, join(backup, 'public', 'attachments'));
      await mkdir(dirs.dataDir);
      await writeFile(join(dirs.dataDir, 'manifest.json'), 'partial');
    }

    await assert.rejects(
      unpackArtifact({
        gz: makeTarball(), supportedSchemaVersion: SCHEMA,
        dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
        beforeInstall: async () => { throw new Error('stop after recovery'); },
      }),
      /stop after recovery/,
    );
    assert.equal(await readFile(join(dirs.attachmentsDir, 'old.png'), 'utf8'), 'old');
    assert.deepEqual(JSON.parse(await readFile(join(dirs.dataDir, 'manifest.json'), 'utf8')), {
      schemaVersion: SCHEMA,
      items: [],
    });
    await assert.rejects(readFile(join(backup, '.install-backup')), /ENOENT/);
  }
});

test('rollback removes an install collision when no previous outputs existed', async () => {
  const dirs = await fixtureDirs();

  await assert.rejects(
    unpackArtifact({
      gz: makeTarball(), supportedSchemaVersion: SCHEMA,
      dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
      afterBackup: async () => {
        await mkdir(dirs.dataDir, { recursive: true });
        await writeFile(join(dirs.dataDir, 'collision'), 'collision');
      },
    }),
  );
  await assert.rejects(readdir(dirs.dataDir), /ENOENT/);
  await assert.rejects(readdir(dirs.attachmentsDir), /ENOENT/);
});

test('symlinked install ancestors are rejected without touching their target', async () => {
  const dirs = await fixtureDirs();
  const outside = join(dirname(dirs.root), 'outside');
  await mkdir(outside, { recursive: true });
  await writeFile(join(outside, 'sentinel'), 'unchanged');
  await mkdir(dirname(dirs.root), { recursive: true });
  await symlink(await realpath(outside), dirs.root);

  await assert.rejects(
    unpackArtifact({
      gz: makeTarball(), supportedSchemaVersion: SCHEMA,
      dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
    }),
    /must be a regular directory path/,
  );
  assert.equal(await readFile(join(outside, 'sentinel'), 'utf-8'), 'unchanged');
});

test('local install rejects output layouts that cannot form one supported snapshot', async () => {
  const dirs = await fixtureDirs();
  for (const [dataDir, attachmentsDir] of [
    [dirs.dataDir, join(dirname(dirs.root), 'other', 'attachments')],
    [join(dirs.root, 'public'), join(dirs.root, 'public', 'attachments')],
  ]) {
    await assert.rejects(
      unpackArtifact({
        gz: makeTarball(), supportedSchemaVersion: SCHEMA,
        dataDir, attachmentsDir,
      }),
      /must use sibling data and public\/attachments paths/,
    );
  }
});

test('state cannot alias manifest.json and is rejected before network access', async () => {
  const dirs = await fixtureDirs();
  const fetchImpl = mockFetch([]);
  await assert.rejects(
    fetchAndUnpack({
      repo: 'JiyuShao/notebook', tag: TAG, token: 'x',
      dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
      supportedSchemaVersion: SCHEMA,
      stateFile: join(dirs.dataDir, 'MANIFEST.JSON'),
      fetchImpl,
    }),
    /state must be a distinct file directly inside dataDir/,
  );
  assert.equal(fetchImpl.calls.length, 0);
});

test('symlinked cache roots and state files are rejected before network access', async () => {
  const outside = await fixtureDirs();
  await mkdir(outside.root, { recursive: true });
  await writeFile(join(outside.root, 'sentinel'), 'unchanged');

  const linked = await fixtureDirs();
  await symlink(await realpath(outside.root), linked.root);
  let fetchImpl = mockFetch([]);
  await assert.rejects(
    fetchAndUnpack({
      repo: 'JiyuShao/notebook', tag: TAG, token: 'x',
      dataDir: linked.dataDir, attachmentsDir: linked.attachmentsDir,
      supportedSchemaVersion: SCHEMA, stateFile: linked.stateFile, fetchImpl,
    }),
    /regular directory path|symlink ancestors/,
  );
  assert.equal(fetchImpl.calls.length, 0);
  assert.equal(await readFile(join(outside.root, 'sentinel'), 'utf8'), 'unchanged');

  const dirs = await fixtureDirs();
  await mkdir(dirs.dataDir, { recursive: true });
  await writeFile(join(dirs.dataDir, 'target-state'), '{}');
  await symlink(join(dirs.dataDir, 'target-state'), dirs.stateFile);
  fetchImpl = mockFetch([]);
  await assert.rejects(
    fetchAndUnpack({
      repo: 'JiyuShao/notebook', tag: TAG, token: 'x',
      dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
      supportedSchemaVersion: SCHEMA, stateFile: dirs.stateFile, fetchImpl,
    }),
    /regular file path/,
  );
  assert.equal(fetchImpl.calls.length, 0);
});

test('network fetch and CLI both fail closed without a token', async () => {
  const dirs = await fixtureDirs();
  const fetchImpl = mockFetch([]);
  await assert.rejects(
    fetchAndUnpack({
      repo: 'JiyuShao/notebook', tag: TAG, token: '',
      dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
      supportedSchemaVersion: SCHEMA, stateFile: dirs.stateFile, fetchImpl,
    }),
    /GitHub token is required/,
  );
  assert.equal(fetchImpl.calls.length, 0);

  const result = spawnSync(process.execPath, [SCRIPT], {
    cwd: dirname(dirs.root),
    env: {
      ...process.env,
      MANIFEST_GITHUB_TOKEN: '',
    },
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /MANIFEST_GITHUB_TOKEN is required unless --from is used/);
});

test('checksum and schema mismatches name both values', async () => {
  const dirs = await fixtureDirs();
  await assert.rejects(
    unpackArtifact({
      gz: makeTarball(), expected: 'f'.repeat(64), supportedSchemaVersion: SCHEMA,
      dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
    }),
    /checksum mismatch: expected f{64}, got [0-9a-f]{64}/,
  );
  await assert.rejects(
    unpackArtifact({
      gz: makeTarball({ manifest: { schemaVersion: 2, items: [] } }),
      supportedSchemaVersion: SCHEMA,
      dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
    }),
    /schema mismatch: artifact is v2, consumer supports v1/,
  );
});

test('strict TAR fields reject malformed metadata, hidden bytes, and unsupported versions', async () => {
  for (const mutate of [
    (archive) => archive.write('notmode!', 100, 'ascii'),
    (archive) => archive.write('not-octa', 108, 'ascii'),
    (archive) => archive.write('not-octa', 116, 'ascii'),
    (archive) => archive.write('not-octal!!!', 136, 'ascii'),
    (archive) => archive.write('2\0evil', 124, 'ascii'),
    (archive) => archive.write('link', 157, 'ascii'),
    (archive) => archive.write('device', 329, 'ascii'),
    (archive) => { archive[500] = 0x41; },
    (archive) => archive.write('99', 263, 'ascii'),
  ]) {
    const dirs = await fixtureDirs();
    const gz = mutateTarball((archive) => {
      mutate(archive);
      updateFirstHeaderChecksum(archive);
    });
    await assert.rejects(
      unpackArtifact({
        gz, supportedSchemaVersion: SCHEMA,
        dataDir: dirs.dataDir, attachmentsDir: dirs.attachmentsDir,
      }),
      /field is invalid|hidden bytes|invalid version|unsupported|not zero-filled/,
    );
  }
});

test('parseChecksumFromBody requires the exact declaration', () => {
  const checksum = 'a'.repeat(64);
  assert.equal(parseChecksumFromBody(`Artifact: \`x.tar.gz\`\nSHA-256: \`${checksum}\``), checksum);
  assert.equal(parseChecksumFromBody(`NotArtifact: \`x.tar.gz\`\nNotSHA-256: \`${checksum}\``), null);
});
