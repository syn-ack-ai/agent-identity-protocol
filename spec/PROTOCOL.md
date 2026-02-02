# Agent Identity Protocol v2 (v2.1 Revision)

## Overview

The Agent Identity Protocol provides cryptographic identity verification for AI agents.
Agents can prove their identity, configuration, and provenance via signed JWT tokens
using ES256 (ECDSA P-256) signatures.

This is a JWT issuer model — the "X.509 for Agents" name is an analogy for the
chain-of-accountability concept (deployer → agent → token), not a literal X.509 PKI implementation.

v2 adds key rotation support, token types (identity vs session), audience binding, and token revocation.
v2.1 adds replay resistance (nonce), namespaced claims, revocation scaling, and improved discovery metadata.

## Discovery

Fetch the agent registry to discover public keys and endpoints:

```bash
curl https://syn-ack.ai/.well-known/agent-registry.json
```

Returns:
```json
{
  "protocol": "agent-identity-v2",
  "issuer": "https://syn-ack.ai",
  "active_kid": "syn-ack-2026-01",
  "keys": [
    {
      "kid": "syn-ack-2026-01",
      "kty": "EC",
      "crv": "P-256",
      "x": "...",
      "y": "...",
      "alg": "ES256",
      "use": "sig",
      "status": "active"
    }
  ],
  "public_key": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
  "algorithms": ["ES256"],
  "verify_endpoint": "https://syn-ack.ai/api/registry/verify",
  "issue_endpoint": "https://syn-ack.ai/api/registry/issue",
  "revocations_endpoint": "https://syn-ack.ai/api/registry/revocations",
  "revoke_endpoint": "https://syn-ack.ai/api/registry/revoke",
  "jwks_uri": "https://syn-ack.ai/.well-known/agent-registry.json",
  "spec": "https://syn-ack.ai/api/registry/spec",
  "agents": ["SynACK"]
}
```

### Discovery Fields

| Field | Description |
|-------|-------------|
| `issuer` | Full URI of the issuer (`https://syn-ack.ai`) |
| `jwks_uri` | OIDC-style self-referential URI for key discovery |
| `revoke_endpoint` | Admin endpoint for token revocation |
| `revocations_endpoint` | Public endpoint for revocation list |
| `verify_endpoint` | Public endpoint for token verification |
| `issue_endpoint` | Admin endpoint for token issuance |

### Key Rotation

Keys are identified by `kid` (Key ID). The `active_kid` field indicates which key is currently used for issuance. The `keys` array contains all valid keys (active and rotated-but-still-valid). Verifiers should match the `kid` from the JWT header to the correct key.

The `public_key` field is retained for backward compatibility with v1 clients.

## Token Types

### Identity Token (`token_type: "identity"`)
- Proves "I am this agent"
- Long-lived: 24 hours (default)
- No audience binding — portable across verifiers
- Default type when `token_type` is not specified

### Session Token (`token_type: "session"`)
- For specific agent-to-agent or agent-to-service interactions
- Short-lived: 1 hour (default)
- Audience-bound via `aud` claim
- Replay-resistant via unique `jti` claim
- Supports optional `nonce` claim for challenge-response binding

Both token types include a `jti` (JWT ID) claim for revocation support.

## Token Issuance

Request a signed identity token (admin-only):

```bash
curl -X POST https://syn-ack.ai/api/registry/issue \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_ADMIN_KEY" \
  -d '{
    "agent_name": "SynACK",
    "model_providers": ["anthropic/claude-opus-4-5"],
    "framework": "openclaw",
    "deployer": "SkyPanther",
    "token_type": "session",
    "audience": "moltbook.com",
    "nonce": "abc123-random-challenge",
    "expires_in": "1h"
  }'
```

Returns:
```json
{
  "token": "eyJhbGciOiJFUzI1NiIsImtpZCI6InN5bi1hY2stMjAyNi0wMSJ9...",
  "token_type": "session",
  "jti": "550e8400-e29b-41d4-a716-446655440000",
  "expires_in": "1h"
}
```

### Request Body

| Field | Required | Description |
|-------|----------|-------------|
| `agent_name` | Yes | Agent identifier (becomes `sub` claim) |
| `model_providers` | No | Array of model provider strings |
| `framework` | No | Agent framework identifier |
| `deployer` | No | Human deployer identifier |
| `token_type` | No | `"identity"` (default) or `"session"` |
| `audience` | Session only | Target audience for session tokens (becomes `aud` claim) |
| `nonce` | No | Challenge string for replay resistance (session tokens only) |
| `expires_in` | No | `"1h"`, `"6h"`, `"12h"`, or `"24h"` |

### Token Claims (JWT Payload)

Claims in the JWT are namespaced to avoid collisions with registered JWT claims:

| JWT Claim | Short Name | Description |
|-----------|------------|-------------|
| `sub` | sub | Agent name |
| `iss` | iss | Issuer URI (`https://syn-ack.ai`) |
| `https://syn-ack.ai/claims/deployer` | deployer | Human deployer identifier |
| `https://syn-ack.ai/claims/model_providers` | model_providers | Array of model provider strings |
| `https://syn-ack.ai/claims/framework` | framework | Agent framework identifier |
| `https://syn-ack.ai/claims/token_type` | token_type | `"identity"` or `"session"` |
| `aud` | aud | Audience (session tokens only) |
| `nonce` | nonce | Challenge nonce (session tokens, if provided) |
| `jti` | jti | Unique token ID (UUID) |
| `iat` | iat | Issued-at timestamp |
| `exp` | exp | Expiration timestamp |

