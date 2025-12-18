import { getSessionCookie } from 'better-auth/cookies';
import { NextRequest, NextResponse } from 'next/server';
/**
 * Configuration
 * - patterns: array of string or RegExp to detect "contains a path"
 *    - string: simple substring search
 *    - RegExp: full power (anchoring, groups, case-insensitive, etc.)
 *
 * - action: "rewrite" (internal server-side rewrite) or "redirect" (client sees new URL)
 *    - You can set process.env.MW_ACTION = "redirect" in runtime env to change behaviour
 */
const patterns: Array<string | RegExp> = [
  // Example matches:
  '/auth/login', // any URL containing "/auth/login"
  '/profile', // any URL containing "/profile"
  '/users',
  '/',
  // /\/special\/path(\/|$)/i, // regex: /special/path or /special/path/...
];

const DEFAULT_ACTION = 'redirect'; // or "redirect"

function matchesPath(pathname: string) {
  return patterns.some((p) => {
    if (typeof p === 'string') return pathname.includes(p);
    return p.test(pathname);
  });
}

export function proxy(req: NextRequest) {
  const url = req.nextUrl.clone(); // clone so we can modify safely
  const pathname = url.pathname; // incoming path (already decoded)
  const searchParams = url.searchParams;

  // Quick exit: if nothing matches, no op
  if (!matchesPath(pathname)) return NextResponse.next();

  if (!pathname.startsWith('/auth/login')) {
    const sessionCookie = getSessionCookie(req);
    if (!sessionCookie) {
      const callback = encodeURIComponent(pathname + '?' + searchParams.toString());
      const loginPathname = '/auth/login';
      const loginParams = new URLSearchParams({ callback });
      return NextResponse.redirect(
        new URL(
          `${loginPathname}?${loginParams.toString()}`,
          process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
        ),
        307
      );
    }
  }

  if (pathname.startsWith('/auth/login')) {
    const sessionCookie = getSessionCookie(req);
    if (sessionCookie) {
      const callbackParam = searchParams.get('callback');
      const destination = callbackParam ? decodeURIComponent(callbackParam) : '/';
      const route = new URL(destination, req.url);
      return NextResponse.redirect(route, 307);
    }
  }

  let destination = '/'; // fallback destination
  const action = searchParams.get('action');
  if (pathname.includes('/quick-export')) {
    if (action === 'cancel') {
      const originRoute = searchParams.get('origin');
      destination = originRoute && !originRoute?.includes('/quick-export') ? originRoute : '/';
      const route = new URL(destination, req.url);
      return NextResponse.redirect(route, 307);
    }
    if (!pathname.includes('/start') && !searchParams.has('action')) {
      destination = '/quick-export/start';
      const route = new URL(destination, req.url);
      return NextResponse.redirect(route, 307);
    }
  }
  if (pathname.includes('/users')) {
    if (action === 'cancel') {
      const originRoute = searchParams.get('origin');
      destination = originRoute && !originRoute?.includes('/users') ? originRoute : '/users';
      const route = new URL(destination, req.url);
      return NextResponse.redirect(route, 307);
    }
  }

  return NextResponse.next();
}
