CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  certificate_number TEXT NOT NULL UNIQUE,
  public_token TEXT NOT NULL UNIQUE,
  result_id INTEGER NOT NULL UNIQUE REFERENCES results(id) ON DELETE CASCADE,
  attempt_id INTEGER NOT NULL UNIQUE REFERENCES exam_attempts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  email_sent_at TEXT,
  email_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id,issued_at);
CREATE INDEX IF NOT EXISTS idx_certificates_exam ON certificates(exam_id,issued_at);
