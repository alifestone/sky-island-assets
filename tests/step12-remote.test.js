// 步驟 12 別人的小人 → VERIFY STEP 9（multiplayer 分支）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { NetClient, serverUrl } from '../src/net.js';
import { characterPose } from '../src/character.js';

test('用 npm run server 的網址打開 → 連到同一台的 /ws', () => {
  assert.equal(serverUrl({ protocol: 'http:', host: '192.168.1.5:8080' }), 'ws://192.168.1.5:8080/ws');
  assert.equal(serverUrl({ protocol: 'https:', host: 'example.com' }), 'wss://example.com/ws');
});

test('直接打開檔案（file://）→ 不連線，一個人玩', () => {
  assert.equal(serverUrl({ protocol: 'file:', host: '' }), null);
});

test('別人的小人一樣有頭、身體、手腳的動作，頭跟著他上下看', () => {
  const game = new Game();
  const net = new NetClient(game, { url: 'ws://x/ws', name: 'A', WebSocketImpl: class extends EventTarget { send() {} close() {} } });
  net.receive({ t: 'welcome', id: 1, name: 'A', world: '', players: [], rain: false });
  net.status = 'online';
  net.receive({ t: 'join', player: { id: 2, name: 'B', x: 10, y: 17, z: 10, yaw: 1, pitch: 0 } });
  net.receive({ t: 'move', id: 2, x: 12, y: 17, z: 10, yaw: 1, pitch: -0.5 });
  for (let i = 0; i < 20; i++) net.update(1 / 60);
  const pose = characterPose(game.others.get(2));
  for (const part of ['head', 'body', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg']) assert.ok(Number.isFinite(pose[part]), part);
  assert.equal(pose.head, -0.5);
  assert.ok(Math.abs(pose.body - 1) < 1e-6);
});

test('連線中顯示「連線中…」', () => {
  const game = new Game();
  const net = new NetClient(game, { url: 'ws://x/ws', name: 'A', WebSocketImpl: class extends EventTarget { send() {} close() {} } });
  assert.equal(net.statusText(), '連線中…');
});
