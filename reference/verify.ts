import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, importSPKI, decodeProtectedHeader } from 'jose';
import { neon } from '@neondatabase/serverless';

export async function POST(request: NextRequest) {
  const rawKey = process.env.AGENT_REGISTRY_PUBLIC_KEY;
  const publicKeyPem = rawKey?.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;

  if (!publicKeyPem) {
    return NextResponse.json(
      { error: 'Public key not configured' },
      { status: 500 }
    );
  }

  let body: { token?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { token } = body;

  if (!token) {
    return NextResponse.json(
      { error: 'token is required' },
      { status: 400 }
    );
  }

  try {
    // Extract kid from header (if present) for future multi-key support
    const header = decodeProtectedHeader(token);
    const _kid = header.kid; // Currently only one key, but extracted for logging/future use

    const publicKey = await importSPKI(publicKeyPem, 'ES256');

    // Accept both old "syn-ack.ai" and new "https://syn-ack.ai" issuers
    const { payload } = await jwtVerify(token, publicKey);

    const validIssuers = ['syn-ack.ai', 'https://syn-ack.ai'];
    if (!payload.iss || !validIssuers.includes(payload.iss)) {
      return NextResponse.json(
        { valid: false, error: 'invalid issuer' },
        { status: 401 }
      );
    }

    // Check revocation if jti is present
    if (payload.jti && process.env.DATABASE_URL) {
      const sql = neon(process.env.DATABASE_URL);
      const rows = await sql`SELECT jti FROM revoked_tokens WHERE jti = ${payload.jti}`;
      if (rows.length > 0) {
        return NextResponse.json(
          { valid: false, error: 'token revoked' },
          { status: 401 }
        );
      }
    }

    // Map namespaced claims back to short names (v2.1 tokens use namespaced, v2 use bare)
    const NS = 'https://syn-ack.ai/claims/';
    const deployer = payload[`${NS}deployer`] ?? payload.deployer;
    const model_providers = payload[`${NS}model_providers`] ?? payload.model_providers;
    const framework = payload[`${NS}framework`] ?? payload.framework;
    const token_type = payload[`${NS}token_type`] ?? payload.token_type ?? 'identity';

    const claims: Record<string, unknown> = {
      sub: payload.sub,
      iss: payload.iss,
      deployer,
      model_providers,
      framework,
      token_type,
      aud: payload.aud,
      jti: payload.jti,
      iat: payload.iat,
      exp: payload.exp,
    };

    if (payload.nonce) {
      claims.nonce = payload.nonce;
    }

    return NextResponse.json({
      valid: true,
      claims,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verification failed';
    return NextResponse.json(
      { valid: false, error: message },
      { status: 401 }
    );
  }
}
