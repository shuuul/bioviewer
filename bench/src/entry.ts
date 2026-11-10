// Browser-side benchmark harness for the @molstudio/core volume surface pipeline.
// One source, bundled per project: against the pinned 0.1.5 install (bench/v015) and
// against the root 0.1.9 install (bench/out/after). All timings use performance.now()
// in the page, so they include Mol*'s real state/build/render work.
import { MolStudio } from '@molstudio/core';
import { PluginStateObject as SO } from 'molstar/lib/mol-plugin-state/objects';
import { Volume } from 'molstar/lib/mol-model/volume';

type EngineMode =
  | 'none'
  | 'blob-worker'
  | 'worker-url'
  | 'main-thread'
  | 'worker-js-fallback'
  | 'main-js-fallback';

interface InitConfig {
  engineMode: EngineMode;
  wasmUrl?: string;
  workerUrl?: string;
  timeoutMs?: number;
  // --trace: record phase marks (state-build cells, load boundaries, heap) so a
  // single rep can be decomposed. Off in every committed measurement.
  trace?: boolean;
}

interface MapEntry {
  bytes: Uint8Array;
  dims: [number, number, number];
  byteLength: number;
  fetchMs: number;
  decompressMs: number;
}

const raf = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const frames = async (n: number) => { for (let i = 0; i < n; i++) await raf(); };
const now = () => performance.now();
const round = (ms: number) => Math.round(ms * 10) / 10;
const serializeError = (error: unknown) => (error instanceof Error ? error.message : String(error));

const state: {
  studio: any;
  inst: any;
  maps: Map<string, MapEntry>;
  volumeId: string | null;
  timeoutMs: number;
  initMs: number;
  gl: any;
  workerSourceBytes: number | null;
  trace: boolean;
  marks: { name: string; detail: string | null; ms: number; heap: number | null }[];
} = { studio: null, inst: null, maps: new Map(), volumeId: null, timeoutMs: 600_000, initMs: 0, gl: null, workerSourceBytes: null, trace: false, marks: [] };

