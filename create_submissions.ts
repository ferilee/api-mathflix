import { Database } from 'bun:sqlite';

const db = new Database("sqlite.db");

console.log("Creating assignment_submissions table...");

try {
    db.run(`
    CREATE TABLE IF NOT EXISTS assignment_submissions (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      submission_url TEXT,
      submission_note TEXT,
      submitted_at INTEGER NOT NULL,
      grade INTEGER,
      feedback TEXT,
      FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );
  `);

    console.log("Table created successfully.");

} catch (error) {
    console.error("Error:", error);
}
