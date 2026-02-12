const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/**
 * @param {string} buildName
 * @returns {import('esbuild').Plugin}
 */
function createProblemMatcherPlugin(buildName) {
  return {
    name: `esbuild-problem-matcher-${buildName}`,
    setup(build) {
      build.onStart(() => {
        console.log(`[watch] ${buildName} build started`);
      });
      build.onEnd((result) => {
        result.errors.forEach(({ text, location }) => {
          console.error(`✘ [ERROR] ${text}`);
          if (location) {
            console.error(`    ${location.file}:${location.line}:${location.column}:`);
          }
        });
        console.log(`[watch] ${buildName} build finished`);
      });
    }
  };
}

const copyMolstarPlugin = {
  name: "copy-molstar-plugin",
  setup(build) {
    build.onEnd(() => {
      const molstarSrcDir = path.join(__dirname, "node_modules", "molstar", "build", "viewer");
      const molstarDestDir = path.join(__dirname, "dist", "molstar");
      fs.mkdirSync(molstarDestDir, { recursive: true });
      fs.cpSync(molstarSrcDir, molstarDestDir, { recursive: true });
      console.log("Copied Molstar module to dist/molstar/");
    });
  }
};

const copyResourcesPlugin = {
  name: "copy-resources-plugin",
  setup(build) {
    build.onEnd(() => {
      const resourcesSrcDir = path.join(__dirname, "resources");
      const resourcesDestDir = path.join(__dirname, "dist", "resources");
      fs.mkdirSync(resourcesDestDir, { recursive: true });
      fs.cpSync(resourcesSrcDir, resourcesDestDir, { recursive: true });
      console.log("Copied resources to dist/resources/");
    });
  }
};

/**
 * @type {import('esbuild').Plugin}
 */
const copyHtmlPlugin = {
  name: "copy-html-plugin",
  setup(build) {
    build.onEnd(() => {
      const src = path.join(__dirname, "src", "webview", "bioviewer.html");
      const dest = path.join(__dirname, "dist", "webview", "bioviewer.html");
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      console.log("Copied bioviewer.html to dist/webview/");
    });
  }
};

async function main() {
  const extensionContext = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    outfile: "dist/extension.js",
    external: ["vscode"],
    logLevel: "silent",
    plugins: [
      createProblemMatcherPlugin("extension"),
      copyHtmlPlugin,
      copyMolstarPlugin,
      copyResourcesPlugin
    ]
  });

  const webviewContext = await esbuild.context({
    entryPoints: ["src/webview/main.tsx"],
    bundle: true,
    format: "iife",
    minify: production,
    sourcemap: !production,
    platform: "browser",
    target: ["es2022"],
    outfile: "dist/webview/app.js",
    logLevel: "silent",
    plugins: [createProblemMatcherPlugin("webview")],
    define: {
      "process.env.NODE_ENV": production ? '"production"' : '"development"'
    }
  });

  if (watch) {
    await Promise.all([extensionContext.watch(), webviewContext.watch()]);
    return;
  }

  await Promise.all([extensionContext.rebuild(), webviewContext.rebuild()]);
  await Promise.all([extensionContext.dispose(), webviewContext.dispose()]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
