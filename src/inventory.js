// 方塊欄：每種方塊一格，每格最多 64 個
import { HOTBAR } from './blocks.js';

export const STACK_MAX = 64;

export class Inventory {
  constructor(ids = HOTBAR) {
    this.slots = ids.map((id) => ({ id, count: 0 }));
    this.selected = 0;
  }

  slot(id) {
    return this.slots.find((s) => s.id === id) ?? null;
  }

  count(id) {
    return this.slot(id)?.count ?? 0;
  }

  canAdd(id) {
    const s = this.slot(id);
    return !!s && s.count < STACK_MAX;
  }

  add(id) {
    if (!this.canAdd(id)) return false;
    this.slot(id).count++;
    return true;
  }

  selectedSlot() {
    return this.slots[this.selected];
  }

  // 拿掉選中那格的一個；是 0 就拿不出來，回傳 null
  takeSelected() {
    const s = this.selectedSlot();
    if (s.count <= 0) return null;
    s.count--;
    return s.id;
  }

  select(index) {
    if (index >= 0 && index < this.slots.length) this.selected = index;
  }

  scroll(delta) {
    const n = this.slots.length;
    this.selected = (((this.selected + delta) % n) + n) % n;
  }
}
