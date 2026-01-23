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

run("ALTER TABLE announcements ADD COLUMN target_all INTEGER DEFAULT 1");
run("ALTER TABLE announcements ADD COLUMN target_grades TEXT DEFAULT '[]'");
run("ALTER TABLE announcements ADD COLUMN target_majors TEXT DEFAULT '[]'");
run("ALTER TABLE announcements ADD COLUMN target_cohorts TEXT DEFAULT '[]'");
run("ALTER TABLE announcements ADD COLUMN attachments TEXT DEFAULT '[]'");
run("ALTER TABLE announcements ADD COLUMN is_pinned INTEGER DEFAULT 0");
run("ALTER TABLE announcements ADD COLUMN priority TEXT DEFAULT 'normal'");
run("ALTER TABLE announcements ADD COLUMN rubric TEXT");

run(`CREATE TABLE IF NOT EXISTS announcement_reads (
  id TEXT PRIMARY KEY,
  announcement_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  read_at INTEGER NOT NULL,
  FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
)`);

console.log('Migration complete.');
