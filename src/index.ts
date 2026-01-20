import { Hono } from 'hono';
import { cors } from 'hono/cors';
import studentsRoute from './routes/students';
import materialsRoute from './routes/materials';
import quizRoute from './routes/quiz';
import questionsRoute from './routes/questions';
import leaderboardRoute from './routes/leaderboard';
import announcementsRoute from './routes/announcements';
import discussionsRoute from './routes/discussions';
import cohortsRoute from './routes/cohorts';
import assignmentsRoute from './routes/assignments';
import reflectionsRoute from './routes/reflections';
import analyticsRoute from './routes/analytics';
import badgesRoute from './routes/badges';
import gradingRoute from './routes/grading';

const app = new Hono();

// --- AUTO MIGRATION FOR POLLS (Temporary Fix) ---
import { Database } from 'bun:sqlite';
try {
    const migrateDb = new Database('sqlite.db');
    console.log("Running Auto-Migration for Polls...");

    // 1. Add poll_options
    try {
        migrateDb.run("ALTER TABLE posts ADD COLUMN poll_options TEXT");
        console.log("✅ Added poll_options column");
    } catch (e: any) {
        // Ignore duplicate column error
    }

    // 2. Add poll_votes table
    migrateDb.run(`
        CREATE TABLE IF NOT EXISTS poll_votes (
            id TEXT PRIMARY KEY,
            post_id TEXT NOT NULL,
            student_id TEXT NOT NULL,
            option_index INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        )
    `);
    console.log("✅ Verified poll_votes table");

    migrateDb.close();
} catch (e) {
    console.error("Migration error:", e);
}
// ------------------------------------------------


app.use('/*', cors({
    origin: (origin) => {
        return origin.startsWith('http://localhost:') ? origin : 'http://localhost:9001';
    },
    allowHeaders: ['Content-Type', 'Authorization', 'X-Student-ID'],
    allowMethods: ['POST', 'GET', 'OPTIONS', 'DELETE', 'PUT'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
}));

app.get('/', (c) => {
    return c.text('Hello Micro-Learning API!');
});

app.route('/students', studentsRoute);
app.route('/materials', materialsRoute);
app.route('/quizzes', quizRoute);
app.route('/questions', questionsRoute);
app.route('/leaderboard', leaderboardRoute);
app.route('/announcements', announcementsRoute);
app.route('/discussions', discussionsRoute);
app.route('/cohorts', cohortsRoute);
app.route('/assignments', assignmentsRoute);
app.route('/reflections', reflectionsRoute);
app.route('/analytics', analyticsRoute);
app.route('/badges', badgesRoute);
app.route('/grading', gradingRoute);

// Strict /submit-quiz endpoint as requested
app.post('/submit-quiz', async (c) => {
    return c.redirect('/quizzes/submit-quiz', 307);
});

export default app;
