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

const app = new Hono();

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

// Strict /submit-quiz endpoint as requested
app.post('/submit-quiz', async (c) => {
    return c.redirect('/quizzes/submit-quiz', 307);
});

export default app;
