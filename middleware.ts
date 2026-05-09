// middleware.ts — Vercel Edge Middleware
// Blocks bots/crawlers from indexing /admin.html.
// The actual authentication is enforced inside admin.html via Supabase JS.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === '/admin.html') {
    const ua = req.headers.get('user-agent') || '';
    if (/bot|crawl|spider|slurp|googlebot/i.test(ua)) {
      return new Response('Forbidden', { status: 403 });
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin.html'] };
