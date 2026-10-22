// 步驟 9 人物模型、第三人稱 → VERIFY STEP 8（第 3 批）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { BRICK } from '../src/blocks.js';
import { THIRD_PERSON_DISTANCE } from '../src/camera.js';
import { characterPose } from '../src/character.js';
import { eyePosition, lookDirection } from '../src/physics.js';
import { run, standAt, input } from './helpers.js';

const pressV = (game) => game.update(1 / 60, input({ toggleView: true }));
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.hypot(a.x, a.y, a.z);

function open() {
  const game = new Game();
  standAt(game, 13.5, 19.5, 0);
  return game;
}

test('一開始是第一人稱：相機在眼睛，看不到自己的身體', () => {
  const game = open();
  assert.equal(game.viewMode, 'first');
  const cam = game.camera();
  const eye = eyePosition(game.player);
  assert.ok(len(sub(cam, eye)) < 1e-9);
  assert.equal(game.showCharacter(), false);
});

test('按 V → 第三人稱，從背後看得到自己的小人', () => {
  const game = open();
  pressV(game);
  assert.equal(game.viewMode, 'back');
  assert.equal(game.showCharacter(), true);
  const cam = game.camera();
  const off = sub(cam, eyePosition(game.player));
  assert.ok(Math.abs(len(off) - THIRD_PERSON_DISTANCE) < 0.3, `相機離 ${len(off).toFixed(2)} 格`);
  assert.ok(dot(off, lookDirection(game.player)) < 0, '相機在背後');
  assert.ok(Math.abs(cam.yaw - game.player.yaw) < 1e-9, '和人物看同一個方向');
});

test('再按 V → 從前面看自己的臉；再按一次 → 回到第一人稱', () => {
  const game = open();
  pressV(game);
  pressV(game);
  assert.equal(game.viewMode, 'front');
  const cam = game.camera();
  const off = sub(cam, eyePosition(game.player));
  assert.ok(dot(off, lookDirection(game.player)) > 0, '相機在前面');
  const turned = Math.abs(((cam.yaw - game.player.yaw) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
  assert.ok(turned < 1e-9, '相機轉過來看著人物');
  pressV(game);
  assert.equal(game.viewMode, 'first');
});

test('小人有頭、身體、兩隻手、兩隻腳', () => {
  const pose = characterPose(open().player);
  for (const part of ['head', 'body', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg']) assert.ok(part in pose, part);
});

test('走路時手腳前後擺；站著不動就不擺', () => {
  const game = open();
  let maxSwing = 0;
  let signs = new Set();
  run(game, 1, () => input({ forward: true }));
  for (let i = 0; i < 40; i++) {
    game.update(1 / 60, input({ forward: true }));
    const pose = characterPose(game.player);
    maxSwing = Math.max(maxSwing, Math.abs(pose.leftLeg));
    signs.add(Math.sign(pose.leftLeg));
    assert.ok(Math.abs(pose.leftLeg + pose.rightLeg) < 1e-9, '兩隻腳反著擺');
    assert.ok(Math.abs(pose.leftArm + pose.leftLeg) < 1e-9, '手和同一邊的腳反著擺');
  }
  assert.ok(maxSwing > 0.4, '走路時腳有擺');
  assert.ok(signs.has(1) && signs.has(-1), '前後都有擺');
  run(game, 1);
  const still = characterPose(game.player);
  assert.ok(Math.abs(still.leftLeg) < 0.02 && Math.abs(still.rightArm) < 0.02, '停下來就不擺');
});

test('小人的頭跟著滑鼠上下看，身體跟著轉向', () => {
  const game = open();
  game.look(0.7, -0.4);
  const pose = characterPose(game.player);
  assert.equal(pose.head, game.player.pitch);
  assert.equal(pose.body, game.player.yaw);
});

test('第三人稱一樣可以挖、放方塊，指著的方塊和第一人稱一樣', () => {
  const game = open();
  game.player.pitch = -0.6;
  const first = game.target();
  pressV(game);
  const third = game.target();
  assert.deepEqual([third.x, third.y, third.z, ...third.normal], [first.x, first.y, first.z, ...first.normal]);
  run(game, 1.2, () => input({ mine: true }));
  assert.equal(game.world.get(first.x, first.y, first.z), 0, '第三人稱也挖得掉');
});

test('不可以：相機穿進牆裡（背後是牆時，相機會拉近）', () => {
  const game = open();
  const y = Math.round(game.player.pos.y);
  // 人物背後（+z）1.5 格蓋一道牆
  for (let x = 10; x <= 16; x++) for (let dy = 0; dy < 4; dy++) game.world.set(x, y + dy, 21, BRICK);
  pressV(game);
  const cam = game.camera();
  const d = len(sub(cam, eyePosition(game.player)));
  assert.ok(d < 1.5, `相機拉近到 ${d.toFixed(2)} 格`);
  assert.equal(game.world.isSolid(Math.floor(cam.x), Math.floor(cam.y), Math.floor(cam.z)), false, '相機不在方塊裡');
});
