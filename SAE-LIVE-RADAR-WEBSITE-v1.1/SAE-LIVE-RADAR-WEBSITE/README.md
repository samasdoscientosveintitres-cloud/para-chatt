# SAE RADAR Website v1.1

Landing page, account registration/login, purchase entitlement tracking and a protected update-download endpoint for SAE RADAR.

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm start
```

Open `http://localhost:8080`.

For persistent local data, the app writes `data/users.json`. The account password is never stored in plain text: it is derived with Node's `scrypt` and a unique salt. Sessions are signed server-side and placed in an HttpOnly, SameSite=Lax cookie.

## Environment variables

Copy `.env.example` to `.env` and set independent random secrets:

- `SESSION_SECRET`: at least 32 random characters. Required in production; rotating it invalidates active sessions.
- `ADMIN_TOKEN`: at least 32 random characters. Used only for private admin endpoints.
- `DATA_DIR`: persistent directory for `users.json` and `inquiries.json`. On hosting, mount a persistent disk and point this variable to its mount path.
- `RADAR_DOWNLOAD_FILE`: absolute path to the current installer on the server. Keep installers outside `public/`; the download route checks the logged-in account's entitlement before streaming the file.
- `PRODUCT_VERSION`: version displayed by the account API.

Do not commit `.env`, `users.json`, purchase data, tokens, or installers to a public repository.

## Account and entitlement flow

- `POST /api/auth/register`: creates an account and signs in the new user.
- `POST /api/auth/login`: verifies the email/password and signs in.
- `GET /api/auth/me`: returns the current account and whether SAE RADAR access is recorded.
- `POST /api/auth/logout`: clears the session cookie.
- `POST /api/checkout`: requires a logged-in account. It deliberately returns `503 checkout_not_configured` until a payment provider and verified payment webhook are implemented. It does not collect card information or mark anyone as paid.
- `POST /api/admin/grant-access`: private manual entitlement grant. Requires `Authorization: Bearer ADMIN_TOKEN` and JSON `{ "email": "buyer@example.com" }`. This is intended for controlled manual testing or confirmed manual payments only.
- `GET /api/download/latest`: sends the installer only if the account has `hasAccess: true` and `RADAR_DOWNLOAD_FILE` is configured.

Example manual access grant (run from a trusted admin terminal only):

```bash
curl -X POST https://YOUR-DOMAIN/api/admin/grant-access \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"buyer@example.com"}'
```

There is intentionally no public endpoint that can grant access. The admin grant endpoint does not revoke access.

## Important production requirements before taking real payments

This version has account creation, login and server-side entitlement checks, but **payments are disabled**. The displayed US$4.99 is product-page pricing only; no money can be collected by this build. Do not tell customers they have paid or send them to an unconfigured checkout.

Before public sales, an adult responsible for the business/payment account should select and configure a payment provider, verify signed payment webhooks server-side, and grant access only after confirmed successful payment. Also add email verification, password recovery, a support contact, clear terms/refund policy and privacy notice. The current email-based account is not email-verified and has no self-service password reset.

For a production deployment, use a persistent disk or database for `DATA_DIR`. If the host's filesystem is ephemeral, accounts and purchase entitlements can disappear after a redeploy/restart. Back up account data securely.

## Tests

```bash
npm test
```

## Endpoints

- `GET /api/health`
- `GET /api/auth/me`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/checkout`
- `GET /api/download/latest`
- `POST /api/admin/grant-access`
