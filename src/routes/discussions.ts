import { Hono } from 'hono';
import { db } from '../db';
import { posts, comments, poll_votes } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const app = new Hono();

// Schemas
// Schemas
const postSchema = z.object({
    content: z.string().min(1),
    author_id: z.string().min(1),
    author_name: z.string().min(1),
    author_role: z.enum(['student', 'admin', 'guru']),
    poll_options: z.array(z.object({
        id: z.string(),
        text: z.string()
    })).optional()
});

const commentSchema = z.object({
    content: z.string().min(1),
    author_id: z.string().min(1),
    author_name: z.string().min(1),
    author_role: z.enum(['student', 'admin', 'guru']),
});

const voteSchema = z.object({
    student_id: z.string().min(1),
    option_index: z.number().int().min(0)
});

// GET /discussions - List all posts with comments and votes
app.get('/', async (c) => {
    const result = await db.query.posts.findMany({
        orderBy: [desc(posts.created_at)],
        with: {
            comments: {
                orderBy: (comments: any, { asc }: any) => [asc(comments.created_at)]
            },
            votes: true // Include all votes to calculate counts on frontend (or backend optimization later)
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

// POST /discussions/:id/vote - Cast Vote
app.post('/:id/vote', zValidator('json', voteSchema), async (c) => {
    const postId = c.req.param('id');
    const { student_id, option_index } = c.req.valid('json');

    // Check if valid post and poll
    const post = await db.query.posts.findFirst({
        where: eq(posts.id, postId)
    });

    if (!post) return c.json({ error: 'Post not found' }, 404);
    if (!post.poll_options) return c.json({ error: 'Not a poll' }, 400);

    // Check if already voted
    const existing = await db.query.poll_votes.findFirst({
        where: and(
            eq(poll_votes.post_id, postId),
            eq(poll_votes.student_id, student_id)
        )
    });

    if (existing) {
        return c.json({ error: 'Already voted' }, 400);
    }

    const [vote] = await db.insert(poll_votes).values({
        post_id: postId,
        student_id: student_id,
        option_index: option_index
    }).returning();

    return c.json(vote, 201);
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
