/**
 * 权限管理服务
 * 检查用户角色和权限
 */

import { getCurrentUser } from './auth';

const WP_BASE_URL = 'https://www.rideinchina.com/wp-json/wp/v2';

export type UserRole = 'admin' | 'leader' | 'user';

export interface UserPermissions {
  role: UserRole;
  canSetGroupDestination: boolean;
  canViewDocuments: boolean;
  canUploadPermits: boolean;
  canSendGroupMessages: boolean;
  canAssignLeaders: boolean;
}

/**
 * 获取用户角色
 */
export const getUserRole = async (): Promise<UserRole> => {
  const user = await getCurrentUser();
  if (!user) return 'user';

  try {
    const token = localStorage.getItem('wp_jwt_token');
    if (!token) return 'user';

    const response = await fetch(`${WP_BASE_URL}/rideinchina/user-role`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.role || 'user';
    }
  } catch (error) {
    console.error('Failed to get user role:', error);
  }

  // 默认检查 WordPress 用户角色
  // 管理员通常是 WordPress administrator
  // 这里可以从 WordPress 用户元数据获取自定义角色
  const cachedRole = localStorage.getItem('user_role');
  if (cachedRole) {
    return cachedRole as UserRole;
  }

  return 'user';
};

/**
 * 获取用户权限
 */
export const getUserPermissions = async (): Promise<UserPermissions> => {
  const role = await getUserRole();

  return {
    role,
    canSetGroupDestination: role === 'admin' || role === 'leader',
    canViewDocuments: role === 'admin',
    canUploadPermits: role === 'admin',
    canSendGroupMessages: role === 'admin' || role === 'leader',
    canAssignLeaders: role === 'admin',
  };
};

/**
 * 检查是否有特定权限
 */
export const hasPermission = async (permission: keyof Omit<UserPermissions, 'role'>): Promise<boolean> => {
  const permissions = await getUserPermissions();
  return permissions[permission];
};
