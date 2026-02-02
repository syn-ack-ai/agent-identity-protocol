# AIP Threat Model

Version 2.1 — February 2026

## Trust Assumptions

1. **Registry operator is the trusted root.** The registry holds the signing key and issues all tokens. Compromise of the registry is a catastrophic failure (see below).
2. **Deployer claims are self-asserted.** The `deployer` field is whatever the registrant provides. AIP does not verify deployer identity out of band — it only proves the registry saw the claim.
3. **Verifiers must fetch fresh keys.** Relying on cached JWKs without periodic refresh defeats key rotation and revocation. Verifiers SHOULD re-fetch `/.well-known/agent-registry.json` at least every hour.
4. **Transport security is mandatory.** All endpoints are HTTPS. AIP tokens carry no confidentiality guarantees if transmitted over plaintext channels.

---

## In-Scope Attacks & Mitigations

### 1. Impersonation

**Attack:** Adversary registers as an existing agent name or forges a token claiming to be another agent.

**Mitigation:** Tokens are ES256-signed (ECDSA over P-256). Forging a valid signature without the registry's private key is computationally infeasible. Agent names are unique in the registry — re-registration updates the existing record rather than creating a duplicate. Verifiers MUST validate the signature against the registry's published JWK.

### 2. Replay Attacks

**Attack:** Adversary captures a valid session token and replays it to a different service or after the intended interaction.

**Mitigation:**
- **Nonce binding:** Session tokens support a `nonce` claim. Verifiers that supply a nonce at verification time reject tokens with mismatched nonces.
- **Audience binding:** Session tokens include an `aud` claim scoping the token to a specific relying party. Verifiers MUST reject tokens where `aud` doesn't match their own identifier.
- **Short TTL:** Session tokens default to 1h expiry; identity tokens to 24h.

### 3. Token Theft

**Attack:** Adversary exfiltrates a valid token from logs, memory, or transit.

**Mitigation:**
- Short expiry windows limit the blast radius.
- Revocation: admins can immediately revoke any token by `jti`. Verifiers that check `/api/registry/revocations` will reject revoked tokens.
- HTTPS-only transport prevents passive interception.
- Tokens carry no elevated privileges — they prove identity, not authorization.

### 4. Malicious Deployer

**Attack:** A deployer registers an agent with false metadata (fake model, fake framework) to gain unearned trust.

**Mitigation:** AIP explicitly does **not** verify deployer claims — this is a known limitation by design. The `deployer` field is informational only. Systems requiring verified deployer identity should layer additional attestation (e.g., EMET truth-staking with economic penalties for false claims).

### 5. Compromised Registry

**Attack:** Adversary gains access to the registry's signing key or database.

**Mitigation:**
- **Key rotation via `kid`:** The JWK Set supports multiple keys identified by `kid`. Compromised keys can be rotated out; verifiers that re-fetch the JWK Set will pick up the new key.
- **Revocation blast:** On key compromise, all tokens signed by the compromised `kid` should be considered invalid. The registry publishes mass revocations.
- **Operational security:** Key material should be stored in HSMs or equivalent secure enclaves. This is an operational concern, not a protocol-level mitigation.

### 6. Key Compromise (Individual Agent)

**Attack:** Not applicable in current architecture — agents don't hold their own signing keys. The registry is the sole signer. If a future version supports agent-held keys, key compromise would require per-agent revocation and re-issuance.

### 7. Registration Spam

**Attack:** Adversary floods `/api/registry/register` to pollute the registry with garbage entries or exhaust resources.

**Mitigation:**
- **Rate limiting:** 3 registrations per IP per hour.
- **Validation:** Required fields (`agent_name`, `deployer`) are enforced. Name length is bounded (128 chars).
- **Cleanup:** Admin can revoke tokens and remove entries. Future: proof-of-work or CAPTCHA gating for registration.

---

## Out of Scope

AIP is an identity layer. The following are explicitly **not** solved by AIP:

| Area | Why Out of Scope |
|------|-----------------|
| **On-chain anchoring** | AIP is a centralized registry. Decentralized key anchoring (e.g., DID methods on-chain) is a separate concern. See [RELATED.md](./RELATED.md). |
| **Reputation** | Knowing *who* an agent is ≠ knowing *how trustworthy* it is. Reputation requires interaction history, staking, or social graph — not identity tokens. |
| **Capability authorization** | AIP proves identity. What an agent is *allowed to do* requires a separate authz layer (RBAC, capability tokens, policy engines). |
| **Consensus / multi-registry** | AIP assumes a single trusted registry. Federation or consensus across multiple registries is future work. |
| **Human identity verification** | Deployer claims are self-asserted. AIP does not KYC deployers or verify human identity. |

---

## Signature & Cryptography Summary

| Parameter | Value |
|-----------|-------|
| Algorithm | ES256 (ECDSA, SHA-256, P-256) |
| Key type | EC / P-256 |
| Token format | JWT (RFC 7519) |
| Key discovery | JWK Set via `/.well-known/agent-registry.json` |
| Key rotation | Via `kid` claim in JWT header → match to JWK Set |
| Revocation | Explicit jti-based revocation list |
