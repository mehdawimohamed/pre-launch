import { describe, expect, it } from 'vitest';
import frMessages from '@/messages/fr.json';
import arMessages from '@/messages/ar.json';
import enMessages from '@/messages/en.json';
import { routing } from '@/i18n/routing';

describe('i18n & Locales Routing Configuration', () => {
  it('supports the required locales [fr, ar, en] with default fr', () => {
    expect(routing.locales).toEqual(['fr', 'ar', 'en']);
    expect(routing.defaultLocale).toBe('fr');
  });

  it('verifies all three message files contain identical key structures', () => {
    // Check common keys
    expect(Object.keys(frMessages.common)).toEqual(Object.keys(arMessages.common));
    expect(Object.keys(frMessages.common)).toEqual(Object.keys(enMessages.common));

    // Check nav keys
    expect(Object.keys(frMessages.nav)).toEqual(Object.keys(arMessages.nav));
    expect(Object.keys(frMessages.nav)).toEqual(Object.keys(enMessages.nav));

    // Check hero keys
    expect(Object.keys(frMessages.hero)).toEqual(Object.keys(arMessages.hero));
    expect(Object.keys(frMessages.hero)).toEqual(Object.keys(enMessages.hero));

    // Check auth keys
    expect(Object.keys(frMessages.auth)).toEqual(Object.keys(arMessages.auth));
    expect(Object.keys(frMessages.auth)).toEqual(Object.keys(enMessages.auth));
  });

  it('contains valid translations for each language', () => {
    expect(frMessages.common.appName).toBe('Tawassol');
    expect(arMessages.common.appName).toBe('تواصل');
    expect(enMessages.common.appName).toBe('Tawassol');

    expect(frMessages.common.login).toBe('Connexion');
    expect(arMessages.common.login).toBe('تسجيل الدخول');
    expect(enMessages.common.login).toBe('Sign In');
  });
});
