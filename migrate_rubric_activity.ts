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

run("ALTER TABLE assignments ADD COLUMN rubric TEXT");
run("ALTER TABLE assignment_submissions ADD COLUMN rubric_scores TEXT");

run(`CREATE TABLE IF NOT EXISTS student_activity (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  material_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_seconds INTEGER,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
)`);

console.log('Migration complete.');
