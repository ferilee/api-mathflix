import { Database } from 'bun:sqlite';

const db = new Database("sqlite.db");

console.log("Creating reflections table...");
try {
    db.run(`
    CREATE TABLE IF NOT EXISTS reflections (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      content TEXT NOT NULL,
      mood TEXT,
      topic TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );
  `);
    console.log("Reflections table created successfully.");
} catch (error) {
    console.error("Error creating table:", error);
}
