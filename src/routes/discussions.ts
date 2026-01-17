import { Hono } from 'hono';
import { db } from '../db';
import { posts, comments } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const app = new Hono();

// Schemas
const postSchema = z.object({
    content: z.string().min(1),
    author_id: z.string().min(1),
    author_name: z.string().min(1),
    author_role: z.enum(['student', 'admin', 'guru']),
});

const commentSchema = z.object({
    content: z.string().min(1),
    author_id: z.string().min(1),
    author_name: z.string().min(1),
    author_role: z.enum(['student', 'admin', 'guru']),
});

// GET /discussions - List all posts with comments
app.get('/', async (c) => {
    const result = await db.query.posts.findMany({
        orderBy: [desc(posts.created_at)],
        with: {
            comments: {
                orderBy: (comments: any, { asc }: any) => [asc(comments.created_at)]
            }
        }
    });
    return c.json(result);
});

// POST /discussions - Create Post
app.post('/', zValidator('json', postSchema), async (c) => {
    const body = c.req.valid('json');
    const [newItem] = await db.insert(posts).values(body).returning();
    return c.json(newItem, 201);
});

// DELETE /discussions/:id - Delete Post
app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    await db.delete(posts).where(eq(posts.id, id));
    return c.json({ message: 'Deleted' });
});

// POST /discussions/:id/comments - Add Comment
app.post('/:id/comments', zValidator('json', commentSchema), async (c) => {
    const postId = c.req.param('id');
    const body = c.req.valid('json');

    // Check if post is locked
    const post = await db.query.posts.findFirst({
        where: eq(posts.id, postId)
    });

    if (!post) return c.json({ error: 'Post not found' }, 404);
    if (post.is_locked) return c.json({ error: 'Post is locked' }, 403);

    const [comment] = await db.insert(comments).values({
        post_id: postId,
        ...body
    }).returning();

    return c.json(comment, 201);
});

// DELETE /discussions/comments/:id
app.delete('/comments/:id', async (c) => {
    const id = c.req.param('id');
    await db.delete(comments).where(eq(comments.id, id));
    return c.json({ message: 'Deleted' });
});

// PATCH /discussions/:id/lock - Toggle Lock
app.patch('/:id/lock', async (c) => {
    const id = c.req.param('id');
    const { is_locked } = await c.req.json();

    await db.update(posts)
        .set({ is_locked: is_locked })
        .where(eq(posts.id, id));

    return c.json({ message: 'Updated' });
});

export default app;
