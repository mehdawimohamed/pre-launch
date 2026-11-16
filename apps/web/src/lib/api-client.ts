export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  avatarUrl: string | null;
  createdAt: string;
}

export interface ApiClientConfig {
  baseUrl?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly data: unknown,
    message?: string,
  ) {
    super(message || `API Request failed with status ${status}`);
    this.name = 'ApiError';
  }
}

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Lightweight client that sends credentials (cookies) with every request.
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Ensures session_token cookie is sent across origins
  });

  if (!response.ok) {
    let errData: unknown;
    try {
      errData = await response.json();
    } catch {
      errData = await response.text();
    }
    const message =
      typeof errData === 'object' && errData !== null && 'message' in errData
        ? String((errData as Record<string, unknown>).message)
        : `Request failed: ${response.status}`;
    throw new ApiError(response.status, errData, message);
  }

  // Handle 204 or empty responses
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json() as Promise<T>;
  }
  return response.text() as unknown as T;
}

export const authApi = {
  loginWithGoogle(idToken: string): Promise<{ user: UserProfile }> {
    return apiFetch<{ user: UserProfile }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
  },

  getCurrentUser(): Promise<{ user: UserProfile }> {
    return apiFetch<{ user: UserProfile }>('/me', {
      method: 'GET',
    });
  },

  logout(): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    });
  },
};
