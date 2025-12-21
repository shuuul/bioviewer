const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

const copyMolstarPlugin = {
	name: 'copy-molstar-plugin',
	setup(build) {
	  build.onEnd(() => {
		const molstarSrcDir = path.join(__dirname, 'node_modules', 'molstar', 'build', 'viewer');
		const molstarDestDir = path.join(__dirname, 'dist', 'molstar');
		fs.mkdirSync(molstarDestDir, { recursive: true });
		fs.cpSync(molstarSrcDir, molstarDestDir, { recursive: true });
		console.log('Copied Molstar module to dist/molstar/');
	  });
	},
};

const copyResourcesPlugin = {
	name: 'copy-resources-plugin',
	setup(build) {
		build.onEnd(() => {
			const resourcesSrcDir = path.join(__dirname, 'resources');
			const resourcesDestDir = path.join(__dirname, 'dist', 'resources');
			fs.mkdirSync(resourcesDestDir, { recursive: true });
			fs.cpSync(resourcesSrcDir, resourcesDestDir, { recursive: true });
			console.log('Copied resources to dist/resources/');
		});
	},
};

/**
 * @type {import('esbuild').Plugin}
 */
const copyHtmlPlugin = {
	name: 'copy-html-plugin',
	setup(build) {
		build.onEnd(() => {
			const src = path.join(__dirname, 'src', 'webview', 'bioviewer.html');
			const dest = path.join(__dirname, 'dist', 'webview', 'bioviewer.html');
			fs.mkdirSync(path.dirname(dest), { recursive: true });
			fs.copyFileSync(src, dest);
			console.log('Copied bioviewer.html to dist/webview/');
		});
	},
};

async function main() {
	const ctx = await esbuild.context({
		entryPoints: [
			'src/extension.ts'
		],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [
			esbuildProblemMatcherPlugin,
			copyHtmlPlugin,
			copyMolstarPlugin,
			copyResourcesPlugin
		],
	});
	if (watch) {
		await ctx.watch();
	} else {
		await ctx.rebuild();
		await ctx.dispose();
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
