/**
 * Detects whether a string is primarily right-to-left (Arabic, Hebrew, Persian, etc.).
 * Checks the first strongly-directional character in the string.
 */
export function isRtlString(text: string): boolean {
  if (!text) return false;
  // Regex matching Arabic, Hebrew, Syriac, Thaana, NKo, Samaritan, etc. Unicode blocks
  const rtlCharRegex = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
  const ltrCharRegex = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/;

  for (const char of text) {
    if (rtlCharRegex.test(char)) return true;
    if (ltrCharRegex.test(char)) return false;
  }
  return false;
}

/**
 * Returns 'rtl', 'ltr', or 'auto' based on content.
 */
export function getTextDirection(text: string): 'rtl' | 'ltr' | 'auto' {
  if (!text || !text.trim()) return 'auto';
  return isRtlString(text) ? 'rtl' : 'ltr';
}
