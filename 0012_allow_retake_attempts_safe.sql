-- SAFE RETAKE FIX
-- Preserves all existing exam_attempts, answers and results.
-- Does NOT modify or delete certificates.
-- Rebuilds only the three tables affected by the old UNIQUE constraint:
-- exam_attempts, answers, results.

PRAGMA foreign_keys=OFF;

ALTER TABLE results RENAME TO results_retake_backup;
ALTER TABLE answers RENAME TO answers_retake_backup;
ALTER TABLE exam_attempts RENAME TO exam_attempts_retake_backup;

CREATE TABLE exam_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK(status IN ('in_progress','submitted','expired'))
);

INSERT INTO exam_attempts (
  id, exam_id, user_id, started_at, submitted_at, status
)
SELECT
  id, exam_id, user_id, started_at, submitted_at, status
FROM exam_attempts_retake_backup;

CREATE TABLE answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_answer TEXT CHECK(selected_answer IN ('A','B','C','D') OR selected_answer IS NULL),
  is_correct INTEGER NOT NULL DEFAULT 0 CHECK(is_correct IN (0,1)),
  points_earned REAL NOT NULL DEFAULT 0,
  UNIQUE(attempt_id,question_id)
);

INSERT INTO answers (
  id, attempt_id, question_id, selected_answer, is_correct, points_earned
)
SELECT
  id, attempt_id, question_id, selected_answer, is_correct, points_earned
FROM answers_retake_backup;

CREATE TABLE results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL UNIQUE REFERENCES exam_attempts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  score REAL NOT NULL,
  total_points REAL NOT NULL,
  percentage REAL NOT NULL,
  passed INTEGER NOT NULL CHECK(passed IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO results (
  id, attempt_id, user_id, exam_id, score, total_points,
  percentage, passed, created_at
)
SELECT
  id, attempt_id, user_id, exam_id, score, total_points,
  percentage, passed, created_at
FROM results_retake_backup;

DROP TABLE results_retake_backup;
DROP TABLE answers_retake_backup;
DROP TABLE exam_attempts_retake_backup;

CREATE INDEX IF NOT EXISTS idx_attempts_user
ON exam_attempts(user_id,started_at);

CREATE INDEX IF NOT EXISTS idx_results_user
ON results(user_id,created_at);

CREATE INDEX IF NOT EXISTS idx_results_exam
ON results(exam_id,created_at);

-- The only uniqueness rule we need is one active attempt at a time.
-- Submitted/expired attempts may repeat indefinitely.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_in_progress_attempt
ON exam_attempts(exam_id,user_id)
WHERE status='in_progress';

PRAGMA foreign_keys=ON;
