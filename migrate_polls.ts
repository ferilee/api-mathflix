import Database from 'better-sqlite3';

const db = new Database('sqlite.db');

try {
    console.log("Migrating database for Polls...");

    // 1. Add poll_options to posts
    try {
        db.prepare("ALTER TABLE posts ADD COLUMN poll_options TEXT").run();
        console.log("✅ Added poll_options column to posts");
    } catch (e: any) {
        if (e.message.includes('duplicate column name')) {
            console.log("ℹ️ poll_options column already exists");
        } else {
            console.error("❌ Failed to add poll_options column:", e.message);
        }
    }

    // 2. Create poll_votes table
    try {
        db.prepare(`
            CREATE TABLE IF NOT EXISTS poll_votes (
                id TEXT PRIMARY KEY,
                post_id TEXT NOT NULL,
                student_id TEXT NOT NULL,
                option_index INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
            )
        `).run();
        console.log("✅ Created poll_votes table");
    } catch (e: any) {
        console.error("❌ Failed to create poll_votes table:", e.message);
    }

    console.log("Migration complete.");
} catch (error) {
    console.error("Migration failed:", error);
} finally {
    db.close();
}
