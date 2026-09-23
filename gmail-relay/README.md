# Free Gmail relay for Ahmed Finance

This tiny Google Apps Script sends Ahmed Finance login emails through your normal Gmail account. It is free, but consumer Gmail/App Script accounts currently have a 100 email-recipient/day MailApp quota. See Google's quota documentation for current limits.

## Setup

1. Open https://script.google.com/ and create a **New project**.
2. Copy `Code.gs` from this folder into the project.
3. Replace `CHANGE_ME_TO_A_LONG_RANDOM_TOKEN` with a long random secret. Keep it private.
4. Save the project. Run `testAuthorization` once and approve Gmail permission.
5. Deploy → New deployment → **Web app**.
6. Execute as: **Me** (the Gmail account that should send the emails).
7. Who has access: **Anyone**.
8. Copy the `/exec` Web app URL.
9. In the Ahmed Finance project run:

```bash
npx wrangler secret put GMAIL_APPS_SCRIPT_URL
npx wrangler secret put GMAIL_APPS_SCRIPT_TOKEN
```

For `GMAIL_APPS_SCRIPT_URL`, paste the `/exec` URL. For `GMAIL_APPS_SCRIPT_TOKEN`, use exactly the same token from `Code.gs`.

10. Deploy Ahmed Finance:

```bash
npm run deploy
```

The Admin portal's **Send access email** button sends the student's Student ID and portal link from your Gmail account. For security, the student's password is never sent by email. The Certificates page also supports **Email** to resend a certificate.

Do not put the token in the Admin frontend or in public files.
