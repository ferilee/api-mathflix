import { Hono } from 'hono';
import { db } from '../db';
import { audit_logs } from '../db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const app = new Hono();

const auditLogSchema = z.object({
  action: z.enum(['create', 'update', 'delete']),
  entity: z.string().min(1),
  entity_id: z.string().min(1),
  summary: z.string().optional(),
  actor_id: z.string().min(1),
  actor_name: z.string().min(1),
  actor_role: z.string().min(1),
});

const toPayload = (row: any) => ({
  ...row,
  timestamp: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
});

// GET /audit-logs
app.get('/', async (c) => {
  const action = c.req.query('action');
  const entity = c.req.query('entity');
  const actorId = c.req.query('actor_id');

  const conditions = [] as any[];
  if (action) conditions.push(eq(audit_logs.action, action));
  if (entity) conditions.push(eq(audit_logs.entity, entity));
  if (actorId) conditions.push(eq(audit_logs.actor_id, actorId));

  const query = db.select().from(audit_logs).orderBy(desc(audit_logs.created_at));
  if (conditions.length) {
    const result = await query.where(and(...conditions));
    return c.json(result.map(toPayload));
  }
  const result = await query;
  return c.json(result.map(toPayload));
});

// POST /audit-logs
app.post('/', zValidator('json', auditLogSchema), async (c) => {
  const body = c.req.valid('json');
  const result = await db.insert(audit_logs).values(body).returning();
  return c.json(toPayload(result[0]), 201);
});

export default app;
