// 多人連線的客戶端：把自己的動作送給伺服器，把別人的動作套用到自己的 Game
// 連不上（沒有伺服器、人數已滿）就照樣一個人玩
import { decodeWorld } from './codec.js';
import { stepAnimation } from './character.js';

const SEND_RATE = 1 / 15; // 一秒送 15 次位置
const SMOOTH = 12; // 別人的小人往最新位置靠過去的速度

function remotePlayer(p) {
  return {
    id: p.id, name: p.name,
    pos: { x: p.x, y: p.y, z: p.z },
    target: { x: p.x, y: p.y, z: p.z },
    vel: { x: 0, y: 0, z: 0 },
    yaw: p.yaw, targetYaw: p.yaw, pitch: p.pitch,
    onGround: true, walkTime: 0, walkBlend: 0,
  };
}

// 角度差取最短的那一邊（-π ～ π）
function angleDiff(a, b) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

export class NetClient {
  constructor(game, { url, name, WebSocketImpl = globalThis.WebSocket }) {
    this.game = game;
    this.name = name;
    this.status = 'connecting'; // connecting | online | offline | full
    this.id = null;
    this.sendTimer = 0;
    this.lastSent = '';
    game.others = new Map();
    try {
      this.ws = new WebSocketImpl(url);
    } catch {
      this.goOffline();
      return;
    }
    this.opened = false;
    this.ws.addEventListener('open', () => {
      this.opened = true;
      this.send({ t: 'hello', name });
    });
    this.ws.addEventListener('message', (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      this.receive(msg);
    });
    this.ws.addEventListener('close', () => this.goOffline());
    this.ws.addEventListener('error', () => this.goOffline());
  }

  goOffline() {
    this.opened = false;
    if (this.status !== 'full') this.status = 'offline';
    this.game.events = null; // 一個人玩：不用記事件
    this.game.others.clear();
  }

  send(msg) {
    if (this.opened) this.ws.send(JSON.stringify(msg));
  }

  close() {
    this.ws?.close();
    this.goOffline();
  }

  statusText() {
    if (this.status === 'online') return `多人：${this.game.others.size + 1} 人在線上`;
    if (this.status === 'full') return '人數已滿（單人）';
    if (this.status === 'connecting') return '連線中…';
    return '單人';
  }

  receive(msg) {
    const game = this.game;
    switch (msg.t) {
      case 'welcome': {
        const blocks = decodeWorld(msg.world);
        if (blocks.length !== game.world.blocks.length) return;
        game.world.blocks.set(blocks);
        game.world.version++;
        game.rain.active = !!msg.rain;
        game.others.clear();
        for (const p of msg.players) game.others.set(p.id, remotePlayer(p));
        this.id = msg.id;
        this.name = msg.name;
        this.status = 'online';
        game.events = [];
        break;
      }
      case 'full':
        this.status = 'full';
        this.ws.close();
        break;
      case 'join':
        game.others.set(msg.player.id, remotePlayer(msg.player));
        break;
      case 'leave':
        game.others.delete(msg.id);
        break;
      case 'move': {
        const o = game.others.get(msg.id);
        if (!o) return;
        o.target = { x: msg.x, y: msg.y, z: msg.z };
        o.targetYaw = msg.yaw;
        o.pitch = msg.pitch;
        break;
      }
      case 'set':
        game.world.set(msg.x, msg.y, msg.z, msg.b); // 別人的改變：不再送回去
        break;
      case 'rain':
        game.rain.active = !!msg.on;
        break;
    }
  }

  update(dt) {
    const game = this.game;
    if (this.status !== 'online') {
      if (game.events) game.events.length = 0;
      return;
    }
    // 自己挖、放、下雨 → 送出去
    for (const e of game.events) this.send(e);
    game.events.length = 0;

    // 自己的位置：有變才送，一秒最多 15 次
    this.sendTimer += dt;
    if (this.sendTimer >= SEND_RATE) {
      this.sendTimer = 0;
      const p = game.player;
      const move = { t: 'move', x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, pitch: p.pitch };
      const key = JSON.stringify(move);
      if (key !== this.lastSent) {
        this.lastSent = key;
        this.send(move);
      }
    }

    // 別人的小人：慢慢靠到最新位置，用移動的速度擺手腳
    const k = 1 - Math.exp(-SMOOTH * dt);
    for (const o of game.others.values()) {
      const nx = o.pos.x + (o.target.x - o.pos.x) * k;
      const ny = o.pos.y + (o.target.y - o.pos.y) * k;
      const nz = o.pos.z + (o.target.z - o.pos.z) * k;
      o.vel = { x: (nx - o.pos.x) / dt, y: (ny - o.pos.y) / dt, z: (nz - o.pos.z) / dt };
      o.pos = { x: nx, y: ny, z: nz };
      o.yaw += angleDiff(o.yaw, o.targetYaw) * k;
      stepAnimation(o, dt);
    }
  }
}
