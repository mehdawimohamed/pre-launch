import { describe, expect, it } from 'vitest';
import { isRtlString, getTextDirection } from '../direction';

describe('Direction Helper (Bidi & RTL detection)', () => {
  describe('isRtlString', () => {
    it('detects pure Arabic text as RTL', () => {
      expect(isRtlString('مرحبا بالعالم')).toBe(true);
      expect(isRtlString('مشروع زيت الزيتون التونسي')).toBe(true);
      expect(isRtlString('تونس')).toBe(true);
    });

    it('detects pure French and English text as non-RTL (LTR)', () => {
      expect(isRtlString('Bonjour le monde')).toBe(false);
      expect(isRtlString('Projet d’artisanat')).toBe(false);
      expect(isRtlString('Welcome to Tawassol')).toBe(false);
    });

    it('detects mixed strings starting with Arabic as RTL', () => {
      expect(isRtlString('مشروع IoT في تونس')).toBe(true);
      expect(isRtlString('تطبيق Mobile جديد')).toBe(true);
      expect(isRtlString('حملة رقم 123')).toBe(true);
    });

    it('detects mixed strings starting with Latin as LTR', () => {
      expect(isRtlString('Tawassol تواصل')).toBe(false);
      expect(isRtlString('Project زيت الزيتون')).toBe(false);
      expect(isRtlString('12345 Campaign')).toBe(false);
    });

    it('handles empty and whitespace strings safely', () => {
      expect(isRtlString('')).toBe(false);
      expect(isRtlString('   ')).toBe(false);
      expect(isRtlString('12345')).toBe(false);
    });
  });

  describe('getTextDirection', () => {
    it('returns "rtl" for Arabic strings', () => {
      expect(getTextDirection('فكرة مشروع')).toBe('rtl');
    });

    it('returns "ltr" for Latin strings', () => {
      expect(getTextDirection('Idee de projet')).toBe('ltr');
    });

    it('returns "auto" for empty or neutral strings', () => {
      expect(getTextDirection('')).toBe('auto');
      expect(getTextDirection('   ')).toBe('auto');
    });
  });
});
