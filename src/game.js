// 遊戲狀態：把世界、玩家和各種規則組起來。不碰 three.js，測試直接呼叫 update()
import { World, generateIsland } from './world.js';
import { createPlayer, stepPlayer, eyePosition, lookDirection } from './physics.js';
import { raycast } from './raycast.js';
import { AIR } from './blocks.js';
import { Mining } from './mining.js';

export const REACH = 5; // 挖和放最遠幾格

export class Game {
  constructor() {
    this.world = generateIsland(new World());
    this.player = createPlayer(this.world.spawn);
    this.mining = new Mining();
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
    stepPlayer(this.player, this.world, input, dt);

    const broken = this.mining.update(dt, input.mine, this.target());
    if (broken) this.world.set(broken.x, broken.y, broken.z, AIR);
  }
}
