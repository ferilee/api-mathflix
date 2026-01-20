import { Database } from 'bun:sqlite';

const db = new Database("sqlite.db");

console.log("Creating badge tables...");

try {
    db.run(`
    CREATE TABLE IF NOT EXISTS badges (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT NOT NULL,
      criteria_type TEXT NOT NULL,
      criteria_value INTEGER NOT NULL
    );
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS student_badges (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      badge_id TEXT NOT NULL,
      earned_at INTEGER NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE
    );
  `);

    console.log("Tables created. Seeding badges...");

    // Seed Data
    const badges = [
        { id: 'b_first_quiz', name: 'First Step', description: 'Selesaikan kuis pertamamu', icon: '🐣', type: 'count_quiz', val: 1 },
        { id: 'b_high_score', name: 'High Achiever', description: 'Dapatkan nilai 100 di kuis', icon: '🏆', type: 'score', val: 100 },
        { id: 'b_active_reflect', name: 'Reflective Mind', description: 'Tulis 3 jurnal refleksi', icon: '🧠', type: 'count_reflection', val: 3 },
        { id: 'b_quiz_master', name: 'Quiz Master', description: 'Selesaikan 5 kuis', icon: '🎓', type: 'count_quiz', val: 5 }
    ];

    const stmt = db.prepare("INSERT OR IGNORE INTO badges (id, name, description, icon, criteria_type, criteria_value) VALUES (?, ?, ?, ?, ?, ?)");

    for (const b of badges) {
        stmt.run(b.id, b.name, b.description, b.icon, b.type, b.val);
    }

    console.log("Badges seeded successfully.");

} catch (error) {
    console.error("Error:", error);
}
