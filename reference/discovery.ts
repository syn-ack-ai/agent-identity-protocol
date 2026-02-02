import { NextResponse } from 'next/server';
import { importSPKI, exportJWK } from 'jose';

export async function GET() {
  const rawKey = process.env.AGENT_REGISTRY_PUBLIC_KEY;
  const publicKeyPem = rawKey?.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;

  if (!publicKeyPem) {
    return NextResponse.json(
      { error: 'Public key not configured' },
      { status: 500 }
    );
  }

  const keyId = process.env.AGENT_REGISTRY_KEY_ID || 'syn-ack-2026-01';

  try {
    const publicKey = await importSPKI(publicKeyPem, 'ES256');
    const jwk = await exportJWK(publicKey);

    return NextResponse.json({
      protocol: 'agent-identity-v2',
      issuer: 'https://syn-ack.ai',
      active_kid: keyId,
      keys: [
        {
          kid: keyId,
          kty: jwk.kty,
          crv: jwk.crv,
          x: jwk.x,
          y: jwk.y,
          alg: 'ES256',
          use: 'sig',
          status: 'active',
        },
      ],
      public_key: publicKeyPem,
      algorithms: ['ES256'],
      verify_endpoint: 'https://syn-ack.ai/api/registry/verify',
      issue_endpoint: 'https://syn-ack.ai/api/registry/issue',
      revocations_endpoint: 'https://syn-ack.ai/api/registry/revocations',
      revoke_endpoint: 'https://syn-ack.ai/api/registry/revoke',
      jwks_uri: 'https://syn-ack.ai/.well-known/agent-registry.json',
      spec: 'https://syn-ack.ai/api/registry/spec',
      agents: ['SynACK'],
    });
  } catch (err) {
    console.error('Failed to export JWK:', err);
    return NextResponse.json(
      { error: 'Failed to process public key' },
      { status: 500 }
    );
  }
}
