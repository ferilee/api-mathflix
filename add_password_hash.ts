import { Database } from "bun:sqlite";

const db = new Database("../API-Mathflix-update/sqlite.db", {
  create: true,
  readonly: false,
});

try {
  db.run("ALTER TABLE students ADD COLUMN password_hash TEXT");
  console.log("Added students.password_hash column");
} catch (e: any) {
  if (e.message && e.message.includes("duplicate column name")) {
    console.log("students.password_hash already exists");
  } else {
    console.error("Failed to add students.password_hash:", e);
  }
}

try {
  db.run("ALTER TABLE teachers ADD COLUMN password_hash TEXT");
  console.log("Added teachers.password_hash column");
} catch (e: any) {
  if (e.message && e.message.includes("duplicate column name")) {
    console.log("teachers.password_hash already exists");
  } else {
    console.error("Failed to add teachers.password_hash:", e);
  }
}