The verify endpoint returns short names for readability. Old v2 tokens with bare claim names are still accepted.

### JWT Header

| Field | Description |
|-------|-------------|
| `alg` | `ES256` |
| `kid` | Key ID used for signing |

## Token Verification

Verify any token against the issuer's public key:

```bash
curl -X POST https://syn-ack.ai/api/registry/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "eyJhbGciOiJFUzI1NiJ9..."
  }'
```

Returns (valid):
```json
{
  "valid": true,
  "claims": {
    "sub": "SynACK",
    "iss": "https://syn-ack.ai",
    "deployer": "SkyPanther",
    "model_providers": ["anthropic/claude-opus-4-5"],
    "framework": "openclaw",
    "token_type": "identity",
    "aud": null,
    "jti": "550e8400-e29b-41d4-a716-446655440000",
    "iat": 1719000000,
    "exp": 1719086400
  }
}
```

Returns (invalid):
```json
{
  "valid": false,
  "error": "signature verification failed"
}
```

Returns (revoked):
```json
{
  "valid": false,
  "error": "token revoked"
}
```

Verification checks: signature validity, issuer claim, expiration, and revocation status.

## Replay Resistance

Session tokens support an optional `nonce` claim for challenge-response binding:

1. Verifier generates a random nonce and sends it as a challenge
2. Agent requests a session token with that nonce
3. Verifier checks the `nonce` claim matches the challenge they issued

This prevents token replay across different sessions. Combined with short expiry and audience binding, session tokens provide strong replay resistance.

**Recommendation:** Always use nonce for session tokens in security-sensitive interactions.

## Clock Skew

Verifiers should allow 60-180 seconds of clock skew when checking `iat` and `exp` claims.
The jose library applies a default clock tolerance; external verifiers should configure similar tolerance.

## Token Revocation

### Revoke a Token (admin-only)

```bash
curl -X POST https://syn-ack.ai/api/registry/revoke \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_ADMIN_KEY" \
  -d '{
    "jti": "550e8400-e29b-41d4-a716-446655440000",
    "reason": "compromised"
  }'
```

Or revoke by token (also stores expiration time):
```bash
curl -X POST https://syn-ack.ai/api/registry/revoke \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_ADMIN_KEY" \
  -d '{
    "token": "eyJhbGciOiJFUzI1NiJ9...",
    "reason": "no longer needed"
  }'
```

### List Revoked Tokens (public)

```bash
curl https://syn-ack.ai/api/registry/revocations
```

Returns:
```json
{
  "revoked": [
    { "jti": "uuid-1", "revoked_at": "2026-01-31T00:00:00.000Z", "exp": 1769839408 },
    { "jti": "uuid-2", "revoked_at": "2026-01-31T00:00:00.000Z" }
  ],
  "count": 2,
  "updated_at": "2026-01-31T00:00:00.000Z"
}
```

### Query Parameters

| Parameter | Description |
|-----------|-------------|
| `since` | ISO timestamp — return only revocations after this time |

Example: `GET /api/registry/revocations?since=2026-01-30T00:00:00Z`

The response includes `Cache-Control: public, max-age=60` and `ETag` headers.
Clients can use `If-None-Match` for conditional requests (304 Not Modified).

## Security Notes

- Identity tokens expire after 24 hours; session tokens after 1 hour (configurable up to 24h)
- Only ES256 (ECDSA P-256) signatures are accepted
- Keys are identified by `kid` — verify against the correct key from the `keys` array
- Token issuance and revocation require admin authentication via `x-api-key` header
- Verification and revocation listing are public
- All tokens include a `jti` for revocation support
- Session tokens are audience-bound — verify the `aud` claim matches your service
- Use nonce for session tokens to prevent replay attacks
- Custom claims are namespaced under `https://syn-ack.ai/claims/` to avoid JWT claim collisions

## Flow

1. **Discover** → GET `/.well-known/agent-registry.json`
2. **Issue** → POST `/api/registry/issue` (admin-only)
3. **Present** → Agent includes token in requests to third parties
4. **Verify** → Third party POST `/api/registry/verify` to validate
5. **Revoke** → POST `/api/registry/revoke` (admin-only, if needed)
6. **Check Revocations** → GET `/api/registry/revocations` (poll or use `?since=`)

## Backward Compatibility

- v1 tokens (without `kid`, `jti`, or `token_type`) are still accepted by the verify endpoint
- The `public_key` field in discovery is retained for v1 clients
- Default token type is `"identity"` — v1 callers get identity tokens automatically
- Tokens with `iss: "syn-ack.ai"` (v2) and `iss: "https://syn-ack.ai"` (v2.1) are both accepted
- Tokens with bare claim names (v2) and namespaced claims (v2.1) are both accepted
- The verify endpoint always returns short claim names regardless of token version

---

*Agent Identity Protocol v2 (v2.1 revision) — syn-ack.ai*
