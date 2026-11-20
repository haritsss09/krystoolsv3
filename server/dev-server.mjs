// Local dev server: static files + Supabase function handlers at /functions/v1/<name>.
// Usage: node server/dev-server.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, normalize, extname, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] || process.env.PORT || 5173);

function loadEnv() {
  const file = join(root, '.env');
  const env = { ...process.env };
  if (!existsSync(file)) return env;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}
const env = loadEnv();

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
};

const FUNCTIONS = new Set(['ai', 'net-inspect']);
const handlers = new Map();

async function getHandler(name) {
  if (!handlers.has(name)) {
    const mod = await import(pathToFileURL(join(root, 'supabase', 'functions', name, 'handler.ts')).href);
    handlers.set(name, mod.handle);
  }
  return handlers.get(name);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 1_000_000) throw new Error('Body too large');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    const fn = url.pathname.match(/^\/functions\/v1\/([\w-]+)$/);
    if (fn) {
      if (!FUNCTIONS.has(fn[1])) {
        res.writeHead(404).end();
        return;
      }
      const handle = await getHandler(fn[1]);
      const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
      headers.set('x-forwarded-for', req.socket.remoteAddress || '127.0.0.1');
      const request = new Request(url, { method: req.method, headers, body });
      const response = await handle(request, env);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }

    if (url.pathname === '/assets/js/config.js' && env.LOCAL_FUNCTIONS === '1') {
      res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' });
      res.end(`export default { functionsUrl: '/functions/v1', anonKey: '' };\n`);
      return;
    }
    if (url.pathname === '/favicon.ico') {
      res.writeHead(204).end();
      return;
    }

    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(root, path));
    if (!file.startsWith(root + sep) || /[\\/](?:\.[^\\/]*|server|supabase|node_modules|tests)(?:[\\/]|$)/i.test(file.slice(root.length))) {
      res.writeHead(404).end('Not found');
      return;
    }
    const info = await stat(file).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(file));
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server error');
  }
});

server.listen(port, '127.0.0.1', () => console.log(`KrysTools dev server on http://localhost:${port}`));
