/**
 * 用户数据同步服务
 * 将 App 数据同步到 WordPress 用户元数据
 */

import { getCurrentUser } from './auth';

const WP_BASE_URL = 'https://www.rideinchina.com/wp-json/wp/v2';

export interface Document {
  id: string;
  type: 'Passport' | 'Visa' | 'License' | 'ID';
  fileName: string;
  uploadDate: string;
  fileUrl?: string;
  status: 'Pending' | 'Verified' | 'Rejected';
}

export interface TibetPermit {
  id: string;
  permitNumber: string;
  issueDate: string;
  expiryDate: string;
  status: 'Active' | 'Expired' | 'Pending';
  fileUrl?: string;
  route?: string;
}

export interface RideHistory {
  date: string;
  distance: number;
  startPosition: [number, number];
  endPosition: [number, number];
  route?: string;
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
 * 保存用户数据到 WordPress
 */
const saveToWordPress = async (metaKey: string, data: any): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) {
    // 未登录，只保存到 localStorage，标记待同步
    localStorage.setItem(`wp_meta_${metaKey}`, JSON.stringify(data));
    localStorage.setItem(`wp_meta_${metaKey}_pending`, 'true');
    return;
  }

  try {
    const response = await fetch(`${WP_BASE_URL}/rideinchina/user-data`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        meta_key: metaKey,
        meta_value: data,
      }),
    });

    if (response.ok) {
      console.log(`Synced ${metaKey} to WordPress`);
      localStorage.removeItem(`wp_meta_${metaKey}_pending`);
    } else {
      throw new Error('Failed to sync');
    }
  } catch (error) {
    console.warn(`Failed to sync ${metaKey} to WordPress, using localStorage`, error);
    localStorage.setItem(`wp_meta_${metaKey}`, JSON.stringify(data));
    localStorage.setItem(`wp_meta_${metaKey}_pending`, 'true');
  }
};

/**
 * 从 WordPress 加载用户数据
 */
const loadFromWordPress = async (metaKey: string): Promise<any | null> => {
  const user = await getCurrentUser();
  if (!user) {
    const localData = localStorage.getItem(`wp_meta_${metaKey}`);
    return localData ? JSON.parse(localData) : null;
  }

  try {
    const headers = getAuthHeaders();
    const response = await fetch(`${WP_BASE_URL}/rideinchina/user-data/${metaKey}`, {
      method: 'GET',
      headers,
    });

    if (response.ok) {
      const data = await response.json();
      // 同时保存到 localStorage 作为缓存
      localStorage.setItem(`wp_meta_${metaKey}`, JSON.stringify(data));
      return data;
    }
  } catch (error) {
    console.warn(`Failed to load ${metaKey} from WordPress`, error);
  }

  // 回退到 localStorage
  const localData = localStorage.getItem(`wp_meta_${metaKey}`);
  return localData ? JSON.parse(localData) : null;
};

export const saveUserDocuments = async (documents: Document[]): Promise<void> => {
  await saveToWordPress('rideinchina_documents', documents);
  localStorage.setItem('user_documents', JSON.stringify(documents));
};

export const getUserDocuments = async (): Promise<Document[]> => {
  const wpData = await loadFromWordPress('rideinchina_documents');
  if (wpData) return wpData;
  
  const localData = localStorage.getItem('user_documents');
  return localData ? JSON.parse(localData) : [];
};

export const saveTibetPermits = async (permits: TibetPermit[]): Promise<void> => {
  await saveToWordPress('rideinchina_tibet_permits', permits);
  localStorage.setItem('tibet_permits', JSON.stringify(permits));
};

export const getTibetPermits = async (): Promise<TibetPermit[]> => {
  const wpData = await loadFromWordPress('rideinchina_tibet_permits');
  if (wpData) return wpData;
  
  const localData = localStorage.getItem('tibet_permits');
  return localData ? JSON.parse(localData) : [];
};

export const saveTotalDistance = async (distance: number): Promise<void> => {
  await saveToWordPress('rideinchina_total_distance', distance);
  localStorage.setItem('total_riding_distance', distance.toString());
};

export const getTotalDistance = async (): Promise<number> => {
  const wpData = await loadFromWordPress('rideinchina_total_distance');
  if (wpData !== null && wpData !== undefined) return parseFloat(wpData);
  
  const localData = localStorage.getItem('total_riding_distance');
  return localData ? parseFloat(localData) : 0;
};

export const saveRideHistory = async (history: RideHistory[]): Promise<void> => {
  await saveToWordPress('rideinchina_ride_history', history);
  localStorage.setItem('ride_history', JSON.stringify(history));
};

export const getRideHistory = async (): Promise<RideHistory[]> => {
  const wpData = await loadFromWordPress('rideinchina_ride_history');
  if (wpData) return wpData;
  
  const localData = localStorage.getItem('ride_history');
  return localData ? JSON.parse(localData) : [];
};

/**
 * 同步所有待同步的数据
 */
export const syncPendingData = async (): Promise<void> => {
  if (!localStorage.getItem('wp_jwt_token')) return;

  const keys = ['rideinchina_documents', 'rideinchina_tibet_permits', 'rideinchina_total_distance', 'rideinchina_ride_history'];
  
  for (const key of keys) {
    const pending = localStorage.getItem(`wp_meta_${key}_pending`);
    if (pending === 'true') {
      const data = localStorage.getItem(`wp_meta_${key}`);
      if (data) {
        try {
          await saveToWordPress(key, JSON.parse(data));
          localStorage.removeItem(`wp_meta_${key}_pending`);
        } catch (error) {
          console.error(`Failed to sync ${key}`, error);
        }
      }
    }
  }
};
