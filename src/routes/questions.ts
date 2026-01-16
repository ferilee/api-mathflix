import { Hono } from 'hono';
import { db } from '../db';
import { questions } from '../db/schema';
import { eq } from 'drizzle-orm';

const app = new Hono();

// DELETE /questions/:id
app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const result = await db.delete(questions).where(eq(questions.id, id)).returning();

    if (result.length === 0) {
        return c.json({ error: 'Question not found' }, 404);
    }

    return c.json({ message: 'Question deleted successfully', id });
});

export default app;
