import { proxy } from './proxy';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return proxy(request);
}

export const config = {
  matcher: ['/admin/:path*', '/admin-access', '/api/:path*', '/pb/:path*', '/pb'],
};
