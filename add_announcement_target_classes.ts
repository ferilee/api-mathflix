import { Database } from 'bun:sqlite';

const db = new Database('../API-Mathflix-update/sqlite.db', { create: true, readonly: false });

try {
  db.run("ALTER TABLE announcements ADD COLUMN target_classes TEXT DEFAULT '[]'");
  console.log('Added announcements.target_classes column');
} catch (e: any) {
  if (e.message && e.message.includes('duplicate column name')) {
    console.log('announcements.target_classes already exists');
  } else {
    console.error('Failed to add announcements.target_classes:', e);
  }
}
