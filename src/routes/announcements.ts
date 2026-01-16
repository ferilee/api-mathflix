import { Hono } from 'hono';
import { db } from '../db';
import { announcements } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const app = new Hono();

const announcementSchema = z.object({
    title: z.string().min(1),
    content: z.string().min(1),
});

// GET /announcements - List all announcements (newest first)
app.get('/', async (c) => {
    const result = await db.select().from(announcements).orderBy(desc(announcements.created_at));
    return c.json(result);
});

// POST /announcements - Create new announcement
app.post('/', zValidator('json', announcementSchema), async (c) => {
    const body = c.req.valid('json');
    const [announcement] = await db.insert(announcements).values({
        title: body.title,
        content: body.content,
    }).returning();
    return c.json(announcement, 201);
});

// DELETE /announcements/:id - Delete announcement
app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    await db.delete(announcements).where(eq(announcements.id, id));
    return c.json({ message: 'Announcement deleted' });
});

export default app;
