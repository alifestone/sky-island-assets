// 挖方塊：按住左鍵累積時間，到了那種方塊的挖掘時間就挖掉
// 放開、或準星換到別格，就從頭開始
import { breakTime } from './blocks.js';

export const CRACK_STAGES = 10; // destroy_stage_0 ～ destroy_stage_9

export class Mining {
  constructor() {
    this.reset();
  }

  reset() {
    this.block = null; // { x, y, z, id }
    this.progress = 0; // 秒
  }

  // holding：左鍵有沒有按著；target：準星指著的方塊（或 null）
  // 挖掉時回傳那一格 { x, y, z, id }，否則回傳 null
  update(dt, holding, target) {
    if (!holding || !target) {
      this.reset();
      return null;
    }
    const b = this.block;
    if (!b || b.x !== target.x || b.y !== target.y || b.z !== target.z || b.id !== target.id) {
      this.block = { x: target.x, y: target.y, z: target.z, id: target.id };
      this.progress = 0;
      return null; // 這一格才開始挖：裂痕從第 0 張開始
    }
    this.progress += dt;
    if (this.progress >= breakTime(b.id)) {
      this.reset();
      return b;
    }
    return null;
  }

  // 現在的裂痕：{ x, y, z, stage }，沒在挖就是 null
  crack() {
    if (!this.block) return null;
    const ratio = this.progress / breakTime(this.block.id);
    const stage = Math.min(CRACK_STAGES - 1, Math.floor(ratio * CRACK_STAGES));
    return { x: this.block.x, y: this.block.y, z: this.block.z, stage };
  }
}
