# Volume surface benchmark

Headless, reproducible end-to-end benchmark for the BioViewer studio viewer volume
surface pipeline (`@molstudio/core` + Mol*). It renders a real Mol* canvas in headless
Chrome, so the numbers include parsing, grid preparation, isosurface extraction, mesh
upload and the frame that follows — not just a kernel.

Two projects share one harness source and are bundled against different installs, so the
comparison runs in one session with the same page, CSP, scenarios and instrumentation:

| project | resolves | represents |
|---|---|---|
| `v015` | `bench/v015/node_modules` | `@molstudio/core@0.1.5`, `@molstudio/react@0.1.5`, `molstar@5.13.1` (pre-wasm: no `compute/` worker, no `assets/` wasm) |
| `after` | repository root `node_modules` + `dist/webview/molstudio-worker.js` + `dist/molstudio/molstudio-wasm-engine.wasm` | whatever the extension currently builds and ships — now `@molstudio/core@0.1.9` (the recorded results were measured on 0.1.8: GPU path for periodic solids, in-process wasm downsample, lazy CPU engine) |

The 0.1.5 rows come from a pinned install rather than an archived bundle: the root
`node_modules` moves on with every upgrade, and the point of the table is that both columns
were produced by the same harness on the same machine.

`v015` needs no staged assets — 0.1.5 is pre-wasm. `after` copies the artifacts `dist/` ships,
because those are the files the extension actually serves; the worker is bundled from
`@molstudio/core/dist/compute/worker.js` the same way `esbuild.js` does it for the extension
(a `blob:` worker cannot resolve the package's relative imports), so the staged worker and wasm
are the ones under test.

The bundler plugin resolves `@molstudio/*` and `molstar/*` through an explicit
`node_modules` path instead of esbuild's default resolution, and it throws when a specifier
cannot be resolved there. That is deliberate: Node's `require.resolve` cannot resolve
`@molstudio/*` (the packages only export an `import` condition), and without the explicit
resolution esbuild silently falls back to the repository root — i.e. it would measure the wrong
version while claiming the pinned one.

## Layout

```
bench/
  package.json          harness dependencies (playwright-core, esbuild)
  run.mjs               driver: build, serve, launch Chrome, measure, write results/*.json
  report.mjs            renders results/*.json into the markdown tables of RESULTS.md
  src/entry.ts          one browser-side harness source, bundled once per project
  lib/build.mjs         esbuild bundling + pinned node_modules resolution + asset staging
  lib/server.mjs        local HTTP server with the same CSP as src/webview/bioviewer.html
  v015/                 pinned 0.1.5 install (its own package.json + node_modules)
  fixtures/             map download + provenance (MANIFEST.json)
  tools/probe-gl.mjs    WebGL renderer / MAX_TEXTURE_SIZE probe
  tools/probe-iso.mjs   ad-hoc single-page probe (iso changes, engine tier, surface size)
  tools/trace-phases.mjs prints the phase timeline of a --trace rep
  results/              raw JSON output (*.json); results/previous-session/ holds runs that
                         predate the current 0.1.5-vs-0.1.8 comparison; results/trace/ is
                         scratch space for --trace diagnostics (never read by report.mjs)
```

## Setup

```bash
cd bench
npm_config_cache=/tmp/dsh-npm-cache-bench npm install        # playwright-core + esbuild
(cd v015 && npm_config_cache=/tmp/dsh-npm-cache-bench npm install)
node fixtures/fetch-maps.mjs --large EMD-55357              # fixtures/*.map.gz + MANIFEST.json
```

`fetch-maps.mjs` copies `emd_10275.map.gz` from a local molstudio checkout when present and
otherwise downloads from `ftp.ebi.ac.uk`; the large map is always downloaded. The fixtures are
git-ignored; `MANIFEST.json` records accession, dims, voxels, byte sizes, sha256 and source URL.

One fixture is derived rather than downloaded: `emd_10275_nonperiodic.map.gz`, a header-modified copy
of EMD-10275 with `NC/NR/NS = 299` (one voxel short of the 300³ grid) and `ISPG = 0`, `NSYMBT = 0`.
Mol* decides periodicity from the grid, not from the symmetry records (`mol-model-formats/volume/ccp4.js`
sets `periodicity: 'xyz'` only when the sampling counts equal the grid dimensions), so stripping the
symmetry records alone would leave the volume periodic. `fixtures/derive-nonperiodic.mjs` regenerates it
deterministically from the base map. After 0.1.8, periodic solids already take the GPU path, so this
fixture is a diagnostic leftover and is not in the hardware comparison.

Chrome is expected at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; override
with `BENCH_CHROME=/path/to/chrome`.

## Running

```bash
node run.mjs --project v015  --gpu hardware        # 0.1.5 reference numbers
node run.mjs --project after --gpu hardware        # root install (0.1.9)
node run.mjs --project after --scenario emd10275-solid --reps 3   # single scenario
node report.mjs > /tmp/tables.md                   # render the two-way hardware tables
```

Comparison numbers are **hardware GPU only**. `--gpu swiftshader` still launches Chrome with the
software rasterizer for diagnostics; `report.mjs` ignores those files. SwiftShader downsamples a
300³ map that Metal never would (`MAX_TEXTURE_SIZE` 8192 vs 16384) and is not a stand-in for
the user's GPU.

Scenarios:

| scenario | fixture | iso levels | why |
|---|---|---|---|
| `emd10275-solid` | `emd_10275` 300³ | 1.5, 2.5, 3.5σ | periodic cryo-EM case; `after` uses Mol* GPU like 0.1.5 |
| `emd10275-wireframe` | `emd_10275` | 1.5, 2.5, 3.5σ | wireframe/lines never uses Mol* GPU extraction (wasm on `after`) |
| `large-solid` | `large` 512³ | 2.5, 3.5, 4.5σ | packed texture exceeds `MAX_TEXTURE_SIZE/2`, and 134M voxels exceeds the 128M limit |

Every rep uses a fresh page (fresh JS heap, fresh WebGL context). The driver writes
`results/<project>-<gpu>.json` after each scenario, so a partial run still leaves usable data.

`--trace` records one rep's load as a phase timeline instead of a number: Mol* state-build cell
creations/removals with timestamps and `usedJSHeap`, the load boundaries, and the absolute timestamps of
every worker message. It writes the marks into `results/*.json` under `load.marks` and also records
`loadAvg1` per rep, because a phase breakdown is only meaningful when nothing else is using the CPU:

```bash
node run.mjs --project after --gpu hardware --scenario emd10275-solid --reps 1 --trace \
  --out results/trace/after-solid.json
node tools/trace-phases.mjs results/trace/*.json    # one timeline per traced rep
```

Traced runs are diagnostics, not measurements: 1 rep each, excluded from the tables (`results/trace/`
is not read by `report.mjs`).

## What is measured

Each scenario loads one map at the default iso level, then performs the measured operation:

- **load** — `MolStudio.loadVolume` through the first surface geometry being ready. Depending on the
  version this includes surface-engine setup (`init` → worker `ready`: wasm instantiation, grid copy into
  the worker, `setGrid`), Mol* grid preparation, and the representation. Whether the engine started
  during load is visible in the recorded worker message kinds and `readyAfterInitMs`. `after` skips
  Mol*'s parse-time isosurface and downsamples oversized grids in-process; a typical periodic solid
  on hardware never constructs a `Worker`.
- **iso change** — `MolStudio.setIsoLevel` until the representation reports new geometry, then two
  animation frames (so the first frame that shows the new surface is included), as median/min/max.
- **style switch** — for the wireframe scenarios, `MolStudio.setVolumeStyle`.

Representation: `solid` is the isosurface mesh; `wireframe` is the same extraction rendered as lines.
The two GPU modes differ only in the rasterizer:

| `--gpu` | Chrome flags | renderer on this machine | MAX_TEXTURE_SIZE |
|---|---|---|---|
| `hardware` | `--enable-gpu --use-angle=metal --ignore-gpu-blocklist` | ANGLE Metal, Apple M2 Pro | 16384 |
| `swiftshader` | `--use-gl=angle --use-angle=swiftshader` | SwiftShader (software) | 8192 |

`MAX_TEXTURE_SIZE` matters: Mol*'s GPU isosurface extraction is only eligible when its packed 2D
texture (`getVolumeTexture2dLayout`, padding 1) fits in half the limit. The harness mirrors that
computation and records the resulting eligibility per run instead of assuming a path.

## Engine tiers and controls

The harness reports which tier actually ran, per scenario:

- **worker wasm** — `WorkerSurfaceEngine`: a `Worker` was constructed, it answered `ready ok:true`,
  it received mesh/`lines` jobs, and the page itself never called `WebAssembly.instantiate`.
- **main-thread wasm** — `preferMainThread`: the page instantiates wasm and no worker is created.
- **Mol* JS** — `MolStudio` falls back to Mol*'s own CPU isosurface when no engine is configured or
  the engine fails to initialise.
- **no engine** — 0.1.5 and any run without `surfaceEngine` wiring.

Engine lifecycle differs per version and must not be assumed. 0.1.5 extracts on Mol*'s GPU texture-mesh
path where the texture fits and on Mol*'s CPU JS path otherwise, with no worker and no wasm. `after`
uses the same GPU gate as Mol* (`useGpu`, periodicity is not a gate) and keeps the engine lazy for
those volumes; wireframe and GPU-ineligible grids start the wasm engine. Oversized grids are
downsampled in-process with wasm `ds_from_staging`. The harness still reports `dGeometryType` plus
whether the page itself instantiated wasm, so "engine idle because the GPU path rendered" is
distinguishable from "engine never created".

The blob-worker mode is the one the extension actually uses: VS Code `asWebviewUri` assets are
cross-origin, so `new Worker(uri)` fails and the panel builds a `blob:` module worker from the bundled
worker source. Because a `blob:` worker cannot resolve a relative URL, asset URLs are resolved to
absolute URLs before they are passed to the engine.

## CSP

`lib/server.mjs` serves the page with the same policy as `src/webview/bioviewer.html`, delivered as a
`<meta http-equiv="Content-Security-Policy">` tag (a header does not cover a page served for
development the same way): `default-src 'none'`, `script-src 'self' 'nonce-…' 'wasm-unsafe-eval'`,
`worker-src 'self' blob:`, `connect-src 'self' https: data: blob:`. If the extension's policy ever
needs a directive the harness does not serve, the wasm worker fails to start and the run reports a
Mol* JS fallback instead of a speedup — so the CSP is part of the measurement, not decoration.

## Caveats that belong with the numbers

- Headless Chrome numbers are not VS Code webview numbers: same engine and Mol* version, but no
  extension host, no `vscode-webview://` isolation and no user interaction.
- `hardware` is ANGLE Metal on an Apple M2 Pro. Software-GL rows are diagnostics only and are not
  in the comparison tables.
- `@molstudio/core` 0.1.8 uses Mol*'s GPU texture-mesh path for periodic solids that fit; wrap-expand
  stays on the CPU/wasm path (wireframe). Per-scenario `isPeriodic` and the reported geometry type
  make the path visible.
- Oversized grids are downsampled in-process above the hard voxel limit (128M voxels) or when the
  packed GPU texture does not fit; the reported `downsampleFactor` and effective dims are part of
  the measurement.
- Large-map memory: a 512³ float32 grid is 537 MB before Mol* bookkeeping. Numbers for that scenario
  are CPU/memory-bound, not representative of smaller maps.
