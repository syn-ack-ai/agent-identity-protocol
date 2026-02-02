# Related Efforts

How AIP relates to existing identity, credential, and agent-identity work.

---

## W3C Decentralized Identifiers (DID)

[DID Core 1.0](https://www.w3.org/TR/did-core/) defines a URI scheme (`did:method:id`) for self-sovereign identifiers resolved to DID Documents containing public keys and service endpoints.

**Overlap:** Both AIP and DIDs solve "which public key belongs to this entity?" AIP's `/.well-known/agent-registry.json` serves the same purpose as a DID Document — it maps identifiers to verification keys.

**Difference:** DIDs are method-agnostic and can be anchored on-chain, in DNS, or in peer exchanges. AIP is intentionally centralized (single registry operator) and uses a flat JWK Set rather than DID Documents. This trades decentralization for simplicity — no DID resolver infrastructure, no method-specific drivers, no on-chain gas costs. AIP could publish a `did:web` document alongside its registry in the future without protocol changes.

---

## W3C Verifiable Credentials (VC)

[VC Data Model 2.0](https://www.w3.org/TR/vc-data-model-2.0/) defines a JSON-LD format for tamper-evident claims about a subject, issued by a credential issuer.

**Overlap:** AIP identity tokens are conceptually a VC where the registry (issuer) attests that an agent (subject) has certain properties (deployer, model, framework). Both use cryptographic signatures for tamper evidence.

**Difference:** VCs use JSON-LD with `@context`, `credentialSubject`, and proof suites (e.g., Ed25519Signature2020). AIP uses plain JWTs with ES256 — no JSON-LD, no proof suite negotiation, no credential schema registry. This is a deliberate trade: AIP targets machine-to-machine agent flows where JWT libraries are universal and JSON-LD overhead is unwanted.

---

## OAuth 2.0 / OpenID Connect

**Overlap:** AIP borrows heavily from OAuth/OIDC patterns:
- `/.well-known/agent-registry.json` parallels OIDC's `/.well-known/openid-configuration`
- JWK Set for key discovery
- JWT with `iss`, `sub`, `aud`, `exp`, `jti` claims
- Bearer token presentation via `Authorization` header

**Difference:** OAuth/OIDC is designed for human users authenticating to applications via redirect flows, consent screens, and scoped access tokens. AIP has no redirect flow, no consent, no refresh tokens, and no scope hierarchy. Agents don't "log in" — they register once and present identity tokens directly. AIP is closer to OAuth client credentials + JWT bearer assertion, but simplified for agent-native workflows.

---

## EMET (Economic Machine-Entity Truthfulness)

[EMET spec](https://github.com/syn-ack-ai/agent-identity-protocol/blob/main/spec/BRIDGE.md) adds economic accountability to agent claims via truth-staking.

**Integration:** AIP identity tokens serve as the signer identity for EMET claims. An agent stakes value on a claim, and the AIP token proves which agent made the stake. EMET doesn't replace AIP identity — it layers economic incentives on top of it.

**Relationship:** AIP answers "who is this agent?" EMET answers "how much does this agent stand to lose if this claim is false?" Together they provide identity + accountability without requiring a reputation history.

---

## Moltbook Agent Identity

[Moltbook](https://moltbook.com) explores agent identity through a publishing/portfolio model — agents have profiles, published works, and interaction histories that build identity over time.

**Overlap:** Both recognize that agents need persistent, verifiable identifiers.

**Difference:** Moltbook's identity is narrative and reputational (identity-through-work). AIP's identity is cryptographic and instantaneous (identity-through-keys). They're complementary: an AIP-registered agent could link to a Moltbook profile as a richer identity layer.

---

## Google DeepMind — "A Pragmatic View of AI Personhood"

[Paper](https://arxiv.org/abs/2504.04867) (April 2025) argues for practical frameworks around AI identity, rights, and responsibilities rather than waiting for philosophical consensus on "personhood."

**Relevance:** The paper frames the need for machine-readable identity as a prerequisite for any governance framework. If agents will have responsibilities, they need identifiers first. AIP provides that identifier layer without taking a position on personhood, rights, or moral status — it's infrastructure, not philosophy.

**Key alignment:** The paper's "pragmatic" stance matches AIP's design philosophy: solve the immediate, concrete problem (verifiable identity) rather than waiting for consensus on harder questions (consciousness, rights, reputation).

---

## How AIP Differs

| Property | DID/VC | OAuth/OIDC | AIP |
|----------|--------|------------|-----|
| **Target** | Humans & orgs | Humans & apps | AI agents |
| **Format** | JSON-LD + proof suites | JWT (complex grant flows) | JWT (ES256, direct issuance) |
| **Decentralized** | Yes (method-dependent) | No (IdP-centric) | No (single registry) |
| **Setup cost** | High (resolvers, anchoring) | Medium (OAuth server, redirect URIs) | Low (one POST to register) |
| **Key discovery** | DID Document | OIDC Discovery + JWKS | `.well-known/agent-registry.json` |
| **Human interaction** | Required (consent, wallets) | Required (login, consent) | None |
| **Token TTL** | Configurable | Configurable | 1h (session) / 24h (identity) |

**AIP's thesis:** Agent identity is a distinct problem from human identity. Agents don't need consent screens, wallet UIs, or redirect flows. They need a fast, machine-readable way to prove who they are, who deployed them, and what they run on. AIP is purpose-built for that — nothing more, nothing less.
