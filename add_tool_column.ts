import { Database } from 'bun:sqlite';

const db = new Database("sqlite.db");

console.log("Adding columns to materials table...");
try {
    db.run("ALTER TABLE materials ADD COLUMN embedded_tool_url TEXT");
    db.run("ALTER TABLE materials ADD COLUMN tool_type TEXT");
    console.log("Columns added successfully.");
} catch (error) {
    // Ignore if columns already exist (ignoring duplicate column error)
    console.log("Note: " + error);
}
