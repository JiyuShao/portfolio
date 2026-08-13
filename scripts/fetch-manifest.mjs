#!/usr/bin/env node
// Build-time Manifest fetch: download the published artifact from GitHub Releases,
// verify SHA-256 (from the release body) and schemaVersion, unpack manifest.json
// and attachments. Vendored from the Notebook delivery contract
// (scripts/manifest/fetch.mjs) and adapted: latest-release resolution,
// already-fetched-tag skip, local tarball source for offline dev.
//
// Usage:
//   node scripts/fetch-manifest.mjs                 # prebuild/predev (default)
//   node scripts/fetch-manifest.mjs --from <tarball> [--sha256 <hex>]
// Env: MANIFEST_GITHUB_TOKEN (required unless --from or data already fetched),
//      MANIFEST_TAG (default latest), MANIFEST_REPO (default JiyuShao/notebook)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { extractTar } from './tar-lite.mjs';

const API_BASE = 'https://api.github.com';

export function parseChecksumFromBody(body) {
  const m = body?.match(/SHA-256: `([0-9a-f]{64})`/);
  return m ? m[1] : null;
}

async function releaseJson({ repo, tag, token, fetchImpl }) {
  const path =
    tag === 'latest'
      ? `/repos/${repo}/releases/latest`
      : `/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`;
  const res = await fetchImpl(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) {
    throw new Error(
      tag === 'latest'
        ? 'no published Manifest release found — run the Notebook publish CLI first'
        : `no release for tag ${tag}`,
    );
  }
  if (!res.ok) throw new Error(`GitHub API failed (${res.status})`);
  return res.json();
}

/**
 * Verify checksum (when expected), schemaVersion and path safety, then unpack
 * a gzip-compressed artifact buffer. Returns the parsed manifest.
 */
export async function unpackArtifact({ gz, expected, supportedSchemaVersion, dataDir, attachmentsDir }) {
  const actual = createHash('sha256').update(gz).digest('hex');
  if (expected && actual !== expected) {
    throw new Error(`checksum mismatch: expected ${expected}, got ${actual}`);
  }
  const entries = extractTar(gunzipSync(gz));
  if (entries.some((e) => e.name.includes('..') || e.name.startsWith('/'))) {
    throw new Error('artifact contains unsafe entry paths');
  }
  const manifestEntry = entries.find((e) => e.name === 'manifest.json');
  if (!manifestEntry) throw new Error('artifact has no manifest.json');
  const manifest = JSON.parse(manifestEntry.data.toString('utf-8'));
  if (manifest.schemaVersion !== supportedSchemaVersion) {
    throw new Error(
      `schema mismatch: artifact is v${manifest.schemaVersion}, consumer supports v${supportedSchemaVersion}`,
    );
  }
  await mkdir(dataDir, { recursive: true });
  await writeFile(join(dataDir, 'manifest.json'), manifestEntry.data);
  for (const entry of entries) {
    if (entry.name === 'manifest.json') continue;
    if (!entry.name.startsWith('attachments/')) {
      throw new Error(`unexpected artifact entry: ${entry.name}`);
    }
    const target = join(attachmentsDir, entry.name.slice('attachments/'.length));
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, entry.data);
  }
  return manifest;
}

/**
 * Resolve a release (explicit tag or latest), download, verify and unpack.
 * Skips when the resolved tag was already fetched. Returns { manifest, tagName, skipped }.
 */
export async function fetchAndUnpack({
  repo,
  tag,
  token,
  dataDir,
  attachmentsDir,
  supportedSchemaVersion,
  stateFile,
  fetchImpl = fetch,
}) {
  const release = await releaseJson({ repo, tag, token, fetchImpl });
  const tagName = release.tag_name;

  // Same tag already fetched → skip download.
  try {
    if ((await readFile(stateFile, 'utf-8')).trim() === tagName) {
      await readFile(join(dataDir, 'manifest.json')); // confirm data is present
      return { manifest: null, tagName, skipped: true };
    }
  } catch {
    /* not fetched yet */
  }

  const asset = release.assets?.[0];
  if (!asset?.browser_download_url) {
    throw new Error(`release ${tagName} has no downloadable asset`);
  }
  const expected = parseChecksumFromBody(release.body);
  if (!expected) {
    throw new Error(`release ${tagName} body has no SHA-256 checksum`);
  }
  const res = await fetchImpl(asset.browser_download_url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`artifact download failed (${res.status})`);
  const gz = Buffer.from(await res.arrayBuffer());

  const manifest = await unpackArtifact({ gz, expected, supportedSchemaVersion, dataDir, attachmentsDir });
  await writeFile(stateFile, tagName);
  return { manifest, tagName, skipped: false };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = process.argv.slice(2);
  const fromIdx = args.indexOf('--from');
  const shaIdx = args.indexOf('--sha256');
  const dataDir = join(process.cwd(), 'data');
  const attachmentsDir = join(process.cwd(), 'public', 'attachments');
  const stateFile = join(dataDir, '.fetched-tag');
  const repo = process.env.MANIFEST_REPO ?? 'JiyuShao/notebook';
  const tag = process.env.MANIFEST_TAG ?? 'latest';
  const token = process.env.MANIFEST_GITHUB_TOKEN;
  const supportedSchemaVersion = 1;

  try {
    if (fromIdx >= 0) {
      // ponytail: local dev path skips GitHub entirely; checksum only when --sha256 given
      const gz = await readFile(args[fromIdx + 1]);
      const expected = shaIdx >= 0 ? args[shaIdx + 1] : null;
      await unpackArtifact({ gz, expected, supportedSchemaVersion, dataDir, attachmentsDir });
      console.log(`unpacked local artifact → ${dataDir}`);
    } else if (!token) {
      // No token: proceed only if a manifest was already fetched (offline dev).
      try {
        await readFile(join(dataDir, 'manifest.json'));
        console.log('no MANIFEST_GITHUB_TOKEN — using already-fetched manifest');
      } catch {
        throw new Error(
          'MANIFEST_GITHUB_TOKEN is required (or use --from <tarball> for local dev)',
        );
      }
    } else {
      const { manifest, tagName, skipped } = await fetchAndUnpack({
        repo, tag, token, dataDir, attachmentsDir, supportedSchemaVersion, stateFile,
      });
      console.log(
        skipped
          ? `manifest already fetched (${tagName}) — skip`
          : `fetched ${repo} @ ${tagName}: ${manifest.items.length} items`,
      );
    }
  } catch (err) {
    console.error(`fetch-manifest failed: ${err.message}`);
    process.exit(1);
  }
}