function installInstrumentation() {
  const inst = {
    workers: [] as any[],
    makeWorkerCalls: 0,
    wasmInstantiateCalls: 0,
    wasmInstantiateFailures: 0,
    textures: { big: [] as { width: number; height: number }[], texImage2D: 0, texStorage2D: 0 },
    // Mol*'s GPU isosurface extraction reads the extracted vertex/group/normal
    // textures back to the CPU; the wasm and Mol* JS paths never call readPixels.
    readbacks: { calls: 0, pixels: 0 },
  };
  state.inst = inst;

  // Worker tier evidence: every Worker the page constructs, with its message kinds.
  const OrigWorker = window.Worker;
  window.Worker = new Proxy(OrigWorker, {
    construct(target, args, newTarget) {
      const url = String(args[0]);
      const opts = args[1] as WorkerOptions | undefined;
      const worker = Reflect.construct(target, args, newTarget);
      const rec: any = { url, type: opts?.type ?? 'classic', out: [] as any[], in: [] as any[], errors: [] as any[] };
      inst.workers.push(rec);
      worker.addEventListener('error', (event: any) => rec.errors.push({ kind: 'error', message: String(event?.message ?? event?.type) }));
      worker.addEventListener('messageerror', () => rec.errors.push({ kind: 'messageerror' }));
      worker.addEventListener('message', (event: MessageEvent) => {
        const data: any = event.data;
        rec.in.push({ kind: data?.kind ?? null, ok: data?.ok ?? null, ms: now() });
      });
      const post = worker.postMessage.bind(worker);
      worker.postMessage = (message: any, ...rest: any[]) => {
        rec.out.push({ kind: message?.kind ?? null, ms: now() });
        return post(message, ...rest);
      };
      return worker;
    },
  } as any);

  // Main-thread wasm tier evidence: instantiations in the page context.
  const origInstantiate = WebAssembly.instantiate.bind(WebAssembly);
  (WebAssembly as any).instantiate = (source: any, imports?: any) => {
    inst.wasmInstantiateCalls++;
    const promise = origInstantiate(source, imports);
    promise.catch(() => { inst.wasmInstantiateFailures++; });
    return promise;
  };

  // GPU texture-tier evidence: Mol*'s texture-mesh path allocates one big packed 2D texture.
  const patchProto = (proto: any) => {
    if (!proto) return;
    for (const name of ['texImage2D', 'texStorage2D']) {
      const orig = proto[name];
      if (typeof orig !== 'function' || orig.__benchPatched) continue;
      const patched = function (this: any, ...args: any[]) {
        const width = Number(args[3]);
        const height = Number(args[4]);
        if (name === 'texImage2D') inst.textures.texImage2D++;
        else inst.textures.texStorage2D++;
        if (width >= 1024 && height >= 1024) inst.textures.big.push({ width, height });
        return orig.apply(this, args);
      };
      (patched as any).__benchPatched = true;
      proto[name] = patched;
    }
  };
  patchProto((window as any).WebGL2RenderingContext?.prototype);
  patchProto((window as any).WebGLRenderingContext?.prototype);

  // The GPU isosurface extraction is the only Mol* path that reads pixels back.
  for (const proto of [(window as any).WebGL2RenderingContext?.prototype, (window as any).WebGLRenderingContext?.prototype]) {
    if (!proto || typeof proto.readPixels !== 'function' || proto.readPixels.__benchPatched) continue;
    const orig = proto.readPixels;
    const patched = function (this: any, ...args: any[]) {
      inst.readbacks.calls++;
      inst.readbacks.pixels += Math.abs(Number(args[2])) * Math.abs(Number(args[3]));
      return orig.apply(this, args);
    };
    (patched as any).__benchPatched = true;
    proto.readPixels = patched;
  }
}

function readGlInfo() {
  const webgl = state.studio?.plugin?.canvas3d?.webgl;
  const gl = webgl?.gl;
  if (!gl) return { available: false };
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const param = (name: string) => { try { return gl.getParameter(gl[name]); } catch { return null; } };
  const extensions = webgl.extensions ?? {};
  return {
    available: true,
    isWebGL2: !!webgl.isWebGL2,
    vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : param('VENDOR'),
    renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : param('RENDERER'),
    version: param('VERSION'),
    maxTextureSize: param('MAX_TEXTURE_SIZE'),
    colorBufferFloat: !!extensions.colorBufferFloat,
    textureFloat: !!extensions.textureFloat,
    drawBuffers: !!extensions.drawBuffers,
  };
}

// Phase marks for --trace runs: absolute performance.now() so a mark can be lined up
// with the worker message timestamps recorded by installInstrumentation().
function mark(name: string, detail?: string | null) {
  if (!state.trace) return;
  state.marks.push({ name, detail: detail ?? null, ms: round(now()), heap: memoryInfo()?.usedJSHeap ?? null });
}

