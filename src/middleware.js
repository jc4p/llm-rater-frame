import { NextResponse } from 'next/server';

export function middleware(request) {
  // Check if the URL matches /tokens/{number}
  const tokensMatch = request.nextUrl.pathname.match(/^\/tokens\/(\d+)$/);
  
  if (tokensMatch) {
    const tokenId = tokensMatch[1];
    return NextResponse.rewrite(new URL(`/api/tokens/${tokenId}`, request.url));
  }
}

export const config = {
  matcher: '/tokens/:path*'
}; 