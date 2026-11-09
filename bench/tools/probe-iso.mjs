import { chromium } from 'playwright-core';
import { startServer } from '../lib/server.mjs';

const project = process.argv[2] ?? 'v015';
const scenarioMap = process.argv[3] ?? 'large';
const levels = (process.argv[4] ?? '2.5,3.5,4.5').split(',').map(Number);
const engineMode = process.argv[5] ?? (project === 'v015' ? 'none' : 'blob-worker');
const file = scenarioMap === 'large' ? 'emd_55357.map.gz' : 'emd_10275.map.gz';

const server = await startServer({ outDir: new URL('../out/' + project, import.meta.url).pathname });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await page.goto(server.url);
await page.waitForFunction(() => !!globalThis.__bench);
const config = engineMode === 'none'
  ? { engineMode: 'none' }
  : { engineMode, wasmUrl: '/molstudio-wasm-engine.wasm', workerUrl: '/molstudio-worker.js' };
console.log('init', JSON.stringify(await page.evaluate((c) => globalThis.__bench.initStudio(c), config)));
await page.evaluate((args) => globalThis.__bench.prepareMap(args.url, args.label), { url: '/fixtures/' + file, label: scenarioMap });
const loaded = await page.evaluate((label) => globalThis.__bench.loadVolume(label), scenarioMap);
console.log('load', loaded.readyMs + 'ms', 'engine', JSON.stringify(loaded.info.engine), 'dims', loaded.info.effectiveDims.join('x'));
const summary = (info) => ({ geom: info.reps[0].geometryVersion, verts: info.reps[0].vertexCount, texVerts: info.reps[0].textureVertexCount, snap: info.snapshot.isoLevel, tech: info.reps[0].geometryType });
for (const level of levels) {
  const measured = await page.evaluate((value) => globalThis.__bench.measureIso(value), level);
  console.log('measure', level, measured.readyMs + 'ms', JSON.stringify(summary(measured.info)));
}
await browser.close();
await server.close();