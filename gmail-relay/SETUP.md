# Excam Gmail Relay - Correct Setup

## 1. Google Apps Script

Create/open the Apps Script project and paste `Code.gs`.

### Script Property

In **Project Settings → Script Properties**, create:

- Property: `GMAIL_RELAY_TOKEN`
- Value: **the exact same long random token used by Cloudflare**

Do not put the token in `Code.gs`.

### Deploy

Deploy → New deployment → Web app:

- Execute as: **Me**
- Who has access: **Anyone**

Copy the URL ending in `/exec`.

## 2. Cloudflare Worker secrets

Set these secrets:

```text
GMAIL_APPS_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
GMAIL_APPS_SCRIPT_TOKEN=THE_SAME_TOKEN
```

The URL must be the current `/exec` URL of the deployed Web App, not the `/dev` URL.

## 3. Important: redeploy Apps Script after changing Code.gs

After changing `Code.gs`, create a new deployment/version or update the existing Web App deployment. Updating the editor code alone does not necessarily update the deployed Web App version.

## 4. What the fixed Worker now verifies

The Worker sends a POST request and requires all of the following:

- HTTP request succeeds.
- Response is valid JSON.
- `ok === true`.
- `sent >= 1`.

A Google `doGet()` health response can no longer be mistaken for a successful email send.

## 5. What the exam response now reports

When a new certificate is created, the result contains:

```json
"certificate": {
  "...": "...",
  "email": {
    "sent": true,
    "relayStatus": 200,
    "relaySent": 1
  }
}
```

If the certificate is created but the email fails, the certificate remains valid and the response contains the actual error under `certificate.email.error`.

## 6. Why redirects are handled this way

Google Apps Script Content Service may redirect responses to a `script.googleusercontent.com` URL. The Worker explicitly uses `redirect: "follow"`, which is required for Content Service responses.

Do not replace the `/exec` URL with a guessed `googleusercontent.com` URL.
