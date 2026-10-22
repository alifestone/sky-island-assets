// 相機：三種視角（第一人稱、背後、前面）和衝刺時的視角
import { eyePosition, lookDirection } from './physics.js';
import { raycast } from './raycast.js';

export const BASE_FOV = 75;
export const SPRINT_FOV = 85;
export const VIEWS = ['first', 'back', 'front'];
export const THIRD_PERSON_DISTANCE = 4;
const WALL_MARGIN = 0.25; // 碰到牆時，相機停在牆前面這麼遠

// 這一刻相機應該用多寬的視角（畫面會慢慢靠過去）
export function fovFor(player) {
  return player.sprinting ? SPRINT_FOV : BASE_FOV;
}

export function nextView(mode) {
  return VIEWS[(VIEWS.indexOf(mode) + 1) % VIEWS.length];
}

// 相機的位置和方向 { x, y, z, yaw, pitch }；第三人稱中間有方塊就拉近，不會穿牆
export function cameraPose(world, player, mode) {
  const eye = eyePosition(player);
  if (mode === 'first') return { ...eye, yaw: player.yaw, pitch: player.pitch };
  const look = lookDirection(player);
  const s = mode === 'back' ? -1 : 1;
  const dir = { x: look.x * s, y: look.y * s, z: look.z * s };
  const hit = raycast(world, eye, dir, THIRD_PERSON_DISTANCE);
  const d = hit ? Math.max(0.3, hit.distance - WALL_MARGIN) : THIRD_PERSON_DISTANCE;
  const pos = { x: eye.x + dir.x * d, y: eye.y + dir.y * d, z: eye.z + dir.z * d };
  return mode === 'back'
    ? { ...pos, yaw: player.yaw, pitch: player.pitch }
    : { ...pos, yaw: player.yaw + Math.PI, pitch: -player.pitch };
}
