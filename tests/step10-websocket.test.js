// 步驟 10 伺服器：真的用 WebSocket 連線（Node 22 內建的 WebSocket 當客戶端）
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startMultiplayerServer } from '../scripts/server.js';
import { BRICK } from '../src/blocks.js';

let srv, url, base;
before(async () => {
  srv = await startMultiplayerServer(0, '127.0.0.1');
  base = `http://127.0.0.1:${srv.port}`;
  url = `ws://127.0.0.1:${srv.port}/ws`;
});
after(() => srv.close());

// 連上伺服器；next(t) 等下一則 t 類型的訊息
function client() {
  const ws = new WebSocket(url);
  const queue = [];
  const waiters = [];
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    const i = waiters.findIndex((w) => w.t === msg.t);
    if (i >= 0) waiters.splice(i, 1)[0].resolve(msg);
    else queue.push(msg);
  });
  const opened = new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  return {
    ws, opened,
    send: (m) => ws.send(JSON.stringify(m)),
    next(t) {
      const i = queue.findIndex((m) => m.t === t);
      if (i >= 0) return Promise.resolve(queue.splice(i, 1)[0]);
      return new Promise((resolve, reject) => {
        waiters.push({ t, resolve });
        setTimeout(() => reject(new Error(`等不到 ${t}`)), 2000);
      });
    },
    closed: new Promise((r) => ws.addEventListener('close', r)),
  };
}

test('同一台伺服器也送網頁（npm run server 打開就能玩）', async () => {
  const res = await fetch(`${base}/index.html`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /空中之島/);
});

test('兩個人連線：收到整座島、看到對方加入、方塊改變傳過去、離開也知道', async () => {
  const a = client();
  await a.opened;
  a.send({ t: 'hello', name: 'A' });
  const wa = await a.next('welcome');
  assert.ok(wa.world.length > 40000, '整座島（超過 125 bytes 的大訊息）完整收到');

  const b = client();
  await b.opened;
  b.send({ t: 'hello', name: 'B' });
  const wb = await b.next('welcome');
  assert.equal((await a.next('join')).player.name, 'B');

  a.send({ t: 'set', x: 3, y: 20, z: 4, b: BRICK });
  assert.deepEqual(await b.next('set'), { t: 'set', x: 3, y: 20, z: 4, b: BRICK });

  a.send({ t: 'move', x: 10, y: 17, z: 10, yaw: 0.5, pitch: 0 });
  assert.equal((await b.next('move')).id, wa.id);

  b.ws.close();
  await b.closed;
  assert.equal((await a.next('leave')).id, wb.id);
  a.ws.close();
  await a.closed;
});

test('中文名字、很多訊息連著送都正確', async () => {
  const a = client();
  await a.opened;
  a.send({ t: 'hello', name: '空中之島的小明' });
  assert.equal((await a.next('welcome')).name, '空中之島的小明');
  const b = client();
  await b.opened;
  b.send({ t: 'hello', name: 'B' });
  await b.next('welcome');
  for (let i = 0; i < 50; i++) a.send({ t: 'move', x: i, y: 17, z: 0, yaw: 0, pitch: 0 });
  let lastX = -1;
  for (let i = 0; i < 50; i++) lastX = (await b.next('move')).x;
  assert.equal(lastX, 49);
  a.ws.close(); b.ws.close();
  await Promise.all([a.closed, b.closed]);
});

test('不可以：送超大的訊息塞爆伺服器 → 伺服器把它斷線', async () => {
  const a = client();
  await a.opened;
  a.send({ t: 'hello', name: 'x'.repeat(200000) });
  const ev = await a.closed;
  assert.ok([1009, 1006, 1002].includes(ev.code), `close code ${ev.code}`);
});
