// 掉落物：挖掉的方塊彈出一個同種類的小方塊，受重力掉下、停在方塊上、慢慢轉
export const DROP_SIZE = 0.25;
export const SPIN_SPEED = 1.6; // 每秒轉幾弧度
const GRAVITY = 20;
const HALF = DROP_SIZE / 2;

export function spawnDrop(drops, id, block) {
  // 往上彈一下，水平方向依位置給一點點偏移（同一格永遠一樣，方便測試）
  const a = ((block.x * 7 + block.z * 13 + block.y * 3) % 8) / 8 * Math.PI * 2;
  const drop = {
    id,
    pos: { x: block.x + 0.5, y: block.y + 0.5, z: block.z + 0.5 },
    vel: { x: Math.cos(a) * 0.5, y: 4, z: Math.sin(a) * 0.5 },
    spin: 0,
    age: 0,
    onGround: false,
  };
  drops.push(drop);
  return drop;
}

// 小方塊有沒有碰到實心方塊。上下只看中心那一柱：中心底下空了就會掉，不會掛在旁邊那格的邊上
function hits(world, x, y, z, axis) {
  const spread = axis === 'y' ? [0] : [-HALF, HALF];
  for (const dx of spread)
    for (const dz of spread)
      for (const dy of [-HALF, HALF])
        if (world.isSolid(Math.floor(x + dx), Math.floor(y + dy), Math.floor(z + dz))) return true;
  return false;
}

export function stepDrop(drop, world, dt) {
  drop.age += dt;
  drop.spin += SPIN_SPEED * dt;
  const p = drop.pos, v = drop.vel;
  v.y = Math.max(v.y - GRAVITY * dt, -30);

  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(v.y), Math.abs(v.x), Math.abs(v.z)) * dt / 0.1));
  const h = dt / steps;
  drop.onGround = false;
  for (let i = 0; i < steps; i++) {
    for (const axis of ['x', 'z', 'y']) {
      const old = p[axis];
      p[axis] += v[axis] * h;
      if (!hits(world, p.x, p.y, p.z, axis)) continue;
      p[axis] = old;
      if (axis === 'y' && v.y < 0) {
        // 貼到下面那格的頂端
        p.y = Math.floor(p.y - HALF) + HALF;
        if (hits(world, p.x, p.y, p.z, axis)) p.y = old;
        drop.onGround = true;
      }
      v[axis] = 0;
    }
  }
  if (drop.onGround) {
    // 落地後很快停下來，不會一直滑
    v.x *= Math.max(0, 1 - 8 * dt);
    v.z *= Math.max(0, 1 - 8 * dt);
  }
}
