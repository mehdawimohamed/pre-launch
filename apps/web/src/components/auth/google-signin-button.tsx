'use client';

import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useAuth } from '@/lib/auth-context';
import { useTranslations } from 'next-intl';

interface GoogleSignInButtonProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number;
              locale?: string;
            },
          ) => void;
        };
      };
    };
  }
}

export function GoogleSignInButton({ onSuccess, onError }: GoogleSignInButtonProps) {
  const { login } = useAuth();
  const t = useTranslations('auth');
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  useEffect(() => {
    if (!scriptLoaded || !window.google?.accounts?.id || !buttonRef.current || !clientId) {
      return;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          if (!response.credential) return;
          setIsProcessing(true);
          setLoginError(null);
          try {
            await login(response.credential);
            onSuccess?.();
          } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error('Authentication failed');
            setLoginError(t('errorGeneric'));
            onError?.(error);
          } finally {
            setIsProcessing(false);
          }
        },
      });

      // Render standard Google Sign In button with 44px height (size: 'large')
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        shape: 'pill',
        text: 'signin_with',
      });
    } catch (err) {
      console.error('Error initializing Google Sign-In:', err);
    }
  }, [scriptLoaded, clientId, login, onSuccess, onError, t]);

  return (
    <div className="flex flex-col items-center gap-2">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />
      <div
        ref={buttonRef}
        data-testid="google-signin-btn-container"
        className="min-h-[44px] flex items-center justify-center"
      />
      {isProcessing && (
        <p className="text-sm text-slate-500 animate-pulse">{t('signInTitle')}</p>
      )}
      {loginError && (
        <p role="alert" className="text-sm text-red-600 font-medium">
          {loginError}
        </p>
      )}
    </div>
  );
}
