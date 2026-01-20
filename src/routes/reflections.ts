import { Hono } from 'hono';
import { db } from '../db';
import { reflections, students } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

const app = new Hono();

// POST Create Reflection
// Header: X-Student-ID
// Body: { content, mood, topic? }
app.post('/', async (c) => {
    const studentId = c.req.header('X-Student-ID');
    if (!studentId) return c.json({ error: 'Unauthorized' }, 401);

    try {
        const body = await c.req.json();

        const [newReflection] = await db.insert(reflections).values({
            student_id: studentId,
            content: body.content,
            mood: body.mood,
            topic: body.topic
        }).returning();

        return c.json(newReflection, 201);
    } catch (e: any) {
        console.error(e);
        return c.json({ error: e.message || String(e) }, 500);
    }
});

// GET My Reflections
// Header: X-Student-ID
app.get('/my-reflections', async (c) => {
    const studentId = c.req.header('X-Student-ID');
    if (!studentId) return c.json({ error: 'Unauthorized' }, 401);

    try {
        const result = await db.query.reflections.findMany({
            where: eq(reflections.student_id, studentId),
            orderBy: [desc(reflections.created_at)]
        });
        return c.json(result);
    } catch (e: any) {
        console.error(e);
        return c.json({ error: e.message || String(e) }, 500);
    }
});

// GET All Reflections (Admin)
// Optional Query: ?student_id=UUID
app.get('/', async (c) => {
    const studentId = c.req.query('student_id');
    try {
        const result = await db.query.reflections.findMany({
            where: studentId ? eq(reflections.student_id, studentId) : undefined,
            with: {
                student: {
                    columns: {
                        full_name: true,
                        grade_level: true,
                        major: true
                    }
                }
            },
            orderBy: [desc(reflections.created_at)]
        });
        return c.json(result);
    } catch (e: any) {
        console.error(e);
        return c.json({ error: e.message || String(e) }, 500);
    }
});

export default app;
