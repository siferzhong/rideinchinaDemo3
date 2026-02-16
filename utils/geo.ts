/**
 * 骑行导航几何工具：点到路径垂距、插值平滑
 * 用于偏航检测与地图动画
 */

export type LngLatLike = [number, number] | { lng: number; lat: number };

export function toTuple(p: LngLatLike): [number, number] {
  return Array.isArray(p) ? p : [p.lng, p.lat];
}

/** 两点平面距离（米），近似 Haversine */
export function distanceMeters(a: LngLatLike, b: LngLatLike): number {
  const [lng1, lat1] = toTuple(a);
  const [lng2, lat2] = toTuple(b);
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * 点到线段的垂足及垂距（米）
 * 返回 { distance, projected } 垂距与投影点；若投影在线段外则 clamp 到端点
 */
export function pointToSegmentDistance(
  point: LngLatLike,
  segStart: LngLatLike,
  segEnd: LngLatLike
): { distance: number; projected: [number, number]; t: number } {
  const [px, py] = toTuple(point);
  const [x1, y1] = toTuple(segStart);
  const [x2, y2] = toTuple(segEnd);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projLng = x1 + t * dx;
  const projLat = y1 + t * dy;
  const projected: [number, number] = [projLng, projLat];
  const distance = distanceMeters(point, projected);
  return { distance, projected, t };
}

/**
 * 点到整条路径的最短垂距（米）
 * path: 路径点数组，支持 [lng,lat] 或 {lng, lat}
 */
export function pointToPathDistance(
  point: LngLatLike,
  path: LngLatLike[]
): { distance: number; segmentIndex: number; projected: [number, number] } {
  if (!path || path.length < 2) {
    const d = path?.length === 1 ? distanceMeters(point, path[0]) : Infinity;
    return {
      distance: d,
      segmentIndex: 0,
      projected: path?.length === 1 ? toTuple(path[0]) : [0, 0],
    };
  }
  let minDist = Infinity;
  let bestIndex = 0;
  let bestProj: [number, number] = toTuple(path[0]);
  for (let i = 0; i < path.length - 1; i++) {
    const { distance, projected } = pointToSegmentDistance(
      point,
      path[i],
      path[i + 1]
    );
    if (distance < minDist) {
      minDist = distance;
      bestIndex = i;
      bestProj = projected;
    }
  }
  return { distance: minDist, segmentIndex: bestIndex, projected: bestProj };
}

/** 线性插值 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/** 经纬度插值（用于平滑移动） */
export function lerpLngLat(
  a: LngLatLike,
  b: LngLatLike,
  t: number
): [number, number] {
  const [lng1, lat1] = toTuple(a);
  const [lng2, lat2] = toTuple(b);
  return [lerp(lng1, lng2, t), lerp(lat1, lat2, t)];
}

/** 角度插值（考虑 360° 环绕） */
export function lerpAngle(fromDeg: number, toDeg: number, t: number): number {
  let d = toDeg - fromDeg;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return fromDeg + d * Math.max(0, Math.min(1, t));
}
