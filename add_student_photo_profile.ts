import { Database } from 'bun:sqlite';

const dbPath = process.env.DB_PATH || '../API-Mathflix-update/sqlite.db';
const db = new Database(dbPath, { create: true, readonly: false });

try {
  db.run("ALTER TABLE students ADD COLUMN photo_profile TEXT");
  console.log('Added students.photo_profile column');
} catch (e: any) {
  if (e.message && e.message.includes('duplicate column name')) {
    console.log('students.photo_profile already exists');
  } else {
    console.error('Failed to add students.photo_profile:', e);
  }
}
