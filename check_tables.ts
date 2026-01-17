
import { Database } from 'bun:sqlite';

const db = new Database("sqlite.db");
const query = db.query("SELECT name FROM sqlite_master WHERE type='table'");
const tables = query.all();
console.log("Tables:", tables.map(t => t.name));
