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

// 高德原生导航风格的缓动函数（更流畅）
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

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
   * 计算车头超前位置（高德原生导航风格：根据速度和方向动态调整）
   */
  const calculateAheadPosition = (center: LngLat, rotation: number, speed: number): LngLat => {
    // 高德原生导航的超前距离算法：
    // - 静止/低速（<10km/h）：超前5-8米
    // - 中速（10-40km/h）：超前10-20米
    // - 高速（>40km/h）：超前25-40米
    let aheadMeters: number;
    if (speed < 10) {
      aheadMeters = 5 + (speed / 10) * 3; // 5-8米
    } else if (speed < 40) {
      aheadMeters = 8 + ((speed - 10) / 30) * 12; // 8-20米
    } else {
      aheadMeters = 20 + Math.min(20, (speed - 40) / 2); // 20-40米
    }
    
    // 米转经纬度（更精确的转换）
    const lat = center[1];
    const lng = center[0];
    const metersPerDegreeLat = 111320; // 纬度方向：1度 ≈ 111.32km
    const metersPerDegreeLng = 111320 * Math.cos((lat * Math.PI) / 180); // 经度方向随纬度变化
    
    // 将角度转为弧度
    const rad = (rotation * Math.PI) / 180;
    
    // 计算超前位置（车头方向）
    const aheadLat = center[1] + (aheadMeters / metersPerDegreeLat) * Math.cos(rad);
    const aheadLng = center[0] + (aheadMeters / metersPerDegreeLng) * Math.sin(rad);
    
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
    // 使用缓动函数实现更流畅的插值（高德原生风格）
    const centerDelta = [
      targetCenter[0] - currentCenter[0],
      targetCenter[1] - currentCenter[1],
    ];
    const rotationDelta = targetRotation - currentRotation;
    
    // 使用指数缓动，低速时更平滑，高速时响应更快
    const speedFactor = Math.min(1, lastSpeed / 30); // 速度影响因子
    const adaptiveFactorCenter = factorCenter * (1 + speedFactor * 0.3); // 高速时响应更快
    const adaptiveFactorRotation = factorRotation * (1 + speedFactor * 0.2);
    
    const nextCenter: LngLat = [
      currentCenter[0] + centerDelta[0] * adaptiveFactorCenter,
      currentCenter[1] + centerDelta[1] * adaptiveFactorCenter,
    ];
    
    // 角度插值考虑360度环绕
    let rotationStep = rotationDelta * adaptiveFactorRotation;
    if (Math.abs(rotationDelta) > 180) {
      rotationStep = rotationDelta > 0 
        ? (rotationDelta - 360) * adaptiveFactorRotation
        : (rotationDelta + 360) * adaptiveFactorRotation;
    }
    const nextRotation = currentRotation + rotationStep;
    
    // 计算车头超前位置（高德原生风格：根据速度动态调整）
    const aheadCenter = calculateAheadPosition(nextCenter, nextRotation, lastSpeed);
    
    currentCenter = nextCenter;
    currentRotation = nextRotation;
    
    // 使用超前位置作为地图中心，实现车头超前效果
    // 高德原生导航会平滑过渡，避免突然跳动
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
