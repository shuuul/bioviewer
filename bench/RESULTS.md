# Volume surface benchmark: 0.1.5 (pre-wasm) → 0.1.8 (GPU periodic solids)

Hardware GPU only (ANGLE Metal, Apple M2 Pro, `MAX_TEXTURE_SIZE` 16384). Same session:
0.1.8 (`gpuDataType: "byte"`, `instanceGranularity: true`) ran first, then 0.1.5.
Every rep is a fresh headless Chrome page. Ratios are **0.1.5 ÷ 0.1.8**, so >1 means
0.1.8 is faster.

0.1.8 restores Mol* GPU for periodic solids (`gpuIsosurfacePath` = Mol* `useGpu`), skips the
parse-time isosurface, and downsamples oversized grids in-process. Wasm starts only on the
CPU path (wireframe here). Representations use Mol*'s `byte` GPU data and instance-level
markers so iso updates do not allocate a per-voxel marker texture. SwiftShader / jsfallback /
non-periodic / 0.1.6–0.1.7 runs live under `results/previous-session/` and are not ingested.

These numbers were measured when `after` was `@molstudio/core@0.1.8`; the root install has
since moved to 0.1.9 and `after` has not been re-run.

### hardware — emd10275-solid

EMD-10275 full-size map, solid isosurface, three iso levels (periodic; GPU on hardware).

Map: EMD-10275, 300×300×300 (27.0M voxels), representation solid.

| metric | 0.1.5 | 0.1.8 | 0.1.5 ÷ 0.1.8 |
|---|---|---|---|
| load → first surface | 455 ms (451 ms–456, n=5) | 473 ms (463 ms–594, n=5) | 1.0× |
| iso 1.5σ | 20 ms (18 ms–22, n=5) | 17 ms (16 ms–17, n=5) | 1.2× |
| iso 2.5σ | 20 ms (18 ms–33, n=5) | 17 ms (15 ms–18, n=5) | 1.2× |
| iso 3.5σ | 19 ms (18 ms–28, n=5) | 16 ms (15 ms–17, n=5) | 1.2× |

- 0.1.5 tier: null (no engine); geometry textureMesh; surface 500640 verts; periodic=true, effective periodic=true
- 0.1.8 tier: engine not started (lazy); engine not started; geometry textureMesh; surface 500640 verts; periodic=true, effective periodic=true

### hardware — emd10275-wireframe

EMD-10275 wireframe (CPU lines path; wasm on 0.1.8).

Map: EMD-10275, 300×300×300 (27.0M voxels), representation wireframe.

| metric | 0.1.5 | 0.1.8 | 0.1.5 ÷ 0.1.8 |
|---|---|---|---|
| load → first surface | 443 ms (438 ms–451, n=5) | 453 ms (448 ms–479, n=5) | 1.0× |
| iso 1.5σ | 1048 ms (995 ms–1053, n=5) | 128 ms (107 ms–130, n=5) | 8.2× |
| iso 2.5σ | 995 ms (970 ms–1013, n=5) | 117 ms (115 ms–120, n=5) | 8.5× |
| iso 3.5σ | 974 ms (968 ms–990, n=5) | 114 ms (113 ms–119, n=5) | 8.6× |
| style switch → wireframe | 455 ms (451 ms–463, n=5) | 485 ms (474 ms–504, n=5) | 0.9× |

- 0.1.5 tier: null (no engine); geometry textureMesh; surface 500640 verts; periodic=true, effective periodic=true
- 0.1.8 tier: engine not started (lazy); engine not started; workers [init,lines×5; ready:true after 385.9 ms]; geometry textureMesh; surface 500640 verts; periodic=true, effective periodic=true

### hardware — large-solid

Large map whose packed GPU texture exceeds the texture limit, solid isosurface.

Map: EMD-55357, 512×512×512 (134.2M voxels), representation solid.

| metric | 0.1.5 | 0.1.8 | 0.1.5 ÷ 0.1.8 |
|---|---|---|---|
| load → first surface | 2869 ms (2800 ms–3124, n=3) | 1336 ms (1323 ms–1394, n=3) | 2.1× |
| iso 2.5σ | 3925 ms (3823 ms–3937, n=3) | 17 ms (14 ms–20, n=3) | 235.0× |
| iso 3.5σ | 3977 ms (3649 ms–3988, n=3) | 14 ms (14 ms–17, n=3) | 282.0× |
| iso 4.5σ | 3655 ms (3558 ms–3697, n=3) | 14 ms (14 ms–17, n=3) | 255.6× |

- 0.1.5 tier: null (no engine); geometry mesh; surface 2243214 verts; periodic=true, effective periodic=true
- 0.1.8 tier: engine not started (lazy); engine not started; page instantiated wasm; geometry textureMesh; surface 548256 verts; grid downsampled 2× → 256×256×256; periodic=true, effective periodic=true

## How to read this

- **emd10275-solid** is GPU vs GPU. 0.1.8 never starts a worker (`textureMesh`, engine not
  started). Open is at parity. Iso-drag is in the same 15–20 ms band as 0.1.5 (this pack
  uses `gpuDataType: "byte"` and `instanceGranularity: true`; the previous 0.1.8 pack with
  `halfFloat` sat at 21–27 ms against 0.1.5's 13–16 ms). Vertex counts now match (500640).
- **emd10275-wireframe** is the wasm win: Mol* CPU lines (~1 s) vs the worker engine
  (~110–130 ms), about 8×.
- **large-solid** downsamples 512³ → 256³ in-process (`page instantiated wasm`, no downsample
  worker). The reduced grid fits the GPU texture path, so iso-drag is ~14–17 ms against
  0.1.5's ~3.7–4.0 s CPU mesh (230–280×). That is downsample-then-GPU, not wasm marching cubes.

Regenerate the tables after a new run:

```bash
node run.mjs --project v015  --gpu hardware
node run.mjs --project after --gpu hardware
node report.mjs
```
