// Headless benchmark driver for the BioViewer volume pipeline.
//
//   node run.mjs --project v015|after [--gpu hardware] [--scenario name]
//                [--reps N] [--out results/foo.json]
//
// v015 = pinned 0.1.5, after = the repository root install (0.1.8).
// Comparison numbers are hardware GPU only. --gpu swiftshader remains for
// diagnostics and is not ingested by report.mjs.
//
// --trace records phase marks inside the page (state-build cells, load boundaries, heap) for
// one rep; the marks land in results/*.json under load.marks. Committed numbers never use it.
//
// Every rep runs in a fresh page (fresh JS heap) against the harness bundle built for the
// project. Results are raw JSON; report.mjs renders them into markdown tables.
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildProject, PROJECTS, benchDir, rootDir } from './lib/build.mjs';
import { startServer } from './lib/server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.BENCH_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const GPU_ARGS = {
  // Default headless Chrome on this Mac reports ANGLE/Metal with a 16384 texture limit.
  hardware: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
  // Diagnostics only: software rasterizer. Not part of the 0.1.5 vs 0.1.8 table.
  swiftshader: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
};

const SCENARIOS = [
  {
    name: 'emd10275-solid',
    map: 'emd_10275',
    style: 'solid',
    isoLevels: [1.5, 2.5, 3.5],
    reps: 5,
    about: 'EMD-10275 full-size map, solid isosurface, three iso levels (periodic; GPU on hardware)',
  },
  {
    name: 'emd10275-wireframe',
    map: 'emd_10275',
    style: 'wireframe',
    isoLevels: [1.5, 2.5, 3.5],
    reps: 5,
    about: 'EMD-10275 wireframe (CPU lines path; wasm on 0.1.8)',
  },
  {
    name: 'large-solid',
    map: 'large',
    style: 'solid',
    isoLevels: [2.5, 3.5, 4.5],
    reps: 3,
    about: 'Large map whose packed GPU texture exceeds the texture limit, solid isosurface',
  },
];

function scenariosFor(projectName) {
  const engineMode = projectName === 'v015' ? 'none' : 'blob-worker';
  return SCENARIOS.map((scenario) => ({ ...scenario, engineMode }));
}

function parseArgs(argv) {
  const options = { project: 'v015', gpu: 'hardware', scenarios: [], reps: null, out: null, trace: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--project') options.project = argv[++i];
    else if (arg === '--gpu') options.gpu = argv[++i];
    else if (arg === '--scenario') options.scenarios.push(argv[++i]);
    else if (arg === '--reps') options.reps = Number(argv[++i]);
    else if (arg === '--out') options.out = argv[++i];
    else if (arg === '--trace') options.trace = true;
    else throw new Error('unknown argument: ' + arg);
  }
  if (!PROJECTS[options.project]) throw new Error('unknown project: ' + options.project);
  if (!GPU_ARGS[options.gpu]) throw new Error('unknown gpu mode: ' + options.gpu);
  return options;
}

