// 步驟 6 下雨 → VERIFY STEP 5（第 2 批，我的點子）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { World, HOUSE } from '../src/world.js';
import { STONE } from '../src/blocks.js';
import { Rain } from '../src/rain.js';
import { run, standAt, input } from './helpers.js';

const pressR = (game) => game.update(1 / 60, input({ toggleRain: true }));

test('按 R → 開始下雨，看得到雨滴往下掉', () => {
  const game = new Game();
  assert.equal(game.rain.active, false);
  pressR(game);
  assert.equal(game.rain.active, true);
  run(game, 0.5);
  assert.ok(game.rain.drops.length > 50, '有很多雨滴');
  const drop = game.rain.drops[0];
  const y0 = drop.y;
  game.update(1 / 60, input());
  assert.ok(drop.y < y0, '雨滴往下掉');
});

test('雨滴在玩家附近，抬頭看得到', () => {
  const game = new Game();
  pressR(game);
  run(game, 0.5);
  const p = game.player.pos;
  for (const d of game.rain.drops) {
    assert.ok(Math.hypot(d.x - p.x, d.z - p.z) < 20);
    assert.ok(d.y > p.y, '從上面掉下來');
  }
});

test('再按一次 R → 雨停了，雨滴不再出現', () => {
  const game = new Game();
  pressR(game);
  run(game, 1);
  pressR(game);
  assert.equal(game.rain.active, false);
  run(game, 3);
  assert.equal(game.rain.drops.length, 0);
});

test('雨滴落到方塊上 → 在那個方塊的上面消失，不會一直往下穿', () => {
  const w = new World();
  w.set(5, 5, 5, STONE);
  const rain = new Rain();
  const d = rain.spawnAt(5.5, 20, 5.5);
  let minY = Infinity;
  for (let i = 0; i < 300 && rain.drops.includes(d); i++) {
    rain.update(1 / 60, w, { x: 5.5, y: 6, z: 5.5 });
    if (rain.drops.includes(d)) minY = Math.min(minY, d.y);
  }
  assert.ok(!rain.drops.includes(d), '雨滴消失了');
  assert.ok(minY >= 6, `雨滴最低到 y=${minY}，穿進方塊了`);
  const splash = rain.splashes.at(-1);
  assert.deepEqual([Math.floor(splash.x), splash.y, Math.floor(splash.z)], [5, 6, 5], '在方塊上面濺開');
});

test('站在空地上下雨 → 畫面上出現「淋雨中」', () => {
  const game = new Game();
  standAt(game, 13.5, 16.5, 0);
  assert.equal(game.wet(), false, '沒下雨不會淋到');
  pressR(game);
  run(game, 0.2);
  assert.equal(game.wet(), true);
  assert.equal(game.status(), '淋雨中');
});

test('站在屋簷下 → 不會被淋到（不出現「淋雨中」）', () => {
  const game = new Game();
  // 小屋西邊牆外那一排，頭上是往外多出來的屋簷
  standAt(game, HOUSE.x0 - 0.5, (HOUSE.z0 + HOUSE.z1) / 2 + 0.5, 0);
  const p = game.player.pos;
  assert.ok(game.world.isSolid(Math.floor(p.x), HOUSE.roofY, Math.floor(p.z)), '頭上是屋簷');
  pressR(game);
  run(game, 1);
  assert.equal(game.wet(), false);
  assert.notEqual(game.status(), '淋雨中');
});

test('走出屋簷 → 又會淋到', () => {
  const game = new Game();
  standAt(game, HOUSE.x0 - 2.5, (HOUSE.z0 + HOUSE.z1) / 2 + 0.5, 0);
  pressR(game);
  run(game, 0.2);
  assert.equal(game.wet(), true);
});

test('不可以：雨滴穿過屋頂、掉進屋子裡', () => {
  const game = new Game();
  standAt(game, HOUSE.x0 - 0.5, HOUSE.z0 + 2.5, 0); // 站在小屋旁邊，雨下在小屋上
  pressR(game);
  const inFootprint = (d) =>
    d.x >= HOUSE.x0 - 1 && d.x < HOUSE.x1 + 2 && d.z >= HOUSE.z0 - 1 && d.z < HOUSE.z1 + 2;
  let onRoof = 0;
  for (let i = 0; i < 60 * 4; i++) {
    game.update(1 / 60, input());
    for (const d of game.rain.drops) {
      if (inFootprint(d)) assert.ok(d.y >= HOUSE.roofY + 1 - 1e-9, `雨滴穿過屋頂到了 y=${d.y}`);
    }
  }
  for (const s of game.rain.splashes) if (inFootprint(s)) onRoof++;
  assert.ok(onRoof > 10, '雨真的有下在屋頂上');
});
