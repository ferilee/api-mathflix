import { Hono } from 'hono';
import { db } from '../db';
import { quiz_results, students } from '../db/schema';
import { desc, eq, sql } from 'drizzle-orm';

const app = new Hono();

// GET /leaderboard - Get top students by total score
app.get('/', async (c) => {
    // Aggregating scores by student
    const leaderboard = await db
        .select({
            student_id: quiz_results.student_id,
            student_name: students.full_name,
            total_score: sql<number>`sum(${quiz_results.score})`.as('total_score')
        })
        .from(quiz_results)
        .leftJoin(students, eq(quiz_results.student_id, students.id))
        .groupBy(quiz_results.student_id)
        .orderBy(desc(sql`total_score`))
        .limit(10); // Top 10

    return c.json(leaderboard);
});

export default app;
