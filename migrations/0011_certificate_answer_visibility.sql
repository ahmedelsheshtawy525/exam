-- Let each student decide whether submitted answers are public on the assessment page linked from their certificate.
ALTER TABLE certificates ADD COLUMN show_answers INTEGER NOT NULL DEFAULT 0;
