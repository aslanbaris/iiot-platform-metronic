import { AuthModel, UserModel } from '@/auth/lib/models';
import { apiClient } from '@/lib/supabase';

/**
 * IIOT Platform adapter that handles authentication with the IIOT backend
 */
export const IIOTAdapter = {
  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<AuthModel> {
    try {
      console.log('IIOTAdapter: Login attempt for:', email);
      console.log('IIOTAdapter: API Base URL:', apiClient.defaults.baseURL);
      
      const response = await apiClient.post('/auth/login', {
        email,
        password,
      });

      console.log('IIOTAdapter: Response received:', response.status);
      console.log('IIOTAdapter: Response data:', response.data);

      const { token, refreshToken, user } = response.data.data;

      console.log('IIOTAdapter: Login successful');
      console.log('IIOTAdapter: Token received:', !!token);
      console.log('IIOTAdapter: Refresh token received:', !!refreshToken);

      // Transform response to AuthModel
      return {
        access_token: token,
        refresh_token: refreshToken,
      };
    } catch (error: any) {
      console.error('IIOTAdapter: Login error:', error);
      console.error('IIOTAdapter: Error response:', error.response?.data);
      console.error('IIOTAdapter: Error status:', error.response?.status);
      const message = error.response?.data?.message || error.message || 'Login failed';
      throw new Error(message);
    }
  },

  /**
   * Register new user
   */
  async register(
    email: string,
    password: string,
    password_confirmation: string,
    firstName?: string,
    lastName?: string,
  ): Promise<AuthModel> {
    console.log('IIOTAdapter: Attempting registration with email:', email);

    try {
      const response = await apiClient.post('/auth/register', {
        email,
        password,
        password_confirmation,
        firstName,
        lastName,
      });

      const { token, refreshToken } = response.data.data;

      console.log('IIOTAdapter: Registration successful');

      return {
        access_token: token,
        refresh_token: refreshToken,
      };
    } catch (error: any) {
      console.error('IIOTAdapter: Registration error:', error);
      const message = error.response?.data?.message || error.message || 'Registration failed';
      throw new Error(message);
    }
  },

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    try {
      await apiClient.post('/auth/forgot-password', { email });
      console.log('IIOTAdapter: Password reset email sent');
    } catch (error: any) {
      console.error('IIOTAdapter: Password reset request error:', error);
      const message = error.response?.data?.message || error.message || 'Password reset failed';
      throw new Error(message);
    }
  },

  /**
   * Reset password with token
   */
  async resetPassword(
    password: string,
    password_confirmation: string,
    token?: string,
  ): Promise<void> {
    try {
      await apiClient.post('/auth/reset-password', {
        password,
        password_confirmation,
        token,
      });
      console.log('IIOTAdapter: Password reset successful');
    } catch (error: any) {
      console.error('IIOTAdapter: Password reset error:', error);
      const message = error.response?.data?.message || error.message || 'Password reset failed';
      throw new Error(message);
    }
  },

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<void> {
    try {
      await apiClient.post('/auth/resend-verification', { email });
      console.log('IIOTAdapter: Verification email sent');
    } catch (error: any) {
      console.error('IIOTAdapter: Resend verification error:', error);
      const message = error.response?.data?.message || error.message || 'Resend verification failed';
      throw new Error(message);
    }
  },

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<UserModel | null> {
    try {
      const token = localStorage.getItem('iiot_token');
      if (!token) {
        return null;
      }

      const response = await apiClient.get('/auth/me');
      const userData = response.data.data;

      // Transform backend user data to UserModel
      return {
        id: userData._id || userData.id,
        email: userData.email,
        first_name: userData.firstName || userData.first_name,
        last_name: userData.lastName || userData.last_name,
        is_admin: userData.role === 'admin' || userData.isAdmin || false,
        avatar_url: userData.avatar || userData.avatar_url,
        created_at: userData.createdAt || userData.created_at,
        updated_at: userData.updatedAt || userData.updated_at,
      };
    } catch (error: any) {
      console.error('IIOTAdapter: Get current user error:', error);
      if (error.response?.status === 401) {
        // Token is invalid, clear it
        localStorage.removeItem('iiot_token');
        localStorage.removeItem('iiot_refresh_token');
      }
      return null;
    }
  },

  /**
   * Update user profile
   */
  async updateUserProfile(userData: Partial<UserModel>): Promise<UserModel> {
    try {
      const response = await apiClient.put('/auth/update-profile', {
        firstName: userData.first_name,
        lastName: userData.last_name,
        avatar: userData.avatar_url,
      });

      const updatedUser = response.data.data;

      return {
        id: updatedUser._id || updatedUser.id,
        email: updatedUser.email,
        first_name: updatedUser.firstName || updatedUser.first_name,
        last_name: updatedUser.lastName || updatedUser.last_name,
        is_admin: updatedUser.role === 'admin' || updatedUser.isAdmin || false,
        avatar_url: updatedUser.avatar || updatedUser.avatar_url,
        created_at: updatedUser.createdAt || updatedUser.created_at,
        updated_at: updatedUser.updatedAt || updatedUser.updated_at,
      };
    } catch (error: any) {
      console.error('IIOTAdapter: Update profile error:', error);
      const message = error.response?.data?.message || error.message || 'Profile update failed';
      throw new Error(message);
    }
  },

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      console.log('IIOTAdapter: Logging out user');
      
      // Send logout request to backend
      await apiClient.post('/auth/logout');
      
      console.log('IIOTAdapter: Logout successful');
    } catch (error: any) {
      console.error('IIOTAdapter: Logout error:', error);
      // Continue with local logout even if backend request fails
    } finally {
      // Always clear local tokens
      localStorage.removeItem('iiot_token');
      localStorage.removeItem('iiot_refresh_token');
    }
  },

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<AuthModel> {
    try {
      const refreshToken = localStorage.getItem('iiot_refresh_token');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await apiClient.post('/auth/refresh', {
        refreshToken,
      });

      const { token, refreshToken: newRefreshToken } = response.data.data;

      // Update stored tokens
      localStorage.setItem('iiot_token', token);
      if (newRefreshToken) {
        localStorage.setItem('iiot_refresh_token', newRefreshToken);
      }

      return {
        access_token: token,
        refresh_token: newRefreshToken || refreshToken,
      };
    } catch (error: any) {
      console.error('IIOTAdapter: Token refresh error:', error);
      // Clear tokens on refresh failure
      localStorage.removeItem('iiot_token');
      localStorage.removeItem('iiot_refresh_token');
      throw new Error('Token refresh failed');
    }
  },
};