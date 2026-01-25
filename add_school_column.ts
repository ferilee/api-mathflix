import { Database } from 'bun:sqlite';

const db = new Database('../API-Mathflix-update/sqlite.db', { create: true, readonly: false });

try {
  db.run("ALTER TABLE students ADD COLUMN school TEXT DEFAULT 'Unknown'");
  console.log('Added students.school column');
} catch (e: any) {
  if (e.message && e.message.includes('duplicate column name')) {
    console.log('students.school already exists');
  } else {
    console.error('Failed to add students.school:', e);
  }
}
