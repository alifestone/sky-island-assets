// 玩家：AABB 碰撞、重力、跳、掉出世界回到出生點
// pos 是腳底中心；yaw 0 面向 -z（和 three.js 相機一樣）
export const PLAYER = { halfWidth: 0.3, height: 1.8, eye: 1.62 };
export const WALK_SPEED = 4.3;
export const SPRINT_MULTIPLIER = 1.5; // 按住 Shift 往前跑
export const GRAVITY = 28;
export const JUMP_SPEED = 8.6;
export const FALL_LIMIT = -12; // 掉到這麼低就回出生點
const EPS = 1e-4;

export function createPlayer(spawn) {
  return {
    pos: { x: spawn.x, y: spawn.y, z: spawn.z },
    vel: { x: 0, y: 0, z: 0 },
    yaw: spawn.yaw ?? 0,
    pitch: 0,
    onGround: false,
    sprinting: false,
  };
}

export function eyePosition(player) {
  return { x: player.pos.x, y: player.pos.y + PLAYER.eye, z: player.pos.z };
}

export function lookDirection(player) {
  const cp = Math.cos(player.pitch);
  return {
    x: -Math.sin(player.yaw) * cp,
    y: Math.sin(player.pitch),
    z: -Math.cos(player.yaw) * cp,
  };
}

// 玩家佔的方塊範圍（給「不能放在自己身上」用）
export function playerBox(player) {
  const { halfWidth: w, height: h } = PLAYER;
  const p = player.pos;
  return { minX: p.x - w, maxX: p.x + w, minY: p.y, maxY: p.y + h, minZ: p.z - w, maxZ: p.z + w };
}

function collides(world, box) {
  for (let x = Math.floor(box.minX); x <= Math.floor(box.maxX - EPS); x++)
    for (let y = Math.floor(box.minY); y <= Math.floor(box.maxY - EPS); y++)
      for (let z = Math.floor(box.minZ); z <= Math.floor(box.maxZ - EPS); z++)
        if (world.isSolid(x, y, z)) return true;
  return false;
}

// 沿著一個軸移動；撞到就貼齊方塊邊緣並停下。回傳有沒有撞到
function moveAxis(player, world, axis, amount) {
  if (amount === 0) return false;
  const p = player.pos;
  p[axis] += amount;
  if (!collides(world, playerBox(player))) return false;
  const { halfWidth: w, height: h } = PLAYER;
  if (axis === 'y') {
    p.y = amount > 0 ? Math.floor(p.y + h) - h - EPS : Math.floor(p.y) + 1;
  } else {
    p[axis] = amount > 0 ? Math.floor(p[axis] + w) - w - EPS : Math.floor(p[axis] - w) + 1 + w + EPS;
  }
  player.vel[axis] = 0;
  return true;
}

export function respawn(player, spawn) {
  player.pos.x = spawn.x; player.pos.y = spawn.y; player.pos.z = spawn.z;
  player.vel.x = player.vel.y = player.vel.z = 0;
  player.yaw = spawn.yaw ?? player.yaw;
  player.pitch = 0;
}

// input: { forward, back, left, right, jump, sprint }
export function stepPlayer(player, world, input, dt) {
  const f = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
  const s = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  player.sprinting = !!input.sprint && f > 0; // 只有往前才衝刺
  const speed = WALK_SPEED * (player.sprinting ? SPRINT_MULTIPLIER : 1);
  let mx = -Math.sin(player.yaw) * f + Math.cos(player.yaw) * s;
  let mz = -Math.cos(player.yaw) * f - Math.sin(player.yaw) * s;
  const len = Math.hypot(mx, mz);
  if (len > 0) { mx /= len; mz /= len; }
  player.vel.x = mx * speed;
  player.vel.z = mz * speed;

  if (input.jump && player.onGround) player.vel.y = JUMP_SPEED;
  player.vel.y = Math.max(player.vel.y - GRAVITY * dt, -40);

  // 一次最多走 0.4 格，才不會穿過方塊
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(player.vel.y), speed) * dt / 0.4));
  const h = dt / steps;
  player.onGround = false;
  for (let i = 0; i < steps; i++) {
    moveAxis(player, world, 'x', player.vel.x * h);
    moveAxis(player, world, 'z', player.vel.z * h);
    const vy = player.vel.y;
    if (moveAxis(player, world, 'y', vy * h) && vy < 0) player.onGround = true;
  }
  // 站著不動時也要知道腳下有沒有地
  if (!player.onGround && player.vel.y <= 0) {
    const b = playerBox(player);
    b.minY -= 2 * EPS; b.maxY = b.minY + EPS;
    player.onGround = collides(world, b);
  }

  if (player.pos.y < FALL_LIMIT) respawn(player, world.spawn);
}
