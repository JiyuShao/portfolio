// Minimal ustar tar writer/reader — stdlib only. Vendored from the Notebook
// delivery contract (scripts/manifest/tar.mjs); do not diverge from that file.
// Supports regular files and directory entries under 100-char names.

const BLOCK = 512;

function octal(num, len) {
  return num.toString(8).padStart(len - 1, '0') + '\0';
}

function buildHeader(name, size, typeflag = '0') {
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

  // Compute checksum: sum of all header bytes with chksum as spaces
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
  chunks.push(Buffer.alloc(BLOCK * 2)); // end-of-archive marker
  return Buffer.concat(chunks);
}

/** Unpack a tar archive Buffer into [{ name, data }]. Skips directories. */
export function extractTar(archive) {
  const out = [];
  let offset = 0;
  while (offset + BLOCK <= archive.length) {
    const header = archive.subarray(offset, offset + BLOCK);
    if (header.every((b) => b === 0)) break; // end marker

    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const sizeStr = header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim();
    const size = parseInt(sizeStr, 8) || 0;
    const typeflag = header[156];

    if (typeflag === 0x30 /* '0' */ && name) {
      const data = archive.subarray(offset + BLOCK, offset + BLOCK + size);
      out.push({ name, data: Buffer.from(data) });
    }
    offset += BLOCK + Math.ceil(size / BLOCK) * BLOCK;
  }
  return out;
}
