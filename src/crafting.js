// 合成：幾個簡單的配方。needsTable 的配方要站在合成台旁邊（3 格內）才能做
import { LOG, PLANKS, STONE, SAND, BRICK, DIRT, LEAVES, GRASS, CRAFTING_TABLE } from './blocks.js';
import { STACK_MAX } from './inventory.js';

export const TABLE_RANGE = 3;

export const RECIPES = [
  { id: 'planks', name: '木板', inputs: [[LOG, 1]], output: { id: PLANKS, count: 4 }, needsTable: false },
  { id: 'table', name: '合成台', inputs: [[PLANKS, 4]], output: { id: CRAFTING_TABLE, count: 1 }, needsTable: false },
  { id: 'brick', name: '磚塊', inputs: [[STONE, 2], [SAND, 2]], output: { id: BRICK, count: 4 }, needsTable: true },
  { id: 'grass', name: '草地', inputs: [[DIRT, 1], [LEAVES, 1]], output: { id: GRASS, count: 1 }, needsTable: true },
];

export function findRecipe(id) {
  return RECIPES.find((r) => r.id === id) ?? null;
}

// 玩家腳下那格往外 3 格以內，有沒有合成台
export function nearCraftingTable(world, pos, range = TABLE_RANGE) {
  const cx = Math.floor(pos.x), cy = Math.floor(pos.y), cz = Math.floor(pos.z);
  for (let x = cx - range; x <= cx + range; x++)
    for (let y = cy - range; y <= cy + range; y++)
      for (let z = cz - range; z <= cz + range; z++)
        if (world.get(x, y, z) === CRAFTING_TABLE) return true;
  return false;
}

// 能不能做：回傳 null 表示可以，不然回傳原因
export function whyNot(recipe, inventory, nearTable) {
  if (recipe.needsTable && !nearTable) return '要站在合成台旁邊';
  for (const [id, n] of recipe.inputs) if (inventory.count(id) < n) return '材料不夠';
  const out = inventory.slot(recipe.output.id);
  if (!out || out.count + recipe.output.count > STACK_MAX) return '那一格放不下了';
  return null;
}

export function craft(recipe, inventory, nearTable) {
  if (whyNot(recipe, inventory, nearTable)) return false;
  for (const [id, n] of recipe.inputs) inventory.slot(id).count -= n;
  inventory.slot(recipe.output.id).count += recipe.output.count;
  return true;
}
