/**
 * 群聊服务
 */

import { getCurrentUser } from './auth';
import { getUserRole } from './permissions';

const WP_BASE_URL = 'https://www.rideinchina.com/wp-json/wp/v2';

export interface GroupMessage {
  id: string;
  userId: number;
  userName: string;
  userRole: 'admin' | 'leader' | 'user';
  message: string;
  timestamp: string;
  isHighlighted?: boolean; // 管理员/领队的消息会高亮
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
 * 发送群消息（仅管理员和领队）
 */
export const sendGroupMessage = async (message: string): Promise<GroupMessage> => {
  const role = await getUserRole();
  if (role !== 'admin' && role !== 'leader') {
    throw new Error('Only admins and leaders can send group messages');
  }

  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const response = await fetch(`${WP_BASE_URL}/rideinchina/group-messages`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      message,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to send message' }));
    throw new Error(error.message || 'Failed to send group message');
  }

  const groupMessage = await response.json();
  return groupMessage;
};

/**
 * 获取群消息列表
 */
export const getGroupMessages = async (limit: number = 50): Promise<GroupMessage[]> => {
  try {
    const token = localStorage.getItem('wp_jwt_token');
    const headers: any = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${WP_BASE_URL}/rideinchina/group-messages?limit=${limit}`, {
      headers,
    });

    if (response.ok) {
      const data = await response.json();
      return data.messages || [];
    }
  } catch (error) {
    console.error('Failed to get group messages:', error);
  }

  return [];
};

/**
 * 获取最新消息（用于轮询）
 */
export const getLatestMessages = async (since: string): Promise<GroupMessage[]> => {
  try {
    const token = localStorage.getItem('wp_jwt_token');
    const headers: any = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${WP_BASE_URL}/rideinchina/group-messages?since=${since}`, {
      headers,
    });

    if (response.ok) {
      const data = await response.json();
      return data.messages || [];
    }
  } catch (error) {
    console.error('Failed to get latest messages:', error);
  }

  return [];
};
