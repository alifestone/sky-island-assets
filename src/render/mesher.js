// 世界 → 頂點陣列。只畫旁邊是空氣的面，整個世界合成一個 mesh（舊電腦也跑得動）
// 這個檔案不碰 three.js，所以可以在 Node 裡測
import { isSolid, faceTile } from '../blocks.js';

const ATLAS_CELLS = 4; // atlas.png 是 4×4 格
const INSET = 0.0005; // 往內縮一點點，避免取到隔壁格的顏色

// 每一面：方向、四個角（逆時針，從外面看）、明暗、用哪種材質
const FACES = [
  { n: [1, 0, 0], kind: 'side', shade: 0.8, c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { n: [-1, 0, 0], kind: 'side', shade: 0.8, c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], kind: 'top', shade: 1.0, c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], kind: 'bottom', shade: 0.55, c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], kind: 'side', shade: 0.7, c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], kind: 'side', shade: 0.7, c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];

// 第 tile 格的 UV 範圍（three.js 的 v 從下往上）
export function tileUV(tile) {
  const col = tile % ATLAS_CELLS;
  const row = Math.floor(tile / ATLAS_CELLS);
  const s = 1 / ATLAS_CELLS;
  return { u0: col * s + INSET, u1: (col + 1) * s - INSET, v0: 1 - (row + 1) * s + INSET, v1: 1 - row * s - INSET };
}

// 一個方塊的六個面（給掉落物的小方塊用）：回傳和 buildMesh 一樣的格式
export function blockMesh(id, size = 1) {
  return build((emit) => {
    for (const face of FACES) emit(face, id, -0.5, -0.5, -0.5, size);
  });
}

export function buildMesh(world) {
  return build((emit) => {
    const s = world.size;
    for (let y = 0; y < s; y++)
      for (let z = 0; z < s; z++)
        for (let x = 0; x < s; x++) {
          const id = world.get(x, y, z);
          if (!isSolid(id)) continue;
          for (const face of FACES) {
            if (world.isSolid(x + face.n[0], y + face.n[1], z + face.n[2])) continue;
            emit(face, id, x, y, z, 1);
          }
        }
  });
}

function build(fill) {
  const positions = [], normals = [], uvs = [], colors = [], indices = [], faceTiles = [];
  let faceCount = 0;
  fill((face, id, x, y, z, size) => {
    const tile = faceTile(id, face.kind);
    const { u0, u1, v0, v1 } = tileUV(tile);
    const base = faceCount * 4;
    const uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    face.c.forEach((corner, i) => {
      // 前兩個角在下面、後兩個在上面，所以側面的 v 跟著 y 走
      positions.push((x + corner[0]) * size, (y + corner[1]) * size, (z + corner[2]) * size);
      normals.push(...face.n);
      uvs.push(...uv[i]);
      colors.push(face.shade, face.shade, face.shade);
    });
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    faceTiles.push(tile);
    faceCount++;
  });
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    colors: new Float32Array(colors),
    indices: faceCount * 4 > 65535 ? new Uint32Array(indices) : new Uint16Array(indices),
    faceTiles,
    faceCount,
  };
}
