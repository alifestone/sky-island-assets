// 步驟 2 挖方塊 → VERIFY STEP 1
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { AIR, DIRT, STONE } from '../src/blocks.js';
import { input, run, standAt } from './helpers.js';

// 站在空地上，把腳下那格換成 id，低頭看著它
function lookAtGround(id) {
  const game = new Game();
  standAt(game, 13.5, 16.5, 0, -1.5);
  const t = game.target();
  game.world.set(t.x, t.y, t.z, id);
  return { game, block: { x: t.x, y: t.y, z: t.z } };
}

const at = (game, b) => game.world.get(b.x, b.y, b.z);
const hold = () => input({ mine: true });

test('按住左鍵挖泥土 → 越裂越大，不到 1 秒不見', () => {
  const { game, block } = lookAtGround(DIRT);
  const stages = [];
  for (let i = 0; i < 59 && at(game, block) !== AIR; i++) {
    game.update(1 / 60, hold());
    if (game.crack()) stages.push(game.crack().stage);
  }
  assert.equal(at(game, block), AIR, '1 秒內應該挖掉');
  assert.equal(stages[0], 0, '裂痕從第 0 張開始');
  assert.ok(stages.at(-1) >= 8, '挖掉前裂痕快到最後一張');
  for (let i = 1; i < stages.length; i++) assert.ok(stages[i] >= stages[i - 1], '裂痕只會越來越大');
});

test('裂痕在挖的那一格上', () => {
  const { game, block } = lookAtGround(DIRT);
  run(game, 0.3, hold);
  const c = game.crack();
  assert.deepEqual([c.x, c.y, c.z], [block.x, block.y, block.z]);
  assert.ok(c.stage >= 2 && c.stage <= 6);
});

test('不可以：只點一下就不見', () => {
  const { game, block } = lookAtGround(DIRT);
  game.update(1 / 60, hold());
  run(game, 2);
  assert.equal(at(game, block), DIRT);
});

test('挖到一半放開 → 裂痕不見，要從頭挖', () => {
  const { game, block } = lookAtGround(DIRT);
  run(game, 0.45, hold);
  assert.ok(game.crack(), '挖的時候有裂痕');
  game.update(1 / 60, input());
  assert.equal(game.crack(), null, '放開後裂痕不見');
  run(game, 0.45, hold);
  assert.equal(at(game, block), DIRT, '從頭挖，0.45 秒還挖不掉');
  assert.ok(game.crack().stage <= 6);
});

test('挖石頭 → 比泥土久，大約 2 秒', () => {
  const { game, block } = lookAtGround(STONE);
  let t = 0;
  while (at(game, block) !== AIR && t < 5) {
    game.update(1 / 60, hold());
    t += 1 / 60;
  }
  assert.equal(at(game, block), AIR);
  assert.ok(t > 1.6 && t < 2.4, `石頭花了 ${t.toFixed(2)} 秒`);
});

test('挖到一半轉去看別格 → 從頭挖', () => {
  const { game, block } = lookAtGround(DIRT);
  run(game, 0.5, hold);
  game.player.pitch = 0; game.player.yaw = Math.PI / 2; // 看向天空，沒有方塊
  game.update(1 / 60, hold());
  assert.equal(game.crack(), null);
  game.player.pitch = -1.5; game.player.yaw = 0;
  run(game, 0.3, hold);
  assert.equal(at(game, block), DIRT);
});
