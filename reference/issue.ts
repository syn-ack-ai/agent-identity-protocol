import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, importPKCS8 } from 'jose';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { timingSafeCompare } from '@/lib/auth';

const EXPIRY_MAP: Record<string, number> = {
  '1h': 3600,
  '6h': 21600,
  '12h': 43200,
  '24h': 86400,
};

export async function POST(request: NextRequest) {
  // Rate limit: 5 req/min per IP
  const ip = getClientIp(request);
  const rl = rateLimit(`registry-issue:${ip}`, { max: 5, windowMs: 60_000 });
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

  const rawKey = process.env.AGENT_REGISTRY_PRIVATE_KEY;
  const privateKeyPem = rawKey?.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;
  if (!privateKeyPem) {
    return NextResponse.json(
      { error: 'Private key not configured' },
      { status: 500 }
    );
  }

  let body: {
    agent_name?: string;
    model_providers?: string[];
    framework?: string;
    deployer?: string;
    token_type?: 'identity' | 'session';
    audience?: string;
    expires_in?: string;
    nonce?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { agent_name, model_providers, framework, deployer, token_type, audience, expires_in, nonce } = body;

  if (!agent_name) {
    return NextResponse.json(
      { error: 'agent_name is required' },
      { status: 400 }
    );
  }

  const type = token_type || 'identity';

  if (type !== 'identity' && type !== 'session') {
    return NextResponse.json(
      { error: 'token_type must be "identity" or "session"' },
      { status: 400 }
    );
  }

  if (type === 'session' && !audience) {
    return NextResponse.json(
      { error: 'audience is required for session tokens' },
      { status: 400 }
    );
  }

  // Determine expiry
  const defaultExpiry = type === 'session' ? '1h' : '24h';
  const expiryKey = expires_in || defaultExpiry;
  const expirySeconds = EXPIRY_MAP[expiryKey];

  if (!expirySeconds) {
    return NextResponse.json(
      { error: `Invalid expires_in. Allowed: ${Object.keys(EXPIRY_MAP).join(', ')}` },
      { status: 400 }
    );
  }

  const keyId = process.env.AGENT_REGISTRY_KEY_ID || 'syn-ack-2026-01';

  try {
    const privateKey = await importPKCS8(privateKeyPem, 'ES256');

    const jti = crypto.randomUUID();

    const claims: Record<string, unknown> = {
      'https://syn-ack.ai/claims/deployer': deployer || 'unknown',
      'https://syn-ack.ai/claims/model_providers': model_providers || [],
      'https://syn-ack.ai/claims/framework': framework || 'unknown',
      'https://syn-ack.ai/claims/token_type': type,
    };

    if (type === 'session' && nonce) {
      claims.nonce = nonce;
    }

    const builder = new SignJWT(claims)
      .setProtectedHeader({ alg: 'ES256', kid: keyId })
      .setSubject(agent_name)
      .setIssuer('https://syn-ack.ai')
      .setIssuedAt()
      .setJti(jti)
      .setExpirationTime(Math.floor(Date.now() / 1000) + expirySeconds);

    if (type === 'session' && audience) {
      builder.setAudience(audience);
    }

    const token = await builder.sign(privateKey);

    return NextResponse.json({
      token,
      token_type: type,
      jti,
      expires_in: expiryKey,
    });
  } catch (err) {
    console.error('Token signing error:', err);
    return NextResponse.json(
      { error: 'Failed to sign token' },
      { status: 500 }
    );
  }
}
