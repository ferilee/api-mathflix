import { Database } from 'bun:sqlite';

const db = new Database('../API-Mathflix-update/sqlite.db', { create: true, readonly: false });

try {
  db.run("ALTER TABLE students ADD COLUMN class_name TEXT DEFAULT ''");
  console.log('Added students.class_name column');
} catch (e: any) {
  if (e.message && e.message.includes('duplicate column name')) {
    console.log('students.class_name already exists');
  } else {
    console.error('Failed to add students.class_name:', e);
  }
}
