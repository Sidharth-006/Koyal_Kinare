import { NextRequest, NextResponse } from 'next/server';

/**
 * Allowed frontend origins for CORS.
 * In production, FRONTEND_URL must be set to the Render Static Site URL.
 * Multiple origins can be separated by commas.
 */
function getAllowedOrigins(): string[] {
  const origins: string[] = [];

  if (process.env.FRONTEND_URL) {
    process.env.FRONTEND_URL.split(',').forEach((o) => {
      const trimmed = o.trim().replace(/\/$/, '');
      if (trimmed) origins.push(trimmed);
    });
  }

  // Always allow localhost origins for development
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:3001', 'http://localhost:3000', 'http://127.0.0.1:3001');
  }

  return origins;
}

function isAllowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  const allowed = getAllowedOrigins();
  if (allowed.includes(origin)) return origin;
  // Automatically allow Render deployments (.onrender.com)
  if (origin.endsWith('.onrender.com') || origin.includes('koyal-kinare')) {
    return origin;
  }
  return null;
}

function setCorsHeaders(response: NextResponse, origin: string): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key');
  response.headers.set('Access-Control-Max-Age', '86400');
  return response;
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin');
  const allowedOrigin = isAllowedOrigin(origin);

  // Handle CORS preflight (OPTIONS) requests
  if (req.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    if (allowedOrigin) {
      setCorsHeaders(response, allowedOrigin);
    }
    return response;
  }

  // For actual requests, add CORS headers to the response
  const response = NextResponse.next();
  if (allowedOrigin) {
    setCorsHeaders(response, allowedOrigin);
  }
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
