PRAGMA foreign_keys = OFF;

CREATE TABLE certificates_new (
  id TEXT PRIMARY KEY,
  certificate_number TEXT NOT NULL UNIQUE,
  verification_token TEXT NOT NULL UNIQUE,
  attempt_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  exam_id TEXT NOT NULL,
  score REAL NOT NULL,
  percentage REAL NOT NULL,
  title TEXT NOT NULL,
  issued_by TEXT,
  type TEXT,
  level TEXT,
  format TEXT,
  duration TEXT,
  description TEXT,
  skills TEXT,
  issued_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'valid',
  revoked_at TEXT,
  revocation_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (exam_id) REFERENCES exams(id)
);

INSERT INTO certificates_new (
  id,
  certificate_number,
  verification_token,
  attempt_id,
  user_id,
  exam_id,
  score,
  percentage,
  title,
  issued_by,
  type,
  level,
  format,
  duration,
  description,
  skills,
  issued_at,
  status,
  revoked_at,
  revocation_reason,
  created_at
)
SELECT
  id,
  certificate_number,
  verification_token,
  attempt_id,
  user_id,
  exam_id,
  score,
  percentage,
  title,
  issued_by,
  type,
  level,
  format,
  duration,
  description,
  skills,
  issued_at,
  status,
  revoked_at,
  revocation_reason,
  created_at
FROM certificates;

DROP TABLE certificates;

ALTER TABLE certificates_new RENAME TO certificates;

PRAGMA foreign_keys = ON;
