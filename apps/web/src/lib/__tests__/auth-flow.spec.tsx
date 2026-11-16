import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { authApi } from '@/lib/api-client';

// Component to test the auth context hooks and mock login flow
function TestAuthConsumer() {
  const { user, isLoading, login, logout } = useAuth();

  if (isLoading) {
    return <div data-testid="loading">Loading session...</div>;
  }

  return (
    <div>
      {user ? (
        <div>
          <span data-testid="user-greeting">Bonjour {user.name}</span>
          <span data-testid="user-role">{user.role}</span>
          <button onClick={() => void logout()} data-testid="logout-btn">
            Logout
          </button>
        </div>
      ) : (
        <div>
          <span data-testid="logged-out-msg">Non connecté</span>
          <button
            onClick={() => void login('mock-google-id-token')}
            data-testid="login-btn"
          >
            Login with Google
          </button>
        </div>
      )}
    </div>
  );
}

describe('Auth Flow Smoke Test (with Mocked API)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes in logged out state when /me returns 401', async () => {
    vi.spyOn(authApi, 'getCurrentUser').mockRejectedValue(new Error('Unauthorized'));

    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId('loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('logged-out-msg')).toBeInTheDocument();
    });
  });

  it('successfully logs in via Google ID token and logs out', async () => {
    // Initial state: not logged in
    vi.spyOn(authApi, 'getCurrentUser').mockRejectedValue(new Error('Unauthorized'));

    // Mock login endpoint
    vi.spyOn(authApi, 'loginWithGoogle').mockResolvedValue({
      user: {
        id: 'user-123',
        email: 'tester@example.com',
        name: 'Mohamed Salah',
        role: 'user',
        avatarUrl: 'https://example.com/avatar.jpg',
        createdAt: '2026-01-01T00:00:00Z',
      },
    });

    // Mock logout endpoint
    vi.spyOn(authApi, 'logout').mockResolvedValue({ success: true });

    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('login-btn')).toBeInTheDocument();
    });

    // Click login
    fireEvent.click(screen.getByTestId('login-btn'));

    // Assert authenticated UI
    await waitFor(() => {
      expect(screen.getByTestId('user-greeting')).toHaveTextContent('Bonjour Mohamed Salah');
      expect(screen.getByTestId('user-role')).toHaveTextContent('user');
    });

    // Click logout
    fireEvent.click(screen.getByTestId('logout-btn'));

    // Assert return to unauthenticated UI
    await waitFor(() => {
      expect(screen.getByTestId('logged-out-msg')).toBeInTheDocument();
    });
  });
});
