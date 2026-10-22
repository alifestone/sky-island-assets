// 放方塊：放在準星看著的那一面外面那格
import { isSolid } from './blocks.js';
import { playerBox } from './physics.js';

export function placePosition(target) {
  const [nx, ny, nz] = target.normal;
  return { x: target.x + nx, y: target.y + ny, z: target.z + nz };
}

function overlapsPlayer(player, pos) {
  const b = playerBox(player);
  return b.maxX > pos.x && b.minX < pos.x + 1
    && b.maxY > pos.y && b.minY < pos.y + 1
    && b.maxZ > pos.z && b.minZ < pos.z + 1;
}

// 世界裡面、那格是空的、而且不會卡到玩家，才可以放
export function canPlace(world, player, pos) {
  if (!world.inBounds(pos.x, pos.y, pos.z)) return false;
  if (isSolid(world.get(pos.x, pos.y, pos.z))) return false;
  return !overlapsPlayer(player, pos);
}
