// 從 origin 往 dir 一格一格找第一個實心方塊（Amanatides & Woo 的 DDA）
// 回傳 { x, y, z, id, normal: [nx, ny, nz], distance }，找不到回傳 null
export function raycast(world, origin, dir, maxDist = 5) {
  const len = Math.hypot(dir.x, dir.y, dir.z);
  if (len === 0) return null;
  const d = [dir.x / len, dir.y / len, dir.z / len];
  const o = [origin.x, origin.y, origin.z];
  const cell = o.map(Math.floor);
  const step = d.map((v) => (v > 0 ? 1 : v < 0 ? -1 : 0));
  const tDelta = d.map((v) => (v === 0 ? Infinity : Math.abs(1 / v)));
  const tMax = d.map((v, i) => {
    if (v === 0) return Infinity;
    const next = v > 0 ? cell[i] + 1 - o[i] : o[i] - cell[i];
    return next * tDelta[i];
  });
  let normal = [0, 0, 0];
  let t = 0;
  while (t <= maxDist) {
    const id = world.get(cell[0], cell[1], cell[2]);
    if (id !== 0) return { x: cell[0], y: cell[1], z: cell[2], id, normal, distance: t };
    const axis = tMax[0] < tMax[1] ? (tMax[0] < tMax[2] ? 0 : 2) : tMax[1] < tMax[2] ? 1 : 2;
    t = tMax[axis];
    cell[axis] += step[axis];
    tMax[axis] += tDelta[axis];
    normal = [0, 0, 0];
    normal[axis] = -step[axis];
  }
  return null;
}
