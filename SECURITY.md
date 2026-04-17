# Security Policy

We take the security of Loomy seriously. This document describes how to report vulnerabilities and which versions receive security updates.

## Supported versions

Loomy is in active pre-1.0 development. Security fixes are applied to the latest `main` branch and the most recent tagged release.

| Version | Supported |
|---------|-----------|
| `main`  | ✅ |
| Latest tagged release | ✅ |
| Older tags | ❌ |

Self-hosted deployments should track the latest release and rotate secrets after upgrading.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities privately using one of the following channels:

1. **GitHub Security Advisories** — preferred. Open a draft advisory at <https://github.com/Devlaner/loomy/security/advisories/new>. This keeps the report private until a fix is published.
2. **Email** — send details to **fuadelizade6@gmail.com** with the subject line `[SECURITY] Loomy – <short summary>`.

Please include:

- A description of the vulnerability and its potential impact.
- Steps to reproduce, including a proof-of-concept if possible.
- The affected component (API, frontend, WebSocket, infra) and version or commit hash.
- Your suggested fix or mitigation, if any.
- Whether you would like to be credited publicly after disclosure.

## What to expect

| Stage | Target timeline |
|-------|-----------------|
| Acknowledgment of report | within **48 hours** |
| Initial assessment | within **5 business days** |
| Fix or mitigation | depends on severity — critical issues prioritized |
| Public disclosure | coordinated with the reporter once a fix is released |

We follow responsible-disclosure practices. We will not pursue legal action against researchers who act in good faith, stay within the scope described below, and give us reasonable time to remediate before public disclosure.

## Scope

**In scope:**

- The Loomy API (`api/app/`) — authentication, authorization, input validation, rate limiting, SQL injection, SSRF, JWT handling, WebSocket auth.
- The Loomy frontend (`apps/frontend/`) — XSS, token handling, CSRF, navigation-based leaks.
- Infrastructure defaults shipped in this repo (`docker-compose.yml`, Dockerfiles, example env files).

**Out of scope:**

- Vulnerabilities in third-party dependencies already tracked by upstream (please report those upstream and reference the CVE).
- Issues requiring a compromised host or physical device access.
- Missing security headers on endpoints that do not serve HTML.
- Social-engineering attacks or phishing of maintainers / users.
- Denial-of-service via trivial volumetric load against a self-hosted instance.

## Hardening recommendations for operators

When deploying Loomy in production:

- Set a strong, random `SECRET_KEY` (never leave the default `change-me-in-production`).
- Use managed PostgreSQL and Redis with TLS and authentication.
- Restrict `FRONTEND_URL` and CORS origins to your actual domains.
- Put the API behind a reverse proxy with TLS termination and request limits.
- Rotate OAuth client secrets and JWT signing keys periodically.
- Keep the Loomy image and its base images up to date.

## Disclosure history

No public advisories have been issued yet. Future advisories will be listed at <https://github.com/Devlaner/loomy/security/advisories>.
