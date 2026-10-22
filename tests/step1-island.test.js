// 步驟 1 小島和走路 → VERIFY STEP 0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, SIZE } from '../src/world.js';
import { AIR, GRASS, DIRT, STONE, SAND, LOG, LEAVES, PLANKS, BRICK } from '../src/blocks.js';
import { raycast } from '../src/raycast.js';
import { buildMesh } from '../src/render/mesher.js';
import { Game } from '../src/game.js';
import { input, run, standAt } from './helpers.js';

function countBlocks(world) {
  const counts = {};
  for (let x = 0; x < world.size; x++)
    for (let y = 0; y < world.size; y++)
      for (let z = 0; z < world.size; z++) {
        const id = world.get(x, y, z);
        counts[id] = (counts[id] ?? 0) + 1;
      }
  return counts;
}

test('不可以：世界超過 32 × 32 × 32 格', () => {
  const w = new World();
  assert.equal(SIZE, 32);
  assert.equal(w.size, 32);
  assert.equal(w.set(32, 0, 0, DIRT), false);
  assert.equal(w.set(0, -1, 0, DIRT), false);
  assert.equal(w.get(40, 5, 5), AIR);
  assert.equal(w.set(31, 31, 31, DIRT), true);
  assert.equal(w.get(31, 31, 31), DIRT);
});

test('小島有草、泥土、石頭、沙子、樹和小屋', () => {
  const game = new Game();
  const c = countBlocks(game.world);
  for (const id of [GRASS, DIRT, STONE, SAND, LOG, LEAVES, PLANKS, BRICK]) {
    assert.ok(c[id] > 0, `方塊 ${id} 應該出現在島上`);
  }
});

test('小島浮在天空：最底下一層是空的', () => {
  const game = new Game();
  for (let x = 0; x < 32; x++)
    for (let z = 0; z < 32; z++) assert.equal(game.world.get(x, 0, z), AIR);
});

test('每次產生的小島都一樣', () => {
  const a = new Game().world.blocks;
  const b = new Game().world.blocks;
  assert.deepEqual(a, b);
});

test('出生後站在地面上，不會掉下去', () => {
  const game = new Game();
  run(game, 1);
  const p = game.player;
  assert.ok(p.onGround);
  assert.ok(game.world.isSolid(Math.floor(p.pos.x), Math.round(p.pos.y) - 1, Math.floor(p.pos.z)));
  assert.ok(Math.abs(p.pos.y - Math.round(p.pos.y)) < 1e-6);
});

test('按 W 往面對的方向走', () => {
  const game = new Game();
  standAt(game, 12.5, 16.5, 0); // yaw 0 面向 -z
  const z0 = game.player.pos.z;
  const x0 = game.player.pos.x;
  run(game, 0.5, () => input({ forward: true }));
  assert.ok(game.player.pos.z < z0 - 1, '應該往 -z 走了一段');
  assert.ok(Math.abs(game.player.pos.x - x0) < 0.01);
});

test('按 D 往右走', () => {
  const game = new Game();
  standAt(game, 12.5, 16.5, 0);
  const x0 = game.player.pos.x;
  run(game, 0.5, () => input({ right: true }));
  assert.ok(game.player.pos.x > x0 + 1);
});

test('空白鍵跳得起來，跳得上一格高', () => {
  const game = new Game();
  standAt(game, 12.5, 16.5, 0);
  const y0 = game.player.pos.y;
  let maxY = y0;
  game.update(1 / 60, input({ jump: true }));
  for (let i = 0; i < 60; i++) {
    game.update(1 / 60, input());
    maxY = Math.max(maxY, game.player.pos.y);
  }
  assert.ok(maxY > y0 + 1, `跳到 ${maxY - y0} 格高`);
  assert.ok(game.player.onGround);
});

test('會被方塊擋住，不會穿牆', () => {
  const game = new Game();
  const w = game.world;
  // 在玩家前面蓋一道兩格高的牆
  standAt(game, 12.5, 16.5, 0);
  const y = Math.round(game.player.pos.y);
  for (let x = 10; x <= 15; x++) {
    w.set(x, y, 14, BRICK);
    w.set(x, y + 1, 14, BRICK);
  }
  run(game, 2, () => input({ forward: true }));
  assert.ok(game.player.pos.z >= 15 + 0.3 - 1e-6, `玩家 z=${game.player.pos.z} 穿進牆了`);
});

test('從島邊掉下去 → 回到島上', () => {
  const game = new Game();
  const spawn = { ...game.world.spawn };
  const p = game.player;
  p.pos.x = 1.5; p.pos.y = 20; p.pos.z = 1.5; // 島外的空中
  let respawned = false;
  for (let i = 0; i < 60 * 6 && !respawned; i++) {
    game.update(1 / 60, input());
    if (Math.hypot(p.pos.x - spawn.x, p.pos.z - spawn.z) < 0.01 && p.pos.y > 10) respawned = true;
  }
  assert.ok(respawned, '掉下去後應該回到出生點');
});

test('從眼睛往下看，射線打到方塊的上面', () => {
  const w = new World();
  w.set(5, 5, 5, STONE);
  const hit = raycast(w, { x: 5.5, y: 8, z: 5.5 }, { x: 0, y: -1, z: 0 }, 5);
  assert.deepEqual([hit.x, hit.y, hit.z], [5, 5, 5]);
  assert.deepEqual(hit.normal, [0, 1, 0]);
  assert.equal(raycast(w, { x: 5.5, y: 8, z: 5.5 }, { x: 0, y: 1, z: 0 }, 5), null);
});

test('射線最遠 5 格', () => {
  const w = new World();
  w.set(5, 5, 5, STONE);
  assert.equal(raycast(w, { x: 5.5, y: 12, z: 5.5 }, { x: 0, y: -1, z: 0 }, 5), null);
});

test('畫面只畫露在外面的面', () => {
  const w = new World();
  w.set(3, 3, 3, DIRT);
  assert.equal(buildMesh(w).faceCount, 6);
  w.set(4, 3, 3, DIRT);
  assert.equal(buildMesh(w).faceCount, 10);
  const m = buildMesh(w);
  assert.equal(m.positions.length, m.faceCount * 4 * 3);
  assert.equal(m.uvs.length, m.faceCount * 4 * 2);
  assert.equal(m.indices.length, m.faceCount * 6);
});

test('草地的上面用 grass_top、側面 grass_side、底面 dirt', () => {
  const w = new World();
  w.set(3, 3, 3, GRASS);
  const m = buildMesh(w);
  assert.deepEqual([...m.faceTiles].sort(), [0, 1, 1, 1, 1, 2].sort());
});
