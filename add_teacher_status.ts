import { Database } from 'bun:sqlite';

const db = new Database('../API-Mathflix-update/sqlite.db', { create: true, readonly: false });

try {
  db.run("ALTER TABLE teachers ADD COLUMN status TEXT DEFAULT 'approved'");
  console.log('Added teachers.status column');
} catch (e: any) {
  if (e.message && e.message.includes('duplicate column name')) {
    console.log('teachers.status already exists');
  } else {
    console.error('Failed to add teachers.status:', e);
  }
}

try {
  db.run("UPDATE teachers SET status = 'approved' WHERE status IS NULL OR status = ''");
  console.log('Backfilled teachers.status');
} catch (e: any) {
  console.error('Failed to backfill teachers.status:', e);
}
