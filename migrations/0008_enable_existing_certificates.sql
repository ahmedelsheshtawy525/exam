-- Enable native certificate issuance for existing exams created before credentials were added.
UPDATE exams SET certificate_enabled = 1
WHERE certificate_enabled IS NULL OR certificate_enabled = 0;
