// 相機：衝刺時的視角（之後還有第三人稱）
export const BASE_FOV = 75;
export const SPRINT_FOV = 85;

// 這一刻相機應該用多寬的視角（畫面會慢慢靠過去）
export function fovFor(player) {
  return player.sprinting ? SPRINT_FOV : BASE_FOV;
}
