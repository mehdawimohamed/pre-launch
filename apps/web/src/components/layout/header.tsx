'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import { LanguageSwitcher } from './language-switcher';
import { GoogleSignInButton } from '@/components/auth/google-signin-button';
import { Button } from '@/components/ui/button';
import { IsolatedText } from '@/components/ui/user-text';
import { LogOut, User as UserIcon, Shield, Menu, X } from 'lucide-react';

export function Header() {
  const t = useTranslations('common');
  const navT = useTranslations('nav');
  const { user, isLoading, logout } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  // Resolve portal target on mount (client-only)
  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  // Close modal on Escape and lock body scroll while open
  useEffect(() => {
    if (!showLoginModal) return;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowLoginModal(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showLoginModal]);

  const header = (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-bold text-slate-900 hover:text-emerald-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-md py-1"
          >
            <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-xs">
              T
            </span>
            <span className="tracking-tight">{t('appName')}</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link
              href="/"
              className="hover:text-slate-900 transition-colors py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
            >
              {navT('explore')}
            </Link>
            <Link
              href="/"
              className="hover:text-slate-900 transition-colors py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
            >
              {navT('howItWorks')}
            </Link>
          </nav>
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-3">
          <LanguageSwitcher />

          {isLoading ? (
            <div className="w-24 h-10 bg-slate-100 rounded-lg animate-pulse" />
          ) : user ? (
            <div className="flex items-center gap-3 ps-2">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="w-8 h-8 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
                <IsolatedText className="font-medium max-w-[140px] truncate">
                  {user.name}
                </IsolatedText>
                {user.role === 'admin' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Shield className="w-3 h-3" />
                    Admin
                  </span>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => void logout()}
                aria-label={t('logout')}
                className="text-slate-500 hover:text-red-600"
              >
                <LogOut className="w-4 h-4 me-1.5" />
                <span>{t('logout')}</span>
              </Button>
            </div>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowLoginModal(true)}
            >
              {t('login')}
            </Button>
          )}
        </div>

        {/* Mobile Hamburger button */}
        <div className="flex md:hidden items-center gap-2">
          <LanguageSwitcher />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            className="p-2"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 flex flex-col gap-4">
          <nav className="flex flex-col gap-3 font-medium text-slate-700">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 px-3 rounded-lg hover:bg-slate-50"
            >
              {navT('explore')}
            </Link>
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 px-3 rounded-lg hover:bg-slate-50"
            >
              {navT('howItWorks')}
            </Link>
          </nav>

          <div className="pt-3 border-t border-slate-100 flex flex-col gap-3">
            {user ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt=""
                      className="w-9 h-9 rounded-full border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200">
                      <UserIcon className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <IsolatedText className="font-medium text-slate-900">
                      {user.name}
                    </IsolatedText>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    void logout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-red-600 justify-center"
                >
                  <LogOut className="w-4 h-4 me-2" />
                  {t('logout')}
                </Button>
              </div>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  setShowLoginModal(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full justify-center"
              >
                {t('login')}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Login Dialog — rendered via portal to escape header's backdrop-blur containing block */}
    </header>
  );

  const loginModal = showLoginModal && portalRoot
    ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('login')}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
          onClick={(e) => {
            // Close on backdrop click
            if (e.target === e.currentTarget) setShowLoginModal(false);
          }}
        >
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-slate-100 relative">
            <button
              onClick={() => setShowLoginModal(false)}
              aria-label="Fermer la boîte de dialogue"
              className="absolute top-4 end-4 text-slate-400 hover:text-slate-600 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <span className="w-12 h-12 rounded-xl bg-emerald-600 text-white inline-flex items-center justify-center font-bold text-xl mb-3 shadow-xs">
                T
              </span>
              <h2 className="text-xl font-bold text-slate-900">{t('login')}</h2>
              <p className="text-sm text-slate-600 mt-1">{t('tagline')}</p>
            </div>

            <div className="py-4">
              <GoogleSignInButton
                onSuccess={() => setShowLoginModal(false)}
              />
            </div>
          </div>
        </div>,
        portalRoot,
      )
    : null;

  return (
    <>
      {header}
      {loginModal}
    </>
  );
}
