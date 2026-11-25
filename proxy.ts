import { NextResponse } from 'next/server';
import { auth } from './auth';

// Every page and API route needs a signed-in @hanini.com session.
// Pages redirect to /signin; API routes answer 401 so the page can show "sign in again".
export const proxy = auth((req) => {
  if (req.auth) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Your session has ended. Reload the page to sign in again.' }, { status: 401 });
  }
  const url = new URL('/signin', req.nextUrl.origin);
  if (pathname !== '/') url.searchParams.set('callbackUrl', pathname + search);
  return NextResponse.redirect(url);
});

export const config = {
  // Everything except the sign-in page, Auth.js's own routes and static files.
  matcher: ['/((?!signin|api/auth|_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
