# Security Policy for Match-Mind

## Reporting a Vulnerability

If you discover a security vulnerability in Match-Mind, please report it privately.

**How to report:**

- Open a private security advisory on GitHub (if this repository is public).
- Email **manojjana.0025@gmail.com** directly. This contact is also listed in our [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
- If neither channel works, open a standard issue with the label `security` without including exploit details.

**Expectations:**

- We will acknowledge receipt within 5 business days.
- We will provide an assessment and expected fix timeline within 10 business days.
- Please refrain from public disclosure until a fix is released.

## Security Measures

### Implemented

- **JWT authentication:** Access tokens are issued on login via `jsonwebtoken`, verified by `passport-jwt` middleware.
- **Google OAuth:** Federated identity via `passport-google-oauth20` and `google-auth-library`.
- **Password hashing:** bcryptjs (with salt rounds).
- **Security headers:** Helmet middleware sets secure HTTP headers (CSP, X-Frame-Options, etc.).
- **CORS:** Cross-origin resource sharing is configured for the frontend origin.
- **Cookie security:** `cookie-parser` with signed cookies.
- **Input validation:** Via Zod schemas and Prisma's type-safe query building.
- **Token refresh:** Refresh token mechanism to rotate access tokens.
- **Role-based access:** Admin and user roles with an admin route file for privileged operations.

### Not Implemented

- **No HTTPS enforcement:** TLS is not configured at the application level (should be handled by reverse proxy).
- **No rate limiting:** There is no built-in rate limiting on authentication endpoints.
- **No CSRF protection:** Not typically needed for token-based API auth, but should be considered for cookie-based flows.
- **No 2FA:** Two-factor authentication is not implemented.
- **No audit logging:** Sensitive operations are not logged to a dedicated audit trail.
- **No input sanitization beyond Zod:** Raw user input in certain fields (e.g., messages) may not be fully sanitized.

## Authentication & Authorization

### Authentication Methods

1. **JWT (primary):** Users register/login with email/password. JWT tokens are issued with expiry.
2. **Google OAuth:** Users can log in with their Google account via Passport.js.

### API Authentication

- Protected routes require an `Authorization: Bearer <token>` header.
- Tokens are verified by `passport-jwt` middleware.
- Token expiry is configurable via `JWT_EXPIRE_HOURS` or similar.

### Role Model

| Role  | Access                                              |
| ----- | --------------------------------------------------- |
| User  | Standard operations (predictions, leagues, profile) |
| Admin | System management via `/admin/*` routes             |

## External Service Security

| Service          | Data Transmitted               | Security Notes                                                                                             |
| ---------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Stripe**       | Payment details, customer info | Stripe handles PCI compliance. Use Stripe Elements or Stripe.js — never send raw card data to your server. |
| **Anthropic AI** | Match data, user queries       | Ensure no PII is sent to Anthropic. Review content before sending.                                         |
| **Google OAuth** | OAuth tokens, email, name      | Google manages OAuth security. Rotate client secrets if exposed.                                           |
| **Redis**        | Session data, job queue        | Redis should not be exposed to the public internet. Use password authentication.                           |
| **PostgreSQL**   | All application data           | Use SSL connections. Restrict network access. Use strong passwords.                                        |

## Environment Variables

| Variable                                    | Sensitivity  | Notes                                          |
| ------------------------------------------- | ------------ | ---------------------------------------------- |
| `DATABASE_URL`                              | **Critical** | PostgreSQL connection string with credentials. |
| `JWT_SECRET`                                | **Critical** | JWT signing secret. Use a strong random value. |
| `STRIPE_SECRET_KEY`                         | **Critical** | Stripe API secret. Rotate if compromised.      |
| `ANTHROPIC_API_KEY`                         | High         | AI API key with usage costs.                   |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | High         | OAuth credentials.                             |
| `REDIS_URL`                                 | High         | Redis connection string.                       |
| `SMTP_USER` / `SMTP_PASS`                   | Medium       | Email credentials.                             |

## Database Security

- **PostgreSQL:** All application data is stored in PostgreSQL via Prisma.
- **Connection security:** Use SSL/TLS for database connections in production.
- **No encryption at rest:** Database-level encryption is not configured at the application level.
- **Migration security:** Prisma migrations track schema changes. Review migrations before applying.

## Deployment Security

- **Frontend (Vercel):** Vercel handles HTTPS automatically. Environment variables are managed through Vercel's dashboard.
- **Backend (Docker Compose):** For production, use Docker Compose with restricted network settings or a container orchestration platform (Kubernetes, ECS).
- **Redis:** Ensure Redis is not exposed on public ports. Use `requirepass` and network isolation.
- **PostgreSQL:** Restrict database access to the application server only. Use firewall rules.

## Dependency Security

Regularly audit dependencies:

```bash
cd backend && npm audit
cd frontend && npm audit
```

Key packages to monitor:

- `express` — Keep updated for security patches.
- `@prisma/client` / `prisma` — Database layer vulnerabilities.
- `stripe` — Payment processing SDK.
- `@anthropic-ai/sdk` — AI API client.
- `passport-*` — Authentication middleware.
- `jsonwebtoken` — JWT implementation.
- `socket.io` — WebSocket library.
