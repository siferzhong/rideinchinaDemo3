/**
 * WordPress JWT Authentication 服务
 */

const WP_BASE_URL = 'https://www.rideinchina.com/wp-json/wp/v2';
const JWT_AUTH_URL = 'https://www.rideinchina.com/wp-json/jwt-auth/v1';

export interface WPUser {
  id: number;
  username: string;
  email: string;
  name: string;
  /** WordPress 用户角色（`/users/me` 可能返回） */
  roles?: string[];
  avatar_urls?: {
    24?: string;
    48?: string;
    96?: string;
  };
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  name?: string;
}

/**
 * 使用用户名密码登录（JWT）
 */
export const login = async (credentials: LoginCredentials): Promise<{ user: WPUser; token: string }> => {
  const response = await fetch(`${JWT_AUTH_URL}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: credentials.username,
      password: credentials.password,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Login failed' }));
    throw new Error(error.message || error.data?.status === 403 ? 'Invalid username or password' : 'Login failed');
  }

  const data = await response.json();
  const { token, user } = data;

  localStorage.setItem('wp_jwt_token', token);
  localStorage.setItem('wp_user', JSON.stringify(user));

  return { user, token };
};

/**
 * 注册新用户
 */
export const register = async (data: RegisterData): Promise<WPUser> => {
  // 先注册 WordPress 用户
  const registerResponse = await fetch(`${WP_BASE_URL}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: data.username,
      email: data.email,
      password: data.password,
      name: data.name || data.username,
    }),
  });

  if (!registerResponse.ok) {
    const error = await registerResponse.json().catch(() => ({ message: 'Registration failed' }));
    throw new Error(error.message || 'Registration failed. Please try again.');
  }

  const user = await registerResponse.json();

  // 注册后自动登录
  try {
    const loginResult = await login({
      username: data.username,
      password: data.password,
    });
    return loginResult.user;
  } catch (error) {
    // 如果自动登录失败，返回用户信息让用户手动登录
    return user;
  }
};

/**
 * 获取当前用户（使用 JWT Token）
 */
export const getCurrentUser = async (): Promise<WPUser | null> => {
  const token = localStorage.getItem('wp_jwt_token');
  if (!token) return null;

  try {
    // 验证 token
    const validateResponse = await fetch(`${JWT_AUTH_URL}/token/validate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!validateResponse.ok) {
      localStorage.removeItem('wp_jwt_token');
      localStorage.removeItem('wp_user');
      return null;
    }

    // 获取用户信息（优先 context=edit 以拿到 roles 等字段；失败则回退）
    const headers = { 'Authorization': `Bearer ${token}` };
    const userResponse = await fetch(`${WP_BASE_URL}/users/me?context=edit`, { headers });
    if (userResponse.ok) {
      const user = await userResponse.json();
      localStorage.setItem('wp_user', JSON.stringify(user));
      return user;
    }

    const fallbackUserResponse = await fetch(`${WP_BASE_URL}/users/me`, { headers });
    if (fallbackUserResponse.ok) {
      const user = await fallbackUserResponse.json();
      localStorage.setItem('wp_user', JSON.stringify(user));
      return user;
    }

    return null;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
};

/**
 * 登出
 */
export const logout = (): void => {
  localStorage.removeItem('wp_jwt_token');
  localStorage.removeItem('wp_user');
  localStorage.removeItem('user_role');
};

/**
 * 检查是否已登录
 */
export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('wp_jwt_token');
};

/**
 * 获取本地缓存的用户信息
 */
export const getCachedUser = (): WPUser | null => {
  const userStr = localStorage.getItem('wp_user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};