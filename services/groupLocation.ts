/**
 * 群位置共享服务
 * - 登录用户上报自己的位置
 * - 拉取队伍中其他成员的最新位置
 */

const WP_BASE_URL = 'https://www.rideinchina.com/wp-json/wp/v2';

export type GroupUserRole = 'admin' | 'leader' | 'user';

export interface GroupRiderLocation {
  userId: number;
  userName: string;
  userRole: GroupUserRole;
  position: [number, number]; // [lng, lat]
  speedKmh?: number; // km/h
  altitudeM?: number; // meters
  heading?: number; // degrees
  timestamp: string; // mysql time string
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('wp_jwt_token');
  if (!token) throw new Error('Not authenticated');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

export async function upsertMyLocation(payload: {
  lng: number;
  lat: number;
  speedKmh?: number;
  altitudeM?: number;
  heading?: number;
}): Promise<void> {
  const response = await fetch(`${WP_BASE_URL}/rideinchina/group-locations`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to update location' }));
    throw new Error(error.message || 'Failed to update location');
  }
}

export async function getGroupLocations(): Promise<GroupRiderLocation[]> {
  const response = await fetch(`${WP_BASE_URL}/rideinchina/group-locations`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch group locations' }));
    throw new Error(error.message || 'Failed to fetch group locations');
  }

  const data = await response.json();
  return data.riders || [];
}

