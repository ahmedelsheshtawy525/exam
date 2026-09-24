ALTER TABLE certificates ADD COLUMN email_sent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE certificates ADD COLUMN email_sent_at TEXT;
ALTER TABLE certificates ADD COLUMN email_error TEXT;
