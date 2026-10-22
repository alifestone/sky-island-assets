// 開發用的本機靜態伺服器：npm start → http://localhost:8080
// 只是把資料夾裡的檔案送給瀏覽器（ES module 不能用 file:// 開），不需要安裝任何套件。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

export function contentType(path) {
  return TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream';
}

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

// 送靜態檔案的 http 伺服器（還沒開始聽）
export function createStaticServer() {
  return createServer(async (req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = normalize(join(ROOT, url.endsWith('/') ? url + 'index.html' : url));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': contentType(file) }).end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
}

export function startServer(port = 8080) {
  const server = createStaticServer();
  server.listen(port, () => console.log(`空中之島：http://localhost:${port}`));
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer(Number(process.env.PORT) || 8080);
}