async function initStudio(config: InitConfig) {
  installInstrumentation();
  state.trace = !!config.trace;
  state.timeoutMs = config.timeoutMs ?? 600_000;
  state.workerSourceBytes = null;
  // VS Code passes asWebviewUri assets, which are absolute; a blob: worker cannot
  // resolve a relative URL at all (new URL('/x', 'blob:...') throws), so resolve here.
  const wasmUrl = config.wasmUrl ? new URL(config.wasmUrl, document.baseURI).href : undefined;
  const workerUrl = config.workerUrl ? new URL(config.workerUrl, document.baseURI).href : undefined;
  const root = document.getElementById('root')!;
  root.innerHTML = '';
  const el = document.createElement('div');
  el.style.width = '900px';
  el.style.height = '640px';
  root.appendChild(el);

  // The VS Code webview serves assets cross-origin (asWebviewUri), so it must build
  // the engine worker from the bundled worker source as a blob: module worker.
  let blobWorkerUrl: string | null = null;
  if (config.engineMode === 'blob-worker' || config.engineMode === 'worker-js-fallback') {
    const response = await fetch(workerUrl ?? "");
    if (!response.ok) throw new Error('worker source fetch failed: ' + response.status);
    const source = await response.text();
    state.workerSourceBytes = source.length;
    blobWorkerUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  }

  const options: any = {};
  switch (config.engineMode) {
    case 'blob-worker':
      options.surfaceEngine = {
        wasmUrl,
        makeWorker: () => {
          state.inst.makeWorkerCalls++;
          return new Worker(blobWorkerUrl ?? "", { type: 'module' });
        },
      };
      break;
    case 'worker-url':
      options.surfaceEngine = { wasmUrl, workerUrl };
      break;
    case 'main-thread':
      options.surfaceEngine = { wasmUrl, preferMainThread: true };
      break;
    case 'worker-js-fallback':
      options.surfaceEngine = {
        wasmUrl: 'bogus://missing-engine.wasm',
        makeWorker: () => {
          state.inst.makeWorkerCalls++;
          return new Worker(blobWorkerUrl ?? "", { type: 'module' });
        },
      };
      break;
    case 'main-js-fallback':
      options.surfaceEngine = { wasmUrl: 'bogus://missing-engine.wasm', preferMainThread: true };
      break;
    case 'none':
      break;
    default:
      throw new Error('unknown engine mode: ' + config.engineMode);
  }

  const t0 = now();
  state.studio = await (options.surfaceEngine ? MolStudio.create(el, options) : MolStudio.create(el));
  state.initMs = now() - t0;
  if (state.trace) {
    // Mol* state-build timeline: which cells loadVolume creates (parse, the
    // downsample decorator, the representation) and in which order.
    const events = state.studio.plugin?.state?.data?.events;
    const name = (cell: any) => cell?.transform?.transformer?.definition?.name ?? cell?.transform?.ref ?? null;
    events?.cell?.created?.subscribe((event: any) => mark('cell:created', name(event?.cell)));
    events?.cell?.removed?.subscribe((event: any) => mark('cell:removed', name(event?.cell)));
  }
  await frames(2);
  state.gl = readGlInfo();
  return { initMs: round(state.initMs), gl: state.gl, workerSourceBytes: state.workerSourceBytes };
}

async function prepareMap(url: string, label: string) {
  const t0 = now();
  const response = await fetch(url);
  if (!response.ok) throw new Error('map fetch failed: ' + response.status);
  const compressed = await response.arrayBuffer();
  const fetchMs = now() - t0;
  const t1 = now();
  let bytes: Uint8Array;
  if (url.endsWith('.gz')) {
    const stream = new Response(compressed).body!.pipeThrough(new DecompressionStream('gzip'));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  } else {
    bytes = new Uint8Array(compressed);
  }
  const decompressMs = now() - t1;
  const header = new DataView(bytes.buffer, bytes.byteOffset, 12);
  const dims: [number, number, number] = [header.getInt32(0, true), header.getInt32(4, true), header.getInt32(8, true)];
  state.maps.set(label, { bytes, dims, byteLength: bytes.byteLength, fetchMs: round(fetchMs), decompressMs: round(decompressMs) });
  return { label, dims, byteLength: bytes.byteLength, fetchMs: round(fetchMs), decompressMs: round(decompressMs) };
}

function volumeRefs(): any[] {
  return state.studio?.plugin?.managers?.volume?.hierarchy?.current?.volumes ?? [];
}

function findVolumeRef(id: string) {
  const ref = volumeRefs().find((candidate: any) => candidate.cell.transform.ref === id);
  if (!ref) throw new Error('volume ref not found: ' + id);
  return ref;
}

