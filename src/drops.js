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
    flying: false, // 正在飛向玩家
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

export const PICKUP_RADIUS = 1.5; // 離玩家身體這麼近才會被吸過去
export const PICKUP_DELAY = 0.4; // 剛彈出來的先讓它彈一下，再吸
const FLY_START = 2; // 開始飛的速度（格／秒），越飛越快，看得到它飛過來
const FLY_ACCEL = 14;

// 小方塊到玩家身體（腳底到頭頂那一條線）的距離
function distanceToBody(drop, player, height) {
  const p = player.pos;
  const y = Math.max(p.y, Math.min(p.y + height, drop.pos.y));
  return Math.hypot(drop.pos.x - p.x, drop.pos.y - y, drop.pos.z - p.z);
}

// 靠近就飛向玩家；飛到身上回傳 true（由呼叫的人放進方塊欄）
// canTake：方塊欄還放得下這種方塊嗎？放不下就留在地上
export function stepPickup(drop, player, height, canTake, dt) {
  if (!drop.flying) {
    if (drop.age < PICKUP_DELAY || !canTake) return false;
    if (distanceToBody(drop, player, height) > PICKUP_RADIUS) return false;
    drop.flying = true;
    drop.flySpeed = FLY_START;
  }
  drop.flySpeed += FLY_ACCEL * dt;
  const target = { x: player.pos.x, y: player.pos.y + height * 0.5, z: player.pos.z };
  const dx = target.x - drop.pos.x, dy = target.y - drop.pos.y, dz = target.z - drop.pos.z;
  const d = Math.hypot(dx, dy, dz);
  const move = drop.flySpeed * dt;
  if (d <= Math.max(move, 0.3)) return true;
  drop.pos.x += (dx / d) * move;
  drop.pos.y += (dy / d) * move;
  drop.pos.z += (dz / d) * move;
  drop.spin += SPIN_SPEED * 3 * dt;
  return false;
}

export function stepDrop(drop, world, dt) {
  drop.age += dt;
  drop.spin += SPIN_SPEED * dt;
  if (drop.flying) return;
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
