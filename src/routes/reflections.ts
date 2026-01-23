import { Hono } from 'hono';
import { db } from '../db';
import { reflections, students } from '../db/schema';
import { and, desc, eq, inArray } from 'drizzle-orm';

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


// GET Latest Reflections for Student IDs
// Query: ?student_ids=UUID,UUID
app.get('/latest', async (c) => {
    const raw = c.req.query('student_ids') || '';
    const studentIds = raw.split(',').map((id) => id.trim()).filter(Boolean);

    if (studentIds.length === 0) {
        return c.json([]);
    }

    const rows = await db.select()
        .from(reflections)
        .where(inArray(reflections.student_id, studentIds))
        .orderBy(desc(reflections.created_at));

    const latestMap = new Map();
    for (const row of rows) {
        if (!latestMap.has(row.student_id)) {
            latestMap.set(row.student_id, row);
        }
    }

    return c.json(Array.from(latestMap.values()));
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


// DELETE Reflection
// Optional Header: X-Student-ID (if set, only allows deleting own reflection)
app.delete('/:id', async (c) => {
    const reflectionId = c.req.param('id');
    const studentId = c.req.header('X-Student-ID');

    try {
        const whereClause = studentId
            ? and(eq(reflections.id, reflectionId), eq(reflections.student_id, studentId))
            : eq(reflections.id, reflectionId);

        const deleted = await db.delete(reflections).where(whereClause).returning();
        if (!deleted || deleted.length === 0) {
            return c.json({ error: 'Reflection not found' }, 404);
        }

        return c.json({ success: true });
    } catch (e: any) {
        console.error(e);
        return c.json({ error: e.message || String(e) }, 500);
    }
});

export default app;
