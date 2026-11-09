// Builds the shared browser harness bundle against a specific node_modules tree and
// stages the worker/wasm assets. One bundle per project so 0.1.5 and 0.1.7 run the
// exact same source yet resolve their own @molstudio/core + molstar. 0.1.5 vs 0.1.8.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const benchDir = path.resolve(here, '..');
export const rootDir = path.resolve(benchDir, '..');

export const PROJECTS = {
  v015: {
    name: 'v015',
    label: '0.1.5 (pre-wasm)',
    nodeModulesDir: path.join(benchDir, 'v015', 'node_modules'),
    engineModes: ['none'],
    assets: null,
  },
  after: {
    name: 'after',
    label: '0.1.8 (GPU periodic solids)',
    nodeModulesDir: path.join(rootDir, 'node_modules'),
    engineModes: ['blob-worker', 'worker-url', 'main-thread', 'worker-js-fallback', 'main-js-fallback', 'none'],
    // The after run validates the artifacts the extension actually ships.
    assets: [
      { file: 'molstudio-worker.js', copyFrom: path.join(rootDir, 'dist', 'webview', 'molstudio-worker.js') },
      { file: 'molstudio-wasm-engine.wasm', copyFrom: path.join(rootDir, 'dist', 'molstudio', 'molstudio-wasm-engine.wasm') },
    ],
  },
};

function pinnedResolve(nodeModulesDir) {
  // Node's require.resolve cannot resolve these packages: @molstudio/* only exports
  // an "import" condition, so require.resolve throws and esbuild would silently fall
  // back to the repository root node_modules — i.e. the wrong @molstudio version.
  const resolvePackage = async (spec) => {
    const parts = spec.split('/');
    const packageName = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
    const subpath = spec.slice(packageName.length + 1);
    const packageDir = path.join(nodeModulesDir, packageName);
    try {
      await fs.access(path.join(packageDir, 'package.json'));
    } catch {
      return null;
    }
    if (subpath) {
      // Mol* deep imports omit the extension (molstar/lib/.../objects), so try the
      // same candidates a bundler would.
      const base = path.join(packageDir, subpath);
      for (const candidate of [base, base + '.js', base + '.mjs', path.join(base, 'index.js')]) {
        const stat = await fs.stat(candidate).catch(() => null);
        if (stat?.isFile()) return candidate;
      }
      return null;
    }
    const packageJson = JSON.parse(await fs.readFile(path.join(packageDir, 'package.json'), 'utf8'));
    const exported = packageJson.exports?.['.'];
    const target = (typeof exported === 'string' ? exported : exported?.import ?? exported?.default) ?? packageJson.module ?? packageJson.main ?? 'index.js';
    return path.join(packageDir, target);
  };
  return {
    name: 'pinned-node-modules',
    setup(builder) {
      builder.onResolve({ filter: /^(@molstudio\/|molstar(\/|$))/ }, async (args) => {
        const resolved = await resolvePackage(args.path);
        // Failing loudly matters: the whole benchmark compares package versions.
        if (!resolved) throw new Error('cannot resolve ' + args.path + ' in ' + nodeModulesDir);
        return { path: resolved };
      });
    },
  };
}

async function readVersion(packageJsonPath) {
  const parsed = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
  return parsed.version ?? null;
}

export async function buildProject(projectName) {
  const project = PROJECTS[projectName];
  if (!project) throw new Error('unknown project: ' + projectName);

  const outDir = path.join(benchDir, 'out', project.name);
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });

  const corePackage = path.join(project.nodeModulesDir, '@molstudio', 'core', 'package.json');
  const molstarPackage = path.join(project.nodeModulesDir, 'molstar', 'package.json');
  const coreVersion = await readVersion(corePackage);
  const molstarVersion = await readVersion(molstarPackage);

  const result = await build({
    entryPoints: [path.join(benchDir, 'src', 'entry.ts')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2022'],
    outfile: path.join(outDir, 'harness.js'),
    plugins: [pinnedResolve(project.nodeModulesDir)],
    logLevel: 'info',
    sourcemap: false,
    legalComments: 'none',
    metafile: true,
  });
  // Keep the input list next to the bundle: it is the evidence for which
  // @molstudio/core / molstar copy a run actually executed.
  await fs.writeFile(path.join(outDir, 'harness.meta.json'), JSON.stringify(result.metafile, null, 2));

  await fs.writeFile(path.join(outDir, 'harness.css'), 'html, body { margin: 0; padding: 0; background: #101216; overflow: hidden; }\n#root { width: 900px; height: 640px; }\n', 'utf8');

  let assets = null;
  if (project.assets) {
    assets = [];
    for (const asset of project.assets) {
      const target = path.join(outDir, asset.file);
      if (asset.copyFrom) {
        try {
          await fs.access(asset.copyFrom);
        } catch {
          throw new Error('missing ' + asset.file + ' asset: ' + asset.copyFrom + ' (run the extension build first)');
        }
        await fs.copyFile(asset.copyFrom, target);
      } else {
        try {
          await fs.access(asset.bundleFrom);
        } catch {
          throw new Error('missing worker entry: ' + asset.bundleFrom);
        }
        // The package worker imports its wasm core relatively, which a blob worker
        // cannot resolve, so the harness bundles it the same way esbuild.js does.
        await build({
          entryPoints: [asset.bundleFrom],
          bundle: true,
          format: 'esm',
          platform: 'browser',
          target: ['es2022'],
          outfile: target,
          plugins: [pinnedResolve(project.nodeModulesDir)],
          logLevel: 'info',
          legalComments: 'none',
        });
      }
      assets.push(asset.file);
    }
  }

  return { project: project.name, label: project.label, outDir, coreVersion, molstarVersion, engineModes: project.engineModes, assets };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(here, 'build.mjs')) {
  const projectName = process.argv[2];
  buildProject(projectName)
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}