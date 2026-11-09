// Downloads (or copies) the benchmark map fixtures and records their provenance.
//
//   node fixtures/fetch-maps.mjs                 # restore everything in MANIFEST.json
//   node fixtures/fetch-maps.mjs --large EMD-1234  # pick/replace the large map
//
// The .map.gz files are gitignored; MANIFEST.json is committed so the benchmark is
// reproducible from the accessions alone.
import path from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { createGunzip } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { ensureDerivedFixture } from './derive-nonperiodic.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = here;
const manifestPath = path.join(fixturesDir, 'MANIFEST.json');
const MOLSTUDIO_FIXTURE = path.join(process.env.HOME ?? '', 'repo', 'molstudio', 'bench', 'fixtures', 'emd_10275.map.gz');

const EMDB_URL = (accession) => 'https://ftp.ebi.ac.uk/pub/databases/emdb/structures/' + accession + '/map/' + accession.toLowerCase().replace('-', '_') + '.map.gz';

async function sha256(filePath) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(filePath), hash);
  return hash.digest('hex');
}

async function readCcp4Dims(filePath) {
  const gunzip = createGunzip();
  const source = createReadStream(filePath);
  source.pipe(gunzip);
  const chunks = [];
  let length = 0;
  for await (const chunk of gunzip) {
    chunks.push(chunk);
    length += chunk.length;
    if (length >= 12) break;
  }
  source.destroy();
  const header = Buffer.concat(chunks).subarray(0, 12);
  if (header.length < 12) throw new Error('truncated ccp4 header in ' + filePath);
  return { dims: [header.readInt32LE(0), header.readInt32LE(4), header.readInt32LE(8)], uncompressedBytes: null, length };
}

async function gunzipTo(filePath, targetPath) {
  const gunzip = createGunzip();
  await pipeline(createReadStream(filePath), gunzip, createWriteStream(targetPath));
  const stat = await fs.stat(targetPath);
  await fs.rm(targetPath);
  return stat.size;
}

async function download(url, targetPath) {
  console.log('downloading ' + url);
  const response = await fetch(url);
  if (!response.ok) throw new Error('download failed: HTTP ' + response.status + ' ' + url);
  const tempPath = targetPath + '.part';
  await pipeline(response.body, createWriteStream(tempPath));
  await fs.rename(tempPath, targetPath);
  console.log('saved ' + path.basename(targetPath));
}

async function entryFor(name, accession, file) {
  const filePath = path.join(fixturesDir, file);
  const { dims } = await readCcp4Dims(filePath);
  const uncompressedBytes = await gunzipTo(filePath, path.join('/tmp', file + '.raw'));
  const stat = await fs.stat(filePath);
  return {
    name,
    accession,
    file,
    dims,
    voxels: dims[0] * dims[1] * dims[2],
    compressedBytes: stat.size,
    uncompressedBytes,
    sha256: await sha256(filePath),
    sourceUrl: EMDB_URL(accession),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const largeIndex = args.indexOf('--large');
  const largeAccession = largeIndex >= 0 ? args[largeIndex + 1] : null;
  if (largeIndex >= 0 && !largeAccession) throw new Error('--large needs an EMD accession');

  let manifest = { maps: [] };
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  } catch {
    manifest = { maps: [] };
  }
  const maps = new Map(manifest.maps.map((entry) => [entry.name, entry]));

  // 300^3 single-particle map: copy the fixture shipped in the molstudio repo when present.
  const emdPath = path.join(fixturesDir, 'emd_10275.map.gz');
  let haveEmd = await fs.access(emdPath).then(() => true, () => false);
  if (!haveEmd) {
    const copied = await fs.copyFile(MOLSTUDIO_FIXTURE, emdPath).then(() => true, () => false);
    if (!copied) await download(EMDB_URL('emd_10275'), emdPath);
  }
  maps.set('emd_10275', await entryFor('emd_10275', 'EMD-10275', 'emd_10275.map.gz'));
  // Derived fixture: regenerated from the restored base map, never downloaded.
  await ensureDerivedFixture(maps);

  const largeEntry = maps.get('large');
  const wantedLarge = largeAccession ? 'EMD-' + largeAccession.replace(/^EMD-/i, '') : largeEntry?.accession ?? null;
  if (!wantedLarge) throw new Error('no large map selected; pass --large EMD-XXXXX');
  const largeFile = wantedLarge.toLowerCase().replace('-', '_') + '.map.gz';
  const largePath = path.join(fixturesDir, largeFile);
  const haveLarge = await fs.access(largePath).then(() => true, () => false);
  if (!haveLarge) await download(EMDB_URL(wantedLarge.toLowerCase().replace('-', '_')), largePath);
  maps.set('large', await entryFor('large', wantedLarge.toUpperCase(), largeFile));
  // Drop stale large fixtures from earlier picks.
  for (const entry of [...maps.values()]) {
    if (entry.name === 'large' && entry.file !== largeFile) {
      await fs.rm(path.join(fixturesDir, entry.file), { force: true });
      maps.delete('large');
    }
  }
  maps.set('large', await entryFor('large', wantedLarge.toUpperCase(), largeFile));

  const output = { generatedAt: new Date().toISOString(), maps: [...maps.values()].sort((a, b) => a.name.localeCompare(b.name)) };
  await fs.writeFile(manifestPath, JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
