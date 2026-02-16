/**
 * 管理员服务
 * 查看用户证件、上传证件、管理用户角色
 */

import { getCurrentUser } from './auth';
import { getUserRole } from './permissions';

const WP_BASE_URL = 'https://www.rideinchina.com/wp-json/wp/v2';

export interface UserDocumentView {
  userId: number;
  userName: string;
  userEmail: string;
  documents: Array<{
    id: string;
    type: 'Passport' | 'Visa' | 'License' | 'ID';
    fileName: string;
    uploadDate: string;
    fileUrl?: string;
    status: 'Pending' | 'Verified' | 'Rejected';
  }>;
  permits: Array<{
    id: string;
    permitNumber: string;
    issueDate: string;
    expiryDate: string;
    status: 'Active' | 'Expired' | 'Pending';
    fileUrl?: string;
  }>;
}

export interface UserInfo {
  id: number;
  username: string;
  email: string;
  name: string;
  role: 'admin' | 'leader' | 'user';
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
 * 检查是否为管理员
 */
const checkAdmin = async (): Promise<void> => {
  const role = await getUserRole();
  if (role !== 'admin') {
    throw new Error('Admin access required');
  }
};

/**
 * 获取所有用户的证件列表（仅管理员）
 */
export const getAllUserDocuments = async (): Promise<UserDocumentView[]> => {
  await checkAdmin();

  const response = await fetch(`${WP_BASE_URL}/rideinchina/admin/users/documents`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user documents');
  }

  const data = await response.json();
  return data.users || [];
};

/**
 * 上传证件电子版（进藏函等）（仅管理员）
 */
export const uploadPermitForUser = async (
  userId: number,
  permitNumber: string,
  issueDate: string,
  expiryDate: string,
  fileUrl: string,
  route?: string
): Promise<void> => {
  await checkAdmin();

  const response = await fetch(`${WP_BASE_URL}/rideinchina/admin/users/${userId}/permit`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      permitNumber,
      issueDate,
      expiryDate,
      fileUrl,
      route,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to upload permit' }));
    throw new Error(error.message || 'Failed to upload permit');
  }
};

/**
 * 更新证件状态（仅管理员）
 */
export const updateDocumentStatus = async (
  userId: number,
  documentId: string,
  status: 'Pending' | 'Verified' | 'Rejected'
): Promise<void> => {
  await checkAdmin();

  const response = await fetch(`${WP_BASE_URL}/rideinchina/admin/users/${userId}/documents/${documentId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      status,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to update document status');
  }
};

/**
 * 获取所有用户列表（仅管理员）
 */
export const getAllUsers = async (): Promise<UserInfo[]> => {
  await checkAdmin();

  const response = await fetch(`${WP_BASE_URL}/rideinchina/admin/users`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }

  const data = await response.json();
  return data.users || [];
};

/**
 * 设置用户角色（仅管理员）
 */
export const setUserRole = async (userId: number, role: 'admin' | 'leader' | 'user'): Promise<void> => {
  await checkAdmin();

  const response = await fetch(`${WP_BASE_URL}/rideinchina/admin/users/${userId}/role`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      role,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to set user role' }));
    throw new Error(error.message || 'Failed to set user role');
  }
};
