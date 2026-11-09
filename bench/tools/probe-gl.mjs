// Reports the WebGL renderer/maxTextureSize headless Chrome gets under several GPU
// flag sets, so the benchmark report can state whether the CPU isosurface path was
// exercised. Usage: node tools/probe-gl.mjs [--headed]
import { chromium } from 'playwright-core';

const CHROME = process.env.BENCH_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const variants = {
  default: [],
  swiftshader: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  metal: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
};

for (const [name, extra] of Object.entries(variants)) {
  let browser;
  try {
    browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--enable-precise-memory-info', '--no-first-run', ...extra] });
    const page = await browser.newPage();
    await page.setContent('<canvas id="c" width="64" height="64"></canvas>');
    const info = await page.evaluate(() => {
      const canvas = document.getElementById('c');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return { available: false };
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        available: true,
        isWebGL2: typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext,
        renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      };
    });
    console.log(name.padEnd(12), JSON.stringify(info));
  } catch (error) {
    console.log(name.padEnd(12), 'LAUNCH_FAILED', String(error.message || error).split('\n')[0]);
  } finally {
    await browser?.close().catch(() => {});
  }
}
