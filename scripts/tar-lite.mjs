// Minimal ustar tar writer/reader — stdlib only. Vendored from the Notebook
// delivery contract (scripts/manifest/tar.mjs); do not diverge from that file.
// Supports regular files under 100-byte names.

const BLOCK = 512;

function octal(num, len) {
  return num.toString(8).padStart(len - 1, '0') + '\0';
}

function buildHeader(name, size, typeflag = '0') {
  if (!name || name.includes('\0') || Buffer.byteLength(name, 'utf8') > 100) {
    throw new Error(`tar entry name is invalid or exceeds 100 bytes: ${name}`);
  }
  const buf = Buffer.alloc(BLOCK);
  buf.write(name, 0, 100, 'utf8'); // name (100)
  buf.write('0000644\0', 100, 8, 'utf8'); // mode
  buf.write('0000000\0', 108, 8, 'utf8'); // uid
  buf.write('0000000\0', 116, 8, 'utf8'); // gid
  buf.write(octal(size, 12), 124, 12, 'utf8'); // size
  buf.write('00000000000\0', 136, 12, 'utf8'); // mtime = 0 (deterministic)
  buf.write('        ', 148, 8, 'utf8'); // chksum placeholder (8 spaces)
  buf.write(typeflag, 156, 1, 'utf8'); // typeflag
  buf.write('ustar\0', 257, 6, 'utf8'); // magic
  buf.write('00', 263, 2, 'utf8'); // version
  // uname/gname/devmajor/devminor/prefix left as zeros

  let sum = 0;
  for (const byte of buf) sum += byte;
  buf.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'utf8');
  return buf;
}

/** Pack entries [{ name, data: Buffer }] into a tar archive Buffer. */
export function createTar(entries) {
  const chunks = [];
  for (const { name, data } of entries) {
    chunks.push(buildHeader(name, data.length));
    chunks.push(data);
    const pad = (BLOCK - (data.length % BLOCK)) % BLOCK;
    if (pad) chunks.push(Buffer.alloc(pad));
  }
  chunks.push(Buffer.alloc(BLOCK * 2));
  return Buffer.concat(chunks);
}

function parseOctalField(header, start, length, label) {
  const field = header.subarray(start, start + length);
  const end = field.indexOf(0);
  if (end >= 0 && !field.subarray(end + 1).every((byte) => byte === 0 || byte === 0x20)) {
    throw new Error(`tar ${label} field has hidden bytes`);
  }
  const raw = field.subarray(0, end < 0 ? field.length : end).toString('latin1');
  if (!/^ *[0-7]+ *$/.test(raw)) {
    throw new Error(`tar ${label} field is invalid`);
  }
  return Number.parseInt(raw.trim(), 8);
}

function verifyHeader(header) {
  if (header.subarray(257, 263).toString('ascii') !== 'ustar\0') {
    throw new Error('tar header has invalid magic');
  }
  if (header.subarray(263, 265).toString('ascii') !== '00') {
    throw new Error('tar header has invalid version');
  }
  parseOctalField(header, 100, 8, 'mode');
  parseOctalField(header, 108, 8, 'uid');
  parseOctalField(header, 116, 8, 'gid');
  parseOctalField(header, 136, 12, 'mtime');
  const expected = parseOctalField(header, 148, 8, 'checksum');
  if (header[156] !== 0x30) throw new Error('tar contains an unsupported entry type');
  if (!header.subarray(157, 257).every((byte) => byte === 0)) {
    throw new Error('tar regular file linkname is unsupported');
  }
  if (!header.subarray(329, 345).every((byte) => byte === 0)) {
    throw new Error('tar regular file device fields are unsupported');
  }
  if (!header.subarray(500, 512).every((byte) => byte === 0)) {
    throw new Error('tar header reserved bytes are not zero-filled');
  }
  let actual = 0;
  for (let index = 0; index < header.length; index += 1) {
    actual += index >= 148 && index < 156 ? 0x20 : header[index];
  }
  if (actual !== expected) throw new Error('tar header checksum mismatch');
}

/** Unpack a strict ustar archive Buffer into [{ name, data }]. */
export function extractTar(archive) {
  if (!Buffer.isBuffer(archive) || archive.length < BLOCK * 2 || archive.length % BLOCK !== 0) {
    throw new Error('tar archive is truncated');
  }

  const out = [];
  let offset = 0;
  let zeroBlocks = 0;
  while (offset + BLOCK <= archive.length) {
    const header = archive.subarray(offset, offset + BLOCK);
    if (header.every((byte) => byte === 0)) {
      zeroBlocks += 1;
      offset += BLOCK;
      if (zeroBlocks === 2) {
        if (!archive.subarray(offset).every((byte) => byte === 0)) {
          throw new Error('tar archive has data after the end marker');
        }
        return out;
      }
      continue;
    }
    if (zeroBlocks) throw new Error('tar archive has an incomplete end marker');

    verifyHeader(header);
    if (!header.subarray(345, 500).every((byte) => byte === 0)) {
      throw new Error('tar header prefix is unsupported');
    }
    const nameField = header.subarray(0, 100);
    const nameEnd = nameField.indexOf(0);
    if (nameEnd >= 0 && !nameField.subarray(nameEnd + 1).every((byte) => byte === 0)) {
      throw new Error('tar name field has hidden bytes');
    }
    const name = nameField.subarray(0, nameEnd < 0 ? nameField.length : nameEnd).toString('utf8');
    const size = parseOctalField(header, 124, 12, 'size');
    const dataStart = offset + BLOCK;
    const dataEnd = dataStart + size;
    const next = dataStart + Math.ceil(size / BLOCK) * BLOCK;
    if (dataEnd > archive.length || next > archive.length) throw new Error('tar entry is truncated');
    if (!archive.subarray(dataEnd, next).every((byte) => byte === 0)) {
      throw new Error('tar entry padding is not zero-filled');
    }
    if (header[156] !== 0x30 || !name) throw new Error('tar contains an unsupported entry type');
    out.push({ name, data: Buffer.from(archive.subarray(dataStart, dataEnd)) });
    offset = next;
  }
  throw new Error('tar archive has no complete end marker');
}
