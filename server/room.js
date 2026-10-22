// 房間規則：大家共用一座島。不碰網路（conn 只要有 send(訊息物件)），所以可以直接測
//
// 客戶端 → 伺服器：hello { name }、move { x, y, z, yaw, pitch }、set { x, y, z, b }、rain { on }
// 伺服器 → 客戶端：welcome、full、join、leave、move、set、rain
import { World, generateIsland } from '../src/world.js';
import { AIR, BLOCKS } from '../src/blocks.js';
import { encodeWorld } from '../src/codec.js';

export const MAX_PLAYERS = 8;
export const NAME_MAX = 16;

// 名字：拿掉控制字元和看不見的格式字元（例如把文字倒過來的 U+202E），最多 16 個字
export function cleanName(name, fallback) {
  if (typeof name !== 'string') return fallback;
  const s = name.replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim();
  return Array.from(s).slice(0, NAME_MAX).join('') || fallback;
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isBlock = (b) => Number.isInteger(b) && (b === AIR || b in BLOCKS);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class Room {
  constructor() {
    this.world = generateIsland(new World());
    this.players = new Map(); // conn → { id, name, x, y, z, yaw, pitch }
    this.rain = false;
    this.nextId = 1;
  }

  connect(conn) {
    // 等它送 hello 才算加入
  }

  disconnect(conn) {
    const p = this.players.get(conn);
    if (!p) return;
    this.players.delete(conn);
    this.broadcast({ t: 'leave', id: p.id });
  }

  broadcast(msg, except = null) {
    for (const c of this.players.keys()) if (c !== except) c.send(msg);
  }

  receive(conn, msg) {
    if (!msg || typeof msg !== 'object') return;
    const me = this.players.get(conn);
    if (msg.t === 'hello') return me ? undefined : this.hello(conn, msg);
    if (!me) return; // 還沒 hello 的不理
    if (msg.t === 'move') return this.move(conn, me, msg);
    if (msg.t === 'set') return this.set(conn, msg);
    if (msg.t === 'rain' && typeof msg.on === 'boolean') {
      this.rain = msg.on;
      this.broadcast({ t: 'rain', on: msg.on }, conn);
    }
  }

  hello(conn, msg) {
    if (this.players.size >= MAX_PLAYERS) {
      conn.send({ t: 'full', max: MAX_PLAYERS });
      return;
    }
    const id = this.nextId++;
    const s = this.world.spawn;
    const p = { id, name: cleanName(msg.name, `玩家${id}`), x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: 0 };
    const others = [...this.players.values()].map((o) => ({ ...o }));
    this.players.set(conn, p);
    conn.send({ t: 'welcome', id, name: p.name, world: encodeWorld(this.world.blocks), players: others, rain: this.rain });
    this.broadcast({ t: 'join', player: { ...p } }, conn);
  }

  move(conn, me, msg) {
    const { x, y, z, yaw, pitch } = msg;
    if (![x, y, z, yaw, pitch].every(isNum)) return;
    const s = this.world.size;
    Object.assign(me, { x: clamp(x, -s, 2 * s), y: clamp(y, -20, 2 * s), z: clamp(z, -s, 2 * s), yaw, pitch: clamp(pitch, -1.6, 1.6) });
    this.broadcast({ t: 'move', id: me.id, x: me.x, y: me.y, z: me.z, yaw: me.yaw, pitch: me.pitch }, conn);
  }

  set(conn, msg) {
    const { x, y, z, b } = msg;
    if (![x, y, z].every(Number.isInteger) || !this.world.inBounds(x, y, z)) return;
    if (!isBlock(b)) {
      // 送錯的人：告訴它那格真正是什麼，讓它的畫面改回來
      conn.send({ t: 'set', x, y, z, b: this.world.get(x, y, z) });
      return;
    }
    this.world.set(x, y, z, b);
    this.broadcast({ t: 'set', x, y, z, b }, conn);
  }
}
