ALTER TABLE exams ADD COLUMN certificate_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE exams ADD COLUMN certificate_title TEXT NOT NULL DEFAULT '';
ALTER TABLE exams ADD COLUMN certificate_issued_by TEXT NOT NULL DEFAULT 'Ahmed Elsheshtawy';
ALTER TABLE exams ADD COLUMN certificate_type TEXT NOT NULL DEFAULT 'Training';
ALTER TABLE exams ADD COLUMN certificate_level TEXT NOT NULL DEFAULT 'Intermediate';
ALTER TABLE exams ADD COLUMN certificate_format TEXT NOT NULL DEFAULT 'Online';
ALTER TABLE exams ADD COLUMN certificate_duration TEXT NOT NULL DEFAULT '';
ALTER TABLE exams ADD COLUMN certificate_description TEXT NOT NULL DEFAULT '';
ALTER TABLE exams ADD COLUMN certificate_skills_json TEXT NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  certificate_number TEXT NOT NULL UNIQUE,
  verification_token TEXT NOT NULL UNIQUE,
  attempt_id INTEGER NOT NULL UNIQUE REFERENCES exam_attempts(id) ON DELETE CASCADE,
  result_id INTEGER NOT NULL UNIQUE REFERENCES results(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_email TEXT NOT NULL,
  exam_title TEXT NOT NULL,
  score REAL NOT NULL,
  total_points REAL NOT NULL,
  percentage REAL NOT NULL,
  title TEXT NOT NULL,
  issued_by TEXT NOT NULL,
  type TEXT NOT NULL,
  level TEXT NOT NULL,
  format TEXT NOT NULL,
  duration TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  skills_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'valid' CHECK(status IN ('valid','revoked')),
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  revocation_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id,issued_at);
CREATE INDEX IF NOT EXISTS idx_certificates_exam ON certificates(exam_id,issued_at);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status,issued_at);
