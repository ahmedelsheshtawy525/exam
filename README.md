
## V8.1 patch
- Added GET `/api/admin/exams/:id` compatibility endpoint to prevent 404s from cached/older admin UI flows.
- Added static app.js cache-busting query on admin.html.
# Ahmed Finance Exam Platform — Full MVP

A production-oriented exam platform built for Cloudflare Workers + Cloudflare D1, with a visual language aligned to the Ahmed Elsheshtawy finance portfolio: warm off-white surfaces, graphite text, orange accent, thin borders, quiet cards, generous spacing, and responsive layouts.

## Included

### Student
- Registration
- Automatic Student ID generation
- Secure login by Student ID or email
- Server-side session cookie
- Dashboard
- Active exam list
- Exam entry
- Server-enforced timer
- Multiple-choice questions
- Correct answers never sent to the student browser
- Submit + automatic grading
- Pass/fail result
- Personal result history

### Admin
- Secure admin login
- One-time bootstrap for first super admin
- Overview statistics
- Student search
- Student detail view
- Student ID visibility
- Block/activate students
- Create/edit/delete exams
- Activate/deactivate exams
- Set duration
- Set passing percentage
- Full question management
- Add/edit/delete questions
- Set correct answers
- Set points and order
- Results search
- Result detail with answer review
- Super-admin management of admin accounts

## Architecture

```text
Browser
  |
  v
Cloudflare Worker
  |-- Authentication / sessions
  |-- Authorization
  |-- Exam API
  |-- Grading API
  |-- Admin API
  |
  +--> Cloudflare D1 (SQLite)
  |
  +--> Static Assets (public/)
```

## Database

Tables:
- users
- admin_users
- exams
- questions
- exam_attempts
- answers
- results
- sessions

Passwords use PBKDF2-SHA-256 with a random salt. Sessions are opaque random IDs stored server-side and sent in Secure, HttpOnly, SameSite cookies.

## Setup

### 1. Install

```bash
npm install
```

### 2. Create D1

```bash
npx wrangler d1 create ahmed-finance-exam-db
```

Copy the returned database ID into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "ahmed-finance-exam-db"
database_id = "YOUR_DATABASE_ID"
migrations_dir = "migrations"
```

### 3. Apply migration

Remote:

```bash
npx wrangler d1 migrations apply DB --remote
```

Local development:

```bash
npm run db:migrate:local
```

### 4. Create the first super admin

Set a Wrangler secret:

```bash
npx wrangler secret put ADMIN_BOOTSTRAP_SECRET
```

Deploy first:

```bash
npm run deploy
```

Then call the one-time bootstrap endpoint from an authenticated API client:

```http
POST /api/setup/admin
x-bootstrap-secret: YOUR_BOOTSTRAP_SECRET
content-type: application/json

{
  "username": "admin",
  "password": "change-this-password"
}
```

The endpoint locks permanently after the first admin is created.

### 5. Deploy

```bash
npm run deploy
```

## Security notes

- Passwords are never stored in plain text.
- Correct answers are selected only on the server during grading.
- Admin APIs require an admin session.
- Student APIs require a student session.
- SQL uses D1 prepared statements and bound parameters.
- Exam duration is checked server-side during start and submission.
- Sessions are stored in D1, not localStorage.
- Frontend state is only UI state; authentication and grading are server-side.
- Origin checking is applied to API requests that provide an Origin header.

## Important deployment step

Do not commit the real D1 database ID or any bootstrap secret to a public repository if your repository is public. Use Wrangler secrets for sensitive values.

## Certificate / assessment review update

- Student dashboard now has a dedicated **Certificates** area.
- Each passed certificate has **View Certificate** and **View Exam** links.
- **View Exam** opens a separate `/exam-review/:resultId` page containing the saved questions, the student's answers, the correct answers, correctness state, and points.
- Public certificate verification pages were redesigned around the Ahmed Elsheshtawy black/off-white/orange visual identity.
- Printing the certificate uses a clean certificate-only layout; dashboard/verification details are hidden from print.
- The printed certificate includes a QR code that points to the public `/verify/:certificateNumber` URL.
- Passing an exam still issues the certificate immediately and automatically sends the certificate email in the background.
- Admin → Certificates can send/resend the email for any existing certificate, including certificates issued before this update.
- Email delivery status and the last error are stored on each certificate so failed sends can be diagnosed and retried.

### Email configuration

Email delivery uses Resend and is intentionally optional so certificate issuance is never blocked by email configuration.

Configure these Cloudflare Worker secrets/vars:

- `RESEND_API_KEY` — secret API key from Resend.
- `EMAIL_FROM` — verified sender, for example `Ahmed Elsheshtawy <certificates@your-verified-domain.com>`.

If these are not configured, the certificate is still issued normally; the email is skipped and the reason is recorded on the certificate. The Worker derives the public verification URL from the current Worker origin, so an `APP_ORIGIN` variable is not required for normal deployment.

The email is a full congratulatory certificate notice containing the student's name, completed assessment, score, issue date, certificate ID, verification guidance, and a branded **View Your Certificate** button.


## Gmail certificate email relay

1. Open Google Apps Script and create/deploy a Web App using `gmail-relay-Code.gs`.
2. Deploy as **Execute as: Me** and **Who has access: Anyone**. Use the `/exec` URL, not `/dev`.
3. In Apps Script → Project Settings → Script Properties, add `GMAIL_RELAY_TOKEN` with the exact same value as the Cloudflare secret `GMAIL_APPS_SCRIPT_TOKEN`.
4. In Cloudflare, set the Worker secrets: `GMAIL_APPS_SCRIPT_URL` and `GMAIL_APPS_SCRIPT_TOKEN`.
5. Deploy the Worker.
6. Run the included `testAuthorization()` in Apps Script once to confirm the relay token is configured.

The Worker requires the relay response to contain JSON `{ "ok": true, "sent": 1 }`; an HTTP 200 by itself is not treated as a successful send.

The admin Certificates screen supports **Send email / Resend email** for certificates that were already issued.
