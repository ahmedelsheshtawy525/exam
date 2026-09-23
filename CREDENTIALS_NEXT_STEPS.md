# Native Credentials — v1

This version adds the first native credential layer to the FMVA exam platform. It does not use CredsVerse, Certifier, or any external certificate provider.

## What is included

- Per-exam credential settings in Admin → Exams → Edit.
- Automatic credential creation after a passing result.
- Unique certificate number such as `CERT-2026-XXXXXXXXXX`.
- Public verification page at `/verify/<certificate-number>`.
- Credential fields: title, issued by, type, level, format, duration, description, skills.
- Student result page gets an Open Certificate button and copy-link action.
- Admin → Certificates list with View, Revoke and Restore.
- Certificate data is snapshotted at issue time so later exam-setting edits do not rewrite old credentials.

## Deploy

Run from the project root:

```bash
npx wrangler d1 migrations apply DB --remote
npm run deploy
```

Do not change the database ID unless your current Cloudflare project uses a different D1 database. The project already declares the D1 binding as `DB`.

## Test after deployment

1. Open Admin → Exams.
2. Edit an exam.
3. Fill the Credential settings and save.
4. Use a test student and submit a passing attempt.
5. The result page should show **Open Certificate**.
6. Open the public `/verify/...` URL in an incognito window.
7. Open Admin → Certificates and verify the record exists.
8. Test Revoke and Restore.

## Not included yet

The next layer will add the polished printable PDF certificate, QR code, exam/answers share page, and Gmail relay delivery. Those should be added after this database/API layer is confirmed working.
