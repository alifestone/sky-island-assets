// 方塊種類。tiles 是 assets/atlas.png 的格子編號（4×4，左到右、上到下，從 0 數）
export const AIR = 0;
export const GRASS = 1;
export const DIRT = 2;
export const STONE = 3;
export const LOG = 4;
export const LEAVES = 5;
export const PLANKS = 6;
export const SAND = 7;
export const BRICK = 8;
export const CRAFTING_TABLE = 9;

// breakTime：按住左鍵幾秒會挖掉；icon：assets/icons/ 裡的圖示（合成台沒有自己的圖示，借用木板）
export const BLOCKS = {
  [GRASS]: { name: 'grass', label: '草地', tiles: { top: 0, side: 1, bottom: 2 }, breakTime: 0.75 },
  [DIRT]: { name: 'dirt', label: '泥土', tiles: { top: 2, side: 2, bottom: 2 }, breakTime: 0.7 },
  [STONE]: { name: 'stone', label: '石頭', tiles: { top: 3, side: 3, bottom: 3 }, breakTime: 2.0 },
  [LOG]: { name: 'log', label: '原木', tiles: { top: 5, side: 4, bottom: 5 }, breakTime: 1.5 },
  [LEAVES]: { name: 'leaves', label: '樹葉', tiles: { top: 6, side: 6, bottom: 6 }, breakTime: 0.35 },
  [PLANKS]: { name: 'planks', label: '木板', tiles: { top: 7, side: 7, bottom: 7 }, breakTime: 1.2 },
  [SAND]: { name: 'sand', label: '沙子', tiles: { top: 8, side: 8, bottom: 8 }, breakTime: 0.6 },
  [BRICK]: { name: 'brick', label: '磚塊', tiles: { top: 9, side: 9, bottom: 9 }, breakTime: 1.8 },
  // 素材包沒有合成台的圖：上下用木板、側面用原木的樹皮拼出來
  [CRAFTING_TABLE]: { name: 'crafting_table', label: '合成台', icon: 'planks', tiles: { top: 7, side: 4, bottom: 7 }, breakTime: 1.3 },
};

// 方塊欄的順序
export const HOTBAR = [GRASS, DIRT, STONE, SAND, LOG, LEAVES, PLANKS, BRICK, CRAFTING_TABLE];

export function isSolid(id) {
  return id !== AIR;
}

// face: 'top' | 'bottom' | 'side'
export function faceTile(id, face) {
  return BLOCKS[id].tiles[face];
}

export function breakTime(id) {
  return BLOCKS[id]?.breakTime ?? Infinity;
}

export function iconName(id) {
  return BLOCKS[id].icon ?? BLOCKS[id].name;
}
