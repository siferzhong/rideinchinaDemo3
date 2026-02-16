/**
 * 屏幕常亮 Wake Lock API
 * 骑行导航时防止手机自动熄屏
 */

let wakeLock: WakeLockSentinel | null = null;

export async function requestWakeLock(): Promise<boolean> {
  if (!('wakeLock' in navigator)) return false;
  try {
    wakeLock = await (navigator as any).wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
    });
    return true;
  } catch {
    return false;
  }
}

export function releaseWakeLock(): void {
  if (wakeLock) {
    try {
      wakeLock.release();
    } catch {}
    wakeLock = null;
  }
}

export function isWakeLockSupported(): boolean {
  return 'wakeLock' in navigator;
}
