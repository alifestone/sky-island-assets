// 遊戲狀態：把世界、玩家和各種規則組起來。不碰 three.js，測試直接呼叫 update()
import { World, generateIsland } from './world.js';
import { createPlayer, stepPlayer, eyePosition, lookDirection, FALL_LIMIT, PLAYER } from './physics.js';
import { raycast } from './raycast.js';
import { AIR } from './blocks.js';
import { Mining } from './mining.js';
import { spawnDrop, stepDrop, stepPickup } from './drops.js';
import { Inventory } from './inventory.js';

export const REACH = 5; // 挖和放最遠幾格

export class Game {
  constructor() {
    this.world = generateIsland(new World());
    this.player = createPlayer(this.world.spawn);
    this.mining = new Mining();
    this.drops = [];
    this.inventory = new Inventory();
    this.time = 0;
  }

  crack() {
    return this.mining.crack();
  }

  // 準星指著的方塊
  target() {
    return raycast(this.world, eyePosition(this.player), lookDirection(this.player), REACH);
  }

  look(dYaw, dPitch) {
    const p = this.player;
    p.yaw -= dYaw;
    p.pitch = Math.max(-1.55, Math.min(1.55, p.pitch - dPitch));
  }

  update(dt, input) {
    this.time += dt;
    if (input.select?.index !== undefined) this.inventory.select(input.select.index);
    if (input.select?.delta) this.inventory.scroll(input.select.delta);
    stepPlayer(this.player, this.world, input, dt);

    const broken = this.mining.update(dt, input.mine, this.target());
    if (broken) {
      this.world.set(broken.x, broken.y, broken.z, AIR);
      spawnDrop(this.drops, broken.id, broken);
    }

    const inv = this.inventory;
    this.drops = this.drops.filter((d) => {
      stepDrop(d, this.world, dt);
      if (stepPickup(d, this.player, PLAYER.height, inv.canAdd(d.id), dt)) {
        if (inv.add(d.id)) return false;
        d.flying = false; // 飛到一半那格滿了：掉回地上
      }
      return d.pos.y > FALL_LIMIT;
    });
  }
}
