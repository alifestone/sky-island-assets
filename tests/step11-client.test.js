// 步驟 11 連線：兩個 Game 透過真的伺服器一起玩 → VERIFY STEP 9（multiplayer 分支）
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startMultiplayerServer } from '../scripts/server.js';
import { Game } from '../src/game.js';
import { NetClient } from '../src/net.js';
import { AIR, DIRT, HOTBAR } from '../src/blocks.js';
import { World, generateIsland } from '../src/world.js';
import { input, standAt, aimAt, mineUntilGone } from './helpers.js';

let srv;
before(async () => { srv = await startMultiplayerServer(0, '127.0.0.1'); });
after(() => srv.close());

const url = () => `ws://127.0.0.1:${srv.port}/ws`;
const tick = () => new Promise((r) => setTimeout(r, 5));

// 一個玩家：自己的 Game + 連到伺服器
async function player(name) {
  const game = new Game();
  const net = new NetClient(game, { url: url(), name });
  await until([net], () => net.status === 'online');
  return { game, net };
}

// 一直跑 update（讓訊息送出、收進來），直到 cond() 成立
async function until(nets, cond, ms = 2000) {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('等太久了');
    for (const n of nets) n.update(1 / 60);
    await tick();
  }
}

test('兩邊看到同一座島；後來才加入的人看到改過之後的島', async () => {
  const a = await player('A');
  a.game.world.set(3, 20, 4, DIRT);
  a.game.events.push({ t: 'set', x: 3, y: 20, z: 4, b: DIRT });
  await until([a.net], () => srv.room.world.get(3, 20, 4) === DIRT);
  const b = await player('B');
  assert.deepEqual(b.game.world.blocks, a.game.world.blocks);
  const fresh = generateIsland(new World());
  assert.notEqual(fresh.get(3, 20, 4), b.game.world.get(3, 20, 4));
  a.net.close(); b.net.close();
});

test('別人挖掉一格 → 我這邊那一格也不見；別人放一格 → 我這邊也出現', async () => {
  const a = await player('A');
  const b = await player('B');
  const g = a.game;
  standAt(g, 13.5, 16.5, 0);
  const y = Math.round(g.player.pos.y);
  // 先放一格泥土再挖掉
  g.inventory.slot(DIRT).count = 1;
  g.update(1 / 60, input({ select: { index: HOTBAR.indexOf(DIRT) } }));
  aimAt(g, 13, y - 1 + 0.5, 13);
  g.update(1 / 60, input({ place: true }));
  assert.equal(g.world.get(13, y, 13), DIRT);
  await until([a.net, b.net], () => b.game.world.get(13, y, 13) === DIRT);

  aimAt(g, 13, y, 13);
  mineUntilGone(g, { x: 13, y, z: 13 });
  await until([a.net, b.net], () => b.game.world.get(13, y, 13) === AIR);
  a.net.close(); b.net.close();
});

test('別人走路、轉頭 → 我這邊看得到他的小人跟著動、手腳會擺，頭上有名字', async () => {
  const a = await player('小明');
  const b = await player('B');
  const idA = a.net.id;
  await until([a.net, b.net], () => b.game.others.has(idA));
  const other = b.game.others.get(idA);
  assert.equal(other.name, '小明');
  standAt(a.game, 13.5, 19.5, 0);
  let swung = false;
  for (let i = 0; i < 60; i++) {
    a.game.update(1 / 60, input({ forward: true }));
    a.net.update(1 / 60);
    b.net.update(1 / 60);
    if ((other.walkBlend ?? 0) > 0.3) swung = true;
    await tick();
  }
  await until([a.net, b.net], () => Math.abs(other.pos.z - a.game.player.pos.z) < 0.3);
  assert.ok(swung, '走路時手腳有擺');
  a.game.look(0.8, -0.3);
  await until([a.net, b.net], () => Math.abs(other.pitch - a.game.player.pitch) < 1e-9 && Math.abs(other.targetYaw - a.game.player.yaw) < 1e-9);
  a.net.close(); b.net.close();
});

test('有人按 R → 大家一起下雨／停雨', async () => {
  const a = await player('A');
  const b = await player('B');
  a.game.update(1 / 60, input({ toggleRain: true }));
  await until([a.net, b.net], () => b.game.rain.active === true);
  a.game.update(1 / 60, input({ toggleRain: true }));
  await until([a.net, b.net], () => b.game.rain.active === false);
  a.net.close(); b.net.close();
});

test('畫面角落顯示「多人：N 人在線上」；有人關掉網頁 → 他的小人消失', async () => {
  const a = await player('A');
  const b = await player('B');
  await until([a.net, b.net], () => b.game.others.size === 1);
  assert.equal(b.net.statusText(), '多人：2 人在線上');
  a.net.close();
  await until([b.net], () => b.game.others.size === 0);
  assert.equal(b.net.statusText(), '多人：1 人在線上');
  b.net.close();
});

test('沒有伺服器 → 照樣能一個人玩，顯示「單人」', async () => {
  const game = new Game();
  const net = new NetClient(game, { url: 'ws://127.0.0.1:1/ws', name: 'A' });
  await until([net], () => net.status === 'offline');
  assert.equal(net.statusText(), '單人');
  standAt(game, 13.5, 16.5, 0);
  game.update(1 / 60, input({ toggleRain: true }));
  assert.equal(game.rain.active, true, '一個人照樣能玩');
  for (let i = 0; i < 100; i++) game.update(1 / 60, input({ toggleRain: i % 2 === 0 }));
  net.update(1 / 60);
  assert.ok((game.events?.length ?? 0) === 0, '沒連線時事件不會一直堆著');
});

test('人數已滿 → 顯示「人數已滿」，照樣可以一個人玩', async () => {
  // 假的 WebSocket：一連上就回 full
  class FullSocket extends EventTarget {
    constructor() {
      super();
      setTimeout(() => this.dispatchEvent(new Event('open')), 0);
    }
    send(text) {
      if (JSON.parse(text).t === 'hello') {
        setTimeout(() => this.dispatchEvent(Object.assign(new Event('message'), { data: JSON.stringify({ t: 'full', max: 8 }) })), 0);
      }
    }
    close() { this.dispatchEvent(new Event('close')); }
  }
  const game = new Game();
  const net = new NetClient(game, { url: 'ws://x/ws', name: 'A', WebSocketImpl: FullSocket });
  await until([net], () => net.status === 'full');
  assert.equal(net.statusText(), '人數已滿（單人）');
  game.update(1 / 60, input({ toggleRain: true }));
  assert.equal(game.rain.active, true);
});
