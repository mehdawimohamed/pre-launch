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
 * Strips leading and trailing hyphens without ReDoS risk.
 */
function trimHyphens(str: string): string {
  let start = 0;
  let end = str.length;
  while (start < end && str[start] === '-') {
    start++;
  }
  while (end > start && str[end - 1] === '-') {
    end--;
  }
  return str.slice(start, end);
}

/**
 * Generates an initial safe ASCII slug candidate from title.
 * Max length is capped at 60 to leave room for suffix collision handling up to 80 chars.
 * Matches SQL check: CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 80)
 */
export function slugify(title: string): string {
  const transliterated = transliterateArabic(title.trim().toLowerCase());
  
  // Linear-time parsing of alphanumeric words (O(n), immune to ReDoS)
  const normalized = transliterated
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, ''); // remove diacritics

  // Split on non-alphanumeric chars, filter out empty pieces, join with '-'
  const words = normalized.split(/[^a-z0-9]+/i).filter(Boolean);
  let slug = words.join('-');

  // Truncate to 60 characters and trim any trailing hyphens
  if (slug.length > 60) {
    slug = trimHyphens(slug.substring(0, 60));
  }

  // Fallback if empty or stripped completely
  if (!slug) {
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    slug = `campaign-${randomSuffix}`;
  }

  return slug;
}
