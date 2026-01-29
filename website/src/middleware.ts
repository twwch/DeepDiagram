import createMiddleware from 'next-intl/middleware';
import { routing } from './lib/i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: ['/((?!api|_next|_vercel|images|fonts|.*\\.(?:ico|svg|png|jpg|jpeg|gif|webp|txt|xml|css|js)).*)'],
};
