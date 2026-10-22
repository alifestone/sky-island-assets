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

// breakTime：按住左鍵幾秒會挖掉
export const BLOCKS = {
  [GRASS]: { name: 'grass', tiles: { top: 0, side: 1, bottom: 2 }, breakTime: 0.75 },
  [DIRT]: { name: 'dirt', tiles: { top: 2, side: 2, bottom: 2 }, breakTime: 0.7 },
  [STONE]: { name: 'stone', tiles: { top: 3, side: 3, bottom: 3 }, breakTime: 2.0 },
  [LOG]: { name: 'log', tiles: { top: 5, side: 4, bottom: 5 }, breakTime: 1.5 },
  [LEAVES]: { name: 'leaves', tiles: { top: 6, side: 6, bottom: 6 }, breakTime: 0.35 },
  [PLANKS]: { name: 'planks', tiles: { top: 7, side: 7, bottom: 7 }, breakTime: 1.2 },
  [SAND]: { name: 'sand', tiles: { top: 8, side: 8, bottom: 8 }, breakTime: 0.6 },
  [BRICK]: { name: 'brick', tiles: { top: 9, side: 9, bottom: 9 }, breakTime: 1.8 },
};

// 方塊欄的順序
export const HOTBAR = [GRASS, DIRT, STONE, SAND, LOG, LEAVES, PLANKS, BRICK];

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
