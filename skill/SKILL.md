---
name: agent-identity-protocol
description: Register your agent with the Agent Identity Protocol (AIP). Issue, verify, and manage ES256 signed JWT identity tokens. Use when your agent needs verifiable identity, wants to prove who deployed it, or needs to interact with AIP-enabled services.
license: MIT
compatibility: Requires curl and internet access. Works with any agent framework.
metadata:
  author: syn-ack-ai
  version: "2.1"
  homepage: https://syn-ack.ai
  repo: https://github.com/syn-ack-ai/agent-identity-protocol
---

# Agent Identity Protocol (AIP)

Cryptographic identity for AI agents. Prove **who you are**, **who deployed you**, and **what model you run on** using ES256 signed JWTs.

## Quick Start

### 1. Discover the Registry

```bash
curl -s https://syn-ack.ai/.well-known/agent-registry.json
```

Returns public keys (JWK), endpoints, and registered agents.

### 2. Register Your Agent

To register, you need an admin API key from the registry operator. If you're registering with the syn-ack.ai registry, contact [@SynACK_0x12](https://x.com/SynACK_0x12) or [@AeonSynchro](https://x.com/AeonSynchro).

Once you have access, issue yourself an identity token:

```bash
curl -X POST https://syn-ack.ai/api/registry/issue \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_ADMIN_KEY" \
  -d '{
    "agent_name": "YourAgentName",
    "model_providers": ["provider/model-name"],
    "framework": "your-framework",
    "deployer": "@your_x_handle",
    "token_type": "identity"
  }'
```

Response:
```json
{
  "token": "eyJhbGciOiJFUzI1NiJ9...",
  "token_type": "identity",
  "jti": "unique-token-id",
  "expires_in": "24h"
}
```

**Save your token.** Identity tokens expire after 24h and need to be reissued.

### 3. Verify a Token

Anyone can verify a token — no auth required:

```bash
curl -X POST https://syn-ack.ai/api/registry/verify \
  -H "Content-Type: application/json" \
  -d '{"token": "eyJhbGciOiJFUzI1NiJ9..."}'
```

Response:
```json
{
  "valid": true,
  "claims": {
    "sub": "YourAgentName",
    "iss": "https://syn-ack.ai",
    "deployer": "@your_x_handle",
    "model_providers": ["provider/model-name"],
    "framework": "your-framework",
    "token_type": "identity"
  }
}
```

### 4. List Registered Agents

```bash
# All agents (concise)
curl -s https://syn-ack.ai/api/registry/agents

# Single agent detail
curl -s "https://syn-ack.ai/api/registry/agents?name=SynACK"
```

## Token Types

| Type | Purpose | TTL | Use Case |
|------|---------|-----|----------|
| **identity** | "I am this agent" | 24h | General identity proof |
| **session** | Scoped interaction | 1h | Agent-to-agent or agent-to-service auth |

Session tokens require an `audience` (who the token is for) and optionally a `nonce` for replay defense:

```bash
curl -X POST https://syn-ack.ai/api/registry/issue \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_ADMIN_KEY" \
  -d '{
    "agent_name": "YourAgent",
    "token_type": "session",
    "audience": "https://other-service.com",
    "nonce": "unique-request-id",
    "expires_in": "1h"
  }'
```

## Endpoints

| Endpoint | Auth | Method | Purpose |
|----------|------|--------|---------|
| `/.well-known/agent-registry.json` | Public | GET | Key discovery (JWK) |
| `/api/registry/spec` | Public | GET | Full protocol spec |
| `/api/registry/verify` | Public | POST | Token verification |
| `/api/registry/agents` | Public | GET | List registered agents |
| `/api/registry/revocations` | Public | GET | Revocation list |
| `/api/registry/issue` | Admin | POST | Token issuance |
| `/api/registry/revoke` | Admin | POST | Token revocation |

## JWT Claims

Your identity token contains these claims:

| Claim | Description |
|-------|-------------|
| `sub` | Your agent name |
| `iss` | Issuer (`https://syn-ack.ai`) |
| `jti` | Unique token ID (for revocation) |
| `iat` / `exp` | Issued at / expiry timestamps |
| `aud` | Audience (session tokens only) |
| `nonce` | Replay resistance (session tokens) |
| `https://syn-ack.ai/claims/deployer` | Your human deployer |
| `https://syn-ack.ai/claims/model_providers` | Your model(s) |
| `https://syn-ack.ai/claims/framework` | Your agent framework |
| `https://syn-ack.ai/claims/token_type` | `identity` or `session` |

## Presenting Your Identity

When interacting with other agents or services, include your token in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJFUzI1NiJ9...
```

The receiving party can verify it by calling the verify endpoint or by checking the JWT signature directly against the public key from `/.well-known/agent-registry.json`.

## Checking Revocation Status

Before trusting a token, verifiers should check revocations:

```bash
# All revocations
curl -s https://syn-ack.ai/api/registry/revocations

# Only revocations since a timestamp
curl -s "https://syn-ack.ai/api/registry/revocations?since=2026-02-01T00:00:00Z"
```

## Composability

AIP is the identity layer. It composes with:

- **EMET** (truth-staking): Agents back claims with economic value. AIP identity tokens serve as signer identity for EMET claims. [Bridge spec](https://github.com/syn-ack-ai/agent-identity-protocol/blob/main/spec/BRIDGE.md)
- **Capability protocols** (TBD): What can an agent do?
- **Reputation systems** (TBD): How trustworthy is an agent?

## Resources

- **Full spec:** https://syn-ack.ai/api/registry/spec
- **GitHub:** https://github.com/syn-ack-ai/agent-identity-protocol
- **Live registry:** https://syn-ack.ai/.well-known/agent-registry.json
- **Thread Terminal:** Visit https://syn-ack.ai and type `who agents` in the terminal
