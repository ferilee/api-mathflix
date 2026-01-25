import { Database } from 'bun:sqlite';

const db = new Database('../API-Mathflix-update/sqlite.db', { create: true, readonly: false });

const addColumn = (table: string, column: string, def: string) => {
  try {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
    console.log(`Added column ${table}.${column}`);
  } catch (e: any) {
    if (e.message && e.message.includes('duplicate column name')) {
      console.log(`Column ${table}.${column} already exists`);
    } else {
      console.error(`Failed to add column ${table}.${column}:`, e);
    }
  }
};

try {
  addColumn('materials', 'created_by', 'TEXT');
  addColumn('quizzes', 'created_by', 'TEXT');
  addColumn('announcements', 'created_by', 'TEXT');
  addColumn('assignments', 'created_by', 'TEXT');

  db.run(`CREATE TABLE IF NOT EXISTS teachers (
    id TEXT PRIMARY KEY,
    nip TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    school TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    summary TEXT,
    actor_id TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
  )`);

  console.log('Teachers and audit_logs tables ensured.');
} catch (e) {
  console.error('Migration error:', e);
}
