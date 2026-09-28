-- Allow multiple completed attempts for the same student/exam.
--
-- The original exam_attempts table used:
--   UNIQUE(exam_id, user_id, status)
-- This accidentally prevented a second submitted attempt because changing
-- a new attempt from in_progress -> submitted collided with the previous
-- submitted attempt.
--
-- Retake behavior should instead allow any number of submitted/expired
-- attempts while allowing at most one in_progress attempt at a time.

PRAGMA foreign_keys=OFF;

CREATE TABLE exam_attempts_retake_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','submitted','expired'))
);

INSERT INTO exam_attempts_retake_v2 (
  id, exam_id, user_id, started_at, submitted_at, status
)
SELECT
  id, exam_id, user_id, started_at, submitted_at, status
FROM exam_attempts;

DROP TABLE exam_attempts;
ALTER TABLE exam_attempts_retake_v2 RENAME TO exam_attempts;

CREATE INDEX IF NOT EXISTS idx_attempts_user
  ON exam_attempts(user_id, started_at);

CREATE INDEX IF NOT EXISTS idx_attempts_exam_user
  ON exam_attempts(exam_id, user_id, id);

-- Only one active attempt may exist for a student/exam at a time.
-- Completed/expired attempts are intentionally not unique.
CREATE UNIQUE INDEX IF NOT EXISTS idx_attempts_one_in_progress
  ON exam_attempts(exam_id, user_id)
  WHERE status='in_progress';

PRAGMA foreign_keys=ON;
