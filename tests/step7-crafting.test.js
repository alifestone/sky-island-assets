// 步驟 7 合成台 → VERIFY STEP 6（第 3 批）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { AIR, LOG, PLANKS, STONE, SAND, BRICK, CRAFTING_TABLE, HOTBAR } from '../src/blocks.js';
import { RECIPES } from '../src/crafting.js';
import { run, standAt, aimAt, mineUntilGone, input } from './helpers.js';

const pressE = (game) => game.update(1 / 60, input({ toggleCraft: true }));
const inv = (game) => game.inventory;

// 站在空地上；在前面 dz 格的地上放一個合成台
function withTable(dz) {
  const game = new Game();
  standAt(game, 13.5, 16.5, 0);
  const y = Math.round(game.player.pos.y);
  game.world.set(13, y, 16 - dz, CRAFTING_TABLE);
  return { game, y };
}

test('按 E → 打開合成畫面，看得到每個配方要什麼、做出什麼', () => {
  const game = new Game();
  assert.equal(game.craftingOpen, false);
  pressE(game);
  assert.equal(game.craftingOpen, true);
  const list = game.recipeList();
  assert.equal(list.length, RECIPES.length);
  for (const r of list) {
    assert.ok(r.name && r.inputs.length > 0 && r.output.count > 0);
    assert.equal(typeof r.canCraft, 'boolean');
  }
  const names = list.map((r) => r.output.id);
  assert.ok(names.includes(PLANKS) && names.includes(CRAFTING_TABLE) && names.includes(BRICK));
});

test('1 個原木 → 合成木板：原木 −1、木板 +4', () => {
  const game = new Game();
  inv(game).slot(LOG).count = 1;
  pressE(game);
  assert.equal(game.craft('planks'), true);
  assert.equal(inv(game).count(LOG), 0);
  assert.equal(inv(game).count(PLANKS), 4);
});

test('4 個木板 → 合成 1 個合成台，選它按右鍵可以放在地上', () => {
  const game = new Game();
  standAt(game, 13.5, 16.5, 0);
  const y = Math.round(game.player.pos.y);
  inv(game).slot(PLANKS).count = 4;
  pressE(game);
  assert.equal(game.craft('table'), true);
  assert.equal(inv(game).count(PLANKS), 0);
  assert.equal(inv(game).count(CRAFTING_TABLE), 1);
  pressE(game); // 關掉
  aimAt(game, 13, y - 1 + 0.5, 13);
  game.update(1 / 60, input({ select: { index: HOTBAR.indexOf(CRAFTING_TABLE) } }));
  game.update(1 / 60, input({ place: true }));
  assert.equal(game.world.get(13, y, 13), CRAFTING_TABLE);
  assert.equal(inv(game).count(CRAFTING_TABLE), 0);
});

test('站在合成台旁邊（3 格內）→ 2 石頭 + 2 沙子合成 4 個磚塊', () => {
  const { game } = withTable(2);
  assert.equal(game.nearTable(), true);
  inv(game).slot(STONE).count = 2;
  inv(game).slot(SAND).count = 2;
  pressE(game);
  assert.equal(game.recipeList().find((r) => r.id === 'brick').canCraft, true);
  assert.equal(game.craft('brick'), true);
  assert.equal(inv(game).count(BRICK), 4);
  assert.equal(inv(game).count(STONE), 0);
  assert.equal(inv(game).count(SAND), 0);
});

test('不可以：離合成台超過 3 格，還能做「要合成台」的配方', () => {
  const { game } = withTable(5);
  assert.equal(game.nearTable(), false);
  inv(game).slot(STONE).count = 2;
  inv(game).slot(SAND).count = 2;
  pressE(game);
  assert.equal(game.recipeList().find((r) => r.id === 'brick').canCraft, false);
  assert.equal(game.craft('brick'), false);
  assert.equal(inv(game).count(BRICK), 0);
  assert.equal(inv(game).count(STONE), 2);
  assert.equal(inv(game).count(SAND), 2);
});

test('不可以：材料不夠還合成得出來', () => {
  const game = new Game();
  inv(game).slot(PLANKS).count = 3;
  pressE(game);
  assert.equal(game.recipeList().find((r) => r.id === 'table').canCraft, false);
  assert.equal(game.craft('table'), false);
  assert.equal(game.craft('planks'), false); // 沒有原木
  assert.equal(inv(game).count(PLANKS), 3);
  assert.equal(inv(game).count(CRAFTING_TABLE), 0);
});

test('不可以：做出來那格會超過 64 個還合成得出來', () => {
  const game = new Game();
  inv(game).slot(LOG).count = 1;
  inv(game).slot(PLANKS).count = 62; // 再 +4 就 66
  pressE(game);
  assert.equal(game.craft('planks'), false);
  assert.equal(inv(game).count(LOG), 1);
  assert.equal(inv(game).count(PLANKS), 62);
});

test('合成畫面沒開時不能合成', () => {
  const game = new Game();
  inv(game).slot(LOG).count = 1;
  assert.equal(game.craft('planks'), false);
  assert.equal(inv(game).count(LOG), 1);
});

test('對著合成台按右鍵 → 打開合成畫面，不會在它上面放方塊', () => {
  const { game, y } = withTable(2);
  inv(game).slot(PLANKS).count = 5;
  game.update(1 / 60, input({ select: { index: HOTBAR.indexOf(PLANKS) } }));
  aimAt(game, 13, y, 14);
  assert.equal(game.target().id, CRAFTING_TABLE);
  game.update(1 / 60, input({ place: true }));
  assert.equal(game.craftingOpen, true);
  assert.equal(inv(game).count(PLANKS), 5);
  assert.equal(game.world.get(13, y + 1, 14), AIR);
});

test('挖合成台 → 掉出合成台，撿得回來', () => {
  const { game, y } = withTable(4);
  aimAt(game, 13, y, 12);
  mineUntilGone(game, { x: 13, y, z: 12 });
  assert.equal(game.drops[0].id, CRAFTING_TABLE);
  run(game, 1.5);
  standAt(game, 13.5, 13.7, 0);
  run(game, 1.5);
  assert.equal(inv(game).count(CRAFTING_TABLE), 1);
});

test('再按 E → 關掉合成畫面；開著時人物不會走動、不會挖', () => {
  const game = new Game();
  standAt(game, 13.5, 16.5, 0, -1.5);
  pressE(game);
  const z0 = game.player.pos.z;
  run(game, 1, () => input({ forward: true, mine: true }));
  assert.ok(Math.abs(game.player.pos.z - z0) < 1e-6, '開著合成畫面不會走');
  assert.equal(game.crack(), null, '開著合成畫面不會挖');
  pressE(game);
  assert.equal(game.craftingOpen, false);
  run(game, 0.3, () => input({ forward: true }));
  assert.ok(game.player.pos.z < z0 - 0.5, '關掉後又能走');
});
