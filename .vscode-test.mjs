import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: 'out/test/**/*.test.js',
	// GPU-less CI runners have WebGL only through Chromium's software renderer.
	launchArgs: ['--enable-unsafe-swiftshader'],
});
