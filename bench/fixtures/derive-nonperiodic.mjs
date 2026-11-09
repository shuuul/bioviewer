// Derives the non-periodic EMD-10275 fixture used for the lazy-engine measurements.
//
// Mol* decides periodicity from the grid, not from the symmetry records:
// mol-model-formats/volume/ccp4.js sets periodicity 'xyz' only when the header sampling
// counts (NC/NR/NS) equal the grid dimensions (NX/NY/NZ). Stripping NSYMBT alone would
// therefore leave the volume periodic, so this copy changes both:
//   - NC/NR/NS = 299 (one voxel short of the 300³ grid) -> dimensions/grid != 1
//   - ISPG = 0 and NSYMBT = 0                            -> no spacegroup / symmetry records
// Voxel data and grid dimensions are untouched; the fractional box shrinks by 1/300 per
// axis (voxels become 319.5/299 Å). It is a benchmark vehicle for a GPU-eligible volume,
// not an equivalent copy of EMD-10275.
import path from 'node:path';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = here;

const HEADER = {
  NX: 0,
  NY: 4,
  NZ: 8,
  MODE: 12,
  NC: 28,
  NR: 32,
  NS: 36,
  ISPG: 88,
  NSYMBT: 92,
};

export const DERIVED_FILE = 'emd_10275_nonperiodic.map.gz';
export const DERIVED_FROM = 'emd_10275';

export function deriveNonPeriodic(raw) {
  const dims = [raw.readInt32LE(HEADER.NX), raw.readInt32LE(HEADER.NY), raw.readInt32LE(HEADER.NZ)];
  const size = raw.length - 1024;
  if (dims.some((dim) => dim <= 0) || size !== dims[0] * dims[1] * dims[2] * 4) {
    throw new Error('unexpected ccp4 payload: dims ' + dims.join('x') + ', data bytes ' + size);
  }
  const copy = Buffer.from(raw);
  copy.writeInt32LE(dims[0] - 1, HEADER.NC);
  copy.writeInt32LE(dims[1] - 1, HEADER.NR);
  copy.writeInt32LE(dims[2] - 1, HEADER.NS);
  copy.writeInt32LE(0, HEADER.ISPG);
  copy.writeInt32LE(0, HEADER.NSYMBT);
  return { buffer: copy, dims };
}

async function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function deriveFixture(baseFile) {
  const basePath = path.join(fixturesDir, baseFile);
  const { buffer, dims } = deriveNonPeriodic(await fs.readFile(basePath).then((gz) => gunzipSync(gz)));
  const gz = gzipSync(buffer);
  await fs.writeFile(path.join(fixturesDir, DERIVED_FILE), gz);
  return {
    name: 'emd_10275_nonperiodic',
    accession: 'EMD-10275 (header-modified copy)',
    file: DERIVED_FILE,
    dims,
    voxels: dims[0] * dims[1] * dims[2],
    compressedBytes: gz.length,
    uncompressedBytes: buffer.length,
    sha256: await sha256(gz),
    derivedFrom: DERIVED_FROM,
    modifications: [
      'NC/NR/NS set to 299 (one voxel short of the 300³ grid) so Mol* reports periodicity "none"',
      'ISPG set to 0 and NSYMBT set to 0 (no spacegroup / symmetry records)',
      'voxel data and grid dimensions unchanged; cell stays 319.5 Å',
    ],
  };
}

// fetch-maps.mjs calls this after restoring the base fixture so a fresh checkout can
// regenerate the derived file from the manifest alone.
export async function ensureDerivedFixture(maps) {
  const base = maps.get(DERIVED_FROM);
  if (!base) throw new Error('cannot derive ' + DERIVED_FILE + ': base fixture ' + DERIVED_FROM + ' missing');
  const entry = await deriveFixture(base.file);
  maps.set(entry.name, { ...entry, sourceUrl: base.sourceUrl });
  return entry;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const manifestPath = path.join(fixturesDir, 'MANIFEST.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const maps = new Map(manifest.maps.map((entry) => [entry.name, entry]));
  const entry = await ensureDerivedFixture(maps);
  const output = { ...manifest, generatedAt: new Date().toISOString(), maps: [...maps.values()].sort((a, b) => a.name.localeCompare(b.name)) };
  await fs.writeFile(manifestPath, JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(entry, null, 2));
}