function effectiveCell(cell: any) {
  const data = state.studio.plugin.state.data;
  let current = cell;
  for (;;) {
    const children = [...(data.tree.children.get(current.transform.ref)?.values() ?? [])];
    const childRef = children.find((ref: string) => {
      const child = data.cells.get(ref);
      return child?.transform?.transformer?.definition?.isDecorator && SO.Volume.Data.is(child.obj);
    });
    if (!childRef) return current;
    current = data.cells.get(childRef);
  }
}

// Exact mirror of molstar's getVolumeTexture2dLayout(dim, 1) from
// mol-repr/volume/util.js, so the reported GPU-path eligibility matches Mol*'s own
// suitableForGpu check instead of an approximation.
function textureLayout(dims: number[]) {
  const powerOfTwoSize = Math.pow(2, Math.ceil(Math.log(Math.sqrt(dims[0] * dims[1] * dims[2])) / Math.log(2)));
  let width = dims[0] + 1;
  let height = dims[1] + 1;
  if (powerOfTwoSize < width * dims[2]) {
    const columns = Math.floor(powerOfTwoSize / width);
    const rows = Math.ceil(dims[2] / columns);
    width *= columns;
    height *= rows;
  } else {
    width *= dims[2];
  }
  return { powerOfTwoSize: height < powerOfTwoSize ? powerOfTwoSize : powerOfTwoSize * 2, width, height };
}

function volumeInfo(id: string) {
  const ref = findVolumeRef(id);
  const rootCell = ref.cell;
  const source = rootCell.obj?.data;
  const cell = effectiveCell(rootCell);
  const effective = cell.obj?.data;
  const sourceDims = source ? [...source.grid.cells.space.dimensions] : null;
  const effectiveDims = effective ? [...effective.grid.cells.space.dimensions] : null;
  const webgl = state.studio.plugin.canvas3d?.webgl;
  const maxTextureSize = webgl?.gl ? webgl.gl.getParameter(webgl.gl.MAX_TEXTURE_SIZE) : null;
  const layout = effectiveDims ? textureLayout(effectiveDims) : null;
  const gpuEligible = !!(webgl && effective && layout && maxTextureSize)
    && effective.grid.cells.data.length >= 1000
    && layout.powerOfTwoSize <= maxTextureSize / 2;
  // Mol*'s GPU isosurface path defines a packed texture and records it as a custom
  // property on the volume it extracted from; the CPU path never does.
  const propertyDataKeys = Object.keys(effective?._propertyData ?? {});
  const gpuTextureVolume = propertyDataKeys.includes('volume-isosurface-texture');
  const snapshot = state.studio.getSnapshot().objects.find((object: any) => object.id === id) ?? null;
  const reps = ref.representations.map((rep: any) => {
    const obj = rep.cell.obj?.data;
    const params = rep.cell.transform.params?.type?.params;
    const renderObjects = obj?.repr?.renderObjects ?? [];
    const values = renderObjects[0]?.values ?? {};
    return {
      ref: rep.cell.transform.ref,
      geometryVersion: obj?.repr?.geometryVersion ?? null,
      visuals: params?.visuals ?? null,
      isoValue: params?.isoValue ?? null,
      reprClass: obj?.repr?.constructor?.name ?? null,
      renderObjectValues: Object.keys(values).slice(0, 24),
      geometryType: values.dGeometryType?.ref?.value ?? null,
      renderObjectCount: renderObjects.length,
      // Surface size evidence: without it a fast iso change could just mean "empty surface".
      vertexCount: values.aPosition?.ref?.value ? values.aPosition.ref.value.length / 3 : null,
      positionVersion: values.aPosition?.ref?.version ?? null,
      indexCount: values.elements?.ref?.value?.length ?? null,
      textureVertexCount: values.uVertexCount?.ref?.value ?? null,
    };
  });
  let engine: any = null;
  try {
    const sessions = state.studio.sessions;
    const session = sessions?.sessionForKey?.(rootCell.transform.ref) ?? sessions?.sessionForKey?.(id);
    if (session) {
      // 0.1.9 keeps a lazy SessionRecord that only builds an engine on the first
      // CPU-path visual, so a resolved engine is not implied by a session existing.
      const resolved = session.resolvedEngine ?? session.engine ?? null;
      engine = {
        class: resolved?.constructor?.name ?? null,
        state: resolved ? 'started' : session.started ? 'starting' : 'not started',
        cellRef: session.cellRef ?? null,
        wrapped: session.wrappedSourceDims ?? null,
      };
    }
  } catch (error) {
    engine = { error: serializeError(error) };
  }
  return {
    id,
    snapshot: snapshot ? { style: snapshot.style, isoLevel: snapshot.isoLevel, gridFactor: snapshot.gridFactor ?? null, stats: snapshot.stats } : null,
    sourceDims,
    effectiveDims,
    // Whether the parsed grid wraps: Mol*'s GPU path ignores this; 0.1.9 matches
    // that gate. Wrap-expand stays on the CPU/wasm path.
    sourcePeriodic: source ? Volume.isPeriodic(source) : null,
    effectivePeriodic: effective ? Volume.isPeriodic(effective) : null,
    downsampleFactor: sourceDims && effectiveDims ? Math.round(sourceDims[0] / effectiveDims[0]) : null,
    engine,
    gpu: {
      maxTextureSize,
      powerOfTwoSize: layout?.powerOfTwoSize ?? null,
      packedTexture: layout ? layout.width + 'x' + layout.height : null,
      gpuEligible,
      gpuTextureDefined: gpuTextureVolume,
      volumePropertyDataKeys: propertyDataKeys,
      bigTextures: state.inst.textures.big.slice(-6),
      texImage2D: state.inst.textures.texImage2D,
      texStorage2D: state.inst.textures.texStorage2D,
      readbacks: { ...state.inst.readbacks },
    },
    reps,
  };
}

