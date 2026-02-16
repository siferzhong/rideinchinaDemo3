/**
 * 群目的地管理服务
 */

import { getCurrentUser } from './auth';
import { getUserRole } from './permissions';

const WP_BASE_URL = 'https://www.rideinchina.com/wp-json/wp/v2';

export interface GroupDestination {
  id: string;
  name: string;
  position: [number, number];
  address?: string;
  setBy: {
    id: number;
    name: string;
    role: 'admin' | 'leader';
  };
  createdAt: string;
  isActive: boolean;
}

/**
 * 获取认证头
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem('wp_jwt_token');
  if (!token) {
    throw new Error('Not authenticated');
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

/**
 * 设置群目的地（仅管理员和领队）
 */
export const setGroupDestination = async (
  name: string,
  position: [number, number],
  address?: string
): Promise<GroupDestination> => {
  const role = await getUserRole();
  if (role !== 'admin' && role !== 'leader') {
    throw new Error('Only admins and leaders can set group destinations');
  }

  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const response = await fetch(`${WP_BASE_URL}/rideinchina/group-destination`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      name,
      position,
      address,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to set destination' }));
    throw new Error(error.message || 'Failed to set group destination');
  }

  const destination = await response.json();
  return destination;
};

/**
 * 获取当前群目的地
 */
export const getGroupDestination = async (): Promise<GroupDestination | null> => {
  try {
    const token = localStorage.getItem('wp_jwt_token');
    const headers: any = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${WP_BASE_URL}/rideinchina/group-destination`, {
      headers,
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (error) {
    console.error('Failed to get group destination:', error);
  }

  return null;
};

/**
 * 清除群目的地（仅管理员）
 */
export const clearGroupDestination = async (): Promise<void> => {
  const role = await getUserRole();
  if (role !== 'admin') {
    throw new Error('Only admins can clear group destinations');
  }

  const response = await fetch(`${WP_BASE_URL}/rideinchina/group-destination`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to clear group destination');
  }
};
