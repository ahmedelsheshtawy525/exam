# Certificates & Email — current implementation

The platform now uses its native D1 certificate layer. Certificate records are created automatically when a student passes an exam.

## Included

- Automatic certificate issuance after a passing result.
- Unique certificate ID / number such as `AE-2026-XXXXXXXX`.
- Public printable certificate page at `/certificate/<certificate-id>`.
- Student **My certificates** portal with public verification links.
- Admin → **Certificates** with Open + Email actions.
- Certificate email delivery through Gmail relay, with Resend as a fallback.
- Admin → Students → Manage → **Send access email**.
- Access emails contain the Student ID and portal link; passwords are never emailed.
- Certificate data is stored as a snapshot, so later exam changes do not rewrite an already-issued certificate.

## Email setup

### Gmail relay

From `gmail-relay/README.md`:

1. Create a Google Apps Script web app.
2. Put a long random token in `gmail-relay/Code.gs`.
3. Authorize `MailApp` by running `testAuthorization` once.
4. Deploy the script as a Web App, executing as your account and allowing access to anyone.
5. Add the resulting `/exec` URL and the same token as Cloudflare Worker secrets:

```bash
npx wrangler secret put GMAIL_APPS_SCRIPT_URL
npx wrangler secret put GMAIL_APPS_SCRIPT_TOKEN
```

### Optional Resend fallback

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RESEND_FROM_EMAIL
```

The worker tries Gmail first and falls back to Resend.

## Deploy

```bash
npx wrangler d1 migrations apply DB --remote
npm run deploy
```

## Verification checklist

1. Pass an exam as a test student.
2. Confirm the result page shows the certificate.
3. Open the public certificate URL in an incognito/private window.
4. Confirm the certificate page prints cleanly.
5. Confirm the certificate email arrives.
6. In Admin → Certificates, click **Email** and verify resend works.
7. In Admin → Students → Manage, click **Send access email** and verify the student receives their Student ID and portal link.
