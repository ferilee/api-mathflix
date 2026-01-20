import { Database } from 'bun:sqlite';

const db = new Database('../API-Mathflix-update/sqlite.db');

try {
    console.log("Adding style column to quizzes table...");
    db.run("ALTER TABLE quizzes ADD COLUMN style TEXT DEFAULT 'millionaire'");
    console.log("Success.");
} catch (e: any) {
    if (e.message.includes("duplicate column name")) {
        console.log("Column already exists.");
    } else {
        console.error("Error:", e);
    }
}
