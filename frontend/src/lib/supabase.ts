import axios from 'axios';
import { io } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api/v1';
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:5001';

/**
 * Creates and exports an Axios client instance configured for IIOT Platform API
 * 
 * This client can be imported and used throughout the application for
 * API calls to the IIOT backend.
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('iiot_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('iiot_token');
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);

/**
 * Creates and exports a Socket.IO client for real-time communication
 */
export const socketClient = io(WS_URL, {
  autoConnect: false,
  transports: ['websocket'],
});

// Legacy export for compatibility (will be removed)
export const supabase = {
  auth: {
    signInWithPassword: () => Promise.reject(new Error('Use IIOT auth instead')),
    signUp: () => Promise.reject(new Error('Use IIOT auth instead')),
    signOut: () => Promise.reject(new Error('Use IIOT auth instead')),
    getUser: () => Promise.reject(new Error('Use IIOT auth instead')),
  },
};
