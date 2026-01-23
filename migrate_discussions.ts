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

run("ALTER TABLE posts ADD COLUMN category TEXT DEFAULT 'Umum'");
run("ALTER TABLE posts ADD COLUMN tags TEXT DEFAULT '[]'");
run("ALTER TABLE posts ADD COLUMN solved_comment_id TEXT");
run("ALTER TABLE posts ADD COLUMN last_activity_at INTEGER");
run("UPDATE posts SET last_activity_at = COALESCE(last_activity_at, created_at)");

run(`CREATE TABLE IF NOT EXISTS discussion_likes (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
)`);

run(`CREATE TABLE IF NOT EXISTS discussion_follows (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  last_read_at INTEGER NOT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
)`);

console.log('Migration complete.');
