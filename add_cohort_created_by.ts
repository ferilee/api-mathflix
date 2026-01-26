import { Database } from 'bun:sqlite';

const db = new Database('../API-Mathflix-update/sqlite.db', { create: true, readonly: false });

try {
  db.run("ALTER TABLE cohorts ADD COLUMN created_by TEXT");
  console.log('Added cohorts.created_by column');
} catch (e: any) {
  if (e.message && e.message.includes('duplicate column name')) {
    console.log('cohorts.created_by already exists');
  } else {
    console.error('Failed to add cohorts.created_by:', e);
  }
}
