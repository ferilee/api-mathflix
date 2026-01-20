import { Hono } from 'hono';
import { db } from '../db';
import { students, quiz_results, reflections, posts } from '../db/schema';
import { sql, desc, eq, lt } from 'drizzle-orm';

const app = new Hono();

app.get('/', async (c) => {
    try {
        // 1. Total Students
        const [studentCount] = await db.select({ count: sql<number>`count(*)` }).from(students);

        // 2. Average Quiz Score
        const [avgScoreResult] = await db.select({ avg: sql<number>`avg(${quiz_results.score})` }).from(quiz_results);
        const avgScore = avgScoreResult?.avg ? Math.round(avgScoreResult.avg * 10) / 10 : 0;

        // 3. Recent Reflections (Last 5)
        const recentReflections = await db.query.reflections.findMany({
            limit: 5,
            orderBy: [desc(reflections.created_at)],
            with: {
                student: {
                    columns: { full_name: true, grade_level: true, major: true }
                }
            }
        });

        // 4. Count Today's Journals
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Using gte with the Date object - Drizzle handles the mapping for 'timestamp' mode columns
        const [todayReflections] = await db.select({ count: sql<number>`count(*)` })
            .from(reflections)
            // Fix: Compare against timestamp integer
            .where(sql`${reflections.created_at} >= ${today.getTime()}`);

        // 5. At Risk Students (Avg Score < 60)
        // This is a bit complex in Drizzle without aggregation subqueries easily mapped.
        // For simple SQLite, we can fetch all results and process in JS (if dataset is small)
        // OR use a raw query. Let's try a raw query approach or Drizzle's sophisticated builder if possible.
        // Given simplicity, we'll fetch student averages.

        const allResults = await db.select({
            studentId: quiz_results.student_id,
            score: quiz_results.score,
            studentName: students.full_name
        })
            .from(quiz_results)
            .leftJoin(students, eq(quiz_results.student_id, students.id));

        const studentScores: Record<string, { total: number, count: number, name: string }> = {};
        allResults.forEach(r => {
            if (!r.studentId) return;
            // Safe access pattern
            if (!studentScores[r.studentId]) {
                studentScores[r.studentId] = { total: 0, count: 0, name: r.studentName || 'Unknown' };
            }
            const entry = studentScores[r.studentId];
            if (entry) {
                entry.total += r.score;
                entry.count++;
            }
        });

        const atRiskStudents = Object.values(studentScores)
            .map(s => ({ name: s.name, average: Math.round(s.total / s.count) }))
            .filter(s => s.average < 60);

        return c.json({
            total_students: studentCount?.count || 0,
            average_score: avgScore,
            today_reflections: todayReflections?.count || 0,
            recent_reflections: recentReflections,
            at_risk_students: atRiskStudents
        });

    } catch (e: any) {
        console.error(e);
        return c.json({ error: e.message || String(e) }, 500);
    }
});

export default app;
