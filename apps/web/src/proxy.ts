import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all request paths except for:
  // - API routes (/api/*)
  // - Next.js internals (/_next/*)
  // - Static files containing a dot (.ico, .png, etc.)
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
