// 固定大小的方塊世界（32×32×32）和小島的產生
import { AIR, GRASS, DIRT, STONE, SAND, LOG, LEAVES, PLANKS, BRICK, isSolid } from './blocks.js';

export const SIZE = 32;

export class World {
  constructor(size = SIZE) {
    this.size = size;
    this.blocks = new Uint8Array(size * size * size);
    this.version = 0; // 每次有方塊改變就 +1，畫面看到變了才重建
    this.spawn = { x: size / 2 + 0.5, y: size / 2, z: size / 2 + 0.5, yaw: 0 };
  }

  inBounds(x, y, z) {
    const s = this.size;
    return x >= 0 && y >= 0 && z >= 0 && x < s && y < s && z < s;
  }

  index(x, y, z) {
    return (y * this.size + z) * this.size + x;
  }

  get(x, y, z) {
    if (!this.inBounds(x, y, z)) return AIR;
    return this.blocks[this.index(x, y, z)];
  }

  isSolid(x, y, z) {
    return isSolid(this.get(x, y, z));
  }

  set(x, y, z, id) {
    if (!this.inBounds(x, y, z)) return false;
    const i = this.index(x, y, z);
    if (this.blocks[i] !== id) {
      this.blocks[i] = id;
      this.version++;
    }
    return true;
  }
}

// 固定的小雜訊，讓島的邊緣不規則；同樣的 (x, z) 永遠得到同樣的值
function hash(x, z) {
  let h = (x * 374761393 + z * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const TOP = 16; // 小島草地的高度

function fillIsland(world, cx, cz, radius, top, depth) {
  for (let x = 0; x < world.size; x++) {
    for (let z = 0; z < world.size; z++) {
      const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
      const r = radius + (hash(x, z) - 0.5) * 1.6;
      if (d > r) continue;
      // 越靠中間越深，下面變成石頭倒錐
      const bottom = Math.round(top - 1 - depth * Math.pow(1 - d / (r + 0.5), 0.8) - hash(z, x) * 1.5);
      for (let y = Math.max(1, bottom); y <= top; y++) {
        let id = STONE;
        if (y === top) id = d > r - 1.6 ? SAND : GRASS;
        else if (y >= top - 2) id = d > r - 1.6 ? SAND : DIRT;
        else if (y >= top - 3 && hash(x + y, z) > 0.4) id = DIRT;
        world.set(x, y, z, id);
      }
    }
  }
}

function tree(world, x, y, z, height = 4) {
  for (let dy = -2; dy <= 1; dy++) {
    const r = dy >= 0 ? 1 : 2;
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) === r && Math.abs(dz) === r && hash(x + dx, z + dz + dy) > 0.5) continue;
        world.set(x + dx, y + height + dy, z + dz, LEAVES);
      }
  }
  world.set(x, y + height + 2, z, LEAVES);
  for (let dy = 0; dy < height + 1; dy++) world.set(x, y + dy, z, LOG);
  world.set(x, y - 1, z, DIRT);
}

// 小屋：磚牆、木板地板、木板屋頂往外多一格當屋簷
export const HOUSE = { x0: 18, x1: 23, z0: 12, z1: 17, wallTop: TOP + 3, roofY: TOP + 4 };

function house(world) {
  const { x0, x1, z0, z1, roofY } = HOUSE;
  for (let x = x0; x <= x1; x++)
    for (let z = z0; z <= z1; z++) {
      world.set(x, TOP, z, PLANKS);
      for (let y = TOP + 1; y < roofY; y++) {
        const wall = x === x0 || x === x1 || z === z0 || z === z1;
        world.set(x, y, z, wall ? BRICK : AIR);
      }
    }
  // 門（朝 -z，兩格高）和窗
  world.set(20, TOP + 1, z0, AIR);
  world.set(20, TOP + 2, z0, AIR);
  world.set(x1, TOP + 2, 14, AIR);
  world.set(x1, TOP + 2, 15, AIR);
  // 屋頂（四邊各多一格是屋簷）
  for (let x = x0 - 1; x <= x1 + 1; x++)
    for (let z = z0 - 1; z <= z1 + 1; z++) world.set(x, roofY, z, PLANKS);
  for (let x = x0; x <= x1; x++)
    for (let z = z0; z <= z1; z++) world.set(x, roofY + 1, z, PLANKS);
}

export function generateIsland(world) {
  fillIsland(world, 16, 16, 11.5, TOP, 9);
  // 中間偏左的小土丘
  for (let x = 8; x <= 11; x++)
    for (let z = 18; z <= 22; z++) {
      if ((x === 8 || x === 11) && (z === 18 || z === 22)) continue;
      world.set(x, TOP, z, DIRT);
      world.set(x, TOP + 1, z, GRASS);
    }
  // 旁邊漂著的小島
  fillIsland(world, 27, 5, 2.2, TOP + 6, 2);
  tree(world, 10, TOP + 2, 20, 4);
  tree(world, 13, TOP + 1, 9, 3);
  house(world);
  world.spawn = { x: 13.5, y: TOP + 1, z: 20.5, yaw: Math.atan2(-7, 6) }; // 面向小屋
  world.version++;
  return world;
}

export { AIR, GRASS, DIRT, STONE, SAND, LOG, LEAVES, PLANKS, BRICK };
