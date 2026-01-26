import { Hono } from 'hono';
import { db } from '../db';
import { cohorts, cohort_members, students } from '../db/schema';
import { eq } from 'drizzle-orm';

const app = new Hono();

// GET all cohorts
app.get('/', async (c) => {
    try {
        const createdBy = c.req.query('created_by');
        const result = await db.query.cohorts.findMany({
            where: createdBy ? eq(cohorts.created_by, createdBy) : undefined,
            with: {
                members: {
                    with: {
                        student: true
                    }
                }
            }
        });
        return c.json(result);
    } catch (e) {
        return c.json({ error: e }, 500);
    }
});

// POST create cohort
app.post('/', async (c) => {
    try {
        const body = await c.req.json();
        const [newItem] = await db.insert(cohorts).values({
            name: body.name,
            description: body.description,
            created_by: body.created_by,
        }).returning();
        return c.json(newItem, 201);
    } catch (e) {
        return c.json({ error: e }, 500);
    }
});

// POST add members to cohort
// Body: { student_ids: ["id1", "id2"] }
app.post('/:id/members', async (c) => {
    const cohortId = c.req.param('id');
    try {
        const body = await c.req.json();
        const studentIds = body.student_ids; // Array of IDs

        if (!Array.isArray(studentIds)) {
            return c.json({ error: 'student_ids must be an array' }, 400);
        }

        await db.delete(cohort_members).where(eq(cohort_members.cohort_id, cohortId));

        if (studentIds.length > 0) {
            const values = studentIds.map(sid => ({
                cohort_id: cohortId,
                student_id: sid
            }));
            await db.insert(cohort_members).values(values);
        }

        return c.json({ success: true });
    } catch (e) {
        console.error(e);
        return c.json({ error: e }, 500);
    }
});

// DELETE cohort
app.delete('/:id', async (c) => {
    try {
        const id = c.req.param('id');
        await db.delete(cohorts).where(eq(cohorts.id, id));
        return c.json({ success: true });
    } catch (e) {
        return c.json({ error: e }, 500);
    }
});

export default app;