// Time between the page posting the engine 'init' message and the worker answering
// 'ready' — i.e. the eager engine cost a volume load pays before any iso change.
function engineReadyMs(worker: any) {
  const init = worker.out.find((message: any) => message.kind === 'init');
  const ready = worker.in.find((message: any) => message.kind === 'ready');
  if (!init || !ready) return null;
  return Math.round((ready.ms - init.ms) * 10) / 10;
}

function instSummary() {
  const countKinds = (messages: any[]) => {
    const counts: Record<string, number> = {};
    for (const message of messages) counts[String(message.kind)] = (counts[String(message.kind)] ?? 0) + 1;
    return counts;
  };
  return {
    workersCreated: state.inst.workers.length,
    workers: state.inst.workers.map((worker: any) => ({
      url: worker.url.startsWith('blob:') ? 'blob:' : worker.url,
      type: worker.type,
      outKinds: countKinds(worker.out),
      inKinds: countKinds(worker.in),
      ready: worker.in.filter((message: any) => message.kind === 'ready').map((message: any) => message.ok),
      // Engine cost paid inside loadVolume: postMessage(init) -> ready reply, which
      // covers wasm instantiation, the grid copy into the worker and setGrid.
      readyAfterInitMs: engineReadyMs(worker),
      errors: worker.errors,
      // Trace runs keep the absolute message timestamps so a phase can be split into
      // page-side posting, worker-side staging and engine start.
      ...(state.trace
        ? {
            sent: worker.out.map((message: any) => ({ kind: message.kind, ms: message.ms })),
            received: worker.in.map((message: any) => ({ kind: message.kind, ms: message.ms })),
          }
        : {}),
    })),
    makeWorkerCalls: state.inst.makeWorkerCalls,
    wasmInstantiateCalls: state.inst.wasmInstantiateCalls,
    wasmInstantiateFailures: state.inst.wasmInstantiateFailures,
    bigTextures: state.inst.textures.big.slice(-6),
    readbacks: { ...state.inst.readbacks },
  };
}

