import { Hono } from 'hono';
import { db } from '../db';
import { badges, student_badges, quiz_results, reflections } from '../db/schema';
import { eq, sql, and } from 'drizzle-orm';

const app = new Hono();

// GET My Badges
app.get('/my-badges', async (c) => {
    const studentId = c.req.header('X-Student-ID');
    if (!studentId) return c.json({ error: 'Unauthorized' }, 401);

    try {
        const myBadges = await db.query.student_badges.findMany({
            where: eq(student_badges.student_id, studentId),
            with: {
                badge: true
            },
            orderBy: (student_badges, { desc }) => [desc(student_badges.earned_at)]
        });

        return c.json(myBadges.map(sb => ({
            ...sb.badge,
            earned_at: sb.earned_at
        })));
    } catch (e: any) {
        return c.json({ error: e.message || String(e) }, 500);
    }
});

// POST Check for New Badges
// Can be called after quiz submit or reflection submit
app.post('/check', async (c) => {
    const studentId = c.req.header('X-Student-ID');
    if (!studentId) return c.json({ error: 'Unauthorized' }, 401);

    const newBadges: any[] = [];

    try {
        // Get all available badges
        const allBadges = await db.select().from(badges);

        // Get already earned badges
        const earned = await db.query.student_badges.findMany({
            where: eq(student_badges.student_id, studentId)
        });
        const earnedIds = new Set(earned.map(e => e.badge_id));

        // Gather metrics
        const quizCountRes = await db.select({ count: sql<number>`count(*)` }).from(quiz_results).where(eq(quiz_results.student_id, studentId));
        const quizCount = quizCountRes[0]?.count || 0;

        const reflectionCountRes = await db.select({ count: sql<number>`count(*)` }).from(reflections).where(eq(reflections.student_id, studentId));
        const reflectionCount = reflectionCountRes[0]?.count || 0;

        const maxScoreRes = await db.select({ max: sql<number>`max(${quiz_results.score})` }).from(quiz_results).where(eq(quiz_results.student_id, studentId));
        const maxScore = maxScoreRes[0]?.max || 0;

        // Check Loop
        for (const b of allBadges) {
            if (earnedIds.has(b.id)) continue;

            let qualified = false;

            if (b.criteria_type === 'count_quiz' && quizCount >= b.criteria_value) qualified = true;
            if (b.criteria_type === 'count_reflection' && reflectionCount >= b.criteria_value) qualified = true;
            if (b.criteria_type === 'score' && maxScore >= b.criteria_value) qualified = true;

            if (qualified) {
                // Award Badge
                await db.insert(student_badges).values({
                    student_id: studentId,
                    badge_id: b.id
                });
                newBadges.push(b);
            }
        }

        return c.json({ new_badges: newBadges });

    } catch (e: any) {
        console.error(e);
        return c.json({ error: e.message || String(e) }, 500);
    }
});

export default app;
