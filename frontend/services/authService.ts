import { apiClient, ApiResponse, JWT_KEY } from './api';

// Types for authentication
export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'user' | 'viewer';
  createdAt: string;
  lastLoginAt?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  expiresIn: number;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  role?: 'admin' | 'user' | 'viewer';
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// Authentication service
export const authService = {
  // Login user
  async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    const response = await apiClient.post<LoginResponse>('/auth/login', credentials);

    if (response.success && response.data) {
      // Store token in localStorage
      localStorage.setItem(JWT_KEY, response.data.token);

      // Store user data
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }

    return response;
  },

  // Register new user
  async register(data: RegisterRequest): Promise<ApiResponse<LoginResponse>> {
    const response = await apiClient.post<LoginResponse>('/auth/register', data);

    if (response.success && response.data) {
      // Store token in localStorage
      localStorage.setItem(JWT_KEY, response.data.token);

      // Store user data
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }

    return response;
  },

  // Logout user
  async logout(): Promise<void> {
    try {
      // Call backend logout endpoint (optional)
      await apiClient.post('/auth/logout');
    } catch (error) {
      // Continue with local logout even if backend call fails
      console.warn('Backend logout failed:', error);
    }

    // Clear local storage
    localStorage.removeItem(JWT_KEY);
    localStorage.removeItem('user');
  },

  // Get current user
  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!localStorage.getItem(JWT_KEY);
  },

  // Get stored token
  getToken(): string | null {
    return localStorage.getItem(JWT_KEY);
  },

  // Refresh token
  async refreshToken(): Promise<ApiResponse<{ token: string }>> {
    const response = await apiClient.post<{ token: string }>('/auth/refresh');

    if (response.success && response.data) {
      localStorage.setItem(JWT_KEY, response.data.token);
    }

    return response;
  },

  // Change password
  async changePassword(data: ChangePasswordRequest): Promise<ApiResponse<void>> {
    return apiClient.post<void>('/auth/change-password', data);
  },

  // Request password reset
  async requestPasswordReset(email: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>('/auth/forgot-password', { email });
  },

  // Reset password with token
  async resetPassword(token: string, newPassword: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>('/auth/reset-password', { token, newPassword });
  },

  // Update user profile
  async updateProfile(data: {
    name?: string;
    email?: string;
  }): Promise<ApiResponse<User>> {
    const response = await apiClient.put<User>('/auth/profile', data);

    if (response.success && response.data) {
      // Update stored user data
      localStorage.setItem('user', JSON.stringify(response.data));
    }

    return response;
  },

  // Verify email
  async verifyEmail(token: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>('/auth/verify-email', { token });
  },
};

// Authentication context for React
export interface AuthContextType {
  user: User | null;
  login: (credentials: LoginRequest) => Promise<boolean>;
  logout: () => void;
  register: (data: RegisterRequest) => Promise<boolean>;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

// Role-based access control
export const hasRole = (user: User | null, requiredRole: string): boolean => {
  if (!user) return false;

  const roleHierarchy = {
    'viewer': 0,
    'user': 1,
    'admin': 2,
  };

  const userLevel = roleHierarchy[user.role] || 0;
  const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0;

  return userLevel >= requiredLevel;
};

// Permission checks
export const can = {
  // Project permissions
  createProject: (user: User | null) => hasRole(user, 'user'),
  editProject: (user: User | null) => hasRole(user, 'user'),
  deleteProject: (user: User | null) => hasRole(user, 'admin'),
  viewProject: (user: User | null) => hasRole(user, 'viewer'),

  // Script permissions
  createScript: (user: User | null) => hasRole(user, 'user'),
  editScript: (user: User | null) => hasRole(user, 'user'),
  deleteScript: (user: User | null) => hasRole(user, 'user'),
  runScript: (user: User | null) => hasRole(user, 'user'),

  // Execution permissions
  viewExecutions: (user: User | null) => hasRole(user, 'viewer'),
  cancelExecution: (user: User | null) => hasRole(user, 'user'),

  // Node permissions
  viewNodes: (user: User | null) => hasRole(user, 'user'),
  manageNodes: (user: User | null) => hasRole(user, 'admin'),

  // User management permissions
  manageUsers: (user: User | null) => hasRole(user, 'admin'),
  viewUsers: (user: User | null) => hasRole(user, 'admin'),
};

// Helper functions
export const authUtils = {
  // Format role for display
  formatRole(role: string): string {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'user':
        return 'User';
      case 'viewer':
        return 'Viewer';
      default:
        return role;
    }
  },

  // Get role color
  getRoleColor(role: string): string {
    switch (role) {
      case 'admin':
        return '#f50';
      case 'user':
        return '#1890ff';
      case 'viewer':
        return '#52c41a';
      default:
        return '#666666';
    }
  },

  // Validate email format
  validateEmail(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },

  // Validate password strength
  validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return { valid: errors.length === 0, errors };
  },

  // Check if token is expired
  isTokenExpired(): boolean {
    const user = authService.getCurrentUser();
    if (!user) return true;

    // Check if last login was more than 24 hours ago
    if (user.lastLoginAt) {
      const lastLogin = new Date(user.lastLoginAt).getTime();
      const now = new Date().getTime();
      const hoursSinceLogin = (now - lastLogin) / (1000 * 60 * 60);

      return hoursSinceLogin > 24;
    }

    return false;
  },

  // Get auth headers for external APIs
  getAuthHeaders(): Record<string, string> {
    const token = authService.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
};

// Export default service
export default authService;