function memoryInfo() {
  const memory = (performance as any).memory;
  return memory ? { usedJSHeap: memory.usedJSHeapSize, totalJSHeap: memory.totalJSHeapSize } : null;
}

function repSignature(ref: any) {
  return ref.representations
    .map((rep: any) => rep.cell.transform.ref + ':' + (rep.cell.obj?.data?.repr?.geometryVersion ?? -1))
    .join('|');
}

async function waitForSurface(id: string, previousSignature: string | null) {
  const deadline = now() + state.timeoutMs;
  for (;;) {
    const ref = findVolumeRef(id);
    const complete = ref.representations.length > 0
      && ref.representations.every((rep: any) => (rep.cell.obj?.data?.repr?.geometryVersion ?? -1) >= 0);
    if (complete && (previousSignature === null || repSignature(ref) !== previousSignature)) return;
    if (now() > deadline) throw new Error('surface not ready before timeout');
    await raf();
  }
}

async function loadVolume(label: string) {
  const entry = state.maps.get(label);
  if (!entry) throw new Error('map not prepared: ' + label);
  const before = new Set(volumeRefs().map((ref: any) => ref.cell.transform.ref));
  if (state.trace) state.marks.length = 0;
  mark('load:start');
  const t0 = now();
  await state.studio.loadVolume({ data: entry.bytes, label, format: 'ccp4' });
  const opMs = now() - t0;
  mark('load:resolved');
  const added = volumeRefs().filter((ref: any) => !before.has(ref.cell.transform.ref));
  if (added.length !== 1) throw new Error('expected one new volume, got ' + added.length);
  const id = added[0].cell.transform.ref;
  state.volumeId = id;
  await waitForSurface(id, null);
  mark('load:surface-ready');
  const readyMs = now() - t0;
  await frames(2);
  mark('load:first-frame');
  const firstFrameMs = now() - t0;
  return {
    label,
    opMs: round(opMs),
    readyMs: round(readyMs),
    firstFrameMs: round(firstFrameMs),
    info: volumeInfo(id),
    memory: memoryInfo(),
    marks: state.trace ? state.marks.slice() : undefined,
  };
}

async function measureIso(level: number) {
  const id = state.volumeId;
  if (!id) throw new Error('no volume loaded');
  const signature = repSignature(findVolumeRef(id));
  const t0 = now();
  await state.studio.setIsoLevel(id, level);
  const opMs = now() - t0;
  await waitForSurface(id, signature);
  const readyMs = now() - t0;
  await frames(2);
  const firstFrameMs = now() - t0;
  return { isoLevel: level, opMs: round(opMs), readyMs: round(readyMs), firstFrameMs: round(firstFrameMs), info: volumeInfo(id) };
}

async function measureStyle(style: string) {
  const id = state.volumeId;
  if (!id) throw new Error('no volume loaded');
  const signature = repSignature(findVolumeRef(id));
  const t0 = now();
  await state.studio.setVolumeStyle(id, style);
  const opMs = now() - t0;
  await waitForSurface(id, signature);
  const readyMs = now() - t0;
  await frames(2);
  const firstFrameMs = now() - t0;
  return { style, opMs: round(opMs), readyMs: round(readyMs), firstFrameMs: round(firstFrameMs), info: volumeInfo(id) };
}

function disposeStudio() {
  try {
    state.studio?.dispose?.();
  } catch (error) {
    return { disposeError: serializeError(error) };
  }
  return {};
}

(globalThis as any).__bench = {
  initStudio,
  prepareMap,
  loadVolume,
  measureIso,
  measureStyle,
  disposeStudio,
  volumeInfo: () => volumeInfo(state.volumeId!),
  captureGc: () => (globalThis as any).gc?.(),
  diagnostics: () => ({ volume: state.volumeId ? volumeInfo(state.volumeId) : null, inst: instSummary(), gl: state.gl, memory: memoryInfo() }),
};
