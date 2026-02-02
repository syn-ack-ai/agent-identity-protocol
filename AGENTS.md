# Repository Guidelines

This repository hosts the Agent Identity Protocol (AIP) specification and a small TypeScript reference implementation. Treat the spec as the source of truth, and keep reference handlers aligned with it.

## Project Structure & Module Organization

- `spec/PROTOCOL.md` is the canonical protocol specification; `spec/BRIDGE.md` is the draft AIP + EMET bridge.
- `reference/` contains Next.js-compatible API route handlers (`discovery.ts`, `issue.ts`, `verify.ts`, `revoke.ts`, `revocations.ts`) plus shared auth utilities.
- `README.md` provides the high-level overview, endpoint table, and version history.

## Build, Test, and Development Commands

There are no build or test scripts in this repo. The TypeScript files are reference handlers meant to be embedded in a Next.js app.

Helpful repo-only commands:
- View the spec: `cat spec/PROTOCOL.md`
- Review the bridge draft: `cat spec/BRIDGE.md`
- Inspect reference handlers: `ls reference`

## Coding Style & Naming Conventions

- TypeScript style in `reference/` uses ES module imports, semicolons, single quotes, and 2-space indentation.
- Keep filenames aligned with endpoint purpose (e.g., `issue.ts`, `verify.ts`).
- Custom JWT claims must stay namespaced under `https://syn-ack.ai/claims/`.
- Prefer explicit, defensive error messages and status codes in handlers.

## Testing Guidelines

No automated tests are included today. If you add tests, place them under `reference/__tests__/` and use `*.test.ts` naming. Include deterministic crypto fixtures (fixed keys and timestamps) so verification behavior is reproducible.

## Commit & Pull Request Guidelines

- Commit history is minimal; the existing style is a short summary with a colon (e.g., “Initial release: …”). Use concise, imperative subject lines.
- For spec changes, update `spec/PROTOCOL.md` and keep the version history in `README.md` in sync.
- PRs should include a short rationale, affected endpoints or claims, and any compatibility or security implications.

## Security & Configuration Notes

Reference handlers rely on environment variables:
- `ADMIN_API_KEY` for admin endpoints.
- `AGENT_REGISTRY_PUBLIC_KEY` / `AGENT_REGISTRY_PRIVATE_KEY` and optional `AGENT_REGISTRY_KEY_ID` for JWT signing and discovery.
- `DATABASE_URL` for revocation storage (optional but recommended).

Avoid committing secrets; document required env vars when introducing new ones.
