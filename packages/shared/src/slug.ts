/**
 * Arabic to Latin transliteration map for generating clean, readable slugs from Arabic titles.
 */
const ARABIC_TRANSLITERATION_MAP: Record<string, string> = {
  'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'aa', 'ء': '', 'ئ': '', 'ؤ': '',
  'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
  'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
  'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'dh', 'ع': 'a', 'غ': 'gh',
  'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ة': 'a',
  'پ': 'p', 'چ': 'ch', 'ڤ': 'v', 'گ': 'g',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

/**
 * Transliterates Arabic text into safe Latin ASCII approximation.
 */
export function transliterateArabic(text: string): string {
  let result = '';
  for (const char of text) {
    if (Object.prototype.hasOwnProperty.call(ARABIC_TRANSLITERATION_MAP, char)) {
      result += ARABIC_TRANSLITERATION_MAP[char];
    } else {
      result += char;
    }
  }
  return result;
}

/**
 * Generates an initial safe ASCII slug candidate from title.
 * Max length is capped at 60 to leave room for suffix collision handling up to 80 chars.
 * Matches SQL check: CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 80)
 */
export function slugify(title: string): string {
  const transliterated = transliterateArabic(title.trim().toLowerCase());
  
  // Normalize and replace any non-alphanumeric character with hyphen
  let slug = transliterated
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Truncate to 60 characters and trim trailing hyphens
  if (slug.length > 60) {
    slug = slug.substring(0, 60).replace(/-+$/, '');
  }

  // Fallback if empty or stripped completely
  if (!slug) {
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    slug = `campaign-${randomSuffix}`;
  }

  return slug;
}
