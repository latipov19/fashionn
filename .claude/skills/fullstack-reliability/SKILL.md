---
name: fullstack-reliability
description: Deliver safe maintainable full-stack features, APIs, real-time behavior, persistence, auth and tests while preserving the existing stack.
---

# Full-Stack Reliability

## Inspect and protect
- Determine the actual backend entry point, imports, routes, database, schema, authentication, deployment and test setup before editing.
- Respect existing work and diffs; do not modify unrelated files, wipe local data, reset migrations, or silently rewrite architecture.
- Never read, print, copy, commit or expose secrets, credentials, private keys, .env files or *.pem contents. Treat user data as sensitive.
- Prefer an isolated test database. Do not run destructive migrations or test resets against production or personal data.

## Feature execution
1. Write the feature contract: inputs, outputs, permission checks, error cases, timeouts and invariants.
2. Update only necessary schema/API/server logic using existing style and dependencies.
3. Make authn/authz explicit and server-enforced, not client-trusted. Validate all inputs and sanitize output where relevant.
4. For WebSockets/Socket.IO, handle reconnects, stale clients, rooms, concurrent updates, and server-owned state.
5. Add tests for happy paths, boundary cases, invalid input, authorization, duplicates and failure recovery.
6. Connect frontend loading, optimistic, success, and error states honestly to the real API.

## Quality review
- Check idempotency, data races, N+1 queries, indexes, durable commits, timeouts and observable logs without secret leakage.
- Verify migrations/rollback considerations and compatibility with existing clients.
- Run targeted tests and report exact commands/results. If tests are not possible, say so and why.

## Output
Provide a concise change summary, API/data contract, tests and remaining risk. Avoid claiming production readiness without security and integration checks.
