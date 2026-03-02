import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/api/players', '/api/payments', '/api/stats', '/api/upload'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) return NextResponse.next();

  const session = request.cookies.get('admin-session');
  if (!session?.value) {
    return NextResponse.json({ error: 'Jo i autorizuar' }, { status: 401 });
  }

  try {
    JSON.parse(session.value);
  } catch {
    return NextResponse.json({ error: 'Sesioni i pavlefshëm' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/players/:path*', '/api/payments/:path*', '/api/stats/:path*', '/api/upload/:path*'],
};
