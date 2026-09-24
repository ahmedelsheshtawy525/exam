# Excam Certificate Gmail Relay

This relay sends certificate emails automatically from the Gmail account used to deploy the Apps Script web app.

## 1. Apps Script

Create a Google Apps Script project and paste `Code.gs`.
Replace:

`CHANGE_ME_TO_A_LONG_RANDOM_TOKEN`

with a long random token.

Deploy as a **Web app**:
- Execute as: **Me**
- Who has access: **Anyone**

Copy the `/exec` URL.

## 2. Cloudflare Worker secrets

Set these secrets:

- `GMAIL_APPS_SCRIPT_URL` = Apps Script `/exec` URL
- `GMAIL_APPS_SCRIPT_TOKEN` = the exact same token from `Code.gs`

The Worker sends the certificate email automatically after a passing exam creates a new certificate.

## 3. Behavior

The Worker sends one certificate email when a certificate is newly created. Refreshing the result page will not send duplicate certificate emails.


## Important after changing Code.gs

After editing `Code.gs`, create a **new deployment version** (Deploy → Manage deployments → Edit → New version). The Cloudflare Worker must use the `/exec` URL of the current Web App deployment.

Run `testAuthorization()` manually once from the Apps Script editor and approve Gmail/MailApp permissions.

## Certificate email retry behavior

The Worker stores `email_sent_at` and `email_error` in D1. A certificate is emailed only once after a successful send. If a previous attempt failed, opening the result again retries the delivery. Certificates created before email configuration can therefore be emailed after the relay is fixed.

Apply the new D1 migration before deploying the Worker:

```bash
npx wrangler d1 migrations apply DB --remote
npm run deploy
```
