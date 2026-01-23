import { Hono } from 'hono';
import { db } from '../db';
import { question_bank } from '../db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const app = new Hono();

const questionBankSchema = z.object({
  material_id: z.string().uuid().nullable().optional(),
  question_text: z.string().min(1),
  question_type: z.string(),
  options: z.array(z.string()).min(2),
  correct_answer: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  tags: z.array(z.string()).optional(),
  image_url: z.string().url().optional()
});

app.get('/', async (c) => {
  const result = await db.select().from(question_bank);
  return c.json(result);
});

app.post('/', zValidator('json', questionBankSchema), async (c) => {
app.post('/bulk', zValidator('json', z.array(questionBankSchema)), async (c) => {
  const body = c.req.valid("json");
  const rows = body.map((item: any) => ({
    ...item,
    material_id: item.material_id || null,
    tags: item.tags || [],
    image_url: item.image_url || null
  }));
  const result = await db.insert(question_bank).values(rows).returning();
  return c.json({ inserted: result.length }, 201);
});

  const body = c.req.valid('json');
  const result = await db.insert(question_bank).values({
    ...body,
    material_id: body.material_id || null,
    tags: body.tags || [],
    image_url: body.image_url || null
  }).returning();
  return c.json(result[0], 201);
});

app.put('/:id', zValidator('json', questionBankSchema.partial()), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');
  const result = await db.update(question_bank).set(body).where(eq(question_bank.id, id)).returning();
  if (result.length === 0) return c.json({ error: 'Question not found' }, 404);
  return c.json(result[0]);
});

app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const result = await db.delete(question_bank).where(eq(question_bank.id, id)).returning();
  if (result.length === 0) return c.json({ error: 'Question not found' }, 404);
  return c.json({ message: 'Question deleted', id });
});

export default app;
