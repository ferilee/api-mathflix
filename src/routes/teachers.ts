import { Hono } from 'hono';
import { db } from '../db';
import { teachers } from '../db/schema';
import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const app = new Hono();

const teacherSchema = z.object({
  nip: z.string().min(1),
  full_name: z.string().min(1),
  school: z.string().min(1),
});

const teacherRequestSchema = teacherSchema;

const resolveStatusFilter = (status?: string | null) => {
  if (!status || status === 'approved') return 'approved';
  if (status === 'any') return null;
  return status;
};

const withApprovedFallback = (status?: string | null) => {
  if (status === 'approved') {
    return or(eq(teachers.status, 'approved'), isNull(teachers.status));
  }
  if (!status) return null;
  return eq(teachers.status, status);
};

// GET /teachers
app.get('/', async (c) => {
  const nip = c.req.query('nip');
  const statusFilter = resolveStatusFilter(c.req.query('status'));
  const statusClause = withApprovedFallback(statusFilter);

  if (nip) {
    const whereClause = statusClause
      ? and(eq(teachers.nip, nip), statusClause)
      : eq(teachers.nip, nip);
    const result = await db.select().from(teachers).where(whereClause);
    return c.json(result);
  }

  const query = statusClause
    ? db.select().from(teachers).where(statusClause)
    : db.select().from(teachers);
  const result = await query.orderBy(desc(teachers.created_at));
  return c.json(result);
});

// GET /teachers/requests
app.get('/requests', async (c) => {
  const status = c.req.query('status') || 'pending';
  const statusFilter = resolveStatusFilter(status);
  const statusClause = withApprovedFallback(statusFilter);
  const query = statusClause
    ? db.select().from(teachers).where(statusClause)
    : db.select().from(teachers);
  const result = await query.orderBy(desc(teachers.created_at));
  return c.json(result);
});

// POST /teachers/requests
app.post('/requests', zValidator('json', teacherRequestSchema), async (c) => {
  const body = c.req.valid('json');
  const existing = await db.query.teachers.findFirst({
    where: eq(teachers.nip, body.nip),
  });

  if (existing) {
    if (existing.status === 'rejected') {
      const updated = await db
        .update(teachers)
        .set({
          full_name: body.full_name,
          school: body.school,
          status: 'pending',
          created_at: new Date(),
        })
        .where(eq(teachers.id, existing.id))
        .returning();
      return c.json(updated[0], 200);
    }

    if (existing.status === 'pending') {
      return c.json({ error: 'Permintaan sudah dikirim.' }, 409);
    }

    return c.json({ error: 'NIP sudah terdaftar.' }, 409);
  }

  const result = await db
    .insert(teachers)
    .values({ ...body, status: 'pending' })
    .returning();
  return c.json(result[0], 201);
});

// POST /teachers/requests/:id/approve
app.post('/requests/:id/approve', async (c) => {
  const id = c.req.param('id');
  const result = await db
    .update(teachers)
    .set({ status: 'approved' })
    .where(eq(teachers.id, id))
    .returning();
  if (result.length === 0) return c.json({ error: 'Teacher not found' }, 404);
  return c.json(result[0]);
});

// POST /teachers/requests/:id/reject
app.post('/requests/:id/reject', async (c) => {
  const id = c.req.param('id');
  const result = await db
    .update(teachers)
    .set({ status: 'rejected' })
    .where(eq(teachers.id, id))
    .returning();
  if (result.length === 0) return c.json({ error: 'Teacher not found' }, 404);
  return c.json(result[0]);
});

// POST /teachers
app.post('/', zValidator('json', teacherSchema), async (c) => {
  const body = c.req.valid('json');
  const existing = await db.query.teachers.findFirst({
    where: eq(teachers.nip, body.nip),
  });
  if (existing) return c.json({ error: 'NIP sudah terdaftar' }, 409);
  const result = await db
    .insert(teachers)
    .values({ ...body, status: 'approved' })
    .returning();
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
