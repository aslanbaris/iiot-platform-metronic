import { AuthModel, UserModel } from '@/auth/lib/models';
import { IIOTAdapter } from './iiot-adapter';

/**
 * Legacy Supabase adapter that now redirects to IIOT adapter
 * This maintains compatibility while using the new IIOT backend
 */
export const SupabaseAdapter = {
  /**
   * Login with email and password - redirects to IIOT adapter
   */
  async login(email: string, password: string): Promise<AuthModel> {
    console.log('SupabaseAdapter: Redirecting to IIOT adapter for login:', email);
    return IIOTAdapter.login(email, password);
  },

  /**
   * OAuth login - not supported in IIOT adapter yet
   */
  async signInWithOAuth(
    provider: string,
    options?: { redirectTo?: string },
  ): Promise<void> {
    throw new Error('OAuth not supported in IIOT Platform yet. Please use email/password login.');
  },

  /**
   * Register - redirects to IIOT adapter
   */
  async register(
    email: string,
    password: string,
    password_confirmation: string,
    firstName?: string,
    lastName?: string,
  ): Promise<AuthModel> {
    return IIOTAdapter.register(email, password, password_confirmation, firstName, lastName);
  },

  /**
   * Request password reset - redirects to IIOT adapter
   */
  async requestPasswordReset(email: string): Promise<void> {
    return IIOTAdapter.requestPasswordReset(email);
  },

  /**
   * Reset password - redirects to IIOT adapter
   */
  async resetPassword(
    password: string,
    password_confirmation: string,
  ): Promise<void> {
    return IIOTAdapter.resetPassword(password, password_confirmation, undefined);
  },

  /**
   * Resend verification email - redirects to IIOT adapter
   */
  async resendVerificationEmail(email: string): Promise<void> {
    return IIOTAdapter.resendVerificationEmail(email);
  },

  /**
   * Get current user - redirects to IIOT adapter
   */
  async getCurrentUser(): Promise<UserModel | null> {
    return IIOTAdapter.getCurrentUser();
  },

  /**
   * Get user profile - redirects to IIOT adapter
   */
  async getUserProfile(): Promise<UserModel> {
    const user = await IIOTAdapter.getCurrentUser();
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  },

  /**
   * Update user profile - redirects to IIOT adapter
   */
  async updateUserProfile(userData: Partial<UserModel>): Promise<UserModel> {
    return IIOTAdapter.updateUserProfile(userData);
  },

  /**
   * Logout - redirects to IIOT adapter
   */
  async logout(): Promise<void> {
    IIOTAdapter.logout();
  },
};
