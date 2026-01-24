import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { copyFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";

const dbPath = process.env.DB_PATH || "sqlite.db";
const seedPath = process.env.DB_SEED_PATH || "sqlite.db";

if (!existsSync(dbPath)) {
  if (seedPath !== dbPath && existsSync(seedPath)) {
    mkdirSync(dirname(dbPath), { recursive: true });
    copyFileSync(seedPath, dbPath);
  } else if (existsSync("/app/sqlite.db")) {
    mkdirSync(dirname(dbPath), { recursive: true });
    copyFileSync("/app/sqlite.db", dbPath);
  }
}

const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });
