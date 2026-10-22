// 方塊小人的動作：走路時手腳前後擺，頭跟著上下看，身體跟著轉向
const SWING = 0.7; // 最大擺幅（弧度）
const STEP_RATE = 2.2; // 每走一格，擺動相位前進多少

export function stepAnimation(player, dt) {
  const speed = Math.hypot(player.vel.x, player.vel.z);
  const moving = player.onGround && speed > 0.1;
  player.walkTime = (player.walkTime ?? 0) + (moving ? speed * STEP_RATE * dt : 0);
  // 開始走、停下來都慢慢過渡，不會一下子跳
  const blend = player.walkBlend ?? 0;
  player.walkBlend = blend + ((moving ? 1 : 0) - blend) * Math.min(1, dt * 8);
}

// 每個部位轉幾度：頭（上下）、身體（左右），手腳（前後擺）
export function characterPose(player) {
  const a = Math.sin(player.walkTime ?? 0) * SWING * (player.walkBlend ?? 0);
  return { head: player.pitch, body: player.yaw, leftLeg: a, rightLeg: -a, leftArm: -a, rightArm: a };
}
