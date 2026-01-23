import { Hono } from 'hono';
import { db } from '../db';
import { student_activity, materials } from '../db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const app = new Hono();

const activitySchema = z.object({
    student_id: z.string().uuid(),
    material_id: z.string().uuid(),
    started_at: z.number().optional(),
    ended_at: z.number().optional(),
    duration_seconds: z.number().int().min(1).optional(),
});

// POST /activity - log a learning session
app.post('/', zValidator('json', activitySchema), async (c) => {
    const body = c.req.valid('json');
    const startedAt = body.started_at ? new Date(body.started_at) : new Date();
    const endedAt = body.ended_at ? new Date(body.ended_at) : new Date();
    const durationSeconds =
        body.duration_seconds ??
        Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));

    const [row] = await db
        .insert(student_activity)
        .values({
            student_id: body.student_id,
            material_id: body.material_id,
            started_at: startedAt,
            ended_at: endedAt,
            duration_seconds: durationSeconds,
        })
        .returning();

    return c.json(row, 201);
});


// GET /activity?student_id=...&limit=20
app.get('/', async (c) => {
    const studentId = c.req.query('student_id');
    const limit = Number(c.req.query('limit')) || 20;

    if (!studentId) {
        return c.json({ error: 'student_id is required' }, 400);
    }

    const rows = await db
        .select({
            id: student_activity.id,
            student_id: student_activity.student_id,
            material_id: student_activity.material_id,
            started_at: student_activity.started_at,
            ended_at: student_activity.ended_at,
            duration_seconds: student_activity.duration_seconds,
            material_title: materials.title,
        })
        .from(student_activity)
        .leftJoin(materials, eq(student_activity.material_id, materials.id))
        .where(eq(student_activity.student_id, studentId))
        .orderBy(desc(student_activity.ended_at))
        .limit(limit);

    return c.json(rows);
});
// GET /activity/latest?student_ids=ID1,ID2
app.get('/latest', async (c) => {
    const raw = c.req.query('student_ids') || '';
    const studentIds = raw.split(',').map((id) => id.trim()).filter(Boolean);

    if (studentIds.length === 0) {
        return c.json([]);
    }

    const rows = await db
        .select({
            id: student_activity.id,
            student_id: student_activity.student_id,
            material_id: student_activity.material_id,
            started_at: student_activity.started_at,
            ended_at: student_activity.ended_at,
            duration_seconds: student_activity.duration_seconds,
            material_title: materials.title,
        })
        .from(student_activity)
        .leftJoin(materials, eq(student_activity.material_id, materials.id))
        .where(inArray(student_activity.student_id, studentIds))
        .orderBy(desc(student_activity.ended_at));

    const latestMap = new Map();
    for (const row of rows) {
        if (!latestMap.has(row.student_id)) {
            latestMap.set(row.student_id, row);
        }
    }

    return c.json(Array.from(latestMap.values()));
});

export default app;
