// 步驟 8 衝刺 → VERIFY STEP 7（第 3 批）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { fovFor, BASE_FOV } from '../src/camera.js';
import { run, standAt, input } from './helpers.js';

// 從空地往 -z 走 seconds 秒，回傳走了多遠
function distance(over, seconds = 0.8) {
  const game = new Game();
  standAt(game, 13.5, 19.5, 0);
  const p = game.player.pos;
  const x0 = p.x, z0 = p.z;
  run(game, seconds, () => input(over));
  return { game, d: Math.hypot(p.x - x0, p.z - z0) };
}

test('按住 Shift + W → 跑得比走路快（大約 1.5 倍）', () => {
  const walk = distance({ forward: true }).d;
  const { game, d: sprint } = distance({ forward: true, sprint: true });
  const ratio = sprint / walk;
  assert.ok(ratio > 1.35 && ratio < 1.65, `衝刺是走路的 ${ratio.toFixed(2)} 倍`);
  assert.equal(game.player.sprinting, true);
});

test('衝刺時視角稍微變寬', () => {
  const { game } = distance({ forward: true, sprint: true });
  assert.ok(fovFor(game.player) > BASE_FOV + 5);
});

test('放開 Shift → 回到走路的速度和視角', () => {
  const { game } = distance({ forward: true, sprint: true });
  game.update(1 / 60, input({ forward: true }));
  assert.equal(game.player.sprinting, false);
  assert.equal(fovFor(game.player), BASE_FOV);
  const p = game.player.pos;
  const z0 = p.z;
  run(game, 0.5, () => input({ forward: true }));
  const speed = (z0 - p.z) / 0.5;
  assert.ok(speed > 3.8 && speed < 4.8, `放開後速度 ${speed.toFixed(2)}`);
});

test('不可以：往後退（Shift + S）也在衝刺', () => {
  const back = distance({ back: true }).d;
  const { game, d: shiftBack } = distance({ back: true, sprint: true });
  assert.equal(game.player.sprinting, false);
  assert.ok(Math.abs(shiftBack - back) < 0.01);
  assert.equal(fovFor(game.player), BASE_FOV);
});

test('站著不動按 Shift 不算衝刺', () => {
  const { game } = distance({ sprint: true });
  assert.equal(game.player.sprinting, false);
});
