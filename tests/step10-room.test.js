// 步驟 10 伺服器：房間規則 → VERIFY STEP 9（multiplayer 分支）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room, MAX_PLAYERS, NAME_MAX } from '../server/room.js';
import { decodeWorld } from '../src/codec.js';
import { AIR, BRICK } from '../src/blocks.js';

// 假的連線：把收到的訊息存起來
function conn() {
  return { inbox: [], send(msg) { this.inbox.push(msg); }, last(t) { return this.inbox.filter((m) => m.t === t).at(-1); } };
}
function joined(room, name = 'A') {
  const c = conn();
  room.connect(c);
  room.receive(c, { t: 'hello', name });
  return c;
}

test('加入 → 收到自己的編號、整座島、其他人、有沒有下雨', () => {
  const room = new Room();
  const a = joined(room, '小明');
  const w = a.last('welcome');
  assert.ok(w.id);
  assert.deepEqual(decodeWorld(w.world), room.world.blocks);
  assert.deepEqual(w.players, []);
  assert.equal(w.rain, false);
  assert.equal(w.name, '小明');
});

test('第二個人加入 → 第一個人收到 join；第二個人看得到第一個人', () => {
  const room = new Room();
  const a = joined(room, 'A');
  const b = joined(room, 'B');
  const j = a.last('join');
  assert.equal(j.player.name, 'B');
  assert.equal(j.player.id, b.last('welcome').id);
  assert.deepEqual(b.last('welcome').players.map((p) => p.name), ['A']);
});

test('別人走路、轉頭 → 其他人收到 move，自己不會收到回音', () => {
  const room = new Room();
  const a = joined(room, 'A');
  const b = joined(room, 'B');
  room.receive(a, { t: 'move', x: 10.5, y: 17, z: 12.25, yaw: 1, pitch: -0.2 });
  const m = b.last('move');
  assert.deepEqual(m, { t: 'move', id: a.last('welcome').id, x: 10.5, y: 17, z: 12.25, yaw: 1, pitch: -0.2 });
  assert.equal(a.last('move'), undefined);
});

test('別人挖掉或放一格方塊 → 伺服器的島跟著變，其他人收到 set', () => {
  const room = new Room();
  const a = joined(room, 'A');
  const b = joined(room, 'B');
  room.receive(a, { t: 'set', x: 3, y: 20, z: 4, b: BRICK });
  assert.equal(room.world.get(3, 20, 4), BRICK);
  assert.deepEqual(b.last('set'), { t: 'set', x: 3, y: 20, z: 4, b: BRICK });
  assert.equal(a.last('set'), undefined);
});

test('後來才加入的人 → 看到的是大家改過之後的島', () => {
  const room = new Room();
  const a = joined(room, 'A');
  room.receive(a, { t: 'set', x: 3, y: 20, z: 4, b: BRICK });
  room.receive(a, { t: 'set', x: 16, y: 16, z: 16, b: AIR });
  const late = joined(room, 'C');
  const blocks = decodeWorld(late.last('welcome').world);
  assert.equal(blocks[room.world.index(3, 20, 4)], BRICK);
  assert.equal(blocks[room.world.index(16, 16, 16)], AIR);
});

test('有人按 R → 大家一起下雨；後來加入的人也知道在下雨', () => {
  const room = new Room();
  const a = joined(room, 'A');
  const b = joined(room, 'B');
  room.receive(a, { t: 'rain', on: true });
  assert.deepEqual(b.last('rain'), { t: 'rain', on: true });
  assert.equal(joined(room, 'C').last('welcome').rain, true);
});

test('有人離開 → 其他人收到 leave', () => {
  const room = new Room();
  const a = joined(room, 'A');
  const b = joined(room, 'B');
  room.disconnect(b);
  assert.equal(a.last('leave').id, b.last('welcome').id);
  assert.equal(room.players.size, 1);
});

test(`第 ${MAX_PLAYERS + 1} 個人加入 → 人數已滿`, () => {
  const room = new Room();
  const conns = Array.from({ length: MAX_PLAYERS }, (_, i) => joined(room, `P${i}`));
  const extra = joined(room, 'X');
  assert.ok(extra.last('full'));
  assert.equal(extra.last('welcome'), undefined);
  assert.equal(room.players.size, MAX_PLAYERS);
  assert.ok(conns.every((c) => !c.inbox.some((m) => m.t === 'join' && m.player.name === 'X')));
});

test('不可以：傳來世界外面或不存在的方塊也被接受', () => {
  const room = new Room();
  const a = joined(room, 'A');
  const b = joined(room, 'B');
  const before = room.world.blocks.slice();
  room.receive(a, { t: 'set', x: 40, y: 5, z: 5, b: BRICK });
  room.receive(a, { t: 'set', x: 1.5, y: 5, z: 5, b: BRICK });
  room.receive(a, { t: 'set', x: 3, y: 20, z: 4, b: 99 });
  room.receive(a, { t: 'set', x: 3, y: 20, z: 4, b: 'brick' });
  assert.deepEqual(room.world.blocks, before);
  assert.equal(b.last('set'), undefined, '別人沒收到');
  // 送錯的人收到那格真正的樣子，自己的畫面會改回來
  assert.deepEqual(a.last('set'), { t: 'set', x: 3, y: 20, z: 4, b: room.world.get(3, 20, 4) });
});

test('不可以：名字太長或塞奇怪的字弄壞別人的畫面', () => {
  const room = new Room();
  const long = joined(room, 'x'.repeat(200));
  assert.ok(long.last('welcome').name.length <= NAME_MAX);
  const weird = joined(room, 'a\u0000b\n‮c​d');
  assert.equal(weird.last('welcome').name, 'abcd');
  const empty = joined(room, '   ');
  assert.match(empty.last('welcome').name, /^玩家\d+$/);
  const notString = joined(room, { evil: true });
  assert.match(notString.last('welcome').name, /^玩家\d+$/);
});

test('還沒 hello 的連線、亂七八糟的訊息 → 不理它', () => {
  const room = new Room();
  const a = joined(room, 'A');
  const stranger = conn();
  room.connect(stranger);
  room.receive(stranger, { t: 'move', x: 1, y: 2, z: 3, yaw: 0, pitch: 0 });
  room.receive(stranger, { t: 'set', x: 3, y: 20, z: 4, b: BRICK });
  room.receive(a, { t: 'move', x: NaN, y: 2, z: 3, yaw: 0, pitch: 0 });
  room.receive(a, { t: 'nope' });
  room.receive(a, null);
  assert.equal(a.inbox.filter((m) => m.t !== 'welcome').length, 0);
  assert.equal(room.world.get(3, 20, 4), AIR);
});
