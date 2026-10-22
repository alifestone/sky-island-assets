// 遊戲狀態：把世界、玩家和各種規則組起來。不碰 three.js，測試直接呼叫 update()
import { World, generateIsland } from './world.js';
import { createPlayer, stepPlayer, eyePosition, lookDirection, FALL_LIMIT, PLAYER } from './physics.js';
import { raycast } from './raycast.js';
import { AIR, CRAFTING_TABLE } from './blocks.js';
import { Mining } from './mining.js';
import { spawnDrop, stepDrop, stepPickup } from './drops.js';
import { Inventory } from './inventory.js';
import { placePosition, canPlace } from './placement.js';
import { Rain, isSheltered } from './rain.js';
import { RECIPES, findRecipe, nearCraftingTable, whyNot, craft } from './crafting.js';

export const REACH = 5; // 挖和放最遠幾格

export class Game {
  constructor() {
    this.world = generateIsland(new World());
    this.player = createPlayer(this.world.spawn);
    this.mining = new Mining();
    this.drops = [];
    this.inventory = new Inventory();
    this.rain = new Rain();
    this.craftingOpen = false;
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

  // 下雨而且頭上沒有東西擋著，就是淋到雨
  wet() {
    const p = this.player.pos;
    return this.rain.active && !isSheltered(this.world, p.x, p.y + PLAYER.height, p.z);
  }

  // 畫面上方的提示文字
  status() {
    return this.wet() ? '淋雨中' : '';
  }

  nearTable() {
    return nearCraftingTable(this.world, this.player.pos);
  }

  // 合成畫面要顯示的配方：要什麼、做出什麼、現在能不能做
  recipeList() {
    const near = this.nearTable();
    return RECIPES.map((r) => {
      const reason = whyNot(r, this.inventory, near);
      return { ...r, canCraft: reason === null, reason };
    });
  }

  // 合成畫面開著才能合成；成功回傳 true
  craft(recipeId) {
    const recipe = findRecipe(recipeId);
    if (!this.craftingOpen || !recipe) return false;
    return craft(recipe, this.inventory, this.nearTable());
  }

  // 右鍵：對著合成台就打開合成畫面；不然把選中那格的方塊放到看著的那一面上；放成功回傳 true
  place() {
    const t = this.target();
    if (!t) return false;
    if (t.id === CRAFTING_TABLE) {
      this.craftingOpen = true;
      return false;
    }
    const pos = placePosition(t);
    if (!canPlace(this.world, this.player, pos)) return false;
    const id = this.inventory.takeSelected();
    if (id === null) return false;
    this.world.set(pos.x, pos.y, pos.z, id);
    return true;
  }

  update(dt, input) {
    this.time += dt;
    if (input.select?.index !== undefined) this.inventory.select(input.select.index);
    if (input.select?.delta) this.inventory.scroll(input.select.delta);
    if (input.toggleCraft) this.craftingOpen = !this.craftingOpen;
    // 合成畫面開著：人物不走、不挖、不放（重力照算）
    const acting = !this.craftingOpen;
    stepPlayer(this.player, this.world, acting ? input : {}, dt);

    if (acting && input.place) this.place();
    if (input.toggleRain) this.rain.toggle();

    const broken = this.mining.update(dt, acting && input.mine, this.target());
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

    this.rain.update(dt, this.world, this.player.pos);
  }
}
