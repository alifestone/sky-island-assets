// 測試共用：假輸入、讓遊戲跑一段時間
export function input(over = {}) {
  return {
    forward: false, back: false, left: false, right: false, jump: false,
    mine: false, place: false, toggleRain: false, select: null,
    ...over,
  };
}

// 用 1/60 秒一格，跑 seconds 秒；每一格呼叫 inputFn(t) 拿輸入
export function run(game, seconds, inputFn = () => input()) {
  const dt = 1 / 60;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) game.update(dt, inputFn(i * dt));
}

// 讓玩家站在 (x, z) 那一格的地面上，面向 yaw，看向 pitch
export function standAt(game, x, z, yaw = 0, pitch = 0) {
  const p = game.player;
  let y = game.world.size - 1;
  while (y > 0 && !game.world.isSolid(Math.floor(x), y - 1, Math.floor(z))) y--;
  p.pos.x = x; p.pos.y = y; p.pos.z = z;
  p.vel.x = p.vel.y = p.vel.z = 0;
  p.yaw = yaw; p.pitch = pitch;
  run(game, 0.2);
}

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
