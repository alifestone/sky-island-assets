// 步驟 4 撿起來 → VERIFY STEP 3
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { DIRT, STONE } from '../src/blocks.js';
import { STACK_MAX } from '../src/inventory.js';
import { run, standAt, aimAt, mineUntilGone, input } from './helpers.js';

// 挖掉玩家前面 4 格的泥土，等小方塊落地
function dropAhead(id = DIRT) {
  const game = new Game();
  standAt(game, 13.5, 16.5, 0);
  const y = Math.round(game.player.pos.y);
  const b = { x: 13, y, z: 12 };
  game.world.set(b.x, b.y, b.z, id);
  aimAt(game, b.x, b.y, b.z);
  mineUntilGone(game, b);
  run(game, 1.5);
  assert.equal(game.drops.length, 1, '小方塊還在地上');
  return { game, drop: game.drops[0] };
}

const near = (drop, dz) => [drop.pos.x, drop.pos.z + dz];

test('走到旁邊 → 飛到身上，那一格數字 +1', () => {
  const { game, drop } = dropAhead();
  assert.equal(game.inventory.count(DIRT), 0);
  const [x, z] = near(drop, 1.2);
  standAt(game, x, z, 0);
  let flew = false;
  let last = Infinity;
  for (let i = 0; i < 60 && game.drops.length; i++) {
    game.update(1 / 60, input());
    const p = game.player.pos;
    const d = Math.hypot(drop.pos.x - p.x, drop.pos.y - (p.y + 1), drop.pos.z - p.z);
    if (d < last - 0.01) flew = true;
    last = d;
  }
  assert.ok(flew, '小方塊往玩家身上飛');
  assert.equal(game.drops.length, 0, '撿起來後地上沒有了');
  assert.equal(game.inventory.count(DIRT), 1);
  assert.equal(game.inventory.count(STONE), 0, '只有那一格 +1');
});

test('撿兩個 → 數字 +2', () => {
  const { game, drop } = dropAhead();
  const [x, z] = near(drop, 1.2);
  // 再挖一格旁邊的
  const y = Math.round(game.player.pos.y);
  game.world.set(14, y, 12, DIRT);
  aimAt(game, 14, y, 12);
  mineUntilGone(game, { x: 14, y, z: 12 });
  run(game, 1.5);
  standAt(game, x + 0.5, z, 0);
  run(game, 1.5);
  assert.equal(game.inventory.count(DIRT), 2);
});

test('不可以：站在 3 格外也被撿起來', () => {
  const { game, drop } = dropAhead();
  const [x, z] = near(drop, 3);
  standAt(game, x, z, 0);
  run(game, 5);
  assert.equal(game.drops.length, 1);
  assert.equal(game.inventory.count(DIRT), 0);
});

test('那格滿 64 個 → 撿不起來，留在地上', () => {
  const { game, drop } = dropAhead();
  game.inventory.slot(DIRT).count = STACK_MAX;
  const [x, z] = near(drop, 1.2);
  standAt(game, x, z, 0);
  run(game, 3);
  assert.equal(STACK_MAX, 64);
  assert.equal(game.drops.length, 1, '還在地上');
  assert.ok(drop.onGround, '留在地上，沒有飛起來');
  assert.equal(game.inventory.count(DIRT), 64);
});

test('63 個 → 還撿得起來，變成 64', () => {
  const { game, drop } = dropAhead();
  game.inventory.slot(DIRT).count = 63;
  const [x, z] = near(drop, 1.2);
  standAt(game, x, z, 0);
  run(game, 1.5);
  assert.equal(game.inventory.count(DIRT), 64);
  assert.equal(game.drops.length, 0);
});
