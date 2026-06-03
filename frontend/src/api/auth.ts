/**
 * Auth API
 * Wraps all authentication-related HTTP calls to the backend.
 */
const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'Request failed');
  return json.data as T;
}

export const authApi = {
  register: (email: string, password: string, fullName?: string) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  googleAuth: (idToken: string) =>
    request<AuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    }),

  getMe: (token: string) =>
    fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json()),
};
