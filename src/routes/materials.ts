import { Hono } from 'hono';
import { db } from '../db';
import { materials, quizzes, questions } from '../db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const app = new Hono();

const materialSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    content: z.string().min(1),
    major_target: z.string().optional(),
    target_grade: z.number().int().nullable().optional(),
    teacher_name: z.string().optional(),
    is_featured: z.boolean().optional(),
    embedded_tool_url: z.string().optional(), // Legacy field
    tool_type: z.string().optional(), // Legacy field
    image_url: z.string().optional(),
    // Per-stage embed tools
    discover_tool_type: z.string().optional(),
    discover_tool_url: z.string().optional(),
    explore_tool_type: z.string().optional(),
    explore_tool_url: z.string().optional(),
    launch_tool_type: z.string().optional(),
    launch_tool_url: z.string().optional(),
    transform_tool_type: z.string().optional(),
    transform_tool_url: z.string().optional(),
    assess_tool_type: z.string().optional(),
    assess_tool_url: z.string().optional(),
});

// GET /materials
app.get('/', async (c) => {
    const result = await db.select().from(materials);
    return c.json(result);
});

// GET /materials/:id
app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const result = await db.select().from(materials).where(eq(materials.id, id));
    if (result.length === 0) return c.json({ error: 'Material not found' }, 404);
    return c.json(result[0]);
});

// POST /materials
app.post('/', zValidator('json', materialSchema), async (c) => {
    const body = c.req.valid('json');
    const result = await db.insert(materials).values(body).returning();
    return c.json(result[0], 201);
});

// PUT /materials/:id
app.put('/:id', zValidator('json', materialSchema.partial()), async (c) => {
    const id = c.req.param('id');
    const body = c.req.valid('json');
    const result = await db.update(materials).set(body).where(eq(materials.id, id)).returning();
    if (result.length === 0) return c.json({ error: 'Material not found' }, 404);
    return c.json(result[0]);
});

// DELETE /materials/:id
app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const result = await db.delete(materials).where(eq(materials.id, id)).returning();
    if (result.length === 0) return c.json({ error: 'Material not found' }, 404);
    return c.json({ message: 'Material deleted successfully' });
});

// GET /materials/:id/quiz
app.get('/:id/quiz', async (c) => {
    const id = c.req.param('id');

    // Find quiz for this material
    const quiz = await db.select().from(quizzes).where(eq(quizzes.material_id, id)).limit(1);

    const quizData = quiz[0];

    if (!quizData) {
        return c.json({ error: 'No quiz found for this material' }, 404);
    }

    // Find questions for this quiz
    const qs = await db.select().from(questions).where(eq(questions.quiz_id, quizData.id));

    return c.json({
        ...quizData,
        questions: qs
    });
});

export default app;
