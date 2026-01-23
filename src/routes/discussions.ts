import { Hono } from "hono";
import { db } from "../db";
import { posts, comments, discussion_likes, discussion_follows } from "../db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

const app = new Hono();
const getUserId = (c) => {
  return c.req.header('X-User-ID') || c.req.query('user_id') || null;
};

const ensureFollow = async (postId, userId) => {
  if (!userId) return;
  const existing = await db.query.discussion_follows.findFirst({
    where: and(eq(discussion_follows.post_id, postId), eq(discussion_follows.user_id, userId))
  });
  if (!existing) {
    await db.insert(discussion_follows).values({ post_id: postId, user_id: userId });
  }
};


// Schemas
// Schemas
const postSchema = z.object({
  content: z.string().min(1),
  author_id: z.string().min(1),
  author_name: z.string().min(1),
  author_role: z.enum(["student", "admin", "guru"]),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const commentSchema = z.object({
  content: z.string().min(1),
  author_id: z.string().min(1),
  author_name: z.string().min(1),
  author_role: z.enum(["student", "admin", "guru"]),
});

// GET /discussions - List all posts with comments
app.get("/", async (c) => {
  const userId = getUserId(c);
  const result = await db.query.posts.findMany({
    orderBy: [desc(posts.created_at)],
    with: {
      comments: {
        orderBy: (comments: any, { asc }: any) => [asc(comments.created_at)],
      },
    },
  });

  if (!userId) {
    return c.json(result);
  }

  const postIds = result.map((p) => p.id);
  if (postIds.length === 0) {
    return c.json(result);
  }
  const [likes, follows] = await Promise.all([
    db.select().from(discussion_likes).where(inArray(discussion_likes.post_id, postIds)),
    db.select().from(discussion_follows).where(inArray(discussion_follows.post_id, postIds))
  ]);

  const likedSet = new Set(likes.filter((l) => l.user_id === userId).map((l) => l.post_id));
  const followMap = new Map(follows.filter((f) => f.user_id === userId).map((f) => [f.post_id, f.last_read_at]));

  const enriched = result.map((post: any) => {
    const lastRead = followMap.get(post.id);
    const lastActivity = post.last_activity_at || post.created_at;
    const hasUnread = lastRead ? new Date(lastActivity) > new Date(lastRead) : false;
    return {
      ...post,
      liked_by_me: likedSet.has(post.id),
      likes_count: likes.filter((l) => l.post_id === post.id).length,
      is_following: followMap.has(post.id),
      has_unread: hasUnread,
    };
  });

  return c.json(enriched);
});

// POST /discussions - Create Post
app.post("/", zValidator("json", postSchema), async (c) => {
  const body = c.req.valid("json");
  const now = new Date();
  const [newItem] = await db.insert(posts).values({
    ...body,
    category: body.category || 'Umum',
    tags: body.tags || [],
    last_activity_at: now,
  }).returning();

  await ensureFollow(newItem.id, body.author_id);
  return c.json(newItem, 201);
});

// DELETE /discussions/:id - Delete Post
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await db.delete(posts).where(eq(posts.id, id));
  return c.json({ message: "Deleted" });
});

// POST /discussions/:id/comments - Add Comment
app.post("/:id/comments", zValidator("json", commentSchema), async (c) => {
  const postId = c.req.param("id");
  const body = c.req.valid("json");

  // Check if post is locked
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
  });

  if (!post) return c.json({ error: "Post not found" }, 404);
  if (post.is_locked) return c.json({ error: "Post is locked" }, 403);

  const [comment] = await db
    .insert(comments)
    .values({
      post_id: postId,
      ...body,
    })
    .returning();

  await db.update(posts).set({ last_activity_at: new Date() }).where(eq(posts.id, postId));
  await ensureFollow(postId, body.author_id);

  return c.json(comment, 201);
});

// DELETE /discussions/comments/:id
app.delete("/comments/:id", async (c) => {
  const id = c.req.param("id");
  await db.delete(comments).where(eq(comments.id, id));
  return c.json({ message: "Deleted" });
});

// PATCH /discussions/:id/lock - Toggle Lock
app.patch("/:id/lock", async (c) => {
  const id = c.req.param("id");
  const { is_locked } = await c.req.json();

  await db.update(posts).set({ is_locked: is_locked }).where(eq(posts.id, id));

  return c.json({ message: "Updated" });
});


// POST /discussions/:id/like - Toggle like
app.post('/:id/like', async (c) => {
  const postId = c.req.param('id');
  const { user_id } = await c.req.json();
  if (!user_id) return c.json({ error: 'user_id is required' }, 400);
  const existing = await db.query.discussion_likes.findFirst({
    where: and(eq(discussion_likes.post_id, postId), eq(discussion_likes.user_id, user_id))
  });
  if (existing) {
    await db.delete(discussion_likes).where(eq(discussion_likes.id, existing.id));
    return c.json({ liked: false });
  }
  await db.insert(discussion_likes).values({ post_id: postId, user_id });
  return c.json({ liked: true });
});

// POST /discussions/:id/read - Mark as read
app.post('/:id/read', async (c) => {
  const postId = c.req.param('id');
  const { user_id } = await c.req.json();
  if (!user_id) return c.json({ error: 'user_id is required' }, 400);
  const existing = await db.query.discussion_follows.findFirst({
    where: and(eq(discussion_follows.post_id, postId), eq(discussion_follows.user_id, user_id))
  });
  if (existing) {
    await db.update(discussion_follows).set({ last_read_at: new Date() }).where(eq(discussion_follows.id, existing.id));
  } else {
    await db.insert(discussion_follows).values({ post_id: postId, user_id, last_read_at: new Date() });
  }
  return c.json({ success: true });
});

// PATCH /discussions/:id/solved - Mark best answer
app.patch('/:id/solved', async (c) => {
  const postId = c.req.param('id');
  const { solved_comment_id } = await c.req.json();
  await db.update(posts).set({ solved_comment_id }).where(eq(posts.id, postId));
  return c.json({ success: true });
});

export default app;
