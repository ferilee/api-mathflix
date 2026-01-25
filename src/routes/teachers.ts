import { Hono } from 'hono';
import { db } from '../db';
import { teachers } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const app = new Hono();

const teacherSchema = z.object({
  nip: z.string().min(1),
  full_name: z.string().min(1),
  school: z.string().min(1),
});

// GET /teachers
app.get('/', async (c) => {
  const nip = c.req.query('nip');
  if (nip) {
    const result = await db.select().from(teachers).where(eq(teachers.nip, nip));
    return c.json(result);
  }
  const result = await db.select().from(teachers).orderBy(desc(teachers.created_at));
  return c.json(result);
});

// POST /teachers
app.post('/', zValidator('json', teacherSchema), async (c) => {
  const body = c.req.valid('json');
  const existing = await db.query.teachers.findFirst({
    where: eq(teachers.nip, body.nip),
  });
  if (existing) return c.json({ error: 'NIP sudah terdaftar' }, 409);
  const result = await db.insert(teachers).values(body).returning();
  return c.json(result[0], 201);
});

// DELETE /teachers/:id
app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const result = await db.delete(teachers).where(eq(teachers.id, id)).returning();
  if (result.length === 0) return c.json({ error: 'Teacher not found' }, 404);
  return c.json({ message: 'Teacher deleted' });
});

export default app;
