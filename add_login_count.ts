import { Database } from "bun:sqlite";

const db = new Database("../API-Mathflix-update/sqlite.db", {
  create: true,
  readonly: false,
});

try {
  db.run("ALTER TABLE students ADD COLUMN login_count INTEGER DEFAULT 0");
  console.log("Added students.login_count column");
} catch (e: any) {
  if (e.message && e.message.includes("duplicate column name")) {
    console.log("students.login_count already exists");
  } else {
    console.error("Failed to add students.login_count:", e);
  }
}

try {
  db.run("ALTER TABLE teachers ADD COLUMN login_count INTEGER DEFAULT 0");
  console.log("Added teachers.login_count column");
} catch (e: any) {
  if (e.message && e.message.includes("duplicate column name")) {
    console.log("teachers.login_count already exists");
  } else {
    console.error("Failed to add teachers.login_count:", e);
  }
}
