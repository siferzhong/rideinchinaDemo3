/**
 * 地图视角平滑：setCenter / setRotation 插值动画
 * 减少高速骑行时画面闪烁
 */

import { lerpLngLat, lerpAngle } from './geo';

type LngLat = [number, number];

let rafId: number | null = null;

export function cancelSmoothUpdate(): void {
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

const SMOOTH_CENTER_FACTOR = 0.12;
const SMOOTH_ROTATION_FACTOR = 0.15;

/**
 * 平滑更新地图中心与旋转
 * map: AMap 实例
 * targetCenter: 目标中心
 * targetRotation: 目标旋转（度）
 * onComplete: 可选完成回调
 */
export function smoothMapUpdate(
  map: any,
  targetCenter: LngLat,
  targetRotation: number,
  currentCenter: LngLat,
  currentRotation: number,
  onComplete?: () => void
): void {
  cancelSmoothUpdate();
  const startCenter = currentCenter.slice() as LngLat;
  const startRotation = currentRotation;
  const startTime = performance.now();
  const duration = 200; // ms

  const tick = () => {
    const elapsed = performance.now() - startTime;
    const t = Math.min(1, elapsed / duration);
    const easeT = 1 - Math.pow(1 - t, 2);
    const center = lerpLngLat(startCenter, targetCenter, easeT);
    const rotation = lerpAngle(startRotation, targetRotation, easeT);
    map.setCenter(center);
    map.setRotation(rotation);
    if (t < 1) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = null;
      onComplete?.();
    }
  };
  rafId = requestAnimationFrame(tick);
}

/**
 * 每帧平滑跟随（用于 watchPosition 连续更新）
 * 实现高德原生风格的"车头超前"效果
 */
export function createSmoothFollow(
  factorCenter: number = SMOOTH_CENTER_FACTOR,
  factorRotation: number = SMOOTH_ROTATION_FACTOR
) {
  let currentCenter: LngLat = [0, 0];
  let currentRotation = 0;
  let targetCenter: LngLat = [0, 0];
  let targetRotation = 0;
  let rafId: number | null = null;
  let lastSpeed = 0; // 用于根据速度调整超前距离

  /**
   * 计算车头超前位置（根据速度和方向，地图中心稍微在车头前方）
   */
  const calculateAheadPosition = (center: LngLat, rotation: number, speed: number): LngLat => {
    // 根据速度计算超前距离（米转经纬度近似）
    // 低速时超前5-10米，高速时超前20-30米
    const aheadMeters = Math.min(30, Math.max(5, speed * 0.5));
    const aheadDegrees = aheadMeters / 111000; // 粗略转换
    
    // 将角度转为弧度
    const rad = (rotation * Math.PI) / 180;
    // 计算超前位置（车头方向）
    const aheadLng = center[0] + aheadDegrees * Math.sin(rad);
    const aheadLat = center[1] + aheadDegrees * Math.cos(rad);
    return [aheadLng, aheadLat];
  };

  const setTarget = (center: LngLat, rotation: number, speed: number = 0) => {
    lastSpeed = speed;
    targetCenter = center;
    targetRotation = rotation;
  };

  const setCurrent = (center: LngLat, rotation: number) => {
    currentCenter = center;
    currentRotation = rotation;
    targetCenter = center;
    targetRotation = rotation;
  };

  const tick = (map: any) => {
    // 平滑插值到目标位置和角度
    const nextCenter: LngLat = [
      currentCenter[0] + (targetCenter[0] - currentCenter[0]) * factorCenter,
      currentCenter[1] + (targetCenter[1] - currentCenter[1]) * factorCenter,
    ];
    const nextRotation = currentRotation + (targetRotation - currentRotation) * factorRotation;
    
    // 计算车头超前位置（高德原生风格）
    const aheadCenter = calculateAheadPosition(nextCenter, nextRotation, lastSpeed);
    
    currentCenter = nextCenter;
    currentRotation = nextRotation;
    
    // 使用超前位置作为地图中心，实现车头超前效果
    map.setCenter(aheadCenter);
    map.setRotation(nextRotation);
    
    rafId = requestAnimationFrame(() => tick(map));
  };

  const start = (map: any, initialCenter: LngLat, initialRotation: number) => {
    setCurrent(initialCenter, initialRotation);
    if (!rafId) rafId = requestAnimationFrame(() => tick(map));
  };

  const stop = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  const updateTarget = (center: LngLat, rotation: number, speed: number = 0) => {
    targetCenter = center;
    targetRotation = rotation;
    lastSpeed = speed;
  };

  const getCurrent = (): [LngLat, number] => [currentCenter.slice() as LngLat, currentRotation];

  return { setTarget: updateTarget, setCurrent, start, stop, getCurrent };
}
