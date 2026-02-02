import { NextRequest, NextResponse } from 'next/server';
import { decodeJwt } from 'jose';
import { neon } from '@neondatabase/serverless';
import { timingSafeCompare } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Rate limit: 5 req/min per IP
  const ip = getClientIp(request);
  const rl = rateLimit(`registry-revoke:${ip}`, { max: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60_000) / 1000)) } }
    );
  }

  // Admin auth check
  const apiKey = request.headers.get('x-api-key');
  if (!timingSafeCompare(apiKey, process.env.ADMIN_API_KEY)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 500 }
    );
  }

  let body: { token?: string; jti?: string; reason?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { token, reason } = body;
  let { jti } = body;
  let expiresAt: number | null = null;

  // Extract jti and exp from token if provided
  if (!jti && token) {
    try {
      const payload = decodeJwt(token);
      jti = payload.jti;
      if (payload.exp) {
        expiresAt = payload.exp as number;
      }
    } catch {
      return NextResponse.json(
        { error: 'Failed to decode token' },
        { status: 400 }
      );
    }
  } else if (token && jti) {
    // jti provided explicitly but token also present — extract exp
    try {
      const payload = decodeJwt(token);
      if (payload.exp) {
        expiresAt = payload.exp as number;
      }
    } catch {
      // ignore decode failure when jti is already provided
    }
  }

  if (!jti) {
    return NextResponse.json(
      { error: 'jti or token is required' },
      { status: 400 }
    );
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    if (expiresAt) {
      await sql`INSERT INTO revoked_tokens (jti, reason, expires_at) VALUES (${jti}, ${reason || null}, to_timestamp(${expiresAt})) ON CONFLICT (jti) DO NOTHING`;
    } else {
      await sql`INSERT INTO revoked_tokens (jti, reason) VALUES (${jti}, ${reason || null}) ON CONFLICT (jti) DO NOTHING`;
    }

    return NextResponse.json({ revoked: true, jti });
  } catch (err) {
    console.error('Revocation error:', err);
    return NextResponse.json(
      { error: 'Failed to revoke token' },
      { status: 500 }
    );
  }
}