async function readManifest() {
  const manifestPath = path.join(benchDir, 'fixtures', 'MANIFEST.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const maps = new Map(manifest.maps.map((entry) => [entry.name, entry]));
  for (const [name, entry] of maps) {
    const filePath = path.join(benchDir, 'fixtures', entry.file);
    try {
      await fs.access(filePath);
    } catch {
      throw new Error('missing fixture ' + entry.file + ' for map "' + name + '"; run node fixtures/fetch-maps.mjs');
    }
  }
  return maps;
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label + ' timed out after ' + ms + 'ms')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function runRep(browser, url, scenario, map, project, cspVariant) {
  const rep = {
    scenario: scenario.name,
    engineMode: scenario.engineMode,
    startedAt: new Date().toISOString(),
    // Recorded because a trace run is only interpretable if nothing else was using the CPU.
    loadAvg1: Math.round(os.loadavg()[0] * 100) / 100,
    console: [],
    error: null,
  };
  const page = await browser.newPage();
  page.setDefaultTimeout(30_000);
  page.on('console', (message) => {
    const text = message.text();
    rep.console.push({ type: message.type(), text: text.slice(0, 500) });
  });
  page.on('pageerror', (error) => rep.console.push({ type: 'pageerror', text: String(error.message).slice(0, 500) }));
  page.on('requestfailed', (request) => rep.console.push({ type: 'requestfailed', text: request.url() + ' ' + (request.failure()?.errorText ?? '') }));

  try {
    await page.goto(url + (cspVariant ? '?csp=' + cspVariant : ''), { waitUntil: 'load', timeout: 60_000 });
    await page.waitForFunction(() => !!globalThis.__bench, null, { timeout: 60_000 });
    rep.init = await withTimeout(
      page.evaluate((config) => globalThis.__bench.initStudio(config), {
        engineMode: scenario.engineMode,
        wasmUrl: '/molstudio-wasm-engine.wasm',
        workerUrl: '/molstudio-worker.js',
        timeoutMs: 600_000,
        trace: !!scenario.trace,
      }),
      120_000,
      'initStudio',
    );
    rep.prepare = await withTimeout(
      page.evaluate((args) => globalThis.__bench.prepareMap(args.url, args.label), { url: '/fixtures/' + map.file, label: map.name }),
      300_000,
      'prepareMap',
    );
    rep.load = await withTimeout(page.evaluate((label) => globalThis.__bench.loadVolume(label), map.name), 900_000, 'loadVolume');
    if (scenario.style === 'wireframe') {
      rep.style = await withTimeout(page.evaluate((style) => globalThis.__bench.measureStyle(style), 'wireframe'), 900_000, 'setVolumeStyle');
    }
    rep.warmup = await withTimeout(page.evaluate((level) => globalThis.__bench.measureIso(level), scenario.isoLevels[0] + 0.7), 900_000, 'warmupIso');
    rep.iso = [];
    for (const level of scenario.isoLevels) {
      rep.iso.push(await withTimeout(page.evaluate((value) => globalThis.__bench.measureIso(value), level), 900_000, 'iso ' + level));
    }
    const beforeGc = await page.evaluate(() => globalThis.__bench.captureGc());
    rep.diagnostics = await page.evaluate(() => globalThis.__bench.diagnostics());
    rep.dispose = await page.evaluate(() => globalThis.__bench.disposeStudio());
  } catch (error) {
    rep.error = String(error?.message ?? error);
  } finally {
    await page.close().catch(() => {});
  }
  return rep;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const maps = await readManifest();
  const build = await buildProject(options.project);
  const server = await startServer({ outDir: build.outDir });
  const scenarioList = scenariosFor(options.project)
    .filter((scenario) => options.scenarios.length === 0 || options.scenarios.includes(scenario.name));
  if (options.trace) {
    for (const scenario of scenarioList) scenario.trace = true;
    console.log('trace mode: recording load phase marks (1 rep is enough, the marks are the output)');
  }

  const machine = {
    platform: process.platform + ' ' + process.arch,
    release: os.release(),
    cpu: os.cpus()[0]?.model ?? 'unknown',
    cpuCount: os.cpus().length,
    totalMemGiB: Math.round(os.totalmem() / 2 ** 30 * 10) / 10,
    node: process.version,
    loadAvg1: Math.round(os.loadavg()[0] * 100) / 100,
  };

  // One run can cover a subset of the scenarios, so an existing file for the same
  // project/gpu keeps the scenarios this run does not cover (a partial or per-scenario
  // run then still leaves one complete file for report.mjs).
  const outPath = options.out ?? path.join(benchDir, 'results', options.project + '-' + options.gpu + '.json');
  let previous = null;
  try {
    previous = JSON.parse(await fs.readFile(outPath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  let browser;
  const result = {
    project: options.project,
    label: build.label,
    coreVersion: build.coreVersion,
    molstarVersion: build.molstarVersion,
    gpuMode: options.gpu,
    generatedAt: new Date().toISOString(),
    machine,
    browser: null,
    gl: null,
    scenarios: [],
  };

  try {
    browser = await chromium.launch({
      executablePath: CHROME,
      headless: true,
      args: [
        '--enable-precise-memory-info',
        '--js-flags=--expose-gc',
        '--no-first-run',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        ...GPU_ARGS[options.gpu],
      ],
    });
    result.browser = browser.version();

    for (const scenario of scenarioList) {
      const map = maps.get(scenario.map);
      if (!map) throw new Error('no fixture for map "' + scenario.map + '"');
      const reps = options.reps ?? scenario.reps;
      const entry = {
        name: scenario.name,
        about: scenario.about,
        engineMode: scenario.engineMode,
        style: scenario.style,
        isoLevels: scenario.isoLevels,
        trace: !!scenario.trace,
        reps: [],
        map: { name: map.name, file: map.file, dims: map.dims, accession: map.accession, voxels: map.dims[0] * map.dims[1] * map.dims[2] },
        cspVariant: scenario.cspVariant ?? null,
      };
      console.log('scenario ' + scenario.name + ' (' + scenario.engineMode + ', ' + reps + ' reps)');
      for (let i = 0; i < reps; i++) {
        const rep = await runRep(browser, server.url, scenario, map, options.project, scenario.cspVariant);
        entry.reps.push(rep);
        const load = rep.load?.readyMs ?? 'ERR';
        const iso = rep.iso?.map((step) => step.readyMs).join('/') ?? 'ERR';
        const tier = rep.diagnostics?.volume?.engine?.class ?? 'no-engine';
        console.log('  rep ' + (i + 1) + ': load ' + load + 'ms, iso ' + iso + 'ms, tier ' + tier + (rep.error ? ' ERROR ' + rep.error : ''));
      }
      const first = entry.reps.find((rep) => rep.init?.gl)?.init?.gl;
      if (first) result.gl = first;
      result.scenarios.push(entry);
      await fs.mkdir(path.join(benchDir, 'results'), { recursive: true });
      const merged = {
        ...result,
        scenarios: [
          ...(previous?.scenarios ?? []).filter((old) => !result.scenarios.some((current) => current.name === old.name)),
          ...result.scenarios,
        ],
      };
      await fs.writeFile(outPath, JSON.stringify(merged, null, 2));
      console.log('wrote ' + path.relative(rootDir, outPath));
    }
  } finally {
    await browser?.close().catch(() => {});
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});