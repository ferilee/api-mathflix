import { Database } from 'bun:sqlite';

const db = new Database('sqlite.db');

const run = (sql: string) => {
  try {
    db.run(sql);
    console.log('OK:', sql);
  } catch (e: any) {
    if (e?.message?.includes('duplicate column name')) {
      console.log('SKIP (column exists):', sql);
    } else if (e?.message?.includes('already exists')) {
      console.log('SKIP (table exists):', sql);
    } else {
      console.error('ERR:', sql, e);
    }
  }
};

run("ALTER TABLE quizzes ADD COLUMN use_bank INTEGER DEFAULT 0");
run("ALTER TABLE quizzes ADD COLUMN question_count INTEGER DEFAULT 10");
run("ALTER TABLE quizzes ADD COLUMN image_url TEXT");
run("ALTER TABLE quizzes ADD COLUMN difficulty_mix TEXT");
run("ALTER TABLE question_bank ADD COLUMN image_url TEXT");

run(`CREATE TABLE IF NOT EXISTS question_bank (
  id TEXT PRIMARY KEY,
  material_id TEXT,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL,
  options TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  tags TEXT,
  image_url TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE SET NULL
)`);
run(`CREATE TABLE IF NOT EXISTS question_results (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  is_correct INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
)`);

console.log('Migration complete.');
