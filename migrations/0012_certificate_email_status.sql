-- Track certificate email delivery so automatic issuance does not duplicate emails
-- and admins can resend emails for previously issued certificates.
ALTER TABLE certificates ADD COLUMN email_sent_at TEXT;
ALTER TABLE certificates ADD COLUMN email_last_error TEXT;
ALTER TABLE certificates ADD COLUMN email_attempts INTEGER NOT NULL DEFAULT 0;
