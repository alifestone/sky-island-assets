// 步驟 3 掉出來 → VERIFY STEP 2
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { DIRT, GRASS, STONE, AIR } from '../src/blocks.js';
import { DROP_SIZE } from '../src/drops.js';
import { run, standAt, aimAt, mineUntilGone } from './helpers.js';

// 在玩家前面 4 格放一格方塊，看著它（離玩家夠遠，才不會馬上被撿走）
function blockAhead(id) {
  const game = new Game();
  standAt(game, 13.5, 16.5, 0);
  const y = Math.round(game.player.pos.y);
  const b = { x: 13, y, z: 12 };
  game.world.set(b.x, b.y, b.z, id);
  aimAt(game, b.x, b.y, b.z);
  return { game, b };
}

test('方塊不見 → 彈出同種類的小方塊', () => {
  const { game, b } = blockAhead(DIRT);
  assert.equal(game.drops.length, 0);
  mineUntilGone(game, b);
  assert.equal(game.drops.length, 1);
  const d = game.drops[0];
  assert.equal(d.id, DIRT);
  assert.ok(Math.hypot(d.pos.x - (b.x + 0.5), d.pos.z - (b.z + 0.5)) < 0.6, '在原本那格的位置');
  assert.ok(DROP_SIZE < 0.5, '是小方塊');
});

test('挖草地掉出草地、挖石頭掉出石頭', () => {
  for (const id of [GRASS, STONE]) {
    const { game, b } = blockAhead(id);
    mineUntilGone(game, b);
    assert.equal(game.drops[0].id, id);
  }
});

test('小方塊會往上彈一下', () => {
  const { game, b } = blockAhead(DIRT);
  mineUntilGone(game, b);
  const y0 = game.drops[0].pos.y;
  let maxY = y0;
  for (let i = 0; i < 30; i++) {
    game.update(1 / 60, {});
    maxY = Math.max(maxY, game.drops[0].pos.y);
  }
  assert.ok(maxY > y0 + 0.1);
});

test('小方塊慢慢轉', () => {
  const { game, b } = blockAhead(DIRT);
  mineUntilGone(game, b);
  const a0 = game.drops[0].spin;
  run(game, 1);
  const turned = game.drops[0].spin - a0;
  assert.ok(turned > 0.5 && turned < 4, `一秒轉了 ${turned.toFixed(2)} 弧度`);
});

test('不可以：浮在空中、穿過地面', () => {
  const { game, b } = blockAhead(DIRT);
  mineUntilGone(game, b);
  const d = game.drops[0];
  const groundTop = b.y; // 挖掉的那格下面是地面，地面頂端就在 y = b.y
  let minBottom = Infinity;
  for (let i = 0; i < 120; i++) {
    game.update(1 / 60, {});
    minBottom = Math.min(minBottom, d.pos.y - DROP_SIZE / 2);
  }
  assert.ok(minBottom >= groundTop - 1e-6, '沒有穿過地面');
  assert.ok(d.onGround, '最後停在地上');
  assert.ok(Math.abs(d.pos.y - DROP_SIZE / 2 - groundTop) < 0.05, '貼著地面，沒有浮著');
});

test('不可以：腳下的方塊被挖掉還浮在空中', () => {
  const { game, b } = blockAhead(DIRT);
  mineUntilGone(game, b);
  run(game, 2);
  const d = game.drops[0];
  game.world.set(b.x, b.y - 1, b.z, AIR);
  run(game, 0.5);
  assert.ok(d.pos.y - DROP_SIZE / 2 < b.y - 0.5, '下面空了就往下掉');
});
