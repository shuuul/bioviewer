// Renders bench/results/*.json into the markdown tables used by bench/RESULTS.md.
// Run: node report.mjs [--out bench-results.md]
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ORDER = ['v015', 'after'];

async function loadResults() {
  const dir = path.join(here, 'results');
  const files = (await fs.readdir(dir).catch(() => [])).filter((file) => file.endsWith('.json') && !file.includes('swiftshader'));
  const results = [];
  for (const file of files) {
    const parsed = JSON.parse(await fs.readFile(path.join(dir, file), 'utf8'));
    if (parsed.gpuMode && parsed.gpuMode !== 'hardware') continue;
    results.push(parsed);
  }
  return results;
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const fmt = (value) => (value === null || value === undefined || Number.isNaN(value) ? '–' : Math.round(value) + ' ms');
const stats = (values) => {
  const clean = values.filter((value) => typeof value === 'number' && !Number.isNaN(value));
  if (!clean.length) return null;
  return { median: median(clean), min: Math.min(...clean), max: Math.max(...clean), n: clean.length };
};
const cell = (measured) => (measured ? fmt(measured.median) + ' (' + fmt(measured.min) + '–' + fmt(measured.max).replace(' ms', '') + ', n=' + measured.n + ')' : '–');
const ratio = (before, after) => (before && after && after.median > 0 ? (before.median / after.median).toFixed(1) + '×' : '–');

function repTimings(rep) {
  if (!rep || rep.error) return null;
  const out = { load: rep.load?.readyMs ?? null, iso: {}, style: rep.style?.readyMs ?? null };
  for (const step of rep.iso ?? []) out.iso[step.isoLevel] = step.readyMs;
  return out;
}

function tierEvidence(scenario) {
  const reps = scenario.reps.filter((rep) => !rep.error);
  const rep = reps[0];
  if (!rep) return 'all reps failed: ' + (scenario.reps[0]?.error ?? 'unknown');
  const info = rep.load?.info;
  const engineClass = info?.engine?.class ?? (info?.engine?.state === 'not started' ? 'engine not started (lazy)' : 'null (no engine)');
  const parts = [engineClass];
  if (info?.engine?.state === 'starting' && !info?.engine?.class) parts.push('engine start resolved to no engine (unavailable tier)');
  else if (info?.engine?.state && info.engine.state !== 'started') parts.push('engine ' + info.engine.state);
  if (rep.diagnostics?.inst?.wasmInstantiateCalls) parts.push('page instantiated wasm');
  const workers = (rep.diagnostics?.inst?.workers ?? []).map((worker) => {
    const kinds = Object.entries(worker.outKinds ?? {}).map(([kind, count]) => (count > 1 ? kind + '×' + count : kind)).join(',');
    const ready = worker.ready?.length
      ? 'ready:' + worker.ready.join(',') + (worker.readyAfterInitMs ? ' after ' + worker.readyAfterInitMs + ' ms' : '')
      : 'no ready';
    return '[' + kinds + '; ' + ready + ']';
  });
  // Each worker is separate evidence. 0.1.7 spawned a one-shot downsample
  // worker then an engine worker; 0.1.8 downsamples in-process and typically
  // has no worker on a GPU solid.
  if (workers.length) parts.push('workers ' + workers.join(' → '));
  const workerErrors = (rep.diagnostics?.inst?.workers ?? []).flatMap((worker) => worker.errors ?? []);
  if (workerErrors.length) parts.push('worker errors ' + JSON.stringify(workerErrors));
  parts.push('geometry ' + (info?.reps?.[0]?.geometryType ?? '?'));
  const surface = info?.reps?.[0]?.textureVertexCount;
  if (surface) parts.push('surface ' + surface + ' verts');
  if (info?.downsampleFactor && info.downsampleFactor !== 1) parts.push('grid downsampled ' + info.downsampleFactor + '× → ' + (info.effectiveDims ?? []).join('×'));
  if (info?.sourcePeriodic !== null && info?.sourcePeriodic !== undefined) parts.push('periodic=' + info.sourcePeriodic + ', effective periodic=' + info.effectivePeriodic);
  return parts.join('; ');
}

function render(scenarioName, byGpu, scenarioMeta) {
  const lines = [];
  for (const [gpu, projects] of byGpu) {
    // Only the projects that actually ran this scenario take a column, so control
    // rows (control scenarios that only 0.1.7 ran) stay readable.
    const present = PROJECT_ORDER
      .map((name) => ({ name, result: projects[name], scenario: projects[name]?.scenarios.find((scenario) => scenario.name === scenarioName) }))
      .filter((entry) => entry.scenario);
    if (!present.length) continue;
    const meta = scenarioMeta.get(scenarioName) ?? {};
    lines.push('### ' + gpu + ' — ' + scenarioName);
    lines.push('');
    lines.push((meta.about ?? present[0].scenario.about) + '.');
    const map = present[0].scenario.map;
    lines.push('');
    lines.push('Map: ' + map.accession + ', ' + map.dims.join('×') + ' (' + (map.voxels / 1e6).toFixed(1) + 'M voxels), representation ' + (present[0].scenario.style ?? '?') + '.');
    lines.push('');
    const labels = present.map((entry) => entry.result?.coreVersion ?? entry.name);
    const header = ['metric', ...labels];
    if (present.length > 1) {
      header.push(labels[0] + ' ÷ ' + labels[labels.length - 1]);
      if (present.length > 2) header.push(labels[labels.length - 2] + ' ÷ ' + labels[labels.length - 1]);
    }
    lines.push('| ' + header.join(' | ') + ' |');
    lines.push('|' + header.map(() => '---').join('|') + '|');
    const collect = (session, pick) => (session ? stats(session.reps.map(pick).filter((value) => value !== null && value !== undefined && typeof value === 'number')) : null);
    const row = (label, pick) => {
      const cells = present.map((entry) => cell(collect(entry.scenario, pick)));
      const values = present.map((entry) => collect(entry.scenario, pick));
      const tail = [];
      if (present.length > 1) {
        tail.push(ratio(values[0], values[values.length - 1]));
        if (present.length > 2) tail.push(ratio(values[values.length - 2], values[values.length - 1]));
      }
      lines.push('| ' + [label, ...cells, ...tail].join(' | ') + ' |');
    };
    row('load → first surface', (rep) => repTimings(rep)?.load);
    const levels = [...new Set(present.flatMap((entry) => entry.scenario.isoLevels ?? []))];
    for (const level of levels) row('iso ' + level + 'σ', (rep) => repTimings(rep)?.iso[level]);
    if (present.some((entry) => entry.scenario.style === 'wireframe')) row('style switch → wireframe', (rep) => repTimings(rep)?.style);
    lines.push('');
    for (const entry of present) lines.push('- ' + (entry.result?.coreVersion ?? entry.name) + ' tier: ' + tierEvidence(entry.scenario));
    lines.push('');
  }
  return lines.join('\n');
}

async function main() {
  const results = await loadResults();
  if (!results.length) throw new Error('no results in bench/results');
  // Several files can describe the same project/gpu pair (a partial run writes its own
  // file), so merge them per project instead of letting the last file win.
  const groups = new Map();
  for (const result of results) {
    if (!groups.has(result.gpuMode)) groups.set(result.gpuMode, {});
    const perGpu = groups.get(result.gpuMode);
    if (!perGpu[result.project]) perGpu[result.project] = { ...result, scenarios: [] };
    for (const scenario of result.scenarios) {
      const existing = perGpu[result.project].scenarios.findIndex((entry) => entry.name === scenario.name);
      if (existing >= 0) {
        if (scenario.reps.length >= perGpu[result.project].scenarios[existing].reps.length) perGpu[result.project].scenarios[existing] = scenario;
      } else {
        perGpu[result.project].scenarios.push(scenario);
      }
    }
  }
  const scenarioMeta = new Map();
  for (const result of results) for (const scenario of result.scenarios) scenarioMeta.set(scenario.name, scenario);
  const names = [...new Set(results.flatMap((result) => result.scenarios.map((scenario) => scenario.name)))];
  const sections = [];
  for (const name of names) sections.push(render(name, groups, scenarioMeta));
  const out = sections.join('\n');
  const outIndex = process.argv.indexOf('--out');
  const target = outIndex >= 0 ? process.argv[outIndex + 1] : null;
  if (target) await fs.writeFile(path.resolve(target), out);
  else console.log(out);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});