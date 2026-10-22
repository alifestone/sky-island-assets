// 下雨：按 R 開始／停止。雨滴從世界頂端往下掉，碰到方塊就在那格上面消失（濺開）
export const RAIN_RADIUS = 14; // 在玩家附近多遠的範圍下雨
export const RAIN_RATE = 360; // 每秒新增幾滴
export const FALL_SPEED = 16;
const SPLASH_TIME = 0.25; // 濺開的水花留多久（秒）

// 那一點上面有沒有方塊擋著（擋得到雨）
export function isSheltered(world, x, y, z) {
  const cx = Math.floor(x), cz = Math.floor(z);
  for (let cy = Math.floor(y); cy < world.size; cy++) if (world.isSolid(cx, cy, cz)) return true;
  return false;
}

export class Rain {
  constructor(seed = 1) {
    this.active = false;
    this.drops = []; // { x, y, z }
    this.splashes = []; // { x, y, z, age }
    this.pending = 0;
    this.seed = seed >>> 0;
  }

  // 固定種子的亂數，測試每次都一樣
  random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  toggle() {
    this.active = !this.active;
  }

  spawnAt(x, y, z) {
    const d = { x, y, z };
    this.drops.push(d);
    return d;
  }

  update(dt, world, center) {
    if (this.active) {
      this.pending += RAIN_RATE * dt;
      while (this.pending >= 1) {
        this.pending--;
        const a = this.random() * Math.PI * 2;
        const r = Math.sqrt(this.random()) * RAIN_RADIUS;
        // 從世界頂端附近開始掉，高度錯開一點才不會整排一起落下
        this.spawnAt(center.x + Math.cos(a) * r, world.size - this.random() * 4, center.z + Math.sin(a) * r);
      }
    }

    for (const s of this.splashes) s.age += dt;
    this.splashes = this.splashes.filter((s) => s.age < SPLASH_TIME);

    this.drops = this.drops.filter((d) => {
      const fromY = d.y;
      d.y -= FALL_SPEED * dt;
      // 這一格走過的每一層都檢查，掉得再快也不會穿過方塊
      const cx = Math.floor(d.x), cz = Math.floor(d.z);
      for (let cy = Math.floor(fromY); cy >= Math.floor(d.y); cy--) {
        if (cy >= world.size) continue;
        if (world.isSolid(cx, cy, cz)) {
          d.y = cy + 1;
          this.splashes.push({ x: d.x, y: cy + 1, z: d.z, age: 0 });
          return false;
        }
      }
      return d.y > 0; // 沒落在島上的，掉出世界底部就拿掉
    });
  }
}
