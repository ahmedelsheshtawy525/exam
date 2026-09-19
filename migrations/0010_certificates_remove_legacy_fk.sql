-- Repair legacy certificate schema that may reference the old/non-existent
-- `attempts` table. The current platform uses `exam_attempts`.
-- The certificate table intentionally has no FK to attempts so certificate
-- issuance can never break an already-saved exam result.
PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS certificates_repaired_v2 (
  id TEXT NOT NULL PRIMARY KEY,
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
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO certificates_repaired_v2 (
  id, certificate_number, verification_token, attempt_id, user_id, exam_id,
  score, percentage, title, issued_by, type, level, format, duration,
  description, skills, issued_at, status, revoked_at, revocation_reason, created_at
)
SELECT
  CAST(id AS TEXT),
  certificate_number,
  verification_token,
  CAST(attempt_id AS TEXT),
  CAST(user_id AS TEXT),
  CAST(exam_id AS TEXT),
  score,
  percentage,
  title,
  issued_by,
  type,
  level,
  format,
  duration,
  description,
  COALESCE(skills, '[]'),
  issued_at,
  COALESCE(status, 'valid'),
  revoked_at,
  revocation_reason,
  COALESCE(created_at, CURRENT_TIMESTAMP)
FROM certificates;

DROP TABLE certificates;
ALTER TABLE certificates_repaired_v2 RENAME TO certificates;

CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id,issued_at);
CREATE INDEX IF NOT EXISTS idx_certificates_exam ON certificates(exam_id,issued_at);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status,issued_at);
PRAGMA foreign_keys=ON;
