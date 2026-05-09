// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  // Protect /admin.html — redirect unauthenticated users
  // The actual auth check happens inside admin.html via Supabase JS
  // This just prevents direct indexing/crawling
  if (req.nextUrl.pathname === '/admin.html') {
    const ua = req.headers.get('user-agent') || '';
    if (ua.includes('Googlebot') || ua.includes('bot')) {
      return new Response('Forbidden', { status: 403 });
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin.html'] };
