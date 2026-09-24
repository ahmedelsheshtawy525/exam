-- Track certificate email delivery so emails are sent once, retried after failures,
-- and can be delivered for certificates created before the Gmail relay was configured.
ALTER TABLE certificates ADD COLUMN email_sent_at TEXT;
ALTER TABLE certificates ADD COLUMN email_error TEXT;
