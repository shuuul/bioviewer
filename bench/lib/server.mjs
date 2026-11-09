// Local HTTP server for the harness page. The CSP is a <meta http-equiv> tag in the
// page, mirroring src/webview/bioviewer.html (with 'self' as the webview CSP source
// and a nonce for the harness script), NOT an HTTP header: VS Code webviews deliver
// CSP through the meta tag, so worker inheritance and 'wasm-unsafe-eval' must be
// validated that way.
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const benchDir = path.resolve(here, '..');
const fixturesDir = path.join(benchDir, 'fixtures');

const MIME = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip',
  '.map': 'application/octet-stream',
  '.json': 'application/json; charset=utf-8',
};

function cspMeta(nonce, variant) {
  // Mirror of the bioviewer.html CSP directive list:
  //   default-src 'none'; img-src 'self' https: data: blob:; style-src 'self';
  //   script-src 'self' 'nonce-<nonce>' 'wasm-unsafe-eval';
  //   connect-src 'self' https: data: blob:; font-src 'self'; worker-src 'self' blob:;
  const wasmEval = variant === 'no-wasm-unsafe-eval' ? '' : " 'wasm-unsafe-eval'";
  const content = [
    "default-src 'none'",
    "img-src 'self' https: data: blob:",
    "style-src 'self'",
    "script-src 'self' 'nonce-" + nonce + "'" + wasmEval,
    "connect-src 'self' https: data: blob:",
    "font-src 'self'",
    "worker-src 'self' blob:",
  ].join('; ') + ';';
  return '<meta http-equiv="Content-Security-Policy" content="' + content + '" />';
}

function pageHtml(nonce, variant) {
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '  <head>',
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '    ' + cspMeta(nonce, variant),
    '    <title>BioViewer bench harness</title>',
    '    <link rel="stylesheet" type="text/css" href="/harness.css" />',
    '  </head>',
    '  <body>',
    '    <div id="root"></div>',
    '    <script nonce="' + nonce + '" type="module" src="/harness.js"></script>',
    '  </body>',
    '</html>',
  ].join('\n');
}

function sendFile(response, filePath) {
  return fs
    .stat(filePath)
    .then((stat) => {
      if (!stat.isFile()) throw new Error('not a file');
      const mime = MIME[path.extname(filePath)] ?? 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': mime, 'Content-Length': stat.size, 'Cache-Control': 'no-store' });
      createReadStream(filePath).pipe(response);
    })
    .catch(() => {
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('not found');
    });
}

export async function startServer({ outDir }) {
  const nonce = randomBytes(12).toString('hex');
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const variant = url.searchParams.get('csp') === 'no-wasm-unsafe-eval' ? 'no-wasm-unsafe-eval' : 'default';
      const html = pageHtml(nonce, variant);
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(html), 'Cache-Control': 'no-store' });
      response.end(html);
      return;
    }
    if (url.pathname.startsWith('/fixtures/')) {
      const name = path.basename(url.pathname);
      return sendFile(response, path.join(fixturesDir, name));
    }
    const name = path.basename(url.pathname);
    return sendFile(response, path.join(outDir, name));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: 'http://127.0.0.1:' + port + '/',
    nonce,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
