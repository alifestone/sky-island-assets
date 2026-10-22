// 步驟 5 放回去 → VERIFY STEP 4
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { AIR, DIRT, STONE, HOTBAR } from '../src/blocks.js';
import { run, standAt, aimAt, mineUntilGone, input } from './helpers.js';

const selectDirt = (game) => game.update(1 / 60, input({ select: { index: HOTBAR.indexOf(DIRT) } }));
const rightClick = (game) => game.update(1 / 60, input({ place: true }));

// 看著 (bx, by, bz) 那一格「上面」的正中間（看方塊中心的話，射線可能先打到前面那格的上面）
function aimAtTop(game, bx, by, bz) {
  aimAt(game, bx, by + 0.5, bz);
}

// 站好，看著前面地上 (13, y-1, 13) 那格草地的上面
function lookAtGroundAhead() {
  const game = new Game();
  standAt(game, 13.5, 16.5, 0);
  const y = Math.round(game.player.pos.y);
  aimAtTop(game, 13, y - 1, 13);
  const t = game.target();
  assert.deepEqual([t.x, t.y, t.z, ...t.normal], [13, y - 1, 13, 0, 1, 0]);
  return { game, y, above: { x: 13, y, z: 13 } };
}

test('選那一格按右鍵 → 放出一格，數字 −1', () => {
  const { game, above } = lookAtGroundAhead();
  game.inventory.slot(DIRT).count = 3;
  selectDirt(game);
  rightClick(game);
  assert.equal(game.world.get(above.x, above.y, above.z), DIRT, '放在看著的那一面上');
  assert.equal(game.inventory.count(DIRT), 2);
});

test('放的是選中的那種方塊', () => {
  const { game, above } = lookAtGroundAhead();
  game.inventory.slot(DIRT).count = 3;
  game.inventory.slot(STONE).count = 3;
  game.update(1 / 60, input({ select: { index: HOTBAR.indexOf(STONE) } }));
  rightClick(game);
  assert.equal(game.world.get(above.x, above.y, above.z), STONE);
  assert.equal(game.inventory.count(STONE), 2);
  assert.equal(game.inventory.count(DIRT), 3);
});

test('按一下只放一格', () => {
  const { game } = lookAtGroundAhead();
  game.inventory.slot(DIRT).count = 10;
  selectDirt(game);
  rightClick(game);
  run(game, 1);
  assert.equal(game.inventory.count(DIRT), 9);
});

test('不可以：數字是 0 還放得出來', () => {
  const { game, above } = lookAtGroundAhead();
  selectDirt(game);
  assert.equal(game.inventory.count(DIRT), 0);
  rightClick(game);
  assert.equal(game.world.get(above.x, above.y, above.z), AIR);
  assert.equal(game.inventory.count(DIRT), 0);
});

test('整串走一遍（挖 → 掉 → 撿 → 放）→ 數字回到原本', () => {
  const game = new Game();
  standAt(game, 13.5, 16.5, 0);
  const y = Math.round(game.player.pos.y);
  const b = { x: 13, y, z: 12 };
  game.world.set(b.x, b.y, b.z, DIRT);
  game.inventory.slot(DIRT).count = 5;
  const before = game.inventory.count(DIRT);

  aimAt(game, b.x, b.y, b.z);
  mineUntilGone(game, b); // 挖
  assert.equal(game.drops.length, 1); // 掉
  run(game, 1.5);
  standAt(game, 13.5, 13.7, 0); // 走過去撿
  run(game, 1.5);
  assert.equal(game.inventory.count(DIRT), before + 1);

  standAt(game, 13.5, 16.5, 0); // 走回來放回原位
  aimAtTop(game, b.x, b.y - 1, b.z);
  selectDirt(game);
  rightClick(game);
  assert.equal(game.world.get(b.x, b.y, b.z), DIRT);
  assert.equal(game.inventory.count(DIRT), before);
});

test('不可以：對自己站的那格按右鍵還放得出來', () => {
  const game = new Game();
  standAt(game, 13.5, 16.5, 0, -Math.PI / 2 + 0.01); // 低頭看腳下
  const p = game.player.pos;
  const feet = { x: Math.floor(p.x), y: Math.round(p.y), z: Math.floor(p.z) };
  const t = game.target();
  assert.deepEqual([t.x, t.y + 1, t.z], [feet.x, feet.y, feet.z], '看著腳下那格的上面');
  game.inventory.slot(DIRT).count = 3;
  selectDirt(game);
  rightClick(game);
  assert.equal(game.world.get(feet.x, feet.y, feet.z), AIR);
  assert.equal(game.inventory.count(DIRT), 3);
});

test('不可以：放在頭的那一格', () => {
  const game = new Game();
  standAt(game, 13.5, 16.5, 0);
  const y = Math.round(game.player.pos.y);
  // 頭上 3 格放一塊石頭當天花板，抬頭看它的下面 → 要放的位置是頭那格上面一格（空的），可以放
  game.world.set(13, y + 3, 16, STONE);
  game.player.pitch = Math.PI / 2 - 0.01;
  game.inventory.slot(DIRT).count = 3;
  selectDirt(game);
  rightClick(game);
  assert.equal(game.world.get(13, y + 2, 16), DIRT, '頭上方一格是空的，可以放');
  // 再按一次：要放在 y+1，就是頭的那一格 → 不行
  rightClick(game);
  assert.equal(game.world.get(13, y + 1, 16), AIR);
  assert.equal(game.inventory.count(DIRT), 2);
});
