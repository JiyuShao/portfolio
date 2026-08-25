#!/usr/bin/env node
// Build-time Manifest fetch: verify and install one published GitHub Release
// artifact. Data and attachments install as one rollback-protected snapshot;
// cache state is committed last.
//
// Usage:
//   node scripts/fetch-manifest.mjs
//   node scripts/fetch-manifest.mjs --from <tarball> [--sha256 <hex>]
// Env: MANIFEST_GITHUB_TOKEN (required unless --from),
//      MANIFEST_TAG (default latest), MANIFEST_REPO (default JiyuShao/notebook)
import { constants } from 'node:fs';
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { extractTar } from './tar-lite.mjs';

const API_BASE = 'https://api.github.com';

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

function githubRepo(value) {
  const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(value ?? '');
  if (!match) return null;
  const parts = match.slice(1);
  return parts.some((part) => part === '.' || part === '..') ? null : parts;
}

function parseReleaseDeclaration(body) {
  const match = /^Artifact: `([^`/\\]+\.tar\.gz)`\nSHA-256: `([0-9a-f]{64})`$/.exec(body ?? '');
  return match ? { assetName: match[1], checksum: match[2] } : null;
}

export function parseChecksumFromBody(body) {
  return parseReleaseDeclaration(body)?.checksum ?? null;
}

async function releaseJson({ repo, tag, token, fetchImpl }) {
  const parts = githubRepo(repo);
  if (!parts) throw new Error('Manifest repository must be owner/name');
  const encodedRepo = parts.map(encodeURIComponent).join('/');
  const path = tag === 'latest'
    ? `/repos/${encodedRepo}/releases/latest`
    : `/repos/${encodedRepo}/releases/tags/${encodeURIComponent(tag)}`;
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

function safeRoute(value, { canonical = false } = {}) {
  if (typeof value !== 'string' || /[\x00-\x1f\x7f\s%?#\\]/.test(value)) return false;
  const segments = value.split('/');
  if (segments[0] !== '' || segments.slice(1).some((segment) => !segment || segment === '.' || segment === '..')) {
    return false;
  }
  return !canonical || (
    segments.length === 3 && ['articles', 'topics', 'learning', 'archive'].includes(segments[1])
  );
}

function validDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validAttachmentIdentity(artifactPath, contentHash) {
  const match = /^sha256-([0-9a-f]{64})$/.exec(contentHash ?? '');
  if (!match || typeof artifactPath !== 'string') return false;
  const stem = `attachments/${match[1]}`;
  if (!artifactPath.startsWith(stem)) return false;
  const extension = artifactPath.slice(stem.length);
  return extension === '' || /^\.[a-z0-9][a-z0-9_-]*$/.test(extension);
}

function validLogicalPath(value) {
  if (typeof value !== 'string' || /[\x00-\x1f\x7f\\]/.test(value)) return false;
  let decoded;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }
  if (/[\x00-\x1f\x7f\\]/.test(decoded)) return false;
  const prefix = decoded.startsWith('./_attachments/')
    ? './_attachments/'
    : decoded.startsWith('_attachments/')
      ? '_attachments/'
      : null;
  if (!prefix) return false;
  const segments = decoded.slice(prefix.length).split('/');
  return segments.every((segment) => segment && segment !== '.' && segment !== '..');
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.items)) {
    throw new Error('artifact Manifest items must be an array');
  }
  if (!/^[0-9a-f]{40}$/.test(manifest.sourceCommit ?? '')) {
    throw new Error('artifact Manifest has an invalid source commit');
  }

  const categories = new Set(['articles', 'topics', 'learning', 'archive']);
  const slugs = new Set();
  const aliases = new Set();
  const attachments = new Map();
  for (const [index, item] of manifest.items.entries()) {
    const strings = ['title', 'summary', 'body'];
    if (
      !item || typeof item !== 'object' ||
      !categories.has(item.category) ||
      !safeRoute(item.slug, { canonical: true }) ||
      item.canonicalPath !== item.slug ||
      !Array.isArray(item.aliases) || item.aliases.some((alias) => !safeRoute(alias)) ||
      strings.some((field) => typeof item[field] !== 'string' || (field !== 'body' && !item[field].trim())) ||
      !validDate(item.date) ||
      !Array.isArray(item.tags) || item.tags.some((tag) => typeof tag !== 'string') ||
      !Array.isArray(item.attachments)
    ) {
      throw new Error(`artifact contains an invalid Manifest item at index ${index}`);
    }
    if (slugs.has(item.slug)) throw new Error(`artifact Manifest has duplicate route ${item.slug}`);
    slugs.add(item.slug);

    const logicalPaths = new Set();
    for (const attachment of item.attachments) {
      if (
        !attachment || typeof attachment !== 'object' ||
        !validLogicalPath(attachment.logicalPath) ||
        !validAttachmentIdentity(attachment.artifactPath, attachment.contentHash) ||
        typeof attachment.mediaType !== 'string' || !attachment.mediaType
      ) {
        throw new Error(`artifact contains an invalid Manifest item at index ${index}`);
      }
      if (logicalPaths.has(attachment.logicalPath)) {
        throw new Error(`artifact Manifest item has duplicate logicalPath ${attachment.logicalPath}`);
      }
      logicalPaths.add(attachment.logicalPath);
      const existing = attachments.get(attachment.artifactPath);
      if (existing && existing !== attachment.contentHash) {
        throw new Error(`artifact Manifest has conflicting hashes for ${attachment.artifactPath}`);
      }
      attachments.set(attachment.artifactPath, attachment.contentHash);
    }
  }

  for (const item of manifest.items) {
    for (const alias of item.aliases) {
      if (slugs.has(alias) || aliases.has(alias)) {
        throw new Error(`artifact Manifest has duplicate route ${alias}`);
      }
      aliases.add(alias);
    }
  }
  return attachments;
}

function validateReleaseIdentity({ manifest, requestedTag, releaseTag, assetName }) {
  const commit8 = manifest.sourceCommit.slice(0, 8);
  const expectedTag = `manifest/v${manifest.schemaVersion}/${commit8}`;
  const expectedAsset = `manifest-v${manifest.schemaVersion}-${commit8}.tar.gz`;
  if (
    (requestedTag !== 'latest' && requestedTag !== expectedTag) ||
    releaseTag !== expectedTag ||
    assetName !== expectedAsset
  ) {
    throw new Error('release tag, asset name, and Manifest source commit do not identify the same artifact');
  }
}

function parseArtifact({ gz, expected, supportedSchemaVersion }) {
  if (expected && !/^[0-9a-f]{64}$/.test(expected)) {
    throw new Error('expected checksum must be a lowercase SHA-256 hex digest');
  }
  const actual = sha256(gz);
  if (expected && actual !== expected) {
    throw new Error(`checksum mismatch: expected ${expected}, got ${actual}`);
  }

  let entries;
  try {
    entries = extractTar(gunzipSync(gz));
  } catch (error) {
    throw new Error(`artifact is not a valid gzip tarball: ${error.message}`);
  }
  const names = new Set();
  for (const entry of entries) {
    const segments = entry.name.split('/');
    const allowed = entry.name === 'manifest.json' || (
      segments.length === 2 && segments[0] === 'attachments' && segments[1]
    );
    const foldedName = entry.name.toLocaleLowerCase('en-US');
    if (
      !allowed ||
      names.has(foldedName) ||
      entry.name.includes('\\') ||
      segments.some((segment) => segment === '.' || segment === '..') ||
      isAbsolute(entry.name)
    ) {
      throw new Error('artifact contains unsafe or duplicate entry paths');
    }
    names.add(foldedName);
  }

  const manifestEntry = entries.find((entry) => entry.name === 'manifest.json');
  if (!manifestEntry) throw new Error('artifact has no manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(manifestEntry.data.toString('utf-8'));
  } catch (error) {
    throw new Error(`artifact has invalid manifest.json: ${error.message}`);
  }
  if (manifest.schemaVersion !== supportedSchemaVersion) {
    throw new Error(
      `schema mismatch: artifact is v${manifest.schemaVersion}, consumer supports v${supportedSchemaVersion}`,
    );
  }
  const expectedAttachments = validateManifest(manifest);
  const attachmentEntries = entries.filter((entry) => entry !== manifestEntry);
  if (
    attachmentEntries.length !== expectedAttachments.size ||
    attachmentEntries.some((entry) => !expectedAttachments.has(entry.name))
  ) {
    throw new Error('artifact attachments do not match the Manifest inventory');
  }
  for (const entry of attachmentEntries) {
    const hash = `sha256-${sha256(entry.data)}`;
    if (hash !== expectedAttachments.get(entry.name)) {
      throw new Error(`artifact attachment hash mismatch: ${entry.name}`);
    }
  }
  return {
    entries,
    manifest,
    manifestBytes: Buffer.from(manifestEntry.data),
    manifestHash: sha256(manifestEntry.data),
    attachments: new Map(attachmentEntries.map((entry) => [entry.name, Buffer.from(entry.data)])),
  };
}

function installPaths(dataDir, attachmentsDir, stateFile) {
  const data = resolve(dataDir);
  const attachments = resolve(attachmentsDir);
  const root = dirname(data);
  if (
    data !== join(root, 'data') ||
    attachments !== join(root, 'public', 'attachments')
  ) {
    throw new Error('Manifest outputs must use sibling data and public/attachments paths');
  }
  let stateName = null;
  if (stateFile) {
    const state = resolve(stateFile);
    const stateRelative = relative(data, state);
    if (
      !stateRelative ||
      stateRelative === '..' ||
      stateRelative.startsWith(`..${sep}`) ||
      isAbsolute(stateRelative) ||
      stateRelative.includes(sep) ||
      stateRelative.toLocaleLowerCase('en-US') === 'manifest.json'
    ) {
      throw new Error('Manifest state must be a distinct file directly inside dataDir');
    }
    stateName = stateRelative;
  }
  return {
    data,
    attachments,
    root,
    state: stateFile ? resolve(stateFile) : null,
    stateName,
  };
}

async function assertSafePath(path, { file = false } = {}) {
  let current = resolve(path);
  const target = current;
  while (true) {
    const info = await lstat(current).catch((error) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (info?.isSymbolicLink()) {
      if (current !== target && current === resolve('/var') && process.platform === 'darwin') return;
      throw new Error(current === target
        ? `Manifest install output must be a regular ${file ? 'file' : 'directory'} path`
        : 'Manifest install output must not use symlink ancestors');
    }
    if (info && (current === target && file ? !info.isFile() : !info.isDirectory())) {
      throw new Error(`Manifest install output must be a regular ${file ? 'file' : 'directory'} path`);
    }
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

async function safeReadFile(path) {
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw new Error('Manifest install output must be a regular file path');
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function lstatOrNull(path) {
  return lstat(path).catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
}

async function moveAside(path, backupRoot, root) {
  const backup = join(backupRoot, relative(root, path));
  await mkdir(dirname(backup), { recursive: true });
  try {
    await rename(path, backup);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function writePreparedJournal(backupRoot, journal) {
  const temp = join(backupRoot, '.install-backup.tmp');
  const handle = await open(
    temp,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      (constants.O_NOFOLLOW ?? 0),
    0o600,
  );
  try {
    await handle.writeFile(`${JSON.stringify(journal)}\n`);
  } finally {
    await handle.close();
  }
  await rename(temp, join(backupRoot, '.install-backup'));
}

async function markInstallCommitted(backupRoot) {
  const temp = join(backupRoot, '.install-committed.tmp');
  const handle = await open(
    temp,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      (constants.O_NOFOLLOW ?? 0),
    0o600,
  );
  try {
    await handle.writeFile('1\n');
  } finally {
    await handle.close();
  }
  await rename(temp, join(backupRoot, '.install-committed'));
}

async function readPreparedJournal(backupRoot) {
  let journal;
  try {
    journal = JSON.parse((await safeReadFile(join(backupRoot, '.install-backup'))).toString('utf8'));
  } catch (error) {
    throw new Error(`interrupted Manifest backup is invalid at ${backupRoot}: ${error.message}`);
  }
  if (
    !journal || typeof journal !== 'object' || Array.isArray(journal) ||
    Object.keys(journal).sort().join(',') !== 'hadAttachments,hadData,version' ||
    journal.version !== 1 ||
    typeof journal.hadData !== 'boolean' ||
    typeof journal.hadAttachments !== 'boolean'
  ) {
    throw new Error(`interrupted Manifest backup is invalid at ${backupRoot}`);
  }
  return journal;
}

async function rollbackPreparedInstall(paths, backupRoot, journal) {
  const { data, attachments, root } = paths;
  for (const [path, hadPrevious] of [
    [attachments, journal.hadAttachments],
    [data, journal.hadData],
  ]) {
    const backup = join(backupRoot, relative(root, path));
    const [currentInfo, backupInfo] = await Promise.all([
      lstatOrNull(path),
      lstatOrNull(backup),
    ]);
    if (currentInfo?.isSymbolicLink() || backupInfo?.isSymbolicLink()) {
      throw new Error(`cannot safely restore through symlink ${path}`);
    }
    if (hadPrevious) {
      if (backupInfo) {
        if (!backupInfo.isDirectory()) throw new Error(`Manifest backup is not a directory: ${backup}`);
        await rm(path, { recursive: true, force: true });
        await mkdir(dirname(path), { recursive: true });
        await rename(backup, path);
      } else if (!currentInfo?.isDirectory()) {
        throw new Error(`Manifest backup is missing its previous output: ${backup}`);
      }
    } else {
      if (backupInfo) throw new Error(`Manifest backup has unexpected output: ${backup}`);
      await rm(path, { recursive: true, force: true });
    }
  }
  await rm(backupRoot, { recursive: true, force: true });
}

async function cleanupInterruptedStaging(root) {
  const parent = dirname(root);
  const prefix = `.${basename(root)}-manifest-`;
  const entries = await readdir(parent, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(prefix)) continue;
    const stagingRoot = join(parent, entry.name);
    let marker;
    try {
      marker = await safeReadFile(join(stagingRoot, '.install-staging'));
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (marker.equals(Buffer.from('1\n'))) {
      await rm(stagingRoot, { recursive: true, force: true });
    }
  }
}

async function recoverInterruptedInstall(paths) {
  const { data, attachments, root } = paths;
  await assertSafePath(root);
  await assertSafePath(data);
  await assertSafePath(attachments);
  await cleanupInterruptedStaging(root);
  const parent = dirname(root);
  const prefix = `.${basename(root)}-previous-`;
  const candidates = (await readdir(parent, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  })).filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix));
  const backups = [];
  for (const entry of candidates) {
    const backupRoot = join(parent, entry.name);
    if (await lstatOrNull(join(backupRoot, '.install-backup'))) backups.push(backupRoot);
  }
  if (!backups.length) return;
  if (backups.length !== 1) throw new Error('multiple interrupted Manifest backups require manual recovery');

  const [backupRoot] = backups;
  const journal = await readPreparedJournal(backupRoot);
  const committed = await lstatOrNull(join(backupRoot, '.install-committed'));
  if (committed) {
    if (!committed.isFile() || committed.isSymbolicLink()) {
      throw new Error(`interrupted Manifest commit marker is invalid at ${backupRoot}`);
    }
    const [dataInfo, attachmentsInfo] = await Promise.all([
      lstatOrNull(data),
      lstatOrNull(attachments),
    ]);
    if (dataInfo?.isDirectory() && attachmentsInfo?.isDirectory()) {
      await rm(backupRoot, { recursive: true, force: true });
      return;
    }
  }
  await rollbackPreparedInstall(paths, backupRoot, journal);
}

async function installArtifact({ entries, paths, state, beforeInstall, afterBackup }) {
  const { data, attachments, root, stateName } = paths;
  await recoverInterruptedInstall(paths);
  await assertSafePath(root);
  await assertSafePath(data);
  await assertSafePath(attachments);
  await mkdir(dirname(root), { recursive: true });

  const stagingRoot = await mkdtemp(join(dirname(root), `.${basename(root)}-manifest-`));
  const backupRoot = await mkdtemp(join(dirname(root), `.${basename(root)}-previous-`));
  const stagedData = join(stagingRoot, 'data');
  const stagedAttachments = join(stagingRoot, 'attachments');
  const manifestEntry = entries.find((entry) => entry.name === 'manifest.json');
  let journal = null;
  let committed = false;
  let preserveBackup = false;

  try {
    await writeFile(join(stagingRoot, '.install-staging'), '1\n', { flag: 'wx', mode: 0o600 });
    await mkdir(stagedData, { recursive: true });
    await mkdir(stagedAttachments, { recursive: true });
    await writeFile(join(stagedData, 'manifest.json'), manifestEntry.data);
    for (const entry of entries) {
      if (entry === manifestEntry) continue;
      await writeFile(join(stagedAttachments, entry.name.slice('attachments/'.length)), entry.data);
    }
    if (beforeInstall) await beforeInstall();
    await assertSafePath(root);
    await assertSafePath(data);
    await assertSafePath(attachments);

    await mkdir(dirname(data), { recursive: true });
    await mkdir(dirname(attachments), { recursive: true });
    const [dataInfo, attachmentsInfo] = await Promise.all([
      lstatOrNull(data),
      lstatOrNull(attachments),
    ]);
    journal = {
      version: 1,
      hadData: Boolean(dataInfo),
      hadAttachments: Boolean(attachmentsInfo),
    };
    await writePreparedJournal(backupRoot, journal);
    await moveAside(data, backupRoot, root);
    await moveAside(attachments, backupRoot, root);
    if (afterBackup) await afterBackup();
    await assertSafePath(root);
    await assertSafePath(data);
    await assertSafePath(attachments);

    await rename(stagedData, data);
    await rename(stagedAttachments, attachments);
    if (state && stateName) {
      const stateTemp = join(data, `${stateName}.tmp`);
      const stateHandle = await open(
        stateTemp,
        constants.O_WRONLY |
          constants.O_CREAT |
          constants.O_EXCL |
          (constants.O_NOFOLLOW ?? 0),
        0o600,
      );
      try {
        await stateHandle.writeFile(`${JSON.stringify(state)}\n`);
      } finally {
        await stateHandle.close();
      }
      await rename(stateTemp, join(data, stateName));
    }
    await markInstallCommitted(backupRoot);
    committed = true;
  } catch (error) {
    if (journal && !committed) {
      try {
        await assertSafePath(root);
        await assertSafePath(dirname(attachments));
        await rollbackPreparedInstall(paths, backupRoot, journal);
      } catch (rollbackError) {
        preserveBackup = true;
        throw new AggregateError(
          [error, rollbackError],
          `Manifest install failed and rollback could not complete; backup preserved at ${backupRoot}`,
        );
      }
    }
    throw error;
  } finally {
    await rm(stagingRoot, { recursive: true, force: true }).catch(() => {});
    if (!preserveBackup) {
      await rm(backupRoot, { recursive: true, force: true }).catch(() => {});
    }
  }
}

/** Verify, validate and atomically install a gzip-compressed artifact. */
export async function unpackArtifact({
  gz,
  expected,
  supportedSchemaVersion,
  dataDir,
  attachmentsDir,
  stateFile,
  state,
  beforeInstall,
  afterBackup,
  requestedTag,
  releaseTag,
  assetName,
}) {
  const paths = installPaths(dataDir, attachmentsDir, stateFile);
  await assertSafeInstallPaths(paths);
  const artifact = parseArtifact({ gz, expected, supportedSchemaVersion });
  if (requestedTag && releaseTag && assetName) {
    validateReleaseIdentity({
      manifest: artifact.manifest,
      requestedTag,
      releaseTag,
      assetName,
    });
  }
  await installArtifact({ entries: artifact.entries, paths, state, beforeInstall, afterBackup });
  return artifact.manifest;
}

async function assertSafeInstallPaths(paths) {
  await recoverInterruptedInstall(paths);
  await assertSafePath(paths.root);
  await assertSafePath(paths.data);
  await assertSafePath(paths.attachments);
  if (paths.state) await assertSafePath(paths.state, { file: true });
}

async function installedSnapshotMatches({ artifact, paths, state }) {
  await assertSafeInstallPaths(paths);
  if (!paths.state) return false;

  let installedState;
  let manifestBytes;
  let attachmentEntries;
  try {
    installedState = JSON.parse((await safeReadFile(paths.state)).toString('utf8'));
    manifestBytes = await safeReadFile(join(paths.data, 'manifest.json'));
    attachmentEntries = await readdir(paths.attachments, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return false;
    throw error;
  }
  if (
    !installedState || typeof installedState !== 'object' || Array.isArray(installedState) ||
    Object.keys(installedState).sort().join(',') !== 'checksum,manifestHash,tagName' ||
    installedState.tagName !== state.tagName ||
    installedState.checksum !== state.checksum ||
    installedState.manifestHash !== state.manifestHash ||
    !manifestBytes.equals(artifact.manifestBytes)
  ) {
    return false;
  }

  if (attachmentEntries.some((entry) => !entry.isFile() || entry.isSymbolicLink())) {
    throw new Error('Manifest attachment cache must contain regular files');
  }
  const names = attachmentEntries.map((entry) => entry.name).sort();
  const expectedNames = [...artifact.attachments.keys()].map((path) => basename(path)).sort();
  if (names.length !== expectedNames.length || names.some((name, index) => name !== expectedNames[index])) {
    return false;
  }
  for (const [artifactPath, expectedBytes] of artifact.attachments) {
    const installedBytes = await safeReadFile(join(paths.attachments, basename(artifactPath)));
    if (!installedBytes.equals(expectedBytes)) return false;
  }
  await assertSafeInstallPaths(paths);
  return true;
}

/** Resolve a release, download, verify and atomically install it. */
export async function fetchAndUnpack({
  repo,
  tag,
  token,
  dataDir,
  attachmentsDir,
  supportedSchemaVersion,
  stateFile,
  fetchImpl = fetch,
  beforeInstall,
  afterBackup,
}) {
  const paths = installPaths(dataDir, attachmentsDir, stateFile);
  await assertSafeInstallPaths(paths);
  if (typeof token !== 'string' || !token) {
    throw new Error('Manifest GitHub token is required');
  }
  const repoParts = githubRepo(repo);
  if (!repoParts) throw new Error('Manifest repository must be owner/name');

  const release = await releaseJson({ repo, tag, token, fetchImpl });
  const tagName = release.tag_name;
  if (release.draft !== false || release.prerelease !== false) {
    throw new Error(`release ${tagName} is not a published stable Release`);
  }
  const declaration = parseReleaseDeclaration(release.body);
  if (!declaration) {
    throw new Error(`release ${tagName} body has no exact Artifact and SHA-256 declaration`);
  }
  const { assetName, checksum: expected } = declaration;
  const matchingAssets = Array.isArray(release.assets)
    ? release.assets.filter((candidate) => candidate?.name === assetName)
    : [];
  const [asset] = matchingAssets;
  if (matchingAssets.length !== 1 || !Number.isSafeInteger(asset.id) || asset.id <= 0) {
    throw new Error(`release ${tagName} must have exactly one downloadable Manifest asset`);
  }

  const assetUrl = `${API_BASE}/repos/${repoParts.map(encodeURIComponent).join('/')}/releases/assets/${asset.id}`;
  const res = await fetchImpl(assetUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/octet-stream',
    },
  });
  if (!res.ok) throw new Error(`artifact download failed (${res.status})`);
  const gz = Buffer.from(await res.arrayBuffer());
  const artifact = parseArtifact({ gz, expected, supportedSchemaVersion });
  validateReleaseIdentity({
    manifest: artifact.manifest,
    requestedTag: tag,
    releaseTag: tagName,
    assetName,
  });
  const state = {
    tagName,
    checksum: expected,
    manifestHash: artifact.manifestHash,
  };
  if (await installedSnapshotMatches({ artifact, paths, state })) {
    return { manifest: artifact.manifest, tagName, skipped: true };
  }

  await installArtifact({
    entries: artifact.entries,
    paths,
    state,
    beforeInstall,
    afterBackup,
  });
  return { manifest: artifact.manifest, tagName, skipped: false };
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
      const gz = await readFile(args[fromIdx + 1]);
      const expected = shaIdx >= 0 ? args[shaIdx + 1] : null;
      await unpackArtifact({ gz, expected, supportedSchemaVersion, dataDir, attachmentsDir });
      console.log(`unpacked local artifact → ${dataDir}`);
    } else if (!token) {
      // Local-first build (deploy-portfolio prepares data via --from and
      // clears MANIFEST_GITHUB_TOKEN): skip when a valid Manifest is already
      // installed, otherwise require a token.
      let installed = false;
      try {
        const parsed = JSON.parse((await readFile(join(dataDir, 'manifest.json'), 'utf8')).toString());
        installed = parsed?.schemaVersion === supportedSchemaVersion &&
          Array.isArray(parsed.items) && parsed.items.length > 0 &&
          /^[0-9a-f]{40}$/.test(parsed.sourceCommit ?? '');
      } catch (error) {
        if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
      }
      if (!installed) {
        throw new Error('MANIFEST_GITHUB_TOKEN is required unless --from is used');
      }
      console.log('manifest already installed — skip');
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
