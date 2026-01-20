import { Hono } from 'hono';
import { db } from '../db';
import { students, quiz_results, reflections, student_badges } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

const app = new Hono();

app.get('/', async (c) => {
    try {
        // Fetch all students with their related data
        // Using query builder for easier relation fetching
        // We use aggregation queries below for performance and correctness


        // Wait, I missed checking if studentsRelations has reflections and badges.
        // Step 92: studentsRelations only has quiz_results and cohorts!
        // I need to update schema.ts to include reflections and badges relations for students if I want to use db.query.students.findMany.
        // OR I can just use raw SQL or separate queries.

        // Let's update schema.ts first? No, I shouldn't modify schema unless necessary.
        // I can use a raw SQL query to aggregate.

        const result = await db.select({
            id: students.id,
            nisn: students.nisn,
            full_name: students.full_name,
            major: students.major,
            grade_level: students.grade_level,
            quiz_total: sql<number>`COALESCE(SUM(${quiz_results.score}), 0)`,
            quiz_count: sql<number>`COUNT(${quiz_results.id})`,
            // We can't easy doing multiple counts in one query with Left Joins due to Cartesian product
        }).from(students)
            .leftJoin(quiz_results, eq(students.id, quiz_results.student_id))
            .groupBy(students.id);

        // Complex aggregation in one query is tricky in ORM.
        // Let's do: Fetch Students. Then Fetch all aggregates grouped by student_id in parallel.

        const [studentsData, quizzesAgg, reflectionsAgg, badgesAgg] = await Promise.all([
            db.select().from(students),
            db.select({
                student_id: quiz_results.student_id,
                total: sql<number>`sum(${quiz_results.score})`,
                count: sql<number>`count(${quiz_results.id})`
            }).from(quiz_results).groupBy(quiz_results.student_id),
            db.select({
                student_id: reflections.student_id,
                count: sql<number>`count(${reflections.id})`
            }).from(reflections).groupBy(reflections.student_id),
            db.select({
                student_id: student_badges.student_id,
                count: sql<number>`count(${student_badges.id})`
            }).from(student_badges).groupBy(student_badges.student_id)
        ]);

        console.log("Students found:", studentsData.length);
        console.log("Quizzes Agg:", quizzesAgg);
        console.log("Reflections Agg:", reflectionsAgg);
        console.log("Badges Agg:", badgesAgg);

        // Map results
        const combined = studentsData.map(s => {
            const q = quizzesAgg.find(x => x.student_id === s.id) || { total: 0, count: 0 };
            const r = reflectionsAgg.find(x => x.student_id === s.id) || { count: 0 };
            const b = badgesAgg.find(x => x.student_id === s.id) || { count: 0 };

            const avg = q.count > 0 ? (q.total / q.count).toFixed(1) : 0;

            return {
                ...s,
                quiz_total: q.total || 0,
                quiz_avg: avg,
                reflection_count: r.count,
                badges_count: b.count
            };
        });

        console.log("Combined Data Sample:", combined[0]);

        return c.json(combined);

    } catch (e: any) {
        console.error(e);
        return c.json({ error: e.message }, 500);
    }
});

export default app;
